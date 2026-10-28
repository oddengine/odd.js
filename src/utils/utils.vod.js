(function (odd) {
    var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
        DIGEST = /^[0-9a-f]{64}$/,
        fields = ['appId', 'assetId', 'version', 'uploadId', 'group', 'diskId', 'size', 'partSize', 'uploadUntil'];

    function failure(code, retryable) {
        var error = new Error(code);
        error.name = 'VODError'; error.code = code; error.retryable = !!retryable;
        return error;
    }
    function integer(value, minimum, maximum) {
        var n = Number(value);
        return typeof value === 'string' && String(n) === value && Number.isSafeInteger(n) && n >= minimum && n <= maximum;
    }
    function identity(value) {
        if (!value || ['appId', 'assetId', 'version', 'uploadId', 'diskId'].some(function (key) {
            return !UUID.test(value[key] || '') || value[key] === '00000000-0000-0000-0000-000000000000';
        }) || !/^[a-z0-9_-]{1,64}$/.test(value.group || '') || !integer(value.size, 1, 10 * 1073741824) ||
            !integer(value.partSize, 131072, 67108864) || !integer(value.uploadUntil, 1, Number.MAX_SAFE_INTEGER)) {
            throw failure('invalid_identity');
        }
        var result = {};
        fields.forEach(function (key) { result[key] = value[key]; });
        return Object.freeze(result);
    }
    function same(a, b) { return b && fields.every(function (key) { return a[key] === b[key]; }); }
    function endpoint(value) {
        if (!value || !/^[A-Za-z0-9_.-]{1,128}$/.test(value.nodeId || '') || typeof value.url !== 'string' || value.url.length > 2048) {
            throw failure('invalid_route');
        }
        var url = new URL(value.url);
        if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || /[%\\\s]/.test(url.pathname) ||
            url.href !== value.url || url.pathname.endsWith('/')) { throw failure('invalid_route'); }
        return Object.freeze({ nodeId: value.nodeId, url: url.href });
    }
    function check(signal) { if (signal.aborted) { throw new DOMException('Transfer paused.', 'AbortError'); } }
    async function digest(blob, signal) {
        var data = await blob.arrayBuffer();
        check(signal);
        var bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', data));
        check(signal);
        return Array.from(bytes, function (n) { return n.toString(16).padStart(2, '0'); }).join('');
    }
    async function json(response) {
        if (!response.body) { throw failure('invalid_response'); }
        var reader = response.body.getReader(), parts = [], length = 0;
        try {
            while (true) {
                var next = await reader.read();
                if (next.done) { break; }
                length += next.value.byteLength;
                if (length > 65536) { throw failure('invalid_response'); }
                parts.push(next.value);
            }
        } finally { await reader.cancel().catch(function () {}); reader.releaseLock(); }
        var bytes = new Uint8Array(length), offset = 0;
        parts.forEach(function (part) { bytes.set(part, offset); offset += part.byteLength; });
        try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
        catch (_) { throw failure('invalid_response'); }
    }

    // The host owns account APIs and credential signing. This helper owns only
    // bounded transfer state; it never persists tokens or entire files.
    function Transfer(config, operation) {
        if (!config || typeof config.credentials !== 'function' || typeof fetch !== 'function' || typeof crypto === 'undefined' || !crypto.subtle) {
            throw failure('unsupported_transfer');
        }
        this.identity = identity(config.identity);
        this.provider = config.credentials;
        this.recordingRoot = config.recordingRoot || '';
        if (this.recordingRoot && (operation !== 'read' || !/^[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/.test(this.recordingRoot) ||
            this.recordingRoot.split('/').some(function (part) { return part === '.' || part === '..'; }))) { throw failure('invalid_identity'); }
        this.progress = typeof config.onprogress === 'function' ? config.onprogress : function () {};
        this.operation = operation;
        this.current = null; this.pending = null; this.selected = null; this.tried = new Set();
        this.controller = null;
    }
    Transfer.prototype.pause = function () { this.controller?.abort(); };
    Transfer.prototype.backoff = function (signal, attempt) {
        check(signal);
        return new Promise(function (resolve, reject) {
            var timer, cancel = function () { clearTimeout(timer); signal.removeEventListener('abort', cancel); reject(new DOMException('Transfer paused.', 'AbortError')); };
            signal.addEventListener('abort', cancel, { once: true });
            timer = setTimeout(function () { signal.removeEventListener('abort', cancel); resolve(); }, Math.min(8000, attempt * 2000));
        });
    };
    Transfer.prototype.prepare = async function (signal, force, reason) {
        check(signal);
        if (!force && this.current && Number(this.current.expiresAt) > Date.now() / 1000 + 5) { return; }
        if (!this.pending) {
            var self = this;
            this.pending = Promise.resolve().then(function () {
                return self.provider({ identity: self.identity, operation: self.operation, signal: signal,
                    reason: reason || 'credential_expired', exclude: Array.from(self.tried) });
            }).then(function (value) {
                check(signal);
                var route = value?.route;
                if (!same(self.identity, value?.identity) || (value.recordingRoot || '') !== self.recordingRoot || typeof value.token !== 'string' || value.token.length > 8192 ||
                    !/^[A-Za-z0-9_.-]+$/.test(value.token) || !integer(value.expiresAt, Math.floor(Date.now() / 1000) + 1, Number.MAX_SAFE_INTEGER) ||
                    !route || route.group !== self.identity.group || route.diskId !== self.identity.diskId ||
                    !integer(route.expiresAt, Date.now() + 1, Number.MAX_SAFE_INTEGER) ||
                    !Array.isArray(route.candidates) || !route.candidates.length || route.candidates.length > 32) { throw failure('invalid_credential'); }
                var candidates = route.candidates.map(endpoint), selected = endpoint(route.endpoint);
                if (!candidates.some(function (v) { return v.nodeId === selected.nodeId && v.url === selected.url; }) ||
                    new Set(candidates.map(function (v) { return v.nodeId; })).size !== candidates.length) { throw failure('invalid_route'); }
                self.current = { token: value.token, expiresAt: value.expiresAt, routeUntil: Number(route.expiresAt), candidates: candidates };
                self.selected = selected;
            }).finally(function () { self.pending = null; });
        }
        await this.pending;
        check(signal);
    };
    Transfer.prototype.recover = async function (signal, error) {
        check(signal);
        if (!error.retryable) { throw error; }
        if (error.code === 'credential_expired' || error.code === 'credential_invalid') {
            await this.prepare(signal, true, error.code); return;
        }
        if (this.selected) { this.tried.add(this.selected.nodeId); }
        var next = this.current?.routeUntil > Date.now() && this.current.candidates.find(function (v) { return !this.tried.has(v.nodeId); }, this);
        if (next) { this.selected = next; return; }
        // An exhausted two-node set may have recovered. Refresh its health once;
        // the caller's bounded retry count still prevents endless cycling.
        this.tried.clear();
        await this.prepare(signal, true, 'node_unavailable');
    };
    Transfer.prototype.request = async function (path, method, body, headers, signal, consume) {
        check(signal);
        var abort = new AbortController(), cancel = function () { abort.abort(); }, timed = false;
        signal.addEventListener('abort', cancel, { once: true });
        var timer = setTimeout(function () { timed = true; abort.abort(); }, 600000);
        try {
            var response;
            try {
                var target = this.recordingRoot ? '/recordings/' + this.identity.assetId + '/content/' + this.recordingRoot : '/' + this.identity.version + '/' + path;
                if (this.recordingRoot && (method !== 'GET' || path !== 'content')) { throw failure('invalid_operation'); }
                response = await fetch(this.selected.url + target, {
                    method: method, body: body, headers: Object.assign({ Authorization: 'Bearer ' + this.current.token }, headers),
                    signal: abort.signal, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer',
                });
            } catch (error) { check(signal); throw failure('transfer_unavailable', true); }
            if (!response.ok) {
                var value = await json(response);
                throw failure(value.error || 'transfer_unavailable', [401, 429, 503, 507].includes(response.status));
            }
            return await consume(response, abort.signal);
        } catch (error) {
            check(signal);
            if (timed || error.name === 'TypeError') { throw failure('transfer_unavailable', true); }
            throw error;
        } finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); }
    };

    Transfer.prototype.url = function () {
        if (!this.selected || !this.current || this.operation !== 'read') { throw failure('invalid_credential'); }
        return this.recordingRoot ? this.selected.url + '/recordings/' + this.identity.assetId + '/read/' + this.current.token + '/' + this.recordingRoot :
            this.selected.url + '/' + this.identity.version + '/content?credential=' + this.current.token;
    };

    function Upload(config) { Transfer.call(this, config, 'upload'); }
    Upload.prototype = Object.create(Transfer.prototype);
    Upload.prototype.constructor = Upload;
    Upload.prototype.parts = async function (signal) {
        var cursor = 0, found = new Map(), total = Math.ceil(Number(this.identity.size) / Number(this.identity.partSize)), status;
        do {
            var page = await this.request('progress/' + cursor, 'GET', undefined, {}, signal, json);
            if (!same(this.identity, page) || !Array.isArray(page.parts) || page.parts.length > 100 ||
                !integer(page.nextCursor, 0, total) || Number(page.nextCursor) && Number(page.nextCursor) <= cursor ||
                !['pending', 'allocating', 'uploading', 'committing', 'storage_committed'].includes(page.status)) { throw failure('invalid_progress'); }
            if (status && status !== page.status) { throw failure('progress_changed', true); }
            status = page.status;
            page.parts.forEach(function (part) {
                if (!integer(part.part, cursor, Math.min(cursor + 99, total - 1)) || !DIGEST.test(part.sha256 || '') ||
                    !integer(part.size, 1, Number(this.identity.partSize)) || found.has(Number(part.part))) { throw failure('invalid_progress'); }
                found.set(Number(part.part), part);
            }, this);
            cursor = Number(page.nextCursor);
        } while (cursor);
        return found;
    };
    Upload.prototype.start = async function (file) {
        if (this.controller) { throw failure('transfer_busy'); }
        if (!(file instanceof Blob) || file.size !== Number(this.identity.size)) { throw failure('file_mismatch'); }
        var control = this.controller = new AbortController(), signal = control.signal, failures = 0, confirmed = 0, verified = new Map();
        var size = Number(this.identity.size), partSize = Number(this.identity.partSize), total = Math.ceil(size / partSize);
        try {
            while (true) {
                try {
                    await this.prepare(signal);
                    var parts = await this.parts(signal);
                    confirmed = 0;
                    // Reselecting a same-name/same-size file does not prove its
                    // contents. Verify every acknowledged chunk before writes.
                    for (var entry of parts) {
                        var number = entry[0], part = entry[1], piece = file.slice(number * partSize, Math.min((number + 1) * partSize, size));
                        this.progress({ phase: 'verifying', bytes: confirmed, total: size });
                        var actual = verified.get(number) || await digest(piece, signal);
                        if (Number(part.size) !== piece.size || actual !== part.sha256) { throw failure('file_mismatch'); }
                        verified.set(number, actual);
                        confirmed += piece.size;
                    }
                    for (var index = 0; index < total; index++) {
                        if (parts.has(index)) { continue; }
                        if (Number(this.current.expiresAt) <= Date.now() / 1000 + 5) {
                            await this.prepare(signal, true);
                            // A new route may point at the other instance. Query
                            // its durable progress before any subsequent write.
                            throw failure('credential_refreshed', true);
                        }
                        var blob = file.slice(index * partSize, Math.min((index + 1) * partSize, size));
                        var hash = verified.get(index) || await digest(blob, signal);
                        verified.set(index, hash);
                        this.progress({ phase: 'uploading', bytes: confirmed, total: size, part: index });
                        var receipt = await this.request('parts/' + index, 'PUT', blob, { 'Content-Type': 'application/octet-stream', 'X-Part-SHA256': hash }, signal, json);
                        if (receipt.uploadId !== this.identity.uploadId || receipt.part !== String(index) || receipt.size !== String(blob.size) || receipt.sha256 !== hash) { throw failure('invalid_receipt'); }
                        confirmed += blob.size; failures = 0; this.tried.clear();
                        this.progress({ phase: 'uploading', bytes: confirmed, total: size });
                    }
                    this.progress({ phase: 'uploaded', bytes: size, total: size });
                    return { identity: this.identity, bytes: size };
                } catch (error) {
                    check(signal);
                    if (error.code === 'credential_refreshed') { continue; }
                    if (!error.retryable || ++failures > 3) { throw error; }
                    this.progress({ phase: 'reconnecting', bytes: confirmed, total: size });
                    await this.backoff(signal, failures);
                    await this.recover(signal, error);
                }
            }
        } finally { this.controller = null; }
    };

    function Download(config) { Transfer.call(this, config, 'read'); }
    Download.prototype = Object.create(Transfer.prototype);
    Download.prototype.constructor = Download;
    // A writable is supplied by the host after the user's file-save gesture.
    // Only the returned checkpoint is durable: close() commits the browser's
    // partial file. Per-buffer progress alone must never be saved as a resume.
    Download.prototype.start = async function (handle, checkpoint) {
        if (this.controller || !handle || typeof handle.createWritable !== 'function') { throw failure('unsupported_file_save'); }
        var control = this.controller = new AbortController(), signal = control.signal, local, offset = 0, etag = '';
        try {
            local = await handle.getFile();
            check(signal);
            if (checkpoint) {
            if (!same(this.identity, checkpoint.identity) || !Number.isSafeInteger(checkpoint.bytes) || checkpoint.bytes < 0 ||
                checkpoint.bytes > Number(this.identity.size) || checkpoint.bytes !== local.size || checkpoint.modified !== local.lastModified ||
                typeof checkpoint.etag !== 'string' || !/^"[^"\r\n]+"$/.test(checkpoint.etag)) { throw failure('local_file_changed'); }
                offset = checkpoint.bytes; etag = checkpoint.etag;
            }
        } catch (reason) {
            this.controller = null;
            throw reason;
        }
        var sink, error, failures = 0;
        var self = this, total = Number(this.identity.size), saved;
        try {
            sink = await handle.createWritable({ keepExistingData: !!checkpoint });
            while (offset < total) {
                var before = offset;
                try {
                    await this.prepare(signal);
                    var headers = offset ? { Range: 'bytes=' + offset + '-', 'If-Range': etag } : {};
                    await this.request('content', 'GET', undefined, headers, signal, async function (response, requestSignal) {
                        var tag = response.headers.get('ETag'), range = response.headers.get('Content-Range');
                        if (!tag || !/^"[^"\r\n]+"$/.test(tag) || !response.body) { throw failure('invalid_download'); }
                        if (response.status === 206) {
                            var match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range || '');
                            if (!match || Number(match[1]) !== offset || Number(match[2]) !== total - 1 || Number(match[3]) !== total || etag && tag !== etag) { throw failure('version_changed'); }
                        } else if (response.status === 200) {
                            // If-Range mismatch means replace, never append.
                            await sink.truncate(0); offset = 0;
                        } else { throw failure('invalid_download'); }
                        if (response.headers.get('Content-Length') !== String(total - offset) || response.headers.get('Content-Encoding')) { throw failure('invalid_download'); }
                        etag = tag;
                        var reader = response.body.getReader();
                        try {
                            while (true) {
                                check(requestSignal);
                                var next = await reader.read();
                                if (next.done) { break; }
                                if (next.value.byteLength > total - offset) { throw failure('invalid_download'); }
                                await sink.write({ type: 'write', position: offset, data: next.value });
                                offset += next.value.byteLength;
                                self.progress({ phase: 'downloading', bytes: offset, total: total });
                            }
                        } finally { await reader.cancel().catch(function () {}); reader.releaseLock(); }
                        if (offset !== total) { throw failure('download_interrupted', true); }
                    });
                } catch (reason) {
                    check(signal);
                    if (offset > before) { failures = 0; }
                    if (!reason.retryable || ++failures > 3) { throw reason; }
                    await this.backoff(signal, failures);
                    await this.recover(signal, reason);
                }
            }
        } catch (reason) { error = reason; }
        finally {
            try {
                if (sink) {
                    await sink.truncate(offset);
                    await sink.close();
                    local = await handle.getFile();
                    if (local.size !== offset) { throw failure('local_file_changed'); }
                    saved = { identity: this.identity, bytes: offset, etag: etag, modified: local.lastModified, complete: offset === total };
                }
            } finally { this.controller = null; }
        }
        if (error && error.name !== 'AbortError') { error.checkpoint = saved; throw error; }
        return saved;
    };

    odd.VOD = { Upload: Upload, Download: Download, identity: identity };
})(odd);
