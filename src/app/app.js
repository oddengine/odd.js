(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,

        _id = 0,
        _instances = {},
        _sections = ['contacts', 'messages', 'play', 'game', 'meeting'],
        State = {
            INITIALIZED: 'initialized',
            CONNECTING: 'connecting',
            READY: 'ready',
            CLOSING: 'closing',
            CLOSED: 'closed',
        },
        AppEvent = {
            SECTION_CHANGE: 'app-section-change',
            SKIN_CHANGE: 'app-skin-change',
        },
        _default = {
            section: 'messages',
            skin: 'classic',
            modules: {},
        };

    events.AppEvent = AppEvent;

    function App(id, logger) {
        var _this = this,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger(id, logger),
            _modules,
            _readyState;

        EventDispatcher.call(this, 'App', { id: id, logger: _logger }, Event, AppEvent);

        function _init() {
            _this.logger = _logger;
            _modules = {};
            _readyState = State.INITIALIZED;
        }

        _this.id = function () {
            return id;
        };

        _this.setup = function (config) {
            if (_readyState === State.CLOSING || _readyState === State.CLOSED) {
                return Promise.reject({ name: 'InvalidStateError', message: 'App cannot be setup in state ' + _readyState + '.' });
            }

            _this.config = utils.extendz({ id: id }, _default, config || {});
            if (utils.indexOf(_sections, _this.config.section) === -1) {
                _logger.error('Unknown App section: ' + _this.config.section + '.');
                _this.config.section = _default.section;
            }
            _readyState = State.READY;
            _this.dispatchEvent(Event.BIND);
            if (_readyState === State.READY) {
                _this.dispatchEvent(Event.READY);
            }
            return Promise.resolve();
        };

        _this.section = function (value) {
            if (value !== undefined) {
                if (utils.indexOf(_sections, value) === -1) {
                    _logger.error('Unknown App section: ' + value + '.');
                    return _this.config && _this.config.section;
                }
                var previous = _this.config && _this.config.section;
                if (_this.config) {
                    _this.config.section = value;
                }
                if (previous !== value) {
                    _this.dispatchEvent(AppEvent.SECTION_CHANGE, { value: value, previous: previous });
                }
            }
            return _this.config && _this.config.section;
        };

        _this.skin = function (value) {
            if (value !== undefined) {
                var previous = _this.config.skin;
                _this.config.skin = value;
                if (previous !== value) {
                    _this.dispatchEvent(AppEvent.SKIN_CHANGE, { value: value, previous: previous });
                }
            }
            return _this.config.skin;
        };

        _this.module = function (name, module) {
            if (module !== undefined) {
                _modules[name] = module;
            }
            return _modules[name];
        };

        _this.modules = function () {
            return _modules;
        };

        _this.state = function () {
            return _readyState;
        };

        _this.destroy = function (reason) {
            switch (_readyState) {
                case State.INITIALIZED:
                case State.READY:
                    _readyState = State.CLOSING;
                    _modules = {};
                    delete _instances[id];

                    _this.dispatchEvent(Event.CLOSE, { reason: reason });
                    _readyState = State.CLOSED;
                    break;
            }
        };

        _init();
    }

    App.prototype = Object.create(EventDispatcher.prototype);
    App.prototype.constructor = App;
    App.prototype.CONF = _default;

    App.State = State;
    App.Event = AppEvent;
    App.sections = function () {
        return _sections.slice(0);
    };

    App.get = function (id, logger) {
        if (id == null) {
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

