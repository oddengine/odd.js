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
    function IndexedDB(scope, userId, deviceId, options) {
        options = options || {};
        var eventLimits = {
            maxRecords: options.maxEventRecords === undefined ? 20000 : options.maxEventRecords,
            maxBytes: options.maxEventBytes === undefined ? 33554432 : options.maxEventBytes,
        };
        if (!_integer(eventLimits.maxRecords, 64, 1000000) || !_integer(eventLimits.maxBytes, 65536, 1073741824)) {
            throw _error('TypeError', 'Invalid room event storage limits.');
        }
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
                var request = indexedDB.open(_name, 3), failed = false;
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
                    var outgoing = request.transaction.objectStore('outbox');
                    if (!outgoing.indexNames.contains('pending')) {
                        outgoing.createIndex('pending', ['state', 'id']);
                    }
                    if (!database.objectStoreNames.contains('events')) {
                        var events = database.createObjectStore('events', { keyPath: ['stream', 'id'] });
                        events.createIndex('sequence', ['stream', 'epochHigh', 'epochLow', 'high', 'low'], { unique: true });
                        events.createIndex('expiresAt', 'expiresAt');
                        database.createObjectStore('visits', { keyPath: 'room' });
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
                if (outcome && outcome.state === 'committed' && outcome.deliveryState === 'accepted') {
                    saved = { state: 'committed', deliveryState: 'accepted' };
                } else if (outcome) {
                    var sequence = _sequence(outcome.messageSequence);
                    saved = {
                        messageId: _bytes(outcome.messageId, 16),
                        conversationId: _identifier(outcome.conversationId),
                        messageSequence: { high: sequence[0], low: sequence[1] },
                    };
                    _id(saved.messageId);
                    if (!sequence[0] && !sequence[1]) {
                        throw _error('DataError', 'An accepted message needs a positive sequence.');
                    }
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
                    var range = IDBKeyRange.bound(['pending', after || ''], ['pending', '\uffff'], !!after, false);
                    var request = transaction.objectStore('outbox').index('pending').openCursor(range);
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

        // Room visits contain recovery proof, never a central viewer receipt.
        _this.eventVisit = function (room) {
            return _transaction(['visits'], 'readonly', function (transaction, result) {
                var request = transaction.objectStore('visits').get(_identifier(room));
                request.onsuccess = function () { result(request.result || null); };
            });
        };

        function project(visit, events) {
            var states = visit.states || [], projection = Object.create(null);
            states.forEach(function (event) { projection[event.kind + ':' + event.entityId] = event; });
            events.forEach(function (event) {
                if (event.kind === 'gift.confirmed') {
                    return;
                }
                var key = event.kind + ':' + _identifier(event.entityId), previous = projection[key];
                _sequence(event.revision);
                _sequence(event.payload.roomGeneration);
                if (!previous || Protocol.compareEventState(event, previous) > 0) {
                    if (event.kind === 'media.resource' && event.payload.state === 'revoked') {
                        delete projection[key];
                        delete projection['media.publication:' + event.entityId];
                    } else {
                        projection[key] = event;
                    }
                }
            });
            visit.states = Object.keys(projection).map(function (key) { return projection[key]; });
            if (visit.states.length > 128 || Protocol.text(JSON.stringify(visit.states)).length > 49152) {
                throw _error('QuotaExceededError', 'Public room state exceeds its storage budget.');
            }
        }

        _this.roomState = function (room) {
            return _this.eventVisit(room).then(function (visit) {
                return visit ? { owner: visit.owner, head: visit.snapshotHead,
                    ready: visit.snapshotReady, states: visit.states || [] } : null;
            });
        };

        _this.beginEvents = function (room, value, previous, owner, resumed) {
            return Promise.resolve().then(function () {
                var cursor = _bytes(value.cursor, 256), epoch = _sequence(value.epoch), through = _sequence(value.through);
                var record = { room: _identifier(room), owner: _identifier(owner), cursor: cursor,
                    stream: _identifier(value.stream), epoch: { high: epoch[0], low: epoch[1] },
                    saved: { high: through[0], low: through[1] }, confirmed: { high: through[0], low: through[1] },
                    snapshotHead: value.snapshotHead, snapshotReady: value.snapshotReady, states: [] };
                _sequence(value.snapshotHead);
                if (!Array.isArray(value.snapshot)) { throw _error('DataError', 'A room state baseline is required.'); }
                project(record, value.snapshot);
                if (resumed) {
                    if (!previous || previous.stream !== record.stream || Protocol.compare64(previous.epoch, record.epoch) !== 0 ||
                        Protocol.compare64(previous.saved, record.confirmed) < 0) {
                        throw _error('ConflictError', 'The saved visit does not match the resumed stream.');
                    }
                    record.saved = previous.saved;
                }
                return _transaction(['visits'], 'readwrite', function (transaction, result, abort) {
                    var store = transaction.objectStore('visits'), request = store.get(room);
                    request.onsuccess = function () {
                        var actual = request.result;
                        if (!!actual !== !!previous || (actual && (actual.owner !== previous.owner || !_same(actual.cursor, previous.cursor)))) {
                            abort(_error('ConflictError', 'Another connection changed the saved visit.'));
                            return;
                        }
                        if (actual) {
                            store.put(record);
                            result(record);
                            return;
                        }
                        var count = store.count();
                        count.onsuccess = function () {
                            if (count.result >= 128) {
                                abort(_error('QuotaExceededError', 'Too many retained room visits.'));
                                return;
                            }
                            store.put(record);
                            result(record);
                        };
                    };
                });
            });
        };

        _this.receiveEvents = function (room, owner, page, items) {
            return Promise.resolve().then(function () {
                _identifier(room);
                if (!Array.isArray(items) || !items.length || items.length > 64) {
                    throw _error('DataError', 'Invalid room event page.');
                }
                var total = 0, epoch = _sequence(page.epoch);
                var records = items.map(function (item) {
                    var sequence = _sequence(item.messageSequence), expiry = _sequence(item.expiresAt);
                    var packet = _bytes(item.packet, 16384);
                    total += packet.length;
                    return { stream: _identifier(page.conversationId), id: _id(item.messageId),
                        epochHigh: epoch[0], epochLow: epoch[1], high: sequence[0], low: sequence[1],
                        expiresAt: expiry[0] * 4294967296 + expiry[1], packet: packet };
                });
                if (total > 65536) {
                    throw _error('QuotaExceededError', 'The room event page exceeds its storage budget.');
                }
                return _transaction(['visits', 'events', 'positions'], 'readwrite', function (transaction, result, abort) {
                    var visits = transaction.objectStore('visits'), events = transaction.objectStore('events'),
                        positions = transaction.objectStore('positions'), request = visits.get(room), added = [];
                    request.onsuccess = function () {
                        var visit = request.result;
                        if (!visit || visit.owner !== owner || visit.stream !== page.conversationId ||
                            Protocol.compare64(visit.epoch, page.epoch) !== 0 || Protocol.compare64(visit.saved, page.after) < 0) {
                            abort(_error('ConflictError', 'The room visit changed or a delivery page is missing.'));
                            return;
                        }
                        var budget = positions.get(['event-budget', '']);
                        budget.onsuccess = function () {
                            var usage = budget.result || { kind: 'event-budget', id: '', count: 0, bytes: 0 };
                            var collect = events.index('expiresAt').openCursor(IDBKeyRange.upperBound(Date.now())), removed = 0;
                            collect.onsuccess = function () {
                                var cursor = collect.result;
                                if (cursor && removed < 128) {
                                    usage.count--;
                                    usage.bytes -= cursor.value.packet.length;
                                    cursor.delete();
                                    ++removed;
                                    cursor.continue();
                                    return;
                                }
                                save(0);
                            };
                            function save(index) {
                                if (index === records.length) {
                                    if (Protocol.compare64(page.last, visit.saved) > 0) {
                                        visit.saved = page.last;
                                    }
                                    try {
                                        project(visit, items.filter(function (item) {
                                            return Protocol.compare64(item.messageSequence, visit.snapshotHead) > 0;
                                        }).map(function (item) { return item.event; }));
                                    } catch (error) {
                                        abort(error);
                                        return;
                                    }
                                    if (Protocol.compare64(page.last, visit.snapshotHead) > 0) {
                                        visit.snapshotHead = page.last;
                                    }
                                    visits.put(visit);
                                    positions.put(usage);
                                    result(added);
                                    return;
                                }
                                var record = records[index], lookup = events.get([record.stream, record.id]);
                                lookup.onsuccess = function () {
                                    var old = lookup.result;
                                    if (old && (old.epochHigh !== record.epochHigh || old.epochLow !== record.epochLow ||
                                        old.high !== record.high || old.low !== record.low || !_same(old.packet, record.packet))) {
                                        abort(_error('ConflictError', 'A saved room event changed its identity or content.'));
                                        return;
                                    }
                                    if (!old) {
                                        if (usage.count >= eventLimits.maxRecords || record.packet.length > eventLimits.maxBytes - usage.bytes) {
                                            abort(_error('QuotaExceededError', 'Room event history is full; no receipt was acknowledged.'));
                                            return;
                                        }
                                        events.add(record);
                                        usage.count++;
                                        usage.bytes += record.packet.length;
                                        // A replay already included in saved may have been collected at TTL.
                                        if (Protocol.compare64(items[index].messageSequence, visit.saved) > 0) {
                                            added.push(index);
                                        }
                                    }
                                    save(index + 1);
                                };
                            }
                        };
                    };
                });
            });
        };

        _this.confirmEvents = function (room, owner, previous, cursor, through) {
            return Promise.resolve().then(function () {
                var bytes = _bytes(cursor, 256), old = _bytes(previous, 256);
                _sequence(through);
                return _transaction(['visits'], 'readwrite', function (transaction, result, abort) {
                    var store = transaction.objectStore('visits'), request = store.get(room);
                    request.onsuccess = function () {
                        var visit = request.result;
                        if (!visit || visit.owner !== owner || !_same(visit.cursor, old) ||
                            Protocol.compare64(through, visit.saved) > 0 || Protocol.compare64(through, visit.confirmed) < 0) {
                            abort(_error('ConflictError', 'Only a saved page from the current visit can be confirmed.'));
                            return;
                        }
                        visit.cursor = bytes;
                        visit.confirmed = through;
                        store.put(visit);
                        result(visit);
                    };
                });
            });
        };

        _this.endEvents = function (room, owner) {
            return _transaction(['visits'], 'readwrite', function (transaction, result, abort) {
                var store = transaction.objectStore('visits'), request = store.get(room);
                request.onsuccess = function () {
                    if (request.result && request.result.owner !== owner) {
                        abort(_error('ConflictError', 'Another connection owns this visit.'));
                        return;
                    }
                    store.delete(room);
                };
            });
        };

        _this.roomEvents = function (stream, epoch, after, limit) {
            return Promise.resolve().then(function () {
                _identifier(stream);
                var version = _sequence(epoch), start = after ? _sequence(after) : [0, 0];
                if (!_integer(limit, 1, 64)) {
                    throw _error('QuotaExceededError', 'Event page limit must be between 1 and 64.');
                }
                var range = IDBKeyRange.bound([stream, version[0], version[1], start[0], start[1]],
                    [stream, version[0], version[1], 4294967295, 4294967295], !!after, false);
                return _transaction(['events'], 'readonly', function (transaction, result) {
                    var records = [], bytes = 0, request = transaction.objectStore('events').index('sequence').openCursor(range);
                    request.onsuccess = function () {
                        var cursor = request.result;
                        if (!cursor || records.length === limit || cursor.value.packet.length > 65536 - bytes) {
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

