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
            _source,
            _definition,
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
                _module = new Module[kind](_model.config, _logger);
                _container.appendChild(_module.element());

                _module.addGlobalListener(_this.forward);
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
            if (!source || utils.typeOf(source.url) !== 'string' || !source.url) {
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

            if (!_module || _module.kind !== module.prototype.kind || _source !== source.url || _definition !== index) {
                _this.destroy();
                _source = source.url;
                _definition = index;
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
            if (_module === undefined) {
                _this.dispatchEvent(Event.ERROR, { name: 'InvalidStateError', message: 'No module initialized yet.' });
                return '';
            }

            var video = _module.element();
            _canvas.width = width || video.videoWidth;
            _canvas.height = height || video.videoHeight;
            _context.drawImage(video, 0, 0, _canvas.width, _canvas.height);

            var data;
            try {
                data = _canvas.toDataURL(mime || 'image/png');
            } catch (err) {
                _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
                return '';
            }
            _this.dispatchEvent(MediaEvent.SCREENSHOT, { image: data });
            return data;
        };

        _this.record = function (filename) {
            if (_module === undefined) {
                _this.dispatchEvent(Event.ERROR, { name: 'InvalidStateError', message: 'No module initialized yet.' });
                return null;
            }
            return _module.record(filename);
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
            if (_module) {
                var module = _module,
                    element = module.element();

                _module = undefined;
                _source = undefined;
                _definition = undefined;
                module.removeGlobalListener(_this.forward);
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

