(function (odd) {
    var IM = odd.IM,
        Protocol = IM.Protocol;

    function _error(name, message) {
        var error = new Error(message);
        error.name = name;
        return error;
    }

    function _integer(value, minimum, maximum) {
        return typeof value === 'number' && isFinite(value) && Math.floor(value) === value &&
            value >= minimum && value <= maximum;
    }

    function _bytes(value, limit) {
        if (value instanceof ArrayBuffer) {
            value = new Uint8Array(value);
        } else if (ArrayBuffer.isView(value)) {
            value = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        } else {
            throw _error('TypeError', 'Expected binary storage data.');
        }
        if (value.length > limit) {
            throw _error('QuotaExceededError', 'Storage record exceeds its byte budget.');
        }
        return new Uint8Array(value);
    }

    function _id(value) {
        var bytes = _bytes(value, 16), result = '';
        if (bytes.length !== 16) {
            throw _error('DataError', 'A message identity must contain 16 bytes.');
        }
        for (var i = 0; i < bytes.length; i++) {
            result += ('0' + bytes[i].toString(16)).slice(-2);
        }
        return result;
    }

    function _sequence(value) {
        if (!value || !_integer(value.high, 0, 4294967295) || !_integer(value.low, 0, 4294967295)) {
            throw _error('DataError', 'Expected an unsigned 64-bit sequence.');
        }
        return [value.high, value.low];
    }

    function _same(first, second) {
        if (first.length !== second.length) {
            return false;
        }
        for (var i = 0; i < first.length; i++) {
            if (first[i] !== second[i]) {
                return false;
            }
        }
        return true;
    }

    function _identifier(value) {
        if (typeof value !== 'string' || !value || Protocol.text(value).length > 128 || /[\x00-\x1F\x7F]/.test(value)) {
            throw _error('DataError', 'Invalid persistent messaging identity.');
        }
        return value;
    }

    // One adapter belongs to one authenticated account/device. Only message
    // data and recovery positions belong here; never pass credentials or keys.
    function IndexedDB(scope, userId, deviceId) {
        var _this = this,
            _name = 'odd.im.v1:' + JSON.stringify([
                _identifier(scope), _identifier(userId), _identifier(deviceId),
            ]),
            _database = null,
            _opening = null,
            _rejectOpen = null,
            _closed = false,
            _pending = 0,
            _transactions = [];

        _this.open = function () {
            if (_closed) {
                return Promise.reject(_error('InvalidStateError', 'Messaging storage is closed.'));
            }
            if (_database) {
                return Promise.resolve();
            }
            if (_opening) {
                return _opening;
            }
            _opening = new Promise(function (resolve, reject) {
                _rejectOpen = reject;
                if (typeof indexedDB === 'undefined') {
                    reject(_error('NotSupportedError', 'IndexedDB is unavailable.'));
                    return;
                }
                var request = indexedDB.open(_name, 2), failed = false;
                request.onupgradeneeded = function () {
                    if (_closed || failed) {
                        request.transaction.abort();
                        return;
                    }
                    var database = request.result;
                    if (!database.objectStoreNames.contains('outbox')) {
                        var outbox = database.createObjectStore('outbox', { keyPath: 'id' });
                        outbox.createIndex('state', 'state');
                        var messages = database.createObjectStore('messages', { keyPath: ['conversationId', 'id'] });
                        messages.createIndex('sequence', ['conversationId', 'high', 'low'], { unique: true });
                        database.createObjectStore('positions', { keyPath: ['kind', 'id'] });
                        database.createObjectStore('conversations', { keyPath: 'conversationId' });
                    }
                    if (!database.objectStoreNames.contains('terminal')) {
                        database.createObjectStore('terminal', { keyPath: ['conversationId', 'firstHigh', 'firstLow'] });
                    }
                };
                request.onerror = function () {
                    _rejectOpen = null;
                    failed = true;
                    reject(request.error || _error('OperationError', 'Unable to open messaging storage.'));
                };
                request.onblocked = function () {
                    _rejectOpen = null;
                    failed = true;
                    reject(_error('InvalidStateError', 'Messaging storage upgrade is blocked by another tab.'));
                };
                request.onsuccess = function () {
                    _rejectOpen = null;
                    if (_closed || failed) {
                        request.result.close();
                        reject(_error('AbortError', 'Messaging storage was closed while opening.'));
                        return;
                    }
                    _database = request.result;
                    _database.onversionchange = function () {
                        _this.close();
                    };
                    resolve();
                };
            });
            return _opening;
        };

        function _transaction(stores, mode, work) {
            if (_pending >= 32) {
                return Promise.reject(_error('QuotaExceededError', 'Messaging storage has too many pending operations.'));
            }
            ++_pending;
            return _this.open().then(function () {
                return new Promise(function (resolve, reject) {
                    if (_closed || !_database) {
                        reject(_error('AbortError', 'Messaging storage is closed.'));
                        return;
                    }
                    var transaction, result, failure = null;
                    try {
                        transaction = _database.transaction(stores, mode, { durability: 'strict' });
                    } catch (error) {
                        reject(error);
                        return;
                    }
                    _transactions.push(transaction);
                    function finish() {
                        var index = _transactions.indexOf(transaction);
                        if (index >= 0) {
                            _transactions.splice(index, 1);
                        }
                    }
                    transaction.oncomplete = function () {
                        finish();
                        resolve(result);
                    };
                    transaction.onabort = function () {
                        finish();
                        reject(failure || transaction.error || _error('AbortError', 'Messaging transaction was aborted.'));
                    };
                    transaction.onerror = function () {
                        failure = failure || transaction.error;
                    };
                    function abort(error) {
                        failure = error;
                        transaction.abort();
                    }
                    if (mode === 'readwrite' && transaction.durability !== 'strict') {
                        abort(_error('NotSupportedError', 'Reliable messaging requires strict IndexedDB durability.'));
                        return;
                    }
                    try {
                        work(transaction, function (value) { result = value; }, abort);
                    } catch (error) {
                        abort(error);
                    }
                });
            }).then(function (value) {
                --_pending;
                return value;
            }, function (error) {
                --_pending;
                throw error;
            });
        }

        // The packet is canonical PUBLISH data, with a normalized request SN.
        // Store before sending. An unknown network result leaves this row pending.
        _this.enqueue = function (clientMessageId, packet) {
            return Promise.resolve().then(function () {
                var id = _id(clientMessageId), bytes = _bytes(packet, 65536);
                return _transaction(['outbox'], 'readwrite', function (transaction, result, abort) {
                    var store = transaction.objectStore('outbox'), request = store.get(id);
                    request.onsuccess = function () {
                        if (request.result) {
                            if (!_same(request.result.packet, bytes)) {
                                abort(_error('ConflictError', 'The message ID already belongs to different content.'));
                                return;
                            }
                            result(request.result);
                            return;
                        }
                        var record = { id: id, packet: bytes, state: 'pending' };
                        store.add(record);
                        result(record);
                    };
                });
            });
        };

        _this.settle = function (clientMessageId, state, outcome) {
            return Promise.resolve().then(function () {
                var id = _id(clientMessageId), saved;
                if (outcome) {
                    var sequence = _sequence(outcome.messageSequence);
                    saved = {
                        messageId: _bytes(outcome.messageId, 16),
                        conversationId: _identifier(outcome.conversationId),
                        messageSequence: { high: sequence[0], low: sequence[1] },
                    };
                    _id(saved.messageId);
                }
                if (['accepted', 'delivered', 'settled', 'expired', 'revoked', 'rejected'].indexOf(state) < 0) {
                    throw _error('DataError', 'Unknown results must retain their pending identity.');
                }
                return _transaction(['outbox'], 'readwrite', function (transaction, result, abort) {
                    var store = transaction.objectStore('outbox'), request = store.get(id);
                    request.onsuccess = function () {
                        var record = request.result;
                        if (!record) {
                            abort(_error('NotFoundError', 'The local outbox entry is missing.'));
                            return;
                        }
                        if (record.state !== 'pending' && state === 'accepted') {
                            result(record);
                            return;
                        }
                        record.state = state;
                        if (saved) {
                            record.outcome = saved;
                        }
                        store.put(record);
                        result(record);
                    };
                });
            });
        };

        _this.pending = function (limit, after) {
            return Promise.resolve().then(function () {
                if (!_integer(limit, 1, 64)) {
                    throw _error('QuotaExceededError', 'Outbox page limit must be between 1 and 64.');
                }
                return _transaction(['outbox'], 'readonly', function (transaction, result) {
                    var records = [], bytes = 0;
                    var request = transaction.objectStore('outbox').openCursor(after ? IDBKeyRange.lowerBound(after, true) : null);
                    request.onsuccess = function () {
                        var cursor = request.result;
                        if (!cursor || records.length === limit) {
                            result(records);
                            return;
                        }
                        if (cursor.value.state !== 'pending') {
                            cursor.continue();
                            return;
                        }
                        if (cursor.value.packet.length > 262144 - bytes) {
                            result(records);
                            return;
                        }
                        records.push(cursor.value);
                        bytes += cursor.value.packet.length;
                        cursor.continue();
                    };
                });
            });
        };

        // Completion is the storage boundary for COMMIT. A duplicate still
        // participates in the same transaction as its newly received cursor.
        _this.receive = function (conversationId, items, cursor, previousCursor) {
            return Promise.resolve().then(function () {
                _identifier(conversationId);
                if (!Array.isArray(items) || items.length > 64) {
                    throw _error('QuotaExceededError', 'A message page may contain at most 64 records.');
                }
                var position = _bytes(cursor, 512), previous = _bytes(previousCursor, 512), total = 0;
                var seen = Object.create(null), records = [], terminal = [];
                items.forEach(function (item) {
                    if (item.kind === 'expired') {
                        var first = _sequence(item.first), last = _sequence(item.last);
                        if (Protocol.compare64(item.first, item.last) > 0) {
                            throw _error('DataError', 'Invalid terminal message range.');
                        }
                        terminal.push({ conversationId: conversationId, firstHigh: first[0], firstLow: first[1],
                            lastHigh: last[0], lastLow: last[1], kind: 'expired' });
                        return;
                    }
                    var sequence = _sequence(item.messageSequence), packet = _bytes(item.packet, 65536);
                    total += packet.length;
                    var record = {
                        conversationId: conversationId,
                        id: _id(item.messageId),
                        high: sequence[0],
                        low: sequence[1],
                        packet: packet,
                    };
                    var duplicate = seen[record.id];
                    if (duplicate) {
                        if (duplicate.high !== record.high || duplicate.low !== record.low || !_same(duplicate.packet, packet)) {
                            throw _error('ConflictError', 'A message page repeats an identity with different data.');
                        }
                        return;
                    }
                    seen[record.id] = record;
                    records.push(record);
                });
                if (total > 262144) {
                    throw _error('QuotaExceededError', 'A message page exceeds its byte budget.');
                }
                return _transaction(['messages', 'terminal', 'positions'], 'readwrite', function (transaction, result, abort) {
                    var store = transaction.objectStore('messages');
                    records.forEach(function (record) {
                        var request = store.get([conversationId, record.id]);
                        request.onsuccess = function () {
                            var previous = request.result;
                            if (previous && (previous.high !== record.high || previous.low !== record.low ||
                                !_same(previous.packet, record.packet))) {
                                abort(_error('ConflictError', 'A persisted message identity changed.'));
                                return;
                            }
                            if (!previous) {
                                store.add(record);
                            }
                        };
                    });
                    terminal.forEach(function (record) {
                        transaction.objectStore('terminal').put(record);
                    });
                    _advance(transaction, 'messages', conversationId, previous, position, abort);
                    result(position);
                });
            });
        };

        // Compare-and-swap the opaque position. Late pages from another socket
        // or tab cannot roll recovery backwards or skip a page not saved here.
        function _advance(transaction, kind, id, previous, cursor, abort) {
            var store = transaction.objectStore('positions'), request = store.get([kind, id]);
            request.onsuccess = function () {
                var current = request.result ? request.result.cursor : new Uint8Array(0);
                if (!_same(current, previous) && !_same(current, cursor)) {
                    abort(_error('ConflictError', 'The local recovery position changed while saving a page.'));
                    return;
                }
                store.put({ kind: kind, id: id, cursor: cursor });
            };
        }

        _this.position = function (kind, id) {
            return _transaction(['positions'], 'readonly', function (transaction, result) {
                var request = transaction.objectStore('positions').get([kind, id]);
                request.onsuccess = function () {
                    result(request.result ? request.result.cursor : new Uint8Array(0));
                };
            });
        };

        _this.synchronize = function (items, cursor, previousCursor) {
            return Promise.resolve().then(function () {
                if (!Array.isArray(items) || items.length > 64) {
                    throw _error('QuotaExceededError', 'A synchronization page may contain at most 64 records.');
                }
                var position = _bytes(cursor, 512), previous = _bytes(previousCursor, 512);
                var selected = Object.create(null);
                items.forEach(function (item) {
                    var revision = _sequence(item.revision), read = _sequence(item.readSequence);
                    var head = _sequence(item.headSequence), incoming = _sequence(item.incomingSequence);
                    if (Protocol.compare64(item.readSequence, item.headSequence) > 0 ||
                        Protocol.compare64(item.incomingSequence, item.headSequence) > 0) {
                        throw _error('DataError', 'Conversation positions exceed the durable head.');
                    }
                    var record = {
                        conversationId: _identifier(item.conversationId),
                        revision: { high: revision[0], low: revision[1] },
                        readSequence: { high: read[0], low: read[1] },
                        headSequence: { high: head[0], low: head[1] },
                        incomingSequence: { high: incoming[0], low: incoming[1] },
                    };
                    var previous = selected[record.conversationId];
                    if (!previous || Protocol.compare64(previous.revision, record.revision) < 0) {
                        if (previous && Protocol.compare64(record.readSequence, previous.readSequence) < 0) {
                            throw _error('ConflictError', 'A synchronization page moved the read position backwards.');
                        }
                        selected[record.conversationId] = record;
                    } else if (Protocol.compare64(record.revision, previous.revision) === 0 &&
                        Protocol.compare64(previous.readSequence, record.readSequence) !== 0) {
                        throw _error('ConflictError', 'A conversation revision has conflicting read positions.');
                    }
                });
                var records = Object.keys(selected).map(function (key) { return selected[key]; });
                return _transaction(['conversations', 'positions'], 'readwrite', function (transaction, result, abort) {
                    var store = transaction.objectStore('conversations');
                    records.forEach(function (item) {
                        var request = store.get(item.conversationId);
                        request.onsuccess = function () {
                            var previous = request.result;
                            if (!previous || Protocol.compare64(previous.revision, item.revision) < 0) {
                                if (previous && Protocol.compare64(item.readSequence, previous.readSequence) < 0) {
                                    abort(_error('ConflictError', 'A newer conversation revision moved the read position backwards.'));
                                    return;
                                }
                                store.put(item);
                            } else if (Protocol.compare64(item.revision, previous.revision) === 0 &&
                                Protocol.compare64(previous.readSequence, item.readSequence) !== 0) {
                                abort(_error('ConflictError', 'A conversation revision changed its read position.'));
                            }
                        };
                    });
                    _advance(transaction, 'synchronization', '', previous, position, abort);
                    result(position);
                });
            });
        };

        _this.identity = function () {
            return { scope: scope, userId: userId, deviceId: deviceId };
        };

        _this.messages = function (conversationId, after, limit) {
            return Promise.resolve().then(function () {
                _identifier(conversationId);
                if (!_integer(limit, 1, 64)) {
                    throw _error('QuotaExceededError', 'Message page limit must be between 1 and 64.');
                }
                var start = after ? _sequence(after) : [0, 0];
                var range = IDBKeyRange.bound([conversationId, start[0], start[1]],
                    [conversationId, 4294967295, 4294967295], !!after, false);
                return _transaction(['messages'], 'readonly', function (transaction, result) {
                    var records = [], bytes = 0;
                    var request = transaction.objectStore('messages').index('sequence').openCursor(range);
                    request.onsuccess = function () {
                        var cursor = request.result;
                        if (!cursor || records.length === limit || cursor.value.packet.length > 262144 - bytes) {
                            result(records);
                            return;
                        }
                        records.push(cursor.value);
                        bytes += cursor.value.packet.length;
                        cursor.continue();
                    };
                });
            });
        };

        _this.close = function () {
            if (_closed) {
                return;
            }
            _closed = true;
            if (_rejectOpen) {
                _rejectOpen(_error('AbortError', 'Messaging storage was closed while opening.'));
                _rejectOpen = null;
            }
            _transactions.slice().forEach(function (transaction) {
                try {
                    transaction.abort();
                } catch (error) {
                    // Completion may already be queued on the browser event
                    // loop. Such a transaction cannot be aborted a second time.
                    if (error.name !== 'InvalidStateError') {
                        throw error;
                    }
                }
            });
            if (_database) {
                _database.close();
                _database = null;
            }
        };
    }

    IM.IndexedDB = IndexedDB;
})(odd);
