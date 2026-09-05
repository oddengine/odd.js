(function (odd) {
    var utils = odd.utils,
        OS = odd.OS,
        css = utils.css,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        MediaEvent = events.MediaEvent,
        UIEvent = events.UIEvent,
        MouseEvent = events.MouseEvent,
        TouchEvent = events.TouchEvent,
        TimerEvent = events.TimerEvent,
        Famicom = odd.Famicom,
        Port = Famicom.Port,
        Key = Famicom.Key,

        CLASS_WRAPPER = 'pe-wrapper',
        CLASS_CONTENT = 'pe-content',

        _id = 0,
        _instances = {},
        _default = {
            presentation: 'full', // full, mini, popup
            skin: 'classic',
            joystick: {
                center: 0.0,
                direction: 8,
            },
            keyboard: {
                KeyW: [Port.P1, Key.UP],
                KeyS: [Port.P1, Key.DOWN],
                KeyA: [Port.P1, Key.LEFT],
                KeyD: [Port.P1, Key.RIGHT],
                KeyH: [Port.P1, Key.START],
                KeyG: [Port.P1, Key.SELECT],
                KeyJ: [Port.P1, Key.B],
                KeyK: [Port.P1, Key.A],
                ArrowUp: [Port.P2, Key.UP],
                ArrowDown: [Port.P2, Key.DOWN],
                ArrowLeft: [Port.P2, Key.LEFT],
                ArrowRight: [Port.P2, Key.RIGHT],
                Numpad3: [Port.P2, Key.START],
                Numpad2: [Port.P2, Key.SELECT],
                Numpad0: [Port.P2, Key.B],
                NumpadDecimal: [Port.P2, Key.A],
            },
            gamepad: {
                threshold: 0.5,
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
            },
            plugins: [],
        };

    function UI(id, logger) {
        var _this = this,
            _id = id,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger(id, logger),
            _container,
            _wrapper,
            _content,
            _api,
            _joystickkeys,
            _keyboardkeys,
            _gamepadkeys,
            _gamepadframe,
            _timer;

        EventDispatcher.call(this, 'UI', { id: id, logger: _logger }, Event, MediaEvent, UIEvent, MouseEvent, TouchEvent);

        function _init() {
            _this.logger = _logger;
            _this.plugins = {};

            _joystickkeys = {};
            _keyboardkeys = {};
            _gamepadkeys = {};

            _timer = new utils.Timer(3000, 1, _logger);
            _timer.addEventListener(TimerEvent.TIMER, _onTimer);
        }

        _this.id = function () {
            return _id;
        };

        _this.setup = async function (container, config) {
            _container = container;
            _parseConfig(config || {});

            _wrapper = utils.createElement('div', CLASS_WRAPPER + ' pe-ui-' + _this.config.skin);
            _wrapper.setAttribute('kind', 'famicom');
            _wrapper.setAttribute('tabindex', '0');
            _container.appendChild(_wrapper);

            _content = utils.createElement('div', CLASS_CONTENT);
            _wrapper.appendChild(_content);

            _api = Famicom.get(_id, _logger);
            _api.addEventListener(Event.BIND, _onBind);
            _api.addEventListener(Event.READY, _onReady);
            _api.addEventListener(Event.VOLUMECHANGE, _onVolumeChange);
            _api.addEventListener(MediaEvent.STATSCHANGE, _onStatsChange);
            _api.addEventListener(MediaEvent.SCREENSHOT, _this.forward);
            _api.addEventListener(Event.ERROR, _onError);
            _api.setup(_content, _this.config);

            _buildPlugins();
            _setupPlugins();
            _this.resize();

            window.addEventListener('resize', _this.resize);
            window.addEventListener('blur', _releaseInput);
            document.addEventListener('visibilitychange', _onVisibilityChange);
            _wrapper.addEventListener('pointerdown', _focus);
            _gamepadframe = requestAnimationFrame(_pollGamepads);
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

            _this.config = utils.extendz({ id: _id }, Famicom.prototype.CONF, _default, config);
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
            _wrapper.setAttribute('presentation', _this.config.presentation);
            _wrapper.setAttribute('state', '');

            var controlbar = _this.plugins['Controlbar'];
            if (controlbar) {
                _wrapper.setAttribute('controls', controlbar.config.autohide ? 'motion' : 'always');
                if (controlbar.config.autohide) {
                    _wrapper.addEventListener('mousemove', _onMouseMove);
                }
                controlbar.state('muted', _this.config.muted ? 'on' : 'off');
            } else {
                _wrapper.setAttribute('controls', 'never');
            }

            _wrapper.addEventListener('keydown', _onKeyDown);
            _wrapper.addEventListener('keyup', _onKeyUp);
            _wrapper.setAttribute('muted', _this.config.muted);
            _wrapper.setAttribute('layout', 'right');
            _wrapper.setAttribute('theater', false);
            _wrapper.setAttribute('fullscreen', false);

            var contextmenu = _this.plugins['ContextMenu'];
            if (contextmenu) {
                _wrapper.oncontextmenu = function (e) {
                    e = e || window.event;
                    e.preventDefault ? e.preventDefault() : e.returnValue = false;
                    return false;
                };
                document.addEventListener('mouseup', _onMouseUp);
                _wrapper.addEventListener('mouseup', _onMouseUp);
                document.addEventListener('mousedown', _onMouseDown);
                _wrapper.addEventListener('mousedown', _onMouseDown);
            }

            document.addEventListener('fullscreenchange', _onFullscreenChange);
            document.addEventListener('webkitfullscreenchange', _onFullscreenChange);
            document.addEventListener('mozfullscreenchange', _onFullscreenChange);
            document.addEventListener('MSFullscreenChange', _onFullscreenChange);
        }

        function _focus() {
            _wrapper.focus();
        }

        function _onBind(e) {
            _this.load = _api.load;
            _this.play = _api.play;
            _this.stop = _api.stop;
            _this.keyDown = _api.keyDown;
            _this.keyUp = _api.keyUp;
            _this.ports = _api.ports;
            _this.location = _api.location;
            _this.capture = _api.capture;
            _this.muted = _api.muted;
            _this.state = _api.state;
            _this.forward(e);
        }

        _this.layout = function (state) {
            if (state !== undefined) {
                _wrapper.setAttribute('layout', state);

                var controlbar = _this.plugins['Controlbar'];
                if (controlbar) {
                    controlbar.state('layout', state);
                }
                _this.resize();
                _this.dispatchEvent(Event.CHANGE, { name: 'layout', value: state });
            }
            return _wrapper.getAttribute('layout');
        };

        _this.theater = function (status) {
            if (status !== undefined) {
                var fullscreenElement = document.fullscreenElement
                    || document.webkitFullscreenElement
                    || document.mozFullScreenElement
                    || document.msFullscreenElement;
                if (fullscreenElement) {
                    _this.fullscreen(false);
                }

                _wrapper.setAttribute('theater', !!status);

                var controlbar = _this.plugins['Controlbar'];
                if (controlbar) {
                    controlbar.state('theater', status ? 'on' : 'off');
                }
                _this.resize();
                _this.dispatchEvent(UIEvent.THEATER, { status: status });
            }
            return _wrapper.getAttribute('theater') === 'true';
        };

        _this.fullscreen = function (status) {
            if (status !== undefined) {
                var video = _api.element();
                if (!!status) {
                    var requestFullscreen = _wrapper.requestFullscreen
                        || _wrapper.webkitRequestFullScreen
                        || _wrapper.mozRequestFullScreen
                        || _wrapper.msRequestFullscreen; // IE 11, Edge
                    if (OS.isMobile) {
                        if (video && video.webkitEnterFullscreen) {
                            video.setAttribute('x5-video-orientation', 'landscape');
                            video.webkitEnterFullscreen();
                        }
                        if (OS.isIOS) {
                            // TODO(spencer@lau): Need to double check.
                            return;
                        }
                    } else if (requestFullscreen) {
                        var promise = requestFullscreen.call(_wrapper);
                        if (promise) {
                            promise['catch'](function (err) {
                                _logger.debug(err.name + ': ' + err.message);
                                _wrapper.setAttribute('fullscreen', false);
                            });
                        }
                    } else {
                        // IE 9/10
                        _this.theater(status);
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
                        var promise = exitFullscreen.call(document);
                        if (promise) {
                            promise['catch'](function (err) {
                                _logger.debug(err.name + ': ' + err.message);
                            });
                        }
                    } else {
                        _this.theater(status);
                        return;
                    }
                }

                var controlbar = _this.plugins['Controlbar'];
                if (controlbar) {
                    controlbar.state('fullscreen', status ? 'on' : 'off');
                    css.style(controlbar.element(), {
                        'visibility': 'visible',
                    });

                    if (!!status) {
                        if (!controlbar.config.autohide) {
                            _wrapper.setAttribute('controls', 'motion');
                            _wrapper.addEventListener('mousemove', _onMouseMove);
                        }
                    } else {
                        if (!controlbar.config.autohide) {
                            _wrapper.setAttribute('controls', 'always');
                            _wrapper.removeEventListener('mousemove', _onMouseMove);
                            _timer.stop();
                        }
                    }
                }

                _wrapper.setAttribute('fullscreen', !!status);
                _this.resize();
                _this.dispatchEvent(UIEvent.FULLSCREEN, { status: status });
            }
            return _wrapper.getAttribute('fullscreen') === 'true';
        };

        function _onFullscreenChange(e) {
            var fullscreenElement = document.fullscreenElement
                || document.webkitFullscreenElement
                || document.mozFullScreenElement
                || document.msFullscreenElement;
            // Deal with ESC key pressed.
            if (!fullscreenElement) {
                _this.fullscreen(false);
            }
        }

        function _onPluginEvent(e) {
            switch (e.type) {
                case TouchEvent.TOUCHSTART:
                case TouchEvent.TOUCHMOVE:
                    _onTouchStart(e);
                    break;
                case TouchEvent.TOUCHEND:
                case TouchEvent.TOUCHCANCEL:
                    _onTouchEnd(e);
                    break;
                case MouseEvent.CLICK:
                    _onClick(e);
                    break;
                case Event.CHANGE:
                    _onChange(e);
                    break;
                default:
                    _this.forward(e);
                    break;
            }
        }

        function _onTouchStart(e) {
            var display = _this.plugins['Display'];
            if (display) {
                var joystick = display.components['joystick'];
                if (joystick) {
                    var offsetX = 0;
                    var offsetY = 0;
                    for (var node = joystick.element(); node && node !== _wrapper; node = node.offsetParent) {
                        offsetX += node.offsetLeft;
                        offsetY += node.offsetTop;
                    }
                    var clientX = e.data.touches[0].clientX - offsetX;
                    var clientY = e.data.touches[0].clientY - offsetY;
                    _onTouch(joystick.direction(clientX, clientY));
                }
            }
        }

        function _onTouchEnd(e) {
            _onTouch(0);
        }

        function _onTouch(index) {
            var port = _api.ports()[0];
            if (port === undefined) {
                return;
            }
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
            var keys = (_this.config.joystick.direction === 4 ? map4[index] : map8[index]) || [];
            var pressed = {};

            [Key.UP, Key.RIGHT, Key.DOWN, Key.LEFT].forEach(function (key) {
                if (utils.indexOf(keys, key) === -1) {
                    if (_joystickkeys[key]) {
                        _api.keyUp(port, key);
                    }
                } else {
                    pressed[key] = true;
                    if (!_joystickkeys[key]) {
                        _api.keyDown(port, key);
                    }
                }
            });
            _joystickkeys = pressed;
        }

        function _onClick(e) {
            var h = {
                'capture': _this.capture,
                'muted': function () { _this.muted(e.data.state === 'on'); },
                'layout': function () { _this.layout(e.data.state); },
                'stats': function () { _showPanel(e.data.name); },
                'settings': function () { _showPanel(e.data.name); },
                'theater': function () { _this.theater(e.data.state !== 'off'); },
                'fullscreen': function () { _this.fullscreen(e.data.state !== 'off'); },
            }[e.data.name];
            if (h) {
                h();
            } else {
                _this.forward(e);
            }
        }

        function _onChange(e) {
            var h = {
                'keyboard': function () {
                    var binding = e.data.value;
                    utils.forEach(_this.config.keyboard, function (code, value) {
                        if (value[0] === binding.port && value[1] === binding.key) {
                            delete _this.config.keyboard[code];
                        }
                    });
                    _this.config.keyboard[binding.code] = [binding.port, binding.key];
                },
                'timebar': function () {
                    var duration = _api.duration();
                    if (duration) {
                        _api.seek(duration * e.data.value / 100);
                    }
                },
                'volumebar': function () {
                    _api.volume(e.data.value / 100);
                },
                'definition': function () {
                    _api.definition(parseInt(e.data.value));
                },
            }[e.data.name];
            if (h) {
                h();
            } else {
                _this.forward(e);
            }
        }

        function _onMouseMove(e) {
            var controlbar = _this.plugins['Controlbar'];
            if (controlbar) {
                css.style(controlbar.element(), {
                    'visibility': 'visible',
                });
            }

            _timer.stop();
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

        function _onMouseUp(e) {
            var contextmenu = _this.plugins['ContextMenu'];

            if (e.currentTarget === undefined) {
                for (var node = e.srcElement; node; node = node.offsetParent) {
                    if (node === _wrapper) {
                        e.currentTarget = _wrapper;
                        break;
                    }
                }
            }

            if (e.button === 2 && e.currentTarget === _wrapper) {
                var offsetX = 0;
                var offsetY = 0;

                for (var node = e.srcElement || e.target; node && node !== _wrapper; node = node.offsetParent) {
                    offsetX += node.offsetLeft;
                    offsetY += node.offsetTop;
                }

                css.style(contextmenu.element(), {
                    left: e.offsetX + offsetX + 'px',
                    top: e.offsetY + offsetY + 'px',
                    display: 'block',
                });

                e.preventDefault ? e.preventDefault() : e.returnValue = false;
                e.stopPropagation ? e.stopPropagation() : e.cancelBubble = true;
                return false;
            }
        }

        function _onMouseDown(e) {
            var contextmenu = _this.plugins['ContextMenu'];
            css.style(contextmenu.element(), {
                'display': 'none',
            });
        }

        function _onKeyDown(e) {
            if (_shouldIgnoreKeyboardEvent(e.target) || e.repeat) {
                return;
            }
            var arr = _this.config.keyboard[e.code];
            if (arr) {
                var name = arr[0] + ':' + arr[1];
                var port = _api.ports()[arr[0]];
                if (port !== undefined && !_keyboardkeys[name]) {
                    _keyboardkeys[name] = true;
                    _api.keyDown(port, arr[1]);
                }
                e.preventDefault();
            }
        }

        function _onKeyUp(e) {
            if (_shouldIgnoreKeyboardEvent(e.target)) {
                return;
            }
            var arr = _this.config.keyboard[e.code];
            if (arr) {
                var name = arr[0] + ':' + arr[1];
                var port = _api.ports()[arr[0]];
                if (port !== undefined && _keyboardkeys[name]) {
                    delete _keyboardkeys[name];
                    _api.keyUp(port, arr[1]);
                }
                e.preventDefault();
            }
        }

        function _shouldIgnoreKeyboardEvent(target) {
            if (!target || target === _wrapper) {
                return false;
            }
            var tag = target.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
        }

        function _pollGamepads() {
            var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
            for (var port = 0; port < 4; port++) {
                var gamepad = gamepads[port];
                if (!gamepad) {
                    _syncGamepad(port, {});
                    continue;
                }
                var pressed = {};
                utils.forEach(_this.config.gamepad.buttons, function (index, key) {
                    var button = gamepad.buttons[index];
                    if (button && (button.pressed || button.value >= _this.config.gamepad.threshold)) {
                        pressed[key] = true;
                    }
                });
                if (gamepad.axes.length >= 2) {
                    if (gamepad.axes[0] <= -_this.config.gamepad.threshold) {
                        pressed[Key.LEFT] = true;
                    } else if (gamepad.axes[0] >= _this.config.gamepad.threshold) {
                        pressed[Key.RIGHT] = true;
                    }
                    if (gamepad.axes[1] <= -_this.config.gamepad.threshold) {
                        pressed[Key.UP] = true;
                    } else if (gamepad.axes[1] >= _this.config.gamepad.threshold) {
                        pressed[Key.DOWN] = true;
                    }
                }
                _syncGamepad(port, pressed);
            }
            _gamepadframe = requestAnimationFrame(_pollGamepads);
        }

        function _syncGamepad(port, pressed) {
            var previous = _gamepadkeys[port] || {},
                target = _api.ports()[port];
            if (target === undefined) {
                _gamepadkeys[port] = {};
                return;
            }
            utils.forEach(previous, function (key) {
                if (!pressed[key]) {
                    _api.keyUp(target, Number(key));
                }
            });
            utils.forEach(pressed, function (key) {
                if (!previous[key]) {
                    _api.keyDown(target, Number(key));
                }
            });
            _gamepadkeys[port] = pressed;
        }

        function _releaseInput() {
            utils.forEach(_keyboardkeys, function (name) {
                var arr = name.split(':');
                var port = _api.ports()[Number(arr[0])];
                if (port !== undefined) {
                    _api.keyUp(port, Number(arr[1]));
                }
            });
            utils.forEach(_gamepadkeys, function (port, keys) {
                var target = _api.ports()[Number(port)];
                utils.forEach(keys, function (key) {
                    if (target !== undefined) {
                        _api.keyUp(target, Number(key));
                    }
                });
            });
            _keyboardkeys = {};
            _gamepadkeys = {};
            _onTouch(0);
        }

        function _onVisibilityChange() {
            if (document.hidden) {
                _releaseInput();
            }
        }

        function _onReady(e) {
            _onStateChange(e);
        }

        function _onVolumeChange(e) {
            _wrapper.setAttribute('muted', e.data.muted || !e.data.volume);

            var controlbar = _this.plugins['Controlbar'];
            if (controlbar) {
                controlbar.state('muted', e.data.muted || !e.data.volume ? 'on' : 'off');
            }
            _this.forward(e);
        }

        function _onStatsChange(e) {
            var dashboard = _this.plugins['Dashboard'];
            if (dashboard) {
                var data = utils.extendz({}, e.data.stats);
                utils.forEach(data, function (key, value) {
                    switch (key) {
                        case 'BytesReceived':
                        case 'BytesReceivedPerSecond':
                            data[key] = utils.formatBytes(value);
                            break;
                        case 'AudioPacketsReceivedPerSecond':
                        case 'VideoPacketsReceivedPerSecond':
                        case 'DroppedVideoFrames':
                        case 'TotalVideoFrames':
                            data[key] = value.toLocaleString();
                            break;
                        case 'FirstAudioFrameReceivedIn':
                        case 'FirstVideoFrameReceivedIn':
                            data[key] = value.toLocaleString() + ' ms.';
                            break;
                    }
                });
                dashboard.update('stats', data);
            }

            var controlbar = _this.plugins['Controlbar'],
                stats = e.data.stats || {},
                rtt = stats.currentRoundTripTime || stats.roundTripTime || stats.rtt;
            if (controlbar && rtt !== undefined) {
                var label = controlbar.components['rtt'];
                if (label) {
                    label.set(`${Math.round(rtt)}(ms)`);
                }
            }
        }

        function _showPanel(name) {
            var dashboard = _this.plugins['Dashboard'];
            if (dashboard) {
                if (name === 'settings') {
                    dashboard.update('settings', {
                        groups: [{
                            name: 'P1',
                            value: _this.config.keyboard,
                        }, {
                            name: 'P2',
                            value: _this.config.keyboard,
                        }],
                    });
                }
                dashboard.show(name);
            }
        }

        function _onError(e) {
            _wrapper.setAttribute('state', e.type);
            _this.forward(e);
        }

        function _onStateChange(e) {
            _wrapper.setAttribute('state', e.type);

            var display = _this.plugins['Display'];
            if (display) {
                display.state(e.type);
                if (e.type === Event.ERROR) {
                    display.error(e.data);
                }
            }

            _this.resize();
            _this.forward(e);
        }

        _this.presentation = function (container, presentation) {
            if (container && presentation) {
                if (!_wrapper) {
                    throw { name: 'InvalidStateError', message: 'UI must be setup before presentation.' };
                }
                _container = container;

                _wrapper.setAttribute('presentation', presentation);
                _container.appendChild(_wrapper);

                _this.config.presentation = presentation;
                _this.resize();
            }
            return _wrapper.getAttribute('presentation');
        };

        _this.skin = function (value) {
            if (value !== undefined) {
                _this.config.skin = value;
                _wrapper.className = CLASS_WRAPPER + ' pe-ui-' + value;
            }
            return _this.config.skin;
        };

        _this.element = function () {
            return _container;
        };

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

            cancelAnimationFrame(_gamepadframe);
            window.removeEventListener('resize', _this.resize);
            window.removeEventListener('blur', _releaseInput);
            document.removeEventListener('visibilitychange', _onVisibilityChange);
            _wrapper.removeEventListener('pointerdown', _focus);
            _releaseInput();

            document.removeEventListener('mouseup', _onMouseUp);
            _wrapper.removeEventListener('mouseup', _onMouseUp);
            document.removeEventListener('mousedown', _onMouseDown);
            _wrapper.removeEventListener('mousedown', _onMouseDown);

            document.removeEventListener('fullscreenchange', _onFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', _onFullscreenChange);
            document.removeEventListener('mozfullscreenchange', _onFullscreenChange);
            document.removeEventListener('MSFullscreenChange', _onFullscreenChange);

            utils.forEach(_this.plugins, function (_, plugin) {
                plugin.removeGlobalListener(_onPluginEvent);
                plugin.destroy();
            });
            _this.plugins = {};

            if (_api) {
                _api.destroy(reason);
                _api.removeEventListener(Event.BIND, _onBind);
                _api.removeEventListener(Event.READY, _onReady);
                _api.removeEventListener(Event.VOLUMECHANGE, _onVolumeChange);
                _api.removeEventListener(MediaEvent.STATSCHANGE, _onStatsChange);
                _api.removeEventListener(MediaEvent.SCREENSHOT, _this.forward);
                _api.removeEventListener(Event.ERROR, _onError);
                _api = undefined;
            }

            if (_wrapper) {
                _container.removeChild(_wrapper);
            }
            delete _instances[_id];
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
            console.error('Failed to register plugin ' + plugin.prototype.kind + ', error=' + err.message);
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

    odd.famicom.ui = UI.get;
    odd.famicom.ui.create = UI.create;
    Famicom.UI = UI;
})(odd);

