(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        MouseEvent = events.MouseEvent,
        IM = odd.IM,
        UI = IM.UI,
        components = UI.components,

        CLASS_CONTACTS = 'im-contacts',

        _regi = /\[([a-z]+)\:([a-z]+)=([^\]]+)?\]/gi,
        _default = {
            kind: 'Contacts',
            layout: '',
            visibility: true,
        };

    function Contacts(im, config, logger) {
        EventDispatcher.call(this, 'Contacts', { logger: logger }, [MouseEvent.CLICK]);

        var _this = this,
            _im = im,
            _logger = logger,
            _container;

        function _init() {
            _this.config = config;
            _this.components = {};

            _container = utils.createElement('div', CLASS_CONTACTS);

            _buildComponents();
            _setupComponents();
        }

        function _buildComponents() {
            var containers = [_container];

            var layouts = _this.config.layout.split('|');
            for (var i = 1; i < layouts.length; i++) {
                var container = utils.createElement('div');
                containers.push(container);
            }
            utils.forEach(containers, function (i, container) {
                var arr;
                while ((arr = _regi.exec(layouts[i])) !== null) {
                    try {
                        _buildComponent(_content, arr[1], arr[2], arr[3]);
                    } catch (err) {
                        _logger.error('Failed to build component: type=' + arr[1] + ', name=' + arr[2] + ', Error=' + err.message);
                    }
                }
            });
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

        function _setupComponents() {

        }

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {
            utils.forEach(_this.components, function (name, component) {
                component.resize(width, height);
            });
        };

        _init();
    }

    Contacts.prototype = Object.create(EventDispatcher.prototype);
    Contacts.prototype.constructor = Contacts;
    Contacts.prototype.kind = 'Contacts';
    Contacts.prototype.CONF = _default;

    UI.register(Contacts);
})(odd);

