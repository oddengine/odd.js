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
            (!publishing && value.ticket !== undefined)) {
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
            purpose = context.purpose;

        _this.url = endpoint.href;
        _this.resource = suffix ? '' : endpoint.href + '/' + instance;
        _this.streamId = value.streamId;
        _this.instanceId = instance;
        _this.connectBefore = value.connectBefore;

        _this.headers = function (method) {
            var headers = { 'Odd-Media-Boot': boot, 'Odd-Media-Proof': proof };
            if (method === 'POST' || method === 'GET') {
                headers.Authorization = 'Bearer ' + token;
                headers['Odd-Media-Instance'] = instance;
                headers['Odd-Media-Generation'] = generation;
                if (publishing) {
                    headers['Odd-Media-Placement'] = ticket;
                    headers['Odd-Media-Purpose'] = purpose;
                }
            }
            return headers;
        };
    }

    odd.utils.MediaRequest = MediaRequest;
})(odd);

