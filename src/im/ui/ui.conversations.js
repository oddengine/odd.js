(function (odd) {
    var utils = odd.utils, events = odd.events, EventDispatcher = events.EventDispatcher,
        Event = events.Event, MouseEvent = events.MouseEvent, IMEvent = events.IMEvent,
        IM = odd.IM, UI = IM.UI, Protocol = IM.Protocol, Avatar = UI.components.Avatar,
        _default = { kind: 'Conversations', tab: 'messages', active: '', visibility: true,
            labels: { refresh: 'Refresh', more: 'More saved conversations' } };

    function Conversations(im, config, logger) {
        EventDispatcher.call(this, 'Conversations', { logger: logger }, MouseEvent);
        var _this = this, _items = Object.create(null), _container = utils.createElement('div', 'im-conversations'),
            _tools = utils.createElement('div', 'im-history-tools'), _notice = utils.createElement('p', 'im-history-notice'),
            _cursor = null, _loading = null, _again = false, _updates = Object.create(null), _updating = null, _generation = 0, _closed = false, _more;
        _this.config = config;
        _notice.setAttribute('role', 'status');
        _container.appendChild(_tools);
        _container.appendChild(_notice);

        function failure(reason) {
            if (!_closed && reason.name !== 'AbortError') { _notice.textContent = reason.message || String(reason); }
        }
        function button(label, action) {
            var element = document.createElement('button');
            element.type = 'button';
            element.textContent = label;
            element.onclick = function () {
                element.disabled = true;
                Promise.resolve().then(action).catch(failure).then(function () { element.disabled = false; });
            };
            _tools.appendChild(element);
            return element;
        }
        _this.add = function (id, type, name, avatar, target) {
            var current = _items[id];
            if (current) {
                if (target) { current.data.target = target; }
                if (name) { current.data.name = name; current.title.textContent = name; }
                return current.element;
            }
            var ids = Object.keys(_items);
            if (ids.length >= 200) {
                var oldest = ids.filter(function (value) { return value !== config.active; })[0];
                _this.remove(oldest);
            }
            var data = { id: id, type: type, name: name || id, avatar: avatar, target: target },
                element = utils.createElement('button', 'im-conversation-item'), image = new Avatar('avatar', data, logger),
                copy = utils.createElement('span', 'im-entry-copy'), line = utils.createElement('span', 'im-entry-line'),
                title = document.createElement('strong'), date = document.createElement('time'), message = document.createElement('small'),
                unread = utils.createElement('span', 'im-unread');
            element.type = 'button';
            element.setAttribute('data-id', id);
            element.setAttribute('state', config.active === id ? 'on' : 'off');
            element.onclick = onClick;
            title.textContent = name || id;
            unread.textContent = '未读';
            unread.hidden = true;
            line.appendChild(title);
            line.appendChild(date);
            copy.appendChild(line);
            copy.appendChild(message);
            element.appendChild(image.element());
            element.appendChild(copy);
            element.appendChild(unread);
            _container.appendChild(element);
            _items[id] = { data: data, element: element, avatar: image, title: title, date: date, message: message,
                unread: unread, incoming: { high: 0, low: 0 } };
            return element;
        };
        _this.remove = function (id) {
            var item = _items[id];
            if (!item) { return; }
            item.element.onclick = null;
            item.element.remove();
            item.avatar.destroy();
            delete _items[id];
        };
        _this.update = function (id, date, message) {
            var item = _items[id];
            if (item) { item.date.textContent = date || ''; item.message.textContent = message || ''; }
        };
        function onClick(event) {
            var item = _items[event.currentTarget.getAttribute('data-id')];
            if (item) {
                _this.active(item.data.id);
                _this.dispatchEvent(MouseEvent.CLICK, { name: 'conversation', data: item.data });
            }
        }
        async function project(store, id, generation) {
            var values = await Promise.all([store.destination(id), store.projection(id)]);
            if (_closed || _generation !== generation) { return; }
            var destination = values[0], projection = values[1], alias = destination && _items[destination.target.id];
            if (alias && destination.target.id !== id) {
                if (config.active === alias.data.id) { config.active = id; }
                _this.remove(alias.data.id);
            }
            _this.add(id, 'conversation', destination && destination.name || id, destination && destination.avatar,
                destination && destination.target);
            var item = _items[id], incoming = projection.incomingSequence;
            if (Protocol.compare64(item.incoming, incoming) > 0) { incoming = item.incoming; }
            item.unread.hidden = Protocol.compare64(incoming, projection.readSequence) <= 0;
        }
        async function directory(more) {
            if (_closed) { return; }
            if (_loading) { if (!more) { _again = true; } return _loading; }
            var store = im.storage(), generation = _generation;
            if (!store || ['directory', 'destination', 'projection'].some(function (name) { return typeof store[name] !== 'function'; })) { return; }
            _loading = (async function () {
                var records = await store.directory(more ? _cursor : null, 32);
                for (var i = 0; i < records.length; i++) {
                    if (_closed || _generation !== generation) { return; }
                    await project(store, records[i].conversationId, generation);
                }
                if (_closed || _generation !== generation) { return; }
                _cursor = records.length ? records[records.length - 1].conversationId : _cursor;
                _more.hidden = records.length < 32;
                _notice.textContent = config.labels.summary === undefined ? '已保存的会话 · 未读表示当前账号尚未阅读的消息' : config.labels.summary;
            })();
            try { await _loading; }
            finally {
                _loading = null;
                if (_again && !_closed) { _again = false; directory(false).catch(failure); }
            }
        }
        function drain() {
            var store = im.storage(), generation = _generation;
            if (!store || typeof store.projection !== 'function' || typeof store.destination !== 'function') {
                _updates = Object.create(null);
                return Promise.resolve();
            }
            _updating = (async function () {
                while (!_closed && _generation === generation && Object.keys(_updates).length) {
                    var id = Object.keys(_updates)[0];
                    delete _updates[id];
                    await project(store, id, generation).catch(failure);
                }
            })().then(function () {
                _updating = null;
                if (!_closed && Object.keys(_updates).length) { return drain(); }
            });
            return _updating;
        }
        _this.refresh = function (id) {
            if (_closed) { return Promise.resolve(); }
            if (!id) { return directory(false).catch(failure); }
            if (Object.keys(_updates).length < 200) { _updates[id] = true; }
            return _updating || drain();
        };
        function onMessage(event) {
            var data = event.data;
            if (_closed || !data.target || data.type === 'room.snapshot') { return; }
            var room = data.target.type === 'room', reliable = data.messaging && !room;
            if (!room && !data.sender) { return; }
            var id = reliable ? data.meta.conversationId : data.target.type === 'user' || data.target.type === 'endpoint' ?
                data.sender.id === im.userId() ? data.target.id : data.sender.id : data.target.id;
            if (!_items[id]) { _this.add(id, room ? 'channel' : reliable ? 'conversation' : 'people', id); }
            var row = room && data.event ? UI.History.fact(data.event, data.meta) : UI.History.received(data, im.userId());
            _this.update(id, row.time, row.text);
            if (reliable) {
                var item = _items[id];
                if (row.incoming && Protocol.compare64(data.meta.messageSequence, item.incoming) > 0) {
                    item.incoming = data.meta.messageSequence;
                    item.unread.hidden = false;
                }
                _this.refresh(id);
            }
        }
        function onNotify(event) {
            if (event.data.event === Protocol.Event.IM_SYNC_REQUIRED && event.data.payload && event.data.payload.kind === 'conversations') {
                directory(false).catch(failure);
            }
        }
        function onReady() {
            ++_generation;
            _cursor = null;
            _updates = Object.create(null);
            Object.keys(_items).forEach(_this.remove);
            directory(false).catch(failure);
        }
        function onClose() { ++_generation; _updates = Object.create(null); _notice.textContent = '连接已断开 · 已保存的会话列表'; }
        _this.active = function (id) {
            if (id !== undefined) {
                config.active = id;
                Object.keys(_items).forEach(function (key) { _items[key].element.setAttribute('state', key === id ? 'on' : 'off'); });
            }
            return config.active;
        };
        _this.element = function () { return _container; };
        _this.resize = function () {};
        _this.destroy = function () {
            _closed = true;
            _updates = Object.create(null);
            ++_generation;
            im.removeEventListener(IMEvent.MESSAGE, onMessage);
            im.removeEventListener(IMEvent.NOTIFY, onNotify);
            im.removeEventListener(Event.READY, onReady);
            im.removeEventListener(Event.CLOSE, onClose);
            Object.keys(_items).forEach(_this.remove);
            _tools.querySelectorAll('button').forEach(function (element) { element.onclick = null; });
        };
        if (config.refreshControl !== false) {
            button(config.labels.refresh, function () { return im.recover().then(function () { return directory(false); }); });
        }
        _more = button(config.labels.more, function () { return directory(true); });
        _more.hidden = true;
        im.addEventListener(IMEvent.MESSAGE, onMessage);
        im.addEventListener(IMEvent.NOTIFY, onNotify);
        im.addEventListener(Event.READY, onReady);
        im.addEventListener(Event.CLOSE, onClose);
        if (im.connected()) { onReady(); }
    }
    Conversations.prototype = Object.create(EventDispatcher.prototype);
    Conversations.prototype.constructor = Conversations;
    Conversations.prototype.kind = 'Conversations';
    Conversations.prototype.CONF = _default;
    UI.register(Conversations);
})(odd);
