(function (odd) {
    var IM = odd.IM, Protocol = IM.Protocol, Type = Protocol.Type, Opcode = Protocol.Opcode;

    function _error(name, message) {
        var error = new Error(message);
        error.name = name;
        return error;
    }

    function _field(key, type, value) {
        return { key: key, type: type, value: value };
    }

    function _object(fields) {
        var result = Object.create(null);
        fields.forEach(function (field) {
            result[field.key] = field.type === Type.OBJECT ? _object(field.value) : field.value;
        });
        return result;
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

    function _target(target) {
        return [_field('type', Type.STRING, target.type), _field('id', Type.STRING, target.id)];
    }

    // Composes an account/device storage adapter with the existing request
    // table. It owns no socket, timer, credential or independent reconnect loop.
    function Messaging(identity, storage, request, authorize, parse, deliver, changed, failed, eventsEnabled, stateVersion, speakersChanged) {
        var _this = this, _closed = false, _pending = 0, _queues = Object.create(null),
            _resolved = Object.create(null), _positions = Object.create(null), _recovering = null,
            _events = eventsEnabled ? new IM.Events(storage, request, deliver, failed, stateVersion, speakersChanged, function (room) {
                return authorize({ type: 'room', id: room }, Protocol.Action.MESSAGE_SUBSCRIBE, true);
            }) : null;

        function active() {
            if (_closed) {
                throw _error('AbortError', 'Reliable messaging belongs to a closed connection.');
            }
        }

        _this.open = function () {
            return Promise.resolve().then(function () {
                active();
                ['identity', 'open', 'enqueue', 'pending', 'settle', 'receive', 'position', 'synchronize', 'close'].forEach(function (method) {
                    if (!storage || typeof storage[method] !== 'function') {
                        throw _error('NotSupportedError', 'A durable messaging storage adapter is required.');
                    }
                });
                var actual = storage.identity();
                if (!actual || actual.appId !== identity.appId || actual.userId !== identity.userId || actual.deviceId !== identity.deviceId) {
                    throw _error('NotAllowedError', 'Messaging storage does not belong to this authenticated account/device.');
                }
                return storage.open();
            }).then(active);
        };

        _this.storage = function () { return storage; };
        _this.events = function () {
            active();
            if (!_events) {
                throw _error('NotSupportedError', 'The server has not enabled reliable room events.');
            }
            return _events;
        };
        _this.maintain = function () { if (_events) { _events.maintain(); } };

        _this.resolve = function (target) {
            active();
            return request(Opcode.RESOLVE, [_field('target', Type.OBJECT, _target(target))]).then(function (info) {
                active();
                if (target.type === 'conversation' && target.id !== info.conversationId) {
                    throw _error('DataError', 'Resolved conversation changed its identity.');
                }
                if (Object.keys(_resolved).length >= 4096 && !_resolved[info.conversationId]) {
                    throw _error('QuotaExceededError', 'Too many resolved conversations in one connection.');
                }
                _resolved[info.conversationId] = info;
                return info;
            });
        };

        function resolution(target) {
            if (target.type === 'room') {
                return _this.events().resolution(target.id);
            }
            return _resolved[target.id] ? Promise.resolve(_resolved[target.id]) : _this.resolve(target);
        }

        function _hex(bytes) {
            return Array.prototype.map.call(bytes, function (value) { return ('0' + value.toString(16)).slice(-2); }).join('');
        }

        function settle(id, state, info) {
            return storage.settle(id, state, info).then(function (record) {
                active();
                changed({ kind: 'outbox', id: _hex(id), conversationId: record ? record.conversationId : info && info.conversationId, state: record ? record.state : state });
                return record;
            });
        }

        function outcome(id, promise, gift) {
            return promise.then(function (info) {
                active();
                if (info.state && info.state !== 'accepted') {
                    var terminal = info.state === 'rejected' || info.state === 'expired';
                    var error = _error('OperationError', info.reason || 'Gift delivery has not been accepted.');
                    error.code = info.state === 'expired' ? Protocol.Status.EXPIRED :
                        terminal ? Protocol.Status.FORBIDDEN : Protocol.Status.UNKNOWN;
                    error.info = info;
                    if (terminal) {
                        return settle(id, info.state).then(function () { throw error; });
                    }
                    throw error;
                }
                return settle(id, 'accepted', info).then(function () { active(); return info; });
            }, function (error) {
                active();
                // A reconnect may lose current room permission after the same
                // gift was already debited. Only a business result can settle it.
                if (gift) {
                    throw error;
                }
                var state = error.code === Protocol.Status.EXPIRED ? 'expired' :
                    error.code === Protocol.Status.FORBIDDEN ? 'revoked' :
                    error.code === Protocol.Status.INVALID || error.code === Protocol.Status.CONFLICT ? 'rejected' : '';
                if (!state) {
                    throw error;
                }
                return settle(id, state).then(function () { throw error; });
            });
        }

        _this.publish = function (fields) {
            return Promise.resolve().then(function () {
                active();
                var target = _object(fields[0].value), body = fields[1].value;
                return resolution(target).then(function (info) {
                    active();
                    var id = body[0].value;
                    Protocol.validateMessagePartition(id, info.partition, info.partitions);
                    var message = { opcode: Opcode.PUBLISH, messaging: true, sequenceNumber: 1, fields: fields };
                    Protocol.validateMessageRequest(message);
                    var packet = Protocol.encode(message);
                    var canonical = Protocol.decode(packet);
                    id = canonical.fields[1].value[0].value;
                    return storage.enqueue(id, packet).then(function (record) {
                        active();
                        changed({ kind: 'outbox', id: record.id, conversationId: target.id, state: record.state });
                        if (record.state !== 'pending') {
                            if (record.outcome) {
                                return record.outcome;
                            }
                            throw _error('InvalidStateError', 'This message has a terminal local outcome; create a new send explicitly.');
                        }
                        return outcome(id, request(Opcode.PUBLISH, canonical.fields).then(function (accepted) {
                            if ((!accepted.state || accepted.state === 'accepted') && accepted.conversationId !== info.conversationId) {
                                throw _error('DataError', 'The accepted message belongs to a different stream.');
                            }
                            return accepted;
                        }), target.type === 'room');
                    });
                });
            });
        };

        _this.identity = function (target, supplied) {
            return resolution(target).then(function (info) {
                active();
                var id = supplied === undefined ? Protocol.messageId(info.partition, info.partitions) : supplied;
                Protocol.validateMessagePartition(id, info.partition, info.partitions);
                return id;
            });
        };

        function items(page) {
            if (!page || !Array.isArray(page.items) || page.items.length > 64 ||
                !(page.nextCursor instanceof Uint8Array) || page.nextCursor.length > 512 || typeof page.hasMore !== 'boolean') {
                throw _error('DataError', 'Invalid reliable messaging page.');
            }
            return page.items.map(function (item) {
                if (item.type !== Type.OBJECT) {
                    throw _error('DataError', 'Expected a messaging record.');
                }
                return { fields: item.value, value: _object(item.value) };
            });
        }

        function serialize(conversation, work) {
            active();
            if (_pending >= 32 || (_queues[conversation] && _queues[conversation].count >= 2)) {
                return Promise.reject(_error('QuotaExceededError', 'Reliable receive storage is backpressured.'));
            }
            ++_pending;
            var queue = _queues[conversation] || { promise: Promise.resolve(), count: 0 };
            _queues[conversation] = queue;
            ++queue.count;
            var result = queue.promise.then(function () { active(); return work(); });
            function finish() {
                --_pending;
                if (!--queue.count) {
                    delete _queues[conversation];
                }
            }
            // Later pages can retry after a failed CAS; no rejection is hidden
            // from the operation that owns that page.
            queue.promise = result.then(finish, finish);
            return result;
        }

        function save(conversation, page) {
            var records = [], notifications = [], bytes = 0;
            items(page).forEach(function (item) {
                var value = item.value;
                if (value.kind === 'expired') {
                    Protocol.validateFields(item.fields, [
                        { key: 'kind', type: Type.STRING }, { key: 'first', type: Type.UINT64 }, { key: 'last', type: Type.UINT64 },
                    ]);
                    if (Protocol.compare64(value.first, value.last) > 0 || (!value.first.high && !value.first.low)) {
                        throw _error('DataError', 'Invalid terminal message range.');
                    }
                } else {
                    Protocol.validateFields(item.fields, [
                        { key: 'kind', type: Type.STRING }, { key: 'messageId', type: Type.BYTES },
                        { key: 'messageSequence', type: Type.UINT64 }, { key: 'packet', type: Type.BYTES },
                    ]);
                    if (value.kind !== 'message') {
                        throw _error('DataError', 'Unknown reliable record kind.');
                    }
                    bytes += value.packet.length;
                    var decoded = Protocol.decode(value.packet), notification = parse(decoded);
                    if (!decoded.messaging || decoded.opcode !== Opcode.NOTIFY ||
                        decoded.fields[0].value !== Protocol.Event.IM_MESSAGE_RECEIVE ||
                        notification.meta.conversationId !== conversation || !_same(notification.meta.messageId, value.messageId) ||
                        Protocol.compare64(notification.meta.messageSequence, value.messageSequence) !== 0) {
                        throw _error('DataError', 'Message page identity does not match its packet.');
                    }
                    notifications.push(notification);
                }
                records.push(value);
            });
            if (bytes > 65536 || !page.nextCursor.length) {
                throw _error('QuotaExceededError', 'Reliable page exceeds its storage boundary.');
            }
            return storage.position('messages', conversation).then(function (previous) {
                active();
                return storage.receive(conversation, records, page.nextCursor, previous);
            }).then(function () {
                active();
                _positions[conversation] = new Uint8Array(page.nextCursor);
                // Transaction completion, not request success or UI rendering,
                // is the sole automatic acknowledgement boundary.
                return request(Opcode.COMMIT, [_field('kind', Type.STRING, 'messages'), _field('cursor', Type.BYTES, page.nextCursor)]);
            }).then(function () {
                active();
                notifications.forEach(function (notification) { active(); deliver(notification); });
                records.forEach(function (record) {
                    if (record.kind === 'expired') {
                        active();
                        changed({ kind: 'expired', conversationId: conversation, first: record.first, last: record.last });
                    }
                });
                return page;
            });
        }

        _this.receive = function (page) {
            return serialize(page.conversationId, function () {
                if (page.kind !== 'messages' || !page.conversationId) {
                    throw _error('DataError', 'Unknown reliable delivery page.');
                }
                return save(page.conversationId, page);
            });
        };

        _this.fetch = function (conversation, cursor, limit) {
            limit = limit === undefined ? 50 : limit;
            if (!Number.isInteger(limit) || limit < 1 || limit > 64) {
                return Promise.reject(_error('RangeError', 'A message page must request 1 to 64 records.'));
            }
            return serialize(conversation, function () {
                return request(Opcode.FETCH, [
                    _field('conversationId', Type.STRING, conversation), _field('cursor', Type.BYTES, cursor || new Uint8Array(0)),
                    _field('limit', Type.UINT16, limit),
                ]).then(function (page) { active(); return save(conversation, page); });
            });
        };

        _this.commit = function (kind, cursor) {
            return Promise.resolve().then(function () {
                active();
                var conversation = Object.keys(_positions).filter(function (id) { return _same(_positions[id], cursor); })[0];
                if (kind !== 'messages' || !conversation) {
                    throw _error('NotAllowedError', 'Save this page through fetch or a reliable subscription before COMMIT.');
                }
                return storage.position('messages', conversation).then(function (saved) {
                    active();
                    if (!_same(saved, cursor)) {
                        throw _error('ConflictError', 'The durable receive cursor changed.');
                    }
                    return request(Opcode.COMMIT, [_field('kind', Type.STRING, kind), _field('cursor', Type.BYTES, saved)]);
                });
            });
        };

        _this.sync = function (kind, cursor, limit) {
            active();
            return request(Opcode.SYNC, [
                _field('kind', Type.STRING, kind), _field('cursor', Type.BYTES, cursor || new Uint8Array(0)),
                _field('limit', Type.UINT16, limit === undefined ? 50 : limit),
            ]).then(function (page) {
                active();
                var records = items(page).map(function (item) { return item.value; });
                if (kind === 'conversations') {
                    return storage.position('synchronization', '').then(function (previous) {
                        active();
                        return storage.synchronize(records, page.nextCursor, previous);
                    }).then(function () { active(); changed({ kind: 'conversations' }); return page; });
                }
                if (kind !== 'results') {
                    throw _error('DataError', 'Unknown synchronization kind.');
                }
                var chain = Promise.resolve();
                records.forEach(function (record) {
                    chain = chain.then(function () {
                        active();
                        return settle(record.clientMessageId, record.state, record).catch(function (error) {
                            // Another device's outgoing result has no local
                            // body to settle. It still remains visible in page.
                            if (error.name !== 'NotFoundError') {
                                throw error;
                            }
                        });
                    });
                });
                return chain.then(function () { active(); changed({ kind: 'results' }); return page; });
            });
        };

        _this.recover = function () {
            if (_recovering) {
                return _recovering;
            }
            function page(after) {
                active();
                return storage.pending(16, after).then(function (records) {
                    active();
                    var chain = Promise.resolve();
                    records.forEach(function (record) {
                        chain = chain.then(function () {
                            active();
                            var packet = Protocol.decode(record.packet), target = _object(packet.fields[0].value);
                            Protocol.validateMessageRequest(packet);
                            var operation;
                            if (target.type === 'room') {
                                var id = packet.fields[1].value[0].value;
                                operation = request(Opcode.INSPECT, [
                                    _field('target', Type.OBJECT, _target(target)), _field('clientMessageId', Type.BYTES, id),
                                ]).then(function (info) {
                                    active();
                                    if (info.state === 'rejected' || info.state === 'expired') {
                                        return settle(id, info.state).then(function () {
                                            active(); changed({ kind: 'gift', id: record.id, outcome: info });
                                        });
                                    }
                                    if (info.state === 'committed') {
                                        if (info.deliveryState === 'accepted') {
                                            return settle(id, 'accepted', info).then(function () {
                                                active(); changed({ kind: 'gift', id: record.id, outcome: info });
                                            });
                                        }
                                        // The business outbox still owns delivery or reconciliation.
                                        // A new room visit is not a new payment authorization.
                                        changed({ kind: 'gift', id: record.id, outcome: info });
                                        return info;
                                    }
                                    if (info.state !== 'not_found') {
                                        throw _error('DataError', 'Unknown gift recovery outcome.');
                                    }
                                    return resolution(target).then(function () { active(); return _this.publish(packet.fields); });
                                });
                            } else {
                                operation = authorize(target, Protocol.Action.MESSAGE_PUBLISH).then(function () {
                                    active();
                                    return _this.publish(packet.fields);
                                });
                            }
                            return operation.catch(function (error) {
                                active();
                                changed({ kind: 'outbox', id: record.id, error: error.name, code: error.code });
                            });
                        });
                    });
                    return chain.then(function () {
                        if (records.length) {
                            return page(records[records.length - 1].id);
                        }
                        return { complete: true };
                    });
                });
            }
            function synchronize(kind, cursor) {
                active();
                return _this.sync(kind, cursor, 64).then(function (result) {
                    active();
                    if (result.hasMore) {
                        return synchronize(kind, result.nextCursor);
                    }
                });
            }
            _recovering = Promise.resolve().then(function () {
                return synchronize('conversations', new Uint8Array(0));
            }).then(function () {
                return page('');
            }).then(function () {
                return synchronize('results', new Uint8Array(0));
            }).then(function () { return { complete: true }; });
            return _recovering.then(function (result) { _recovering = null; return result; }, function (error) {
                _recovering = null;
                throw error;
            });
        };

        _this.close = function () {
            if (!_closed) {
                _closed = true;
                if (_events) {
                    _events.close();
                }
                if (storage && typeof storage.close === 'function') {
                    storage.close();
                }
            }
        };
    }

    IM.Messaging = Messaging;
})(odd);

