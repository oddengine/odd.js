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
        Key = Famicom.Key,

        CLASS_WRAPPER = 'pe-wrapper',
        CLASS_CONTENT = 'pe-content',

        _id = 0,
        _instances = {},
        _default = {
            presentation: 'full', // full, mini, popup
            skin: 'classic',
            input: 'keyboard',
            instance: '',
            joystick: {
                center: 0.0,
                direction: 8,
            },
            keyboard: {
                wasd: {
                    KeyW: Key.UP, KeyS: Key.DOWN, KeyA: Key.LEFT, KeyD: Key.RIGHT,
                    KeyH: Key.START, KeyG: Key.SELECT, KeyJ: Key.B, KeyK: Key.A,
                },
                arrows: {
                    ArrowUp: Key.UP, ArrowDown: Key.DOWN, ArrowLeft: Key.LEFT, ArrowRight: Key.RIGHT,
                    Numpad3: Key.START, Numpad2: Key.SELECT, Numpad0: Key.B, NumpadDecimal: Key.A,
                },
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
            _bindings,
            _assignment,
            _devices,
            _touchPort,
            _timer;

        EventDispatcher.call(this, 'UI', { id: id, logger: _logger }, Event, MediaEvent, UIEvent, MouseEvent, TouchEvent);

        function _init() {
            _this.logger = _logger;
            _this.plugins = {};

            _joystickkeys = {};
            _keyboardkeys = {};
            _gamepadkeys = {};
            _bindings = { instance: '', player: '', slots: {} };
            _assignment = { ports: [] };
            _devices = {};
            _touchPort = null;

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
            _api.addEventListener(Event.CHANGE, _onPortsChange);
            await _api.setup(_content, _this.config);

            _buildPlugins();
            _setupPlugins();
            _this.resize();

            window.addEventListener('resize', _this.resize);
            window.addEventListener('blur', _releaseInput);
            window.addEventListener('gamepadconnected', _onGamepadConnected);
            window.addEventListener('gamepaddisconnected', _onGamepadDisconnected);
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
            _this.create = _api.create;
            _this.list = _api.list;
            _this.remove = _api.remove;
            _this.play = async function (instance, player) {
                var api = _api;
                _releaseInput();
                var result = await api.play(instance, player);
                if (!result || api !== _api) return result;
                // Location already carries the assigned ports. Metadata may be retried independently.
                _onPortsChange({ data: { name: 'ports', value: {
                    instance: api.instance(), player: api.player(), ports: api.ports(),
                } } });
                try {
                    await api.sync();
                } catch (err) {
                    _updateSettings('Connected; synchronize controller slots before adding or removing.');
                }
                return result;
            };
            _this.sync = _api.sync;
            _this.allocate = _api.allocate;
            _this.release = _api.release;
            _this.stop = function () {
                _releaseInput();
                return _api.stop();
            };
            _this.keyDown = _api.keyDown;
            _this.keyUp = _api.keyUp;
            _this.instance = _api.instance;
            _this.player = _api.player;
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
                case Event.VISIBILITYCHANGE:
                    if (e.data.state === 'visible') _releaseInput();
                    else if (e.data.name === 'settings') _wrapper.focus();
                    _this.forward(e);
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
            var port = _touchPort;
            if (port === null || index && !_inputAllowed(port)) {
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

            keys.forEach(function (key) { pressed[key] = true; });
            var previous = _joystickkeys;
            _joystickkeys = pressed;
            [Key.UP, Key.RIGHT, Key.DOWN, Key.LEFT].forEach(function (key) {
                if (previous[key] && !pressed[key] && !_keyHeld(port, key)) {
                    _api.keyUp(port, key);
                } else if (!previous[key] && pressed[key]) {
                    _api.keyDown(port, key);
                }
            });
        }

        function _onClick(e) {
            var dashboard = _this.plugins['Dashboard'];
            if (dashboard && e.srcElement === dashboard.components['settings']) {
                _onGameAction(e.data).catch(function (err) {
                    if (_api) {
                        _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
                    }
                });
                return;
            }

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
            var dashboard = _this.plugins['Dashboard'];
            if (dashboard && e.srcElement === dashboard.components['settings']) {
                var value = e.data.value;
                try {
                    if (e.data.name === 'keyboard') {
                        var binding = _bindings.slots[value.port];
                        if (!binding) return;
                        var conflict = Object.values(_bindings.slots).some(function (other) {
                            return other.port !== value.port && other.keyboard[value.code] !== undefined;
                        });
                        if (conflict) throw { message: 'This key is assigned to another player.' };
                        _releaseInput(value.port);
                        utils.forEach(binding.keyboard, function (code, key) {
                            if (key === value.key) delete binding.keyboard[code];
                        });
                        if (value.code) binding.keyboard[value.code] = value.key;
                        binding.profile = 'custom';
                    } else if (e.data.name === 'binding') {
                        _this.bind(value.port, value.source);
                    } else if (e.data.name === 'touch') {
                        _releaseInput(_touchPort);
                        _touchPort = Number(value);
                    } else if (e.data.name !== 'game') {
                        _releaseInput();
                        _this.config[e.data.name] = value;
                    }
                    _updateSettings('');
                } catch (err) {
                    _updateSettings(err.message);
                }
                return;
            }

            var h = {
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

        async function _onGameAction(action) {
            var api = _api;
            var dashboard = _this.plugins['Dashboard'];
            if (dashboard.components['settings'].config.pending) return;
            _releaseInput();
            dashboard.update('settings', { pending: action.name, message: '' });
            try {
                var instance = api.instance() || _this.config.instance;
                var result;
                switch (action.name) {
                    case 'create':
                        if (!action.game) throw { message: 'Select a game to create.' };
                        if (api.instance()) throw { message: 'Leave the current game before creating and joining another.' };
                        instance = await _this.create(action.game);
                        if (!instance || api !== _api) return;
                        _this.config.instance = instance;
                        result = await _this.play(instance);
                        break;
                    case 'join':
                        if (!_this.config.instance) throw { message: 'Enter an instance to join.' };
                        result = await _this.play(_this.config.instance);
                        break;
                    case 'allocate':
                        result = await _this.allocate();
                        break;
                    case 'release':
                        _releaseInput(action.port);
                        result = await _this.release(action.port);
                        break;
                    case 'sync':
                        result = await _this.sync();
                        break;
                    case 'leave':
                        result = await _this.stop();
                        break;
                    case 'destroy':
                        result = await _this.remove(instance);
                        break;
                }
                if (api !== _api) return;
                _updateSettings(result === undefined ? 'The operation is not available while the connection is busy.' : '');
            } catch (err) {
                if (api !== _api) return;
                var message = {
                    NoFreePort: 'No free controller slot is available.',
                    PortsChanged: 'The controller allocation changed.',
                    InvalidPortState: 'Keep at least one controller and wait for the connection to be ready.',
                    PortNotOwned: 'This controller slot is not assigned to you.',
                }[err.code] || err.message;
                _updateSettings(message + (err.synchronized ? ' Current allocation synchronized.' : ''));
            } finally {
                if (api === _api) dashboard.update('settings', { pending: '' });
            }
        }

        _this.bind = function (port, source) {
            var binding = _bindings.slots[port];
            if (!binding || _api.ports().indexOf(port) === -1) {
                throw { name: 'InvalidStateError', message: 'Select an assigned controller slot.' };
            }
            _releaseInput(port);
            if (source.type === 'gamepad') {
                var device = source.index === null ? null : _devices[source.index];
                if (source.index !== null && (!device || !device.connected)) {
                    throw { name: 'NotFoundError', message: 'The gamepad is disconnected.' };
                }
                if (device && Object.values(_bindings.slots).some(function (other) {
                    return other.port !== port && other.gamepad === device;
                })) throw { name: 'InvalidStateError', message: 'This gamepad is assigned to another player.' };
                binding.gamepad = device;
            } else if (source.type === 'keyboard') {
                var keys = _this.config.keyboard[source.profile];
                if (source.profile !== 'custom' && !keys) {
                    throw { name: 'NotFoundError', message: 'Unknown keyboard layout.' };
                }
                if (keys && Object.values(_bindings.slots).some(function (other) {
                    return other.port !== port && Object.keys(keys).some(function (code) {
                        return other.keyboard[code] !== undefined;
                    });
                })) throw { name: 'InvalidStateError', message: 'This keyboard layout conflicts with another player.' };
                binding.profile = source.profile;
                if (keys) binding.keyboard = utils.extendz({}, keys);
            } else {
                throw { name: 'TypeError', message: 'Unknown controller type.' };
            }
            _updateSettings('');
        };

        function _onPortsChange(e) {
            if (e.data.name !== 'ports') return;
            var data = e.data.value;
            _assignment = data;
            if (data.disconnected || data.unknown) {
                _releaseInput();
                _updateSettings();
                return;
            }
            if (_bindings.instance !== data.instance || _bindings.player !== data.player) {
                _releaseInput();
                _bindings = { instance: data.instance, player: data.player, slots: {} };
                _touchPort = null;
            }
            utils.forEach(_bindings.slots, function (port, binding) {
                if (data.ports.indexOf(binding.port) === -1) {
                    _releaseInput(binding.port);
                    delete _bindings.slots[port];
                }
            });
            data.ports.forEach(function (port) {
                if (_bindings.slots[port]) return;
                var profile = Object.keys(_this.config.keyboard).find(function (name) {
                    return !Object.values(_bindings.slots).some(function (binding) {
                        return Object.keys(_this.config.keyboard[name]).some(function (code) {
                            return binding.keyboard[code] !== undefined;
                        });
                    });
                });
                _bindings.slots[port] = { port: port, profile: profile || 'custom',
                    keyboard: utils.extendz({}, _this.config.keyboard[profile] || {}), gamepad: null, ready: false };
            });
            if (data.ports.indexOf(_touchPort) === -1) {
                _touchPort = null;
                data.ports.some(function (port) { _touchPort = port; return true; });
            }
            _updateSettings();
        }

        function _updateSettings(message) {
            var dashboard = _this.plugins['Dashboard'];
            if (!dashboard || !_api) return;
            var data = {
                input: _this.config.input, instance: _api.instance() || _this.config.instance,
                slots: _assignment, bindings: Object.values(_bindings.slots),
                devices: Object.values(_devices), profiles: Object.keys(_this.config.keyboard), touch: _touchPort,
            };
            if (message !== undefined) data.message = message;
            dashboard.update('settings', data);
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
            if (_this.config.input !== 'keyboard' || _shouldIgnoreKeyboardEvent(e.target) || e.repeat) return;
            utils.forEach(_bindings.slots, function (_, binding) {
                var key = binding.keyboard[e.code];
                if (key === undefined || _keyboardkeys[e.code] || !_inputAllowed(binding.port)) return;
                _keyboardkeys[e.code] = { port: binding.port, key: key };
                _api.keyDown(binding.port, key);
                e.preventDefault();
            });
        }

        function _onKeyUp(e) {
            var pressed = _keyboardkeys[e.code];
            if (!pressed) return;
            delete _keyboardkeys[e.code];
            if (!_keyHeld(pressed.port, pressed.key)) _api.keyUp(pressed.port, pressed.key);
            e.preventDefault();
        }

        function _keyHeld(port, key) {
            return Object.values(_keyboardkeys).some(function (pressed) {
                return pressed.port === port && pressed.key === key;
            }) || !!(_gamepadkeys[port] && _gamepadkeys[port][key]) ||
                (_touchPort === port && !!_joystickkeys[key]);
        }

        function _inputAllowed(port) {
            var dashboard = _this.plugins['Dashboard'];
            var settings = dashboard && dashboard.components['settings'];
            return !_assignment.disconnected && !_assignment.unknown &&
                _assignment.ports.indexOf(port) !== -1 && !document.hidden && document.hasFocus() &&
                (!settings || settings.element().style.display === 'none' && !settings.config.pending);
        }

        function _shouldIgnoreKeyboardEvent(target) {
            if (!target || target === _wrapper) {
                return false;
            }
            var tag = target.tagName;
            return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
        }

        function _onGamepadConnected(e) {
            var gamepad = e.gamepad;
            if (!_devices[gamepad.index]) {
                _devices[gamepad.index] = { index: gamepad.index, id: gamepad.id, connected: true };
                _updateSettings();
            }
        }

        function _onGamepadDisconnected(e) {
            var device = _devices[e.gamepad.index];
            if (!device) return;
            device.connected = false;
            delete _devices[e.gamepad.index];
            utils.forEach(_bindings.slots, function (_, binding) {
                if (binding.gamepad === device) _releaseInput(binding.port);
            });
            _updateSettings('Gamepad disconnected. Select a device to reconnect it.');
        }

        function _pollGamepads() {
            var gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
            utils.forEach(_devices, function (index, device) {
                if (!gamepads[index] || gamepads[index].id !== device.id) {
                    _onGamepadDisconnected({ gamepad: device });
                }
            });
            Array.prototype.forEach.call(gamepads, function (gamepad) {
                if (gamepad) _onGamepadConnected({ gamepad: gamepad });
            });
            utils.forEach(_bindings.slots, function (_, binding) {
                var device = binding.gamepad;
                var gamepad = device && device.connected && _devices[device.index] === device ? gamepads[device.index] : null;
                var pressed = {};
                if (_this.config.input === 'gamepad' && gamepad) {
                    utils.forEach(_this.config.gamepad.buttons, function (index, key) {
                        var button = gamepad.buttons[index];
                        if (button && (button.pressed || button.value >= _this.config.gamepad.threshold)) pressed[key] = true;
                    });
                    if (gamepad.axes.length >= 2) {
                        if (gamepad.axes[0] <= -_this.config.gamepad.threshold) pressed[Key.LEFT] = true;
                        else if (gamepad.axes[0] >= _this.config.gamepad.threshold) pressed[Key.RIGHT] = true;
                        if (gamepad.axes[1] <= -_this.config.gamepad.threshold) pressed[Key.UP] = true;
                        else if (gamepad.axes[1] >= _this.config.gamepad.threshold) pressed[Key.DOWN] = true;
                    }
                }
                if (!_inputAllowed(binding.port)) binding.ready = false;
                if (!binding.ready) {
                    // Rebinding, focus changes and slot changes require neutral controls first.
                    binding.ready = _inputAllowed(binding.port) && Object.keys(pressed).length === 0;
                    pressed = {};
                }
                _syncGamepad(binding.port, pressed);
            });
            _gamepadframe = requestAnimationFrame(_pollGamepads);
        }

        function _syncGamepad(port, pressed) {
            var previous = _gamepadkeys[port] || {};
            _gamepadkeys[port] = pressed;
            utils.forEach(previous, function (key) {
                if (!pressed[key] && !_keyHeld(port, Number(key))) _api.keyUp(port, Number(key));
            });
            utils.forEach(pressed, function (key) {
                if (!previous[key]) _api.keyDown(port, Number(key));
            });
        }

        function _releaseInput(target) {
            var all = typeof target !== 'number';
            utils.forEach(_bindings.slots, function (_, binding) {
                if (all || binding.port === target) binding.ready = false;
            });
            utils.forEach(_keyboardkeys, function (code, pressed) {
                if (all || pressed.port === target) {
                    delete _keyboardkeys[code];
                    _api.keyUp(pressed.port, pressed.key);
                }
            });
            utils.forEach(_gamepadkeys, function (port, keys) {
                if (all || Number(port) === target) {
                    delete _gamepadkeys[port];
                    utils.forEach(keys, function (key) { _api.keyUp(Number(port), Number(key)); });
                }
            });
            if (all || _touchPort === target) _onTouch(0);
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
                var panel = dashboard.components[name];
                if (panel && panel.element().style.display !== 'none') {
                    dashboard.hide(name);
                    return;
                }
                if (name === 'settings') {
                    var api = _api;
                    if (api.instance()) {
                        _this.config.instance = api.instance();
                    }
                    _releaseInput();
                    _updateSettings();
                    if (api.player()) {
                        api.sync().catch(function (err) {
                            if (api === _api) _updateSettings(err.message);
                        });
                    }

                    api.list().then(function (games) {
                        if (api !== _api || !games) {
                            return;
                        }
                        dashboard.update('settings', { games: games });
                    }).catch(function (err) {
                        if (api === _api) {
                            _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
                        }
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
            window.removeEventListener('gamepadconnected', _onGamepadConnected);
            window.removeEventListener('gamepaddisconnected', _onGamepadDisconnected);
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
                _api.removeEventListener(Event.CHANGE, _onPortsChange);
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

