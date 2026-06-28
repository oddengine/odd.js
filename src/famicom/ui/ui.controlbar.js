(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        MouseEvent = events.MouseEvent,
        Famicom = odd.Famicom,
        UI = Famicom.UI,
        components = UI.components,

        CLASS_CONTROLBAR = 'famicom-controlbar',
        CLASS_CENTER = 'famicom-center',

        _regi = /\[([a-z]+)\:([a-z]+)=([^\]]+)?\]/gi,
        _default = {
            kind: 'Controlbar',
            layout: '[Button:fullscreen=][Button:exitfullscreen=]',
            autohide: true,
            timeout: 3000,
            visibility: true,
        };

    function Controlbar(config, logger) {
        EventDispatcher.call(this, 'Controlbar', { logger: logger }, MouseEvent);

        var _this = this,
            _logger = logger,
            _container,
            _content;

        function _init() {
            _this.config = config;
            _this.components = {};
            _container = utils.createElement('div', CLASS_CONTROLBAR);
            _content = utils.createElement('div');
            _container.appendChild(_content);
            _buildComponents();
        }

        function _buildComponents() {
            var center = utils.createElement('div', CLASS_CENTER);
            var arr;
            _regi.lastIndex = 0;
            while ((arr = _regi.exec(_this.config.layout)) !== null) {
                _buildComponent(center, arr[1], arr[2], arr[3]);
            }

            _content.appendChild(center);
        }

        function _buildComponent(container, type, name, kind) {
            var component = new components[type](name, kind, _logger);
            if (utils.typeOf(component.addGlobalListener) === 'function') {
                component.addGlobalListener(_this.forward);
            }
            var element = component.element();
            container.appendChild(element);
            _this.components[name] = component;

            if (kind !== undefined) {
                element.innerHTML = kind;
            }
        }

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _init();
    }

    Controlbar.prototype = Object.create(EventDispatcher.prototype);
    Controlbar.prototype.constructor = Controlbar;
    Controlbar.prototype.kind = 'Controlbar';
    Controlbar.prototype.CONF = _default;

    UI.register(Controlbar);
})(odd);
