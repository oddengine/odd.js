(function (playease) {
    var utils = playease.utils,
        events = playease.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        SaverEvent = events.SaverEvent,

        WriterState = {
            INIT: 'init',
            START: 'start',
            END: 'end',
        },
        _default = {
            script: 'js/sw.js',
            scope: 'js/',
        };

    function StreamWriter(filename, writer) {
        EventDispatcher.call(this, 'StreamWriter', null, [SaverEvent.WRITERSTART, SaverEvent.WRITEREND]);

        var _this = this,
            _writer;

        function _init() {
            _this.filename = filename;
            _this.state = WriterState.INIT;
            _writer = writer;
            _writer.closed.then(function () {
                utils.log('StreamWriter.closed: ' + _this.filename);
                _this.close();
            });
        }

        _this.start = function () {
            _this.state = WriterState.START;
            _this.dispatchEvent(SaverEvent.WRITERSTART);
        };

        _this.write = function (chunk) {
            // It is writable even in 'init' state.
            return _writer.write(chunk).catch(function (err) {
                utils.error('StreamWriter failed to write: ' + err);
            });
        };

        _this.close = function () {
            switch (_this.state) {
                case WriterState.INIT:
                case WriterState.START:
                    _this.state = WriterState.END;
                    _writer.close();
                    _this.dispatchEvent(SaverEvent.WRITEREND);
                    break;
            }
        };

        _init();
    }

    function StreamSaver(config) {
        EventDispatcher.call(this, 'StreamSaver', null, [Event.ERROR], SaverEvent);

        var _this = this,
            _writers,
            _registration,
            _sw;

        function _init() {
            _this.config = utils.extendz({}, _default, config);
            _writers = {};
        }

        _this.register = function () {
            if (!navigator.serviceWorker) {
                return Promise.reject({ name: 'NotSupportedError', message: 'The operation is not supported.' });
            }
            return navigator.serviceWorker.getRegistration(_this.config.scope).then(function (registration) {
                return registration || navigator.serviceWorker.register(_this.config.script, { scope: _this.config.scope });
            }).then(function (registration) {
                utils.log('Registered ServiceWorkerRegistration: ' + registration.scope);
                _registration = registration;
                _sw = registration.installing || registration.waiting || registration.active;
                _sw.addEventListener('statechange', function (e) {
                    utils.log('ServiceWorker.state: ' + _sw.state);
                });
            }).catch(function (err) {
                utils.error('Failed to register ServiceWorkerRegistration: ' + err);
            });
        };

        _this.record = function (filename) {
            if (!filename) {
                _this.dispatchEvent(Event.ERROR, { name: 'AbortError', message: 'The operation was aborted.' });
                return null;
            }
            if (_writers.hasOwnProperty(filename)) {
                return _writers[filename];
            }

            var ts = new TransformStream();
            var channel = new MessageChannel();
            channel.port1.onmessage = _onMessage;
            channel.port1.postMessage({ stream: ts.readable }, [ts.readable]);

            var writer = new StreamWriter(filename, ts.writable.getWriter());
            writer.addEventListener(SaverEvent.WRITERSTART, _this.forward);
            writer.addEventListener(SaverEvent.WRITEREND, _onWriterEnd);
            _writers[filename] = writer;

            _sw.postMessage({
                operation: 'start',
                filename: filename,
                version: playease.VERSION,
            }, [channel.port2]);
            return writer;
        };

        function _onMessage(e) {
            switch (e.data.event) {
                case 'ready':
                    if (StreamSaver.prototype.isSupported(e.data.version) === false) {
                        utils.warn('ServiceWorker upgrading...');
                        _this.unregister();
                        _this.register(e.data.filename);
                        break;
                    }
                    var iframe = document.createElement('iframe');
                    iframe.hidden = true;
                    iframe.src = _this.config.scope + e.data.filename;
                    document.body.appendChild(iframe);
                    break;

                case 'start':
                    var writer = _writers[e.data.filename];
                    writer.start();
                    break;

                case 'outdated':
                    utils.warn('The player is outdated, please upgrade to ' + e.data.version + ' at least.');
                    _this.unregister(true);
                    _this.dispatchEvent(SaverEvent.OUTDATED, { version: e.data.version });
                    break;
            }
        }

        function _onWriterEnd(e) {
            var writer = e.target;
            writer.removeEventListener(SaverEvent.WRITERSTART, _this.forward);
            writer.removeEventListener(SaverEvent.WRITEREND, _onWriterEnd);
            delete _writers[writer.filename];

            _sw.postMessage({
                operation: 'end',
                filename: writer.filename,
                version: playease.VERSION,
            });
            _this.forward(e);
        }

        _this.unregister = function (outdated) {
            utils.forEach(_writers, function (filename, writer) {
                writer.close();
            });
            _registration = undefined;
            _sw = undefined;

            if (!outdated) {
                navigator.serviceWorker.getRegistration(_this.config.scope).then(function (registration) {
                    registration.unregister();
                    _this.dispatchEvent(SaverEvent.UNRIGISTER);
                }).catch(function (err) {
                    utils.debug('Failed to unregister ServiceWorkerRegistration: ' + err);
                });
            }
        };

        _init();
    }

    StreamSaver.prototype.CONF = _default;

    StreamSaver.prototype.isSupported = function (version) {
        var minimum = '2.1.59';
        var reg = /^(\d+)\.(\d+)\.(\d+)$/;
        var min = minimum.match(reg);
        var ver = version.match(reg);
        for (var i = 0; i < min.length; i++) {
            if (min[i] > ver[i]) {
                return false;
            }
        }
        return true;
    };

    utils.StreamSaver = StreamSaver;
})(playease);

