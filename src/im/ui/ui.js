(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        NetStatusEvent = events.NetStatusEvent,
        UIEvent = events.UIEvent,
        MouseEvent = events.MouseEvent,
        IM = odd.IM,

        CLASS_WRAPPER = 'im-wrapper',

        _id = 0,
        _instances = {},
        _default = {
            presentation: 'full',
            skin: 'classic',
            plugins: [],
        };

    function UI(id, logger) {
        var _this = this,
            _id = id,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger(id, logger),
            _container,
            _wrapper,
            _nav,
            _pages,
            _tabs,
            _homes,
            _api;

        EventDispatcher.call(this, 'UI', { id: id, logger: _logger }, Event, NetStatusEvent, UIEvent, MouseEvent);

        function _init() {
            _this.logger = _logger;
            _this.plugins = {};
            _pages = {};
            _tabs = {};
            _homes = {};
        }

        _this.id = function () {
            return _id;
        };

        _this.setup = async function (container, config) {
            _container = container;
            _parseConfig(config);

            _nav = new UI.components.Tab('nav', 'Tab', _logger);
            _nav.addGlobalListener(_this.forward);

            _wrapper = utils.createElement('div', CLASS_WRAPPER + ' im-ui-' + _this.config.skin);
            _wrapper.setAttribute('presentation', _normalizePresentation(_this.config.presentation));
            _wrapper.appendChild(_nav.element());
            _container.appendChild(_wrapper);

            _api = IM.get(_id, _logger);
            _api.addEventListener(Event.BIND, _onBind);
            _api.addEventListener(Event.READY, _onReady);
            _api.addEventListener(NetStatusEvent.NETSTATUS, _onStatus);
            _api.addEventListener(Event.CLOSE, _onClose);

            _buildPlugins();
            _setupPlugins();
            _this.resize();

            window.addEventListener('resize', _this.resize);
            return _api.setup(_this.config);
        };

        function _onBind(e) {
            _this.config = _api.config;
            _this.client = _api.client;
            _this.connected = _api.connected;
            _this.join = _api.join;
            _this.leave = _api.leave;
            _this.chmod = _api.chmod;
            _this.invoke = _api.invoke;
            _this.quit = _api.quit;
            _this.send = _api.send;
            _this.sendStatus = _api.sendStatus;
            _this.call = _api.call;
            _this.state = _api.state;
            _this.forward(e);
        }

        function _onReady(e) {
            _onStateChange(e);
        }

        function _parseConfig(config) {
            config = config || {};
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
                            index: _nav.insert(tab, config.label || '', content),
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
            if (e.data.name === 'contact' || e.data.name === 'conversation') {
                var conversation = _this.plugins['Conversation'];
                if (conversation) {
                    conversation.active(e.data.id, e.data.contact || e.data.conversation);
                    if (_this.plugins['Conversations']) {
                        _this.plugins['Conversations'].active(e.data.id);
                    }
                    _nav.active(_pages['Conversation']);
                }
            }
            _this.forward(e);
        }

        function _onChange(e) {
            _this.forward(e);
        }

        function _onClose(e) {
            _logger.log(`IM.onClose: ${e.data.reason}`);
            _this.forward(e);
        }

        function _onStateChange(e) {
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

        _this.skin = function (value) {
            if (value !== undefined) {
                _this.config.skin = value;
                _wrapper.className = CLASS_WRAPPER + ' im-ui-' + value;
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

        _this.insert = function (name, selector, content, option) {
            if (!content || !content.nodeType) {
                throw { name: 'DataError', message: 'IM UI tab content must be a DOM element.' };
            }
            var index = _nav.insert(name, selector || '', content, option);
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
            var width = _wrapper.clientWidth;
            var height = _wrapper.clientHeight;

            utils.forEach(_this.plugins, function (kind, plugin) {
                plugin.resize(width, height);
            });

            _this.dispatchEvent(UIEvent.RESIZE, { width: width, height: height });
        };

        _this.destroy = function (reason) {
            window.removeEventListener('resize', _this.resize);
            if (_nav) {
                _nav.removeGlobalListener(_this.forward);
            }

            utils.forEach(_this.plugins, function (_, plugin) {
                plugin.removeGlobalListener(_onPluginEvent);
                plugin.destroy();
            });
            _this.plugins = {};

            if (_api) {
                _api.destroy(reason);
                _api.removeEventListener(Event.BIND, _onBind);
                _api.removeEventListener(Event.READY, _onReady);
                _api.removeEventListener(NetStatusEvent.NETSTATUS, _this.forward);
                _api.removeEventListener(Event.CLOSE, _onClose);
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
            console.error('Failed to register plugin ' + plugin.prototype.kind + ', Error=' + err.message);
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

