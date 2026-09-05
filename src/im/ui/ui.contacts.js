(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        MouseEvent = events.MouseEvent,
        IM = odd.IM,
        UI = IM.UI,
        Avatar = UI.components.Avatar,

        CLASS_CONTACTS = 'im-contacts',
        CLASS_CONTACT = 'im-contact',
        _default = {
            kind: 'Contacts',
            tab: 'contacts',
            active: '',
            visibility: true,
        };

    function Contacts(im, config, logger) {
        EventDispatcher.call(this, 'Contacts', { logger: logger }, MouseEvent);

        var _this = this,
            _container,
            _items;

        function _init() {
            _this.config = config;
            _items = {};
            _container = utils.createElement('div', CLASS_CONTACTS);
        }

        _this.add = function (id, type, name, avatar) {
            _this.remove(id);

            var data = {
                id: id,
                type: type,
                name: name,
                avatar: avatar,
            },
                element = utils.createElement('div', CLASS_CONTACT),
                image = new Avatar('avatar', data, logger),
                title = utils.createElement('strong');
            element.setAttribute('id', id);
            element.setAttribute('type', type);
            element.setAttribute('state', 'off');
            element.addEventListener('click', _onClick);
            title.textContent = name || id;
            element.appendChild(image.element());
            element.appendChild(title);
            _container.appendChild(element);
            _items[id] = {
                data: data,
                element: element,
                avatar: image,
            };
            if (String(_this.config.active) === String(id)) {
                element.setAttribute('state', 'on');
            }
            return element;
        };

        _this.remove = function (id) {
            var item = _items[id];
            if (!item) {
                return;
            }
            item.element.removeEventListener('click', _onClick);
            if (item.element.parentNode) {
                item.element.parentNode.removeChild(item.element);
            }
            item.avatar.destroy();
            delete _items[id];
            if (String(_this.config.active) === String(id)) {
                _this.config.active = '';
            }
        };

        function _onClick(e) {
            var item = _items[e.currentTarget.getAttribute('id')];
            if (!item) {
                return;
            }
            _this.active(item.data.id);
            _this.dispatchEvent(MouseEvent.CLICK, {
                name: 'contact',
                data: item.data,
            });
        }

        _this.active = function (value) {
            if (value !== undefined) {
                _this.config.active = value;
                utils.forEach(_items, function (id, item) {
                    item.element.setAttribute('state', id === String(value) ? 'on' : 'off');
                });
            }
            return _this.config.active;
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function () {
        };

        _this.destroy = function () {
            var ids = [];
            utils.forEach(_items, function (id) {
                ids.push(id);
            });
            for (var i = 0; i < ids.length; i++) {
                _this.remove(ids[i]);
            }
        };

        _init();
    }

    Contacts.prototype = Object.create(EventDispatcher.prototype);
    Contacts.prototype.constructor = Contacts;
    Contacts.prototype.kind = 'Contacts';
    Contacts.prototype.CONF = _default;

    UI.register(Contacts);
})(odd);


