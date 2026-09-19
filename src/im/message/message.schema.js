(function (odd) {
    var IM = odd.IM,
        Protocol = IM.Protocol,
        Type = Protocol.Type,
        Opcode = Protocol.Opcode,
        Status = Protocol.Status,
        HEADER_SIZE = Protocol.HEADER_SIZE,
        MAX_PACKET_SIZE = Protocol.MAX_PACKET_SIZE,
        MAX_PEER_PACKET_SIZE = Protocol.MAX_PEER_PACKET_SIZE,
        MAX_FIELDS = Protocol.MAX_FIELDS,
        _text = Protocol.text;

    function _fail(name, message) {
        var error = new Error(message);
        error.name = name;
        throw error;
    }

    function _integer(value, minimum, maximum) {
        return typeof value === 'number' && isFinite(value) &&
            Math.floor(value) === value && value >= minimum && value <= maximum;
    }

    function _bytes(value) {
        if (value instanceof ArrayBuffer) {
            return new Uint8Array(value);
        }
        if (ArrayBuffer.isView(value)) {
            return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        }
        _fail('TypeError', 'Expected ArrayBuffer or an ArrayBuffer view.');
    }

    function _packetLimit(scope) {
        if (scope === undefined || scope === 'public') {
            return MAX_PACKET_SIZE;
        }
        if (scope === 'peer') {
            return MAX_PEER_PACKET_SIZE;
        }
        _fail('TypeError', 'Invalid wire scope.');
    }

    // Rules describe exact order; optional entries can be omitted, never reordered.
    // Semantic handlers must additionally check values, permissions and nested schemas.
    function _validateFields(fields, rules) {
        if (!Array.isArray(fields) || !Array.isArray(rules) || fields.length > MAX_FIELDS || rules.length > MAX_FIELDS) {
            _fail('TypeError', 'Expected field and rule arrays.');
        }
        var offset = 0, seen = Object.create(null);
        for (var i = 0; i < rules.length; i++) {
            var rule = rules[i];
            if (!rule || typeof rule.key !== 'string' || !rule.key || seen[rule.key] ||
                !_integer(rule.type, Type.NULL, Type.ARRAY)) {
                _fail('TypeError', 'Invalid schema rule.');
            }
            seen[rule.key] = true;
            var field = fields[offset];
            if (!field || field.key !== rule.key) {
                if (rule.required !== false) {
                    _fail('DataError', 'Missing or misplaced field: ' + rule.key);
                }
                continue;
            }
            if (field.type !== rule.type) {
                _fail('DataError', 'Wrong value type: ' + rule.key);
            }
            offset++;
        }
        if (offset !== fields.length) {
            _fail('DataError', 'Unknown, repeated or misplaced field.');
        }
    }

    function _validateEnvelope(message, scope) {
        _packetLimit(scope);
        if (!message || typeof message.messaging !== 'boolean' ||
            !_integer(message.sequenceNumber, 0, 65535) ||
            !_integer(message.opcode, 1, 254) || !Array.isArray(message.fields)) {
            _fail('DataError', 'Invalid message envelope.');
        }
        if (scope !== 'peer' && message.opcode >= 0x80 && message.opcode <= 0x8F) {
            _fail('NotAllowedError', 'Peer opcode on a public connection.');
        }
        var event = message.opcode === Opcode.NOTIFY || message.opcode === Opcode.FORWARD;
        if (event !== (message.sequenceNumber === 0)) {
            _fail('DataError', 'Invalid sequence number for this opcode.');
        }
        if (message.opcode === Opcode.STATUS) {
            _validateFields(message.fields, [
                { key: 'code', type: Type.UINT8 },
                { key: 'description', type: Type.STRING, required: false },
                { key: 'retryAfterMs', type: Type.UINT32, required: false },
                { key: 'info', type: Type.OBJECT, required: false },
                { key: 'ext', type: Type.OBJECT, required: false }
            ]);
            if (!_integer(message.fields[0].value, 0, 255)) {
                _fail('DataError', 'Invalid status code.');
            }
            for (var i = 1; i < message.fields.length; i++) {
                if (message.fields[i].key === 'description' && _text(message.fields[i].value).length > 1024) {
                    _fail('QuotaExceededError', 'Status description exceeds 1024 _bytes.');
                }
            }
        }
        if (message.opcode === Opcode.NOTIFY) {
            var first = message.fields[0];
            if (!first || first.key !== 'event' || first.type !== Type.UINT16 ||
                !_integer(first.value, 1, 65534) || (first.value & 255) === 0 ||
                (scope !== 'peer' && first.value >= 0xFF00)) {
                _fail('DataError', 'Missing or invalid event code.');
            }
        }
    }

    // Four public _text/binary publishing operations. This checks shape and size,
    // not room membership, online presence or the availability of durable storage.
    function _validateMessageRequest(message) {
        _validateEnvelope(message, 'public');
        prepare(message.fields, true, 0, { count: 0 }, MAX_PACKET_SIZE - HEADER_SIZE);
        var rules, targetCount;
        switch (message.opcode) {
            case Opcode.ROOM_MESSAGE: rules = [{ key: 'roomId', type: Type.STRING }]; break;
            case Opcode.GROUP_MESSAGE: rules = [{ key: 'groupId', type: Type.STRING }]; break;
            case Opcode.USER_MESSAGE: rules = [{ key: 'userId', type: Type.STRING }]; break;
            case Opcode.ENDPOINT_MESSAGE:
                rules = [{ key: 'userId', type: Type.STRING }, { key: 'endpointId', type: Type.STRING }];
                break;
            default: _fail('NotSupportedError', 'Expected a _text/binary publishing opcode.');
        }
        if (message.messaging && message.opcode !== Opcode.GROUP_MESSAGE && message.opcode !== Opcode.USER_MESSAGE) {
            _fail('NotSupportedError', 'This target supports only Relay.');
        }
        targetCount = rules.length;
        rules.push({ key: 'body', type: Type.OBJECT });
        rules.push({ key: 'ext', type: Type.OBJECT, required: false });
        _validateFields(message.fields, rules);
        for (var i = 0; i < targetCount; i++) {
            var length = _text(message.fields[i].value).length;
            if (!length || length > 128) {
                _fail('DataError', 'Target ID is outside 1..128 _bytes.');
            }
        }
        var body = message.fields[targetCount].value,
            contentIndex = message.messaging ? 1 : 0,
            content = body[contentIndex],
            bodyRules = [];
        if (!content || (content.type !== Type.STRING && content.type !== Type.BYTES)) {
            _fail('TypeError', 'Message content must be STRING or BYTES.');
        }
        if (message.messaging) { bodyRules.push({ key: 'clientMessageId', type: Type.BYTES }); }
        bodyRules.push({ key: 'content', type: content.type });
        bodyRules.push({ key: 'ext', type: Type.OBJECT, required: false });
        _validateFields(body, bodyRules);
        if (message.messaging && _bytes(body[0].value).length !== 16) {
            _fail('DataError', 'clientMessageId must be 16 _bytes.');
        }
        if ((content.type === Type.STRING ? _text(content.value) : _bytes(content.value)).length > 16384) {
            _fail('QuotaExceededError', 'Message content exceeds 16384 _bytes.');
        }
    }

    // The original opcode remains in the request table; STATUS itself has none.
    function _validateResult(opcode, messaging, fields) {
        var rules = [], items = null;
        function _add(key, type) { rules.push({ key: key, type: type }); }
        switch (opcode) {
            case Opcode.REAUTH:
                _add('authRevision', Type.UINT64); _add('expiresAt', Type.UINT64); break;
            case Opcode.CAPS:
                _add('version', Type.UINT8); _add('opcodes', Type.ARRAY); _add('events', Type.ARRAY);
                _add('maxPacketBytes', Type.UINT32); _add('maxPending', Type.UINT16); break;
            case Opcode.PERMISSION_REFRESH:
                _add('revision', Type.UINT64); _add('expiresAt', Type.UINT64); break;
            case Opcode.ROOM_JOIN:
            case Opcode.CONVERSATION_WATCH:
                _add(opcode === Opcode.ROOM_JOIN ? 'roomId' : 'conversationId', Type.STRING);
                _add('revision', Type.UINT64); _add('expiresAt', Type.UINT64); break;
            case Opcode.GROUP_MESSAGE:
            case Opcode.USER_MESSAGE:
                if (messaging) {
                    _add('messageId', Type.BYTES); _add('conversationId', Type.STRING); _add('messageSequence', Type.UINT64);
                }
                break;
            case Opcode.STATUS_GET:
                _add('messageId', Type.BYTES); _add('state', Type.UINT8); break;
            case Opcode.MESSAGE_GET:
                _add('notification', Type.OBJECT); break;
            case Opcode.SYNC:
            case Opcode.HISTORY:
            case Opcode.CONVERSATION_LIST:
                _add('items', Type.ARRAY); _add('nextCursor', Type.BYTES); _add('hasMore', Type.BOOL); break;
            case Opcode.SYNC_COMMIT: _add('cursor', Type.BYTES); break;
            case Opcode.CONVERSATION_RESOLVE:
                _add('conversationId', Type.STRING); _add('revision', Type.UINT64); break;
            case Opcode.ONLINE_QUERY:
            case Opcode.ONLINE_WATCH:
                _add('userId', Type.STRING); _add('online', Type.BOOL); _add('revision', Type.UINT64); break;
            case Opcode.ROOM_LEAVE:
            case Opcode.CONVERSATION_UNWATCH:
            case Opcode.ROOM_MESSAGE:
            case Opcode.ENDPOINT_MESSAGE:
            case Opcode.RECEIVED:
            case Opcode.READ:
            case Opcode.ONLINE_UNWATCH:
            case Opcode.CALL_INVITE:
            case Opcode.CALL_RINGING:
            case Opcode.CALL_ACCEPT:
            case Opcode.CALL_REJECT:
            case Opcode.CALL_SELECT:
            case Opcode.CALL_CANCEL:
            case Opcode.CALL_END:
            case Opcode.LIKE:
            case Opcode.REACTION:
            case Opcode.ROOM_EFFECT:
            case Opcode.GIFT_CONFIRMED:
            case Opcode.GIFT_COMBO_UPDATE:
            case Opcode.GIFT_COMBO_END: break;
            default: return;  // A negotiated extension supplies its own validator.
        }
        rules.push({ key: 'ext', type: Type.OBJECT, required: false });
        _validateFields(fields, rules);
        for (var i = 0; i < fields.length; i++) {
            var entry = fields[i];
            if (entry.key === 'messageId' && entry.value.length !== 16) {
                _fail('DataError', 'Invalid result messageId.');
            }
            if (entry.type === Type.STRING && (!entry.value || _text(entry.value).length > 128)) {
                _fail('DataError', 'Invalid result identifier.');
            }
            if ((entry.key === 'cursor' || entry.key === 'nextCursor') && entry.value.length > 512) {
                _fail('DataError', 'Result cursor exceeds its limit.');
            }
            if (entry.key === 'state' && !_integer(entry.value, 1, 3)) {
                _fail('DataError', 'Invalid message state.');
            }
            if (entry.key === 'items') {
                items = entry.value;
            }
        }
        if (opcode === Opcode.CAPS) {
            if (fields[0].value !== 2 || !_integer(fields[3].value, HEADER_SIZE, MAX_PACKET_SIZE) ||
                !_integer(fields[4].value, 1, 65535)) { _fail('DataError', 'Invalid server capabilities.'); }
            fields[1].value.forEach(function (item) {
                if (item.type !== Type.UINT8) {
                    _fail('DataError', 'Invalid capability opcode type.');
                }
            });
            fields[2].value.forEach(function (item) {
                if (item.type !== Type.UINT16) {
                    _fail('DataError', 'Invalid capability event type.');
                }
            });
        }
        if (items) {
            items.forEach(function (item) {
                if (item.type !== Type.OBJECT) {
                    _fail('DataError', 'Result page items must be OBJECT.');
                }
                if (opcode === Opcode.CONVERSATION_LIST) {
                    _validateFields(item.value, [{ key: 'conversationId', type: Type.STRING },
                        { key: 'revision', type: Type.UINT64 }, { key: 'ext', type: Type.OBJECT, required: false }]);
                } else {
                    _validateEnvelope({ opcode: Opcode.NOTIFY, messaging: true, sequenceNumber: 0, fields: item.value });
                }
            });
        }
        if (opcode === Opcode.MESSAGE_GET) {
            _validateEnvelope({ opcode: Opcode.NOTIFY, messaging: true, sequenceNumber: 0, fields: fields[0].value });
        }
    }

    Protocol.validateFields = _validateFields;
    Protocol.validateEnvelope = _validateEnvelope;
    Protocol.validateMessageRequest = _validateMessageRequest;
    Protocol.validateResult = _validateResult;
})(odd);

