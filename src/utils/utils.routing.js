(function (odd) {
    var utils = odd.utils,
        ID = /^[A-Za-z0-9_.-]{1,128}$/,
        MAX_TTL = 3600000,
        MAX_BYTES = 8192;

    // Share one Routing between IM/RTC/Player. Only public regional hints are
    // persisted. Actual allocation IDs, credentials and connections stay with
    // their existing owners and are never renewed by this cache.
    function Routing(config, logger) {
        var _this = this,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger('Routing', logger),
            _entry = null,
            _pending = null,
            _generation = 0,
            _closed = false,
            _storage = null,
            _monotonicUntil = 0;

        if (!config || typeof config !== 'object' || Array.isArray(config)) {
            throw { name: 'TypeError', message: 'Routing requires a configuration object.' };
        }
        config = utils.extendz({ timeout: 10000, storage: true }, config);
        if (typeof config.deployment !== 'string' || !ID.test(config.deployment) || typeof config.storage !== 'boolean' ||
            !Number.isSafeInteger(config.timeout) || config.timeout < 1 || config.timeout > 60000 ||
            !Array.isArray(config.origins) || !config.origins.length || config.origins.length > 32 ||
            typeof fetch !== 'function' || typeof AbortController !== 'function' || typeof TextDecoder !== 'function') {
            throw { name: 'TypeError', message: 'Routing requires a deployment, discovery URL and trusted regional origins.' };
        }
        var origins = config.origins.map(function (value) {
            var address = _url(value);
            if (address.pathname !== '/') {
                throw { name: 'TypeError', message: 'Regional origins must not contain a path.' };
            }
            return address.origin;
        });
        var discovery = _url(config.url).href,
            deployment = config.deployment,
            timeout = config.timeout,
            key = 'odd.routing.v1:' + deployment + ':' + discovery,
            connection = typeof navigator !== 'undefined' ? navigator.connection : null;

        function _url(value) {
            if (typeof value !== 'string' || !value || value.length > 2048 || /[\s\\?#]/.test(value)) {
                throw { name: 'TypeError', message: 'Invalid routing URL.' };
            }
            var result = new URL(value);
            if (result.protocol !== 'https:' || result.username || result.password || result.search || result.hash ||
                result.pathname.indexOf('%') !== -1) {
                throw { name: 'SecurityError', message: 'Routing requires a canonical HTTPS URL without credentials.' };
            }
            return result;
        }

        function _valid(value, now, stored) {
            if (!value || value.version !== 1 || value.deployment !== deployment ||
                typeof value.region !== 'string' || !ID.test(value.region) ||
                typeof value.revision !== 'string' || !ID.test(value.revision) ||
                !Number.isSafeInteger(value.maxAge) || value.maxAge < 60000 || value.maxAge > MAX_TTL ||
                stored && (!Number.isSafeInteger(value.cachedAt) || !Number.isSafeInteger(value.expiresAt) ||
                    value.cachedAt > now || value.expiresAt <= now || value.expiresAt - value.cachedAt !== value.maxAge)) {
                throw { name: 'DataError', message: 'Invalid or expired regional routing entry.' };
            }
            var endpoint = _url(value.endpoint);
            if (origins.indexOf(endpoint.origin) === -1 || endpoint.pathname.slice(-1) !== '/') {
                throw { name: 'SecurityError', message: 'Regional endpoint is outside the configured deployment.' };
            }
            // Copy only the public schema, excluding unexpected credentials.
            // These are local cache deadlines, not authorization dates. A
            // public hint does not require client/server wall-clock agreement.
            return Object.freeze({ version: 1, deployment: deployment, region: value.region,
                revision: value.revision, endpoint: endpoint.href, maxAge: value.maxAge,
                cachedAt: stored ? value.cachedAt : now, expiresAt: stored ? value.expiresAt : now + value.maxAge });
        }

        function _clock() {
            return typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
        }

        function _persist(value) {
            if (!_storage) { return; }
            try {
                if (value) { _storage.setItem(key, JSON.stringify(value)); }
                else { _storage.removeItem(key); }
            } catch (error) {
                _storage = null;
                _logger.warn('Routing persistence is unavailable; using memory only.');
            }
        }

        if (config.storage) {
            try {
                _storage = typeof localStorage !== 'undefined' ? localStorage : null;
                var saved = _storage && _storage.getItem(key);
                if (saved && saved.length <= MAX_BYTES) {
                    _entry = _valid(JSON.parse(saved), Date.now(), true);
                    _monotonicUntil = _clock() + _entry.expiresAt - Date.now();
                } else if (saved) {
                    _persist(null);
                }
            } catch (error) {
                // Corrupt/expired hints are disposable. Storage failures must
                // not stop a client from discovering its regional service.
                _entry = null;
                _persist(null);
            }
        }

        async function _discover(operation) {
            var timer = setTimeout(function () { operation.controller.abort(); }, timeout);
            try {
                var response = await fetch(discovery, { method: 'GET', mode: 'cors', credentials: 'omit',
                    cache: 'no-store', redirect: 'error', signal: operation.controller.signal });
                if (!response.ok || response.redirected || response.url !== discovery) {
                    throw { name: 'NetworkError', message: 'Regional discovery is unavailable.', status: response.status };
                }
                if (!response.body || !response.body.getReader ||
                    (response.headers.get('Content-Type') || '').split(';')[0].trim() !== 'application/json') {
                    throw { name: 'DataError', message: 'Invalid regional discovery response.' };
                }
                var reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true }),
                    bytes = 0, text = '';
                try {
                    while (true) {
                        var chunk = await reader.read();
                        if (chunk.done) { break; }
                        bytes += chunk.value.byteLength;
                        if (bytes > MAX_BYTES) {
                            throw { name: 'QuotaExceededError', message: 'Regional discovery response exceeds its budget.' };
                        }
                        text += decoder.decode(chunk.value, { stream: true });
                    }
                    text += decoder.decode();
                } finally {
                    await reader.cancel().catch(function () {});
                    reader.releaseLock();
                }
                var value = _valid(JSON.parse(text), Date.now());
                if (_closed || operation.generation !== _generation || operation.controller.signal.aborted) {
                    throw { name: 'AbortError', message: 'Regional discovery was superseded.' };
                }
                _entry = value;
                _monotonicUntil = _clock() + value.expiresAt - Date.now();
                _persist(value);
                return value;
            } finally {
                clearTimeout(timer);
                if (_pending === operation) { _pending = null; }
            }
        }

        _this.resolve = function (context) {
            context = context || {};
            if (_closed) {
                return Promise.reject({ name: 'InvalidStateError', message: 'Routing has been destroyed.' });
            }
            if (context.signal && context.signal.aborted) {
                return Promise.reject({ name: 'AbortError', message: 'Regional discovery was cancelled.' });
            }
            var now = Date.now(), deadline = context.deadline === undefined ? now + timeout : context.deadline;
            if (!Number.isSafeInteger(deadline) || deadline <= now) {
                return Promise.reject({ name: 'TimeoutError', message: 'Regional discovery timed out.' });
            }
            if (_entry && now >= _entry.cachedAt && now < _entry.expiresAt && _clock() < _monotonicUntil) {
                return Promise.resolve(_entry);
            }
            _entry = null;
            if (!_pending) {
                var operation = { controller: new AbortController(), generation: _generation };
                _pending = operation;
                operation.promise = _discover(operation);
                // Every waiter may cancel before invoking its provider. Keep
                // the shared fetch observed until its own timeout/cleanup.
                operation.promise.catch(function () {});
            }
            var promise = operation ? operation.promise : _pending.promise;
            // One caller's cancellation must not abort the discovery shared by
            // other products. The shared fetch has its own bounded lifetime.
            return utils.MediaRequest.credentials(function () { return promise; }, {
                deadline: deadline, signal: context.signal,
            });
        };

        _this.bind = function (provider) {
            if (typeof provider !== 'function') {
                throw { name: 'TypeError', message: 'Routing requires a provider callback.' };
            }
            return async function (context) {
                context = context || {};
                var entry = await _this.resolve(context);
                if (_closed || entry !== _entry || context.signal && context.signal.aborted ||
                    context.deadline !== undefined && context.deadline <= Date.now()) {
                    throw { name: 'AbortError', message: 'Routed operation was cancelled.' };
                }
                try {
                    return await provider(Object.assign({}, context, { routing: entry }));
                } catch (error) {
                    // The caller owns mutation replay and its original IDs.
                    // Invalidation never silently retries a provider or auth.
                    if (error && error.routingUnavailable === true) { _this.invalidate(entry); }
                    throw error;
                }
            };
        };

        _this.invalidate = function (expected) {
            if (_closed || expected && expected !== _entry) { return; }
            _generation++;
            _entry = null;
            _monotonicUntil = 0;
            if (_pending) { _pending.controller.abort(); _pending = null; }
            _persist(null);
        };

        function _networkChanged() { _this.invalidate(); }
        if (connection && connection.addEventListener) { connection.addEventListener('change', _networkChanged); }

        _this.destroy = function () {
            if (_closed) { return; }
            _this.invalidate();
            _closed = true;
            if (connection && connection.removeEventListener) { connection.removeEventListener('change', _networkChanged); }
        };
    }

    utils.Routing = Routing;
})(odd);

