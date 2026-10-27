(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        IOEvent = events.IOEvent,
        MediaEvent = events.MediaEvent,
        Player = odd.Player,
        Module = odd.Module;

    function View(container, model, logger) {
        EventDispatcher.call(this, 'View', { logger: logger }, Event, IOEvent);

        var _this = this,
            _container = container,
            _model = model,
            _logger = logger,
            _module,
            _moduleForward,
            _generation = 0,
            _source,
            _definition,
            _vod,
            _canvas,
            _context;

        function _init() {
            _canvas = utils.createElement('canvas');
            _context = _canvas.getContext('2d');
        }

        _this.setup = function (kind) {
            if (_module) {
                if (_module.kind === kind) {
                    return;
                }
                _this.destroy();
            }
            try {
                var program = _model.program(),
                    vod = program && program.vod === true,
                    config = utils.extendz({}, _model.config, _model.config.live, vod ? _model.config.vod : {}, {
                        mode: vod ? 'vod' : 'live',
                        lowlatency: !vod,
                    });
                _module = new Module[kind](config, _logger);
                _container.appendChild(_module.element());

                var generation = _generation;
                _moduleForward = function (event) {
                    if (generation === _generation) { _this.forward(event); }
                };
                _module.addGlobalListener(_moduleForward);
                _module.muted(_model.config.muted);
                _module.volume(_model.config.volume);
                _module.setup();
            } catch (err) {
                _logger.error('Failed to init module ' + kind + '. ' + err.name + ': ' + err.message);
                _this.destroy();
                _this.dispatchEvent(Event.ERROR, { name: err.name, message: 'Failed to initialize the selected module.' });
            }
        };

        _this.play = function (program) {
            if (program === undefined) {
                if (!_module) {
                    _this.dispatchEvent(Event.ERROR, { name: 'NotFoundError', message: 'No module initialized yet.' });
                    return;
                }
                _module.play();
                return;
            }

            var index = _model.definition(),
                source = utils.typeOf(program.sources) === 'array' ? program.sources[index] : null;
            var routed = source && (program.type === 'RTC' || program.type === 'FLV' && typeof _model.config.credentials === 'function') &&
                !source.url && typeof source.streamId === 'string';
            if (!source || (!routed && (utils.typeOf(source.url) !== 'string' || !source.url))) {
                _this.dispatchEvent(Event.ERROR, { name: 'NotFoundError', message: 'The selected source does not exist.' });
                return;
            }
            program = utils.extendz({}, program, { sources: [source] });

            var module;
            try {
                module = odd.module(program);
            } catch (err) {
                _this.dispatchEvent(Event.ERROR, { name: err.name, message: 'Failed to inspect the selected source.' });
                return;
            }
            if (!module) {
                _this.dispatchEvent(Event.ERROR, { name: 'NotSupportedError', message: 'No supported module found for the selected source.' });
                return;
            }

            var identity = routed ? 'stream:' + source.streamId : source.url;
            if (!_module || _module.kind !== module.prototype.kind || _source !== identity || _definition !== index || _vod !== !!program.vod) {
                _this.destroy();
                _source = identity;
                _definition = index;
                _vod = !!program.vod;
                _this.setup(module.prototype.kind);
                return;
            }
            _module.play(program);
        };

        _this.pause = function () {
            if (_module) {
                _module.pause();
            }
        };

        _this.seek = function (offset) {
            if (_module) {
                _module.seek(offset);
                if (_model.state() !== 'pause') {
                    _module.play();
                }
            }
        };

        _this.stop = function () {
            if (_module) {
                _module.stop();
            }
        };

        _this.muted = function (status) {
            if (utils.typeOf(status) === 'boolean') {
                if (_module) {
                    _model.config.muted = _module.muted(status);
                } else if (_model.config.muted !== status) {
                    _model.config.muted = status;
                    _this.dispatchEvent(Event.VOLUMECHANGE, { muted: _model.config.muted, volume: _model.config.volume });
                }
            }
            return _model.config.muted;
        };

        _this.volume = function (f) {
            if (utils.typeOf(f) === 'number') {
                if (_module) {
                    _model.config.volume = _module.volume(f);
                } else if (_model.config.volume !== f) {
                    _model.config.volume = f;
                    _this.dispatchEvent(Event.VOLUMECHANGE, { muted: _model.config.muted, volume: _model.config.volume });
                }
            }
            return _model.config.volume;
        };

        _this.definition = function (index) {
            if (utils.typeOf(index) === 'number' && index !== _model.definition()) {
                var program = _model.program();
                if (index >= 0 && index % 1 === 0 && program && utils.typeOf(program.sources) === 'array' && index < program.sources.length) {
                    _model.definition(index);
                    _this.dispatchEvent(Event.SWITCHING, { index: index });
                } else {
                    _this.dispatchEvent(Event.ERROR, { name: 'IndexSizeError', message: 'The index is not in the allowed range.' });
                }
            }
            return _model.definition();
        };

        _this.capture = function (width, height, mime) {
            try {
                var video = _module && _module.element();
                if (!_context || !video || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
                    throw { name: 'InvalidStateError', message: 'No video frame is available for capture.' };
                }
                var w = width === undefined ? video.videoWidth : width,
                    h = height === undefined ? video.videoHeight : height;
                if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w <= 0 || h <= 0 || w * h > 16777216) {
                    throw { name: 'DataError', message: 'Capture dimensions are invalid or exceed 16 megapixels.' };
                }
                _canvas.width = w;
                _canvas.height = h;
                _context.drawImage(video, 0, 0, w, h);
                var data = _canvas.toDataURL(mime || 'image/png');
                if (data === 'data:,') { throw { name: 'OperationError', message: 'The browser could not create the capture.' }; }
                _this.dispatchEvent(MediaEvent.SCREENSHOT, { image: data });
                return data;
            } catch (err) {
                _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message, operation: 'capture', recoverable: true });
                return '';
            } finally {
                _canvas.width = _canvas.height = 0;
            }
        };

        _this.record = function (filename) {
            var module = _module, generation = _generation;
            return Promise.resolve().then(function () {
                if (!module || module !== _module || generation !== _generation) {
                    throw { name: 'InvalidStateError', message: 'No current recording source is available.' };
                }
                return module.record(filename);
            }).then(function (writer) {
                if (module !== _module || generation !== _generation) {
                    if (writer) { writer.abort(); }
                    throw { name: 'AbortError', message: 'The recording source changed.' };
                }
                if (!writer) { throw { name: 'OperationError', message: 'The recording could not be created.' }; }
                return writer;
            });
        };

        _this.element = function () {
            if (_module) {
                return _module.element();
            }
            return null;
        };

        _this.resize = function (width, height) {

        };

        _this.destroy = function () {
            _generation++;
            if (_module) {
                var module = _module,
                    element = module.element();

                _module = undefined;
                _source = undefined;
                _definition = undefined;
                module.removeGlobalListener(_moduleForward);
                _moduleForward = undefined;
                module.destroy();

                if (element.parentNode === _container) {
                    _container.removeChild(element);
                }
            }
        };

        _init();
    }

    View.prototype = Object.create(EventDispatcher.prototype);
    View.prototype.constructor = View;

    Player.View = View;
})(odd);

