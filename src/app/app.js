(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,

        _id = 0,
        _instances = {},
        _sections = ['contacts', 'game', 'live', 'video', 'meeting'],
        _activities = ['game', 'live', 'video', 'meeting'],
        _layouts = ['focus', 'split', 'grid'],
        _State = {
            INITIALIZED: 'initialized',
            READY: 'ready',
            DESTROYED: 'destroyed',
        },
        AppEvent = {
            SECTION_CHANGE: 'app-section-change',
            ACTIVITY_CHANGE: 'app-activity-change',
            LAYOUT_CHANGE: 'app-layout-change',
            SIDEBAR_CHANGE: 'app-sidebar-change',
            FULLPAGE_CHANGE: 'app-fullpage-change',
            FULLSCREEN_CHANGE: 'app-fullscreen-change',
            SKIN_CHANGE: 'app-skin-change',
            ACTION: 'app-action',
        },
        _default = {
            section: 'contacts',
            activity: 'game',
            layout: 'focus',
            skin: 'classic',
            rightCollapsed: false,
            fullpage: false,
            fullscreen: false,
            autoHide: 2600,
            maxMessageLength: 500,
            adapters: {},
            mounts: {},
            keyboard: {
                ArrowUp: 'up',
                KeyW: 'up',
                ArrowDown: 'down',
                KeyS: 'down',
                ArrowLeft: 'left',
                KeyA: 'left',
                ArrowRight: 'right',
                KeyD: 'right',
                KeyU: 'select',
                ShiftLeft: 'select',
                ShiftRight: 'select',
                KeyI: 'start',
                Enter: 'start',
                KeyJ: 'b',
                KeyK: 'a',
            },
        };

    events.AppEvent = AppEvent;

    function App(id, logger) {
        var _this = this,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger(id, logger),
            _state = _State.INITIALIZED,
            _section,
            _activity,
            _layout,
            _rightCollapsed,
            _fullpage,
            _fullscreen,
            _skin,
            _modules;

        EventDispatcher.call(this, 'App', { id: id, logger: _logger }, Event, AppEvent);

        function _init() {
            _this.id = id;
            _this.logger = _logger;
            _modules = {};
        }

        _this.setup = function (config) {
            if (_state === _State.DESTROYED) {
                return Promise.reject(_error('InvalidStateError', 'The App instance has been destroyed.'));
            }
            if (_state === _State.READY) {
                return Promise.resolve(_this);
            }

            _this.config = utils.extendz({ id: id }, _default, config || {});
            _section = _valid(_this.config.section, _sections, 'section');
            _activity = _valid(_this.config.activity, _activities, 'activity');
            _layout = _valid(_this.config.layout, _layouts, 'layout');
            _rightCollapsed = !!_this.config.rightCollapsed;
            _fullpage = !!_this.config.fullpage;
            _fullscreen = !!_this.config.fullscreen;
            _skin = _this.config.skin || _default.skin;
            if (_fullscreen) {
                _fullpage = false;
            }
            if (_section !== 'contacts') {
                _activity = _section;
            }

            _syncConfig();
            _state = _State.READY;
            _this.dispatchEvent(Event.BIND);
            _this.dispatchEvent(Event.READY);
            return Promise.resolve(_this);
        };

        function _valid(value, values, name) {
            if (utils.indexOf(values, value) === -1) {
                throw _error('DataError', 'Unknown App ' + name + ': ' + value + '.');
            }
            return value;
        }

        function _error(name, message, detail) {
            var err = new Error(message);
            err.name = name;
            err.detail = detail;
            return err;
        }

        function _ready() {
            if (_state !== _State.READY) {
                throw _error('InvalidStateError', 'The App instance is not ready.');
            }
        }

        function _change(type, name, value) {
            _ready();
            var previous;
            switch (name) {
                case 'section':
                    value = _valid(value, _sections, name);
                    previous = _section;
                    if (value !== 'contacts') {
                        _this.activity(value);
                    }
                    _section = value;
                    break;
                case 'activity':
                    value = _valid(value, _activities, name);
                    previous = _activity;
                    _activity = value;
                    break;
                case 'layout':
                    value = _valid(value, _layouts, name);
                    previous = _layout;
                    _layout = value;
                    break;
                case 'rightCollapsed':
                    value = !!value;
                    previous = _rightCollapsed;
                    _rightCollapsed = value;
                    break;
                case 'fullpage':
                    value = !!value;
                    previous = _fullpage;
                    if (value && _fullscreen) {
                        _this.fullscreen(false);
                    }
                    _fullpage = value;
                    break;
                case 'fullscreen':
                    value = !!value;
                    previous = _fullscreen;
                    if (value && _fullpage) {
                        _this.fullpage(false);
                    }
                    _fullscreen = value;
                    break;
                case 'skin':
                    if (!value || utils.typeOf(value) !== 'string') {
                        throw _error('DataError', 'App skin must be a non-empty string.');
                    }
                    previous = _skin;
                    _skin = value;
                    break;
            }
            _syncConfig();
            if (previous !== value) {
                _this.dispatchEvent(type, { name: name, value: value, previous: previous });
            }
            return value;
        }

        function _syncConfig() {
            if (!_this.config) {
                return;
            }
            _this.config.section = _section;
            _this.config.activity = _activity;
            _this.config.layout = _layout;
            _this.config.rightCollapsed = _rightCollapsed;
            _this.config.fullpage = _fullpage;
            _this.config.fullscreen = _fullscreen;
            _this.config.skin = _skin;
        }

        _this.section = function (value) {
            if (value !== undefined) {
                return _change(AppEvent.SECTION_CHANGE, 'section', value);
            }
            return _section;
        };

        _this.activity = function (value) {
            if (value !== undefined) {
                return _change(AppEvent.ACTIVITY_CHANGE, 'activity', value);
            }
            return _activity;
        };

        _this.layout = function (value) {
            if (value !== undefined) {
                return _change(AppEvent.LAYOUT_CHANGE, 'layout', value);
            }
            return _layout;
        };

        _this.rightCollapsed = function (value) {
            if (value !== undefined) {
                return _change(AppEvent.SIDEBAR_CHANGE, 'rightCollapsed', value);
            }
            return _rightCollapsed;
        };

        _this.fullpage = function (value) {
            if (value !== undefined) {
                return _change(AppEvent.FULLPAGE_CHANGE, 'fullpage', value);
            }
            return _fullpage;
        };

        _this.fullscreen = function (value) {
            if (value !== undefined) {
                return _change(AppEvent.FULLSCREEN_CHANGE, 'fullscreen', value);
            }
            return _fullscreen;
        };

        _this.skin = function (value) {
            if (value !== undefined) {
                return _change(AppEvent.SKIN_CHANGE, 'skin', value);
            }
            return _skin;
        };

        _this.adapter = function (domain) {
            _ready();
            return _this.config.adapters[domain];
        };

        _this.module = function (domain, instance) {
            _ready();
            if (instance !== undefined) {
                _modules[domain] = instance;
            }
            return _modules[domain];
        };

        _this.modules = function () {
            _ready();
            return _modules;
        };

        _this.invoke = function (domain, action, data) {
            try {
                _ready();
                var adapter = _this.config.adapters[domain],
                    module = _modules[domain],
                    handler;
                if (utils.typeOf(adapter) === 'function') {
                    handler = adapter;
                } else if (adapter) {
                    handler = utils.typeOf(adapter[action]) === 'function' ? adapter[action] : adapter.invoke;
                }
                if (utils.typeOf(handler) !== 'function' && module) {
                    handler = utils.typeOf(module.invoke) === 'function' ? module.invoke : module[action];
                    adapter = module;
                }

                _this.dispatchEvent(AppEvent.ACTION, {
                    domain: domain,
                    action: action,
                    data: data || {},
                    handled: utils.typeOf(handler) === 'function',
                });
                if (utils.typeOf(handler) !== 'function') {
                    return Promise.resolve();
                }

                return Promise.resolve(handler.call(adapter, data || {}, action, _this)).catch(function (err) {
                    _onAdapterError(domain, action, err);
                    return Promise.reject(err);
                });
            } catch (err) {
                _onAdapterError(domain, action, err);
                return Promise.reject(err);
            }
        };

        function _onAdapterError(domain, action, err) {
            if (!(err instanceof Error)) {
                err = _error('Error', err ? String(err) : 'Unknown adapter error.');
            }
            _logger.error('App adapter failed: domain=' + domain + ', action=' + action + ', error=' + err.message);
            _this.dispatchEvent(Event.ERROR, {
                name: err.name || 'Error',
                message: err.message || String(err),
                detail: {
                    domain: domain,
                    action: action,
                    cause: err.detail,
                },
            });
        }

        _this.state = function () {
            return _state;
        };

        _this.destroy = function (reason) {
            if (_state === _State.DESTROYED) {
                return;
            }
            _state = _State.DESTROYED;
            _modules = {};
            _this.dispatchEvent(Event.CLOSE, { reason: reason || 'destroy' });
            delete _instances[id];
        };

        _init();
    }

    App.prototype = Object.create(EventDispatcher.prototype);
    App.prototype.constructor = App;
    App.prototype.CONF = _default;

    App.State = _State;
    App.Event = AppEvent;
    App.sections = function () {
        return _sections.slice(0);
    };
    App.activities = function () {
        return _activities.slice(0);
    };

    App.get = function (id, logger) {
        if (id === null || id === undefined) {
            id = 0;
        }
        var app = _instances[id];
        if (app === undefined) {
            app = new App(id, logger);
            _instances[id] = app;
        }
        return app;
    };

    App.create = function (logger) {
        return App.get(_id++, logger);
    };

    odd.app = App.get;
    odd.app.create = App.create;
    odd.App = App;
})(odd);
