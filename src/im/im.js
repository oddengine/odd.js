(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        NetStatusEvent = events.NetStatusEvent,
        State = { INITIALIZED: 'initialized', CONNECTING: 'connecting',
            CONNECTED: 'connected', CLOSING: 'closing', CLOSED: 'closed' },
        IMEvent = { NOTIFY: 'im-notify', MESSAGE: 'im-message' },
        _id = 0,
        _generation = 0,
        _instances = Object.create(null),
        _default = { url: '', credentials: null, socketFactory: null,
            connectTimeout: 10000, requestTimeout: 15000, maxBufferedBytes: 262144,
            retry: { delay: 2000, count: 0 } };

    function error(name, message) {
        var value = new Error(message);
        value.name = name;
        return value;
    }

    function integer(value, min, max) {
        return typeof value === 'number' && isFinite(value) &&
            Math.floor(value) === value && value >= min && value <= max;
    }

    function field(key, type, value) {
        return { key: key, type: type, value: value };
    }

    function object(fields) {
        var value = Object.create(null);
        for (var i = 0; i < fields.length; i++) {
            var item = fields[i];
            value[item.key] = item.type === 10 ? object(item.value) : item.value;
        }
        return value;
    }

    function milliseconds(value) {
        var number = value && value.high * 4294967296 + value.low;
        if (!integer(number, 0, 9007199254740991)) {
            throw error('DataError', 'Invalid absolute timestamp.');
        }
        return number;
    }

    // Each IM owns its socket attempt, request table and subscription intentions.
    // No stream/pipe identifiers or post-upgrade AUTH transaction are involved.
    function IM(id, logger) {
        var _this = this,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger(id, logger),
            _state = State.INITIALIZED,
            _attempt = null,
            _rooms = Object.create(null),
            _retryTimer = null,
            _retried = 0,
            _manual = false,
            _destroyed = false,
            _lastClock = 0,
            P = IM.Protocol;

        EventDispatcher.call(this, 'IM', { id: id, logger: _logger }, Event, NetStatusEvent, IMEvent);
        _this.logger = _logger;
        _this.config = utils.extendz({}, _default);
        _this.id = function () { return id; };
        _this.state = function () { return _state; };
        _this.connected = function () { return _state === State.CONNECTED; };
        _this.userId = function () { return _attempt && _attempt.session ? _attempt.session.principal.id : ''; };

        function _clock() {
            var now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
            _lastClock = Math.max(_lastClock, Math.floor(now));
            return _lastClock;
        }

        _this.setup = function (config) {
            if (_destroyed || _attempt || _retryTimer !== null) {
                return Promise.reject(error('InvalidStateError', 'Close the current IM session before setup.'));
            }
            P = IM.Protocol;
            if (!P) { return Promise.reject(error('NotSupportedError', 'IM message protocol module is missing.')); }
            _this.config = utils.extendz({}, _default, config);
            var c = _this.config;
            if (!c.retry) { return Promise.reject(error('TypeError', 'retry must be an object.')); }
            if (!c.url && typeof location !== 'undefined') {
                c.url = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/im';
            }
            if (typeof c.url !== 'string' || !/^wss?:\/\//i.test(c.url) ||
                !integer(c.connectTimeout, 1, 300000) || !integer(c.requestTimeout, 1, 300000) ||
                !integer(c.maxBufferedBytes, 65536, 16777216) ||
                !integer(c.retry.delay, 1, 300000) || !integer(c.retry.count, -1, 65535) ||
                (c.credentials !== null && typeof c.credentials !== 'function') ||
                (c.socketFactory !== null && typeof c.socketFactory !== 'function')) {
                return Promise.reject(error('TypeError', 'Invalid IM connection configuration.'));
            }
            if (c.parameters && c.parameters.token) {
                return Promise.reject(error('NotSupportedError', 'Use handshake credentials; post-upgrade token authentication was removed.'));
            }
            _rooms = Object.create(null);
            _manual = false;
            _retried = 0;
            _this.dispatchEvent(Event.BIND);
            return _connect();
        };

        function _connect() {
            if (_destroyed || _manual) { return Promise.reject(error('InvalidStateError', 'IM is closed.')); }
            if (_attempt) { return _attempt.promise; }
            if (_generation >= 9007199254740991) {
                return Promise.reject(error('QuotaExceededError', 'Connection generation exhausted.'));
            }
            var attempt = { generation: ++_generation, socket: null, session: null,
                requests: new IM.RequestTable(_generation), maxPacketBytes: P.MAX_PACKET_SIZE,
                deadline: null, maintenance: null, resolve: null, reject: null };
            attempt.promise = new Promise(function (resolve, reject) {
                attempt.resolve = resolve;
                attempt.reject = reject;
            });
            _attempt = attempt;
            _state = State.CONNECTING;
            attempt.deadline = setTimeout(function () {
                _end(attempt, error('TimeoutError', 'IM handshake or SESSION_READY timed out.'));
            }, _this.config.connectTimeout);

            // Providers obtain a fresh one-use ticket for each connection attempt.
            Promise.resolve().then(function () {
                if (_attempt !== attempt) { return null; }
                return _this.config.credentials ? _this.config.credentials() : {};
            }).then(function (credentials) {
                if (_attempt !== attempt) { return; }
                credentials = credentials || {};
                var protocols = ['odd.im.v2'];
                if (credentials.ticket !== undefined) {
                    if (typeof credentials.ticket !== 'string' || !/^[A-Za-z0-9_-]{1,4096}$/.test(credentials.ticket)) {
                        throw error('DataError', 'Handshake ticket must be unpadded base64url.');
                    }
                    protocols.push('odd.ticket.' + credentials.ticket);
                }
                var factory = _this.config.socketFactory;
                if (!factory && typeof WebSocket === 'undefined') {
                    throw error('NotSupportedError', 'Provide a WebSocket adapter on this platform.');
                }
                var socket = factory ? factory(_this.config.url, protocols, credentials) :
                    new WebSocket(_this.config.url, protocols);
                attempt.socket = socket;
                if (!socket || typeof socket.send !== 'function' || typeof socket.close !== 'function') {
                    throw error('TypeError', 'Invalid WebSocket adapter.');
                }
                socket.binaryType = 'arraybuffer';
                socket.onopen = function () {
                    if (_attempt !== attempt) { return; }
                    if (socket.protocol !== 'odd.im.v2') {
                        _end(attempt, error('DataError', 'The server did not select odd.im.v2.'));
                    }
                    // SESSION_READY, not the open callback, supplies authenticated identity.
                };
                socket.onmessage = function (e) {
                    if (_attempt !== attempt) { return; }
                    try {
                        if (e.data && e.data.byteLength > attempt.maxPacketBytes) {
                            throw error('QuotaExceededError', 'Received packet exceeds the negotiated limit.');
                        }
                        _receive(attempt, P.decode(e.data));
                    }
                    catch (err) { _end(attempt, err); }
                };
                socket.onerror = function () { _end(attempt, error('NetworkError', 'IM WebSocket failed.')); };
                socket.onclose = function () { _end(attempt, error('NetworkError', 'IM WebSocket closed.')); };
            }).catch(function (err) { _end(attempt, err); });
            return attempt.promise;
        }

        function _schema(fields, rules) {
            P.validateFields(fields, rules.concat([{ key: 'ext', type: P.Type.OBJECT, required: false }]));
        }

        function _receive(attempt, message) {
            if (message.opcode === P.Opcode.STATUS) {
                if (!attempt.session) { throw error('DataError', 'STATUS before SESSION_READY.'); }
                attempt.requests.complete(message, attempt.generation);
                return;
            }
            if (message.opcode !== P.Opcode.NOTIFY) { throw error('DataError', 'Unexpected server operation.'); }
            var event = message.fields[0].value,
                payload = object(message.fields);
            if (event === P.Event.SESSION_READY) {
                if (attempt.session || message.messaging) { throw error('DataError', 'Duplicate or invalid SESSION_READY.'); }
                _schema(message.fields, [
                    { key: 'event', type: P.Type.UINT16 }, { key: 'sessionId', type: P.Type.BYTES },
                    { key: 'principal', type: P.Type.OBJECT }, { key: 'authRevision', type: P.Type.UINT64 },
                    { key: 'expiresAt', type: P.Type.UINT64 }, { key: 'maxPacketBytes', type: P.Type.UINT32 }
                ]);
                P.validateFields(message.fields[2].value, [
                    { key: 'kind', type: P.Type.UINT8 }, { key: 'id', type: P.Type.STRING }
                ]);
                if (payload.sessionId.length !== 16 || !integer(payload.principal.kind, 1, 3) ||
                    !payload.principal.id || P.text(payload.principal.id).length > 128 ||
                    !integer(payload.maxPacketBytes, P.HEADER_SIZE, P.MAX_PACKET_SIZE) ||
                    milliseconds(payload.expiresAt) <= Date.now()) {
                    throw error('DataError', 'Invalid authenticated session metadata.');
                }
                attempt.session = payload;
                attempt.maxPacketBytes = payload.maxPacketBytes;
                _state = State.CONNECTED;
                attempt.maintenance = setInterval(function () { _maintain(attempt); }, 250);
                _restore(attempt);
                return;
            }
            if (!attempt.session) { throw error('DataError', 'Expected SESSION_READY first.'); }
            var known = false;
            for (var key in P.Event) { if (P.Event[key] === event) { known = true; break; } }
            if (!known) { return; }
            if (event >= P.Event.ROOM_MESSAGE && event <= P.Event.ENDPOINT_MESSAGE) {
                _message(message, payload);
            }
            if (event === P.Event.ROOM_REVOKED && typeof payload.roomId === 'string') {
                delete _rooms[payload.roomId];
            }
            _this.dispatchEvent(IMEvent.NOTIFY, { event: event, messaging: message.messaging,
                payload: payload, fields: message.fields });
            if (event === P.Event.SESSION_REVOKED) {
                _manual = true;
                _end(attempt, error('NotAllowedError', 'IM session revoked.'));
            }
        }

        function _message(message, payload) {
            var names = ['room', 'group', 'user', 'endpoint'],
                kind = names[payload.event - P.Event.ROOM_MESSAGE],
                target = kind === 'room' ? 'roomId' : kind === 'group' ? 'groupId' : 'userId',
                rules = [{ key: 'event', type: P.Type.UINT16 }, { key: target, type: P.Type.STRING }];
            if (kind === 'endpoint') { rules.push({ key: 'endpointId', type: P.Type.STRING }); }
            rules.push({ key: 'sender', type: P.Type.OBJECT }, { key: 'meta', type: P.Type.OBJECT },
                { key: 'body', type: P.Type.OBJECT });
            _schema(message.fields, rules);
            if (message.messaging && (kind === 'room' || kind === 'endpoint')) {
                throw error('DataError', 'This message event only supports Relay.');
            }
            var bodyIndex = kind === 'endpoint' ? 5 : 4;
            // Public notification fields: event, target(s), sender, meta, body.
            P.validateFields(message.fields[bodyIndex - 2].value, [
                { key: 'kind', type: P.Type.UINT8 }, { key: 'id', type: P.Type.STRING },
                { key: 'deviceId', type: P.Type.STRING, required: false }
            ]);
            P.validateFields(message.fields[bodyIndex - 1].value, message.messaging ? [
                { key: 'messageId', type: P.Type.BYTES }, { key: 'conversationId', type: P.Type.STRING },
                { key: 'messageSequence', type: P.Type.UINT64 }
            ] : [{ key: 'eventId', type: P.Type.BYTES }, { key: 'expiresAt', type: P.Type.UINT64 }]);
            if (!payload[target] || P.text(payload[target]).length > 128 ||
                !integer(payload.sender.kind, 1, 3) || !payload.sender.id || P.text(payload.sender.id).length > 128 ||
                (message.messaging ? payload.meta.messageId.length : payload.meta.eventId.length) !== 16 ||
                (kind === 'endpoint' && (!payload.endpointId || P.text(payload.endpointId).length > 128)) ||
                (payload.sender.deviceId !== undefined && (!payload.sender.deviceId || P.text(payload.sender.deviceId).length > 128)) ||
                (message.messaging && (!payload.meta.conversationId || P.text(payload.meta.conversationId).length > 128 ||
                    (payload.meta.messageSequence.high === 0 && payload.meta.messageSequence.low === 0)))) {
                throw error('DataError', 'Invalid notification identity or metadata.');
            }
            if (!message.messaging && milliseconds(payload.meta.expiresAt) <= Date.now()) { return; }
            var body = message.fields[bodyIndex].value,
                content = body[message.messaging ? 1 : 0],
                bodyRules = [];
            if (!content || (content.type !== P.Type.STRING && content.type !== P.Type.BYTES)) {
                throw error('DataError', 'Invalid message content.');
            }
            if (message.messaging) { bodyRules.push({ key: 'clientMessageId', type: P.Type.BYTES }); }
            bodyRules.push({ key: 'content', type: content.type });
            _schema(body, bodyRules);
            if (message.messaging && body[0].value.length !== 16) { throw error('DataError', 'Invalid clientMessageId.'); }
            if ((content.type === P.Type.STRING ? P.text(content.value).length : content.value.length) > 16384) {
                throw error('DataError', 'Message content is too large.');
            }
            _this.dispatchEvent(IMEvent.MESSAGE, { target: { type: kind, id: payload[target],
                endpointId: payload.endpointId }, sender: payload.sender, meta: payload.meta,
                messaging: message.messaging, content: content.value, ext: payload.body.ext });
        }

        function _restore(attempt) {
            var rooms = Object.keys(_rooms), chain = Promise.resolve();
            rooms.forEach(function (roomId) {
                chain = chain.then(function () {
                    if (_attempt !== attempt || !_rooms[roomId]) { return; }
                    var intention = _rooms[roomId];
                    return _this.request(P.Opcode.ROOM_JOIN, [field('roomId', P.Type.STRING, roomId)], false,
                        _roomResult(roomId)).catch(function (err) {
                        if (_attempt !== attempt) { return; }
                        if (_rooms[roomId] === intention) { delete _rooms[roomId]; }
                        _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
                    });
                });
            });
            chain.then(function () {
                if (_attempt !== attempt) { return; }
                clearTimeout(attempt.deadline);
                attempt.deadline = null;
                _retried = 0;
                attempt.resolve(_this);
                _this.dispatchEvent(Event.READY);
            }).catch(function (err) { _end(attempt, err); });
        }

        function _maintain(attempt) {
            if (_attempt !== attempt) { return; }
            attempt.requests.expire(_clock()).forEach(function (item) {
                item.responder.reject(error('TimeoutError', 'IM request timed out; the remote result is unknown.'));
            });
            if (milliseconds(attempt.session.expiresAt) <= Date.now()) {
                _end(attempt, error('NotAllowedError', 'IM authentication expired.'));
            }
        }

        function _end(attempt, reason) {
            if (_attempt !== attempt) { return; }
            _attempt = null;
            _state = State.CLOSED;
            clearTimeout(attempt.deadline);
            clearInterval(attempt.maintenance);
            var socket = attempt.socket;
            if (socket) {
                socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
                try { socket.close(); } catch (ignore) { /* Already closed adapter. */ }
            }
            attempt.requests.close().forEach(function (item) { item.responder.reject(reason); });
            attempt.reject(reason);
            _this.dispatchEvent(Event.CLOSE, { reason: reason.message });
            if (_destroyed || _manual || _attempt || _retryTimer !== null) { return; }
            var retry = _this.config.retry;
            if (retry.count !== -1 && _retried >= retry.count) { return; }
            var delay = Math.min(retry.delay * Math.pow(2, Math.min(_retried++, 8)), 30000);
            _retryTimer = setTimeout(function () {
                _retryTimer = null;
                _connect().catch(function () { /* Failure schedules the next bounded attempt. */ });
            }, delay);
        }

        // Validator receives the successful info fields before resolving the API promise.
        _this.request = function (opcode, fields, messaging, validator) {
            var attempt = _attempt;
            if (!attempt || !attempt.session || _state !== State.CONNECTED) {
                return Promise.reject(error('InvalidStateError', 'IM is not ready.'));
            }
            if (milliseconds(attempt.session.expiresAt) <= Date.now()) {
                var expired = error('NotAllowedError', 'IM authentication expired.');
                _end(attempt, expired);
                return Promise.reject(expired);
            }
            return new Promise(function (resolve, reject) {
                var sn;
                try {
                    if (!integer(opcode, 3, 254) || (opcode >= 0x80 && opcode <= 0x8F)) {
                        throw error('NotAllowedError', 'Expected a public request opcode.');
                    }
                    var message = { opcode: opcode, messaging: messaging === undefined ? false : messaging,
                        sequenceNumber: 1, fields: fields };
                    if (opcode >= P.Opcode.ROOM_MESSAGE && opcode <= P.Opcode.ENDPOINT_MESSAGE) {
                        P.validateMessageRequest(message);
                    }
                    var packet = P.encode(message), socket = attempt.socket;
                    if (packet.length > attempt.maxPacketBytes || socket.readyState !== 1 ||
                        !integer(socket.bufferedAmount, 0, 9007199254740991) ||
                        socket.bufferedAmount + packet.length > _this.config.maxBufferedBytes) {
                        throw error('QuotaExceededError', 'IM outgoing queue is unavailable or full.');
                    }
                    var responder = {
                        reject: reject,
                        result: function (response) {
                            try {
                                var data = object(response.fields), info = [];
                                response.fields.forEach(function (item) { if (item.key === 'info') { info = item.value; } });
                                P.validateResult(opcode, message.messaging, info);
                                if (validator) { validator(info); }
                                resolve(data.info || Object.create(null));
                            } catch (err) { reject(err); _end(attempt, err); }
                        },
                        status: function (response) {
                            var data = object(response.fields), err = error('OperationError', data.description || 'IM request rejected.');
                            err.code = data.code;
                            err.retryAfterMs = data.retryAfterMs;
                            err.info = data.info;
                            reject(err);
                        }
                    };
                    if (attempt.requests.size >= attempt.requests.maxRecords || attempt.requests.records[attempt.requests.next]) {
                        var exhausted = error('QuotaExceededError', 'IM sequence retention requires a new connection.');
                        _end(attempt, exhausted);
                        reject(exhausted);
                        return;
                    }
                    sn = attempt.requests.add(opcode, message.messaging, responder, _clock(), _this.config.requestTimeout);
                    new DataView(packet.buffer).setUint16(2, sn);
                    socket.send(packet.buffer);
                } catch (err) {
                    if (sn !== undefined) { _end(attempt, err); }
                    reject(err);
                }
            });
        };

        function _roomResult(roomId) {
            return function (info) {
                P.validateFields(info, [{ key: 'roomId', type: P.Type.STRING },
                    { key: 'revision', type: P.Type.UINT64 }, { key: 'expiresAt', type: P.Type.UINT64 }]);
                if (info[0].value !== roomId) { throw error('DataError', 'Room response target mismatch.'); }
            };
        }

        _this.join = function (roomId) {
            if (Object.keys(_rooms).length >= 128 && !_rooms[roomId]) {
                return Promise.reject(error('QuotaExceededError', 'Too many room intentions.'));
            }
            var intention = {};
            _rooms[roomId] = intention;
            return _this.request(P.Opcode.ROOM_JOIN, [field('roomId', P.Type.STRING, roomId)], false,
                _roomResult(roomId)).catch(function (err) {
                    if (_rooms[roomId] === intention) { delete _rooms[roomId]; }
                    throw err;
                });
        };
        _this.leave = function (roomId) {
            delete _rooms[roomId];
            return _this.request(P.Opcode.ROOM_LEAVE, [field('roomId', P.Type.STRING, roomId)], false);
        };
        _this.watch = function (conversationId) {
            return _this.request(P.Opcode.CONVERSATION_WATCH, [field('conversationId', P.Type.STRING, conversationId)], true);
        };
        _this.unwatch = function (conversationId) {
            return _this.request(P.Opcode.CONVERSATION_UNWATCH, [field('conversationId', P.Type.STRING, conversationId)], true);
        };
        _this.capabilities = function () { return _this.request(P.Opcode.CAPS, [], false); };
        _this.reauth = function (token) {
            var attempt = _attempt;
            return _this.request(P.Opcode.REAUTH, [field('token', P.Type.STRING, token)], false, function (info) {
                P.validateFields(info, [{ key: 'authRevision', type: P.Type.UINT64 }, { key: 'expiresAt', type: P.Type.UINT64 }]);
                if (milliseconds(info[1].value) <= Date.now()) { throw error('DataError', 'Refreshed credential is expired.'); }
            }).then(function (info) {
                if (_attempt === attempt) {
                    attempt.session.authRevision = info.authRevision;
                    attempt.session.expiresAt = info.expiresAt;
                }
                return info;
            });
        };

        function _target(target, withType) {
            var kinds = { room: 1, user: 2, group: 3, endpoint: 4 },
                keys = { room: 'roomId', user: 'userId', group: 'groupId', endpoint: 'userId' };
            if (!target || ['room', 'user', 'group', 'endpoint'].indexOf(target.type) < 0) { throw error('TypeError', 'Invalid IM target.'); }
            var fields = withType ? [field('targetType', P.Type.UINT8, kinds[target.type])] : [];
            fields.push(field(keys[target.type], P.Type.STRING, target.id));
            if (target.type === 'endpoint') { fields.push(field('endpointId', P.Type.STRING, target.endpointId)); }
            return fields;
        }

        _this.send = function (target, content, options) {
            return Promise.resolve().then(function () {
                options = options || {};
                var fields = _target(target, false), body = [],
                    opcodes = { room: P.Opcode.ROOM_MESSAGE, group: P.Opcode.GROUP_MESSAGE,
                        user: P.Opcode.USER_MESSAGE, endpoint: P.Opcode.ENDPOINT_MESSAGE };
                if (options.messaging) { body.push(field('clientMessageId', P.Type.BYTES, options.clientMessageId)); }
                body.push(field('content', typeof content === 'string' ? P.Type.STRING : P.Type.BYTES, content));
                if (options.ext) { body.push(field('ext', P.Type.OBJECT, options.ext)); }
                fields.push(field('body', P.Type.OBJECT, body));
                return _this.request(opcodes[target.type], fields, options.messaging === undefined ? false : options.messaging);
            });
        };
        _this.call = function (opcode, target, body) {
            return Promise.resolve().then(function () {
                if (!integer(opcode, P.Opcode.CALL_INVITE, P.Opcode.CALL_END)) { throw error('TypeError', 'Invalid call opcode.'); }
                var fields = _target(target, true);
                fields.push(field('body', P.Type.OBJECT, body));
                return _this.request(opcode, fields, false);
            });
        };
        _this.interact = function (opcode, roomId, body) {
            if ([P.Opcode.LIKE, P.Opcode.REACTION, P.Opcode.ROOM_EFFECT, P.Opcode.GIFT_CONFIRMED,
                P.Opcode.GIFT_COMBO_UPDATE, P.Opcode.GIFT_COMBO_END].indexOf(opcode) < 0) {
                return Promise.reject(error('TypeError', 'Invalid interaction opcode.'));
            }
            return _this.request(opcode, [field('roomId', P.Type.STRING, roomId), field('body', P.Type.OBJECT, body)], false);
        };

        _this.permissionRefresh = function (target) {
            return Promise.resolve().then(function () { return _this.request(P.Opcode.PERMISSION_REFRESH, _target(target, true), false); });
        };
        _this.received = function (conversationId, messageId, sequence) {
            return _this.request(P.Opcode.RECEIVED, [field('conversationId', P.Type.STRING, conversationId),
                field('messageId', P.Type.BYTES, messageId), field('messageSequence', P.Type.UINT64, sequence)], true);
        };
        _this.read = function (conversationId, messageId, sequence) {
            return _this.request(P.Opcode.READ, [field('conversationId', P.Type.STRING, conversationId),
                field('messageId', P.Type.BYTES, messageId), field('messageSequence', P.Type.UINT64, sequence)], true);
        };
        _this.messageGet = function (conversationId, messageId) {
            return _this.request(P.Opcode.MESSAGE_GET, [field('conversationId', P.Type.STRING, conversationId),
                field('messageId', P.Type.BYTES, messageId)], true);
        };
        _this.statusGet = function (conversationId, messageId) {
            return _this.request(P.Opcode.STATUS_GET, [field('conversationId', P.Type.STRING, conversationId),
                field('messageId', P.Type.BYTES, messageId)], true);
        };
        _this.sync = function (deviceId, cursor, limit) {
            return _this.request(P.Opcode.SYNC, [field('deviceId', P.Type.STRING, deviceId),
                field('cursor', P.Type.BYTES, cursor), field('limit', P.Type.UINT16, limit)], true);
        };
        _this.syncCommit = function (deviceId, cursor) {
            return _this.request(P.Opcode.SYNC_COMMIT, [field('deviceId', P.Type.STRING, deviceId),
                field('cursor', P.Type.BYTES, cursor)], true);
        };
        _this.history = function (conversationId, cursor, limit) {
            return _this.request(P.Opcode.HISTORY, [field('conversationId', P.Type.STRING, conversationId),
                field('cursor', P.Type.BYTES, cursor), field('limit', P.Type.UINT16, limit)], true);
        };
        _this.resolveConversation = function (target) {
            return Promise.resolve().then(function () {
                if (!target || (target.type !== 'user' && target.type !== 'group')) {
                    throw error('TypeError', 'A persistent conversation must target a user or group.');
                }
                return _this.request(P.Opcode.CONVERSATION_RESOLVE, _target(target, true), true);
            });
        };
        _this.conversations = function (cursor, limit) {
            return _this.request(P.Opcode.CONVERSATION_LIST, [field('cursor', P.Type.BYTES, cursor),
                field('limit', P.Type.UINT16, limit)], true);
        };
        _this.onlineQuery = function (userId) {
            return _this.request(P.Opcode.ONLINE_QUERY, [field('userId', P.Type.STRING, userId)], false);
        };
        _this.onlineWatch = function (userId) {
            return _this.request(P.Opcode.ONLINE_WATCH, [field('userId', P.Type.STRING, userId)], false);
        };
        _this.onlineUnwatch = function (userId) {
            return _this.request(P.Opcode.ONLINE_UNWATCH, [field('userId', P.Type.STRING, userId)], false);
        };

        _this.close = function () {
            _manual = true;
            clearTimeout(_retryTimer);
            _retryTimer = null;
            _rooms = Object.create(null);
            _state = State.CLOSING;
            if (_attempt) { _end(_attempt, error('AbortError', 'IM closed by the application.')); }
            else { _state = State.CLOSED; }
        };
        _this.destroy = function () {
            _destroyed = true;
            _this.close();
            delete _instances[id];
        };
    }

    IM.prototype = Object.create(EventDispatcher.prototype);
    IM.prototype.constructor = IM;
    IM.prototype.CONF = _default;
    IM.State = State;
    IM.Event = IMEvent;
    IM.get = function (id, logger) {
        id = id == null ? 0 : id;
        if (!_instances[id]) { _instances[id] = new IM(id, logger); }
        return _instances[id];
    };
    IM.create = function (logger) {
        while (_instances[_id]) { _id++; }
        return IM.get(_id++, logger);
    };
    odd.im = IM.get;
    odd.im.create = IM.create;
    odd.IM = IM;
})(odd);

