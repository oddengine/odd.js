(function (odd) {
    var MediaRequest = odd.utils.MediaRequest,
        UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
        CREDENTIAL = new RegExp('^' + UUID + '\\.' + UUID + UUID + '$');

    // One product subscription owns all manifest/segment requests. The lease is
    // node-local; renewing it never allocates another subscription or exports
    // the user's JWT into a native video element's URLs.
    function PlaybackSession(config, unavailable) {
        var _this = this, _closed = false, _opening = false, _lease, _endpoint,
            _controllers = new Set(), _renewTimer, _expiryTimer;

        function _abort() { return { name: 'AbortError', message: 'Playback session closed.' }; }

        async function _fetch(url, options, maximum) {
            if (_closed) { throw _abort(); }
            var controller = new AbortController(), timer, timedOut = false;
            _controllers.add(controller);
            timer = setTimeout(function () { timedOut = true; controller.abort(); }, config.timeout);
            try {
                var response = await fetch(url, Object.assign({ mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-store' }, options, { signal: controller.signal }));
                if (!response.ok) {
                    throw { name: response.status === 404 ? 'NotFoundError' : response.status === 401 || response.status === 403 ? 'NotAllowedError' : 'NetworkError',
                        message: 'Playback request failed.', status: response.status, credentialExpired: MediaRequest.expired(response) };
                }
                var length = response.headers.get('Content-Length');
                if (length && (!/^\d+$/.test(length) || Number(length) > maximum)) {
                    throw { name: 'QuotaExceededError', message: 'Playback response is too large.' };
                }
                var reader = response.body.getReader(), chunks = [], size = 0;
                for (;;) {
                    var item = await reader.read();
                    if (item.done) { break; }
                    size += item.value.byteLength;
                    if (size > maximum) { await reader.cancel(); throw { name: 'QuotaExceededError', message: 'Playback response is too large.' }; }
                    chunks.push(item.value);
                }
                if (_closed) { throw _abort(); }
                var result = new Uint8Array(size), offset = 0;
                chunks.forEach(function (chunk) { result.set(chunk, offset); offset += chunk.byteLength; });
                return result;
            } catch (error) {
                if (_closed) { throw _abort(); }
                if (timedOut) { throw { name: 'TimeoutError', message: 'Playback request timed out.' }; }
                if (error instanceof TypeError) { throw { name: 'NetworkError', message: 'Playback connection failed.' }; }
                throw error;
            } finally {
                controller.abort(); clearTimeout(timer); _controllers.delete(controller);
            }
        }

        function _read(value) {
            var result = JSON.parse(new TextDecoder().decode(value)), root = _endpoint.pathname.slice(0, _endpoint.pathname.lastIndexOf('/' + _this.streamId) + 37) + '/',
                media = new URL(result.url, _endpoint), management = new URL(result.sessionUrl, _endpoint);
            if (typeof result.credential !== 'string' || !CREDENTIAL.test(result.credential) ||
                result.credential.slice(0, 36) !== _this.instanceId ||
                media.origin !== _endpoint.origin || media.pathname !== _endpoint.pathname || media.hash || media.username || media.password ||
                management.origin !== _endpoint.origin || management.pathname !== root + 'sessions' || management.hash || management.username || management.password ||
                media.search !== '?playback=' + result.credential || management.search !== media.search ||
                !Number.isSafeInteger(result.expiresAt) || result.expiresAt * 1000 <= Date.now() || result.expiresAt * 1000 > Date.now() + 3605000) {
                throw { name: 'DataError', message: 'Invalid playback session response.' };
            }
            return { url: media.href, sessionUrl: management.href, credential: result.credential, expiresAt: result.expiresAt, root: root };
        }

        function _schedule() {
            clearTimeout(_renewTimer); clearTimeout(_expiryTimer);
            var remaining = _lease.expiresAt * 1000 - Date.now();
            _renewTimer = setTimeout(_renew, Math.max(1, Math.floor(remaining * 0.7)));
            _expiryTimer = setTimeout(function () { _fail({ name: 'TimeoutError', message: 'Playback session expired.' }); }, Math.max(1, remaining));
        }

        async function _renew() {
            if (_closed || !_lease) { return; }
            try {
                var next = _read(await _fetch(_lease.sessionUrl, { method: 'PATCH', headers: { Authorization: 'Playback ' + _lease.credential } }, 16384));
                if (next.credential !== _lease.credential || next.url !== _lease.url) {
                    throw { name: 'DataError', message: 'Playback renewal changed the session.' };
                }
                _lease = next; _schedule();
            } catch (error) {
                if (_closed) { return; }
                // Retry transient connectivity within the existing lease;
                // expiry and explicit denial remain authoritative.
                if (error.name !== 'NotAllowedError' && error.name !== 'DataError' && _lease.expiresAt * 1000 - Date.now() > 10000) {
                    _renewTimer = setTimeout(_renew, 5000);
                } else { _fail(error); }
            }
        }

        function _delete(lease) {
            var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, Math.min(config.timeout, 5000));
            fetch(lease.sessionUrl, { method: 'DELETE', mode: 'cors', credentials: 'omit', redirect: 'error', cache: 'no-store',
                headers: { Authorization: 'Playback ' + lease.credential }, signal: controller.signal })
                .catch(function () { /* Finite node TTL bounds a lost release. */ })
                .then(function () { clearTimeout(timer); });
        }

        function _fail(error) {
            if (_closed) { return; }
            _this.close();
            if (typeof unavailable === 'function') { unavailable(error); }
        }

        _this.open = async function (source) {
            if (_closed || _opening || _lease) { throw { name: 'InvalidStateError', message: 'Playback session already used.' }; }
            if (!config || typeof config.credentials !== 'function' || !Number.isSafeInteger(config.timeout) || config.timeout <= 0 ||
                !window.crypto || !window.crypto.randomUUID || ['HLS', 'HLS-2nd', 'DASH'].indexOf(source.protocol) === -1) {
                throw { name: 'NotSupportedError', message: 'Segmented live playback requires routing credentials and a secure browser.' };
            }
            _opening = true;
            _this.streamId = source.streamId;
            _this.instanceId = window.crypto.randomUUID();
            var controller = new AbortController();
            _controllers.add(controller);
            var context = { protocol: source.protocol, direction: 'play', streamId: source.streamId,
                instanceId: _this.instanceId, operationId: window.crypto.randomUUID(), createdAt: String(Date.now()),
                deadline: Date.now() + config.timeout, signal: controller.signal };
            try {
                var value = await MediaRequest.credentials(config.credentials, context), request = new MediaRequest(value, context);
                if (_closed) { throw _abort(); }
                _endpoint = new URL(request.url);
                var response;
                try { response = await _fetch(request.url, { method: 'POST', headers: request.headers('POST') }, 16384); }
                catch (error) {
                    if (!error.credentialExpired) { throw error; }
                    await request.renew(config.credentials);
                    response = await _fetch(request.url, { method: 'POST', headers: request.headers('POST') }, 16384);
                }
                var candidate = _read(response);
                if (_closed) { _delete(candidate); throw _abort(); }
                _lease = candidate; _this.url = candidate.url; _schedule();
                return _this;
            } catch (error) {
                _this.close(); throw error;
            } finally { _controllers.delete(controller); }
        };

        _this.read = function (path, maximum) {
            if (!_lease || _closed) { return Promise.reject(_abort()); }
            var url = new URL(path, _lease.url);
            if (url.origin !== _endpoint.origin || url.username || url.password || url.hash ||
                url.pathname.indexOf(_lease.root) !== 0 || url.search !== '?playback=' + _lease.credential) {
                return Promise.reject({ name: 'SecurityError', message: 'Playback segment is outside its assigned session.' });
            }
            return _fetch(url.href, { method: 'GET' }, maximum);
        };

        _this.close = function () {
            if (_closed) { return; }
            _closed = true;
            clearTimeout(_renewTimer); clearTimeout(_expiryTimer);
            _controllers.forEach(function (controller) { controller.abort(); }); _controllers.clear();
            if (_lease) { _delete(_lease); _lease = undefined; }
        };
    }

    odd.utils.PlaybackSession = PlaybackSession;
})(odd);

