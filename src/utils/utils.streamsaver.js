(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        SaverEvent = events.SaverEvent,
        WriterState = { INIT: 'init', START: 'start', CLOSING: 'closing', END: 'end' },
        _protocol = 1,
        _default = {
            script: 'js/sw.js',
            scope: 'js/',
            enable: false,
            maxPendingBytes: 4 * 1024 * 1024,
            maxPendingChunks: 64,
            startTimeout: 10000,
            flushTimeout: 10000,
            writeTimeout: 10000,
        };

    function failure(err) {
        return { name: err && err.name || 'OperationError', message: err && err.message || String(err), operation: 'record', recoverable: true };
    }

    // The producer owns capture; this writer owns only its bounded byte queue and sink.
    function StreamWriter(filename, sink, logger, options) {
        EventDispatcher.call(this, 'StreamWriter', { logger: logger }, Event, SaverEvent);

        var _this = this,
            _options = options || {},
            _config = utils.extendz({}, _default, _options.config),
            _source = _options.source,
            _queue = [],
            _bytes = 0,
            _draining = false,
            _ready = false,
            _hasData = false,
            _sourceDone = false,
            _sinkClosing = false,
            _startTimer,
            _writeTimer,
            _flushTimer;

        function _init() {
            _this.filename = filename;
            _this.readyState = WriterState.INIT;
            _this.result = null;
            Object.defineProperty(_this, 'pendingBytes', { get: function () { return _bytes; } });
            _startTimer = setTimeout(function () {
                _finish('failed', { name: 'TimeoutError', message: 'Recording did not start before its deadline.' });
            }, Math.max(0, (_options.deadline || Date.now() + _config.startTimeout) - Date.now()));

            Promise.resolve(_options.ready).then(function () {
                if (_this.readyState === WriterState.END) { return; }
                _ready = true;
                if (_hasData) { clearTimeout(_startTimer); }
                _drain();
            }, function (err) { _finish('failed', err); });
            if (sink.closed) {
                sink.closed.then(function () {
                    if (!_sinkClosing && _this.readyState !== WriterState.END) {
                        _finish('failed', { name: 'InvalidStateError', message: 'The recording sink closed unexpectedly.' });
                    }
                }, function (err) { _finish('failed', err); });
            }
        }

        _this.start = function () {
            if (_this.readyState === WriterState.INIT) {
                _this.readyState = WriterState.START;
                _this.dispatchEvent(SaverEvent.WRITERSTART);
            }
        };

        _this.write = function (chunk) {
            if (_this.readyState === WriterState.START) { _enqueue(chunk); }
        };

        function _enqueue(chunk) {
            if (_this.readyState === WriterState.END) { return; }
            var blob = typeof Blob !== 'undefined' && chunk instanceof Blob,
                batch = Array.isArray(chunk),
                valid = blob || chunk instanceof Uint8Array || batch && chunk.length > 0 && chunk.length <= 4 && chunk.every(function (part) { return part instanceof Uint8Array; }),
                size = blob ? chunk.size : batch && valid ? chunk.reduce(function (sum, part) { return sum + part.byteLength; }, 0) : chunk && chunk.byteLength;
            if (!valid || !Number.isSafeInteger(size) || size < 0) {
                _finish('failed', { name: 'DataError', message: 'Recording requires a byte array or Blob.' });
                return;
            }
            if (!size) { return; }
            if (size > _config.maxPendingBytes - _bytes || _queue.length >= _config.maxPendingChunks) {
                _finish('failed', { name: 'QuotaExceededError', message: 'Recording output is too slow; its pending buffer is full.' });
                return;
            }
            _hasData = true;
            _bytes += size;
            _queue.push({ chunk: chunk, size: size, blob: blob, deadline: Date.now() + _config.writeTimeout });
            if (_ready) { clearTimeout(_startTimer); }
            _armWriteTimer();
            _drain();
        }

        function _armWriteTimer() {
            clearTimeout(_writeTimer);
            if (_queue.length) {
                _writeTimer = setTimeout(function () {
                    _finish('failed', { name: 'TimeoutError', message: 'Recording output did not consume data in time.' });
                }, Math.max(0, _queue[0].deadline - Date.now()));
            }
        }

        async function _drain() {
            if (_draining || !_ready || _this.readyState === WriterState.END) { return; }
            _draining = true;
            try {
                while (_queue.length && _this.readyState !== WriterState.END) {
                    var item = _queue[0],
                        chunk = item.blob ? new Uint8Array(await item.chunk.arrayBuffer()) : item.chunk;
                    if (_this.readyState === WriterState.END) { break; }
                    if (Date.now() >= item.deadline) {
                        throw { name: 'TimeoutError', message: 'Recording output exceeded its write deadline.' };
                    }
                    var parts = Array.isArray(chunk) ? chunk : [chunk];
                    for (var i = 0; i < parts.length && _this.readyState !== WriterState.END; i++) {
                        if (Date.now() >= item.deadline) { throw { name: 'TimeoutError', message: 'Recording output exceeded its write deadline.' }; }
                        await sink.write(parts[i]);
                    }
                    if (_this.readyState === WriterState.END) { break; }
                    _queue.shift();
                    _bytes -= item.size;
                    item.chunk = null;
                    _armWriteTimer();
                }
                if (_this.readyState === WriterState.CLOSING && _sourceDone && !_queue.length && !_sinkClosing) {
                    _sinkClosing = true;
                    await sink.close();
                    _finish(_hasData ? 'completed' : 'aborted');
                }
            } catch (err) {
                _finish('failed', err);
            } finally {
                _draining = false;
            }
        }

        _this.close = function () {
            switch (_this.readyState) {
                case WriterState.INIT:
                case WriterState.START:
                    _this.readyState = WriterState.CLOSING;
                    _this.dispatchEvent(Event.CHANGE, { name: 'recording', value: { state: WriterState.CLOSING } });
                    _flushTimer = setTimeout(function () {
                        _finish('failed', { name: 'TimeoutError', message: 'Recording could not finish before its deadline.' });
                    }, _config.flushTimeout);
                    try {
                        // Only the producer's final data path can enqueue during closing.
                        var tail = _source && _source.close(function (chunk) {
                            if (_this.readyState === WriterState.CLOSING && !_sourceDone) { _enqueue(chunk); }
                        });
                        Promise.resolve(tail).then(function () {
                            if (_this.readyState !== WriterState.CLOSING) { return; }
                            _sourceDone = true;
                            if (!_hasData) { _finish('aborted'); return; }
                            _drain();
                        }, function (err) { _finish('failed', err); });
                    } catch (err) { _finish('failed', err); }
                    break;
            }
        };

        // A producer error uses the same terminal path as a failed sink.
        _this.abort = function (err) { _finish(err ? 'failed' : 'aborted', err); };

        function _finish(outcome, err) {
            if (_this.readyState === WriterState.END) { return; }
            _this.readyState = WriterState.END;
            clearTimeout(_startTimer);
            clearTimeout(_writeTimer);
            clearTimeout(_flushTimer);
            _queue.length = 0;
            _bytes = 0;
            _this.result = { outcome: outcome };
            if (err) { _this.result.error = failure(err); }

            if (outcome !== 'completed') {
                try { if (_source) { _source.abort(); } } catch (_) { /* Continue local cleanup. */ }
                try { Promise.resolve(sink.abort(err)).catch(function () {}); } catch (_) { /* Sink is already closed. */ }
            }
            try { if (_source && _source.release) { _source.release(); } } catch (_) { /* Terminal regardless of cleanup failure. */ }
            _source = null;
            if (err) { _this.dispatchEvent(Event.ERROR, _this.result.error); }
            _this.dispatchEvent(SaverEvent.WRITEREND, _this.result);
        }

        _init();
    }

    function StreamSaver(config, logger) {
        EventDispatcher.call(this, 'StreamSaver', { logger: logger }, Event, SaverEvent);

        var _this = this,
            _logger = logger,
            _entries = Object.create(null),
            _sw,
            _registrationTask,
            _cancelRegistration,
            _generation = 0,
            _destroyed = false;

        function _init() {
            _this.config = utils.extendz({}, _default, config);
            ['maxPendingBytes', 'maxPendingChunks', 'startTimeout', 'flushTimeout', 'writeTimeout'].forEach(function (key) {
                if (!Number.isSafeInteger(_this.config[key]) || _this.config[key] <= 0 || _this.config[key] > 2147483647) {
                    throw { name: 'DataError', message: 'Invalid recording option: ' + key + '.' };
                }
            });
        }

        _this.register = function () {
            if (_destroyed) { return Promise.reject(failure({ name: 'AbortError', message: 'The recording owner is closed.' })); }
            if (_sw && _sw.state === 'activated') { return Promise.resolve(); }
            if (_registrationTask) { return _registrationTask; }
            var available = StreamSaver.describe();
            if (!available.supported) { return Promise.reject(failure({ name: 'NotSupportedError', message: available.reason })); }

            var generation = _generation;
            _registrationTask = new Promise(function (resolve, reject) {
                var worker, timer, settled = false;
                function finish(err) {
                    if (settled) { return; }
                    settled = true;
                    clearTimeout(timer);
                    if (worker) { worker.removeEventListener('statechange', inspect); }
                    _cancelRegistration = null;
                    if (err) { reject(failure(err)); } else { _sw = worker; resolve(); }
                }
                function inspect() {
                    if (generation !== _generation || _destroyed) {
                        finish({ name: 'AbortError', message: 'The recording owner changed.' });
                    } else if (worker.state === 'activated') {
                        finish();
                    } else if (worker.state === 'redundant') {
                        finish({ name: 'InvalidStateError', message: 'The recording worker is no longer active.' });
                    }
                }
                _cancelRegistration = function () { finish({ name: 'AbortError', message: 'Recording setup was cancelled.' }); };
                timer = setTimeout(function () { finish({ name: 'TimeoutError', message: 'The recording worker did not activate in time.' }); }, _this.config.startTimeout);
                try {
                    var script = new URL(_this.config.script, location.href),
                        scope = new URL(_this.config.scope, location.href);
                    if (script.origin !== location.origin || scope.origin !== location.origin || !scope.pathname.endsWith('/')) {
                        throw { name: 'SecurityError', message: 'Recording requires a same-origin worker and directory scope.' };
                    }
                    navigator.serviceWorker.register(script.href, { scope: scope.href }).then(function (registration) {
                        if (settled) { return; }
                        worker = registration.installing || registration.waiting || registration.active;
                        if (!worker || worker.scriptURL !== script.href) {
                            finish({ name: 'InvalidStateError', message: 'The configured recording worker is unavailable.' });
                            return;
                        }
                        worker.addEventListener('statechange', inspect);
                        inspect();
                    }, finish);
                } catch (err) { finish(err); }
            }).then(function () { _registrationTask = null; }, function (err) { _registrationTask = null; throw err; });
            return _registrationTask;
        };

        // Call register first for downloads. Callback recording does not use a worker.
        _this.record = function (filename, source, ondata, deadline) {
            if (_destroyed || Object.keys(_entries).length) {
                throw failure({ name: 'InvalidStateError', message: 'A recording is already active or its owner is closed.' });
            }
            if (typeof filename !== 'string' || !filename.trim() || filename.length > 255 || /[\x00-\x1f\x7f]/.test(filename)) {
                throw failure({ name: 'DataError', message: 'A valid recording filename is required.' });
            }
            if (ondata !== undefined && typeof ondata !== 'function') {
                throw failure({ name: 'DataError', message: 'The recording callback must be a function.' });
            }
            if (!ondata && (!_sw || _sw.state !== 'activated')) {
                throw failure({ name: 'InvalidStateError', message: 'The recording worker is not ready.' });
            }

            var id = ondata ? 'callback' : _operationId(),
                entry = { id: id, port: null, frame: null, writer: null },
                sink, ready, readable, port;
            if (ondata) {
                sink = { write: ondata, close: function () {}, abort: function () {} };
            } else {
                var stream = new TransformStream(), channel = new MessageChannel();
                sink = stream.writable.getWriter();
                readable = stream.readable;
                entry.port = channel.port1;
                port = channel.port2;
                ready = new Promise(function (resolve, reject) { entry.resolve = resolve; entry.reject = reject; });
            }
            var writer = new StreamWriter(filename, sink, _logger, {
                config: _this.config, source: source, ready: ready, deadline: deadline,
            });
            entry.writer = writer;
            _entries[id] = entry;
            writer.addEventListener(SaverEvent.WRITERSTART, _this.forward);
            writer.addEventListener(Event.CHANGE, _this.forward);
            writer.addEventListener(Event.ERROR, _this.forward);
            writer.addEventListener(SaverEvent.WRITEREND, _onWriterEnd);
            window.addEventListener('beforeunload', _onBeforeUnload);

            if (!ondata) {
                entry.port.onmessage = function (e) { _onMessage(entry, e.data); };
                entry.port.onmessageerror = function () { writer.abort({ name: 'DataError', message: 'The recording worker message could not be decoded.' }); };
                try {
                    _sw.postMessage({ operation: 'recordstart', protocol: _protocol, id: id, filename: filename,
                        stream: readable, timeout: Math.max(1, (deadline || Date.now() + _this.config.startTimeout) - Date.now()) }, [port, readable]);
                } catch (err) {
                    port.close();
                    writer.abort(err);
                    throw failure(err);
                }
            }
            return writer;
        };

        function _operationId() {
            var bytes = new Uint8Array(16);
            crypto.getRandomValues(bytes);
            return Array.prototype.map.call(bytes, function (value) { return ('0' + value.toString(16)).slice(-2); }).join('');
        }

        function _onMessage(entry, data) {
            if (_entries[entry.id] !== entry || !data || data.id !== entry.id) { return; }
            if (data.protocol !== _protocol) {
                entry.writer.abort({ name: 'VersionError', message: 'The recording worker changed; reload the page before retrying.' });
                return;
            }
            switch (data.event) {
                case 'recordstart':
                    if (entry.frame) { return; }
                    entry.frame = document.createElement('iframe');
                    entry.frame.hidden = true;
                    entry.frame.title = 'Recording download';
                    entry.frame.src = new URL('record/' + entry.id, new URL(_this.config.scope, location.href)).href;
                    document.body.appendChild(entry.frame);
                    break;
                case 'loadstart':
                    entry.resolve();
                    entry.resolve = entry.reject = function () {};
                    break;
                case 'error':
                    entry.writer.abort(data.error || { name: 'OperationError', message: 'The recording download failed.' });
                    break;
            }
        }

        function _onWriterEnd(e) {
            var writer = e.srcElement;
            Object.keys(_entries).forEach(function (id) {
                var entry = _entries[id];
                if (entry.writer !== writer) { return; }
                delete _entries[id];
                if (entry.reject) { entry.reject({ name: 'AbortError', message: 'Recording ended before download readiness.' }); }
                if (entry.port) {
                    try { entry.port.postMessage({ operation: 'recordend', id: id, protocol: _protocol }); } catch (_) {}
                    entry.port.onmessage = entry.port.onmessageerror = null;
                    entry.port.close();
                }
                if (entry.frame) { entry.frame.remove(); }
            });
            writer.removeEventListener(SaverEvent.WRITERSTART, _this.forward);
            writer.removeEventListener(Event.CHANGE, _this.forward);
            writer.removeEventListener(Event.ERROR, _this.forward);
            writer.removeEventListener(SaverEvent.WRITEREND, _onWriterEnd);
            if (!Object.keys(_entries).length) { window.removeEventListener('beforeunload', _onBeforeUnload); }
            _this.forward(e);
        }

        function _onBeforeUnload() {
            Object.keys(_entries).forEach(function (id) { _entries[id].writer.abort(); });
        }

        // Releasing a saver never unregisters a worker shared by other page instances.
        _this.unregister = function () {
            _generation++;
            if (_cancelRegistration) { _cancelRegistration(); }
            _onBeforeUnload();
            _sw = null;
            _this.dispatchEvent(SaverEvent.UNRIGISTER);
        };

        _this.destroy = function () {
            if (_destroyed) { return; }
            _destroyed = true;
            _generation++;
            if (_cancelRegistration) { _cancelRegistration(); }
            Object.keys(_entries).forEach(function (id) { _entries[id].writer.close(); });
            _sw = null;
        };

        _init();
    }

    StreamSaver.describe = function () {
        var supported = !!(window.isSecureContext && navigator.serviceWorker && window.TransformStream &&
            window.MessageChannel && window.crypto && crypto.getRandomValues);
        return { supported: supported, reason: supported ? '' : 'Local recording requires a secure context, Service Worker and transferable streams.' };
    };
    StreamSaver.prototype.CONF = _default;
    StreamSaver.prototype.isSupported = function (version) {
        var match = typeof version === 'string' && /^(\d+)\.(\d+)\.(\d+)$/.exec(version), minimum = [2, 3, 24];
        if (!match) { return false; }
        for (var i = 0; i < minimum.length; i++) {
            var part = Number(match[i + 1]);
            if (part !== minimum[i]) { return part > minimum[i]; }
        }
        return true;
    };
    StreamWriter.WriterState = WriterState;
    utils.StreamWriter = StreamWriter;
    utils.StreamSaver = StreamSaver;
})(odd);
