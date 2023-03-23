(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        IOEvent = events.IOEvent,
        UIEvent = events.UIEvent,
        MouseEvent = events.MouseEvent,
        TouchEvent = events.TouchEvent,
        KeyboardEvent = events.KeyboardEvent,
        IO = odd.IO,
        NES = odd.NES,
        Keyboard = NES.Keyboard,

        CLASS_WRAPPER = 'nes-wrapper',
        CLASS_CONTENT = 'nes-content',

        _id = 0,
        _instances = {},
        _default = {
            skin: 'classic',
            keyboard: {
                1: {
                    75: Keyboard.A, // K
                    74: Keyboard.B, // J
                    71: Keyboard.SELECT, // G
                    72: Keyboard.START, // H
                    87: Keyboard.UP, // W
                    83: Keyboard.DOWN, // S
                    65: Keyboard.LEFT, // A
                    68: Keyboard.RIGHT, // D
                },
                2: {
                    110: Keyboard.A, // Num-.
                    96: Keyboard.B, // Num-0
                    97: Keyboard.SELECT, // Num-1
                    98: Keyboard.START, // Num-2
                    38: Keyboard.UP, // Up
                    40: Keyboard.DOWN, // Down
                    37: Keyboard.LEFT, // Left
                    39: Keyboard.RIGHT, // Right
                },
            },
            plugins: [],
        };

    function UI(id, logger) {
        var _this = this,
            _logger = new utils.Logger(id, logger),
            _container,
            _wrapper,
            _content,
            _url,
            _loader,
            _nes;

        EventDispatcher.call(this, 'UI', { id: id, logger: _logger }, Event, UIEvent, MouseEvent, TouchEvent, KeyboardEvent);

        function _init() {
            _this.id = id;
            _this.logger = _logger;
            _this.controller = 1;
            _this.plugins = {};

            _url = new utils.URL();
        }

        _this.setup = async function (container, config) {
            _container = container;
            _parseConfig(config);

            _wrapper = utils.createElement('div', CLASS_WRAPPER + ' nes-ui-' + _this.config.skin);
            _content = utils.createElement('div', CLASS_CONTENT);
            _wrapper.appendChild(_content);
            _container.appendChild(_wrapper);

            _nes = NES.get(_this.id, _logger);
            _nes.addEventListener(Event.BIND, _onBind);
            _nes.addEventListener(Event.READY, _onReady);
            _nes.addEventListener(Event.VOLUMECHANGE, _onVolumeChange);
            _nes.addEventListener(Event.ERROR, _onError);

            _buildPlugins();
            _setupPlugins();
            _this.resize();

            try {
                await _nes.setup(_content, _this.config);
            } catch (err) {
                _logger.error(`Failed to setup: ${err}`);
                return Promise.reject(err);
            }
            window.addEventListener('resize', _this.resize);
            return Promise.resolve();
        };

        function _parseConfig(config) {
            if (utils.typeOf(config.plugins) !== 'array') {
                config.plugins = [];
            }

            var plugins = [];
            for (var i = 0; i < _default.plugins.length; i++) {
                var plugin = _default.plugins[i];
                var def = plugin.prototype.CONF;
                var cfg = (function (kind) {
                    for (var j = 0; j < config.plugins.length; j++) {
                        var item = config.plugins[j];
                        if (item.kind === kind) {
                            return item;
                        }
                    }
                    return null;
                })(plugin.prototype.kind);
                plugins.push(utils.extendz({}, def, cfg));
            }

            _this.config = utils.extendz({ id: _this.id }, NES.prototype.CONF, _default, config);
            _this.config.plugins = plugins;
        }

        function _buildPlugins() {
            utils.forEach(_this.config.plugins, function (i, config) {
                if (utils.typeOf(UI[config.kind]) !== 'function') {
                    _logger.error('Unrecognized plugin: index=' + i + ', kind=' + config.kind + '.');
                    return;
                }
                if (config.visibility === false) {
                    _logger.log('Component ' + config.kind + ' is disabled.');
                    return;
                }

                switch (config.kind) {
                    case 'Controlbar':
                        config.joystick = _this.config.joystick;
                        break;
                }

                try {
                    var plugin = new UI[config.kind](config, _logger);
                    if (utils.typeOf(plugin.addGlobalListener) === 'function') {
                        plugin.addGlobalListener(_onPluginEvent);
                    }
                    _wrapper.appendChild(plugin.element());
                    _this.plugins[config.kind] = plugin;
                } catch (err) {
                    _logger.error('Failed to initialize plugin: index=' + i + ', kind=' + config.kind + '. Error=' + err.message);
                }
            });
        }

        function _setupPlugins() {
            _wrapper.setAttribute('tabindex', -1);
            _wrapper.setAttribute('state', '');
            _wrapper.setAttribute('muted', _this.config.muted);

            _wrapper.addEventListener('keydown', _onKeyDown);
            _wrapper.addEventListener('keyup', _onKeyUp);
            _wrapper.addEventListener('keypress', _onKeyPress);
        }

        function _onBind(e) {
            _this.config = _nes.config;
            _this.start = _nes.start;
            _this.stop = _nes.stop;
            _this.reset = _nes.reset;
            _this.reload = _nes.reload;
            _this.muted = _nes.muted;
            _this.state = _nes.state;
            _this.forward(e);
        }

        _this.load = function (file, option) {
            _initLoader(option);

            try {
                _logger.log('URL: ' + file);
                _url.parse(file);
            } catch (err) {
                _logger.error('Failed to parse url \"' + file + '\".');
                _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
                return;
            }
            _loader.load(_url);
        };

        function _initLoader(option) {
            _cleanupLoader();

            _loader = new IO.XHR(option, _logger);
            _loader.addEventListener(IOEvent.LOADSTART, _this.forward);
            _loader.addEventListener(IOEvent.OPEN, _this.forward);
            _loader.addEventListener(IOEvent.STALLED, _this.forward);
            _loader.addEventListener(IOEvent.ABORT, _this.forward);
            _loader.addEventListener(IOEvent.TIMEOUT, _this.forward);
            _loader.addEventListener(IOEvent.PROGRESS, _onIOProgress);
            _loader.addEventListener(IOEvent.SUSPEND, _this.forward);
            _loader.addEventListener(IOEvent.LOAD, _this.forward);
            _loader.addEventListener(IOEvent.LOADEND, _this.forward);
            _loader.addEventListener(Event.ERROR, _this.forward);
            _logger.log(_loader.kind + ' loader initialized.');
        }

        function _cleanupLoader() {
            if (_loader) {
                _loader.removeEventListener(IOEvent.LOADSTART, _this.forward);
                _loader.removeEventListener(IOEvent.OPEN, _this.forward);
                _loader.removeEventListener(IOEvent.STALLED, _this.forward);
                _loader.removeEventListener(IOEvent.ABORT, _this.forward);
                _loader.removeEventListener(IOEvent.TIMEOUT, _this.forward);
                _loader.removeEventListener(IOEvent.PROGRESS, _onIOProgress);
                _loader.removeEventListener(IOEvent.SUSPEND, _this.forward);
                _loader.removeEventListener(IOEvent.LOAD, _this.forward);
                _loader.removeEventListener(IOEvent.LOADEND, _this.forward);
                _loader.removeEventListener(Event.ERROR, _this.forward);
                _loader.abort();
            }
        }

        function _onIOProgress(e) {
            _logger.debug('progress: ' + e.data.loaded + '/' + e.data.total);
            _nes.load(e.data.buffer);
            _nes.start();
        }

        function _onPluginEvent(e) {
            switch (e.type) {
                case TouchEvent.TOUCH_START:
                case TouchEvent.TOUCH_MOVE:
                    _onTouchStartAndMove(e);
                    break;
                case TouchEvent.TOUCH_END:
                    _onTouchEnd(e);
                    break;
                case MouseEvent.MOUSE_DOWN:
                    _onMouseDown(e);
                    break;
                case MouseEvent.MOUSE_UP:
                    _onMouseUp(e);
                    break;
                case MouseEvent.CLICK:
                    _onClick(e);
                    break;
                default:
                    _this.forward(e);
                    break;
            }
        }

        function _onTouchStartAndMove(e) {
            var controlbar = _this.plugins['Controlbar'];
            if (controlbar) {
                var joystick = controlbar.components['joystick'];
                if (joystick) {
                    var offsetX = 0;
                    var offsetY = 0;
                    for (var node = joystick.element(); node && node !== _wrapper; node = node.offsetParent) {
                        offsetX += node.offsetLeft;
                        offsetY += node.offsetTop;
                    }
                    var clientX = e.data.touches[0].clientX - offsetX;
                    var clientY = e.data.touches[0].clientY - offsetY;

                    var index = joystick.getDirection(clientX, clientY);
                    _onDirection(index, joystick.config.direction);
                }
            }
        }

        function _onTouchEnd(e) {
            var controlbar = _this.plugins['Controlbar'];
            if (controlbar) {
                var joystick = controlbar.components['joystick'];
                if (joystick) {
                    var index = 0;
                    _onDirection(index, joystick.config.direction);
                }
            }
        }

        function _onDirection(index, direction) {
            switch (direction) {
                case 4:
                    _onDirectionIn4(index);
                    break;
                case 8:
                    _onDirectionIn8(index);
                    break;
            }
        }

        function _onDirectionIn4(index) {
            // _logger.log(`direction: ${index}/4`);
            switch (index) {
                case 1:
                    _nes.keyboard.onKeyDown(_this.controller, Keyboard.UP);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.RIGHT);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.DOWN);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.LEFT);
                    break;
                case 2:
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.UP);
                    _nes.keyboard.onKeyDown(_this.controller, Keyboard.RIGHT);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.DOWN);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.LEFT);
                    break;
                case 3:
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.UP);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.RIGHT);
                    _nes.keyboard.onKeyDown(_this.controller, Keyboard.DOWN);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.LEFT);
                    break;
                case 4:
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.UP);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.RIGHT);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.DOWN);
                    _nes.keyboard.onKeyDown(_this.controller, Keyboard.LEFT);
                    break;
                default:
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.UP);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.RIGHT);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.DOWN);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.LEFT);
                    break;
            }
        }

        function _onDirectionIn8(index) {
            // _logger.log(`direction: ${index}/8`);
            switch (index) {
                case 1:
                    _nes.keyboard.onKeyDown(_this.controller, Keyboard.UP);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.RIGHT);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.DOWN);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.LEFT);
                    break;
                case 2:
                    _nes.keyboard.onKeyDown(_this.controller, Keyboard.UP);
                    _nes.keyboard.onKeyDown(_this.controller, Keyboard.RIGHT);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.DOWN);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.LEFT);
                    break;
                case 3:
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.UP);
                    _nes.keyboard.onKeyDown(_this.controller, Keyboard.RIGHT);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.DOWN);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.LEFT);
                    break;
                case 4:
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.UP);
                    _nes.keyboard.onKeyDown(_this.controller, Keyboard.RIGHT);
                    _nes.keyboard.onKeyDown(_this.controller, Keyboard.DOWN);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.LEFT);
                    break;
                case 5:
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.UP);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.RIGHT);
                    _nes.keyboard.onKeyDown(_this.controller, Keyboard.DOWN);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.LEFT);
                    break;
                case 6:
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.UP);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.RIGHT);
                    _nes.keyboard.onKeyDown(_this.controller, Keyboard.DOWN);
                    _nes.keyboard.onKeyDown(_this.controller, Keyboard.LEFT);
                    break;
                case 7:
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.UP);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.RIGHT);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.DOWN);
                    _nes.keyboard.onKeyDown(_this.controller, Keyboard.LEFT);
                    break;
                case 8:
                    _nes.keyboard.onKeyDown(_this.controller, Keyboard.UP);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.RIGHT);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.DOWN);
                    _nes.keyboard.onKeyDown(_this.controller, Keyboard.LEFT);
                    break;
                default:
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.UP);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.RIGHT);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.DOWN);
                    _nes.keyboard.onKeyUp(_this.controller, Keyboard.LEFT);
                    break;
            }
        }

        function _onKeyDown(e) {
            for (var id in _this.config.keyboard) {
                var controller = _this.config.keyboard[id];
                var key = controller[e.keyCode];
                if (key !== undefined) {
                    _nes.keyboard.onKeyDown(id, key);
                    break;
                }
            }
            e.preventDefault();
        }

        function _onKeyUp(e) {
            for (var id in _this.config.keyboard) {
                var controller = _this.config.keyboard[id];
                var key = controller[e.keyCode];
                if (key !== undefined) {
                    _nes.keyboard.onKeyUp(id, key);
                    break;
                }
            }
            e.preventDefault();
        }

        function _onKeyPress(e) {
            e.preventDefault();
        }

        function _onMouseDown(e) {
            var h = {
                'a': function (e) { _nes.keyboard.onKeyDown(_this.controller, Keyboard.A); },
                'b': function (e) { _nes.keyboard.onKeyDown(_this.controller, Keyboard.B); },
                'select': function (e) { _nes.keyboard.onKeyDown(_this.controller, Keyboard.SELECT); },
                'start': function (e) { _nes.keyboard.onKeyDown(_this.controller, Keyboard.START); },
            }[e.data.name];
            if (h) {
                h(e);
            }
            _this.forward(e);
        }

        function _onMouseUp(e) {
            var h = {
                'a': function (e) { _nes.keyboard.onKeyUp(_this.controller, Keyboard.A); },
                'b': function (e) { _nes.keyboard.onKeyUp(_this.controller, Keyboard.B); },
                'select': function (e) { _nes.keyboard.onKeyUp(_this.controller, Keyboard.SELECT); },
                'start': function (e) { _nes.keyboard.onKeyUp(_this.controller, Keyboard.START); },
            }[e.data.name];
            if (h) {
                h(e);
            }
            _this.forward(e);
        }

        function _onClick(e) {
            var h = {
                'reload': function (e) { },
                'capture': function (e) { },
                'mute': function (e) { _this.muted(true); },
                'unmute': function (e) { _this.muted(false); },
            }[e.data.name];
            if (h) {
                h(e);
            }
            _this.forward(e);
        }

        function _onReady(e) {
            _onStateChange(e);
        }

        function _onVolumeChange(e) {
            var n = e.data.volume * 100 | 0;
            _wrapper.setAttribute('muted', e.data.muted || !n);

            var controlbar = _this.plugins['Controlbar'];
            if (controlbar) {
                controlbar.resize(_content.clientWidth, _content.clientHeight);
            }

            _this.forward(e);
        }

        function _onError(e) {
            var display = _this.plugins['Display'];
            if (display) {
                display.error(e.data);
            }

            _onStateChange(e);
            _this.stop();
        }

        function _onStateChange(e) {
            _wrapper.setAttribute('state', e.type);

            _this.resize();
            _this.forward(e);
        }

        _this.resize = function () {
            var width = _wrapper.clientWidth;
            var height = _wrapper.clientHeight;
            utils.forEach(_this.plugins, function (kind, plugin) {
                plugin.resize(width, height);
            });
            _this.dispatchEvent(UIEvent.RESIZE, { width: width, height: height });
        };

        _this.destroy = function (reason) {
            if (_loader) {
                _loader.abort();
            }
            if (_nes) {
                _nes.destroy(reason);
                _nes.removeEventListener(Event.BIND, _onBind);
                _nes.removeEventListener(Event.READY, _onReady);
                _nes.removeEventListener(Event.ERROR, _onError);
                _container.innerHTML = '';
            }
            delete _instances[_this.id];
        };

        _init();
    }

    UI.prototype = Object.create(EventDispatcher.prototype);
    UI.prototype.constructor = UI;
    UI.prototype.CONF = _default;

    UI.register = function (plugin, index) {
        try {
            _default.plugins.splice(index || _default.plugins.length, 0, plugin);
            UI[plugin.prototype.kind] = plugin;
        } catch (err) {
            _logger.error('Failed to register plugin ' + plugin.prototype.kind + ', Error=' + err.message);
        }
    };

    UI.get = function (id, logger) {
        if (id == null) {
            id = 0;
        }

        var ui = _instances[id];
        if (ui === undefined) {
            ui = new UI(id, logger);
            _instances[id] = ui;
        }
        return ui;
    };

    UI.create = function (logger) {
        return UI.get(_id++, logger);
    };

    odd.nes.ui = UI.get;
    odd.nes.ui.create = UI.create;
    NES.UI = UI;
})(odd);

