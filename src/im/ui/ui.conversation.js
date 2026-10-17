(function (odd) {
    var utils = odd.utils, events = odd.events, EventDispatcher = events.EventDispatcher,
        Event = events.Event, MouseEvent = events.MouseEvent, IMEvent = events.IMEvent,
        IM = odd.IM, UI = IM.UI, Protocol = IM.Protocol, Action = Protocol.Action,
        State = { INITIALIZED: 'initialized', READY: 'ready', CLOSING: 'closing', CLOSED: 'closed' },
        _default = { kind: 'Conversation', tab: 'messages', layout: '[Messages:messages=][Composer:composer=]',
            active: '', contacts: [], conversations: {}, manageSubscriptions: true,
            composer: { maxlength: 500, placeholder: 'Send a message...', tools: ['emoji', 'file', 'video-call', 'voice-call'], miniTools: ['emoji'] },
            visibility: true };

    function Conversation(im, config, logger) {
        EventDispatcher.call(this, 'Conversation', { logger: logger }, Event, MouseEvent);
        var _this = this, _container = utils.createElement('div', 'im-conversation'),
            _title = utils.createElement('header', 'im-conversation-title'), _notice = utils.createElement('p', 'im-history-notice'),
            _tools = utils.createElement('div', 'im-history-tools'), _room = utils.createElement('div', 'im-room-state'),
            _readyState = State.INITIALIZED, _generation = 0, _channel = null, _selected = null,
            _rows = Object.create(null), _sending = Object.create(null), _gifts = Object.create(null),
            _before = null, _outBefore = null, _loading = null, _opening = Promise.resolve(), _reload = false, _older = false,
            _read = { high: 0, low: 0 }, _history = UI.History, _loadButton, _readButton;
        _this.config = config;
        _this.components = {};
        _notice.setAttribute('role', 'status');
        [_title, _notice, _tools, _room].forEach(function (element) { _container.appendChild(element); });

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
        function current(generation) { return _readyState === State.READY && _generation === generation; }
        function failure(reason) {
            reason = reason || new Error('Operation failed.');
            if (_readyState !== State.READY || reason.name === 'AbortError') { return; }
            _notice.textContent = reason.message || String(reason);
            _this.dispatchEvent(Event.ERROR, { name: reason.name || 'OperationError', message: _notice.textContent });
        }
        function contact(id) {
            return config.contacts.filter(function (value) { return value.id === id; })[0];
        }
        function title(id) {
            var value = contact(id);
            return value ? value.name || id : id;
        }
        function release(channel) {
            if (!channel || config.manageSubscriptions === false || (_channel && _channel.id === channel.id)) { return; }
            im.unsubscribe(channel.target, channel.room ? {} : { messaging: true }).catch(failure);
            if (channel.events) { im.unsubscribe(channel.target, { messaging: true, topic: 'events' }).catch(failure); }
        }
        function clearRows() {
            _rows = Object.create(null);
            _before = _outBefore = null;
            _older = false;
            _room.textContent = '';
            _gifts = Object.create(null);
            render();
        }
        function merge(row) {
            var before = _rows[row.id];
            if (before && before.packet && !row.packet) {
                row.packet = before.packet;
                row.state = before.state;
                row.gift = before.gift;
            }
            if (before && !row.sequence) { row.sequence = before.sequence; row.messageId = before.messageId; }
            if (_sending[row.id]) { row.state = 'sending'; }
            if (row.state !== 'unknown' && row.state !== 'sending') { delete _gifts[row.id]; }
            if (_gifts[row.id]) { row.state = 'gift-pending'; }
            row.from = title(row.from);
            if (row.incoming && row.sequence && Protocol.compare64(row.sequence, _read) <= 0) { row.state = 'read'; }
            row.retry = row.packet && (row.state === 'unknown' || row.state === 'gift-pending') ? function () { retry(row).catch(failure); } : null;
            _rows[row.id] = row;
        }
        function render(older) {
            var rows = Object.keys(_rows).map(function (id) { return _rows[id]; }).sort(_history.compare);
            rows = older ? rows.slice(0, 200) : rows.slice(-200);
            _rows = Object.create(null);
            rows.forEach(function (row) { _rows[row.id] = row; });
            var messages = _this.components.messages;
            if (messages) {
                messages.update(rows);
                messages.element().scrollTop = older ? 0 : messages.element().scrollHeight;
            }
            _readButton.hidden = !_channel || _channel.room;
            _loadButton.hidden = !_channel || !_channel.storage;
        }
        function load(older) {
            var channel = _channel, generation = _generation;
            if (!channel || !channel.storage) { return Promise.resolve(); }
            if (_loading) { if (!older) { _reload = true; } return _loading; }
            if (older) { _older = true; }
            var store = channel.storage, incoming = channel.room ?
                channel.visit ? store.eventHistory(channel.visit.conversationId, channel.visit.epoch, older ? _before : null, 32) : Promise.resolve([]) :
                store.history(channel.id, older ? _before : null, 32);
            _loading = Promise.all([incoming, store.outgoing(channel.id, older ? _outBefore : null, 32),
                channel.room ? Promise.resolve(null) : store.projection(channel.id),
                channel.room ? Promise.resolve([]) : store.gaps(channel.id)]).then(function (values) {
                if (!current(generation) || _channel !== channel) { return; }
                if (!older) {
                    var retained = Object.create(null);
                    Object.keys(_rows).forEach(function (id) {
                        var row = _rows[id];
                        if (!row.reliable || row.local || _sending[id]) { retained[id] = row; }
                    });
                    _rows = retained;
                    _older = false;
                }
                if (values[2]) { _read = values[2].readSequence; }
                values[0].forEach(function (record) { merge(channel.room ? _history.event(record) : _history.message(record, im.userId())); });
                values[1].forEach(function (record) { merge(_history.outgoing(record, im.userId())); });
                if (values[0].length) { _before = { high: values[0][0].high, low: values[0][0].low }; }
                if (values[1].length) { _outBefore = values[1][0].id; }
                if (values[3].length) { _notice.textContent = 'Some messages expired or are unavailable. Local saved history is shown.'; }
                else if (older && !values[0].length && !values[1].length) { _notice.textContent = 'No earlier local history. Server history is limited by retention.'; }
                render(older);
            });
            var pending = _loading;
            function finish() {
                if (_loading !== pending) { return; }
                _loading = null;
                if (_reload) { _reload = false; load(false).catch(failure); }
            }
            pending.then(finish, finish);
            return pending;
        }
        async function open(target, generation) {
            if (!im.connected()) { _notice.textContent = 'Disconnected. Reconnect to restore saved messages.'; return; }
            var store = im.storage(), room = target.type === 'room', resolved;
            var reads = ['history', 'outgoing', 'outboxEntry', 'projection', 'gaps', 'destination', 'saveRead', 'eventHistory'];
            if (!room && (!store || reads.some(function (name) { return typeof store[name] !== 'function'; }))) {
                throw new Error('Reliable conversations require persistent messaging storage with history support.');
            }
            if (!room) { resolved = await im.resolve(target); }
            if (!current(generation)) { return; }
            var destination = room ? target : { type: 'conversation', id: resolved.conversationId },
                channel = { id: destination.id, target: destination, room: room, session: store, user: im.userId(), storage: store && reads.every(function (name) { return typeof store[name] === 'function'; }) ? store : null, resolution: resolved, visit: null, events: false, ready: false };
            _channel = channel;
            if (!room && target.type !== 'conversation') {
                var value = _selected || contact(config.active) || {};
                await store.destination(channel.id, { target: target, name: String(value.name || target.id).slice(0, 128), avatar: String(value.avatar || '').slice(0, 2048) });
            }
            if (!current(generation)) { release(channel); return; }
            if (config.manageSubscriptions !== false) {
                await im.subscribe(destination, room ? {} : { messaging: true,
                    actions: Action.MESSAGE_SUBSCRIBE | Action.MESSAGE_PUBLISH | Action.MESSAGE_COMMIT | Action.MESSAGE_READ });
            } else {
                await im.refresh(destination, room ? Action.MESSAGE_PUBLISH : Action.MESSAGE_PUBLISH | Action.MESSAGE_READ, !room);
            }
            if (!current(generation)) { release(channel); return; }
            if (room) {
                await im.refresh(destination, Action.MESSAGE_PUBLISH, false);
                if (channel.storage && config.manageSubscriptions === false && typeof store.eventVisit === 'function') {
                    var visit = await store.eventVisit(target.id);
                    if (visit) { channel.visit = { conversationId: visit.stream, epoch: visit.epoch }; }
                    var state = await im.roomState(target.id);
                    if (current(generation)) { roomState(state); }
                }
                if (channel.storage && config.manageSubscriptions !== false) {
                    try {
                        channel.visit = await im.subscribe(destination, { messaging: true, topic: 'events', resume: true });
                        channel.events = true;
                    } catch (reason) {
                        if (current(generation)) { _notice.textContent = 'Reliable room state is unavailable: ' + reason.message; }
                    }
                }
            }
            if (!current(generation)) { release(channel); return; }
            channel.ready = true;
            if (!room) { _this.dispatchEvent(Event.CHANGE, { name: 'conversation-resolved', conversationId: channel.id }); }
            if (!room) { _notice.textContent = 'Messages are saved before acknowledgement. Read receipts require your action.'; }
            await load(false);
        }
        async function send(text) {
            var channel = _channel, generation = _generation;
            if (!channel || !channel.ready || !im.connected()) { failure(new Error('Select a connected conversation before sending.')); return; }
            if (Object.keys(_sending).length >= 8) { failure(new Error('Wait for the pending sends to finish.')); return; }
            var id = channel.room ? null : Protocol.messageId(channel.resolution.partition, channel.resolution.partitions), key = id ? _history.hex(id) : utils.guid(),
                row = { id: key, text: text, from: im.userId(), align: 'right', incoming: false, reliable: !channel.room, ephemeral: channel.room,
                    timestamp: Date.now(), time: new Date().toLocaleTimeString(), state: 'sending', clientMessageId: id };
            if (_this.components.composer) { _this.components.composer.clear(config.active); }
            _sending[key] = true;
            merge(row);
            render();
            try {
                await im.refresh(channel.target, Action.MESSAGE_PUBLISH, !channel.room);
                if (im.storage() !== channel.session || im.userId() !== channel.user) { throw new Error('Connection changed before saving the send.'); }
                await im.send(channel.target, text, channel.room ? { ext: [{ key: 'clientMessageId', type: Protocol.Type.STRING, value: key }] } :
                    { messaging: true, clientMessageId: id });
                if (current(generation)) {
                    row.state = channel.room ? 'sent' : 'accepted';
                }
            } catch (reason) {
                row.state = channel.room ? 'failed' : 'unknown';
                if (!channel.room) {
                    try {
                        var saved = await channel.storage.outboxEntry(id);
                        if (saved) { row = _history.outgoing(saved, im.userId()); }
                        else { row.state = 'failed'; row.local = true; }
                    } catch (storageError) { row.local = true; }
                }
                if (current(generation)) { failure(reason); }
            } finally {
                delete _sending[key];
                if (current(generation)) {
                    if (channel.room || row.local) { merge(row); render(); }
                    if (!channel.room) { await load(false).catch(failure); }
                }
            }
        }
        async function retry(row) {
            var channel = _channel, generation = _generation;
            if (!channel || !channel.ready || !im.connected() || !row.packet || _sending[row.id]) { return; }
            _sending[row.id] = true;
            merge(row);
            render();
            try {
                if (row.gift) { await im.recover(); }
                else {
                    var packet = Protocol.decode(row.packet), target = _history.object(packet.fields[0].value);
                    await im.refresh(target, Action.MESSAGE_PUBLISH, true);
                    if (im.storage() !== channel.session || im.userId() !== channel.user) { throw new Error('Connection changed before retrying.'); }
                    await im.request(Protocol.Opcode.PUBLISH, packet.fields, true);
                }
            } catch (reason) { if (current(generation)) { failure(reason); } }
            finally { delete _sending[row.id]; if (current(generation)) { await load(false).catch(failure); } }
        }
        async function markRead() {
            var channel = _channel, generation = _generation;
            if (!channel || !channel.ready || channel.room || !im.connected() || document.visibilityState !== 'visible') { return; }
            var rows = Object.keys(_rows).map(function (id) { return _rows[id]; }).filter(function (row) { return row.incoming && row.sequence && row.messageId; }).sort(_history.compare),
                last = rows[rows.length - 1];
            if (!last || Protocol.compare64(last.sequence, _read) <= 0) { return; }
            await im.refresh(channel.target, Action.MESSAGE_READ, true);
            if (!current(generation) || _channel !== channel || document.visibilityState !== 'visible') { return; }
            await im.read(channel.id, last.messageId, last.sequence);
            await channel.storage.saveRead(channel.id, last.sequence);
            if (current(generation)) {
                _read = last.sequence;
                _notice.textContent = 'Loaded messages marked read for this account.';
                await load(false);
                _this.dispatchEvent(Event.CHANGE, { name: 'messages-read', conversationId: channel.id });
            }
        }
        function roomState(value) {
            _room.textContent = '';
            var status = document.createElement('p');
            status.textContent = value.known ? 'Room state synchronized' : 'Room state is unknown; waiting for recovery';
            _room.appendChild(status);
            (value.states || []).slice(0, 64).forEach(function (state) {
                if (['room.state', 'stage.policy', 'stage.member'].indexOf(state.kind) < 0) { return; }
                var row = document.createElement('p');
                row.textContent = state.kind === 'room.state' ? 'Room: ' + state.payload.state : state.kind === 'stage.policy' ?
                    'Stage mode: ' + state.payload.mode + ' · seats: ' + state.payload.capacity :
                    'Stage participant: ' + state.entityId + ' · ' + state.payload.state;
                _room.appendChild(row);
            });
        }
        function onMessage(event) {
            var value = event.data, channel = _channel;
            if (_readyState !== State.READY || !channel || !value.target) { return; }
            if (value.messaging && value.target.type === 'room') {
                if (!channel.room || channel.id !== value.target.id) { return; }
                if (value.type === 'room.snapshot') { roomState(value.content); return; }
                if (value.event && value.meta) { merge(_history.fact(value.event, value.meta)); render(_older); }
                return;
            }
            if (value.messaging) {
                if (value.meta.conversationId === channel.id) {
                    if (_older) { _notice.textContent = 'New saved messages are available. Refresh to show the latest.'; }
                    else { load(false).catch(failure); }
                }
                return;
            }
            if (channel.room && value.target.id === channel.id && value.sender) {
                if (value.sender.id === im.userId() && value.ext && value.ext.clientMessageId && _rows[value.ext.clientMessageId]) { return; }
                merge(_history.received(value, im.userId()));
                render(_older);
            }
        }
        function onNotify(event) {
            if (_readyState !== State.READY || !_channel) { return; }
            var value = event.data.payload || {};
            if (event.data.event === Protocol.Event.IM_SUBSCRIBE_STOP && value.target && value.target.id === _channel.id) {
                _notice.textContent = 'Subscription stopped: ' + value.reason + '. Select the conversation again to request access.';
                if (_channel.room && event.data.messaging) {
                    _channel.visit = null;
                    _channel.events = false;
                    roomState({ known: false, states: [] });
                } else { _channel.ready = false; }
                return;
            }
            if (event.data.event !== Protocol.Event.IM_SYNC_REQUIRED) { return; }
            if (value.kind === 'expired' && value.conversationId === _channel.id) { _notice.textContent = 'Some messages expired before they could be retrieved.'; }
            if (value.kind === 'gift' && value.outcome && value.outcome.state === 'committed' && value.outcome.deliveryState !== 'accepted') {
                if (Object.keys(_gifts).length < 200) { _gifts[value.id] = true; }
            }
            if ((value.kind === 'outbox' && (!value.conversationId || value.conversationId === _channel.id)) ||
                value.kind === 'results' || value.kind === 'conversations' || value.kind === 'gift') {
                if (!_older) { load(false).catch(failure); }
            }
        }
        function onReady() { _this.active(config.active, _selected); }
        function onClose() {
            ++_generation;
            _channel = null;
            _notice.textContent = 'Disconnected. Saved history remains on this device; pending results are unknown.';
            Object.keys(_rows).forEach(function (id) { if (_rows[id].state === 'sending') { _rows[id].state = 'unknown'; } });
            render();
        }
        function onComponent(event) {
            if (_readyState !== State.READY) { return; }
            if (event.type === MouseEvent.CLICK && event.data.name === 'send') { send(event.data.text).catch(failure); }
            _this.forward(event);
        }
        _this.active = function (id, selected) {
            if (id === undefined || _readyState === State.CLOSED) { return config.active; }
            var previous = _channel, previousId = config.active;
            _channel = null;
            config.active = id;
            _container.setAttribute('data-conversation', id);
            _selected = selected || (id === previousId ? _selected : null) || contact(id);
            var generation = ++_generation;
            release(previous);
            _title.textContent = _selected ? _selected.name || id : id || '';
            _notice.textContent = '';
            _read = { high: 0, low: 0 };
            clearRows();
            if (_this.components.composer) { _this.components.composer.conversation(id); _this.components.composer.state(id ? 'off' : 'empty'); }
            _opening = id ? open(_this.target(), generation) : Promise.resolve();
            _opening.catch(function (reason) {
                if (current(generation)) {
                    failure(reason);
                    load(false).catch(failure);
                }
            });
            return id;
        };
        _this.open = function (id, selected) {
            _this.active(id, selected);
            return _opening;
        };
        _this.ready = function () { return _opening; };
        _this.target = function () {
            if (!config.active) { return null; }
            if (_selected && _selected.target) { return _selected.target; }
            return { type: _selected && _selected.type === 'group' ? 'group' : _selected && _selected.type === 'channel' ? 'room' :
                _selected && _selected.type === 'conversation' || /^c-[0-9a-f]{64}$/.test(config.active) ? 'conversation' : 'user', id: config.active };
        };
        _this.presentation = function (value) { return _this.components.composer && _this.components.composer.presentation(value); };
        _this.state = function () { return _readyState; };
        _this.element = function () { return _container; };
        _this.resize = function (width, height) { Object.keys(_this.components).forEach(function (key) { _this.components[key].resize(width, height); }); };
        _this.destroy = function () {
            var previous = _channel;
            _channel = null;
            release(previous);
            _readyState = State.CLOSING;
            ++_generation;
            im.removeEventListener(IMEvent.MESSAGE, onMessage);
            im.removeEventListener(IMEvent.NOTIFY, onNotify);
            im.removeEventListener(Event.READY, onReady);
            im.removeEventListener(Event.CLOSE, onClose);
            Object.keys(_this.components).forEach(function (key) { _this.components[key].removeGlobalListener(onComponent); _this.components[key].destroy(); });
            _this.components = {};
            _tools.querySelectorAll('button').forEach(function (button) { button.onclick = null; });
            _rows = Object.create(null);
            _readyState = State.CLOSED;
        };

        _loadButton = button('Earlier local history', function () { return load(true); });
        button('Refresh saved messages and results', function () { return im.recover().then(function () { return load(false); }); });
        _readButton = button('Mark loaded messages read', markRead);
        var expression = /\[([a-z]+)\:([a-z]+)=([^\]]+)?\]/gi, match;
        while ((match = expression.exec(config.layout)) !== null) {
            var component = new UI.components[match[1]](match[2], match[3], logger);
            component.addGlobalListener(onComponent);
            _container.appendChild(component.element());
            _this.components[match[2]] = component;
        }
        if (_this.components.composer) { _this.components.composer.update(config.composer); }
        _readyState = State.READY;
        im.addEventListener(IMEvent.MESSAGE, onMessage);
        im.addEventListener(IMEvent.NOTIFY, onNotify);
        im.addEventListener(Event.READY, onReady);
        im.addEventListener(Event.CLOSE, onClose);
        _this.active(config.active || (config.contacts[0] && config.contacts[0].id) || '');
    }
    Conversation.prototype = Object.create(EventDispatcher.prototype);
    Conversation.prototype.constructor = Conversation;
    Conversation.prototype.kind = 'Conversation';
    Conversation.prototype.CONF = _default;
    Conversation.State = State;
    UI.register(Conversation);
})(odd);
