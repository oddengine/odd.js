(function (odd) {
    var utils = odd.utils,
        css = utils.css,
        OS = odd.OS,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        NetStatusEvent = events.NetStatusEvent,
        UIEvent = events.UIEvent,
        MouseEvent = events.MouseEvent,
        TimerEvent = events.TimerEvent,
        RTC = odd.RTC,
        Constraints = RTC.Constraints,

        CLASS_WRAPPER = 'pe-wrapper',
        CLASS_CONTENT = 'pe-content',

        _id = 0,
        _instances = {},
        _default = {
            presentation: 'full', // full, mini, popup
            skin: 'classic',
            profile: '720P_2',
            camera: '',
            microphone: '',
            whip: `${location.protocol}//${location.host}/whip/live`,
            whep: `${location.protocol}//${location.host}/whep/live`,
            trickle: false,
            configuration: {
                iceServers: [{
                    urls: ["stun:stun.l.google.com:19302"],
                }],
            },
            codecpreferences: [
                'audio/opus',
                'video/H264',
            ],
            service: {
                script: 'js/sw.js',
                scope: 'js/',
                enable: false,
            },
        };

    function UI(id, logger) {
        var _this = this,
            _id = id,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger(id, logger),
            _container,
            _wrapper,
            _content,
            _constraints,
            _api,
            _calling,
            _sharing,
            _preview,
            _subscribing,
            _timer;

        EventDispatcher.call(this, 'UI', { id: id, logger: _logger }, Event, NetStatusEvent, UIEvent, MouseEvent);

        function _init() {
            _this.logger = _logger;
            _this.plugins = {};
            _subscribing = {};

            _timer = new utils.Timer(3000, 1, _logger);
            _timer.addEventListener(TimerEvent.TIMER, _onTimer);
        }

        _this.id = function () {
            return _id;
        };

        _this.setup = async function (container, config) {
            _container = container;
            _parseConfig(config || {});
            _constraints = _getConstraints(_this.config);

            _wrapper = utils.createElement('div', CLASS_WRAPPER + ' pe-ui-' + _this.config.skin);
            _wrapper.setAttribute('kind', 'rtc');
            _container.appendChild(_wrapper);

            _content = utils.createElement('div', CLASS_CONTENT);
            _wrapper.appendChild(_content);

            _api = RTC.get(_id, _logger);
            _api.addEventListener(Event.BIND, _onBind);
            _api.addEventListener(Event.READY, _onReady);
            _api.addEventListener(Event.ERROR, _onError);
            _api.addEventListener(NetStatusEvent.NETSTATUS, _this.forward);
            _api.setup(_this.config);

            _buildPlugins();
            _setupPlugins();
            _this.resize();
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

            _this.config = utils.extendz({ id: _id }, RTC.prototype.CONF, _default, config);
            _this.config.plugins = plugins;
        }

        function _getConstraints(config) {
            var constraints = utils.extendz({}, Constraints[config.profile], {
                audio: {
                    deviceId: config.microphone || '',
                },
                video: {
                    deviceId: config.camera || '',
                    facingMode: 'user',
                    cursor: 'always', // always, motion, never
                },
            });
            if (_wrapper && _wrapper.getAttribute('microphone') === 'off') {
                constraints.audio = false;
            }
            if (_wrapper && _wrapper.getAttribute('camera') === 'off') {
                constraints.video = false;
            }
            return constraints;
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
            _wrapper.setAttribute('microphone', 'on');
            _wrapper.setAttribute('camera', 'on');
            _wrapper.setAttribute('sharing', 'off');
            _wrapper.setAttribute('calling', 'off');
            _wrapper.setAttribute('layout', 'right');

            var controlbar = _this.plugins['Controlbar'];
            if (controlbar) {
                _wrapper.setAttribute('controls', controlbar.config.autohide ? 'motion' : 'always');
                if (controlbar.config.autohide) {
                    _wrapper.addEventListener('mousemove', _onMouseMove);
                }
            } else {
                _wrapper.setAttribute('controls', 'never');
            }

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

        function _onBind(e) {
            _this.forward(e);
        }

        _this.call = function () {
            if (_calling) {
                return Promise.resolve(_calling);
            }
            return _api.publish(_constraints, false, false).then(function (ns) {
                _calling = ns;
                ns.addEventListener(Event.RELEASE, _onStreamRelease);
                ns.element().classList.add('pe-rtc-calling');
                _content.appendChild(ns.element());
                _wrapper.setAttribute('calling', 'on');
                return ns;
            });
        };

        _this.hangup = function () {
            if (_calling) {
                _api.stop(_calling.name());
            }
            _wrapper.setAttribute('calling', 'off');
            return Promise.resolve();
        };

        _this.share = function () {
            if (_sharing) {
                return Promise.resolve(_sharing);
            }
            return _api.publish(_constraints, true, false).then(function (ns) {
                _sharing = ns;
                ns.addEventListener(Event.RELEASE, _onStreamRelease);
                ns.element().classList.add('pe-rtc-sharing');
                _content.appendChild(ns.element());

                var tracks = ns.stream().getVideoTracks();
                if (tracks.length) {
                    tracks[0].addEventListener('ended', _onSharingEnded);
                }
                _wrapper.setAttribute('sharing', 'on');
                return ns;
            });
        };

        _this.cancel = function () {
            if (_sharing) {
                _api.stop(_sharing.name());
            }
            _wrapper.setAttribute('sharing', 'off');
            return Promise.resolve();
        };

        _this.microphone = function (enable) {
            if (enable === undefined) {
                return _wrapper.getAttribute('microphone') === 'on';
            }
            var calling = _wrapper.getAttribute('calling') === 'on';
            return _this.hangup().then(function () {
                _wrapper.setAttribute('microphone', enable ? 'on' : 'off');
                _constraints = _getConstraints(_this.config);
                if (calling) {
                    return _this.call();
                }
            });
        };

        _this.camera = function (enable) {
            if (enable === undefined) {
                return _wrapper.getAttribute('camera') === 'on';
            }
            var calling = _wrapper.getAttribute('calling') === 'on';
            return _this.hangup().then(function () {
                _wrapper.setAttribute('camera', enable ? 'on' : 'off');
                _constraints = _getConstraints(_this.config);
                if (calling) {
                    return _this.call();
                }
            });
        };

        _this.play = async function (name) {
            var ns = await _api.play(name);
            _subscribing[name] = ns;
            ns.addEventListener(Event.RELEASE, _onStreamRelease);
            ns.element().classList.add('pe-rtc-subscribing');
            _content.appendChild(ns.element());
            return ns;
        };

        _this.stop = function (name) {
            if (name !== undefined) {
                if (_subscribing[name]) {
                    _api.stop(name);
                }
                return;
            }
            var names = [];
            utils.forEach(_subscribing, function (name) {
                names.push(name);
            });
            for (var i = 0; i < names.length; i++) {
                _api.stop(names[i]);
            }
        };

        function _onSharingEnded(e) {
            _this.cancel().catch(function (err) {
                _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
            });
        }

        function _onStreamRelease(e) {
            var ns = e.target,
                element = ns.element();
            ns.removeEventListener(Event.RELEASE, _onStreamRelease);
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }

            if (ns === _calling) {
                _calling = null;
                _wrapper.setAttribute('calling', 'off');
            } else if (ns === _sharing) {
                var tracks = ns.stream() ? ns.stream().getVideoTracks() : [];
                if (tracks.length) {
                    tracks[0].removeEventListener('ended', _onSharingEnded);
                }
                _sharing = null;
                _wrapper.setAttribute('sharing', 'off');
            } else if (ns === _preview) {
                _preview = null;
                var dashboard = _this.plugins['Dashboard'];
                if (dashboard && dashboard.components['settings']) {
                    dashboard.components['settings'].preview(null);
                }
            } else {
                delete _subscribing[ns.name()];
            }
        }

        _this.layout = function (state) {
            if (state !== undefined) {
                _wrapper.setAttribute('layout', state);
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

                _this.resize();
                _this.dispatchEvent(UIEvent.THEATER, { status: status });
            }
            return _wrapper.getAttribute('theater') === 'true';
        };

        _this.fullscreen = function (status) {
            if (status !== undefined) {
                var video = _sharing ? _sharing.element() : _calling ? _calling.element() : _content.querySelector('video');
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
                case MouseEvent.CLICK:
                    _onClick(e);
                    break;
                case MouseEvent.DOUBLECLICK:
                    _onDoubleClick(e);
                    break;
                case Event.CHANGE:
                    _onChange(e);
                    break;
                default:
                    _this.forward(e);
                    break;
            }
        }

        function _onClick(e) {
            var h = {
                'microphone': function () { _onMicrophoneClick(e); },
                'camera': function () { _onCameraClick(e); },
                'sharing': function () { _onSharingClick(e); },
                'calling': function () { _onCallingClick(e); },
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

        async function _onMicrophoneClick(e) {
            try {
                await _this.microphone(e.data.state === 'on');
            } catch (err) {
                _onControlError('microphone', err);
            }
        }

        async function _onCameraClick(e) {
            try {
                await _this.camera(e.data.state === 'on');
            } catch (err) {
                _onControlError('camera', err);
            }
        }

        async function _onSharingClick(e) {
            try {
                if (e.data.state === 'on') {
                    await _this.share();
                } else {
                    await _this.cancel();
                }
            } catch (err) {
                _onControlError('sharing', err);
            }
        }

        async function _onCallingClick(e) {
            try {
                if (e.data.state === 'on') {
                    await _this.call();
                } else {
                    await _this.hangup();
                }
            } catch (err) {
                _onControlError('calling', err);
            }
        }

        function _onControlError(name, err) {
            var enable = {
                microphone: _constraints.audio !== false,
                camera: _constraints.video !== false,
                sharing: !!_sharing,
                calling: !!_calling,
            }[name];
            _wrapper.setAttribute(name, enable ? 'on' : 'off');
            _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
        }

        function _onChange(e) {
            switch (e.data.name) {
                case 'preview':
                    _previewSettings(e.data.value).catch(function (err) {
                        _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
                    });
                    break;
                case 'save':
                    _saveSettings(e.data.value).catch(function (err) {
                        _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
                    });
                    break;
                default:
                    _this.forward(e);
                    break;
            }
        }

        function _onDoubleClick(e) {
            var h = {
                'theater': function () { _this.theater(_wrapper.getAttribute('theater') !== 'true'); },
                'fullscreen': function () { _this.fullscreen(_wrapper.getAttribute('fullscreen') !== 'true'); },
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

        function _onReady(e) {
            _onStateChange(e);
        }

        function _onSwitching(e) {
            var controlbar = _this.plugins['Controlbar'];
            if (controlbar) {
                var definition = controlbar.components['definition'];
                if (definition) {
                    definition.value(e.data.index);
                }
            }
            _onStateChange(e);
        }

        function _showPanel(name) {
            var dashboard = _this.plugins['Dashboard'];
            if (!dashboard) {
                return;
            }
            if (name !== 'settings') {
                dashboard.show(name);
                return;
            }

            Promise.all([
                RTC.getCameras(_logger),
                RTC.getMicrophones(_logger),
            ]).then(function (devices) {
                var profiles = [];
                utils.forEach(Constraints, function (profile) {
                    profiles.push(profile);
                });
                dashboard.update('settings', {
                    groups: [{
                        name: 'video',
                        title: 'Video',
                        items: [{
                            name: 'profile',
                            type: 'select',
                            value: _this.config.profile,
                            options: profiles,
                        }, {
                            name: 'camera',
                            type: 'select',
                            value: _this.config.camera,
                            options: devices[0],
                        }],
                    }, {
                        name: 'audio',
                        title: 'Audio',
                        items: [{
                            name: 'microphone',
                            type: 'select',
                            value: _this.config.microphone,
                            options: devices[1],
                        }],
                    }],
                });
                dashboard.show('settings');
            });
        }

        function _previewSettings(settings) {
            if (_preview) {
                _api.stop(_preview.name());
            }
            var config = utils.extendz({}, _this.config, settings);
            return _api.preview(_getConstraints(config), false, false).then(function (ns) {
                _preview = ns;
                ns.addEventListener(Event.RELEASE, _onStreamRelease);

                var dashboard = _this.plugins['Dashboard'];
                if (dashboard && dashboard.components['settings']) {
                    dashboard.components['settings'].preview(ns.element());
                }
                return ns;
            });
        }

        async function _saveSettings(settings) {
            var calling = _wrapper.getAttribute('calling') === 'on',
                sharing = _wrapper.getAttribute('sharing') === 'on';
            if (_preview) {
                _api.stop(_preview.name());
            }
            await _this.hangup();
            await _this.cancel();

            _this.config.profile = settings.profile;
            _this.config.camera = settings.camera;
            _this.config.microphone = settings.microphone;
            _constraints = _getConstraints(_this.config);

            if (calling) {
                await _this.call();
            }
            if (sharing) {
                await _this.share();
            }

            var dashboard = _this.plugins['Dashboard'];
            if (dashboard) {
                dashboard.hide('settings');
            }
        }

        function _onError(e) {
            // Ignore these specific errors.
            if ((function () {
                switch (e.data.name) {
                    case 'SecurityError':
                        if (e.data.message.indexOf('toDataURL') !== -1) {
                            return true;
                        }
                        break;
                }
                return false;
            })()) {
                _this.forward(e);
                return;
            }

            e.type = Event.ERROR;
            _onStateChange(e);
            _this.hangup();
            _this.cancel();
            _this.stop();
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
            var width = _content.clientWidth;
            var height = _content.clientHeight;

            utils.forEach(_this.plugins, function (kind, plugin) {
                plugin.resize(width, height);
            });

            _this.dispatchEvent(UIEvent.RESIZE, { width: width, height: height });
        };

        _this.destroy = function (reason) {
            _timer.stop();
            _timer.removeEventListener(TimerEvent.TIMER, _onTimer);

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
                _api.removeEventListener(Event.ERROR, _onError);
                _api.removeEventListener(NetStatusEvent.NETSTATUS, _this.forward);
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
        if (!ui) {
            ui = new UI(id, logger);
            _instances[id] = ui;
        }
        return ui;
    };

    UI.create = function (logger) {
        return UI.get(_id++, logger);
    };

    odd.rtc.ui = UI.get;
    odd.rtc.ui.create = UI.create;
    RTC.UI = UI;
})(odd);

