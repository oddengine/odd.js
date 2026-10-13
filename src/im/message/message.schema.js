(function (odd) {
    var IM = odd.IM,
        Protocol = IM.Protocol,
        Type = Protocol.Type,
        Opcode = Protocol.Opcode,
        Status = Protocol.Status,
        EventCode = Protocol.Event,
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
            _validateFields(message.fields, [
                { key: 'event', type: Type.UINT16 },
                { key: 'data', type: Type.OBJECT },
            ]);
            var event = message.fields[0].value;
            if (!_integer(event, 1, 65534) || (event & 255) === 0 || (scope !== 'peer' && event >= 0xFF00)) {
                _fail('DataError', 'Invalid event code.');
            }
        }
    }

    function _validateTarget(fields) {
        _validateFields(fields, [
            { key: 'type', type: Type.STRING },
            { key: 'id', type: Type.STRING },
            { key: 'deviceId', type: Type.STRING, required: false },
        ]);
        var kind = fields[0].value;
        if (['room', 'group', 'user', 'endpoint', 'conversation', 'stream'].indexOf(kind) < 0 ||
            (kind === 'endpoint') !== (fields.length === 3)) {
            _fail('DataError', 'Invalid target type or device.');
        }
        for (var i = 1; i < fields.length; i++) {
            var value = fields[i].value;
            if (!value || _text(value).length > 128 || /[\x00-\x1F\x7F]/.test(value)) {
                _fail('DataError', 'Target identifier is outside its bounds.');
            }
        }
        return kind;
    }

    function _validateMessageRequest(message) {
        _validateEnvelope(message, 'public');
        if (message.opcode !== Opcode.PUBLISH) {
            _fail('NotSupportedError', 'Expected a publish operation.');
        }
        _validateFields(message.fields, [
            { key: 'target', type: Type.OBJECT },
            { key: 'body', type: Type.OBJECT },
            { key: 'ext', type: Type.OBJECT, required: false },
        ]);
        var kind = _validateTarget(message.fields[0].value);
        if (kind === 'stream' || (message.messaging && kind !== 'conversation')) {
            _fail('NotSupportedError', 'The target does not support this delivery mode.');
        }

        var body = message.fields[1].value,
            contentIndex = message.messaging ? 2 : 1,
            content = body[contentIndex],
            rules = [];
        if (!content || (content.type !== Type.STRING && content.type !== Type.BYTES)) {
            _fail('TypeError', 'Message content must be STRING or BYTES.');
        }
        if (message.messaging) {
            rules.push({ key: 'clientMessageId', type: Type.BYTES });
        }
        rules.push({ key: 'type', type: Type.STRING }, { key: 'content', type: content.type });
        rules.push({ key: 'ext', type: Type.OBJECT, required: false });
        _validateFields(body, rules);
        var type = body[message.messaging ? 1 : 0].value;
        if (['text', 'binary'].indexOf(type) < 0 || (type === 'text') !== (content.type === Type.STRING)) {
            _fail('NotSupportedError', 'Invalid or unsupported message type.');
        }
        if (message.messaging && _bytes(body[0].value).length !== 16) {
            _fail('DataError', 'clientMessageId must contain 16 bytes.');
        }
        if ((content.type === Type.STRING ? _text(content.value) : _bytes(content.value)).length > 16384) {
            _fail('QuotaExceededError', 'Message content exceeds 16384 bytes.');
        }
    }

    function _validateResult(opcode, messaging, fields) {
        var rules = [];
        switch (opcode) {
            case Opcode.AUTHENTICATE:
                rules = [
                    { key: 'authRevision', type: Type.UINT64 },
                    { key: 'expiresAt', type: Type.UINT64 },
                ];
                break;
            case Opcode.SUBSCRIBE:
                rules = [
                    { key: 'subscriptionId', type: Type.STRING },
                    { key: 'target', type: Type.OBJECT },
                    { key: 'cursor', type: Type.UINT64 },
                ];
                // Both resource operations return the same permission fields.
            case Opcode.REFRESH:
                rules = rules.concat([
                    { key: 'authorizationId', type: Type.STRING },
                    { key: 'revision', type: Type.UINT64 },
                    { key: 'generation', type: Type.UINT64 },
                    { key: 'expiresAt', type: Type.UINT64 },
                    { key: 'actions', type: Type.UINT64 },
                ]);
                break;
            case Opcode.PUBLISH:
                if (messaging) {
                    rules = [
                        { key: 'messageId', type: Type.BYTES },
                        { key: 'conversationId', type: Type.STRING },
                        { key: 'messageSequence', type: Type.UINT64 },
                    ];
                }
                break;
            case Opcode.INSPECT:
                rules = [{ key: 'messageId', type: Type.BYTES }, { key: 'state', type: Type.STRING }];
                break;
            case Opcode.FETCH:
            case Opcode.SYNC:
            case Opcode.LIST:
                rules = [
                    { key: 'items', type: Type.ARRAY },
                    { key: 'nextCursor', type: Type.BYTES },
                    { key: 'hasMore', type: Type.BOOL },
                ];
                break;
            case Opcode.RESOLVE:
                rules = [
                    { key: 'conversationId', type: Type.STRING },
                    { key: 'revision', type: Type.UINT64 },
                ];
                break;
            case Opcode.PRESENCE:
                rules = [
                    { key: 'userId', type: Type.STRING },
                    { key: 'online', type: Type.BOOL },
                    { key: 'revision', type: Type.UINT64 },
                ];
                break;
            case Opcode.UNSUBSCRIBE:
            case Opcode.COMMIT:
            case Opcode.READ:
            case Opcode.CALL:
                break;
            default:
                return;
        }
        rules.push({ key: 'ext', type: Type.OBJECT, required: false });
        _validateFields(fields, rules);
        for (var i = 0; i < fields.length; i++) {
            var field = fields[i];
            if (field.key === 'target') {
                _validateTarget(field.value);
            }
            if (field.key === 'messageId' && _bytes(field.value).length !== 16) {
                _fail('DataError', 'Invalid result messageId.');
            }
            if (field.type === Type.STRING && (!field.value || _text(field.value).length > 128)) {
                _fail('DataError', 'Invalid result identifier.');
            }
            if (field.key === 'nextCursor' && _bytes(field.value).length > 512) {
                _fail('DataError', 'Result cursor exceeds its limit.');
            }
            if (field.key === 'items') {
                field.value.forEach(function (item) {
                    if (item.type !== Type.OBJECT) {
                        _fail('DataError', 'Result page items must be OBJECT.');
                    }
                });
            }
        }
    }

    Protocol.validateFields = _validateFields;
    Protocol.validateEnvelope = _validateEnvelope;
    Protocol.validateTarget = _validateTarget;
    Protocol.validateMessageRequest = _validateMessageRequest;
    Protocol.validateResult = _validateResult;
})(odd);

