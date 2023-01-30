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
            _logger = logger,
            _container,
            _model,
            _module,
            _canvas,
            _context,
            _index;

        function _init() {
            _container = container;
            _model = model;
            _canvas = utils.createElement('canvas');
            _context = _canvas.getContext('2d');
            _index = 0;
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
            }
        };

        _this.play = function (file, option) {
            if (file === undefined) {
                if (_module === undefined) {
                    _this.dispatchEvent(Event.ERROR, { name: 'NotFoundError', message: 'Module not found while the source url doesn\'t provided.' });
                    return;
                }
            } else if (_module === undefined || option && option.module && option.module !== _module.kind || !_module.isSupported(file, _model.config.mode)) {
                var module = odd.Module[(option ? option.module : '') || _model.config.module];
                if (module == null || module.prototype.isSupported(file, _model.config.mode) === false) {
                    module = odd.module(file, option);
                    if (module == null) {
                        _this.dispatchEvent(Event.ERROR, { name: 'NotSupportedError', message: 'No supported module found.' });
                        return;
                    }
                }
                _this.setup(module.prototype.kind);
                return;
            }

            _module.play(file, option);
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
                if (index < _model.config.sources.length) {
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
                _module.destroy();
                _module.removeGlobalListener(_this.forward);
                _module = undefined;
                _container.innerHTML = '';
            }
        };

        _init();
    }

    View.prototype = Object.create(EventDispatcher.prototype);
    View.prototype.constructor = View;

    Player.View = View;
})(odd);

