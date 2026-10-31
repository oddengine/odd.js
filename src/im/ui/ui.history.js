(function (odd) {
    var UI = odd.IM.UI, Protocol = odd.IM.Protocol, Type = Protocol.Type;

    function object(fields) {
        var value = Object.create(null);
        fields.forEach(function (field) { value[field.key] = field.type === Type.OBJECT ? object(field.value) : field.value; });
        return value;
    }
    function hex(bytes) {
        return Array.prototype.map.call(bytes, function (value) { return ('0' + value.toString(16)).slice(-2); }).join('');
    }
    function time(id) {
        var value = 0;
        for (var i = 0; id && i < 6; i++) { value = value * 256 + id[i]; }
        return value;
    }
    // A file message contains an opaque reference, never a URL or credential.
    // The host must authorize access again when the reader opens it.
    function attachment(value) {
        if (!value || value.version !== 1 || typeof value.id !== 'string' ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.id) ||
            typeof value.name !== 'string' || !value.name.trim() || Array.from(value.name).length > 128 || /[\u0000-\u001f\u007f]/.test(value.name) ||
            typeof value.size !== 'string' || !/^[1-9][0-9]{0,9}$/.test(value.size) || Number(value.size) > 1073741824) { return null; }
        return { version: 1, id: value.id, name: value.name, size: value.size };
    }
    function received(data, user) {
        var mine = data.sender && data.sender.id === user, meta = data.meta || {}, id = data.clientMessageId;
        return { id: mine && id ? hex(id) : meta.messageId ? hex(meta.messageId) : odd.utils.guid(),
            from: data.sender ? data.sender.id : '', senderId: data.sender ? data.sender.id : '', text: typeof data.content === 'string' ? data.content : '[Binary]',
            attachment: attachment(data.ext && data.ext.attachment),
            align: mine ? 'right' : 'left', state: data.messaging ? 'saved' : 'sent',
            messageId: meta.messageId, sequence: meta.messageSequence, clientMessageId: id,
            timestamp: time(id) || Date.now(), time: id ? new Date(time(id)).toLocaleString() : new Date().toLocaleTimeString(),
            incoming: !mine, reliable: !!data.messaging, ephemeral: !data.messaging };
    }
    function message(record, user) {
        var packet = Protocol.decode(record.packet), data = object(packet.fields[1].value);
        return received({ sender: data.sender, meta: data.meta, content: data.body.content, ext: data.body.ext,
            clientMessageId: data.body.clientMessageId, messaging: true }, user);
    }
    function outgoing(record, user) {
        var packet = Protocol.decode(record.packet), body = object(packet.fields[1].value), info = record.outcome || {},
            gift = body.type === 'gift';
        return { id: record.id, from: user, align: 'right', incoming: false, reliable: true,
            attachment: attachment(body.ext && body.ext.attachment),
            text: gift ? 'Gift request: ' + body.content.giftId + ' × ' + body.content.count : typeof body.content === 'string' ? body.content : '[Binary]',
            state: record.state === 'pending' ? 'unknown' : record.state, packet: record.packet, gift: gift,
            sequence: info.messageSequence, messageId: info.messageId, clientMessageId: body.clientMessageId,
            timestamp: time(body.clientMessageId), time: new Date(time(body.clientMessageId)).toLocaleString() };
    }
    function fact(event, meta) {
        var payload = event.payload, text;
        if (Protocol.giftEvent(event.kind)) {
            text = (event.kind === 'channel.gift' ? '已确认礼物：' : 'Gift confirmed: ') + payload.giftId + ' × ' + payload.count;
        } else if (event.kind === 'channel.program') {
            text = payload.mode === 'pk' ? '已切换为 PK 画面' : '直播 PK 状态已更新';
        } else if (event.kind === 'stage.policy') {
            text = 'Stage mode: ' + payload.mode + ' · seats: ' + payload.capacity;
        } else if (event.kind === 'stage.member') {
            text = 'Stage participant: ' + event.entityId + ' · ' + payload.state;
        } else if (event.kind === 'room.state') {
            text = 'Room: ' + payload.state;
        } else if (event.kind === 'media.resource') {
            text = 'Media resource: ' + payload.purpose + ' · ' + payload.state;
        } else {
            text = event.kind === 'media.publication' ? 'Media: ' + payload.state : 'Room permissions or media updated';
        }
        var timestamp = event.occurredAt.high * 4294967296 + event.occurredAt.low;
        return { id: hex(meta.messageId), from: Protocol.giftEvent(event.kind) ? payload.senderId : 'Room',
            text: text, state: 'saved', align: 'left', reliable: true, sequence: meta.messageSequence,
            messageId: meta.messageId, timestamp: timestamp, time: new Date(timestamp).toLocaleString(), incoming: false, roomEvent: true };
    }
    function event(record) {
        var fields = Protocol.decode(record.packet).fields[1].value, meta = object(fields);
        return fact(object(fields[4].value), meta);
    }
    function compare(left, right) {
        if (left.roomEvent || right.roomEvent || left.ephemeral || right.ephemeral) {
            return left.timestamp - right.timestamp || left.id.localeCompare(right.id);
        }
        if (left.sequence && right.sequence) { return Protocol.compare64(left.sequence, right.sequence); }
        if (left.sequence || right.sequence) { return left.sequence ? -1 : 1; }
        return left.timestamp - right.timestamp || left.id.localeCompare(right.id);
    }
    // Keep packet decoding and content projection inside the SDK. This read
    // does not acknowledge a message or repeat a business operation.
    function pendingPage(storage, user, after, limit) {
        if (after && !/^[0-9a-f]{32}$/.test(after)) { return Promise.reject(new TypeError('Invalid outbox page position.')); }
        return storage.pending(limit, after).then(function (records) {
            var items = records.map(function (record) {
                var value = outgoing(record, user);
                return { id: record.id, conversationId: record.conversationId, text: value.text.slice(0, 240),
                    timestamp: value.timestamp, state: record.state, gift: value.gift };
            });
            // The byte bound can end a short page before the row limit.
            return { items: items, cursor: items.length ? items[items.length - 1].id : '' };
        });
    }
    UI.History = { object: object, hex: hex, received: received, message: message, outgoing: outgoing, fact: fact, event: event, compare: compare,
        pendingPage: pendingPage, attachment: attachment };
})(odd);
