(function (odd) {
    var IM = odd.IM,
        Protocol = IM.Protocol,
        Opcode = Protocol.Opcode,
        Status = Protocol.Status;

    function _fail(name, message) {
        var error = new Error(message);
        error.name = name;
        throw error;
    }

    function _integer(value, minimum, maximum) {
        return typeof value === 'number' && isFinite(value) &&
            Math.floor(value) === value && value >= minimum && value <= maximum;
    }

    function RequestTable(generation, maxPending, maxRecords) {
        var _this = this;

        function _init() {
            _this.generation = generation;
            _this.maxPending = maxPending === undefined ? 64 : maxPending;
            _this.maxRecords = maxRecords === undefined ? 256 : maxRecords;
            if (!_integer(generation, 1, 9007199254740991) ||
                !_integer(_this.maxPending, 1, 65535) ||
                !_integer(_this.maxRecords, _this.maxPending, 65535)) {
                _fail('TypeError', 'Invalid request table limits or generation.');
            }

            _this.records = Object.create(null);
            _this.next = 1;
            _this.pending = 0;
            _this.size = 0;
            _this.closed = false;
        }

        _this.add = function (opcode, messaging, responder, now, timeout) {
            if (_this.closed || !_integer(opcode, 3, 254) || opcode === Opcode.FORWARD ||
                typeof messaging !== 'boolean' || !_integer(now, 0, 9007199254740991) ||
                !_integer(timeout, 1, 9007199254740991 - now)) {
                _fail('InvalidStateError', 'Invalid request registration.');
            }
            if (_this.pending >= _this.maxPending || _this.size >= _this.maxRecords) {
                _fail('QuotaExceededError', 'Request table capacity reached.');
            }
            if (_this.records[_this.next]) {
                _fail('InvalidStateError', 'Next sequence number is still occupied.');
            }
            var sn = _this.next;
            _this.records[sn] = { sequenceNumber: sn, opcode: opcode, messaging: messaging,
                responder: responder, deadline: now + timeout, retired: false };
            _this.next = sn === 65535 ? 1 : sn + 1;
            _this.pending++;
            _this.size++;
            return sn;
        };

        _this.retire = function (sn) {
            var record = _this.records[sn];
            if (_this.closed || !_integer(sn, 1, 65535) || !record) {
                _fail('NotFoundError', 'Unknown request.');
            }
            if (!record.retired) {
                record.retired = true;
                record.responder = null;
                _this.pending--;
            }
        };

        // Returns local expirations for the connection to settle separately. They are
        // not fabricated STATUS messages; all records are retired before caller callbacks.
        _this.expire = function (now) {
            if (!_integer(now, 0, 9007199254740991)) {
                _fail('TypeError', 'Invalid monotonic time.');
            }
            var expired = [];
            for (var sn in _this.records) {
                var record = _this.records[sn];
                if (!record.retired && record.deadline <= now) {
                    expired.push({ sequenceNumber: record.sequenceNumber, opcode: record.opcode,
                        messaging: record.messaging, responder: record.responder });
                    _this.retire(record.sequenceNumber);
                }
            }
            return expired;
        };

        // Input must already pass decode and the original operation's result schema.
        // Complete never catches business callback exceptions; the record is already gone.
        _this.complete = function (message, generation) {
            if (_this.closed || generation !== _this.generation) {
                _fail('InvalidStateError', 'Stale connection generation.');
            }
            Protocol.validateEnvelope(message, 'peer');
            if (message.opcode !== Opcode.STATUS) {
                _fail('DataError', 'Expected STATUS.');
            }
            var record = _this.records[message.sequenceNumber];
            if (!record) {
                return false;
            }
            if (message.messaging !== record.messaging) {
                _fail('DataError', 'Response mode mismatch.');
            }
            delete _this.records[message.sequenceNumber];
            _this.size--;
            if (record.retired) {
                return false;
            }
            _this.pending--;
            var responder = record.responder,
                callback = responder && (message.fields[0].value === Status.OK ? responder.result : responder.status);
            if (typeof callback === 'function') {
                callback.call(responder, message);
            }
            return true;
        };

        _this.close = function () {
            var pending = [];
            _this.closed = true;
            for (var sn in _this.records) {
                if (!_this.records[sn].retired) {
                    pending.push(_this.records[sn]);
                }
            }
            _this.records = Object.create(null);
            _this.pending = 0;
            _this.size = 0;
            return pending;
        };


        _init();
    }

    RequestTable.prototype.kind = 'RequestTable';
    IM.RequestTable = RequestTable;
})(odd);

