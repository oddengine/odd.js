(function (odd) {
    var utils = odd.utils,
        ID = /^[A-Za-z0-9_.-]{1,128}$/,
        UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        ZERO = '00000000-0000-0000-0000-000000000000',
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
            _allocations = new Set(),
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

        async function _readJSON(response, maximum) {
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
                    if (bytes > maximum) {
                        throw { name: 'QuotaExceededError', message: 'Regional discovery response exceeds its budget.' };
                    }
                    text += decoder.decode(chunk.value, { stream: true });
                }
                text += decoder.decode();
            } finally {
                await reader.cancel().catch(function () {});
                reader.releaseLock();
            }
            return JSON.parse(text);
        }

        async function _discover(operation) {
            var timer = setTimeout(function () { operation.controller.abort(); }, timeout);
            try {
                var response = await fetch(discovery, { method: 'GET', mode: 'cors', credentials: 'omit',
                    cache: 'no-store', redirect: 'error', signal: operation.controller.signal });
                if (!response.ok || response.redirected || response.url !== discovery) {
                    throw { name: 'NetworkError', message: 'Regional discovery is unavailable.', status: response.status };
                }
                var value = _valid(await _readJSON(response, MAX_BYTES), Date.now());
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

        _this.media = async function (context, credentials) {
            context = context || {};
            credentials = credentials || context;
            if (_closed || _allocations.size >= 4096 || !credentials ||
                typeof credentials.token !== 'string' || !credentials.token || credentials.token.length > 8192 ||
                /[^\x21-\x7e]/.test(credentials.token) || !Number.isSafeInteger(credentials.connectBefore) ||
                credentials.connectBefore * 1000 <= Date.now()) {
                throw { name: 'InvalidStateError', message: 'Media allocation requires a current customer credential.' };
            }
            [context.operationId, context.instanceId, context.streamId, credentials.appId, credentials.channelAppId]
                .forEach(function (id) {
                    if (typeof id !== 'string' || !UUID.test(id) || id === ZERO) {
                        throw { name: 'TypeError', message: 'Media allocation requires explicit operation and App identities.' };
                    }
                });
            var publishing = context.direction === 'publish';
            if (credentials.appId === credentials.channelAppId ||
                typeof credentials.userId !== 'string' || credentials.userId !== '' && !ID.test(credentials.userId) ||
                typeof context.createdAt !== 'string' || !Number.isSafeInteger(Number(context.createdAt)) ||
                Number(context.createdAt) < 1000 || String(Number(context.createdAt)) !== context.createdAt ||
                (credentials.product !== 'live' && credentials.product !== 'rtc') ||
                (context.direction !== 'publish' && context.direction !== 'play') ||
                (publishing ? ['WHIP', 'RTMP', 'RTSP'] : ['WHEP', 'HTTP-FLV', 'HTTP-CMAF', 'RTMP', 'RTSP']).indexOf(context.protocol) === -1 ||
                publishing && ['audio', 'camera', 'screen'].indexOf(context.purpose) === -1 ||
                credentials.product === 'rtc' && (typeof context.nodeId !== 'string' || !ID.test(context.nodeId) ||
                    typeof context.bootId !== 'string' || !UUID.test(context.bootId) || context.bootId === ZERO ||
                    context.protocol !== (publishing ? 'WHIP' : 'WHEP'))) {
                throw { name: 'TypeError', message: 'Invalid media allocation request.' };
            }
            var deadline = context.deadline === undefined ? Date.now() + timeout : context.deadline;
            var entry = await _this.resolve({ deadline: deadline, signal: context.signal });
            if (_closed || _allocations.size >= 4096 || context.signal && context.signal.aborted || Date.now() >= deadline) {
                throw { name: 'AbortError', message: 'Media allocation was cancelled.' };
            }
            var endpoint = new URL('media', entry.endpoint).href,
                controller = new AbortController(),
                cancel = function () { controller.abort(); },
                timer = setTimeout(cancel, Math.max(1, Math.min(timeout, deadline - Date.now())));
            _allocations.add(controller);
            if (context.signal) { context.signal.addEventListener('abort', cancel, { once: true }); }
            try {
                var input = {
                    operationId: context.operationId, createdAt: context.createdAt, instanceId: context.instanceId,
                    streamId: context.streamId, direction: context.direction, protocol: context.protocol,
                    appId: credentials.appId, channelAppId: credentials.channelAppId,
                    product: credentials.product, userId: credentials.userId,
                    purpose: context.direction === 'publish' ? context.purpose : undefined,
                    nodeId: credentials.product === 'rtc' ? context.nodeId : undefined,
                    bootId: credentials.product === 'rtc' ? context.bootId : undefined,
                };
                var response = await fetch(endpoint, { method: 'POST', mode: 'cors', credentials: 'omit', cache: 'no-store',
                    redirect: 'error', signal: controller.signal,
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + credentials.token },
                    body: JSON.stringify(input) });
                if (response.redirected || response.url !== endpoint) {
                    throw { name: 'SecurityError', message: 'Media allocation changed its regional endpoint.' };
                }
                if (!response.ok) {
                    throw { name: response.status === 404 ? 'NotFoundError' : 'OperationError',
                        message: 'Media allocation was rejected.', status: response.status,
                        credentialExpired: utils.MediaRequest.expired(response) };
                }
                var value = await _readJSON(response, 16384);
                if (_closed || controller.signal.aborted || Date.now() >= deadline) {
                    throw { name: 'AbortError', message: 'Media allocation completed too late.' };
                }
                ['appId', 'channelAppId', 'product', 'userId', 'streamId', 'instanceId'].forEach(function (key) {
                    if (value[key] !== input[key]) {
                        throw { name: 'DataError', message: 'Media allocation changed the requested identity.' };
                    }
                });
                // Only returned to this operation. No token or ticket enters
                // localStorage, the public entry cache, or a shared cookie.
                return Object.assign({}, value, { token: credentials.token, connectBefore: credentials.connectBefore });
            } finally {
                clearTimeout(timer);
                if (context.signal) { context.signal.removeEventListener('abort', cancel); }
                controller.abort();
                _allocations.delete(controller);
            }
        };

        // Product live adapters can use this directly as their credentials
        // provider. The customer's backend returns a user JWT; this SDK owns
        // the separate platform allocation. Renewals keep the assigned route.
        _this.credentials = function (provider) {
            if (typeof provider !== 'function') {
                throw { name: 'TypeError', message: 'Customer credentials require a provider callback.' };
            }
            return async function (context) {
                var credentials = await provider(context);
                if (context.forceRefresh && context.reason === 'credential_expired') { return credentials; }
                return _this.media(context, credentials);
            };
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
            _allocations.forEach(function (controller) { controller.abort(); });
            _allocations.clear();
            if (connection && connection.removeEventListener) { connection.removeEventListener('change', _networkChanged); }
        };
    }

    utils.Routing = Routing;
})(odd);

