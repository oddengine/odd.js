// Account HTTP belongs to the host application, not to the media or IM SDK.
(function (window) {
    function AccountClient(base) {
        var _base = new URL(base.replace(/\/$/, '') + '/', document.baseURI),
            _proof,
            _context,
            _pending,
            _revision = 0;

        function _endpoint(path) {
            var endpoint = new URL(_base.href.replace(/\/$/, '') + path);
            if (endpoint.origin !== location.origin || endpoint.username || endpoint.password) {
                throw new Error('The account API must use the demo origin. Configure odd-api and the deployment route.');
            }
            return endpoint.href;
        }

        function _accept(proof, account) {
            if (!proof || (proof.enabled !== false && (proof.enabled !== true ||
                typeof proof.token !== 'string' || !/^\d{13}\.[A-Za-z0-9_-]{43}$/.test(proof.token) ||
                typeof proof.context !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(proof.context) ||
                !Number.isFinite(Number(proof.expiresAt)) || Number(proof.expiresAt) <= Date.now()))) {
                throw new Error('The account API returned an invalid browser request token.');
            }
            _proof = proof;
            if (account || _context === undefined) { _context = proof.context; }
            _revision++;
            return proof;
        }

        async function _load() {
            if (_proof && (!_proof.enabled || Number(_proof.expiresAt) > Date.now() + 5000)) {
                return _proof;
            }
            if (_pending) {
                return _pending;
            }
            var revision = _revision,
                controller = new AbortController(),
                timer = setTimeout(function () { controller.abort(); }, 30000);
            _pending = (async function () {
                try {
                    var response = await fetch(_endpoint('/session/csrf'), {
                        credentials: 'same-origin', redirect: 'error', cache: 'no-store', signal: controller.signal,
                    });
                    // Only an older server's missing route permits this compatibility path.
                    var proof = response.status === 404 ? { enabled: false } : await response.json();
                    if (!response.ok && response.status !== 404) {
                        throw _error(response, proof);
                    }
                    return revision === _revision ? _accept(proof) : _proof;
                } finally {
                    clearTimeout(timer);
                    _pending = null;
                }
            })();
            return _pending;
        }

        function _error(response, result) {
            var error = new Error(result && result.message || 'Account API returned HTTP ' + response.status);
            error.status = response.status;
            error.code = result && result.code;
            return error;
        }

        // A cancelled caller must not submit after a shared proof request completes.
        // The shared fetch has its own finite lifetime; cancelling one caller does not cancel others.
        function _wait(promise, signal) {
            if (!signal) {
                return promise;
            }
            return new Promise(function (resolve, reject) {
                function cancel() { reject(new DOMException('Cancelled', 'AbortError')); }
                signal.addEventListener('abort', cancel, { once: true });
                if (signal.aborted) { cancel(); }
                promise.then(resolve, reject).finally(function () { signal.removeEventListener('abort', cancel); });
            });
        }

        this.request = async function (path, method, body, signal) {
            var endpoint = _endpoint(path);
            method = method || 'GET';
            var mutation = method !== 'GET' && method !== 'HEAD',
                context = _context;
            for (var attempt = 0; attempt < 2; attempt++) {
                if (signal && signal.aborted) { throw new DOMException('Cancelled', 'AbortError'); }
                var proof = mutation ? await _wait(_load(), signal) : null,
                    headers = mutation && method !== 'DELETE' || body !== undefined ? { 'Content-Type': 'application/json' } : {};
                if (mutation && context && (!proof || proof.context !== context)) {
                    var changed = new Error('Your browser session changed. Reload account information before retrying.');
                    changed.status = 409;
                    changed.code = 'session_changed';
                    throw changed;
                }
                context = proof && proof.context;
                if (proof && proof.enabled) { headers['X-CSRF-Token'] = proof.token; }
                if (signal && signal.aborted) { throw new DOMException('Cancelled', 'AbortError'); }
                var response = await fetch(endpoint, {
                    method: method, credentials: 'same-origin', redirect: 'error', cache: 'no-store',
                    headers: headers, body: body === undefined ? undefined : JSON.stringify(body), signal: signal,
                });
                var result = response.status === 204 ? null : await response.json();
                if (signal && signal.aborted) { throw new DOMException('Cancelled', 'AbortError'); }
                if (!response.ok) {
                    // This error is emitted before the business handler runs. Never replay timeouts or other failures.
                    if (mutation && attempt === 0 && response.status === 403 && result && result.code === 'csrf_required') {
                        if (_proof === proof) { _proof = undefined; _revision++; }
                        continue;
                    }
                    throw _error(response, result);
                }
                if (path === '/session' && (method === 'GET' || method === 'POST') && result && result.csrf !== undefined) {
                    _accept(result.csrf, true);
                } else if ((path === '/session' && method === 'DELETE') ||
                    (path === '/users/me/password' && method === 'PUT') || (path === '/password/reset' && method === 'POST')) {
                    _proof = undefined;
                    _context = undefined;
                    _revision++;
                }
                return result;
            }
        };
    }

    window.AccountClient = AccountClient;
})(window);


