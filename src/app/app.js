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
            READY: 'ready',
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
            _state;

        EventDispatcher.call(this, 'App', { id: id, logger: _logger }, Event, AppEvent);

        function _init() {
            _this.logger = _logger;
            _modules = {};
            _state = State.INITIALIZED;
        }

        _this.id = function () {
            return id;
        };

        _this.setup = function (config) {
            _this.config = utils.extendz({ id: id }, _default, config || {});
            _this.section(_this.config.section);
            _state = State.READY;
            _this.dispatchEvent(Event.BIND);
            _this.dispatchEvent(Event.READY);
            return Promise.resolve();
        };

        _this.section = function (value) {
            if (value !== undefined) {
                if (utils.indexOf(_sections, value) === -1) {
                    throw { name: 'DataError', message: 'Unknown App section: ' + value + '.' };
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
            return _state;
        };

        _this.destroy = function (reason) {
            if (_state === State.CLOSED) {
                return;
            }
            _modules = {};
            _state = State.CLOSED;
            _this.dispatchEvent(Event.CLOSE, { reason: reason });
            delete _instances[id];
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

