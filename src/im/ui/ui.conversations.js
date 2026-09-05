(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        NetStatusEvent = events.NetStatusEvent,
        MouseEvent = events.MouseEvent,
        Code = events.Code,
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
            im.addEventListener(NetStatusEvent.NETSTATUS, _onStatus);
        }

        _this.add = function (id, type, name, avatar) {
            _this.remove(id);

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

        function _onStatus(e) {
            if (e.data.code !== Code.NETGROUP_SENDTO_NOTIFY && e.data.code !== Code.NETGROUP_POSTING_NOTIFY) {
                return;
            }
            var info = e.data.info,
                message = info.Arguments,
                data = message.cast === 'uni' ? message.user : message.room,
                type = message.cast === 'uni' ? 'people' : 'group';
            if (!_items[data.id]) {
                _this.add(data.id, type, data.nick || data.name, data.avatar);
            }
            _this.update(data.id, info.Timestamp, message.data);
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
            im.removeEventListener(NetStatusEvent.NETSTATUS, _onStatus);

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


