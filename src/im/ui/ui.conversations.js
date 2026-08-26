(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        NetStatusEvent = events.NetStatusEvent,
        MouseEvent = events.MouseEvent,
        Code = events.Code,
        IM = odd.IM,
        UI = IM.UI,
        components = UI.components,

        CLASS_CONVERSATIONS = 'im-conversations',
        _regi = /\[([a-z]+)\:([a-z]+)=([^\]]+)?\]/gi,
        _default = {
            kind: 'Conversations',
            tab: 'messages',
            label: '消息',
            layout: '[Contact:conversation=]',
            conversations: [],
            active: '',
            visibility: true,
        };

    function Conversations(im, config, logger) {
        EventDispatcher.call(this, 'Conversations', { logger: logger }, MouseEvent);

        var _this = this,
            _container;

        function _init() {
            _this.config = config;
            _this.components = {};
            _container = utils.createElement('div', CLASS_CONVERSATIONS);
            _this.update(config.conversations);
            _this.active(config.active);
            im.addEventListener(NetStatusEvent.NETSTATUS, _onStatus);
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
            _this.dispatchEvent(MouseEvent.CLICK, {
                name: 'conversation',
                id: e.data.id,
                conversation: e.data.contact,
            });
        }

        function _onStatus(e) {
            if (e.data.code !== Code.NETGROUP_SENDTO_NOTIFY && e.data.code !== Code.NETGROUP_POSTING_NOTIFY) {
                return;
            }
            var info = e.data.info,
                message = info.Arguments,
                id = message.cast === 'uni' ? message.user.id : message.room.id,
                data = _this.data(),
                found = false;
            for (var i = 0; i < data.length; i++) {
                if (data[i].id === id) {
                    data[i].status = message.data;
                    data[i].time = info.Timestamp;
                    data[i].unread = (data[i].unread || 0) + 1;
                    found = true;
                    break;
                }
            }
            if (!found) {
                data.push({
                    id: id,
                    name: message.cast === 'uni' ? message.user.nick : message.room.nick,
                    status: message.data,
                    time: info.Timestamp,
                    unread: 1,
                });
            }
            _this.update(data);
        }

        _this.update = function (value) {
            utils.forEach(_this.components, function (_, component) {
                component.removeGlobalListener(_onComponentEvent);
                component.destroy();
            });
            _this.components = {};
            utils.emptyElement(_container);
            _this.config.conversations = value || [];
            for (var i = 0; i < _this.config.conversations.length; i++) {
                _build(_this.config.conversations[i]);
            }
            _this.active(_this.config.active);
            return _this.config.conversations;
        };

        _this.data = function () {
            return _this.config.conversations;
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
            im.removeEventListener(NetStatusEvent.NETSTATUS, _onStatus);

            utils.forEach(_this.components, function (_, component) {
                component.removeGlobalListener(_onComponentEvent);
                component.destroy();
            });
            _this.components = {};
        };

        _init();
    }

    Conversations.prototype = Object.create(EventDispatcher.prototype);
    Conversations.prototype.constructor = Conversations;
    Conversations.prototype.kind = 'Conversations';
    Conversations.prototype.CONF = _default;

    UI.register(Conversations);
})(odd);

