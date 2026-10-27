// Dedicated recording scope. This worker neither caches nor intercepts app pages.
var RECORDING_PROTOCOL = 1;
var recordings = new Map();

self.addEventListener('install', function (e) { e.waitUntil(self.skipWaiting()); });
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

self.addEventListener('message', function (e) {
    var data = e.data || {}, port = e.ports && e.ports[0];
    if (!port) { return; }
    function reject(name, message) {
        port.postMessage({ event: 'error', protocol: RECORDING_PROTOCOL, id: data.id, error: { name: name, message: message } });
        port.close();
        if (data.stream && typeof data.stream.cancel === 'function') { data.stream.cancel().catch(function () {}); }
    }
    if (data.operation !== 'recordstart' || data.protocol !== RECORDING_PROTOCOL) {
        reject('VersionError', 'The recording worker protocol does not match this page.');
        return;
    }
    if (!e.source || !e.source.id || !/^[a-f0-9]{32}$/.test(data.id) ||
        typeof data.filename !== 'string' || !data.filename.trim() || data.filename.length > 255 ||
        /[\x00-\x1f\x7f]/.test(data.filename) || !(data.stream instanceof ReadableStream) ||
        !Number.isSafeInteger(data.timeout) || data.timeout <= 0 || data.timeout > 2147483647) {
        reject('DataError', 'Invalid recording request.');
        return;
    }
    var url = new URL('record/' + data.id, self.registration.scope).href;
    if (recordings.has(url)) { reject('InvalidStateError', 'The recording operation already exists.'); return; }
    var item = { id: data.id, client: e.source.id, filename: data.filename, stream: data.stream, port: port, consumed: false };
    recordings.set(url, item);

    function release(cancel) {
        clearTimeout(item.timer);
        if (recordings.get(url) === item) { recordings.delete(url); }
        port.onmessage = port.onmessageerror = null;
        port.close();
        if (cancel && !item.consumed) { item.stream.cancel().catch(function () {}); }
    }
    item.release = release;
    item.timer = setTimeout(function () {
        port.postMessage({ event: 'error', protocol: RECORDING_PROTOCOL, id: item.id,
            error: { name: 'TimeoutError', message: 'The browser did not start the recording download.' } });
        release(true);
    }, data.timeout);
    port.onmessage = function (evt) {
        var message = evt.data || {};
        if (message.protocol === RECORDING_PROTOCOL && message.operation === 'recordend' && message.id === item.id) { release(true); }
    };
    port.onmessageerror = function () { release(true); };
    port.postMessage({ event: 'recordstart', protocol: RECORDING_PROTOCOL, id: item.id });
});

self.addEventListener('fetch', function (e) {
    var item = recordings.get(e.request.url);
    if (!item || e.request.method !== 'GET') { return; }
    // The iframe has its own client ID. Its unguessable operation URL selects the stream.
    item.consumed = true;
    clearTimeout(item.timer);
    recordings.delete(e.request.url);
    var filename = encodeURIComponent(item.filename).replace(/['()*]/g, function (c) { return '%' + c.charCodeAt(0).toString(16); });
    e.respondWith(new Response(item.stream, { headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': "attachment; filename*=UTF-8''" + filename,
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'",
        'X-Content-Type-Options': 'nosniff',
    } }));
    item.port.postMessage({ event: 'loadstart', protocol: RECORDING_PROTOCOL, id: item.id });
    // The transferred stream now carries cancellation/EOF; no live worker map is needed.
    item.release(false);
});
