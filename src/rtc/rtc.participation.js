(function (odd) {
    var RTC = odd.RTC,
        UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        ZERO = '00000000-0000-0000-0000-000000000000';

    function uuid(value) {
        return typeof value === 'string' && UUID.test(value) && value !== ZERO;
    }

    function random(size) {
        var bytes = new Uint8Array(size);
        window.crypto.getRandomValues(bytes);
        return bytes;
    }

    function requestId() {
        var bytes = random(16), text = '';
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        for (var i = 0; i < bytes.length; i++) {
            if (i === 4 || i === 6 || i === 8 || i === 10) {
                text += '-';
            }
            text += ('0' + bytes[i].toString(16)).slice(-2);
        }
        return text;
    }

    function endpoint(value, origin) {
        if (typeof value !== 'string' || !value || value.length > 2048) {
            throw { name: 'DataError', message: 'Invalid RTC participation endpoint.' };
        }
        var url = new URL(value, document.baseURI);
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
            (origin && url.origin !== origin)) {
            throw { name: 'SecurityError', message: 'RTC participation requires a fixed HTTPS origin.' };
        }
        return url;
    }

    // One controller per RTC instance. No network work occurs in construction,
    // setup or preview. References represent technical streams, not users.
    function Participation(config, timeout, logger) {
        var _this = this,
            _members = new Set(),
            _current,
            _pending,
            _generation = 0,
            _idle = 0,
            _idleTimer,
            _closed = false,
            _limit = config && config.maxSessions !== undefined ? config.maxSessions : 128;

        if (!config || typeof config.credentials !== 'function' || !Number.isInteger(_limit) ||
            _limit < 1 || _limit > 1024 || !Number.isFinite(timeout) || timeout <= 0 || timeout > 2147483647) {
            throw { name: 'TypeError', message: 'Invalid RTC participation configuration.' };
        }
        if (!window.crypto || !window.crypto.getRandomValues || !window.fetch || !window.AbortController ||
            !window.ReadableStream || !window.TextDecoder) {
            throw { name: 'NotSupportedError', message: 'RTC participation requires secure Fetch and cancellation.' };
        }

        async function _request(entry, method, url, body, type, etag, deadline, requests, limit) {
            url = endpoint(url, new URL(entry.url).origin);
            if (requests.size >= (method === 'DELETE' ? 33 : 32) ||
                (body !== undefined && (typeof body !== 'string' || body.length > 1048576))) {
                throw { name: 'QuotaExceededError', message: 'RTC request exceeds its limit.' };
            }
            deadline = Math.min(deadline, Date.now() + timeout);
            if (method === 'POST') {
                deadline = Math.min(deadline, entry.credentials.connectBefore * 1000);
            }
            var remaining = deadline - Date.now();
            if (remaining <= 0) {
                throw { name: 'TimeoutError', message: 'RTC participation request timed out.' };
            }
            var controller = new AbortController(), expired = false;
            var timer = setTimeout(function () {
                expired = true;
                controller.abort();
            }, remaining);
            requests.set(controller, method);
            var headers = { 'Odd-RTC-Proof': entry.proof };
            if (entry.participantId) {
                headers['Odd-RTC-Participant'] = entry.participantId;
                headers['Odd-RTC-Boot'] = entry.bootId;
            }
            if (method === 'POST') {
                headers.Authorization = 'Bearer ' + entry.credentials.token;
            }
            if (type) {
                headers['Content-Type'] = type;
            }
            if (etag) {
                headers['If-Match'] = etag;
            }
            try {
                var response = await fetch(url.href, {
                    method: method, headers: headers, body: body, signal: controller.signal,
                    mode: 'cors', credentials: 'omit', cache: 'no-store', redirect: 'error',
                    keepalive: method === 'DELETE',
                });
                if (response.url !== url.href || response.redirected) {
                    throw { name: 'SecurityError', message: 'RTC participation endpoint changed.' };
                }
                if ((response.status < 200 || response.status > 299) &&
                    !(method === 'DELETE' && (response.status === 404 || response.status === 410))) {
                    throw { name: 'NetworkError', message: 'RTC request failed: status=' + response.status + '.', status: response.status };
                }
                var length = response.headers.get('Content-Length');
                if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) {
                    throw { name: 'QuotaExceededError', message: 'RTC response exceeds its limit.' };
                }
                var reader = response.body && response.body.getReader(), text = '', size = 0;
                var decoder = new TextDecoder('utf-8', { fatal: true });
                if (reader) {
                    while (true) {
                        var chunk = await reader.read();
                        if (chunk.done) {
                            break;
                        }
                        size += chunk.value.byteLength;
                        if (size > limit) {
                            throw { name: 'QuotaExceededError', message: 'RTC response exceeds its limit.' };
                        }
                        text += decoder.decode(chunk.value, { stream: true });
                    }
                    text += decoder.decode();
                }
                if (expired || Date.now() >= deadline) {
                    throw { name: 'TimeoutError', message: 'RTC participation request timed out.' };
                }
                return { status: response.status, headers: response.headers, body: text };
            } catch (error) {
                controller.abort();
                if (expired) {
                    throw { name: 'TimeoutError', message: 'RTC participation request timed out.' };
                }
                throw error;
            } finally {
                clearTimeout(timer);
                requests.delete(controller);
            }
        }

        function _cleanup(entry) {
            if (!entry || !entry.participantId || entry.releasing) {
                return;
            }
            entry.releasing = true;
            _request(entry, 'DELETE', entry.controlUrl, undefined, '', '',
                Date.now() + Math.min(timeout, 5000), new Map(), 4096).catch(function (error) {
                logger.warn('Failed to release RTC participation: error=' + error.name + '.');
            });
        }

        function _cancelPending() {
            if (!_pending) {
                return;
            }
            var job = _pending;
            _pending = undefined;
            job.cancelled = true;
            clearTimeout(job.timer);
            job.requests.forEach(function (_, controller) { controller.abort(); });
        }

        function _release(member) {
            if (!_members.delete(member)) {
                return;
            }
            clearTimeout(member.timer);
            member.requests.forEach(function (_, controller) { controller.abort(); });
            if (member.waiting) {
                member.reject({ name: 'AbortError', message: 'RTC participation wait was cancelled.' });
            }
            if (!Array.from(_members).some(function (item) { return item.waiting; })) {
                _cancelPending();
            }
            if (!_members.size && _current && !_closed) {
                _idle = performance.now() + 30000;
                clearTimeout(_idleTimer);
                var entry = _current;
                _idleTimer = setTimeout(function () {
                    if (_current === entry && !_members.size) {
                        _current = undefined;
                        _cleanup(entry);
                    }
                }, 30000);
            }
        }

        function _deliver(member) {
            if (!member.waiting || !_members.has(member)) {
                return;
            }
            if (Date.now() >= member.deadline) {
                member.reject({ name: 'TimeoutError', message: 'RTC participation wait timed out.' });
                member.waiting = false;
                _release(member);
                return;
            }
            var entry = _current;
            clearTimeout(member.timer);
            member.waiting = false;
            member.entry = entry;
            member.resolve({
                id: entry.participantId,
                url: function (direction, stream) {
                    if (!uuid(stream)) {
                        throw { name: 'DataError', message: 'RTC media requires a publication UUID.' };
                    }
                    return (direction === 'publish' ? entry.whipUrl : entry.whepUrl) + '/' + stream;
                },
                send: async function (method, url, body, type, etag, deadline, limit) {
                    if (!_members.has(member) || (method !== 'DELETE' && (_closed || entry.releasing))) {
                        return Promise.reject({ name: 'AbortError', message: 'RTC participation is closing.' });
                    }
                    var target = endpoint(url, new URL(entry.url).origin);
                    if (target.href.indexOf(entry.whipUrl + '/') !== 0 && target.href.indexOf(entry.whepUrl + '/') !== 0) {
                        return Promise.reject({ name: 'SecurityError', message: 'RTC media left its assigned endpoint.' });
                    }
                    return _request(entry, method, target.href, body, type, etag, deadline, member.requests, limit)
                        .catch(function (error) {
                            if (error.status === 410) {
                                _invalidate(entry, error);
                            }
                            throw error;
                        });
                },
                abort: function () {
                    member.requests.forEach(function (method, controller) {
                        if (method !== 'DELETE') {
                            controller.abort();
                        }
                    });
                },
                release: function () { _release(member); },
            });
        }

        function _invalidate(entry, error) {
            if (_current !== entry) {
                return;
            }
            _current = undefined;
            // An in-flight refresh must not reinstall this expired participant.
            if (_pending && _pending.previous === entry) {
                _failed(_pending, error);
            }
            _cleanup(entry);
            Array.from(_members).forEach(function (member) {
                if (!member.waiting && member.entry === entry) {
                    member.stop(error);
                }
            });
        }

        function _failed(job, error) {
            if (_pending !== job) {
                return;
            }
            _pending = undefined;
            clearTimeout(job.timer);
            job.cancelled = true;
            job.requests.forEach(function (_, controller) { controller.abort(); });
            Array.from(_members).forEach(function (member) {
                if (member.waiting) {
                    member.waiting = false;
                    member.reject(error);
                    _release(member);
                }
            });
        }

        async function _start(job) {
            try {
                var previous = job.previous;
                var entry = previous || { requestId: requestId(), proof: btoa(String.fromCharCode.apply(null, random(32)))
                    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') };
                var credentials = await config.credentials({
                    reason: previous ? 'refresh' : 'join', connectionId: entry.requestId, generation: String(++_generation),
                });
                if (job.cancelled || _closed || _pending !== job) {
                    return;
                }
                if (!credentials || typeof credentials.token !== 'string' || !credentials.token ||
                    credentials.token.length > 8192 || /[^\x21-\x7e]/.test(credentials.token) ||
                    !Number.isSafeInteger(credentials.connectBefore) || credentials.connectBefore <= Date.now() / 1000) {
                    throw { name: 'DataError', message: 'Invalid RTC participant credentials.' };
                }
                var target = endpoint(credentials.url);
                if (previous && target.href !== previous.url) {
                    throw { name: 'InvalidModificationError', message: 'RTC refresh cannot move its participant.' };
                }
                // A rejected refresh must not replace credentials on established media.
                var candidate = Object.assign({}, entry, { url: target.href, credentials: {
                    token: credentials.token, connectBefore: credentials.connectBefore,
                } });
                var result = await _request(candidate, 'POST', candidate.url, JSON.stringify({ requestId: entry.requestId }),
                    'application/json', '', Math.min(job.deadline, credentials.connectBefore * 1000), job.requests, 16384);
                if ((result.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase() !== 'application/json') {
                    throw { name: 'DataError', message: 'Invalid RTC participation response type.' };
                }
                var value = JSON.parse(result.body);
                if (value.profile !== 'odd-rtc-participation.v1' || !uuid(value.participantId) ||
                    typeof value.nodeId !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(value.nodeId) ||
                    !uuid(value.bootId) || !uuid(value.appId) || !uuid(value.channelAppId) || value.appId === value.channelAppId ||
                    typeof value.userId !== 'string' || value.userId.length > 128 || /[^A-Za-z0-9_.-]/.test(value.userId) ||
                    value.idleRetentionSeconds !== 30) {
                    throw { name: 'DataError', message: 'Invalid RTC participation response.' };
                }
                var control = endpoint(value.controlUrl, target.origin), whip = endpoint(value.whipUrl, target.origin),
                    whep = endpoint(value.whepUrl, target.origin);
                if (control.href !== target.href.replace(/\/$/, '') + '/' + value.participantId ||
                    control.href !== value.controlUrl || whip.href !== value.whipUrl || whep.href !== value.whepUrl ||
                    whip.href === whep.href || whip.pathname.endsWith('/') || whep.pathname.endsWith('/')) {
                    throw { name: 'DataError', message: 'Invalid RTC participation routes.' };
                }
                if (previous && ['participantId', 'nodeId', 'bootId', 'appId', 'channelAppId', 'userId',
                    'controlUrl', 'whipUrl', 'whepUrl'].some(function (key) { return previous[key] !== value[key]; })) {
                    throw { name: 'InvalidModificationError', message: 'RTC refresh changed its participation binding.' };
                }
                ['participantId', 'nodeId', 'bootId', 'appId', 'channelAppId', 'userId',
                    'controlUrl', 'whipUrl', 'whepUrl'].forEach(function (key) { candidate[key] = value[key]; });
                if (job.cancelled || _closed || _pending !== job || !_members.size) {
                    if (!previous) {
                        _cleanup(candidate);
                    }
                    return;
                }
                // Keep one object for existing leases while updating the cached JWT.
                _current = previous ? Object.assign(previous, candidate) : candidate;
                _pending = undefined;
                clearTimeout(job.timer);
                _members.forEach(_deliver);
            } catch (error) {
                if (error.status === 410 && previous) {
                    _invalidate(previous, error);
                }
                _failed(job, error);
            }
        }

        _this.acquire = function (deadline, stop) {
            var member = { waiting: true, deadline: deadline, stop: stop, requests: new Map() };
            var ticket = {
                promise: new Promise(function (resolve, reject) { member.resolve = resolve; member.reject = reject; }),
                cancel: function () { _release(member); },
            };
            if (_closed || !Number.isFinite(deadline) || deadline <= Date.now() || typeof stop !== 'function' || _members.size >= _limit) {
                var name = _closed ? 'AbortError' : (!Number.isFinite(deadline) || typeof stop !== 'function' ? 'TypeError' :
                    (deadline <= Date.now() ? 'TimeoutError' : 'QuotaExceededError'));
                member.reject({ name: name, message: 'RTC participation cannot accept this stream.' });
                return ticket;
            }
            if (_current && !_members.size && _idle && performance.now() >= _idle) {
                _cleanup(_current);
                _current = undefined;
            }
            clearTimeout(_idleTimer);
            _idle = 0;
            _members.add(member);
            member.timer = setTimeout(function () {
                if (member.waiting) {
                    member.waiting = false;
                    member.reject({ name: 'TimeoutError', message: 'RTC participation wait timed out.' });
                    _release(member);
                }
            }, Math.max(1, deadline - Date.now()));
            if (_current && _current.credentials.connectBefore > Date.now() / 1000) {
                _deliver(member);
            } else if (!_pending) {
                var job = { deadline: deadline, previous: _current, requests: new Map(), cancelled: false };
                _pending = job;
                job.timer = setTimeout(function () {
                    _failed(job, { name: 'TimeoutError', message: 'RTC participation preparation timed out.' });
                }, Math.max(1, deadline - Date.now()));
                _start(job);
            }
            return ticket;
        };

        _this.close = function () {
            if (_closed) {
                return;
            }
            _closed = true;
            clearTimeout(_idleTimer);
            _cancelPending();
            Array.from(_members).forEach(function (member) {
                if (member.waiting) {
                    _release(member);
                } else {
                    member.stop({ name: 'AbortError', message: 'RTC participation closed.' });
                }
            });
            _cleanup(_current);
            _current = undefined;
        };
    }

    RTC.Participation = Participation;
})(odd);
