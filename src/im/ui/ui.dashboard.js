(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        IM = odd.IM,
        UI = IM.UI,
        components = UI.components,

        CLASS_DASHBOARD = 'im-dashboard',
        _regi = /\[([a-z]+)\:([a-z]+)=([^\]]+)?\]/gi,
        _default = {
            kind: 'Dashboard',
            tab: 'dashboard',
            label: '设置',
            layout: '[Settings:settings=]',
            settings: {
                items: [],
            },
            visibility: true,
        };

    function Dashboard(im, config, logger) {
        EventDispatcher.call(this, 'Dashboard', { logger: logger });

        var _this = this,
            _container;

        function _init() {
            _this.config = config;
            _this.components = {};
            _container = utils.createElement('div', CLASS_DASHBOARD);
            _buildComponents();
            var settings = _this.components['settings'];
            if (settings) {
                settings.update(config.settings);
            }
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
        };

        _init();
    }

    Dashboard.prototype = Object.create(EventDispatcher.prototype);
    Dashboard.prototype.constructor = Dashboard;
    Dashboard.prototype.kind = 'Dashboard';
    Dashboard.prototype.CONF = _default;

    UI.register(Dashboard);
})(odd);

