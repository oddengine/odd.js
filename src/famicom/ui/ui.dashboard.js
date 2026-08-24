(function (odd) {
    var utils = odd.utils,
        css = utils.css,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        MouseEvent = events.MouseEvent,
        TimerEvent = events.TimerEvent,
        Famicom = odd.Famicom,
        UI = Famicom.UI,
        components = UI.components,

        CLASS_DASHBOARD = 'pe-dashboard',

        _regi = /\[([a-z]+)\:([a-z]+)=([^\]]+)?\]/gi,
        _default = {
            kind: 'Dashboard',
            layout: '[Panel:stats=][Panel:settings=Settings]',
            visibility: true,
        };

    function Dashboard(config, logger) {
        EventDispatcher.call(this, 'Dashboard', { logger: logger }, [MouseEvent.CLICK]);

        var _this = this,
            _logger = logger,
            _container,
            _content;

        function _init() {
            _this.config = config;
            _this.components = {};

            _container = utils.createElement('div', CLASS_DASHBOARD);
            _content = utils.createElement('div');
            _content.addEventListener('click', _onClick);
            _container.appendChild(_content);

            _buildComponents();
        }

        function _buildComponents() {
            var arr;
            while ((arr = _regi.exec(_this.config.layout)) !== null) {
                try {
                    _buildComponent(_content, arr[1], arr[2], arr[3]);
                } catch (err) {
                    _logger.error('Failed to build component: type=' + arr[1] + ', name=' + arr[2] + ', Error=' + err.message);
                }
            }
        }

        function _buildComponent(container, type, name, value) {
            var component = new components[type](name, value, _logger);
            if (utils.typeOf(component.addGlobalListener) === 'function') {
                component.addGlobalListener(_this.forward);
            }
            var element = component.element();
            if (value !== undefined) {
                var tooltip;
                if (utils.typeOf(components[value]) === 'function') {
                    tooltip = new components[value](name, value, _logger);
                    element.insertAdjacentElement('afterbegin', tooltip.element());
                } else {
                    tooltip = utils.createElement('span', CLASS_TOOLTIP);
                    tooltip.innerHTML = value;
                    element.insertAdjacentElement('afterbegin', tooltip);
                }
                component.tooltip = tooltip;
            }
            container.appendChild(element);
            _this.components[name] = component;
        }

        _this.update = function (name, data) {
            var panel = _this.components[name];
            if (panel) {
                panel.update(data);
            }
        };

        _this.clear = function (name) {
            var panel = _this.components[name];
            if (panel) {
                panel.clear();
            }
        };

        _this.show = function (name) {
            utils.forEach(_this.components, function (key, component) {
                if (component.kind === 'Panel' && key !== name) {
                    component.hide();
                }
            });
            var panel = _this.components[name];
            if (panel) {
                panel.show();
            }
        };

        _this.hide = function (name) {
            var panel = _this.components[name];
            if (panel) {
                panel.hide();
            }
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _init();
    }

    Dashboard.prototype = Object.create(EventDispatcher.prototype);
    Dashboard.prototype.constructor = Dashboard;
    Dashboard.prototype.kind = 'Dashboard';
    Dashboard.prototype.CONF = _default;

    UI.register(Dashboard);
})(odd);

