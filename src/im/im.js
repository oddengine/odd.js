(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        NetStatusEvent = events.NetStatusEvent,
        IMEvent = events.IMEvent,

        State = {
            INITIALIZED: 'initialized',
            CONNECTING: 'connecting',
            CONNECTED: 'connected',
            CLOSING: 'closing',
            CLOSED: 'closed',
        },

        _id = 0,
        _generation = 0,
        _instances = Object.create(null),
        _default = {
            url: '',
            credentials: null,
            socketFactory: null,
            connectTimeout: 10000,
            requestTimeout: 15000,
            maxBufferedBytes: 262144,
            retry: { delay: 2000, count: 0 },
        };

    function _error(name, message) {
        var value = new Error(message);
        value.name = name;
        return value;
    }

    function _integer(value, min, max) {
        return typeof value === 'number' && isFinite(value) &&
            Math.floor(value) === value && value >= min && value <= max;
    }

    function _field(key, type, value) {
        return {
            key: key,
            type: type,
            value: value,
        };
    }

    function _object(fields) {
        var value = Object.create(null);
        for (var i = 0; i < fields.length; i++) {
            var item = fields[i];
            value[item.key] = item.type === 10 ? _object(item.value) : item.value;
        }
        return value;
    }

    function _milliseconds(value) {
        var number = value && value.high * 4294967296 + value.low;
        if (!_integer(number, 0, 9007199254740991)) {
            throw _error('DataError', 'Invalid absolute timestamp.');
        }
        return number;
    }

    // Each IM owns its socket attempt, request table and subscription intentions.
    // No stream/pipe identifiers or post-upgrade AUTH transaction are involved.
    function IM(id, logger) {
        var _this = this,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger(id, logger),
            _readyState = State.INITIALIZED,
            _attempt = null,
            _rooms = Object.create(null),
            _retryTimer = null,
            _retried = 0,
            _manual = false,
            _destroyed = false,
            _lastClock = 0,
            Protocol = IM.Protocol;

        EventDispatcher.call(this, 'IM', { id: id, logger: _logger }, Event, NetStatusEvent, IMEvent);

        _this.logger = _logger;
        _this.config = utils.extendz({}, _default);

        _this.id = function () {
            return id;
        };

        _this.state = function () {
            return _readyState;
        };

        _this.connected = function () {
            return _readyState === State.CONNECTED;
        };

        // Capability availability is distinct from resource authorization or M mode.
        _this.supports = function (opcode) {
            return _readyState === State.CONNECTED && !!_attempt &&
                _integer(opcode, 1, 254) && !!_attempt.opcodes && !!_attempt.opcodes[opcode];
        };

        _this.userId = function () {
            return _attempt && _attempt.session ? _attempt.session.principal.id : '';
        };

        function _clock() {
            var now = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
            _lastClock = Math.max(_lastClock, Math.floor(now));
            return _lastClock;
        }

        _this.setup = function (config) {
            if (_destroyed || _readyState === State.CLOSING || _attempt || _retryTimer !== null) {
                return Promise.reject(_error('InvalidStateError', 'Close the current IM session before setup.'));
            }

            Protocol = IM.Protocol;
            if (!Protocol) {
                return Promise.reject(_error('NotSupportedError', 'IM message protocol module is missing.'));
            }

            _this.config = utils.extendz({}, _default, config);
            if (!_this.config.retry) {
                return Promise.reject(_error('TypeError', 'retry must be an object.'));
            }
            if (!_this.config.url && typeof location !== 'undefined') {
                _this.config.url = (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/im';
            }
            if (typeof _this.config.url !== 'string' || !/^wss?:\/\//i.test(_this.config.url) ||
                !_integer(_this.config.connectTimeout, 1, 300000) || !_integer(_this.config.requestTimeout, 1, 300000) ||
                !_integer(_this.config.maxBufferedBytes, 65536, 16777216) ||
                !_integer(_this.config.retry.delay, 1, 300000) || !_integer(_this.config.retry.count, -1, 65535) ||
                (_this.config.credentials !== null && typeof _this.config.credentials !== 'function') ||
                (_this.config.socketFactory !== null && typeof _this.config.socketFactory !== 'function')) {
                return Promise.reject(_error('TypeError', 'Invalid IM connection configuration.'));
            }
            if (_this.config.parameters && _this.config.parameters.token) {
                return Promise.reject(_error('NotSupportedError', 'Use handshake credentials; post-upgrade token authentication was removed.'));
            }

            _rooms = Object.create(null);
            _manual = false;
            _retried = 0;
            _this.dispatchEvent(Event.BIND);
            return _connect();
        };

        function _connect() {
            if (_destroyed || _manual) {
                return Promise.reject(_error('InvalidStateError', 'IM is closed.'));
            }
            if (_attempt) {
                return _attempt.promise;
            }
            if (_generation >= 9007199254740991) {
                return Promise.reject(_error('QuotaExceededError', 'Connection generation exhausted.'));
            }

            var attempt = {
                generation: ++_generation,
                socket: null,
                session: null,
                opcodes: null,
                notifications: [],
                notificationBytes: 0,
                requests: new IM.RequestTable(_generation),
                maxPacketBytes: Protocol.MAX_PACKET_SIZE,
                deadline: null,
                deadlineAt: _clock() + _this.config.connectTimeout,
                maintenance: null,
                resolve: null,
                reject: null,
            };
            attempt.promise = new Promise(function (resolve, reject) {
                attempt.resolve = resolve;
                attempt.reject = reject;
            });
            _attempt = attempt;
            _readyState = State.CONNECTING;
            attempt.deadline = setTimeout(function () {
                _end(attempt, _error('TimeoutError', 'IM session initialization timed out.'));
            }, _this.config.connectTimeout);

            // Providers obtain a fresh one-use ticket for each connection attempt.
            Promise.resolve().then(function () {
                if (_attempt !== attempt) {
                    return null;
                }
                return _this.config.credentials ? _this.config.credentials() : {};
            }).then(function (credentials) {
                if (_attempt !== attempt) {
                    return;
                }
                credentials = credentials || {};

                var protocols = ['odd.im.v2'];
                if (credentials.ticket !== undefined) {
                    if (typeof credentials.ticket !== 'string' || !/^[A-Za-z0-9_-]{1,4096}$/.test(credentials.ticket)) {
                        throw _error('DataError', 'Handshake ticket must be unpadded base64url.');
                    }
                    protocols.push('odd.ticket.' + credentials.ticket);
                }

                var factory = _this.config.socketFactory;
                if (!factory && typeof WebSocket === 'undefined') {
                    throw _error('NotSupportedError', 'Provide a WebSocket adapter on this platform.');
                }
                var socket = factory ? factory(_this.config.url, protocols, credentials) :
                    new WebSocket(_this.config.url, protocols);
                attempt.socket = socket;
                if (!socket || typeof socket.send !== 'function' || typeof socket.close !== 'function') {
                    throw _error('TypeError', 'Invalid WebSocket adapter.');
                }
                socket.binaryType = 'arraybuffer';
                socket.onopen = function () {
                    if (_attempt !== attempt) {
                        return;
                    }
                    if (socket.protocol !== 'odd.im.v2') {
                        _end(attempt, _error('DataError', 'The server did not select odd.im.v2.'));
                    }
                    // SESSION_READY, not the open callback, supplies authenticated identity.
                };
                socket.onmessage = function (e) {
                    if (_attempt !== attempt) {
                        return;
                    }
                    try {
                        if (e.data && e.data.byteLength > attempt.maxPacketBytes) {
                            throw _error('QuotaExceededError', 'Received packet exceeds the negotiated limit.');
                        }
                        _receive(attempt, Protocol.decode(e.data), e.data.byteLength);
                    } catch (err) {
                        _end(attempt, err);
                    }
                };
                socket.onerror = function () {
                    _end(attempt, _error('NetworkError', 'IM WebSocket failed.'));
                };
                socket.onclose = function () {
                    _end(attempt, _error('NetworkError', 'IM WebSocket closed.'));
                };
            }).catch(function (err) {
                _end(attempt, err);
            });
            return attempt.promise;
        }

        function _schema(fields, rules) {
            Protocol.validateFields(fields, rules.concat([{
                key: 'ext',
                type: Protocol.Type.OBJECT,
                required: false,
            }]));
        }

        function _receive(attempt, message, size) {
            if (message.opcode === Protocol.Opcode.STATUS) {
                if (!attempt.session) {
                    throw _error('DataError', 'STATUS before SESSION_READY.');
                }
                attempt.requests.complete(message, attempt.generation);
                return;
            }
            if (message.opcode !== Protocol.Opcode.NOTIFY) {
                throw _error('DataError', 'Unexpected server operation.');
            }

            var event = message.fields[0].value,
                payload = _object(message.fields);
            if (event === Protocol.Event.SESSION_READY) {
                if (attempt.session || message.messaging) {
                    throw _error('DataError', 'Duplicate or invalid SESSION_READY.');
                }
                _schema(message.fields, [
                    { key: 'event', type: Protocol.Type.UINT16 },
                    { key: 'sessionId', type: Protocol.Type.BYTES },
                    { key: 'principal', type: Protocol.Type.OBJECT },
                    { key: 'authRevision', type: Protocol.Type.UINT64 },
                    { key: 'expiresAt', type: Protocol.Type.UINT64 },
                    { key: 'maxPacketBytes', type: Protocol.Type.UINT32 },
                ]);
                Protocol.validateFields(message.fields[2].value, [
                    { key: 'kind', type: Protocol.Type.UINT8 },
                    { key: 'id', type: Protocol.Type.STRING },
                ]);
                if (payload.sessionId.length !== 16 || !_integer(payload.principal.kind, 1, 3) ||
                    !payload.principal.id || Protocol.text(payload.principal.id).length > 128 ||
                    !_integer(payload.maxPacketBytes, Protocol.HEADER_SIZE, Protocol.MAX_PACKET_SIZE) ||
                    _milliseconds(payload.expiresAt) <= Date.now()) {
                    throw _error('DataError', 'Invalid authenticated session metadata.');
                }
                attempt.session = payload;
                attempt.maxPacketBytes = payload.maxPacketBytes;
                attempt.maintenance = setInterval(function () { _maintain(attempt); }, 250);
                _request(attempt, Protocol.Opcode.CAPS, [], false).then(function () {
                    if (_attempt === attempt) {
                        return _restore(attempt);
                    }
                }).catch(function (err) {
                    _end(attempt, err);
                });
                return;
            }
            if (!attempt.session) {
                throw _error('DataError', 'Expected SESSION_READY first.');
            }

            var known = false;
            for (var key in Protocol.Event) {
                if (Protocol.Event[key] === event) {
                    known = true;
                    break;
                }
            }
            if (!known) {
                return;
            }
            var notification = {
                event: event,
                messaging: message.messaging,
                payload: payload,
                fields: message.fields,
            };
            switch (event) {
                case Protocol.Event.SESSION_REVOKED:
                    _schema(message.fields, [
                        { key: 'event', type: Protocol.Type.UINT16 },
                        { key: 'revision', type: Protocol.Type.UINT64 },
                        { key: 'reason', type: Protocol.Type.STRING },
                    ]);
                    if (message.messaging) {
                        throw _error('DataError', 'Session revocation requires Relay mode.');
                    }
                    _manual = true;
                    _readyState = State.CLOSING;
                    _rooms = Object.create(null);
                    _this.dispatchEvent(IMEvent.NOTIFY, notification);
                    _end(attempt, _error('NotAllowedError', 'IM session revoked.'));
                    return;

                case Protocol.Event.ROOM_REVOKED:
                    _schema(message.fields, [
                        { key: 'event', type: Protocol.Type.UINT16 },
                        { key: 'roomId', type: Protocol.Type.STRING },
                        { key: 'revision', type: Protocol.Type.UINT64 },
                    ]);
                    if (message.messaging || !payload.roomId || Protocol.text(payload.roomId).length > 128) {
                        throw _error('DataError', 'Invalid room revocation.');
                    }
                    delete _rooms[payload.roomId];
                    for (var i = 0; i < attempt.notifications.length; i++) {
                        var pending = attempt.notifications[i];
                        if (pending && pending.notification.payload.roomId === payload.roomId) {
                            attempt.notificationBytes -= pending.size;
                            attempt.notifications[i] = null;
                        }
                    }
                    if (_readyState === State.CONNECTING) {
                        // No drain is running yet; discard holes so repeated
                        // revocations cannot retain an ever-growing slot array.
                        attempt.notifications = attempt.notifications.filter(function (pending) {
                            return pending !== null;
                        });
                    }
                    _this.dispatchEvent(IMEvent.NOTIFY, notification);
                    return;
            }

            var data = null;
            if (event >= Protocol.Event.ROOM_MESSAGE && event <= Protocol.Event.ENDPOINT_MESSAGE) {
                data = _parseMessage(message, payload);
                if (!message.messaging && _milliseconds(data.meta.expiresAt) <= Date.now()) {
                    return;
                }
            }
            if (_readyState === State.CONNECTING || attempt.notifications.length) {
                if (size > _this.config.maxBufferedBytes - attempt.notificationBytes) {
                    throw _error('QuotaExceededError', 'IM startup notification queue is full.');
                }
                attempt.notifications.push({
                    notification: notification,
                    data: data,
                    size: size,
                });
                attempt.notificationBytes += size;
                return;
            }
            _notify(attempt, notification, data);
        }

        function _parseMessage(message, payload) {
            var names = ['room', 'group', 'user', 'endpoint'],
                kind = names[payload.event - Protocol.Event.ROOM_MESSAGE],
                target = kind === 'room' ? 'roomId' : kind === 'group' ? 'groupId' : 'userId',
                rules = [
                    { key: 'event', type: Protocol.Type.UINT16 },
                    { key: target, type: Protocol.Type.STRING },
                ];
            if (kind === 'endpoint') {
                rules.push({ key: 'endpointId', type: Protocol.Type.STRING });
            }
            rules.push(
                { key: 'sender', type: Protocol.Type.OBJECT },
                { key: 'meta', type: Protocol.Type.OBJECT },
                { key: 'body', type: Protocol.Type.OBJECT }
            );
            _schema(message.fields, rules);
            if (message.messaging && (kind === 'room' || kind === 'endpoint')) {
                throw _error('DataError', 'This message event only supports Relay.');
            }

            var bodyIndex = kind === 'endpoint' ? 5 : 4;
            // Public notification fields: event, target(s), sender, meta, body.
            Protocol.validateFields(message.fields[bodyIndex - 2].value, [
                { key: 'kind', type: Protocol.Type.UINT8 },
                { key: 'id', type: Protocol.Type.STRING },
                {
                    key: 'deviceId',
                    type: Protocol.Type.STRING,
                    required: false,
                },
            ]);
            Protocol.validateFields(message.fields[bodyIndex - 1].value, message.messaging ? [
                { key: 'messageId', type: Protocol.Type.BYTES },
                { key: 'conversationId', type: Protocol.Type.STRING },
                { key: 'messageSequence', type: Protocol.Type.UINT64 },
            ] : [
                { key: 'eventId', type: Protocol.Type.BYTES },
                { key: 'expiresAt', type: Protocol.Type.UINT64 },
            ]);
            if (!payload[target] || Protocol.text(payload[target]).length > 128 ||
                !_integer(payload.sender.kind, 1, 3) || !payload.sender.id || Protocol.text(payload.sender.id).length > 128 ||
                (message.messaging ? payload.meta.messageId.length : payload.meta.eventId.length) !== 16 ||
                (kind === 'endpoint' && (!payload.endpointId || Protocol.text(payload.endpointId).length > 128)) ||
                (payload.sender.deviceId !== undefined && (!payload.sender.deviceId || Protocol.text(payload.sender.deviceId).length > 128)) ||
                (message.messaging && (!payload.meta.conversationId || Protocol.text(payload.meta.conversationId).length > 128 ||
                    (payload.meta.messageSequence.high === 0 && payload.meta.messageSequence.low === 0)))) {
                throw _error('DataError', 'Invalid notification identity or metadata.');
            }

            var body = message.fields[bodyIndex].value,
                content = body[message.messaging ? 1 : 0],
                bodyRules = [];
            if (!content || (content.type !== Protocol.Type.STRING && content.type !== Protocol.Type.BYTES)) {
                throw _error('DataError', 'Invalid message content.');
            }
            if (message.messaging) {
                bodyRules.push({ key: 'clientMessageId', type: Protocol.Type.BYTES });
            }
            bodyRules.push({ key: 'content', type: content.type });
            _schema(body, bodyRules);
            if (message.messaging && body[0].value.length !== 16) {
                throw _error('DataError', 'Invalid clientMessageId.');
            }
            if ((content.type === Protocol.Type.STRING ? Protocol.text(content.value).length : content.value.length) > 16384) {
                throw _error('DataError', 'Message content is too large.');
            }
            return {
                target: {
                    type: kind,
                    id: payload[target],
                    endpointId: payload.endpointId,
                },
                sender: payload.sender,
                meta: payload.meta,
                messaging: message.messaging,
                content: content.value,
                ext: payload.body.ext,
            };
        }

        function _notify(attempt, notification, data) {
            if (_attempt !== attempt || _readyState !== State.CONNECTED) {
                return;
            }
            if (data) {
                // A Relay message can expire while waiting for session readiness.
                if (!data.messaging && _milliseconds(data.meta.expiresAt) <= Date.now()) {
                    return;
                }
                _this.dispatchEvent(IMEvent.MESSAGE, data);
                if (_attempt !== attempt || _readyState !== State.CONNECTED) {
                    return;
                }
            }
            _this.dispatchEvent(IMEvent.NOTIFY, notification);
        }

        function _restore(attempt) {
            var rooms = Object.keys(_rooms),
                chain = Promise.resolve();
            rooms.forEach(function (roomId) {
                chain = chain.then(function () {
                    if (_attempt !== attempt || !_rooms[roomId]) {
                        return;
                    }
                    var intention = _rooms[roomId];
                    return _request(attempt, Protocol.Opcode.ROOM_JOIN,
                        [_field('roomId', Protocol.Type.STRING, roomId)], false, _roomResult(roomId)).then(function () {
                            if (_attempt !== attempt || _rooms[roomId] === intention) {
                                return;
                            }
                            // A revoke or leave may invalidate an in-flight restoration.
                            // Remove any subscription the late JOIN may have installed.
                            return _request(attempt, Protocol.Opcode.ROOM_LEAVE,
                                [_field('roomId', Protocol.Type.STRING, roomId)], false).catch(function (err) {
                                    _end(attempt, err);
                                });
                        }).catch(function (err) {
                            if (_attempt !== attempt) {
                                return;
                            }
                            if (_rooms[roomId] === intention) {
                                delete _rooms[roomId];
                            }
                            _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
                        });
                });
            });
            return chain.then(function () {
                if (_attempt !== attempt) {
                    return;
                }
                if (_clock() >= attempt.deadlineAt) {
                    _end(attempt, _error('TimeoutError', 'IM session initialization timed out.'));
                    return;
                }
                if (_milliseconds(attempt.session.expiresAt) <= Date.now()) {
                    _end(attempt, _error('NotAllowedError', 'IM authentication expired.'));
                    return;
                }
                clearTimeout(attempt.deadline);
                attempt.deadline = null;
                _retried = 0;
                _readyState = State.CONNECTED;
                attempt.resolve(_this);
                _this.dispatchEvent(Event.READY);

                // Keep slots stable: a callback may revoke a room, append a
                // notification through an adapter, or close this attempt.
                for (var i = 0; i < attempt.notifications.length; i++) {
                    if (_attempt !== attempt || _readyState !== State.CONNECTED) {
                        return;
                    }
                    var pending = attempt.notifications[i];
                    if (pending) {
                        attempt.notifications[i] = null;
                        attempt.notificationBytes -= pending.size;
                        _notify(attempt, pending.notification, pending.data);
                    }
                }
                attempt.notifications = [];
                attempt.notificationBytes = 0;
            });
        }

        function _maintain(attempt) {
            if (_attempt !== attempt) {
                return;
            }
            attempt.requests.expire(_clock()).forEach(function (item) {
                item.responder.reject(_error('TimeoutError', 'IM request timed out; the remote result is unknown.'));
            });
            if (_milliseconds(attempt.session.expiresAt) <= Date.now()) {
                _end(attempt, _error('NotAllowedError', 'IM authentication expired.'));
            }
        }

        function _end(attempt, reason) {
            if (_attempt !== attempt) {
                return;
            }
            _readyState = State.CLOSING;
            _attempt = null;

            clearTimeout(attempt.deadline);
            clearInterval(attempt.maintenance);
            attempt.opcodes = null;
            attempt.notifications = [];
            attempt.notificationBytes = 0;

            var socket = attempt.socket;
            if (socket) {
                socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
                try {
                    socket.close();
                } catch (err) {
                    _logger.warn('Failed to close IM WebSocket: ' + err.message);
                }
            }

            attempt.requests.close().forEach(function (item) {
                item.responder.reject(reason);
            });
            attempt.reject(reason);

            _this.dispatchEvent(Event.CLOSE, { reason: reason.message });
            _readyState = State.CLOSED;

            if (_destroyed || _manual || _attempt || _retryTimer !== null) {
                return;
            }
            var retry = _this.config.retry;
            if (retry.count !== -1 && _retried >= retry.count) {
                return;
            }
            var delay = Math.min(retry.delay * Math.pow(2, Math.min(_retried++, 8)), 30000);
            _retryTimer = setTimeout(function () {
                _retryTimer = null;
                _connect().catch(function () { /* Failure schedules the next bounded attempt. */ });
            }, delay);
        }

        // Validator receives the successful info fields before resolving the API promise.
        _this.request = function (opcode, fields, messaging, validator) {
            if (_readyState !== State.CONNECTED) {
                return Promise.reject(_error('InvalidStateError', 'IM is not ready.'));
            }
            return _request(_attempt, opcode, fields, messaging, validator);
        };

        function _request(attempt, opcode, fields, messaging, validator) {
            if (!attempt || _attempt !== attempt || !attempt.session ||
                (_readyState !== State.CONNECTING && _readyState !== State.CONNECTED) ||
                (!attempt.opcodes && opcode !== Protocol.Opcode.CAPS)) {
                return Promise.reject(_error('InvalidStateError', 'IM session is unavailable.'));
            }
            if (_readyState === State.CONNECTING && _clock() >= attempt.deadlineAt) {
                return Promise.reject(_error('TimeoutError', 'IM session initialization timed out.'));
            }
            if (_integer(opcode, 3, 254) && !(opcode >= 0x80 && opcode <= 0x8F) &&
                attempt.opcodes && !attempt.opcodes[opcode]) {
                return Promise.reject(_error('NotSupportedError', 'The server did not advertise this IM operation.'));
            }
            if (_milliseconds(attempt.session.expiresAt) <= Date.now()) {
                var expired = _error('NotAllowedError', 'IM authentication expired.');
                _end(attempt, expired);
                return Promise.reject(expired);
            }

            return new Promise(function (resolve, reject) {
                var sn;
                try {
                    if (!_integer(opcode, 3, 254) || (opcode >= 0x80 && opcode <= 0x8F)) {
                        throw _error('NotAllowedError', 'Expected a public request opcode.');
                    }

                    var message = {
                        opcode: opcode,
                        messaging: messaging === undefined ? false : messaging,
                        sequenceNumber: 1,
                        fields: fields,
                    };
                    if (opcode >= Protocol.Opcode.ROOM_MESSAGE && opcode <= Protocol.Opcode.ENDPOINT_MESSAGE) {
                        Protocol.validateMessageRequest(message);
                    }
                    var packet = Protocol.encode(message),
                        socket = attempt.socket;
                    if (packet.length > attempt.maxPacketBytes || socket.readyState !== 1 ||
                        !_integer(socket.bufferedAmount, 0, 9007199254740991) ||
                        socket.bufferedAmount + packet.length > _this.config.maxBufferedBytes) {
                        throw _error('QuotaExceededError', 'IM outgoing queue is unavailable or full.');
                    }

                    var responder = {
                        reject: reject,
                        result: function (response) {
                            try {
                                var data = _object(response.fields),
                                    info = [];
                                response.fields.forEach(function (item) {
                                    if (item.key === 'info') {
                                        info = item.value;
                                    }
                                });
                                Protocol.validateResult(opcode, message.messaging, info);
                                if (validator) {
                                    validator(info);
                                }
                                if (_attempt !== attempt) {
                                    reject(_error('AbortError', 'IM session changed while handling the response.'));
                                    return;
                                }
                                if (opcode === Protocol.Opcode.CAPS) {
                                    var opcodes = Object.create(null);
                                    data.info.opcodes.forEach(function (item) {
                                        opcodes[item.value] = true;
                                    });
                                    attempt.opcodes = opcodes;
                                    attempt.maxPacketBytes = Math.min(attempt.session.maxPacketBytes,
                                        data.info.maxPacketBytes, Protocol.MAX_PACKET_SIZE);
                                    attempt.requests.maxPending = Math.min(64, data.info.maxPending);
                                }
                                resolve(data.info || Object.create(null));
                            } catch (err) {
                                reject(err);
                                _end(attempt, err);
                            }
                        },
                        status: function (response) {
                            var data = _object(response.fields),
                                err = _error('OperationError', data.description || 'IM request rejected.');
                            err.code = data.code;
                            err.retryAfterMs = data.retryAfterMs;
                            err.info = data.info;
                            reject(err);
                        }
                    };
                    if (attempt.requests.size >= attempt.requests.maxRecords || attempt.requests.records[attempt.requests.next]) {
                        var exhausted = _error('QuotaExceededError', 'IM sequence retention requires a new connection.');
                        _end(attempt, exhausted);
                        reject(exhausted);
                        return;
                    }

                    sn = attempt.requests.add(opcode, message.messaging, responder, _clock(), _this.config.requestTimeout);
                    new DataView(packet.buffer).setUint16(2, sn);
                    socket.send(packet.buffer);
                } catch (err) {
                    if (sn !== undefined) {
                        _end(attempt, err);
                    }
                    reject(err);
                }
            });
        }

        function _roomResult(roomId) {
            return function (info) {
                Protocol.validateFields(info, [
                    { key: 'roomId', type: Protocol.Type.STRING },
                    { key: 'revision', type: Protocol.Type.UINT64 },
                    { key: 'expiresAt', type: Protocol.Type.UINT64 },
                ]);
                if (info[0].value !== roomId) {
                    throw _error('DataError', 'Room response target mismatch.');
                }
            };
        }

        _this.join = function (roomId) {
            if (_readyState !== State.CONNECTED) {
                return Promise.reject(_error('InvalidStateError', 'IM is not ready.'));
            }
            if (Object.keys(_rooms).length >= 128 && !_rooms[roomId]) {
                return Promise.reject(_error('QuotaExceededError', 'Too many room intentions.'));
            }

            var intention = {};
            _rooms[roomId] = intention;
            return _this.request(Protocol.Opcode.ROOM_JOIN, [_field('roomId', Protocol.Type.STRING, roomId)], false,
                _roomResult(roomId)).catch(function (err) {
                    if (_rooms[roomId] === intention) {
                        delete _rooms[roomId];
                    }
                    throw err;
                });
        };

        _this.leave = function (roomId) {
            delete _rooms[roomId];
            return _this.request(Protocol.Opcode.ROOM_LEAVE, [_field('roomId', Protocol.Type.STRING, roomId)], false);
        };

        _this.watch = function (conversationId) {
            return _this.request(Protocol.Opcode.CONVERSATION_WATCH, [_field('conversationId', Protocol.Type.STRING, conversationId)], true);
        };

        _this.unwatch = function (conversationId) {
            return _this.request(Protocol.Opcode.CONVERSATION_UNWATCH, [_field('conversationId', Protocol.Type.STRING, conversationId)], true);
        };

        _this.capabilities = function () {
            return _this.request(Protocol.Opcode.CAPS, [], false);
        };

        _this.reauth = function (token) {
            var attempt = _attempt;
            return _this.request(Protocol.Opcode.REAUTH, [_field('token', Protocol.Type.STRING, token)], false, function (info) {
                Protocol.validateFields(info, [
                    { key: 'authRevision', type: Protocol.Type.UINT64 },
                    { key: 'expiresAt', type: Protocol.Type.UINT64 },
                ]);
                if (_milliseconds(info[1].value) <= Date.now()) {
                    throw _error('DataError', 'Refreshed credential is expired.');
                }
            }).then(function (info) {
                if (_attempt === attempt) {
                    attempt.session.authRevision = info.authRevision;
                    attempt.session.expiresAt = info.expiresAt;
                }
                return info;
            });
        };

        function _target(target, withType) {
            var kinds = {
                room: 1,
                user: 2,
                group: 3,
                endpoint: 4,
            };
            var keys = {
                room: 'roomId',
                user: 'userId',
                group: 'groupId',
                endpoint: 'userId',
            };
            if (!target || ['room', 'user', 'group', 'endpoint'].indexOf(target.type) < 0) {
                throw _error('TypeError', 'Invalid IM target.');
            }

            var fields = withType ? [_field('targetType', Protocol.Type.UINT8, kinds[target.type])] : [];
            fields.push(_field(keys[target.type], Protocol.Type.STRING, target.id));
            if (target.type === 'endpoint') {
                fields.push(_field('endpointId', Protocol.Type.STRING, target.endpointId));
            }
            return fields;
        }

        _this.send = function (target, content, options) {
            return Promise.resolve().then(function () {
                options = options || {};
                var fields = _target(target, false),
                    body = [],
                    opcodes = {
                        room: Protocol.Opcode.ROOM_MESSAGE,
                        group: Protocol.Opcode.GROUP_MESSAGE,
                        user: Protocol.Opcode.USER_MESSAGE,
                        endpoint: Protocol.Opcode.ENDPOINT_MESSAGE,
                    };
                if (options.messaging) {
                    body.push(_field('clientMessageId', Protocol.Type.BYTES, options.clientMessageId));
                }
                body.push(_field('content', typeof content === 'string' ? Protocol.Type.STRING : Protocol.Type.BYTES, content));
                if (options.ext) {
                    body.push(_field('ext', Protocol.Type.OBJECT, options.ext));
                }
                fields.push(_field('body', Protocol.Type.OBJECT, body));
                return _this.request(opcodes[target.type], fields, options.messaging === undefined ? false : options.messaging);
            });
        };

        _this.call = function (opcode, target, body) {
            return Promise.resolve().then(function () {
                if (!_integer(opcode, Protocol.Opcode.CALL_INVITE, Protocol.Opcode.CALL_END)) {
                    throw _error('TypeError', 'Invalid call opcode.');
                }
                var fields = _target(target, true);
                fields.push(_field('body', Protocol.Type.OBJECT, body));
                return _this.request(opcode, fields, false);
            });
        };

        _this.interact = function (opcode, roomId, body) {
            if ([
                Protocol.Opcode.LIKE,
                Protocol.Opcode.REACTION,
                Protocol.Opcode.ROOM_EFFECT,
                Protocol.Opcode.GIFT_CONFIRMED,
                Protocol.Opcode.GIFT_COMBO_UPDATE,
                Protocol.Opcode.GIFT_COMBO_END,
            ].indexOf(opcode) < 0) {
                return Promise.reject(_error('TypeError', 'Invalid interaction opcode.'));
            }
            return _this.request(opcode, [
                _field('roomId', Protocol.Type.STRING, roomId),
                _field('body', Protocol.Type.OBJECT, body),
            ], false);
        };

        _this.permissionRefresh = function (target) {
            return Promise.resolve().then(function () {
                return _this.request(Protocol.Opcode.PERMISSION_REFRESH, _target(target, true), false);
            });
        };

        _this.received = function (conversationId, messageId, sequence) {
            return _this.request(Protocol.Opcode.RECEIVED, [
                _field('conversationId', Protocol.Type.STRING, conversationId),
                _field('messageId', Protocol.Type.BYTES, messageId),
                _field('messageSequence', Protocol.Type.UINT64, sequence),
            ], true);
        };

        _this.read = function (conversationId, messageId, sequence) {
            return _this.request(Protocol.Opcode.READ, [
                _field('conversationId', Protocol.Type.STRING, conversationId),
                _field('messageId', Protocol.Type.BYTES, messageId),
                _field('messageSequence', Protocol.Type.UINT64, sequence),
            ], true);
        };

        _this.messageGet = function (conversationId, messageId) {
            return _this.request(Protocol.Opcode.MESSAGE_GET, [
                _field('conversationId', Protocol.Type.STRING, conversationId),
                _field('messageId', Protocol.Type.BYTES, messageId),
            ], true);
        };

        _this.statusGet = function (conversationId, messageId) {
            return _this.request(Protocol.Opcode.STATUS_GET, [
                _field('conversationId', Protocol.Type.STRING, conversationId),
                _field('messageId', Protocol.Type.BYTES, messageId),
            ], true);
        };

        _this.sync = function (deviceId, cursor, limit) {
            return _this.request(Protocol.Opcode.SYNC, [
                _field('deviceId', Protocol.Type.STRING, deviceId),
                _field('cursor', Protocol.Type.BYTES, cursor),
                _field('limit', Protocol.Type.UINT16, limit),
            ], true);
        };

        _this.syncCommit = function (deviceId, cursor) {
            return _this.request(Protocol.Opcode.SYNC_COMMIT, [
                _field('deviceId', Protocol.Type.STRING, deviceId),
                _field('cursor', Protocol.Type.BYTES, cursor),
            ], true);
        };

        _this.history = function (conversationId, cursor, limit) {
            return _this.request(Protocol.Opcode.HISTORY, [
                _field('conversationId', Protocol.Type.STRING, conversationId),
                _field('cursor', Protocol.Type.BYTES, cursor),
                _field('limit', Protocol.Type.UINT16, limit),
            ], true);
        };

        _this.resolveConversation = function (target) {
            return Promise.resolve().then(function () {
                if (!target || (target.type !== 'user' && target.type !== 'group')) {
                    throw _error('TypeError', 'A persistent conversation must target a user or group.');
                }
                return _this.request(Protocol.Opcode.CONVERSATION_RESOLVE, _target(target, true), true);
            });
        };

        _this.conversations = function (cursor, limit) {
            return _this.request(Protocol.Opcode.CONVERSATION_LIST, [
                _field('cursor', Protocol.Type.BYTES, cursor),
                _field('limit', Protocol.Type.UINT16, limit),
            ], true);
        };

        _this.onlineQuery = function (userId) {
            return _this.request(Protocol.Opcode.ONLINE_QUERY, [_field('userId', Protocol.Type.STRING, userId)], false);
        };

        _this.onlineWatch = function (userId) {
            return _this.request(Protocol.Opcode.ONLINE_WATCH, [_field('userId', Protocol.Type.STRING, userId)], false);
        };

        _this.onlineUnwatch = function (userId) {
            return _this.request(Protocol.Opcode.ONLINE_UNWATCH, [_field('userId', Protocol.Type.STRING, userId)], false);
        };

        _this.close = function () {
            switch (_readyState) {
                case State.CLOSING:
                    if (!_manual) {
                        _manual = true;
                        _rooms = Object.create(null);
                    }
                    return;

                case State.CLOSED:
                    if (_manual) {
                        return;
                    }
                    // A disconnected session may still have a reconnect timer.
                    // Fall through to cancel it and clear subscription intentions.
                case State.INITIALIZED:
                case State.CONNECTING:
                case State.CONNECTED:
                    _readyState = State.CLOSING;
                    _manual = true;

                    clearTimeout(_retryTimer);
                    _retryTimer = null;
                    _rooms = Object.create(null);

                    if (_attempt) {
                        _end(_attempt, _error('AbortError', 'IM closed by the application.'));
                    } else {
                        _readyState = State.CLOSED;
                    }
                    break;
            }
        };

        _this.destroy = function () {
            if (_destroyed) {
                return;
            }
            _destroyed = true;
            delete _instances[id];

            _this.close();
        };
    }

    IM.prototype = Object.create(EventDispatcher.prototype);
    IM.prototype.constructor = IM;
    IM.prototype.CONF = _default;
    IM.State = State;

    IM.get = function (id, logger) {
        id = id == null ? 0 : id;
        if (!_instances[id]) {
            _instances[id] = new IM(id, logger);
        }
        return _instances[id];
    };

    IM.create = function (logger) {
        while (_instances[_id]) {
            _id++;
        }
        return IM.get(_id++, logger);
    };

    odd.im = IM.get;
    odd.im.create = IM.create;
    odd.IM = IM;
})(odd);

