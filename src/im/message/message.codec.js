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
        MAX_DEPTH = Protocol.MAX_DEPTH;

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

    function _consume(budget) {
        if (++budget.count > MAX_FIELDS) {
            _fail('QuotaExceededError', 'Too many fields or array elements.');
        }
    }

    // Prepare and measure once, then allocate the exact packet size. Containers are
    // ordered arrays, not arbitrary JavaScript object property enumerations.
    function _prepare(entries, object, depth, budget, limit) {
        if (!Array.isArray(entries)) {
            _fail('TypeError', 'Expected an ordered entry array.');
        }
        var nodes = [], size = 0, seen = Object.create(null);
        for (var i = 0; i < entries.length; i++) {
            _consume(budget);
            var entry = entries[i];
            if (!entry || !_integer(entry.type, Type.NULL, Type.ARRAY)) {
                _fail('DataError', 'Unsupported value type.');
            }
            var node = { type: entry.type, value: entry.value, size: 1 };
            if (object) {
                node.key = _text(entry.key);
                if (!node.key.length || node.key.length > 63 || seen[entry.key]) {
                    _fail('DataError', 'Invalid or repeated key.');
                }
                seen[entry.key] = true;
                node.size += 1 + node.key.length;
            }
            var value = entry.value, length = 0;
            switch (entry.type) {
                case Type.NULL:
                    if (value !== null) {
                        _fail('TypeError', 'NULL requires null.');
                    }
                    break;
                case Type.BOOL:
                    if (typeof value !== 'boolean') {
                        _fail('TypeError', 'BOOL requires a boolean.');
                    }
                    length = 1;
                    break;
                case Type.UINT8:
                case Type.UINT16:
                case Type.UINT32:
                    length = entry.type === Type.UINT8 ? 1 : entry.type === Type.UINT16 ? 2 : 4;
                    if (!_integer(value, 0, Math.pow(256, length) - 1)) {
                        _fail('DataError', 'Unsigned _integer out of range.');
                    }
                    break;
                case Type.UINT64:
                case Type.INT64:
                    if (!value || !_integer(value.high, 0, 4294967295) ||
                        !_integer(value.low, 0, 4294967295)) {
                        _fail('TypeError', '64-bit integers require exact high/low uint32 words.');
                    }
                    node.value = { high: value.high, low: value.low };
                    length = 8;
                    break;
                case Type.FLOAT64:
                    if (typeof value !== 'number' || !isFinite(value)) {
                        _fail('DataError', 'FLOAT64 requires a finite number.');
                    }
                    length = 8;
                    break;
                case Type.STRING:
                    node.value = _text(value);
                    length = node.value.length;
                    break;
                case Type.BYTES:
                    node.value = _bytes(value);
                    length = node.value.length;
                    break;
                case Type.OBJECT:
                case Type.ARRAY:
                    if (depth >= MAX_DEPTH) {
                        _fail('QuotaExceededError', 'Containers are too deep.');
                    }
                    node.value = _prepare(value, entry.type === Type.OBJECT, depth + 1, budget, 65535);
                    length = node.value.size;
                    break;
            }
            if (length > 65535) {
                _fail('QuotaExceededError', 'Value exceeds local length capacity.');
            }
            node.length = length;
            node.size += length + (entry.type >= Type.STRING ? 2 : 0);
            size += node.size;
            if (size > limit) {
                _fail('QuotaExceededError', 'Packet or container exceeds its limit.');
            }
            nodes.push(node);
        }
        return { nodes: nodes, size: size };
    }

    function _writePrepared(prepared, output, view, offset) {
        for (var i = 0; i < prepared.nodes.length; i++) {
            var node = prepared.nodes[i];
            if (node.key) {
                output[offset++] = node.key.length;
                output.set(node.key, offset);
                offset += node.key.length;
            }
            output[offset++] = node.type;
            if (node.type >= Type.STRING) {
                view.setUint16(offset, node.length);
                offset += 2;
            }
            switch (node.type) {
                case Type.NULL: break;
                case Type.BOOL: output[offset] = node.value ? 1 : 0; break;
                case Type.UINT8: output[offset] = node.value; break;
                case Type.UINT16: view.setUint16(offset, node.value); break;
                case Type.UINT32: view.setUint32(offset, node.value); break;
                case Type.UINT64:
                case Type.INT64:
                    view.setUint32(offset, node.value.high);
                    view.setUint32(offset + 4, node.value.low);
                    break;
                case Type.FLOAT64: view.setFloat64(offset, node.value); break;
                case Type.STRING:
                case Type.BYTES: output.set(node.value, offset); break;
                case Type.OBJECT:
                case Type.ARRAY: _writePrepared(node.value, output, view, offset); break;
            }
            offset += node.length;
        }
        return offset;
    }

    function _encode(message, scope) {
        Protocol.validateEnvelope(message, scope);
        var prepared = _prepare(message.fields, true, 0, { count: 0 }, _packetLimit(scope) - HEADER_SIZE),
            output = new Uint8Array(HEADER_SIZE + prepared.size),
            view = new DataView(output.buffer);
        output[0] = 0xA2;
        output[1] = message.messaging ? 1 : 0;
        view.setUint16(2, message.sequenceNumber);
        output[4] = message.opcode;
        _writePrepared(prepared, output, view, HEADER_SIZE);
        return output;
    }

    function _readEntries(input, view, start, end, object, depth, budget) {
        var entries = [], seen = Object.create(null), offset = start;
        while (offset < end) {
            _consume(budget);
            var entry = {}, length;
            if (object) {
                length = input[offset++];
                if (!length || length > 63 || length > end - offset) {
                    _fail('DataError', 'Invalid or truncated key.');
                }
                entry.key = _readText(input.subarray(offset, offset + length));
                offset += length;
                if (seen[entry.key]) {
                    _fail('DataError', 'Repeated key.');
                }
                seen[entry.key] = true;
            }
            if (offset >= end) {
                _fail('DataError', 'Missing value type.');
            }
            entry.type = input[offset++];
            if (entry.type > Type.ARRAY) {
                _fail('DataError', 'Unsupported value type.');
            }
            if (entry.type >= Type.STRING) {
                if (end - offset < 2) {
                    _fail('DataError', 'Truncated local length.');
                }
                length = view.getUint16(offset);
                offset += 2;
            } else {
                length = [0, 1, 1, 2, 4, 8, 8, 8][entry.type];
            }
            if (length > end - offset) {
                _fail('DataError', 'Truncated value.');
            }
            switch (entry.type) {
                case Type.NULL: entry.value = null; break;
                case Type.BOOL:
                    if (input[offset] > 1) {
                        _fail('DataError', 'Invalid BOOL.');
                    }
                    entry.value = input[offset] === 1;
                    break;
                case Type.UINT8: entry.value = input[offset]; break;
                case Type.UINT16: entry.value = view.getUint16(offset); break;
                case Type.UINT32: entry.value = view.getUint32(offset); break;
                case Type.UINT64:
                case Type.INT64:
                    entry.value = { high: view.getUint32(offset), low: view.getUint32(offset + 4) };
                    break;
                case Type.FLOAT64:
                    entry.value = view.getFloat64(offset);
                    if (!isFinite(entry.value)) {
                        _fail('DataError', 'Nonfinite FLOAT64.');
                    }
                    break;
                case Type.STRING: entry.value = _readText(input.subarray(offset, offset + length)); break;
                case Type.BYTES:
                    entry.value = new Uint8Array(input.subarray(offset, offset + length));
                    break;
                case Type.OBJECT:
                case Type.ARRAY:
                    if (depth >= MAX_DEPTH) {
                        _fail('QuotaExceededError', 'Containers are too deep.');
                    }
                    entry.value = _readEntries(input, view, offset, offset + length,
                        entry.type === Type.OBJECT, depth + 1, budget);
                    break;
            }
            offset += length;
            entries.push(entry);
        }
        return entries;
    }

    function _decode(packet, scope) {
        var input = _bytes(packet), limit = _packetLimit(scope);
        if (input.length < HEADER_SIZE || input.length > limit) {
            _fail('DataError', 'Invalid packet length.');
        }
        if (input[0] !== 0xA2) {
            _fail('VersionError', 'Unsupported magic/version.');
        }
        if (input[1] & 0xFE) {
            _fail('DataError', 'Nonzero reserved flags.');
        }
        var view = new DataView(input.buffer, input.byteOffset, input.byteLength),
            message = { messaging: input[1] !== 0, sequenceNumber: view.getUint16(2),
                opcode: input[4], fields: _readEntries(input, view, HEADER_SIZE, input.length,
                    true, 0, { count: 0 }) };
        Protocol.validateEnvelope(message, scope);
        return message;
    }

    function _uint(value, width) {
        if ((width !== 1 && width !== 2 && width !== 4) ||
            !_integer(value, 0, Math.pow(256, width) - 1)) {
            _fail('DataError', 'Invalid unsigned _integer.');
        }
        var output = new Uint8Array(width);
        for (var i = width - 1; i >= 0; i--) {
            output[i] = value % 256;
            value = Math.floor(value / 256);
        }
        return output;
    }

    function _readUint(value) {
        var input = _bytes(value),
            number = 0;
        if (input.byteLength !== 1 && input.byteLength !== 2 && input.byteLength !== 4) {
            _fail('DataError', 'Expected a 1, 2 or 4 byte _integer.');
        }
        for (var i = 0; i < input.byteLength; i++) {
            number = number * 256 + input[i];
        }
        return number;
    }

    // Two uint32 words avoid BigInt and unsafe JS Number truncation on mini-apps.
    function _uint64(high, low) {
        var output = new Uint8Array(8);
        output.set(_uint(high, 4));
        output.set(_uint(low, 4), 4);
        return output;
    }

    function _readUint64(value) {
        var input = _bytes(value);
        if (input.byteLength !== 8) {
            _fail('DataError', 'Expected an 8 byte _integer.');
        }
        return { high: _readUint(input.subarray(0, 4)), low: _readUint(input.subarray(4)) };
    }

    function _text(value) {
        if (typeof value !== 'string' || value.length > 65535) {
            _fail('DataError', 'Invalid _text field.');
        }
        var output = [];
        for (var i = 0; i < value.length; i++) {
            var code = value.charCodeAt(i);
            if (code >= 0xD800 && code <= 0xDBFF) {
                var low = value.charCodeAt(++i);
                if (!(low >= 0xDC00 && low <= 0xDFFF)) {
                    _fail('DataError', 'Unpaired UTF-16 surrogate.');
                }
                code = 0x10000 + ((code - 0xD800) << 10) + low - 0xDC00;
            } else if (code >= 0xDC00 && code <= 0xDFFF) {
                _fail('DataError', 'Unpaired UTF-16 surrogate.');
            }
            if (code < 0x80) {
                output.push(code);
            } else if (code < 0x800) {
                output.push(0xC0 | (code >>> 6), 0x80 | (code & 63));
            } else if (code < 0x10000) {
                output.push(0xE0 | (code >>> 12), 0x80 | ((code >>> 6) & 63), 0x80 | (code & 63));
            } else {
                output.push(0xF0 | (code >>> 18), 0x80 | ((code >>> 12) & 63),
                    0x80 | ((code >>> 6) & 63), 0x80 | (code & 63));
            }
            if (output.length > 65535) {
                _fail('QuotaExceededError', 'Text exceeds field capacity.');
            }
        }
        return new Uint8Array(output);
    }

    function _readText(value) {
        var input = _bytes(value),
            output = [],
            offset = 0;
        if (input.byteLength > 65535) {
            _fail('QuotaExceededError', 'Text exceeds field capacity.');
        }
        while (offset < input.byteLength) {
            var code = input[offset++],
                remaining = 0,
                minimum = 0;
            if (code >= 0xC2 && code <= 0xDF) {
                code &= 31;
                remaining = 1;
                minimum = 0x80;
            } else if (code >= 0xE0 && code <= 0xEF) {
                code &= 15;
                remaining = 2;
                minimum = 0x800;
            } else if (code >= 0xF0 && code <= 0xF4) {
                code &= 7;
                remaining = 3;
                minimum = 0x10000;
            } else if (code >= 0x80) {
                _fail('DataError', 'Invalid UTF-8 leading byte.');
            }
            if (remaining > input.byteLength - offset) {
                _fail('DataError', 'Truncated UTF-8 sequence.');
            }
            for (var i = 0; i < remaining; i++) {
                var next = input[offset++];
                if ((next & 192) !== 128) {
                    _fail('DataError', 'Invalid UTF-8 continuation.');
                }
                code = (code << 6) | (next & 63);
            }
            if (code < minimum || code > 0x10FFFF || (code >= 0xD800 && code <= 0xDFFF)) {
                _fail('DataError', 'Invalid UTF-8 code point.');
            }
            if (code < 0x10000) {
                output.push(String.fromCharCode(code));
            } else {
                code -= 0x10000;
                output.push(String.fromCharCode(0xD800 + (code >>> 10), 0xDC00 + (code & 1023)));
            }
        }
        return output.join('');
    }

    Protocol.encode = _encode;
    Protocol.decode = _decode;
    Protocol.uint = _uint;
    Protocol.readUint = _readUint;
    Protocol.uint64 = _uint64;
    Protocol.readUint64 = _readUint64;
    Protocol.text = _text;
    Protocol.readText = _readText;
})(odd);

