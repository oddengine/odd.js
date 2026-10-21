(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        NetStatusEvent = events.NetStatusEvent,
        UIEvent = events.UIEvent,
        MouseEvent = events.MouseEvent,
        IMEvent = events.IMEvent,
        IM = odd.IM,
        State = IM.State,

        CLASS_WRAPPER = 'im-wrapper',

        _id = 0,
        _instances = {},
        _default = {
            presentation: 'full',
            skin: 'classic',
            user: {
                name: '',
                avatar: '',
            },
            labels: {
                contacts: 'Contacts',
                messages: 'Messages',
                dashboard: 'Settings',
            },
            rtc: {
                profile: '180P_1',
                camera: true,
                microphone: true,
            },
            storageFactory: function (identity) {
                return new IM.IndexedDB(identity.appId, identity.userId, identity.deviceId);
            },
            plugins: [],
        };

    function UI(id, logger) {
        var _this = this,
            _id = id,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger(id, logger),
            _container,
            _wrapper,
            _settings,
            _avatar,
            _nav,
            _pages,
            _tabs,
            _homes,
            _api,
            _ownsInstance = true,
            _borrowedInstance = false,
            _calls,
            _readyState;

        EventDispatcher.call(this, 'UI', { id: id, logger: _logger }, Event, NetStatusEvent, UIEvent, MouseEvent, IMEvent);

        function _init() {
            _this.logger = _logger;
            _this.plugins = {};
            _pages = {};
            _tabs = {};
            _homes = {};
            _readyState = State.INITIALIZED;
        }

        _this.id = function () {
            return _id;
        };

        _this.setup = async function (container, config) {
            if (_readyState !== State.INITIALIZED) {
                return Promise.reject({ name: 'InvalidStateError', message: 'IM UI cannot be setup in state ' + _readyState + '.' });
            }
            _readyState = State.CONNECTING;

            _container = container;
            var borrowed = config && config.instance;
            if (borrowed && (typeof borrowed.connected !== 'function' || !borrowed.connected())) {
                _readyState = State.INITIALIZED;
                throw { name: 'InvalidStateError', message: '借用的 IM 实例必须已经连接。' };
            }
            _ownsInstance = !borrowed || config.ownsInstance === true;
            _borrowedInstance = !!borrowed;
            _parseConfig(config);

            _nav = new UI.components.Tab('nav', 'Tab', _logger);
            _nav.addGlobalListener(_this.forward);

            _wrapper = utils.createElement('div', CLASS_WRAPPER + ' im-ui-' + _this.config.skin);
            _wrapper.setAttribute('presentation', _normalizePresentation(_this.config.presentation));

            var profile = utils.createElement('div', 'im-profile');
            _avatar = new UI.components.Avatar('self', utils.extendz({}, _this.config.user, { online: false }), _logger);
            profile.appendChild(_avatar.element());
            _wrapper.appendChild(profile);
            _wrapper.appendChild(_nav.element());
            _container.appendChild(_wrapper);

            _api = borrowed || IM.get(_id, _logger);
            _api.addEventListener(Event.BIND, _onBind);
            _api.addEventListener(Event.READY, _onReady);
            _api.addEventListener(NetStatusEvent.NETSTATUS, _this.forward);
            _api.addEventListener(IMEvent.NOTIFY, _this.forward);
            _api.addEventListener(IMEvent.MESSAGE, _this.forward);
            _api.addEventListener(Event.ERROR, _this.forward);
            _api.addEventListener(Event.CLOSE, _onClose);

            if (_this.config.calls && _this.config.calls.enabled) {
                if (!UI.CallPanel) { throw new Error('Load the call UI module.'); }
                _calls = new UI.CallPanel(_api, _this.config.calls);
                _wrapper.appendChild(_calls.element());
            }
            _buildPlugins();
            _setupPlugins();
            _readyState = State.CONNECTED;
            _this.resize();
            if (_readyState !== State.CONNECTED) {
                return;
            }

            window.addEventListener('resize', _this.resize);
            if (borrowed) {
                _onBind({ type: Event.BIND, data: {}, srcElement: _api });
                _onReady({ type: Event.READY, data: {}, srcElement: _api });
                return;
            }
            return _api.setup(_this.config);
        };

        function _onBind(e) {
            if (!_borrowedInstance) { _this.config = _api.config; }
            _this.userId = _api.userId;
            _this.connected = _api.connected;
            _this.subscribe = _api.subscribe;
            _this.unsubscribe = _api.unsubscribe;
            _this.refresh = _api.refresh;
            _this.send = _api.send;
            _this.call = _api.call;
            _this.calls = _api.calls;
            _this.resolve = _api.resolve;
            _this.storage = _api.storage;
            _this.recover = _api.recover;
            _this.read = _api.read;
            _this.request = _api.request;
            _this.reauth = _api.reauth;
            _this.state = _api.state;
            _this.forward(e);
        }

        function _onReady(e) {
            _onStateChange(e);
        }

        function _parseConfig(config) {
            var source = config || {};
            config = {};
            Object.keys(source).forEach(function (key) { if (key !== 'instance') { config[key] = source[key]; } });
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

            _this.config = utils.extendz({ id: _id }, IM.prototype.CONF, _default, config);
            _this.config.plugins = plugins;
        }

        function _normalizePresentation(value) {
            value = value || 'full';
            if (utils.indexOf(['full', 'mini', 'popup'], value) === -1) {
                throw { name: 'DataError', message: 'Unknown IM UI presentation: ' + value + '.' };
            }
            return value;
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
                    var plugin = new UI[config.kind](_api, config, _logger);
                    if (utils.typeOf(plugin.addGlobalListener) === 'function') {
                        plugin.addGlobalListener(_onPluginEvent);
                    }
                    var tab = config.tab || config.kind.toLowerCase(),
                        page = _tabs[tab];
                    if (!page) {
                        var content = utils.createElement('div', 'im-plugins im-plugins-' + tab);
                        page = {
                            content: content,
                            index: _nav.insert(tab, content, { title: _this.config.labels[tab] || tab }),
                        };
                        _tabs[tab] = page;
                    }
                    page.content.appendChild(plugin.element());
                    _this.plugins[config.kind] = plugin;
                    _pages[config.kind] = page.index;
                    _homes[config.kind] = page.content;
                } catch (err) {
                    _logger.error('Failed to initialize plugin: index=' + i + ', kind=' + config.kind + '. Error=' + err.message);
                }
            });
        }

        function _setupPlugins() {
            var dashboard = _this.plugins['Dashboard'];
            if (dashboard) {
                dashboard.update('settings', _this.config.rtc);
                dashboard.show('settings');
            }

            _wrapper.setAttribute('state', '');
            _wrapper.setAttribute('navigation', _nav.length() > 1 ? 'on' : 'off');
        }

        function _onPluginEvent(e) {
            switch (e.type) {
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

        function _onClick(e) {
            var h = {
                'voice-call': function () { _startCall('audio'); },
                'video-call': function () { _startCall('video'); },
                'contact': function () { _onConversationClick(e); },
                'conversation': function () { _onConversationClick(e); },
            }[e.data.name];
            if (h) {
                h();
            } else {
                _this.forward(e);
            }
        }

        function _startCall(mode) {
            var conversation = _this.plugins['Conversation'];
            if (!_calls || !conversation || !conversation.target()) {
                _this.dispatchEvent(Event.ERROR, { name: 'NotSupportedError', message: 'Calls is unavailable for this conversation.' });
                return;
            }
            Promise.resolve().then(function () { return _calls.invite(conversation.target(), mode); }).catch(function (reason) {
                _this.dispatchEvent(Event.ERROR, { name: reason.name, message: reason.message });
            });
        }

        function _onConversationClick(e) {
            var data = e.data.data,
                conversation = _this.plugins['Conversation'],
                conversations = _this.plugins['Conversations'],
                contacts = _this.plugins['Contacts'];
            if (!data || !conversation) {
                return;
            }

            conversation.active(data.id, data);
            if (contacts) {
                contacts.active(data.id);
            }
            if (conversations) {
                if (e.data.name === 'contact') {
                    conversations.add(data.id, data.type, data.name, data.avatar);
                }
                conversations.active(data.id);
            }
            _nav.active(_pages['Conversation']);
        }

        function _onChange(e) {
            var directory = _this.plugins['Conversations'];
            if (directory && (e.data.name === 'messages-read' || e.data.name === 'conversation-resolved')) {
                directory.refresh(e.data.conversationId);
            }
            var dashboard = _this.plugins['Dashboard'];
            if (dashboard && e.srcElement === dashboard.components['settings']) {
                switch (e.data.name) {
                    case 'profile':
                    case 'camera':
                    case 'microphone':
                        var change = {};
                        change[e.data.name] = e.data.value;
                        var settings = _this.settings();
                        settings.save(change, { expectedVersion: settings.read().version, scope: 'next-session' }).catch(function (reason) {
                            _this.dispatchEvent(Event.ERROR, { name: reason.name, message: reason.message });
                        });
                        break;
                }
            }
            _this.forward(e);
        }

        function _onClose(e) {
            _logger.log(`IM.onClose: ${e.data.reason}`);
            if (_readyState === State.CLOSING) {
                _this.forward(e);
                return;
            }
            _onStateChange(e);
        }

        function _onStateChange(e) {
            if (_readyState !== State.CONNECTED) {
                return;
            }

            if (e.type === Event.READY) {
                _avatar.update(utils.extendz({ id: _api.userId() }, _this.config.user, { online: _api.connected() }));
            } else {
                _avatar.state('offline');
            }
            _wrapper.setAttribute('state', e.type);

            _this.resize();
            _this.forward(e);
        }

        _this.presentation = function (value) {
            if (value === undefined) {
                return _wrapper && _wrapper.getAttribute('presentation');
            }
            value = _normalizePresentation(value);
            _this.config.presentation = value;
            _wrapper.setAttribute('presentation', value);
            _this.resize();
            return value;
        };

        _this.settings = function () {
            if (!_this.config) { throw { name: 'InvalidStateError', message: '请先初始化模块。' }; }
            if (!_settings) {
                _settings = new utils.Settings({ module: 'im', defaults: _this.config.rtc,
                    applyDefaults: function (values) { _this.config.rtc = utils.extendz({}, _this.config.rtc || {}, values); } });
            }
            return _settings;
        };

        _this.skin = function (value) {
            if (value && typeof value === 'object') { return utils.Skin.apply(_wrapper, value); }
            if (value !== undefined) {
                if (!/^[a-zA-Z0-9_-]+$/.test(value)) { throw { name: 'DataError', message: '无效皮肤名称。' }; }
                _wrapper.classList.remove('im-ui-' + _this.config.skin);
                _this.config.skin = value;
                _wrapper.classList.add('im-ui-' + value);
            }
            return _this.config.skin;
        };

        _this.attach = function (container, presentation) {
            if (!container || !container.appendChild) {
                throw { name: 'DataError', message: 'IM UI attach requires a DOM container.' };
            }
            if (!_wrapper) {
                throw { name: 'InvalidStateError', message: 'IM UI must be setup before attach.' };
            }
            _container = container;
            _container.appendChild(_wrapper);
            _this.presentation(presentation || _this.presentation() || 'full');
            return _this;
        };

        _this.attachPlugin = function (kind, container, presentation) {
            var plugin = _this.plugins[kind];
            if (!plugin) {
                throw { name: 'NotFoundError', message: 'IM UI plugin not found: ' + kind + '.' };
            }
            if (!container || !container.appendChild) {
                throw { name: 'DataError', message: 'IM UI plugin attach requires a DOM container.' };
            }
            container.appendChild(plugin.element());
            if (plugin.presentation) {
                plugin.presentation(presentation || 'full');
            }
            _this.resize();
            return plugin;
        };

        _this.restorePlugin = function (kind, presentation) {
            var home = _homes[kind];
            if (!home) {
                throw { name: 'NotFoundError', message: 'IM UI plugin home not found: ' + kind + '.' };
            }
            return _this.attachPlugin(kind, home, presentation || 'full');
        };

        _this.insert = function (name, content, option) {
            if (!content || !content.nodeType) {
                throw { name: 'DataError', message: 'IM UI tab content must be a DOM element.' };
            }
            option = utils.extendz({ title: _this.config.labels[name] || name }, option);
            var index = _nav.insert(name, content, option);
            _tabs[name] = { content: content, index: index };
            _wrapper.setAttribute('navigation', _nav.length() > 1 ? 'on' : 'off');
            return index;
        };

        _this.active = function (value) {
            if (value !== undefined) {
                _nav.active(value);
            }
            return _nav.name();
        };

        _this.page = function (value) {
            return _nav.page(value);
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function () {
            if (!_wrapper || _readyState === State.CLOSING || _readyState === State.CLOSED) {
                return;
            }

            var width = _wrapper.clientWidth;
            var height = _wrapper.clientHeight;

            utils.forEach(_this.plugins, function (kind, plugin) {
                plugin.resize(width, height);
            });

            _this.dispatchEvent(UIEvent.RESIZE, { width: width, height: height });
        };

        _this.destroy = function (reason) {
            if (_settings) { _settings.destroy(); }
            switch (_readyState) {
                case State.INITIALIZED:
                case State.CONNECTING:
                case State.CONNECTED:
                    _readyState = State.CLOSING;

                    window.removeEventListener('resize', _this.resize);
                    if (_nav) {
                        _nav.removeGlobalListener(_this.forward);
                    }

                    utils.forEach(_this.plugins, function (_, plugin) {
                        plugin.removeGlobalListener(_onPluginEvent);
                        plugin.destroy();
                    });
                    _this.plugins = {};
                    if (_calls) { _calls.destroy(); _calls = null; }

                    if (_api) {
                        _api.removeEventListener(Event.BIND, _onBind);
                        _api.removeEventListener(Event.READY, _onReady);
                        _api.removeEventListener(NetStatusEvent.NETSTATUS, _this.forward);
                        _api.removeEventListener(Event.ERROR, _this.forward);
                        _api.removeEventListener(IMEvent.NOTIFY, _this.forward);
                        _api.removeEventListener(IMEvent.MESSAGE, _this.forward);
                    }

                    if (_nav) {
                        _nav.destroy();
                    }
                    if (_avatar) {
                        _avatar.destroy();
                    }
                    if (_wrapper && _wrapper.parentNode) {
                        _wrapper.parentNode.removeChild(_wrapper);
                    }
                    delete _instances[_id];

                    if (_api) {
                        if (_ownsInstance) { _api.destroy(reason); }
                        _api.removeEventListener(Event.CLOSE, _onClose);
                        _api = undefined;
                    }
                    _readyState = State.CLOSED;
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
        if (ui === undefined) {
            ui = new UI(id, logger);
            _instances[id] = ui;
        }
        return ui;
    };

    UI.create = function (logger) {
        return UI.get(_id++, logger);
    };

    odd.im.ui = UI.get;
    odd.im.ui.create = UI.create;
    IM.UI = UI;
})(odd);

