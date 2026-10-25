(function (odd) {
    var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        ZERO = '00000000-0000-0000-0000-000000000000';

    // One product live request. Routing echoes the caller's stream identity;
    // the browser owns an independent proof, not a per-stream user JWT.
    function MediaRequest(value, context) {
        var _this = this;

        if (!value || !context || value.product !== 'live' ||
            typeof value.token !== 'string' || !value.token || value.token.length > 8192 || /[^\x21-\x7e]/.test(value.token) ||
            !Number.isSafeInteger(value.connectBefore) || value.connectBefore <= Date.now() / 1000 ||
            typeof value.generation !== 'string' || !Number.isSafeInteger(Number(value.generation)) ||
            Number(value.generation) < 1 || String(Number(value.generation)) !== value.generation ||
            value.instanceId !== context.instanceId || value.appId === value.channelAppId ||
            typeof value.nodeId !== 'string' || !/^[A-Za-z0-9_.-]{1,128}$/.test(value.nodeId) ||
            value.streamId !== context.streamId) {
            throw { name: 'DataError', message: 'Invalid product live media credentials.' };
        }
        ['appId', 'channelAppId', 'bootId', 'streamId', 'instanceId'].forEach(function (key) {
            if (typeof value[key] !== 'string' || !UUID.test(value[key]) || value[key] === ZERO) {
                throw { name: 'DataError', message: 'Invalid live media identity: ' + key + '.' };
            }
        });

        var publishing = context.protocol === 'WHIP',
            suffix = context.protocol === 'HTTP-FLV' ? '.flv' : context.protocol === 'HTTP-CMAF' ? '.mp4' : '';
        if (['WHIP', 'WHEP', 'HTTP-FLV', 'HTTP-CMAF'].indexOf(context.protocol) === -1 ||
            context.direction !== (publishing ? 'publish' : 'play') ||
            (publishing && (typeof value.ticket !== 'string' || !value.ticket || value.ticket.length > 16384 ||
                /[^\x21-\x7e]/.test(value.ticket) || ['audio', 'camera', 'screen'].indexOf(context.purpose) === -1)) ||
            (publishing && (value.subscriptionTicket !== undefined || value.relayInstanceId !== undefined)) ||
            (!publishing && (value.ticket !== undefined || typeof value.subscriptionTicket !== 'string' ||
                !value.subscriptionTicket || value.subscriptionTicket.length > 8192 || /[^\x21-\x7e]/.test(value.subscriptionTicket) ||
                typeof value.relayInstanceId !== 'string' || (value.relayInstanceId !== '' &&
                    (!UUID.test(value.relayInstanceId) || value.relayInstanceId === ZERO))))) {
            throw { name: 'DataError', message: 'Live media routing does not match the requested operation.' };
        }
        if (typeof value.url !== 'string' || !value.url || value.url.length > 2048) {
            throw { name: 'DataError', message: 'Invalid live media endpoint.' };
        }
        var endpoint = new URL(value.url, document.baseURI),
            name = '/' + value.streamId + suffix;
        if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
            endpoint.pathname.indexOf('%') !== -1 || endpoint.pathname.slice(-name.length) !== name) {
            throw { name: 'SecurityError', message: 'Live media requires its assigned HTTPS resource.' };
        }
        if (!window.crypto || !window.crypto.getRandomValues) {
            throw { name: 'NotSupportedError', message: 'Live media requires secure randomness.' };
        }
        var bytes = new Uint8Array(32);
        window.crypto.getRandomValues(bytes);
        var proof = btoa(String.fromCharCode.apply(null, bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''),
            token = value.token,
            boot = value.bootId,
            instance = value.instanceId,
            generation = value.generation,
            ticket = value.ticket,
            subscriptionTicket = value.subscriptionTicket,
            purpose = context.purpose,
            binding = Object.assign({}, value),
            renewed = false;

        _this.url = endpoint.href;
        _this.resource = suffix ? '' : endpoint.href + '/' + instance;
        _this.streamId = value.streamId;
        _this.instanceId = instance;
        _this.connectBefore = value.connectBefore;

        _this.renew = async function (provider) {
            if (renewed) {
                throw { name: 'NotAllowedError', message: 'Credential renewal has already been attempted.' };
            }
            renewed = true;
            var fresh = await MediaRequest.credentials(provider, Object.assign({}, context, {
                reason: 'credential_expired', forceRefresh: true,
            }));
            // A refresh may return only the customer's new credential. The
            // original allocation is still owned by this request; do not ask
            // the scheduler to consume capacity again during key rotation.
            if (fresh && typeof fresh === 'object' && !Array.isArray(fresh)) {
                fresh = Object.assign({}, binding, fresh);
            }
            if (!fresh || typeof fresh.token !== 'string' || !fresh.token || fresh.token.length > 8192 ||
                /[^\x21-\x7e]/.test(fresh.token) || !Number.isSafeInteger(fresh.connectBefore) ||
                fresh.connectBefore <= Date.now() / 1000 ||
                ['product', 'appId', 'channelAppId', 'userId', 'nodeId', 'bootId', 'streamId', 'instanceId', 'generation', 'url', 'ticket', 'subscriptionTicket', 'relayInstanceId']
                    .some(function (key) { return fresh[key] !== binding[key]; })) {
                throw { name: 'InvalidModificationError', message: 'Credential renewal changed the assigned media resource.' };
            }
            token = fresh.token;
            _this.connectBefore = fresh.connectBefore;
        };

        _this.headers = function (method) {
            var headers = { 'Odd-Media-Boot': boot, 'Odd-Media-Proof': proof };
            if (method === 'POST' || method === 'GET') {
                headers.Authorization = 'Bearer ' + token;
                headers['Odd-Media-Instance'] = instance;
                headers['Odd-Media-Generation'] = generation;
                if (publishing) {
                    headers['Odd-Media-Placement'] = ticket;
                    headers['Odd-Media-Purpose'] = purpose;
                } else {
                    headers['Odd-Media-Subscription'] = subscriptionTicket;
                }
            }
            return headers;
        };
    }

    // A bounded provider call. Provider cancellation and the original operation
    // deadline remain effective even when the customer's Promise ignores abort.
    MediaRequest.credentials = function (provider, context) {
        return new Promise(function (resolve, reject) {
            var controller = new AbortController(), done = false,
                signal = context.signal,
                remaining = context.deadline - Date.now(),
                timer;
            function finish(error, value) {
                if (done) { return; }
                done = true;
                clearTimeout(timer);
                if (signal) { signal.removeEventListener('abort', cancel); }
                if (error) { controller.abort(); reject(error); } else { resolve(value); }
            }
            function cancel() { finish({ name: 'AbortError', message: 'Credential acquisition was cancelled.' }); }
            if (!Number.isFinite(remaining) || remaining <= 0) {
                finish({ name: 'TimeoutError', message: 'Credential acquisition timed out.' });
                return;
            }
            if (signal) {
                signal.addEventListener('abort', cancel, { once: true });
                if (signal.aborted) { cancel(); return; }
            }
            timer = setTimeout(function () {
                finish({ name: 'TimeoutError', message: 'Credential acquisition timed out.' });
            }, Math.min(remaining, 2147483647));
            Promise.resolve().then(function () {
                if (done) { return; }
                return provider(Object.assign({}, context, { signal: controller.signal }));
            }).then(function (value) { finish(null, value); }, finish);
        });
    };

    MediaRequest.expired = function (response) {
        return response.status === 401 &&
            response.headers.get('WWW-Authenticate') === 'Bearer error="invalid_token"';
    };

    odd.utils.MediaRequest = MediaRequest;
})(odd);

