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

    function _target(room, channel) {
        return [_field('type', Type.STRING, channel ? 'channel' : 'room'), _field('id', Type.STRING, room)];
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

    function _event(fields) {
        Protocol.validateFields(fields, [
            { key: 'kind', type: Type.STRING }, { key: 'entityId', type: Type.STRING },
            { key: 'revision', type: Type.UINT64 }, { key: 'occurredAt', type: Type.UINT64 },
            { key: 'payload', type: Type.OBJECT },
        ]);
        var event = _object(fields), payload = event.payload, rules;
        if (!event.revision.high && !event.revision.low) {
            throw _error('DataError', 'Event revision is empty.');
        }
        if (Protocol.giftEvent(event.kind)) {
            rules = [{ key: 'giftId', type: Type.STRING }, { key: 'count', type: Type.UINT32 },
                { key: 'receiverId', type: Type.STRING }, { key: 'senderId', type: Type.STRING },
                { key: 'displayUntil', type: Type.UINT64 }];
            if (event.kind === 'channel.gift') {
                rules = rules.concat([{ key: 'channelAppId', type: Type.STRING }, { key: 'businessId', type: Type.STRING },
                    { key: 'channelGeneration', type: Type.UINT64 }, { key: 'channelRevision', type: Type.UINT64 }]);
                if (!/^[0-9a-f-]{36}$/.test(payload.channelAppId || '') || !/^[0-9a-f-]{36}$/.test(payload.businessId || '')) {
                    throw _error('DataError', 'Invalid channel gift identity.');
                }
            }
        } else if (event.kind === 'room.state') {
            rules = [{ key: 'name', type: Type.STRING }, { key: 'visibility', type: Type.STRING },
                { key: 'kind', type: Type.STRING }, { key: 'state', type: Type.STRING }, { key: 'ownerId', type: Type.STRING }];
            if (!payload.name || ['public', 'private'].indexOf(payload.visibility) < 0 ||
                ['live', 'group'].indexOf(payload.kind) < 0 || ['active', 'closed'].indexOf(payload.state) < 0) {
                throw _error('DataError', 'Invalid public room state.');
            }
        } else if (event.kind === 'stage.policy') {
            rules = [{ key: 'mode', type: Type.STRING }, { key: 'capacity', type: Type.UINT32 },
                { key: 'allowedMask', type: Type.UINT64 }];
            if (['closed', 'free', 'apply'].indexOf(payload.mode) < 0 || payload.capacity < 1 || payload.capacity > 16 ||
                !payload.allowedMask || payload.allowedMask.high || !payload.allowedMask.low || (payload.allowedMask.low & ~112)) {
                throw _error('DataError', 'Invalid stage policy.');
            }
        } else if (event.kind === 'stage.member') {
            rules = [{ key: 'userId', type: Type.STRING }, { key: 'slot', type: Type.UINT32 },
                { key: 'allowedMask', type: Type.UINT64 }, { key: 'state', type: Type.STRING },
                { key: 'expiresAt', type: Type.UINT64 }];
            if (payload.presentation !== undefined) {
                rules.push({ key: 'presentation', type: Type.STRING });
                if (['', 'host', 'anchor', 'presenter'].indexOf(payload.presentation) < 0) {
                    throw _error('DataError', 'Invalid stage presentation.');
                }
            }
            if (!/^[0-9a-f-]{36}$/.test(payload.userId) || payload.slot < 1 || payload.slot > 16 ||
                !payload.allowedMask || payload.allowedMask.high || !payload.allowedMask.low || (payload.allowedMask.low & ~112) ||
                ['reserved', 'in-use', 'ending', 'ended'].indexOf(payload.state) < 0) {
                throw _error('DataError', 'Invalid stage member.');
            }
        } else if (event.kind === 'media.resource') {
            rules = [{ key: 'ownerId', type: Type.STRING }, { key: 'purpose', type: Type.STRING },
                { key: 'audio', type: Type.BOOL }, { key: 'video', type: Type.BOOL }, { key: 'state', type: Type.STRING },
                { key: 'resourceGeneration', type: Type.UINT64 }, { key: 'resourceRevision', type: Type.UINT64 }];
            if (['camera', 'screen', 'audio'].indexOf(payload.purpose) < 0 || ['enabled', 'revoked'].indexOf(payload.state) < 0) {
                throw _error('DataError', 'Invalid media resource state.');
            }
        } else if (event.kind === 'channel.program') {
            rules = ['appId', 'channelAppId', 'businessId', 'pkId', 'state', 'mode', 'streamId', 'originalStreamId', 'userId', 'protocol', 'details'].map(function (key) {
                return { key: key, type: Type.STRING };
            }).concat(['channelGeneration', 'channelRevision', 'endsAt'].map(function (key) { return { key: key, type: Type.UINT64 }; }));
            var identifier = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
            if (['appId', 'channelAppId', 'businessId'].some(function (key) { return !identifier.test(payload[key]); }) ||
                ['pkId', 'streamId', 'originalStreamId'].some(function (key) { return payload[key] && !identifier.test(payload[key]); }) ||
                event.entityId !== 'program-' + payload.channelAppId || payload.appId === payload.channelAppId ||
                ['invited', 'preparing', 'active', 'ended', 'failed', 'cancelled'].indexOf(payload.state) < 0 ||
                ['original', 'pk'].indexOf(payload.mode) < 0 || payload.protocol !== 'HTTP-FLV' || typeof payload.details !== 'string' || payload.details.length > 8192 ||
                !/^[A-Za-z0-9_.-]{1,128}$/.test(payload.userId) ||
                (payload.mode === 'pk' && (payload.state !== 'active' || !payload.pkId || !payload.streamId || payload.streamId === payload.originalStreamId))) {
                throw _error('DataError', 'Invalid channel program.');
            }
        } else if (event.kind === 'channel.publication') {
            rules = ['appId', 'channelAppId', 'streamId', 'instanceId', 'userId', 'product', 'protocol', 'state', 'nodeId', 'bootId'].map(function (key) {
                return { key: key, type: Type.STRING };
            }).concat(['generation', 'channelGeneration', 'channelRevision', 'serviceGeneration'].map(function (key) {
                return { key: key, type: Type.UINT64 };
            }));
            var uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
            if (['appId', 'channelAppId', 'streamId', 'instanceId', 'bootId'].some(function (key) {
                return !uuid.test(payload[key]) || payload[key] === '00000000-0000-0000-0000-000000000000';
            }) || payload.appId === payload.channelAppId || !/^[A-Za-z0-9_.-]{1,128}$/.test(payload.userId) || !payload.nodeId ||
                ['live', 'rtc'].indexOf(payload.product) < 0 || ['WHIP', 'RTMP', 'RTSP'].indexOf(payload.protocol) < 0 ||
                ['active', 'stopped', 'unknown'].indexOf(payload.state) < 0 || !/^p-[0-9a-f]{64}$/.test(event.entityId)) {
                throw _error('DataError', 'Invalid channel publication.');
            }
        } else if (event.kind === 'media.publication') {
            rules = [{ key: 'publisherGeneration', type: Type.UINT64 }, { key: 'nodeId', type: Type.STRING },
                { key: 'bootId', type: Type.STRING }, { key: 'sessionId', type: Type.STRING },
                { key: 'protocol', type: Type.STRING }, { key: 'state', type: Type.STRING },
                { key: 'validUntil', type: Type.UINT64 }, { key: 'resourceRevision', type: Type.UINT64 }];
            if (['reserved', 'starting', 'active', 'stopped', 'failed', 'unknown'].indexOf(payload.state) < 0 ||
                ['WHIP', 'RTMP', 'RTSP'].indexOf(payload.protocol) < 0) {
                throw _error('DataError', 'Invalid media publication state.');
            }
        } else {
            throw _error('NotSupportedError', 'Unknown room event cannot be acknowledged.');
        }
        if (!Protocol.giftEvent(event.kind) && !Protocol.channelEvent(event.kind)) {
            rules = rules.concat([{ key: 'roomGeneration', type: Type.UINT64 }, { key: 'controlRevision', type: Type.UINT64 }]);
        }
        Protocol.validateFields(fields[4].value, rules);
        if (Protocol.giftEvent(event.kind)) {
            if (event.revision.high || event.revision.low !== 1 || !/^[0-9a-f]{32}$/.test(event.entityId) ||
                !/^[A-Za-z0-9_.-]{1,128}$/.test(payload.giftId) || !payload.count ||
                !/^[0-9a-f-]{36}$/.test(payload.senderId) || !/^[0-9a-f-]{36}$/.test(payload.receiverId) ||
                _milliseconds(payload.displayUntil) < _milliseconds(event.occurredAt) ||
                _milliseconds(payload.displayUntil) - _milliseconds(event.occurredAt) > 3600000) {
                throw _error('DataError', 'Invalid confirmed gift fact.');
            }
            if (event.kind === 'channel.gift' && ((!payload.channelGeneration.high && !payload.channelGeneration.low) ||
                (!payload.channelRevision.high && !payload.channelRevision.low))) { throw _error('DataError', 'Empty channel gift boundary.'); }
        } else if (Protocol.channelEvent(event.kind)) {
            (event.kind === 'channel.publication' ? ['generation', 'channelGeneration', 'channelRevision', 'serviceGeneration'] :
                ['channelGeneration', 'channelRevision']).forEach(function (key) {
                if (!payload[key].high && !payload[key].low) { throw _error('DataError', 'Empty channel boundary.'); }
            });
        } else if (!/^[0-9a-f-]{36}$/.test(event.entityId) ||
            (!payload.roomGeneration.high && !payload.roomGeneration.low) || (!payload.controlRevision.high && !payload.controlRevision.low)) {
            throw _error('DataError', 'Invalid state identity or control boundary.');
        }
        return event;
    }

    function _apply(projection, event) {
        if (Protocol.giftEvent(event.kind)) {
            return true;
        }
        var key = event.kind + ':' + event.entityId, previous = projection[key];
        if (previous && Protocol.compareEventState(event, previous) <= 0) {
            return false;
        }
        if (event.kind === 'media.resource' && event.payload.state === 'revoked') {
            delete projection[key];
            delete projection['media.publication:' + event.entityId];
        } else if ((event.kind === 'stage.member' && event.payload.state === 'ended') ||
            (event.kind === 'channel.publication' && event.payload.state !== 'active')) {
            delete projection[key];
        } else {
            projection[key] = event;
        }
        return true;
    }

    function _view(state, known) {
        known = !!known && state.info.snapshotReady;
        var room = state.projection['room.state:' + state.room];
        var view = { known: known, head: state.info.head,
            states: Object.keys(state.projection).map(function (key) {
                var event = state.projection[key], payload = Object.assign({}, event.payload);
                if (event.kind === 'channel.publication' && payload.state === 'active' &&
                    (!known || !state.origins || state.origins[payload.nodeId] !== payload.bootId)) {
                    payload.state = 'unknown';
                }
                if (event.kind === 'media.publication' && ['reserved', 'starting', 'active'].indexOf(payload.state) >= 0) {
                    var resource = state.projection['media.resource:' + event.entityId];
                    if ((room && room.payload.state === 'closed') || (resource && resource.payload.state === 'revoked')) {
                        payload.state = 'stopped';
                    } else if (!known || !resource || !state.origins || state.origins[payload.nodeId] !== payload.bootId ||
                        Protocol.compare64(payload.publisherGeneration, resource.payload.resourceGeneration) !== 0) {
                        payload.state = 'unknown';
                    }
                }
                return { kind: event.kind, entityId: event.entityId, revision: event.revision,
                    occurredAt: event.occurredAt, payload: payload };
            }) };
        view[state.channel ? 'appId' : 'roomId'] = state.room;
        return view;
    }

    function Events(storage, request, deliver, failed, stateVersion, speakersChanged, refreshSpeakers) {
        var channel = stateVersion === 5, _this = this, _closed = false, _rooms = Object.create(null), _streams = Object.create(null),
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

        function snapshotPage(state, info) {
            if (!Array.isArray(info.snapshot) || info.snapshot.length > (channel ? 32 : 128)) {
                throw _error('DataError', 'Invalid public room snapshot.');
            }
            var snapshot = [], snapshotBytes = 0;
            info.snapshot.forEach(function (entry) {
                if (entry.type !== Type.BYTES || !(entry.value instanceof Uint8Array)) {
                    throw _error('DataError', 'Snapshot entries must contain encoded state objects.');
                }
                snapshotBytes += entry.value.length;
                var fields = Protocol.decodeObject(entry.value);
                Protocol.validateFields(fields, [
                    { key: 'messageId', type: Type.BYTES }, { key: 'messageSequence', type: Type.UINT64 },
                    { key: 'acceptedAt', type: Type.UINT64 }, { key: 'expiresAt', type: Type.UINT64 },
                    { key: 'event', type: Type.OBJECT },
                ]);
                var item = _object(fields), event = _event(fields[4].value);
                if (channel !== Protocol.channelEvent(event.kind) ||
                    (channel && (event.payload.channelAppId !== state.room || (event.kind === 'channel.publication' && event.payload.state !== 'active')))) {
                    throw _error('DataError', 'Snapshot profile mismatch.');
                }
                if (Protocol.giftEvent(event.kind) || ((event.kind === 'room.state' || event.kind === 'stage.policy') && event.entityId !== state.room) ||
                    (event.kind === 'media.resource' && event.payload.state === 'revoked') ||
                    (event.kind === 'stage.member' && event.payload.state === 'ended') ||
                    state.projection[event.kind + ':' + event.entityId] ||
                    Protocol.compare64((channel ? event.payload.channelGeneration : event.payload.roomGeneration), info.epoch) !== 0 ||
                    Protocol.compare64(item.messageSequence, info.head) > 0 || !_apply(state.projection, event)) {
                    throw _error('DataError', 'Snapshot is not a unique projection at its head.');
                }
                snapshot.push(event);
            });
            if (!channel && info.snapshotReady && !state.projection['room.state:' + state.room]) {
                throw _error('DataError', 'A complete baseline must contain its room state.');
            }
            if (snapshotBytes > 61440) {
                throw _error('QuotaExceededError', 'Room snapshot exceeds its budget.');
            }
            return snapshot;
        }

        _this.join = function (room, resume, accept, speakers) {
            return Promise.resolve().then(function () {
                active();
                (channel ? ['eventVisit', 'beginEventSnapshot', 'saveEventSnapshot', 'finishEventSnapshot', 'receiveEvents', 'confirmEvents', 'endEvents', 'roomState'] :
                    ['eventVisit', 'beginEvents', 'receiveEvents', 'confirmEvents', 'endEvents', 'roomState']).forEach(function (method) {
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
                var state = { channel: channel, room: room, queue: Promise.resolve(), ready: null, nextAckAt: Infinity, pages: 0, bytes: 0,
                    origins: Object.create(null), originsRevision: { high: 0, low: 0 } };
                _rooms[room] = state;
                if (speakers) {
                    if (stateVersion < 3 || !IM.Speakers) {
                        delete _rooms[room];
                        throw _error('NotSupportedError', 'Speaker observations require state version 3.');
                    }
                    state.speakers = new IM.Speakers(room, function () {
                        return state.saved ? { info: state.info, projection: state.projection } : null;
                    }, speakersChanged, function () { return refreshSpeakers(room); });
                }
                state.ready = storage.eventVisit(room).then(function (previous) {
                    active(state);
                    if (resume && !previous) {
                        var error = _error('NotFoundError', 'The previous visit was lost; explicitly join a new visit.');
                        error.code = Protocol.Status.GONE;
                        throw error;
                    }
                    var fields = [_field('topic', Type.STRING, 'events'), _field('target', Type.OBJECT, _target(room, channel))];
                    if (resume && (previous.stateVersion || 1) !== stateVersion) {
                        throw _error('NotSupportedError', 'The saved visit uses another state version; explicitly join a new visit.');
                    }
                    if (resume) {
                        fields.push(_field('cursor', Type.BYTES, previous.cursor));
                    }
                    if (stateVersion >= 2) {
                        fields.push(_field('stateVersion', Type.UINT16, stateVersion));
                    }
                    if (speakers) {
                        fields.push(_field('speakersVersion', Type.UINT16, 1));
                    }
                    var started = performance.now();
                    return request(Opcode.SUBSCRIBE, fields).then(function (info) {
                        active(state);
                        if ((info.stateVersion || 1) !== stateVersion) {
                            throw _error('NotSupportedError', 'The server did not negotiate this room state version.');
                        }
                        accept(info);
                        if (state.speakers) {
                            state.speakers.negotiate(info, started);
                        }
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
                        state.projection = Object.create(null);
                        var snapshot = snapshotPage(state, info);
                        state.info = info;
                        state.cursor = new Uint8Array(info.cursor);
                        state.through = cursor.last;
                        state.identity = cursor;
                        state.nextAckAt = Math.min(Date.now() + 300000, Date.now() + (cursor.expiresAt - Date.now()) / 3);
                        _streams[info.conversationId] = state;
                        var baseline = { stream: cursor.stream, epoch: cursor.epoch,
                            through: cursor.last, cursor: info.cursor, stateVersion: stateVersion, snapshot: snapshot,
                            snapshotHead: info.head, snapshotReady: info.snapshotReady };
                        var saved;
                        if (channel) {
                            var deadline = info.snapshotPage && _milliseconds(info.snapshotPage.expiresAt), index = 0;
                            function savePage(page, events) {
                                active(state);
                                if (!page.snapshotPage || !deadline || Date.now() >= deadline ||
                                    _milliseconds(page.snapshotPage.expiresAt) !== deadline ||
                                    Protocol.compare64(page.epoch, info.epoch) !== 0 || Protocol.compare64(page.head, info.head) !== 0) {
                                    throw _error('DataError', 'The snapshot expired or changed its boundary.');
                                }
                                return storage.saveEventSnapshot(room, _owner, index++, events).then(function () {
                                    active(state);
                                    if (page.snapshotPage.done) {
                                        return storage.finishEventSnapshot(room, _owner).then(function () {
                                            active(state);
                                            state.through = info.head;
                                            return acknowledge(state);
                                        });
                                    }
                                    return request(Opcode.FETCH, [_field('kind', Type.STRING, 'events'),
                                        _field('target', Type.OBJECT, _target(room, true)),
                                        _field('snapshotCursor', Type.BYTES, page.snapshotPage.cursor)]).then(function (next) {
                                        active(state);
                                        return savePage(next, snapshotPage(state, next));
                                    });
                                });
                            }
                            saved = storage.beginEventSnapshot(room, baseline, previous, _owner, resume).then(function () {
                                return savePage(info, snapshot);
                            });
                        } else {
                            saved = storage.beginEvents(room, baseline, previous, _owner, resume);
                        }
                        return saved.then(function () {
                            active(state);
                            state.saved = true;
                            deliver({ target: { type: channel ? 'channel' : 'room', id: room }, messaging: true, type: channel ? 'channel.snapshot' : 'room.snapshot',
                                snapshot: true, content: _view(state, true) });
                            if (state.speakers) { state.speakers.maintain(); }
                            return info;
                        });
                    });
                }).catch(function (error) {
                    if (_rooms[room] === state) {
                        if (state.speakers) { state.speakers.close(); }
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

        _this.negotiate = function (room, info, started) {
            var state = _rooms[room];
            if (state && state.speakers) { state.speakers.negotiate(info, started); }
        };

        _this.observe = function (fields) {
            var data = _object(fields), state = data.target && _rooms[data.target.id];
            if (state && state.speakers) { state.speakers.receive(fields); }
        };

        _this.speakers = function (room) {
            var state = _rooms[room];
            return state && state.speakers ? state.speakers.view() :
                { roomId: room, known: false, complete: false, validUntil: '0', priority: [], items: [] };
        };

        _this.resolution = function (room) {
            active();
            var state = _rooms[room];
            if (!state) {
                return Promise.reject(_error('InvalidStateError', 'Join the reliable room event stream before sending a gift.'));
            }
            return state.ready;
        };

        _this.origins = function (data) {
            active();
            var state = _streams[data.conversationId];
            if (!state || stateVersion < 4 || Protocol.compare64(data.epoch, state.info.epoch) !== 0 ||
                !Array.isArray(data.items) || data.items.length > (channel ? 32 : 128)) {
                return Promise.reject(_error('DataError', 'Invalid room source identity update.'));
            }
            var origins = Object.create(null), bytes = 0;
            try {
                data.items.forEach(function (entry) {
                    if (entry.type !== Type.BYTES || !(entry.value instanceof Uint8Array)) {
                        throw _error('DataError', 'Source identities must be encoded objects.');
                    }
                    bytes += entry.value.length;
                    var fields = Protocol.decodeObject(entry.value);
                    Protocol.validateFields(fields, [{ key: 'nodeId', type: Type.STRING }, { key: 'bootId', type: Type.STRING }]);
                    var value = _object(fields);
                    if (!value.nodeId || value.nodeId.length > 128 || origins[value.nodeId] ||
                        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value.bootId)) {
                        throw _error('DataError', 'Invalid or duplicate room source identity.');
                    }
                    origins[value.nodeId] = value.bootId;
                });
            } catch (error) {
                return Promise.reject(error);
            }
            return serialize(state, bytes, function () {
                if (Protocol.compare64(data.revision, state.originsRevision) <= 0) {
                    throw _error('DataError', 'Room source identity revision did not advance.');
                }
                if (channel) {
                    var page = data.page, pending = state.originsPending;
                    if (!page || typeof page.after !== 'string' || page.after.length > 128 || typeof page.done !== 'boolean') {
                        throw _error('DataError', 'Invalid paged channel source identities.');
                    }
                    if (!pending || Protocol.compare64(data.revision, pending.revision) > 0) {
                        pending = state.originsPending = { revision: data.revision, after: '', bytes: 0, values: Object.create(null) };
                        state.origins = Object.create(null);
                    } else if (Protocol.compare64(data.revision, pending.revision) < 0) {
                        throw _error('DataError', 'Channel source identity revision went backwards.');
                    }
                    if ((pending.after && page.after <= pending.after) || (!page.done && !page.after)) {
                        throw _error('DataError', 'Channel source identity page did not advance.');
                    }
                    Object.keys(origins).forEach(function (node) {
                        if (pending.values[node]) { throw _error('DataError', 'Repeated source identity in paged baseline.'); }
                        pending.bytes += node.length + origins[node].length + 512;
                        if (pending.bytes > 8388608) { throw _error('QuotaExceededError', 'Channel source identity memory budget exceeded.'); }
                        pending.values[node] = origins[node];
                    });
                    pending.after = page.after;
                    if (page.done) {
                        state.origins = pending.values;
                        state.originsRevision = data.revision;
                        state.originsPending = null;
                    }
                } else {
                    state.originsRevision = data.revision;
                    state.origins = origins;
                }
                // These identities belong to this connection, not the durable
                // event log. A reconnect starts unknown until its own notice.
                deliver({ target: { type: channel ? 'channel' : 'room', id: state.room }, messaging: true, type: channel ? 'channel.snapshot' : 'room.snapshot',
                    snapshot: true, content: _view(state, true) });
            });
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
                    event = item.event = _event(entry.value[4].value);
                    if (channel !== Protocol.channelEvent(event.kind) || (channel && event.payload.channelAppId !== state.room)) {
                        throw _error('DataError', 'Event profile mismatch.');
                    }
                    if ((!Protocol.giftEvent(event.kind) || channel) && (((event.kind === 'room.state' || event.kind === 'stage.policy') && event.entityId !== state.room) ||
                        Protocol.compare64((channel ? event.payload.channelGeneration : event.payload.roomGeneration), page.epoch) !== 0)) {
                        throw _error('DataError', 'State belongs to another room generation.');
                    }
                    item.packet = Protocol.encode({ opcode: Opcode.NOTIFY, messaging: true, sequenceNumber: 0, fields: [
                        _field('event', Type.UINT16, Protocol.Event.IM_SYNC_REQUIRED), _field('data', Type.OBJECT, entry.value),
                    ] });
                    bytes += item.packet.length;
                    records.push(item);
                    notifications.push({ target: { type: channel ? 'channel' : 'room', id: state.room }, messaging: true,
                        meta: { messageId: item.messageId, conversationId: page.conversationId, epoch: page.epoch,
                            messageSequence: item.messageSequence, acceptedAt: item.acceptedAt, expiresAt: item.expiresAt },
                        type: event.kind, content: event.payload, event: event,
                        live: Protocol.giftEvent(event.kind) && _milliseconds(event.payload.displayUntil) > Date.now() });
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
                    var changed = false;
                    added.forEach(function (index) {
                        active(state);
                        if ((Protocol.giftEvent(records[index].event.kind) ||
                            Protocol.compare64(records[index].messageSequence, state.info.head) > 0) &&
                            _apply(state.projection, records[index].event)) {
                            changed = changed || !Protocol.giftEvent(records[index].event.kind);
                            deliver(notifications[index]);
                        }
                    });
                    if (Protocol.compare64(page.last, state.info.head) > 0) {
                        state.info.head = page.last;
                    }
                    if (changed) {
                        active(state);
                        deliver({ target: { type: channel ? 'channel' : 'room', id: state.room }, messaging: true, type: channel ? 'channel.snapshot' : 'room.snapshot',
                            snapshot: true, content: _view(state, true) });
                    }
                    if (state.speakers) { state.speakers.maintain(); }
                    if (state.pages >= Math.max(1, Math.floor(state.info.delivery.maxPages / 2)) ||
                        state.bytes >= state.info.delivery.maxBytes / 2) {
                        return acknowledge(state);
                    }
                });
            });
        };

        function acknowledge(state) {
            var before = state.cursor, through = state.through;
            return request(Opcode.COMMIT, [_field('kind', Type.STRING, 'events'), _field('target', Type.OBJECT, _target(state.room, channel)),
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

        _this.state = function (room) {
            active();
            var state = _rooms[room];
            if (!state) {
                var empty = { known: false, states: [] };
                empty[channel ? 'appId' : 'roomId'] = room;
                return Promise.resolve(empty);
            }
            return state.ready.then(function () {
                return serialize(state, 0, function () { return storage.roomState(room); });
            }).then(function (stored) {
                active(state);
                if (!stored || stored.owner !== _owner) {
                    throw _error('ConflictError', 'Another connection owns the saved room state.');
                }
                var current = { channel: channel, room: room, projection: Object.create(null),
                    info: { head: stored.head, snapshotReady: stored.ready }, origins: state.origins };
                stored.states.forEach(function (event) { _apply(current.projection, event); });
                return _view(current, true);
            });
        };

        _this.maintain = function () {
            if (_closed) {
                return;
            }
            Object.keys(_rooms).forEach(function (room) {
                var state = _rooms[room];
                if (state.speakers) { state.speakers.maintain(); }
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
            if (state.speakers) { state.speakers.close(); }
            return serialize(state, 0, function () {
                return storage.endEvents(room, _owner).then(function () {
                    active(state);
                    deliver({ target: { type: channel ? 'channel' : 'room', id: room }, messaging: true, type: channel ? 'channel.snapshot' : 'room.snapshot',
                        snapshot: true, content: _view(state, false) });
                    delete _rooms[room];
                    delete _streams[state.info.conversationId];
                });
            });
        };

        _this.close = function () {
            _closed = true;
            Object.keys(_rooms).forEach(function (room) {
                if (_rooms[room].speakers) { _rooms[room].speakers.close(); }
            });
            _rooms = Object.create(null);
            _streams = Object.create(null);
        };
    }

    IM.Events = Events;
    IM.Events.Memory = function (identity, options) {
        options = options || {};
        var maxBytes = options.maxStateBytes === undefined ? 8388608 : options.maxStateBytes;
        if (typeof maxBytes !== 'number' || !isFinite(maxBytes) || Math.floor(maxBytes) !== maxBytes ||
            maxBytes < 65536 || maxBytes > 1073741824) {
            throw _error('TypeError', 'Invalid channel memory budget.');
        }
        var visits = Object.create(null), staging = null, closed = false;
        function visit(room, owner) {
            var value = visits[room];
            if (closed || !value || value.owner !== owner) { throw _error('InvalidStateError', 'Channel visit is closed.'); }
            return value;
        }
        function project(previous, events) {
            var next = Object.assign(Object.create(null), previous);
            events.forEach(function (event) { _apply(next, event); });
            if (Protocol.text(JSON.stringify(next)).length > maxBytes) {
                throw _error('QuotaExceededError', 'Channel projection exceeds its memory budget.');
            }
            return next;
        }
        this.identity = function () { return identity; };
        this.open = function () { return Promise.resolve(); };
        this.close = function () { closed = true; visits = Object.create(null); staging = null; return Promise.resolve(); };
        this.eventVisit = function (room) { return Promise.resolve(visits[room] || null); };
        this.beginEvents = function (room, value, previous, owner, resumed) {
            return Promise.resolve().then(function () {
                if (closed || resumed || (visits[room] && visits[room] !== previous) || Object.keys(visits).length >= 1) {
                    throw _error('InvalidStateError', 'An ephemeral channel requires a fresh visit.');
                }
                visits[room] = { owner: owner, cursor: new Uint8Array(value.cursor), saved: value.through,
                    confirmed: value.through, head: value.snapshotHead, ready: value.snapshotReady,
                    projection: project(Object.create(null), value.snapshot) };
            });
        };
        this.beginEventSnapshot = function (room, value, previous, owner, resumed) {
            return Promise.resolve().then(function () {
                if (closed || resumed || previous || Object.keys(visits).length || value.stateVersion !== 5) {
                    throw _error('InvalidStateError', 'An ephemeral channel requires a fresh visit.');
                }
                staging = { room: room, owner: owner, page: 0, cursor: new Uint8Array(value.cursor), saved: value.snapshotHead,
                    confirmed: value.through, head: value.snapshotHead, ready: value.snapshotReady,
                    projection: Object.create(null) };
            });
        };
        this.saveEventSnapshot = function (room, owner, page, events) {
            return Promise.resolve().then(function () {
                if (closed || !staging || staging.room !== room || staging.owner !== owner || staging.page !== page) {
                    throw _error('ConflictError', 'The ephemeral snapshot page changed.');
                }
                staging.projection = project(staging.projection, events); staging.page++;
            });
        };
        this.finishEventSnapshot = function (room, owner) {
            return Promise.resolve().then(function () {
                if (closed || !staging || staging.room !== room || staging.owner !== owner || !staging.page) {
                    throw _error('ConflictError', 'The ephemeral snapshot is incomplete.');
                }
                visits[room] = staging; staging = null;
            });
        };
        this.receiveEvents = function (room, owner, page, items) {
            return Promise.resolve().then(function () {
                var value = visit(room, owner);
                if (Protocol.compare64(page.after, value.saved) !== 0) { throw _error('ConflictError', 'Channel page is not contiguous.'); }
                var next = project(value.projection, items.map(function (item) { return item.event; }));
                value.projection = next; value.saved = page.last; value.head = page.last;
                return items.map(function (_, index) { return index; });
            });
        };
        this.confirmEvents = function (room, owner, previous, cursor, through) {
            return Promise.resolve().then(function () {
                var value = visit(room, owner);
                if (!_same(previous, value.cursor) || Protocol.compare64(through, value.saved) > 0 ||
                    Protocol.compare64(through, value.confirmed) < 0) { throw _error('ConflictError', 'Channel page is not saved.'); }
                value.cursor = new Uint8Array(cursor); value.confirmed = through;
            });
        };
        this.roomState = function (room) {
            var value = visits[room];
            return Promise.resolve(value ? { owner: value.owner, head: value.head, ready: value.ready,
                states: Object.keys(value.projection).map(function (key) { return value.projection[key]; }) } : null);
        };
        this.endEvents = function (room, owner) {
            return Promise.resolve().then(function () { visit(room, owner); delete visits[room]; });
        };
    };
})(odd);

