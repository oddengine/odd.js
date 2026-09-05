(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        IM = odd.IM,
        UI = IM.UI,
        components = UI.components,

        CLASS_DASHBOARD = 'im-dashboard',
        _regi = /\[([a-z]+)\:([a-z]+)=([^\]]*)\]/gi,
        _default = {
            kind: 'Dashboard',
            tab: 'dashboard',
            layout: '[Settings:settings=]',
            visibility: true,
        };

    function Dashboard(im, config, logger) {
        EventDispatcher.call(this, 'Dashboard', { logger: logger }, Event);

        var _this = this,
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
                var component = new components[arr[1]](arr[2], arr[3], logger);
                component.addGlobalListener(_this.forward);
                _container.appendChild(component.element());
                _this.components[arr[2]] = component;
            }
        }

        _this.update = function (name, data) {
            var component = _this.components[name];
            if (component) {
                component.update(data);
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

