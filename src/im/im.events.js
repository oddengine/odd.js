(function (odd) {
    var IM = odd.IM,
        Protocol = IM.Protocol,
        Type = Protocol.Type,
        Opcode = Protocol.Opcode;

    function _error(name, message) {
        var error = new Error(message);
        error.name = name;
        return error;
    }

    function _field(key, type, value) {
        return { key: key, type: type, value: value };
    }

    function _object(fields) {
        var value = Object.create(null);
        fields.forEach(function (field) {
            value[field.key] = field.type === Type.OBJECT ? _object(field.value) : field.value;
        });
        return value;
    }

    function _target(room) {
        return [_field('type', Type.STRING, 'room'), _field('id', Type.STRING, room)];
    }

    function _same(left, right) {
        if (!left || !right || left.length !== right.length) {
            return false;
        }
        for (var i = 0; i < left.length; i++) {
            if (left[i] !== right[i]) {
                return false;
            }
        }
        return true;
    }

    function _next(value) {
        var low = (value.low + 1) >>> 0, high = value.high + (low === 0 ? 1 : 0);
        if (high > 4294967295) {
            throw _error('DataError', 'Room event sequence exhausted.');
        }
        return { high: high, low: low };
    }

    function _milliseconds(value) {
        if (!value || value.high > 2097151) {
            throw _error('DataError', 'Event time is outside the exact clock range.');
        }
        return value.high * 4294967296 + value.low;
    }

    // This parser checks framing and continuity only. The server verifies the
    // MAC, principal/device, room generation, visit and expiry on every resume.
    function _cursor(bytes) {
        if (!(bytes instanceof Uint8Array) || bytes.length < 129 || bytes.length > 256) {
            throw _error('DataError', 'Invalid room visit cursor.');
        }
        var data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        if (data.getUint8(0) !== 1 || data.getUint8(1) !== 4 || data.getUint16(94) !== bytes.length - 128) {
            throw _error('DataError', 'Unknown room visit cursor format.');
        }
        function number(offset) { return { high: data.getUint32(offset), low: data.getUint32(offset + 4) }; }
        var stream = new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(96, bytes.length - 32));
        return { stream: stream, epoch: number(6), first: number(14), last: number(22),
            expiresAt: _milliseconds(number(38)), visit: bytes.slice(46, 94),
            partition: data.getUint16(2), partitions: data.getUint16(4) };
    }

    function Events(storage, request, deliver, failed) {
        var _this = this, _closed = false, _rooms = Object.create(null), _streams = Object.create(null),
            _pending = 0, _bytes = 0, _owner = Array.prototype.map.call(Protocol.messageId(0, 1), function (v) {
                return ('0' + v.toString(16)).slice(-2);
            }).join('');

        function active(state) {
            if (_closed || (state && _rooms[state.room] !== state)) {
                throw _error('AbortError', 'The room event visit is no longer active.');
            }
        }

        function serialize(state, bytes, work) {
            active(state);
            if (_pending >= 32 || bytes > 262144 - _bytes) {
                return Promise.reject(_error('QuotaExceededError', 'Room event persistence is backpressured.'));
            }
            ++_pending;
            _bytes += bytes;
            var result = state.queue.then(function () { active(state); return work(); });
            function finish() { --_pending; _bytes -= bytes; }
            state.queue = result.then(finish, finish);
            return result;
        }

        _this.join = function (room, resume, accept) {
            return Promise.resolve().then(function () {
                active();
                ['eventVisit', 'beginEvents', 'receiveEvents', 'confirmEvents', 'endEvents'].forEach(function (method) {
                    if (typeof storage[method] !== 'function') {
                        throw _error('NotSupportedError', 'The storage adapter does not support durable room events.');
                    }
                });
                if (_rooms[room]) {
                    return _rooms[room].ready;
                }
                if (Object.keys(_rooms).length >= 128) {
                    throw _error('QuotaExceededError', 'Too many active room visits.');
                }
                var state = { room: room, queue: Promise.resolve(), ready: null, nextAckAt: Infinity, pages: 0, bytes: 0 };
                _rooms[room] = state;
                state.ready = storage.eventVisit(room).then(function (previous) {
                    active(state);
                    if (resume && !previous) {
                        var error = _error('NotFoundError', 'The previous visit was lost; explicitly join a new visit.');
                        error.code = Protocol.Status.GONE;
                        throw error;
                    }
                    var fields = [_field('topic', Type.STRING, 'events'), _field('target', Type.OBJECT, _target(room))];
                    if (resume) {
                        fields.push(_field('cursor', Type.BYTES, previous.cursor));
                    }
                    return request(Opcode.SUBSCRIBE, fields).then(function (info) {
                        active(state);
                        accept(info);
                        var cursor = _cursor(info.cursor), delivery = info.delivery;
                        if (cursor.stream !== info.conversationId || Protocol.compare64(cursor.epoch, info.epoch) !== 0 ||
                            cursor.partition !== info.partition || cursor.partitions !== info.partitions ||
                            Protocol.compare64(cursor.last, info.floor) < 0 || Protocol.compare64(cursor.last, info.head) > 0 ||
                            cursor.expiresAt <= Date.now() || !delivery || delivery.ackInterval < 10 ||
                            delivery.ackInterval * 2 >= delivery.ackTimeout || delivery.maxPages < 1 || delivery.maxPages > 64 ||
                            delivery.maxBytes < 16384 || delivery.maxBytes > 1048576) {
                            throw _error('DataError', 'Invalid room event delivery window.');
                        }
                        if (resume) {
                            var old = _cursor(previous.cursor);
                            if (!_same(old.visit, cursor.visit) || Protocol.compare64(old.last, cursor.last) !== 0) {
                                throw _error('ConflictError', 'The server did not resume the saved visit.');
                            }
                        }
                        state.info = info;
                        state.cursor = new Uint8Array(info.cursor);
                        state.through = cursor.last;
                        state.identity = cursor;
                        state.nextAckAt = Math.min(Date.now() + 300000, Date.now() + (cursor.expiresAt - Date.now()) / 3);
                        _streams[info.conversationId] = state;
                        return storage.beginEvents(room, { stream: cursor.stream, epoch: cursor.epoch,
                            through: cursor.last, cursor: info.cursor }, previous, _owner, resume).then(function () {
                            active(state);
                            return info;
                        });
                    });
                }).catch(function (error) {
                    if (_rooms[room] === state) {
                        delete _rooms[room];
                        if (state.info) {
                            delete _streams[state.info.conversationId];
                        }
                    }
                    throw error;
                });
                state.queue = state.ready.then(function () {}, function () {});
                return state.ready;
            });
        };

        _this.resolution = function (room) {
            active();
            var state = _rooms[room];
            if (!state) {
                return Promise.reject(_error('InvalidStateError', 'Join the reliable room event stream before sending a gift.'));
            }
            return state.ready;
        };

        _this.receive = function (page) {
            active();
            var state = _streams[page.conversationId];
            if (!state) {
                return Promise.reject(_error('NotAllowedError', 'Room events arrived without an active visit.'));
            }
            var records = [], notifications = [], previous = page.after, bytes = 0;
            if (page.kind !== 'events' || !Array.isArray(page.items) || !page.items.length || page.items.length > 64 ||
                Protocol.compare64(page.epoch, state.info.epoch) !== 0) {
                return Promise.reject(_error('DataError', 'Invalid room event page identity.'));
            }
            try {
                page.items.forEach(function (entry) {
                    if (entry.type !== Type.OBJECT) {
                        throw _error('DataError', 'Expected a room event record.');
                    }
                    Protocol.validateFields(entry.value, [
                        { key: 'messageId', type: Type.BYTES }, { key: 'messageSequence', type: Type.UINT64 },
                        { key: 'acceptedAt', type: Type.UINT64 }, { key: 'expiresAt', type: Type.UINT64 },
                        { key: 'event', type: Type.OBJECT },
                    ]);
                    var item = _object(entry.value), event = item.event;
                    if (!(item.messageId instanceof Uint8Array) || item.messageId.length !== 16) {
                        throw _error('DataError', 'Invalid accepted room event identity.');
                    }
                    if (Protocol.compare64(item.messageSequence, _next(previous)) !== 0 ||
                        _milliseconds(item.expiresAt) <= _milliseconds(item.acceptedAt)) {
                        throw _error('DataError', 'Room event sequence or retention is invalid.');
                    }
                    previous = item.messageSequence;
                    Protocol.validateFields(entry.value[4].value, [
                        { key: 'kind', type: Type.STRING }, { key: 'entityId', type: Type.STRING },
                        { key: 'revision', type: Type.UINT64 }, { key: 'occurredAt', type: Type.UINT64 },
                        { key: 'payload', type: Type.OBJECT },
                    ]);
                    if (event.kind !== 'gift.confirmed' || event.revision.high !== 0 || event.revision.low !== 1) {
                        throw _error('NotSupportedError', 'Unsupported room event; it cannot be acknowledged.');
                    }
                    Protocol.validateFields(entry.value[4].value[4].value, [
                        { key: 'giftId', type: Type.STRING }, { key: 'count', type: Type.UINT32 },
                        { key: 'receiverId', type: Type.STRING }, { key: 'senderId', type: Type.STRING },
                        { key: 'displayUntil', type: Type.UINT64 },
                    ]);
                    var payload = event.payload;
                    if (!/^[0-9a-f]{32}$/.test(event.entityId) || !/^[A-Za-z0-9_.-]{1,128}$/.test(payload.giftId) ||
                        !payload.count || !/^[0-9a-f-]{36}$/.test(payload.senderId) || !/^[0-9a-f-]{36}$/.test(payload.receiverId) ||
                        _milliseconds(payload.displayUntil) < _milliseconds(event.occurredAt) ||
                        _milliseconds(payload.displayUntil) - _milliseconds(event.occurredAt) > 3600000) {
                        throw _error('DataError', 'Invalid confirmed gift fact.');
                    }
                    item.packet = Protocol.encode({ opcode: Opcode.NOTIFY, messaging: true, sequenceNumber: 0, fields: [
                        _field('event', Type.UINT16, Protocol.Event.IM_SYNC_REQUIRED), _field('data', Type.OBJECT, entry.value),
                    ] });
                    bytes += item.packet.length;
                    records.push(item);
                    notifications.push({ target: { type: 'room', id: state.room }, messaging: true,
                        meta: { messageId: item.messageId, conversationId: page.conversationId, epoch: page.epoch,
                            messageSequence: item.messageSequence, acceptedAt: item.acceptedAt, expiresAt: item.expiresAt },
                        type: event.kind, content: event.payload, event: event,
                        live: _milliseconds(event.payload.displayUntil) > Date.now() });
                });
                if (Protocol.compare64(previous, page.last) !== 0) {
                    throw _error('DataError', 'Room page boundary does not match its records.');
                }
            } catch (error) {
                return Promise.reject(error);
            }
            return serialize(state, bytes, function () {
                if (Protocol.compare64(page.after, state.through) !== 0) {
                    throw _error('ConflictError', 'Room event delivery is not contiguous.');
                }
                return storage.receiveEvents(state.room, _owner, page, records).then(function (added) {
                    active(state);
                    state.through = page.last;
                    state.pages++;
                    state.bytes += bytes;
                    state.nextAckAt = Math.min(state.nextAckAt, Date.now() + state.info.delivery.ackInterval);
                    added.forEach(function (index) { active(state); deliver(notifications[index]); });
                    if (state.pages >= Math.max(1, Math.floor(state.info.delivery.maxPages / 2)) ||
                        state.bytes >= state.info.delivery.maxBytes / 2) {
                        return acknowledge(state);
                    }
                });
            });
        };

        function acknowledge(state) {
            var before = state.cursor, through = state.through;
            return request(Opcode.COMMIT, [_field('kind', Type.STRING, 'events'), _field('target', Type.OBJECT, _target(state.room)),
                _field('cursor', Type.BYTES, before), _field('through', Type.UINT64, through)]).then(function (info) {
                active(state);
                var cursor = _cursor(info.cursor);
                if (cursor.stream !== state.identity.stream || !_same(cursor.visit, state.identity.visit) ||
                    Protocol.compare64(cursor.epoch, state.identity.epoch) !== 0 ||
                    Protocol.compare64(cursor.last, through) !== 0 || Protocol.compare64(info.through, through) !== 0) {
                    throw _error('DataError', 'The acknowledged visit boundary changed.');
                }
                return storage.confirmEvents(state.room, _owner, before, info.cursor, through).then(function () {
                    active(state);
                    state.cursor = new Uint8Array(info.cursor);
                    state.identity = cursor;
                    state.pages = state.bytes = 0;
                    state.nextAckAt = Math.min(Date.now() + 300000, Date.now() + (cursor.expiresAt - Date.now()) / 3);
                    return info;
                });
            });
        }

        _this.maintain = function () {
            if (_closed) {
                return;
            }
            Object.keys(_rooms).forEach(function (room) {
                var state = _rooms[room];
                if (state.info && Date.now() >= state.nextAckAt) {
                    state.nextAckAt = Infinity;
                    serialize(state, 0, function () { return acknowledge(state); }).catch(failed);
                }
            });
        };

        _this.leave = function (room) {
            var state = _rooms[room];
            if (!state) {
                return Promise.resolve();
            }
            return serialize(state, 0, function () {
                return storage.endEvents(room, _owner).then(function () {
                    delete _rooms[room];
                    delete _streams[state.info.conversationId];
                });
            });
        };

        _this.close = function () {
            _closed = true;
            _rooms = Object.create(null);
            _streams = Object.create(null);
        };
    }

    IM.Events = Events;
})(odd);

