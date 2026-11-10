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
        State = RTC.State,
        Constraints = RTC.Constraints,

        CLASS_WRAPPER = 'pe-wrapper',
        CLASS_CONTENT = 'pe-content',

        _id = 0,
        _instances = {},
        _default = {
            inputPublishing: false,
            previewOnly: false,
            settingsScope: 'next-session',
            speakerLabels: { prefix: 'Speaking: ', unnamed: 'Participant' },
            presentation: 'full', // full, mini, popup
            skin: 'classic',
            plugins: [],
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
            _settings,
            _settingsOwned = false,
            _settingsBaseline,
            _settingsVersion,
            _settingsTask = Promise.resolve(),
            _content,
            _main,
            _rail,
            _videoOrder = new WeakMap(),
            _videoIndex = 0,
            _constraints,
            _audioAllowed = true,
            _api,
            _calling,
            _sharing,
            _preview,
            _previewGeneration = 0,
            _settingsPreviewRevision = 0,
            _settingsGeneration = 0,
            _settingsOpen = false,
            _settingsApplying = false,
            _subscribing,
            _timer,
            _pendingCall,
            _pendingShare,
            _inputWanted = { audio: false, video: false },
            _inputRevision = 0,
            _inputTask = null,
            _meterFrame = 0,
            _meterAt = 0,
            _meters = new Map(),
            _speakerHint,
            _speakerView = null,
            _speakerBindings = [],
            _speakerAt = 0,
            _speakerFresh = null,
            _speakerLevels = new Map(),
            _localOrderAt = 0,
            _readyState;

        EventDispatcher.call(this, 'UI', { id: id, logger: _logger }, Event, NetStatusEvent, UIEvent, MouseEvent);

        function _init() {
            _this.logger = _logger;
            _this.plugins = {};
            _subscribing = {};
            _readyState = State.INITIALIZED;
            _api = RTC.get(_id, _logger);

            _timer = new utils.Timer(3000, 1, _logger);
            _timer.addEventListener(TimerEvent.TIMER, _onTimer);
        }

        _this.id = function () {
            return _id;
        };

        _this.setup = async function (container, config) {
            if (_readyState !== State.INITIALIZED) {
                return Promise.reject({ name: 'InvalidStateError', message: 'RTC UI cannot be setup in state ' + _readyState + '.' });
            }
            _readyState = State.CONNECTING;

            _container = container;
            _parseConfig(config || {});
            _constraints = _getConstraints(_this.config);

            _wrapper = utils.createElement('div', CLASS_WRAPPER + ' pe-media-window pe-ui-' + _this.config.skin);
            _wrapper.setAttribute('kind', 'rtc');
            _container.appendChild(_wrapper);

            _content = utils.createElement('div', CLASS_CONTENT);
            _wrapper.appendChild(_content);
            _main = utils.createElement('div', 'pe-rtc-main');
            _rail = utils.createElement('div', 'pe-rtc-rail');
            _content.appendChild(_main);
            _content.appendChild(_rail);
            _speakerHint = utils.createElement('span', 'pe-rtc-speaker-hint');
            _speakerHint.hidden = true;
            _speakerHint.setAttribute('role', 'status');
            _speakerHint.setAttribute('aria-live', 'polite');
            _wrapper.appendChild(_speakerHint);

            _api = RTC.get(_id, _logger);
            _api.addEventListener(Event.BIND, _onBind);
            _api.addEventListener(Event.READY, _onReady);
            _api.addEventListener(Event.ERROR, _onError);
            _api.addEventListener(NetStatusEvent.NETSTATUS, _this.forward);
            try {
                await _api.setup(_this.config);
                if (_readyState !== State.CONNECTED) {
                    throw { name: 'AbortError', message: 'RTC UI setup was cancelled.' };
                }

                _buildPlugins();
                _setupPlugins();
                _this.resize();
                document.addEventListener('visibilitychange', _onVisibility);
                _onVisibility();
            } catch (err) {
                _this.destroy(err.message);
                throw err;
            }
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

        function _getConstraints(config, preview) {
            var constraints = utils.extendz({}, Constraints[config.profile], {
                audio: {
                    deviceId: typeof config.microphone === 'string' && config.microphone ? { exact: config.microphone } : '',
                },
                video: {
                    deviceId: typeof config.camera === 'string' && config.camera ? { exact: config.camera } : '',
                    facingMode: 'user',
                    cursor: 'always', // always, motion, never
                },
            });
            var microphone = !preview && _wrapper && _wrapper.getAttribute('microphone');
            var camera = !preview && _wrapper && _wrapper.getAttribute('camera');
            if (!_audioAllowed || microphone === 'off' || !preview && !microphone && config.microphone === false) {
                constraints.audio = false;
            }
            if (camera === 'off' || !preview && !camera && config.camera === false) {
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
            if (_this.plugins.Dashboard) {
                _this.plugins.Dashboard.update('settings', { profile: _this.config.profile, camera: _this.config.camera,
                    microphone: _this.config.microphone, joinAudio: _this.config.joinAudio, joinVideo: _this.config.joinVideo,
                    joinPreferences: _this.config.inputPublishing });
            }
            _wrapper.setAttribute('presentation', _this.config.presentation);
            _wrapper.setAttribute('state', '');
            _wrapper.setAttribute('microphone', 'off');
            _wrapper.setAttribute('camera', 'off');
            _wrapper.setAttribute('preview', 'off');
            _wrapper.setAttribute('preview-only', String(_this.config.previewOnly));
            _constraints = _getConstraints(_this.config);
            _wrapper.setAttribute('sharing', 'off');
            _wrapper.setAttribute('calling', 'off');
            _wrapper.setAttribute('layout', _this.config.layout || 'right');

            var controlbar = _this.plugins['Controlbar'];
            if (controlbar) {
                controlbar.state('microphone', _wrapper.getAttribute('microphone'));
                controlbar.state('camera', _wrapper.getAttribute('camera'));
                controlbar.state('layout', _wrapper.getAttribute('layout'));
                _wrapper.setAttribute('controls', controlbar.config.autohide ? 'motion' : 'always');
                if (typeof controlbar.bind === 'function') { controlbar.bind(_wrapper, _onMouseMove); }
                if (controlbar.config.autohide) {
                    _wrapper.addEventListener('pointermove', _onMouseMove);
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
            if (_readyState !== State.CONNECTED || _this.config.previewOnly || _settingsApplying) {
                return Promise.reject({ name: 'InvalidStateError', message: 'Publishing is not available.' });
            }
            if (_calling) { return Promise.resolve(_calling); }
            if (_pendingCall) { return _pendingCall.promise; }

            var operation = { cancelled: false }, inputs = _inputTask;
            if (!inputs && !_preview) {
                inputs = _updateInputs(_this.config.microphone !== false && _audioAllowed, _this.config.camera !== false);
            }
            var settings = _settingsTask;
            _pendingCall = operation;
            operation.promise = Promise.all([inputs, settings]).then(async function () {
                var ns = _preview;
                if (_readyState !== State.CONNECTED || operation.cancelled || !ns) {
                    if (ns && operation.cancelled) { ns.close('cancelled'); }
                    throw { name: 'AbortError', message: 'The call was cancelled.' };
                }
                operation.stream = ns;
                ns.config.video = utils.extendz({}, _this.config.video);
                ns.config.codecpreferences = _this.config.codecpreferences.slice();
                await ns.publish();
                if (_readyState !== State.CONNECTED || operation.cancelled) {
                    ns.close('cancelled');
                    throw { name: 'AbortError', message: 'The call was cancelled.' };
                }
                _preview = null;
                _calling = ns;
                ns.element().classList.remove('pe-rtc-preview');
                ns.element().classList.add('pe-rtc-calling');
                _wrapper.setAttribute('calling', 'on');
                if (_this.plugins.Controlbar) { _this.plugins.Controlbar.state('calling', 'on'); }
                return ns;
            }).finally(function () {
                if (_pendingCall === operation) { _pendingCall = null; }
                if (_this.plugins.Controlbar) { _this.plugins.Controlbar.state('calling', _calling ? 'on' : 'off'); }
            });
            return operation.promise;
        };

        _this.hangup = function () {
            if (_pendingCall) {
                _pendingCall.cancelled = true;
                if (_pendingCall.stream) { _pendingCall.stream.close('cancelled'); }
            }
            if (_calling) { _api.stop(_calling.name()); }
            _wrapper.setAttribute('calling', 'off');
            if (_this.plugins.Controlbar) { _this.plugins.Controlbar.state('calling', 'off'); }
            return Promise.resolve();
        };

        _this.preview = function (enable) {
            if (enable === undefined) { return _wrapper.getAttribute('preview') === 'on'; }
            if (_readyState !== State.CONNECTED || _settingsApplying || _pendingCall) {
                return Promise.reject({ name: 'InvalidStateError', message: 'RTC UI is not ready.' });
            }
            if (!enable) {
                if (_calling) { _calling.element().hidden = true; }
                else {
                    _inputWanted = { audio: false, video: false };
                    _inputRevision++;
                    _releasePreview();
                    _inputControls(false, false);
                }
                _previewControls(false);
                return Promise.resolve();
            }
            var ns = _calling || _preview;
            if (ns) {
                ns.element().hidden = false;
                _previewControls(true);
                return Promise.resolve(ns);
            }
            return _updateInputs(_this.config.microphone !== false && _audioAllowed, _this.config.camera !== false).then(function (stream) {
                _previewControls(!!stream);
                return stream;
            });
        };

        function _previewControls(visible) {
            _wrapper.setAttribute('preview', visible ? 'on' : 'off');
            if (_this.plugins.Controlbar) { _this.plugins.Controlbar.state('preview', visible ? 'on' : 'off'); }
        }

        _this.share = function () {
            if (_readyState !== State.CONNECTED || _this.config.previewOnly) {
                return Promise.reject({ name: 'InvalidStateError', message: 'RTC UI is not ready: state=' + _readyState + '.' });
            }

            if (_sharing) {
                return Promise.resolve(_sharing);
            }
            if (_pendingShare) {
                return _pendingShare.promise;
            }

            var operation = { cancelled: false },
                constraints = utils.extendz({}, _constraints, { video: Constraints[_this.config.profile].video });
            _pendingShare = operation;
            operation.promise = _api.publish(constraints, true, false).then(function (ns) {
                if (_readyState !== State.CONNECTED || operation.cancelled) {
                    ns.close('cancelled');
                    throw { name: 'AbortError', message: 'Screen sharing was cancelled.' };
                }
                _sharing = ns;
                ns.addEventListener(Event.RELEASE, _onStreamRelease);
                ns.element().classList.add('pe-rtc-sharing');
                _content.setAttribute('sharing', 'true');
                _attachVideo(ns.element());

                var tracks = ns.stream().getVideoTracks();
                if (tracks.length) {
                    tracks[0].addEventListener('ended', _onSharingEnded);
                }
                _wrapper.setAttribute('sharing', 'on');

                var controlbar = _this.plugins['Controlbar'];
                if (controlbar) {
                    controlbar.state('sharing', 'on');
                }
                return ns;
            }).catch(function (err) {
                if (operation.cancelled || _readyState !== State.CONNECTED) {
                    throw { name: 'AbortError', message: 'Screen sharing was cancelled.' };
                }
                throw err;
            }).finally(function () {
                if (_pendingShare === operation) {
                    _pendingShare = null;
                }
            });
            return operation.promise;
        };

        _this.cancel = function () {
            if (_pendingShare) {
                _pendingShare.cancelled = true;
            }
            if (_sharing) {
                _api.stop(_sharing.name());
            }
            _wrapper.setAttribute('sharing', 'off');

            var controlbar = _this.plugins['Controlbar'];
            if (controlbar) {
                controlbar.state('sharing', 'off');
            }
            return Promise.resolve();
        };

        _this.audioPolicy = function (allowed) {
            if (allowed === undefined) { return _audioAllowed; }
            _audioAllowed = !!allowed;
            _api.audioPolicy(_audioAllowed);
            if (!_audioAllowed && _wrapper) { _this.microphone(false).catch(function (err) { _onControlError('microphone', err); }); }
        };

        function _inputControls(audio, video) {
            ['microphone', 'camera'].forEach(function (name, index) {
                var state = (index ? video : audio) ? 'on' : 'off';
                _wrapper.setAttribute(name, state);
                if (_this.plugins.Controlbar) { _this.plugins.Controlbar.state(name, state); }
            });
            _constraints = _getConstraints(_this.config);
        }

        function _enableInputTracks(ns, wanted) {
            if (!ns || !ns.stream()) { return; }
            ns.stream().getTracks().forEach(function (track) { track.enabled = !!wanted[track.kind]; });
        }

        // Explicit opt-in for existing meeting participation. Studio controls
        // use the same capture path without starting a publication.
        _this.publishInputs = function (audio, video) {
            if (!_this.config.inputPublishing || _this.config.previewOnly) {
                return Promise.reject({ name: 'InvalidStateError', message: 'Input publishing is not enabled.' });
            }
            return _updateInputs(audio, video).then(function () {
                if (_inputWanted.audio || _inputWanted.video) { return _this.call(); }
                return _calling;
            });
        };

        function _updateInputs(audio, video) {
            if (_readyState !== State.CONNECTED || _settingsApplying) {
                return Promise.reject({ name: 'InvalidStateError', message: 'Input controls are not ready.' });
            }
            if (audio && !_audioAllowed) {
                return Promise.reject({ name: 'NotAllowedError', message: '主持人已开启全体静音，暂不能开麦。' });
            }
            _inputWanted = { audio: !!audio, video: !!video };
            _inputRevision++;
            var local = _calling || _preview;
            if (local && local.stream()) {
                local.stream().getTracks().forEach(function (track) {
                    if (!_inputWanted[track.kind]) { track.enabled = false; }
                });
            }
            if (_inputTask) { return _inputTask; }
            var controls = _this.plugins.Controlbar;
            if (controls) { controls.element().setAttribute('aria-busy', 'true'); }
            var settings = _settingsTask, publishing = _pendingCall && _pendingCall.promise, operationGeneration = _previewGeneration;
            _inputTask = Promise.all([settings.catch(function () {}), publishing]).then(async function () {
                var revision;
                do {
                    revision = _inputRevision;
                    try {
                        var ns = _calling || _preview;
                        if (ns && ns.state() === State.CONNECTING && _pendingCall) {
                            await _pendingCall.promise;
                            if (revision !== _inputRevision) { continue; }
                            ns = _calling || _preview;
                        }
                        if (_readyState !== State.CONNECTED || operationGeneration !== _previewGeneration) { throw { name: 'AbortError', message: 'Session closed.' }; }
                        if (_inputWanted.audio || _inputWanted.video) {
                            var constraints = _getConstraints(_this.config, true);
                            if (!_inputWanted.audio) { constraints.audio = false; }
                            if (!_inputWanted.video) { constraints.video = false; }
                            if (ns) {
                                for (var kind of ['audio', 'video']) {
                                    if (!constraints[kind] || !ns.stream().getTracks().some(function (track) { return track.kind === kind; })) { continue; }
                                    var previous = ns.constraints[kind] && ns.constraints[kind].deviceId;
                                    if (JSON.stringify(previous || '') !== JSON.stringify(constraints[kind].deviceId || '')) {
                                        await (kind === 'video' ? ns.setCamera(constraints[kind].deviceId) : ns.setMicrophone(constraints[kind].deviceId));
                                    }
                                }
                                await ns.updateInputs(constraints);
                            }
                            else {
                                var generation = _previewGeneration;
                                ns = await _api.preview(constraints, false, false);
                                if (_readyState !== State.CONNECTED || generation !== _previewGeneration) {
                                    ns.close('cancelled');
                                    throw { name: 'AbortError', message: 'Preview was cancelled.' };
                                }
                                _preview = ns;
                                ns.addEventListener(Event.RELEASE, _onStreamRelease);
                                ns.element().classList.add('pe-rtc-preview');
                                _attachVideo(ns.element());
                                _attachMeter(ns);
                            }
                            if (_readyState !== State.CONNECTED) { throw { name: 'AbortError', message: 'Session closed.' }; }
                            ns.element().hidden = false;
                            _previewControls(true);
                        }
                        _enableInputTracks(ns, _inputWanted);
                        var stream = ns && ns.stream();
                        _inputControls(!!(stream && stream.getAudioTracks().some(function (t) { return t.enabled && t.readyState !== 'ended'; })),
                            !!(stream && stream.getVideoTracks().some(function (t) { return t.enabled && t.readyState !== 'ended'; })));
                    } catch (err) {
                        if (revision !== _inputRevision && _readyState === State.CONNECTED && operationGeneration === _previewGeneration) { continue; }
                        var active = (_calling || _preview) && (_calling || _preview).stream();
                        _inputWanted = {
                            audio: !!(active && active.getAudioTracks().some(function (t) { return t.enabled && t.readyState !== 'ended'; })),
                            video: !!(active && active.getVideoTracks().some(function (t) { return t.enabled && t.readyState !== 'ended'; })),
                        };
                        if (_readyState === State.CONNECTED) { _inputControls(_inputWanted.audio, _inputWanted.video); }
                        throw err;
                    }
                } while (revision !== _inputRevision);
                return _calling || _preview;
            }).finally(function () {
                _inputTask = null;
                if (controls) { controls.element().removeAttribute('aria-busy'); }
            });
            return _inputTask;
        }

        _this.microphone = function (enable) {
            if (enable === undefined) { return _wrapper.getAttribute('microphone') === 'on'; }
            return _this.config.inputPublishing ? _this.publishInputs(enable, _inputWanted.video) : _updateInputs(enable, _inputWanted.video);
        };

        _this.camera = function (enable) {
            if (enable === undefined) { return _wrapper.getAttribute('camera') === 'on'; }
            return _this.config.inputPublishing ? _this.publishInputs(_inputWanted.audio, enable) : _updateInputs(_inputWanted.audio, enable);
        };

        _this.play = async function (name) {
            if (_readyState !== State.CONNECTED) {
                return Promise.reject({ name: 'InvalidStateError', message: 'RTC UI is not ready: state=' + _readyState + '.' });
            }

            var ns = await _api.play(name);
            if (_readyState !== State.CONNECTED) {
                ns.close('cancelled');
                return Promise.reject({ name: 'AbortError', message: 'RTC playback was cancelled.' });
            }
            _subscribing[name] = ns;
            ns.addEventListener(Event.RELEASE, _onStreamRelease);
            ns.element().classList.add('pe-rtc-subscribing');
            _attachVideo(ns.element());
            _attachMeter(ns);
            return ns;
        };

        // Bind only streams already owned by this UI. The application maps its
        // reliable resource identities to the NetStreams returned by call/play.
        _this.speakers = function (snapshot, bindings) {
            if (_readyState !== State.CONNECTED) { return; }
            if (!snapshot || !Array.isArray(snapshot.items) || snapshot.items.length > 11 ||
                !Array.isArray(bindings) || bindings.length > 16) {
                throw { name: 'TypeError', message: 'A bounded speaker snapshot and stream bindings are required.' };
            }
            _speakerBindings.forEach(function (binding) {
                var element = binding.netStream.element();
                element.style.removeProperty('order');
                element.removeAttribute('speaking');
                element.removeAttribute('presentation-role');
                element.classList.remove('pe-rtc-screen');
            });
            var owned = [_calling, _sharing].concat(Object.keys(_subscribing).map(function (name) { return _subscribing[name]; }));
            _speakerBindings = bindings.filter(function (binding) {
                return binding && typeof binding.publisherGeneration === 'string' &&
                    /^[1-9][0-9]{0,19}$/.test(binding.publisherGeneration) &&
                    owned.indexOf(binding.netStream) >= 0 && binding.netStream;
            }).map(function (binding) {
                return { resourceId: binding.resourceId, publisherGeneration: String(binding.publisherGeneration), netStream: binding.netStream, screen: binding.netStream === _sharing || binding.purpose === 'screen' };
            });
            _speakerView = { source: snapshot.source === 'local' ? 'local' : 'directory', known: !!snapshot.known && typeof snapshot.observedAt === 'number', items: snapshot.items.map(function (item) { return Object.assign({}, item); }) };
            _speakerAt = typeof snapshot.observedAt === 'number' ? snapshot.observedAt : performance.now();
            _speakerLevels.forEach(function (value, ns) {
                if (!_speakerBindings.some(function (binding) { return binding.netStream === ns; })) { _speakerLevels.delete(ns); }
            });
            _speakerFresh = null;
            _localOrderAt = 0;
            _orderSpeakers(performance.now());
        };

        function _orderSpeakers(now) {
            if (!_speakerView) { return; }
            var elapsed = now - _speakerAt, items = _speakerView.items.slice(),
                fresh = _speakerView.known && items.every(function (item) { return !item.measured || elapsed < item.validFor; });
            var local = _speakerView.source === 'local';
            if (local) {
                if (_speakerFresh !== null && now - _localOrderAt < 1200) { return; }
                _localOrderAt = now;
                fresh = true;
                items.forEach(function (item) {
                    var binding = _speakerBindings.find(function (value) {
                        return value.resourceId === item.resourceId && value.publisherGeneration === item.publisherGeneration;
                    });
                    var level = binding && _speakerLevels.get(binding.netStream);
                    item.active = !!(level && level.active);
                    item.level = level ? level.value : 0;
                    item.previous = binding ? Number(binding.netStream.element().style.order) || 0 : 0;
                });
                items.sort(function (a, b) {
                    var roles = ['owner', 'host', 'anchor', 'presenter', ''];
                    var priority = roles.indexOf(a.presentation) - roles.indexOf(b.presentation);
                    if (priority) { return priority; }
                    if (!a.presentation && a.active !== b.active) { return a.active ? -1 : 1; }
                    if (!a.presentation && a.active && Math.abs(a.level - b.level) >= 8) { return b.level - a.level; }
                    return a.previous - b.previous || a.slot - b.slot || a.userId.localeCompare(b.userId);
                });
            } else if (fresh === _speakerFresh) { return; }
            _speakerFresh = fresh;
            if (!fresh) {
                items.sort(function (a, b) {
                    var roles = ['owner', 'host', 'anchor', 'presenter', ''];
                    return roles.indexOf(a.presentation) - roles.indexOf(b.presentation) ||
                        a.slot - b.slot || a.userId.localeCompare(b.userId);
                });
            }
            _speakerBindings.forEach(function (binding) {
                var element = binding.netStream.element();
                element.style.removeProperty('order');
                element.setAttribute('speaking', 'false');
                element.classList.toggle('pe-rtc-screen', binding.screen);
                if (binding.screen) { element.style.order = -32; }
            });
            _content.setAttribute('sharing', _sharing || _speakerBindings.some(function (binding) { return binding.screen; }) ? 'true' : 'false');
            items.forEach(function (item, index) {
                var binding = _speakerBindings.find(function (candidate) {
                    return !candidate.screen && candidate.resourceId === item.resourceId && candidate.publisherGeneration === item.publisherGeneration;
                });
                if (binding) {
                    var element = binding.netStream.element();
                    element.style.order = index - 16;
                    element.setAttribute('speaking', fresh && item.active ? 'true' : 'false');
                    element.setAttribute('presentation-role', item.presentation);
                }
            });
            _updateSpeakerHint(items, fresh);
            _layoutVideos();
        }

        function _updateSpeakerHint(items, fresh) {
            var labels = _this.config.speakerLabels, names = [], users = new Set();
            if (fresh) {
                items.forEach(function (item) {
                    if (item.active && !users.has(item.userId)) {
                        users.add(item.userId);
                        names.push(item.displayName || labels.unnamed + ' ' + (item.slot + 1));
                    }
                });
            }
            var text = names.length ? labels.prefix + names.join('、') : '';
            if (_speakerHint.textContent !== text) { _speakerHint.textContent = text; }
            _speakerHint.hidden = !text || (_this.layout() !== 'hidden' && _this.thumbnails() !== 'hidden') || _this.layout() === 'grid';
        }

        // Local presentation reuses the meter pass. It neither subscribes to
        // extra streams nor sends measurements or authority to another service.
        function _measureSpeaker(ns, measurement, now) {
            if (!_speakerView || _speakerView.source !== 'local') { return; }
            var value = _speakerLevels.get(ns);
            if (!value) { value = { value: 0, above: 0, heard: 0, active: false }; _speakerLevels.set(ns, value); }
            if (measurement.state !== 'live' || !Number.isFinite(measurement.value)) {
                value.value = 0; value.above = 0; value.heard = 0; value.active = false;
            } else {
                value.value = value.value * .65 + Math.max(0, Math.min(100, measurement.value)) * .35;
                if (value.value >= 4) {
                    if (!value.above) { value.above = now; }
                    value.heard = now;
                    if (now - value.above >= 160) { value.active = true; }
                } else {
                    value.above = 0;
                    if (value.value < 2 && now - value.heard >= 800) { value.active = false; }
                }
            }
            var binding = _speakerBindings.find(function (item) { return item.netStream === ns; });
            if (binding && !binding.screen) { ns.element().setAttribute('speaking', value.active ? 'true' : 'false'); }
        }

        function _attachVideo(video) {
            if (!_videoOrder.has(video)) { _videoOrder.set(video, ++_videoIndex); }
            _rail.appendChild(video);
            _layoutVideos();
        }

        function _layoutVideos() {
            if (!_main) { return; }
            var videos = Array.prototype.slice.call(_content.querySelectorAll('video'));
            videos.sort(function (a, b) {
                var ap = a.classList.contains('pe-rtc-sharing') || a.classList.contains('pe-rtc-screen') ? -32 : Number(a.style.order) || 0;
                var bp = b.classList.contains('pe-rtc-sharing') || b.classList.contains('pe-rtc-screen') ? -32 : Number(b.style.order) || 0;
                return ap - bp || _videoOrder.get(a) - _videoOrder.get(b);
            });
            videos.forEach(function (video, index) {
                var parent = index === 0 ? _main : _rail;
                if (video.parentNode !== parent) { parent.appendChild(video); }
            });
            _rail.hidden = videos.length < 2;
            _content.style.setProperty('--pe-grid-columns', String(videos.length < 2 ? 1 : videos.length <= 4 ? 2 : 3));
            _content.style.setProperty('--pe-grid-rows', String(Math.ceil(videos.length / (videos.length < 2 ? 1 : videos.length <= 4 ? 2 : 3)) || 1));
        }

        function _attachMeter(ns) {
            var meter = utils.createElement('span', 'pe-rtc-meter');
            meter.setAttribute('aria-hidden', 'true');
            meter.setAttribute('audio-state', 'unavailable');
            _content.appendChild(meter);
            _meters.set(ns, meter);
        }

        function _onVisibility() {
            _speakerLevels.clear(); _speakerFresh = null; _localOrderAt = 0;
            if (_speakerHint) { _speakerHint.hidden = true; }
            if (_meterFrame) { cancelAnimationFrame(_meterFrame); _meterFrame = 0; }
            if (!document.hidden && _readyState === State.CONNECTED) {
                _meterFrame = requestAnimationFrame(_measure);
            } else if (_this.plugins.Controlbar) {
                _this.plugins.Controlbar.measure({ state: 'unavailable', value: null });
            }
        }

        function _measure(now) {
            _meterFrame = 0;
            if (document.hidden || _readyState !== State.CONNECTED) { return; }
            if (now - _meterAt >= 40) {
                _meterAt = now;
                var visible = _wrapper.getClientRects().length > 0;
                var controlbar = _this.plugins.Controlbar, local = _preview || _calling,
                    localMeasurement = visible && local ? local.measureAudio() : { state: 'unavailable', value: null };
                if (controlbar) {
                    controlbar.measure(controlbar.element().getClientRects().length ? localMeasurement : { state: 'unavailable', value: null });
                }
                if (visible) {
                    _orderSpeakers(now);
                    var layout = _this.layout(), markerRight = ['left', 'top', 'bottom'].includes(layout),
                        markerBottom = ['left', 'right', 'top'].includes(layout),
                        bounds = _content.getBoundingClientRect(), railBounds = _rail.getBoundingClientRect(),
                        floatingRail = layout !== 'grid' && railBounds.width > 0 && railBounds.height > 0,
                        barBounds = markerBottom && controlbar && _wrapper.getAttribute('controls-visible') !== 'false' ? controlbar.element().getBoundingClientRect() : null;
                    _meters.forEach(function (meter, ns) {
                        var element = ns.element(), rect = element.getBoundingClientRect();
                        var clip = _rail.contains(element) && floatingRail ? railBounds : bounds;
                        var left = Math.max(0, bounds.left, clip.left, rect.left), top = Math.max(0, bounds.top, clip.top, rect.top);
                        var right = Math.min(window.innerWidth, bounds.right, clip.right, rect.right), bottom = Math.min(window.innerHeight, bounds.bottom, clip.bottom, rect.bottom);
                        var showing = right - left > 30 && bottom - top > 30;
                        meter.style.display = showing ? '' : 'none';
                        var measurement = showing || _speakerView && _speakerView.source === 'local' ?
                            (ns === local ? localMeasurement : ns.measureAudio()) : { state: 'unavailable', value: null };
                        _measureSpeaker(ns, measurement, now);
                        if (showing) {
                            // All 22px markers use the corner opposite the member rail.
                            // The main video's bottom marker also clears floating controls.
                            var x = markerRight ? right - 30 : left + 8,
                                y = markerBottom ? bottom - 30 : top + 8;
                            if (barBounds && barBounds.height > 0 && _main.contains(element)) {
                                y = Math.max(top + 8, Math.min(y, barBounds.top - 30));
                            }
                            meter.setAttribute('audio-state', measurement.state);
                            meter.style.setProperty('--pe-audio-level', (measurement.value || 0) + '%');
                            meter.style.left = (x - bounds.left) + 'px';
                            meter.style.top = (y - bounds.top) + 'px';
                            meter.title = measurement.state === 'unavailable' ? 'Audio unavailable' :
                                measurement.state === 'muted' ? 'Audio track muted' : 'Audio level';
                        }
                    });
                }
            }
            _meterFrame = requestAnimationFrame(_measure);
        }

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
            var ns = e.srcElement,
                element = ns.element();
            ns.removeEventListener(Event.RELEASE, _onStreamRelease);
            var meter = _meters.get(ns);
            if (meter) { meter.remove(); _meters.delete(ns); }
            _speakerLevels.delete(ns); _localOrderAt = 0;
            _speakerBindings = _speakerBindings.filter(function (binding) { return binding.netStream !== ns; });
            _speakerFresh = null;
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }

            if (ns === _calling) {
                _previewGeneration++;
                _calling = null;
                _inputWanted = { audio: false, video: false }; _inputRevision++;
                _inputControls(false, false);
                _previewControls(false);
                _wrapper.setAttribute('calling', 'off');
                var controlbar = _this.plugins['Controlbar'];
                if (controlbar) {
                    controlbar.state('calling', 'off');
                }
            } else if (ns === _sharing) {
                var tracks = ns.stream() ? ns.stream().getVideoTracks() : [];
                if (tracks.length) {
                    tracks[0].removeEventListener('ended', _onSharingEnded);
                }
                _sharing = null;
                _content.setAttribute('sharing', _speakerBindings.some(function (binding) { return binding.screen; }) ? 'true' : 'false');
                _wrapper.setAttribute('sharing', 'off');
                var controlbar = _this.plugins['Controlbar'];
                if (controlbar) {
                    controlbar.state('sharing', 'off');
                }
            } else if (ns === _preview) {
                _previewGeneration++;
                _preview = null;
                _inputWanted = { audio: false, video: false }; _inputRevision++;
                _inputControls(false, false);
                _previewControls(false);
            } else {
                delete _subscribing[ns.name()];
            }
            _layoutVideos();
        }

        _this.layout = function (state) {
            if (state !== undefined) {
                if (['right', 'bottom', 'left', 'top', 'hidden', 'grid'].indexOf(state) < 0) { throw { name: 'DataError', message: 'Unknown media layout.' }; }
                _wrapper.setAttribute('layout', state);
                _wrapper.setAttribute('thumbnails', state === 'hidden' ? 'hidden' : 'expanded');
                _speakerFresh = null; _localOrderAt = 0;
                _orderSpeakers(performance.now());
                var controlbar = _this.plugins['Controlbar'];
                if (controlbar) {
                    controlbar.state('layout', state);
                }
                _this.resize();
                _this.dispatchEvent(Event.CHANGE, { name: 'layout', value: state });
            }
            return _wrapper.getAttribute('layout');
        };

        // Presentation only: hidden thumbnails retain their streams and audio.
        // Grid always shows all tiles; returning to the main view restores this choice.
        _this.thumbnails = function (state) {
            if (state !== undefined) {
                if (['expanded', 'compact', 'hidden'].indexOf(state) < 0) {
                    throw { name: 'DataError', message: 'Unknown thumbnail presentation.' };
                }
                _wrapper.setAttribute('thumbnails', state);
                _speakerFresh = null; _localOrderAt = 0;
                _orderSpeakers(performance.now());
                _this.resize();
                _this.dispatchEvent(Event.CHANGE, { name: 'thumbnails', value: state });
            }
            return _wrapper.getAttribute('thumbnails') || 'expanded';
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
                    controlbar.state('fullscreen', status ? 'on' : 'off');
                    css.style(controlbar.element(), {
                        'visibility': 'visible',
                    });

                    if (!!status) {
                        if (!controlbar.config.autohide) {
                            _wrapper.setAttribute('controls', 'motion');
                            _wrapper.addEventListener('pointermove', _onMouseMove);
                        }
                    } else {
                        if (!controlbar.config.autohide) {
                            _wrapper.setAttribute('controls', 'always');
                            if (typeof controlbar.visible === 'function') { controlbar.visible(true); }
                            _wrapper.removeEventListener('pointermove', _onMouseMove);
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
                case Event.VISIBILITYCHANGE:
                    var dashboard = _this.plugins['Dashboard'];
                    if (dashboard && e.srcElement === dashboard.components['settings']) {
                        _settingsOpen = e.data.state === 'visible';
                        if (!_settingsOpen) {
                            _settingsGeneration++;
                            var baseline = _settingsBaseline;
                            _settingsBaseline = null;
                            if (baseline) { _previewSettings(baseline).catch(_settingsError); }
                        }
                    }
                    _this.forward(e);
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
                'preview': function () { if (_this.plugins.Controlbar) { _this.plugins.Controlbar.state('preview', _wrapper.getAttribute('preview')); } _this.preview(e.data.state === 'on').catch(function (err) { _onControlError('preview', err); }); },
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
            if (_this.plugins.Controlbar) { _this.plugins.Controlbar.state('microphone', _wrapper.getAttribute('microphone')); }
            try {
                await _this.microphone(e.data.state === 'on');
            } catch (err) {
                _onControlError('microphone', err);
            }
        }

        async function _onCameraClick(e) {
            if (_this.plugins.Controlbar) { _this.plugins.Controlbar.state('camera', _wrapper.getAttribute('camera')); }
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
            if (_this.plugins.Controlbar) { _this.plugins.Controlbar.state('calling', _wrapper.getAttribute('calling')); }
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
            if (_readyState !== State.CONNECTED || err.name === 'AbortError' && err.operation !== 'capture') {
                return;
            }

            var enable = {
                microphone: _constraints.audio !== false,
                camera: _constraints.video !== false,
                sharing: !!_sharing,
                calling: !!_calling,
                preview: _this.preview(),
            }[name];
            _wrapper.setAttribute(name, enable ? 'on' : 'off');
            var controlbar = _this.plugins['Controlbar'];
            if (controlbar) {
                controlbar.state(name, enable ? 'on' : 'off');
            }
            _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message, operation: err.operation });
        }

        function _onChange(e) {
            switch (e.data.name) {
                case 'settings-preview':
                    _previewSettings(e.data.value).catch(_settingsError);
                    break;
                case 'discard':
                    if (_this.plugins.Dashboard) { _this.plugins.Dashboard.hide('settings'); }
                    break;
                case 'save':
                    _saveSettings(e.data.value).catch(function (err) {
                        _settingsError(err);
                    });
                    break;
                default:
                    _this.forward(e);
                    break;
            }
        }

        function _settingsError(error) {
            if (_readyState !== State.CONNECTED || error.name === 'AbortError') { return; }
            var dashboard = _this.plugins['Dashboard'], panel = dashboard && dashboard.components.settings;
            if (panel && _settingsOpen) { panel.feedback(error.message || error.name); }
            _this.dispatchEvent(Event.ERROR, { name: error.name, message: error.message, operation: 'settings', recoverable: true });
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
            if (e && e.pointerType === 'touch') { return; }
            var controlbar = _this.plugins['Controlbar'];
            if (controlbar) {
                if (typeof controlbar.visible === 'function') { controlbar.visible(true); }
                else { css.style(controlbar.element(), { visibility: 'visible' }); }
            }
            _timer.stop();
            if (_wrapper.getAttribute('controls') === 'motion') { _timer.start(); }
        }

        function _onTimer() {
            var controlbar = _this.plugins['Controlbar'];
            if (!controlbar || _wrapper.getAttribute('controls') !== 'motion') { return; }
            if (typeof controlbar.active === 'function' && controlbar.active()) { _onMouseMove(); return; }
            if (typeof controlbar.visible === 'function') { controlbar.visible(false); }
            else { css.style(controlbar.element(), { visibility: 'hidden' }); }
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
            if (_readyState !== State.CONNECTING) {
                return;
            }
            _readyState = State.CONNECTED;
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
            var dashboard = _this.plugins.Dashboard;
            if (!dashboard) { return; }
            if (name !== 'settings') { dashboard.show(name); return; }
            if (_settingsOpen) { dashboard.hide(name); return; }

            var generation = ++_settingsGeneration;
            Promise.all([RTC.getCameras(_logger), RTC.getMicrophones(_logger)]).then(function (devices) {
                if (_readyState !== State.CONNECTED || generation !== _settingsGeneration) { return; }
                var state = _this.settings().read();
                var preferences = utils.extendz({}, state.effective);
                if (_this.config.settingsScope === 'session') {
                    Object.keys(state.effective).forEach(function (key) {
                        if (_this.config[key] !== undefined) { preferences[key] = utils.extendz({}, { value: _this.config[key] }).value; }
                    });
                }
                _settingsVersion = state.version;
                _settingsBaseline = {};
                ['profile', 'camera', 'microphone', 'beauty', 'video', 'codecpreferences'].forEach(function (key) {
                    _settingsBaseline[key] = utils.extendz({}, { value: _this.config[key] === undefined ? state.effective[key] : _this.config[key] }).value;
                });
                dashboard.update('settings', {
                    profile: preferences.profile, camera: preferences.camera, microphone: preferences.microphone,
                    joinAudio: preferences.joinAudio, joinVideo: preferences.joinVideo,
                    joinPreferences: _this.config.joinPreferences === true || _this.config.inputPublishing && _this.config.settingsScope !== 'session',
                    beauty: preferences.beauty, video: preferences.video, codecpreferences: preferences.codecpreferences,
                    cameras: devices[0], microphones: devices[1],
                });
                dashboard.show('settings');
            }).catch(function (err) {
                if (_readyState === State.CONNECTED && generation === _settingsGeneration) {
                    _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message, operation: 'settings', recoverable: true });
                }
            });
        }

        function _previewSettings(settings) {
            var revision = ++_settingsPreviewRevision, values = utils.extendz({}, settings),
                inputs = _inputTask, publishing = _pendingCall && _pendingCall.promise;
            _settingsTask = Promise.all([_settingsTask.catch(function () {}), inputs, publishing]).then(function () {
                if (_readyState !== State.CONNECTED || revision !== _settingsPreviewRevision) { return; }
                return _applySessionSettings(values);
            });
            return _settingsTask;
        }

        function _releasePreview() {
            _previewGeneration++;
            if (_preview) { _preview.close('preview-closed'); }
        }

        async function _saveSettings(settings) {
            if (_settingsApplying) { return; }
            var dashboard = _this.plugins.Dashboard, panel = dashboard && dashboard.components.settings;
            _settingsApplying = true;
            if (panel) { panel.busy(true); }
            try {
                if (_inputTask) { await _inputTask; }
                await _settingsTask.catch(function () {});
                if (_pendingCall) { await _pendingCall.promise; }
                if (_readyState !== State.CONNECTED) { throw { name: 'AbortError', message: 'Session closed.' }; }
                RTC.Encodings.validate(settings.video, settings.codecpreferences);
                await _applySessionSettings(settings);
                var result = { scope: 'session', encodings: 'next-publication' };
                if (_this.config.settingsScope !== 'session') {
                    result = await _this.settings().save(settings, { expectedVersion: _settingsVersion, scope: 'next-session' });
                }
                ['video', 'codecpreferences'].forEach(function (name) {
                    _this.config[name] = utils.extendz({}, { value: settings[name] }).value;
                    _api.config[name] = utils.extendz({}, { value: settings[name] }).value;
                });
                _settingsBaseline = null;
                if (panel) { panel.busy(false); }
                if (dashboard) { dashboard.hide('settings'); }
                _this.dispatchEvent(Event.CHANGE, { name: 'settings-saved', value: result });
            } catch (err) {
                if (panel && _settingsOpen) { panel.feedback(err.message || err.name); }
                throw err;
            } finally {
                _settingsApplying = false;
                if (panel && _readyState === State.CONNECTED) { panel.busy(false); }
            }
        }

        async function _applySessionSettings(settings) {
            RTC.Beauty.parameters(settings.beauty);
            if (!Constraints[settings.profile]) { throw { name: 'DataError', message: 'Invalid quality preset.' }; }
            var ns = _calling || _preview, stream = ns && ns.stream();
            function check() {
                if (_readyState !== State.CONNECTED || ns !== (_calling || _preview)) {
                    throw { name: 'AbortError', message: 'Settings change was cancelled.' };
                }
            }
            check();
            if (stream && stream.getVideoTracks().length) {
                await ns.beauty(settings.beauty.enabled, RTC.Beauty.parameters(settings.beauty));
            }
            check();
            _this.config.beauty = utils.extendz({}, settings.beauty);
            _api.config.beauty = utils.extendz({}, settings.beauty);
            if (ns) { ns.config.beauty = utils.extendz({}, settings.beauty); }
            if (stream && settings.profile !== _this.config.profile) { await ns.setProfile(settings.profile); }
            check();
            _this.config.profile = settings.profile;
            _api.config.profile = settings.profile;
            if (stream && stream.getVideoTracks().some(function (track) { return track.enabled; }) && settings.camera !== _this.config.camera) {
                await ns.setCamera(settings.camera ? { exact: settings.camera } : '');
            }
            check();
            _this.config.camera = settings.camera;
            _api.config.camera = settings.camera;
            if (stream && stream.getAudioTracks().some(function (track) { return track.enabled; }) && settings.microphone !== _this.config.microphone) {
                await ns.setMicrophone(settings.microphone ? { exact: settings.microphone } : '');
            }
            check();
            _this.config.microphone = settings.microphone;
            _api.config.microphone = settings.microphone;
            _constraints = _getConstraints(_this.config);
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
                    display.explain(e.data);
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

        _this.settings = function (value) {
            if (value !== undefined) {
                if (_settingsOwned && _settings) { _settings.destroy(); }
                _settings = value;
                _settingsOwned = false;
                return _settings;
            }
            if (!_this.config) { throw { name: 'InvalidStateError', message: '请先初始化模块。' }; }
            if (!_settings) {
                _settingsOwned = true;
                _settings = new utils.Settings({ module: 'rtc', defaults: _this.config,
                    applyDefaults: function (values) {
                        Object.keys(values).forEach(function (name) {
                            _this.config[name] = utils.extendz({}, { value: values[name] }).value;
                        });
                        ['profile', 'video', 'codecpreferences'].forEach(function (name) {
                            _api.config[name] = utils.extendz({}, { value: values[name] }).value;
                        });
                        _constraints = _getConstraints(_this.config);
                    } });
            }
            return _settings;
        };

        _this.skin = function (value) {
            if (value && typeof value === 'object') { return utils.Skin.apply(_wrapper, value); }
            if (value !== undefined) {
                if (!/^[a-zA-Z0-9_-]+$/.test(value)) { throw { name: 'DataError', message: '无效皮肤名称。' }; }
                _wrapper.classList.remove('pe-ui-' + _this.config.skin);
                _this.config.skin = value;
                _wrapper.classList.add('pe-ui-' + value);
            }
            return _this.config.skin;
        };

        _this.state = function () {
            return _readyState;
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
            if (_settingsOwned && _settings) { _settings.destroy(); }
            switch (_readyState) {
                case State.INITIALIZED:
                case State.CONNECTING:
                case State.CONNECTED:
                    _readyState = State.CLOSING;
                    _settingsOpen = false;
                    _settingsGeneration++;
                    _releasePreview();
                    if (_meterFrame) { cancelAnimationFrame(_meterFrame); _meterFrame = 0; }
                    document.removeEventListener('visibilitychange', _onVisibility);
                    _speakerView = null;
                    _speakerBindings = [];
                    _meters.forEach(function (meter) { meter.remove(); });
                    _meters.clear(); _speakerLevels.clear();

                    _timer.stop();
                    _timer.removeEventListener(TimerEvent.TIMER, _onTimer);

                    document.removeEventListener('mouseup', _onMouseUp);
                    if (_wrapper) {
                        _wrapper.removeEventListener('pointermove', _onMouseMove);
                        _wrapper.removeEventListener('mouseup', _onMouseUp);
                        _wrapper.removeEventListener('mousedown', _onMouseDown);
                    }
                    document.removeEventListener('mousedown', _onMouseDown);

                    document.removeEventListener('fullscreenchange', _onFullscreenChange);
                    document.removeEventListener('webkitfullscreenchange', _onFullscreenChange);
                    document.removeEventListener('mozfullscreenchange', _onFullscreenChange);
                    document.removeEventListener('MSFullscreenChange', _onFullscreenChange);

                    if (_api) {
                        _api.stop();
                    }

                    utils.forEach(_this.plugins, function (_, plugin) {
                        plugin.removeGlobalListener(_onPluginEvent);
                        plugin.destroy();
                    });
                    _this.plugins = {};

                    if (_api) {
                        _api.removeEventListener(Event.BIND, _onBind);
                        _api.removeEventListener(Event.READY, _onReady);
                        _api.removeEventListener(Event.ERROR, _onError);
                        _api.removeEventListener(NetStatusEvent.NETSTATUS, _this.forward);
                        _api.destroy(reason);
                        _api = undefined;
                    }

                    if (_wrapper && _wrapper.parentNode) {
                        _wrapper.parentNode.removeChild(_wrapper);
                    }
                    _readyState = State.CLOSED;
                    delete _instances[_id];
                    break;
            }
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
        var rtc = RTC.create(logger);
        return UI.get(rtc.id(), logger);
    };

    odd.rtc.ui = UI.get;
    odd.rtc.ui.create = UI.create;
    RTC.UI = UI;
})(odd);

