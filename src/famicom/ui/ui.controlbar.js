(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        MouseEvent = events.MouseEvent,
        TouchEvent = events.TouchEvent,
        Famicom = odd.Famicom,
        UI = Famicom.UI,
        components = UI.components,

        CLASS_CONTROLBAR = 'famicom-controlbar',
        CLASS_LEFT = 'famicom-left',
        CLASS_CENTER = 'famicom-center',
        CLASS_RIGHT = 'famicom-right',

        _regi = /\[([a-z]+)\:([a-z]+)=([^\]]+)?\]/gi,
        _default = {
            kind: 'Controlbar',
            layout: '[JoyStick:joystick=]|[Button:select=Select][Button:start=Start]|[Button:b=B][Button:a=A]',
            visibility: true,
        };

    function Controlbar(config, logger) {
        EventDispatcher.call(this, 'Controlbar', { logger: logger }, MouseEvent, TouchEvent);

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
            var layouts = _this.config.layout.split('|');
            if (layouts.length !== 3) {
                throw { name: 'DataError', message: 'Controlbar should have exactly 3 sections.' };
            }

            var left = utils.createElement('div', CLASS_LEFT);
            var center = utils.createElement('div', CLASS_CENTER);
            var right = utils.createElement('div', CLASS_RIGHT);

            utils.forEach([left, center, right], function (i, container) {
                var arr;
                while ((arr = _regi.exec(layouts[i])) !== null) {
                    _buildComponent(container, arr[1], arr[2], arr[3]);
                }
            });

            _content.appendChild(left);
            _content.appendChild(center);
            _content.appendChild(right);
        }

        function _buildComponent(container, type, name, kind) {
            var component = new components[type](name, kind, _logger);
            if (utils.typeOf(component.addGlobalListener) === 'function') {
                component.addGlobalListener(_this.forward);
            }
            var element = component.element();
            container.appendChild(element);
            _this.components[name] = component;

            if (name === 'joystick') {
                component.config = utils.extendz(component.config, _this.config.joystick);
            } else if (kind !== undefined) {
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
