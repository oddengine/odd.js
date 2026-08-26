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
            tab: 'contacts',
            label: '联系人',
            layout: '[Contact:contact=]',
            contacts: [],
            active: '',
            visibility: true,
        };

    function Contacts(im, config, logger) {
        EventDispatcher.call(this, 'Contacts', { logger: logger }, MouseEvent);

        var _this = this,
            _container;

        function _init() {
            _this.config = config;
            _this.components = {};
            _container = utils.createElement('div', CLASS_CONTACTS);
            _this.update(config.contacts);
            _this.active(config.active);
        }

        function _build(data) {
            var arr;
            while ((arr = _regi.exec(_this.config.layout)) !== null) {
                var component = new components[arr[1]](data.id || arr[2], data, logger);
                component.addGlobalListener(_onComponentEvent);
                _container.appendChild(component.element());
                _this.components[data.id] = component;
            }
        }

        function _onComponentEvent(e) {
            _this.active(e.data.id);
            _this.forward(e);
        }

        _this.update = function (value) {
            utils.forEach(_this.components, function (_, component) {
                component.removeGlobalListener(_onComponentEvent);
                component.destroy();
            });
            _this.components = {};
            utils.emptyElement(_container);
            _this.config.contacts = value || [];
            for (var i = 0; i < _this.config.contacts.length; i++) {
                _build(_this.config.contacts[i]);
            }
            return _this.config.contacts;
        };

        _this.data = function () {
            return _this.config.contacts;
        };

        _this.active = function (value) {
            if (value !== undefined) {
                _this.config.active = value;
                utils.forEach(_this.components, function (id, component) {
                    component.state(id === String(value) ? 'on' : 'off');
                });
            }
            return _this.config.active;
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
                component.removeGlobalListener(_onComponentEvent);
                component.destroy();
            });
            _this.components = {};
        };

        _init();
    }

    Contacts.prototype = Object.create(EventDispatcher.prototype);
    Contacts.prototype.constructor = Contacts;
    Contacts.prototype.kind = 'Contacts';
    Contacts.prototype.CONF = _default;

    UI.register(Contacts);
})(odd);

