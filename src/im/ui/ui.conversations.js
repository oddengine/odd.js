(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        MouseEvent = events.MouseEvent,
        IMEvent = events.IMEvent,
        IM = odd.IM,
        UI = IM.UI,
        Avatar = UI.components.Avatar,

        CLASS_CONVERSATIONS = 'im-conversations',
        CLASS_CONVERSATION = 'im-conversation-item',
        _default = {
            kind: 'Conversations',
            tab: 'messages',
            active: '',
            visibility: true,
        };

    function Conversations(im, config, logger) {
        EventDispatcher.call(this, 'Conversations', { logger: logger }, MouseEvent);

        var _this = this,
            _container,
            _items;

        function _init() {
            _this.config = config;
            _items = {};
            _container = utils.createElement('div', CLASS_CONVERSATIONS);
            im.addEventListener(IMEvent.MESSAGE, _onMessage);
        }

        _this.add = function (id, type, name, avatar) {
            var current = _items[id];
            if (current) {
                return current.element;
            }

            var data = {
                id: id,
                type: type,
                name: name,
                avatar: avatar,
            },
                element = utils.createElement('div', CLASS_CONVERSATION),
                image = new Avatar('avatar', data, logger),
                copy = utils.createElement('span', 'im-entry-copy'),
                line = utils.createElement('span', 'im-entry-line'),
                title = utils.createElement('strong'),
                date = utils.createElement('time'),
                message = utils.createElement('small');
            element.setAttribute('id', id);
            element.setAttribute('type', type);
            element.setAttribute('state', 'off');
            element.addEventListener('click', _onClick);
            title.textContent = name || id;
            line.appendChild(title);
            line.appendChild(date);
            copy.appendChild(line);
            copy.appendChild(message);
            element.appendChild(image.element());
            element.appendChild(copy);
            _container.appendChild(element);
            _items[id] = {
                data: data,
                element: element,
                avatar: image,
                date: date,
                message: message,
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

        _this.update = function (id, date, message) {
            var item = _items[id];
            if (item) {
                item.date.textContent = date || '';
                item.message.textContent = message || '';
            }
        };

        function _onClick(e) {
            var item = _items[e.currentTarget.getAttribute('id')];
            if (item) {
                _this.active(item.data.id);
                _this.dispatchEvent(MouseEvent.CLICK, {
                    name: 'conversation',
                    data: item.data,
                });
            }
        }

        function _onMessage(e) {
            var data = e.data,
                id = data.target.type === 'user' || data.target.type === 'endpoint' ?
                    (data.sender.id === im.userId() ? data.target.id : data.sender.id) : data.target.id,
                type = data.target.type === 'room' ? 'channel' : data.target.type === 'group' ? 'group' : 'people';
            if (!_items[id]) {
                _this.add(id, type, id);
            }
            _this.update(id, new Date().toLocaleTimeString(),
                typeof data.content === 'string' ? data.content : '[Binary]');
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
            im.removeEventListener(IMEvent.MESSAGE, _onMessage);

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

    Conversations.prototype = Object.create(EventDispatcher.prototype);
    Conversations.prototype.constructor = Conversations;
    Conversations.prototype.kind = 'Conversations';
    Conversations.prototype.CONF = _default;

    UI.register(Conversations);
})(odd);

