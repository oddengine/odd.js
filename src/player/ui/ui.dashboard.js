(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        Player = odd.Player,
        UI = Player.UI,
        components = UI.components,

        CLASS_DASHBOARD = 'pe-dashboard',

        _regi = /\[([a-z]+)\:([a-z]+)=([^\]]*)\]/gi,
        _default = {
            kind: 'Dashboard',
            layout: '[Panel:info=][Panel:stats=][Settings:settings=]',
            visibility: true,
        };

    function Dashboard(config, logger) {
        EventDispatcher.call(this, 'Dashboard', { logger: logger }, Event);

        var _this = this,
            _logger = logger,
            _container;

        function _init() {
            _this.config = config;
            _this.components = {};

            _container = utils.createElement('div', CLASS_DASHBOARD);
            _buildComponents();
        }

        function _buildComponents() {
            var arr;
            while ((arr = _regi.exec(_this.config.layout)) !== null) {
                try {
                    var component = new components[arr[1]](arr[2], arr[3], _logger);
                    component.addGlobalListener(_this.forward);
                    _container.appendChild(component.element());
                    _this.components[arr[2]] = component;
                } catch (err) {
                    _logger.error('Failed to build component: type=' + arr[1] + ', name=' + arr[2] + ', error=' + err.message);
                }
            }
        }

        _this.update = function (name, data) {
            var component = _this.components[name];
            if (component) {
                component.update(data);
            }
        };

        _this.clear = function (name) {
            var component = _this.components[name];
            if (component && utils.typeOf(component.clear) === 'function') {
                component.clear();
            }
        };

        _this.show = function (name) {
            utils.forEach(_this.components, function (key, component) {
                if (key !== name) {
                    component.hide();
                }
            });
            var component = _this.components[name];
            if (component) {
                component.show();
            }
        };

        _this.hide = function (name) {
            var component = _this.components[name];
            if (component) {
                component.hide();
            }
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {
            utils.forEach(_this.components, function (_, component) {
                component.resize(width, height);
            });
        };

        _this.destroy = function () {
            utils.forEach(_this.components, function (_, component) {
                component.removeGlobalListener(_this.forward);
                component.destroy();
            });
            _this.components = {};
            _container.innerHTML = '';
        };

        _init();
    }

    Dashboard.prototype = Object.create(EventDispatcher.prototype);
    Dashboard.prototype.constructor = Dashboard;
    Dashboard.prototype.kind = 'Dashboard';
    Dashboard.prototype.CONF = _default;

    UI.register(Dashboard);
})(odd);

