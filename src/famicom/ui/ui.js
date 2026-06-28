(function (odd) {
    var utils = odd.utils,
        css = utils.css,
        OS = odd.OS,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        UIEvent = events.UIEvent,
        MouseEvent = events.MouseEvent,
        TouchEvent = events.TouchEvent,
        TimerEvent = events.TimerEvent,
        Famicom = odd.Famicom,
        Key = Famicom.Key,

        CLASS_WRAPPER = 'famicom-wrapper',
        CLASS_CONTENT = 'famicom-content',

        _id = 0,
        _instances = {},
        _default = {
            skin: 'classic',
            keyboard: {
                KeyW: Key.UP,
                ArrowUp: Key.UP,
                KeyS: Key.DOWN,
                ArrowDown: Key.DOWN,
                KeyA: Key.LEFT,
                ArrowLeft: Key.LEFT,
                KeyD: Key.RIGHT,
                ArrowRight: Key.RIGHT,
                KeyJ: Key.B,
                KeyK: Key.A,
                KeyU: Key.SELECT,
                ShiftLeft: Key.SELECT,
                ShiftRight: Key.SELECT,
                KeyI: Key.START,
                Enter: Key.START,
            },
            gamepad: {
                buttons: {
                    0: Key.A,
                    1: Key.B,
                    8: Key.SELECT,
                    9: Key.START,
                    12: Key.UP,
                    13: Key.DOWN,
                    14: Key.LEFT,
                    15: Key.RIGHT,
                },
                threshold: 0.5,
            },
            joystick: {
                center: 0.0,
                direction: 8,
            },
            plugins: [],
        };

    function UI(id, logger) {
        var _this = this,
            _logger = new utils.Logger(id, logger),
            _container,
            _wrapper,
            _content,
            _famicom,
            _keyboardKeys,
            _gamepadKeys,
            _joystickKeys,
            _gamepadRaf,
            _timer;

        EventDispatcher.call(this, 'UI', { id: id, logger: _logger }, Event, UIEvent, MouseEvent, TouchEvent);

        function _init() {
            _this.id = id;
            _this.logger = _logger;
            _this.plugins = {};
            _keyboardKeys = {};
            _gamepadKeys = {};
            _joystickKeys = {};
            _timer = new utils.Timer(3000, 1, _logger);
            _timer.addEventListener(TimerEvent.TIMER, _onTimer);
        }

        _this.setup = async function (container, config) {
            _container = container;
            _parseConfig(config || {});

            _wrapper = utils.createElement('div', CLASS_WRAPPER + ' famicom-ui-' + _this.config.skin);
            _content = utils.createElement('div', CLASS_CONTENT);
            _wrapper.appendChild(_content);
            _container.appendChild(_wrapper);

            _famicom = Famicom.get(_this.id, _logger);
            _famicom.addEventListener(Event.BIND, _onBind);
            _famicom.addEventListener(Event.READY, _onReady);
            _famicom.addEventListener(Event.ERROR, _onError);

            _buildPlugins();
            _setupPlugins();
            _this.resize();

            try {
                await _famicom.setup(_content, _this.config);
            } catch (err) {
                _logger.error(`Failed to setup: ${err}`);
                return Promise.reject(err);
            }

            window.addEventListener('resize', _this.resize);
            window.addEventListener('blur', _releaseAll);
            document.addEventListener('visibilitychange', _onVisibilityChange);
            _gamepadRaf = requestAnimationFrame(_pollGamepad);
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

            _this.config = utils.extendz({ id: _this.id }, Famicom.prototype.CONF, _default, config);
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
                    case 'Display':
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
            _wrapper.setAttribute('controls', _this.plugins['Controlbar'] ? 'motion' : 'never');
            _wrapper.setAttribute('fullpage', false);
            _wrapper.setAttribute('fullscreen', false);
            _wrapper.addEventListener('mousedown', _focus);
            _wrapper.addEventListener('touchstart', _focus);
            _wrapper.addEventListener('mousemove', _onMotion);
            _wrapper.addEventListener('touchstart', _onMotion);
            _wrapper.addEventListener('touchmove', _onMotion);
            _wrapper.addEventListener('keydown', _onKeyDown);
            _wrapper.addEventListener('keyup', _onKeyUp);
            _wrapper.addEventListener('keypress', _onKeyPress);
            document.addEventListener('fullscreenchange', _onFullscreenChange);
            document.addEventListener('webkitfullscreenchange', _onFullscreenChange);
            document.addEventListener('mozfullscreenchange', _onFullscreenChange);
            document.addEventListener('MSFullscreenChange', _onFullscreenChange);
        }

        function _focus(e) {
            _wrapper.focus();
        }

        function _onBind(e) {
            _this.config = _famicom.config;
            _this.load = _famicom.load;
            _this.keyDown = _famicom.keyDown;
            _this.keyUp = _famicom.keyUp;
            _this.key = _famicom.key;
            _this.keys = _famicom.keys;
            _this.state = _famicom.state;
            _this.video = _famicom.video;
            _this.forward(e);
        }

        function _onReady(e) {
            _wrapper.focus();
            _wrapper.setAttribute('state', e.type);
            _this.forward(e);
        }

        function _onError(e) {
            _wrapper.setAttribute('state', e.type);
            _this.forward(e);
        }

        function _onPluginEvent(e) {
            switch (e.type) {
                case TouchEvent.TOUCH_START:
                case TouchEvent.TOUCH_MOVE:
                    _onTouchStartAndMove(e);
                    break;
                case TouchEvent.TOUCH_END:
                case TouchEvent.TOUCH_CANCEL:
                    _onTouchEnd(e);
                    break;
                case MouseEvent.MOUSE_DOWN:
                    _onMouseDown(e);
                    break;
                case MouseEvent.MOUSE_UP:
                    _onMouseUp(e);
                    break;
                default:
                    _this.forward(e);
                    break;
            }
        }

        function _onTouchStartAndMove(e) {
            var plugin = _controlsPlugin();
            var joystick = plugin && plugin.components['joystick'];
            if (!joystick) {
                return;
            }

            var offsetX = 0;
            var offsetY = 0;
            for (var node = joystick.element(); node && node !== _wrapper; node = node.offsetParent) {
                offsetX += node.offsetLeft;
                offsetY += node.offsetTop;
            }
            var clientX = e.data.touches[0].clientX - offsetX;
            var clientY = e.data.touches[0].clientY - offsetY;
            _onDirection(joystick.getDirection(clientX, clientY), joystick.config.direction);
        }

        function _onTouchEnd(e) {
            _onDirection(0, _this.config.joystick.direction);
        }

        function _onDirection(index, direction) {
            var map4 = {
                1: [Key.UP],
                2: [Key.RIGHT],
                3: [Key.DOWN],
                4: [Key.LEFT],
            };
            var map8 = {
                1: [Key.UP],
                2: [Key.UP, Key.RIGHT],
                3: [Key.RIGHT],
                4: [Key.RIGHT, Key.DOWN],
                5: [Key.DOWN],
                6: [Key.DOWN, Key.LEFT],
                7: [Key.LEFT],
                8: [Key.LEFT, Key.UP],
            };
            _pressOnly(direction === 4 ? map4[index] : map8[index], [Key.UP, Key.RIGHT, Key.DOWN, Key.LEFT]);
        }

        function _pressOnly(keys, group) {
            var next = {};
            keys = keys || [];
            group.forEach(function (key) {
                if (utils.indexOf(keys, key) === -1) {
                    if (_joystickKeys[key]) {
                        _famicom.keyUp(key);
                    }
                } else {
                    next[key] = true;
                    if (!_joystickKeys[key]) {
                        _famicom.keyDown(key);
                    }
                }
            });
            _joystickKeys = next;
        }

        function _releaseJoystick() {
            utils.forEach(_joystickKeys, function (key) {
                _famicom.keyUp(key);
            });
            _joystickKeys = {};
        }

        function _onMouseDown(e) {
            var key = _buttonKey(e.data.name);
            if (key) {
                _famicom.keyDown(key);
            } else {
                switch (e.data.name) {
                    case 'fullpage':
                        _this.fullpage(true);
                        break;
                    case 'exitfullpage':
                        _this.fullpage(false);
                        break;
                    case 'fullscreen':
                        _this.fullscreen(true);
                        break;
                    case 'exitfullscreen':
                        _this.fullscreen(false);
                        break;
                }
            }
            _wrapper.focus();
            _this.forward(e);
        }

        function _onMouseUp(e) {
            var key = _buttonKey(e.data.name);
            if (key) {
                _famicom.keyUp(key);
            }
            _this.forward(e);
        }

        function _buttonKey(name) {
            return {
                a: Key.A,
                b: Key.B,
                select: Key.SELECT,
                start: Key.START,
            }[name];
        }

        function _controlsPlugin() {
            return _this.plugins['Display'] || _this.plugins['Controlbar'];
        }

        _this.fullpage = function (status) {
            if (status === undefined) {
                return _wrapper.getAttribute('fullpage') === 'true';
            }

            var fullscreenElement = document.fullscreenElement
                || document.webkitFullscreenElement
                || document.mozFullScreenElement
                || document.msFullscreenElement;
            if (fullscreenElement) {
                _this.fullscreen(false);
            }

            _wrapper.setAttribute('fullpage', !!status);
            _this.resize();
            _this.dispatchEvent(UIEvent.FULLPAGE, { status: status });
        };

        _this.fullscreen = function (status) {
            if (status === undefined) {
                return _wrapper.getAttribute('fullscreen') === 'true';
            }

            var video = _this.video && _this.video();
            if (!!status) {
                var requestFullscreen = _wrapper.requestFullscreen
                    || _wrapper.webkitRequestFullScreen
                    || _wrapper.mozRequestFullScreen
                    || _wrapper.msRequestFullscreen;
                if (requestFullscreen) {
                    var promise = requestFullscreen.call(_wrapper);
                    if (promise) {
                        promise['catch'](function (err) {
                            _logger.debug(err.name + ': ' + err.message);
                        });
                    }
                } else if (OS.isMobile && video && video.webkitEnterFullscreen) {
                    video.setAttribute('x5-video-orientation', 'landscape');
                    video.webkitEnterFullscreen();
                    if (OS.isIOS) {
                        return;
                    }
                } else {
                    _this.fullpage(status);
                    return;
                }
            } else {
                var exitFullscreen = document.exitFullscreen
                    || document.webkitCancelFullScreen
                    || document.mozCancelFullScreen
                    || document.msExitFullscreen;
                if (exitFullscreen) {
                    if (video) {
                        video.setAttribute('x5-video-orientation', 'portraint');
                    }
                    var exitPromise = exitFullscreen.call(document);
                    if (exitPromise) {
                        exitPromise['catch'](function (err) {
                            _logger.debug(err.name + ': ' + err.message);
                        });
                    }
                } else {
                    _this.fullpage(status);
                    return;
                }
            }

            _wrapper.setAttribute('fullscreen', !!status);
            _showControlbar();
            _this.resize();
            _this.dispatchEvent(UIEvent.FULLSCREEN, { status: status });
        };

        function _onFullscreenChange(e) {
            var fullscreenElement = document.fullscreenElement
                || document.webkitFullscreenElement
                || document.mozFullScreenElement
                || document.msFullscreenElement;
            if (!fullscreenElement && _wrapper.getAttribute('fullscreen') === 'true') {
                _this.fullscreen(false);
            }
        }

        function _onMotion(e) {
            var controlbar = _this.plugins['Controlbar'];
            if (!controlbar) {
                return;
            }

            var video = _this.video && _this.video();
            if (_wrapper.getAttribute('fullscreen') === 'true') {
                _showControlbar();
                return;
            }

            if (video && e.target !== video && e.target !== controlbar.element()) {
                for (var node = e.target; node; node = node.parentNode) {
                    if (node === video || node === controlbar.element()) {
                        break;
                    }
                }
                if (!node) {
                    return;
                }
            }

            _showControlbar();
        }

        function _showControlbar() {
            var controlbar = _this.plugins['Controlbar'];
            if (!controlbar) {
                return;
            }

            css.style(controlbar.element(), {
                'visibility': 'visible',
            });

            if (controlbar.config.autohide === false) {
                return;
            }

            _timer.reset();
            _timer.delay = controlbar.config.timeout || 3000;
            _timer.start();
        }

        function _onTimer(e) {
            var controlbar = _this.plugins['Controlbar'];
            if (controlbar) {
                css.style(controlbar.element(), {
                    'visibility': 'hidden',
                });
            }
        }

        function _onKeyDown(e) {
            if (e.repeat || _shouldIgnoreKeyboardEvent(e.target)) {
                return;
            }
            var key = _this.config.keyboard[e.code];
            if (!key) {
                return;
            }
            e.preventDefault();
            if (_keyboardKeys[key]) {
                return;
            }
            _keyboardKeys[key] = true;
            _famicom.keyDown(key);
        }

        function _onKeyUp(e) {
            if (_shouldIgnoreKeyboardEvent(e.target)) {
                return;
            }
            var key = _this.config.keyboard[e.code];
            if (!key) {
                return;
            }
            e.preventDefault();
            if (!_keyboardKeys[key]) {
                return;
            }
            delete _keyboardKeys[key];
            _famicom.keyUp(key);
        }

        function _onKeyPress(e) {
            e.preventDefault();
        }

        function _shouldIgnoreKeyboardEvent(target) {
            if (!target || target === _wrapper) {
                return false;
            }
            var tag = target.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
        }

        function _pollGamepad() {
            var pads = navigator.getGamepads ? navigator.getGamepads() : [];
            var gp = pads && pads[0] ? pads[0] : null;
            var next = _getGamepadPressedKeys(gp);

            utils.forEach(next, function (key) {
                if (!_gamepadKeys[key]) {
                    _famicom.keyDown(key);
                }
            });
            utils.forEach(_gamepadKeys, function (key) {
                if (!next[key]) {
                    _famicom.keyUp(key);
                }
            });

            _gamepadKeys = next;
            _gamepadRaf = requestAnimationFrame(_pollGamepad);
        }

        function _getGamepadPressedKeys(gp) {
            var keys = {};
            if (!gp) {
                return keys;
            }

            utils.forEach(_this.config.gamepad.buttons, function (index, key) {
                if (gp.buttons[index] && gp.buttons[index].pressed) {
                    keys[key] = true;
                }
            });

            if (gp.axes.length >= 2) {
                var x = gp.axes[0];
                var y = gp.axes[1];
                var t = _this.config.gamepad.threshold;
                if (x <= -t) {
                    keys[Key.LEFT] = true;
                } else if (x >= t) {
                    keys[Key.RIGHT] = true;
                }
                if (y <= -t) {
                    keys[Key.UP] = true;
                } else if (y >= t) {
                    keys[Key.DOWN] = true;
                }
            }
            return keys;
        }

        function _releaseAll() {
            utils.forEach(_keyboardKeys, function (key) {
                _famicom.keyUp(key);
            });
            utils.forEach(_gamepadKeys, function (key) {
                _famicom.keyUp(key);
            });
            _keyboardKeys = {};
            _gamepadKeys = {};
            _releaseJoystick();
        }

        function _onVisibilityChange(e) {
            if (document.visibilityState !== 'visible') {
                _releaseAll();
            }
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
            _timer.stop();
            _timer.removeEventListener(TimerEvent.TIMER, _onTimer);
            if (_gamepadRaf) {
                cancelAnimationFrame(_gamepadRaf);
            }
            window.removeEventListener('resize', _this.resize);
            window.removeEventListener('blur', _releaseAll);
            document.removeEventListener('visibilitychange', _onVisibilityChange);
            document.removeEventListener('fullscreenchange', _onFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', _onFullscreenChange);
            document.removeEventListener('mozfullscreenchange', _onFullscreenChange);
            document.removeEventListener('MSFullscreenChange', _onFullscreenChange);
            if (_famicom) {
                _famicom.destroy(reason);
                _famicom.removeEventListener(Event.BIND, _onBind);
                _famicom.removeEventListener(Event.READY, _onReady);
                _famicom.removeEventListener(Event.ERROR, _onError);
            }
            if (_container) {
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
        _default.plugins.splice(index || _default.plugins.length, 0, plugin);
        UI[plugin.prototype.kind] = plugin;
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

    odd.famicom.ui = UI.get;
    odd.famicom.ui.create = UI.create;
    Famicom.UI = UI;
})(odd);
