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
            appId: '',
            connectionId: '',
            credentials: null,
            profile: '',
            deviceId: '',
            socketFactory: null,
            storageFactory: null,
            channelStateBytes: 8388608,
            roomRequest: null,
            calls: null,
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

    function _endpoint(value, secure) {
        if (typeof value !== 'string' || !/^wss?:\/\//i.test(value) || /[\s\\?#]/.test(value) || /^wss?:\/\/[^/]*@/i.test(value)) {
            throw _error('TypeError', 'Invalid IM endpoint.');
        }
        var url = typeof URL !== 'undefined' ? new URL(value) : new utils.URL(value);
        if (!url.host || url.username || url.password || url.search || url.hash ||
            (secure && url.protocol.toLowerCase() !== 'wss:')) {
            throw _error('NotAllowedError', 'IM endpoints must preserve secure transport and contain no credentials.');
        }
        return value;
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
            _connectionId = '',
            _subscriptions = Object.create(null),
            _permissions = Object.create(null),
            _refreshing = Object.create(null),
            _permissionVersions = Object.create(null),
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
                (_this.config.socketFactory !== null && typeof _this.config.socketFactory !== 'function') ||
                (_this.config.storageFactory !== null && typeof _this.config.storageFactory !== 'function')) {
                return Promise.reject(_error('TypeError', 'Invalid IM connection configuration.'));
            }
            if (['', 'channel'].indexOf(_this.config.profile) < 0 ||
                (_this.config.profile === 'channel' && (!_this.config.appId || !_this.config.credentials)) ||
                (_this.config.deviceId && (_this.config.profile !== 'channel' ||
                !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(_this.config.deviceId) ||
                _this.config.deviceId === '00000000-0000-0000-0000-000000000000'))) {
                return Promise.reject(_error('TypeError', 'Invalid channel profile or device identity.'));
            }
            if (_this.config.appId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(_this.config.appId)) {
                return Promise.reject(_error('TypeError', 'Invalid product AppID.'));
            }
            if (_this.config.parameters && _this.config.parameters.token) {
                return Promise.reject(_error('NotSupportedError', 'Use handshake credentials; post-upgrade token authentication was removed.'));
            }

            try {
                _endpoint(_this.config.url, typeof location !== 'undefined' && location.protocol === 'https:');
                if (_this.config.connectionId !== '') {
                    if (typeof _this.config.connectionId !== 'string' ||
                        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(_this.config.connectionId) ||
                        _this.config.connectionId === '00000000-0000-0000-0000-000000000000' ||
                        (_connectionId && _connectionId !== _this.config.connectionId)) {
                        throw _error('TypeError', 'connectionId must be a stable lowercase UUID for this IM instance.');
                    }
                    _connectionId = _this.config.connectionId;
                }
                if (!_connectionId) {
                    if (typeof crypto === 'undefined' || typeof crypto.getRandomValues !== 'function') {
                        throw _error('NotSupportedError', 'Secure randomness or an explicit connectionId is required.');
                    }
                    var bytes = new Uint8Array(16);
                    crypto.getRandomValues(bytes);
                    bytes[6] = (bytes[6] & 15) | 64;
                    bytes[8] = (bytes[8] & 63) | 128;

                    var uuid = '';
                    for (var i = 0; i < bytes.length; i++) {
                        if (i === 4 || i === 6 || i === 8 || i === 10) {
                            uuid += '-';
                        }
                        uuid += ('0' + bytes[i].toString(16)).slice(-2);
                    }
                    _connectionId = uuid;
                }
            } catch (err) {
                return Promise.reject(err);
            }

            _subscriptions = Object.create(null);
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
                url: _this.config.url,
                appId: _this.config.appId,
                socket: null,
                session: null,
                notifications: [],
                notificationBytes: 0,
                controller: typeof AbortController !== 'undefined' ? new AbortController() : null,
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
            var context = Object.freeze({
                connectionId: _connectionId,
                reason: _retried ? 'reconnect' : 'connect',
                // Browsers conceal failed WebSocket handshake HTTP responses.
                // Request a fresh channel ticket before each connection instead
                // of treating every network failure as an authentication error.
                forceRefresh: _this.config.profile === 'channel',
                generation: String(attempt.generation),
                url: attempt.url,
                appId: _this.config.appId,
                deadline: Date.now() + _this.config.connectTimeout,
                signal: attempt.controller ? attempt.controller.signal : undefined,
            });
            _attempt = attempt;
            _readyState = State.CONNECTING;
            attempt.deadline = setTimeout(function () {
                _end(attempt, _error('TimeoutError', 'IM session initialization timed out.'));
            }, _this.config.connectTimeout);

            // Providers obtain a fresh short-lived admission proof for each attempt.
            Promise.resolve().then(function () {
                if (_attempt !== attempt) {
                    return null;
                }
                return _this.config.credentials ? _this.config.credentials(context) : {};
            }).then(function (credentials) {
                if (_attempt !== attempt) {
                    return;
                }
                credentials = credentials || {};
                if (_clock() >= attempt.deadlineAt) {
                    throw _error('TimeoutError', 'IM credential acquisition timed out.');
                }
                if (credentials.expiresAt !== undefined) {
                    var expiresAt = Number(credentials.expiresAt);
                    if (!_integer(expiresAt, 1, 9007199254740991) || expiresAt <= Date.now()) {
                        throw _error('NotAllowedError', 'IM credentials have expired.');
                    }
                }
                attempt.url = _endpoint(credentials.url === undefined ? context.url : credentials.url,
                    /^wss:/i.test(context.url) || (typeof location !== 'undefined' && location.protocol === 'https:'));

                var protocols = ['odd.im.v3'];
                if (credentials.ticket !== undefined) {
                    if (typeof credentials.ticket !== 'string' || credentials.ticket.length > (_this.config.profile === 'channel' ? 8192 : 4096) ||
                        !/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)?$/.test(credentials.ticket)) {
                        throw _error('DataError', 'Handshake ticket must be an opaque ticket or a signed admission proof.');
                    }
                    protocols.push('odd.ticket.' + credentials.ticket);
                }

                if (_this.config.profile === 'channel') {
                    if (!credentials.ticket) { throw _error('NotAllowedError', 'A channel admission ticket is required.'); }
                    if (_this.config.deviceId) { protocols.push('odd.device.' + _this.config.deviceId); }
                }
                var factory = _this.config.socketFactory;
                if (!factory && typeof WebSocket === 'undefined') {
                    throw _error('NotSupportedError', 'Provide a WebSocket adapter on this platform.');
                }
                var socket = factory ? factory(attempt.url, protocols, credentials) :
                    new WebSocket(attempt.url, protocols);
                attempt.socket = socket;
                if (!socket || typeof socket.send !== 'function' || typeof socket.close !== 'function') {
                    throw _error('TypeError', 'Invalid WebSocket adapter.');
                }
                socket.binaryType = 'arraybuffer';
                socket.onopen = function () {
                    if (_attempt !== attempt) {
                        return;
                    }
                    if (socket.protocol !== 'odd.im.v3') {
                        _end(attempt, _error('DataError', 'The server did not select odd.im.v3.'));
                    }
                    // IM_CONNECT_SUCCESS, not the open callback, supplies authenticated identity.
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
                    throw _error('DataError', 'STATUS before IM_CONNECT_SUCCESS.');
                }
                attempt.requests.complete(message, attempt.generation);
                return;
            }
            if (message.opcode !== Protocol.Opcode.NOTIFY) {
                throw _error('DataError', 'Unexpected server operation.');
            }

            var event = message.fields[0].value,
                fields = message.fields[1].value,
                payload = _object(fields);
            if (event === Protocol.Event.IM_CONNECT_SUCCESS) {
                if (attempt.session || message.messaging) {
                    throw _error('DataError', 'Duplicate or invalid IM_CONNECT_SUCCESS.');
                }
                _schema(fields, [
                    { key: 'sessionId', type: Protocol.Type.BYTES },
                    { key: 'principal', type: Protocol.Type.OBJECT },
                    { key: 'deviceId', type: Protocol.Type.STRING },
                    { key: 'authRevision', type: Protocol.Type.UINT64 },
                    { key: 'expiresAt', type: Protocol.Type.UINT64 },
                    { key: 'protocolVersion', type: Protocol.Type.UINT8 },
                    { key: 'serverVersion', type: Protocol.Type.STRING },
                    { key: 'maxPacketBytes', type: Protocol.Type.UINT32 },
                    { key: 'maxPending', type: Protocol.Type.UINT16 },
                ]);
                Protocol.validateFields(fields[1].value, [
                    { key: 'kind', type: Protocol.Type.UINT8 },
                    { key: 'id', type: Protocol.Type.STRING },
                ]);
                if (payload.sessionId.length !== 16 || !_integer(payload.principal.kind, 1, 3) ||
                    (!payload.principal.id && !(_this.config.profile === 'channel' && payload.principal.kind === 3)) || Protocol.text(payload.principal.id).length > 128 ||
                    payload.protocolVersion !== Protocol.VERSION || !payload.serverVersion ||
                    !_integer(payload.maxPacketBytes, Protocol.HEADER_SIZE, Protocol.MAX_PACKET_SIZE) ||
                    !_integer(payload.maxPending, 1, 65535) || _milliseconds(payload.expiresAt) <= Date.now()) {
                    throw _error('DataError', 'Invalid authenticated session metadata.');
                }
                if (_this.config.appId && (!payload.ext || payload.ext.appId !== _this.config.appId ||
                    payload.ext.product !== 'im')) {
                    throw _error('SecurityError', 'Authenticated session does not belong to the requested IM App.');
                }
                if (_this.config.profile === 'channel' && (!payload.ext || payload.ext.profile !== 'channel' ||
                    payload.ext.stateVersion !== 5 || (payload.principal.id && _this.config.deviceId && payload.deviceId !== _this.config.deviceId))) {
                    throw _error('SecurityError', 'Channel profile or device identity changed.');
                }
                attempt.session = payload;
                attempt.maxPacketBytes = payload.maxPacketBytes;
                attempt.requests.maxPending = Math.min(64, payload.maxPending);
                attempt.maintenance = setInterval(function () { _maintain(attempt); }, 250);
                _restore(attempt).catch(function (err) { _end(attempt, err); });
                return;
            }
            if (!attempt.session) {
                throw _error('DataError', 'Expected IM_CONNECT_SUCCESS first.');
            }

            var known = false;
            for (var name in Protocol.Event) {
                if (Protocol.Event[name] === event) {
                    known = true;
                    break;
                }
            }
            if (!known) {
                throw _error('NotSupportedError', 'Unknown server state event.');
            }
            var notification = {
                event: event,
                messaging: message.messaging,
                payload: payload,
                fields: fields,
            };
            switch (event) {
                case Protocol.Event.IM_SPEAKERS_CHANGE:
                    if (message.messaging || message.sequenceNumber || size > 4096 || !attempt.messaging) {
                        throw _error('DataError', 'Invalid speaker observation envelope.');
                    }
                    attempt.messaging.events().observe(fields);
                    return;

                case Protocol.Event.IM_AUTHENTICATE_REVOKED:
                    _schema(fields, [
                        { key: 'revision', type: Protocol.Type.UINT64 },
                        { key: 'reason', type: Protocol.Type.STRING },
                    ]);
                    _manual = true;
                    _subscriptions = Object.create(null);
                    _permissions = Object.create(null);
                    _this.dispatchEvent(IMEvent.NOTIFY, notification);
                    _end(attempt, _error('NotAllowedError', 'IM session revoked.'));
                    return;

                case Protocol.Event.IM_SUBSCRIBE_STOP:
                    _schema(fields, [
                        { key: 'subscriptionId', type: Protocol.Type.STRING },
                        { key: 'target', type: Protocol.Type.OBJECT },
                        { key: 'revision', type: Protocol.Type.UINT64 },
                        { key: 'generation', type: Protocol.Type.UINT64 },
                        { key: 'reason', type: Protocol.Type.STRING },
                    ]);
                    Protocol.validateTarget(fields[1].value);
                    for (var key in _subscriptions) {
                        if (_subscriptions[key].id === payload.subscriptionId) {
                            delete _subscriptions[key];
                        }
                    }
                    if (payload.target.type === 'room' && message.messaging && attempt.messaging) {
                        attempt.messaging.events().leave(payload.target.id).catch(function (error) { _end(attempt, error); });
                    }
                    _permissionVersions[_targetKey(payload.target, message.messaging)] = payload;
                    delete _permissions[_targetKey(payload.target, message.messaging)];
                    _this.dispatchEvent(IMEvent.NOTIFY, notification);
                    return;

                case Protocol.Event.IM_PERMISSION_CHANGE:
                    _schema(fields, [
                        { key: 'target', type: Protocol.Type.OBJECT },
                        { key: 'revision', type: Protocol.Type.UINT64 },
                        { key: 'generation', type: Protocol.Type.UINT64 },
                        { key: 'actions', type: Protocol.Type.UINT64 },
                        { key: 'reason', type: Protocol.Type.STRING },
                    ]);
                    Protocol.validateTarget(fields[0].value);
                    // A change invalidates the old grant. An active room may
                    // obtain a fresh ordinary grant after a restriction changes.
                    _permissionVersions[_targetKey(payload.target, message.messaging)] = payload;
                    delete _permissions[_targetKey(payload.target, message.messaging)];
                    if (payload.target.type === 'room' && !message.messaging &&
                        /^restriction-(changed|cancelled|expired)$/.test(payload.reason)) {
                        _refreshChanged(attempt, payload);
                    }
                    break;
            }

            var data = event === Protocol.Event.IM_MESSAGE_RECEIVE ? _parseMessage(message, payload) : null;
            if (data && !message.messaging && _milliseconds(data.meta.expiresAt) <= Date.now()) {
                return;
            }
            if (_readyState === State.CONNECTING || attempt.notifications.length) {
                if (size > _this.config.maxBufferedBytes - attempt.notificationBytes) {
                    throw _error('QuotaExceededError', 'IM startup notification queue is full.');
                }
                attempt.notifications.push({ notification: notification, data: data, size: size });
                attempt.notificationBytes += size;
                return;
            }
            _notify(attempt, notification, data);
        }

        function _refreshChanged(attempt, change) {
            var key = _targetKey(change.target, false),
                intention = _subscriptions['messages:' + key];
            if (!intention || !intention.id) {
                return;
            }
            var pending = _refreshing[key + ':' + Protocol.Action.MESSAGE_SUBSCRIBE] || Promise.resolve();
            function refresh() {
                if (_attempt !== attempt || _readyState !== State.CONNECTED ||
                    _subscriptions['messages:' + key] !== intention || _permissionVersions[key] !== change) {
                    return;
                }
                return _this.refresh(change.target, Protocol.Action.MESSAGE_SUBSCRIBE, false).catch(function (err) {
                    if (_attempt === attempt) {
                        _logger.warn('Failed to refresh changed room permission: ' + err.name + '.');
                    }
                });
            }
            pending.then(refresh, refresh);
        }

        function _parseMessage(message, payload) {
            var fields = message.fields[1].value;
            _schema(fields, [
                { key: 'target', type: Protocol.Type.OBJECT },
                { key: 'sender', type: Protocol.Type.OBJECT },
                { key: 'meta', type: Protocol.Type.OBJECT },
                { key: 'body', type: Protocol.Type.OBJECT },
            ]);
            Protocol.validateMessageRequest({
                opcode: Protocol.Opcode.PUBLISH,
                sequenceNumber: 1,
                messaging: message.messaging,
                fields: [fields[0], fields[3]],
            });
            Protocol.validateFields(fields[1].value, [
                { key: 'kind', type: Protocol.Type.UINT8 },
                { key: 'id', type: Protocol.Type.STRING },
                { key: 'deviceId', type: Protocol.Type.STRING, required: false },
            ]);
            Protocol.validateFields(fields[2].value, message.messaging ? [
                { key: 'messageId', type: Protocol.Type.BYTES },
                { key: 'conversationId', type: Protocol.Type.STRING },
                { key: 'messageSequence', type: Protocol.Type.UINT64 },
            ] : [
                { key: 'eventId', type: Protocol.Type.BYTES },
                { key: 'expiresAt', type: Protocol.Type.UINT64 },
            ]);
            if (!_integer(payload.sender.kind, 1, 3) || !payload.sender.id ||
                Protocol.text(payload.sender.id).length > 128 ||
                (message.messaging ? payload.meta.messageId.length : payload.meta.eventId.length) !== 16 ||
                (message.messaging && (payload.target.id !== payload.meta.conversationId ||
                    (payload.meta.messageSequence.high === 0 && payload.meta.messageSequence.low === 0)))) {
                throw _error('DataError', 'Invalid notification identity or metadata.');
            }
            return {
                target: payload.target,
                sender: payload.sender,
                meta: payload.meta,
                messaging: message.messaging,
                type: payload.body.type,
                content: payload.body.content,
                clientMessageId: payload.body.clientMessageId,
                ext: payload.body.ext,
            };
        }

        function _notify(attempt, notification, data) {
            if (_attempt !== attempt || _readyState !== State.CONNECTED) {
                return;
            }
            if (notification.messaging && notification.event === Protocol.Event.IM_SYNC_REQUIRED) {
                if (!attempt.messaging) {
                    _end(attempt, _error('NotSupportedError', 'Reliable delivery requires durable storage.'));
                    return;
                }
                if (notification.payload.kind === 'event-origins') {
                    Protocol.validateEventOrigins(notification.fields);
                    attempt.messaging.events().origins(notification.payload).catch(function (error) { _end(attempt, error); });
                    return;
                }
                if (notification.payload.kind === 'calls') {
                    if (!attempt.calls) {
                        _end(attempt, _error('NotSupportedError', 'Calls is not enabled for this connection.'));
                        return;
                    }
                    IM.CallProtocol.page(notification.fields);
                    attempt.calls.receive(notification.payload).catch(function (error) { _end(attempt, error); });
                    return;
                }
                if (notification.payload.kind === 'events') {
                    Protocol.validateEventPage(notification.fields);
                    attempt.messaging.events().receive(notification.payload).catch(function (error) { _end(attempt, error); });
                    return;
                }
                Protocol.validateFields(notification.fields, [
                    { key: 'kind', type: Protocol.Type.STRING }, { key: 'conversationId', type: Protocol.Type.STRING },
                    { key: 'items', type: Protocol.Type.ARRAY }, { key: 'nextCursor', type: Protocol.Type.BYTES },
                    { key: 'hasMore', type: Protocol.Type.BOOL },
                ]);
                attempt.messaging.receive(notification.payload).catch(function (error) { _end(attempt, error); });
                return;
            }
            if (data && data.messaging) {
                _end(attempt, _error('DataError', 'Reliable messages must arrive in an acknowledged storage page.'));
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
            if (_attempt === attempt) {
                _this.dispatchEvent(NetStatusEvent.NETSTATUS, { code: notification.event, data: notification.payload });
            }
        }

        function _openMessaging(attempt) {
            if (!_this.config.storageFactory && _this.config.profile !== 'channel') {
                if (_this.config.calls && _this.config.calls.enabled === true) {
                    return Promise.reject(_error('NotSupportedError', 'Calls requires persistent account storage.'));
                }
                return Promise.resolve();
            }
            return Promise.resolve().then(function () {
                var session = attempt.session;
                var channel = _this.config.profile === 'channel';
                if (!IM.Messaging || (session.principal.kind !== 1 && !(channel && session.principal.kind === 3)) || !session.deviceId ||
                    !session.ext || !session.ext.appId || session.ext.messaging !== true) {
                    throw _error('NotSupportedError', 'This session does not support durable messaging.');
                }
                var identity = Object.freeze({ appId: session.ext.appId, userId: session.principal.id, deviceId: session.deviceId });
                attempt.ephemeral = channel && (!session.principal.id || !_this.config.storageFactory);
                if (channel && !attempt.ephemeral && !_this.config.deviceId) {
                    throw _error('NotAllowedError', 'Persistent channel storage requires a stable client deviceId.');
                }
                return Promise.resolve(attempt.ephemeral ? new IM.Events.Memory(identity, { maxStateBytes: _this.config.channelStateBytes }) : _this.config.storageFactory(identity)).then(function (storage) {
                    if (_attempt !== attempt) {
                        if (storage && typeof storage.close === 'function') {
                            storage.close();
                        }
                        throw _error('AbortError', 'IM session changed while opening storage.');
                    }
                    attempt.messaging = new IM.Messaging(identity, storage,
                        function (opcode, fields) { return _request(attempt, opcode, fields, true); },
                        function (target, actions, force) {
                            if (_attempt !== attempt) {
                                return Promise.reject(_error('AbortError', 'IM session changed.'));
                            }
                            return _this.refresh(target, actions, true, force);
                        },
                        function (message) { return _parseMessage(message, _object(message.fields[1].value)); },
                        function (message) {
                            if (_attempt === attempt) {
                                _this.dispatchEvent(IMEvent.MESSAGE, message);
                            }
                        },
                        function (change) {
                            if (_attempt === attempt) {
                                _this.dispatchEvent(IMEvent.NOTIFY, { event: Protocol.Event.IM_SYNC_REQUIRED,
                                    messaging: true, payload: change });
                            }
                        }, function (error) { _end(attempt, error); }, attempt.session.ext.events === true,
                        channel ? 5 : attempt.session.ext.stateVersion >= 2 ? Math.min(attempt.session.ext.stateVersion, 4) : 1,
                        function (snapshot) {
                            if (_attempt === attempt) {
                                _this.dispatchEvent(IMEvent.NOTIFY, { event: Protocol.Event.IM_SPEAKERS_CHANGE,
                                    messaging: false, payload: snapshot });
                            }
                        }, channel && !attempt.ephemeral && attempt.session.ext.messagesVersion === 1);
                    return attempt.messaging.open().then(function () {
                        if (!_this.config.calls || _this.config.calls.enabled !== true) {
                            return;
                        }
                        if (!IM.Calls || !IM.CallMedia || session.ext.callVersion !== 1) {
                            throw _error('NotSupportedError', 'This session does not support CALL v1.');
                        }
                        attempt.calls = new IM.Calls(_this, identity, storage,
                            function (opcode, fields) { return _request(attempt, opcode, fields, true); },
                            session, _this.config.calls, function (change) {
                                if (_attempt === attempt) {
                                    _this.dispatchEvent(IMEvent.NOTIFY, { event: Protocol.Event.IM_CALL_CHANGE,
                                        messaging: true, payload: change });
                                }
                            }, function (error) { _end(attempt, error); });
                        return attempt.calls.open();
                    });
                });
            });
        }

        function _restore(attempt) {
            var keys = Object.keys(_subscriptions),
                chain = _openMessaging(attempt);
            keys.forEach(function (key) {
                chain = chain.then(function () {
                    var intention = _subscriptions[key];
                    if (_attempt !== attempt || !intention) {
                        return;
                    }
                    intention.id = null;
                    intention.promise = null;
                    return _subscribe(attempt, key, intention).catch(function (err) {
                        if (_attempt !== attempt) {
                            return;
                        }
                        if (_subscriptions[key] === intention) {
                            delete _subscriptions[key];
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
                if (attempt.calls) {
                    attempt.calls.start().catch(function (error) { _end(attempt, error); });
                }
                attempt.resolve(_this);
                _this.dispatchEvent(Event.READY);
                if (_attempt !== attempt) {
                    return;
                }
                _this.dispatchEvent(NetStatusEvent.NETSTATUS, { code: Protocol.Event.IM_CONNECT_SUCCESS, data: attempt.session });

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
                if (attempt.messaging) {
                    attempt.messaging.recover().catch(function (error) {
                        if (_attempt === attempt) {
                            _this.dispatchEvent(Event.ERROR, { name: error.name, message: error.message });
                        }
                    });
                }
            });
        }

        function _maintain(attempt) {
            if (_attempt !== attempt) {
                return;
            }
            if (attempt.messaging) {
                attempt.messaging.maintain();
            }
            if (attempt.calls) {
                attempt.calls.maintain();
            }
            attempt.requests.expire(_clock()).forEach(function (item) {
                var err = _error('TimeoutError', 'IM request timed out; the remote result is unknown.');
                err.code = Protocol.Status.UNKNOWN;
                item.responder.reject(err);
            });
            if (_milliseconds(attempt.session.expiresAt) <= Date.now()) {
                _end(attempt, _error('NotAllowedError', 'IM authentication expired.'));
            }
        }

        function _end(attempt, reason) {
            if (_attempt !== attempt) {
                return;
            }
            var connected = _readyState === State.CONNECTED;
            _readyState = State.CLOSING;
            _attempt = null;

            if (attempt.controller) { attempt.controller.abort(); }
            clearTimeout(attempt.deadline);
            clearInterval(attempt.maintenance);
            if (attempt.calls) {
                attempt.calls.close();
            }
            if (attempt.messaging) {
                attempt.messaging.close();
            }
            _permissions = Object.create(null);
            _refreshing = Object.create(null);
            _permissionVersions = Object.create(null);
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
                var err = _error(reason.name, reason.message);
                err.code = Protocol.Status.UNKNOWN;
                item.responder.reject(err);
            });
            attempt.reject(reason);

            _readyState = State.CLOSED;
            _this.dispatchEvent(NetStatusEvent.NETSTATUS, {
                code: connected ? Protocol.Event.IM_CONNECT_CLOSED : Protocol.Event.IM_CONNECT_FAILED,
                data: { reason: reason.message },
            });
            _this.dispatchEvent(Event.CLOSE, { reason: reason.message });

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
            if (messaging) {
                if (opcode === Protocol.Opcode.CALL || (fields && fields.some(function (field) {
                    return field.key === 'kind' && field.value === 'calls';
                }))) {
                    return Promise.reject(_error('NotAllowedError', 'Use calls() to preserve call operations and feed receipts.'));
                }
                var reliable = _attempt.messaging;
                if (!reliable) {
                    return Promise.reject(_error('NotSupportedError', 'Configure durable storage before using reliable messaging.'));
                }
                var eventRequest = fields && fields.some(function (field) {
                    return ((field.key === 'topic' || field.key === 'kind') && field.value === 'events') ||
                        (field.key === 'target' && field.type === Protocol.Type.OBJECT && field.value[0].value === 'room');
                });
                if (eventRequest && opcode !== Protocol.Opcode.PUBLISH && opcode !== Protocol.Opcode.INSPECT &&
                    opcode !== Protocol.Opcode.REFRESH) {
                    return Promise.reject(_error('NotAllowedError', 'Use subscribe(topic: events) and its durable receipt path.'));
                }
                // These operations own storage boundaries; generic request()
                // must not bypass the same guarantees as the convenience API.
                switch (opcode) {
                    case Protocol.Opcode.PUBLISH:
                        return reliable.publish(fields);
                    case Protocol.Opcode.RESOLVE:
                        return reliable.resolve(_object(fields[0].value));
                    case Protocol.Opcode.FETCH:
                        return reliable.fetch(fields[0].value, fields[1].value, fields[2].value);
                    case Protocol.Opcode.COMMIT:
                        return reliable.commit(fields[0].value, fields[1].value);
                    case Protocol.Opcode.SYNC:
                        return reliable.sync(fields[0].value, fields[1].value, fields[2].value);
                    case Protocol.Opcode.LIST:
                        return reliable.sync('conversations', fields[0].value, fields[1].value);
                }
            }
            return _request(_attempt, opcode, fields, messaging, validator);
        };

        function _request(attempt, opcode, fields, messaging, validator) {
            if (!attempt || _attempt !== attempt || !attempt.session ||
                (_readyState !== State.CONNECTING && _readyState !== State.CONNECTED)) {
                return Promise.reject(_error('InvalidStateError', 'IM session is unavailable.'));
            }
            if (_readyState === State.CONNECTING && _clock() >= attempt.deadlineAt) {
                return Promise.reject(_error('TimeoutError', 'IM session initialization timed out.'));
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
                    if (opcode === Protocol.Opcode.PUBLISH) {
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
                                Protocol.validateResult(opcode, message.messaging, info, fields);
                                if (validator) {
                                    validator(info);
                                }
                                if (_attempt !== attempt) {
                                    reject(_error('AbortError', 'IM session changed while handling the response.'));
                                    return;
                                }
                                if (data.info && data.info.wallet) {
                                    _wallet(attempt, data.info.wallet);
                                }
                                resolve(data.info || Object.create(null));
                                var event = opcode === Protocol.Opcode.SUBSCRIBE ? Protocol.Event.IM_SUBSCRIBE_SUCCESS :
                                    opcode === Protocol.Opcode.PUBLISH && (!data.info || !data.info.state || data.info.state === 'accepted') ?
                                        Protocol.Event.IM_PUBLISH_SUCCESS : 0;
                                if (event) {
                                    _this.dispatchEvent(NetStatusEvent.NETSTATUS, { code: event, data: data.info || {} });
                                }
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
                            var event = opcode === Protocol.Opcode.SUBSCRIBE ? Protocol.Event.IM_SUBSCRIBE_FAILED :
                                opcode === Protocol.Opcode.PUBLISH ? Protocol.Event.IM_PUBLISH_FAILED : 0;
                            if (event && data.code !== Protocol.Status.UNKNOWN) {
                                _this.dispatchEvent(NetStatusEvent.NETSTATUS, { code: event, data: data });
                            }
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

        function _target(target) {
            if (!target) {
                throw _error('TypeError', 'An IM target is required.');
            }
            var fields = [
                _field('type', Protocol.Type.STRING, target.type),
                _field('id', Protocol.Type.STRING, target.id),
            ];
            if (target.deviceId !== undefined) {
                fields.push(_field('deviceId', Protocol.Type.STRING, target.deviceId));
            }
            Protocol.validateTarget(fields);
            return fields;
        }

        function _targetKey(target, messaging) {
            return JSON.stringify([target.type, target.id, target.deviceId || '', messaging === true]);
        }

        function _acceptPermission(target, messaging, info, expectedVersion) {
            var key = _targetKey(target, messaging),
                latest = _permissionVersions[key],
                current = _permissions[key];
            if (_milliseconds(info.expiresAt) <= Date.now() || info.actions.high !== 0 ||
                (info.actions.low & ~1023) || (info.revision.high === 0 && info.revision.low === 0) ||
                (info.generation.high === 0 && info.generation.low === 0)) {
                throw _error('DataError', 'Invalid resource permission.');
            }
            if (latest !== expectedVersion || (latest && (Protocol.compare64(info.revision, latest.revision) < 0 ||
                Protocol.compare64(info.generation, latest.generation) < 0))) {
                throw _error('NotAllowedError', 'Permission changed while the request was pending.');
            }
            if (current && (Protocol.compare64(info.revision, current.revision) < 0 ||
                Protocol.compare64(info.generation, current.generation) < 0 ||
                (_this.config.profile !== 'channel' && Protocol.compare64(info.revision, current.revision) === 0 &&
                    Protocol.compare64(info.actions, current.actions) !== 0))) {
                throw _error('NotAllowedError', 'A newer permission is already installed.');
            }
            _permissions[key] = info;
        }

        function _subscribe(attempt, key, intention) {
            if (intention.messaging && !attempt.messaging) {
                return Promise.reject(_error('NotSupportedError', 'Reliable subscriptions require durable storage.'));
            }
            var version = _permissionVersions[_targetKey(intention.target, intention.messaging)],
                fields = [
                _field('topic', Protocol.Type.STRING, intention.topic),
                _field('target', Protocol.Type.OBJECT, _target(intention.target)),
                _field('requestedActions', Protocol.Type.UINT64, { high: 0, low: intention.actions }),
            ];
            var joining = intention.topic === 'events' ? attempt.messaging.events().join(intention.target.id, intention.resume && !attempt.ephemeral, function (info) {
                intention.id = info.subscriptionId;
                if (_attempt !== attempt || _subscriptions[key] !== intention) {
                    throw _error('AbortError', 'The room visit was cancelled while joining.');
                }
                if (_targetKey(info.target, true) !== _targetKey(intention.target, true)) {
                    throw _error('DataError', 'Room visit target mismatch.');
                }
                intention.id = info.subscriptionId;
                _acceptPermission(intention.target, true, info, version);
            }, intention.speakers) : _request(attempt, Protocol.Opcode.SUBSCRIBE, fields, intention.messaging);
            intention.promise = joining.then(function (info) {
                if (_attempt !== attempt) {
                    throw _error('AbortError', 'IM session changed while subscribing.');
                }
                if (_targetKey(info.target, intention.messaging) !== _targetKey(intention.target, intention.messaging)) {
                    throw _error('DataError', 'Subscription target mismatch.');
                }
                intention.id = info.subscriptionId;
                if (_subscriptions[key] === intention) {
                    _acceptPermission(intention.target, intention.messaging, info, version);
                } else if (!_subscriptions[key]) {
                    return _request(attempt, Protocol.Opcode.UNSUBSCRIBE,
                        [_field('subscriptionId', Protocol.Type.STRING, intention.id)], intention.messaging).then(function () {
                            throw _error('AbortError', 'Subscription was cancelled.');
                        });
                }
                return info;
            }).then(function (info) {
                intention.promise = null;
                if (intention.topic === 'events') {
                    intention.resume = true;
                }
                return info;
            }, function (err) {
                intention.promise = null;
                if (_subscriptions[key] === intention) {
                    delete _subscriptions[key];
                }
                if (_attempt === attempt && intention.id && !_subscriptions[key]) {
                    return _request(attempt, Protocol.Opcode.UNSUBSCRIBE,
                        [_field('subscriptionId', Protocol.Type.STRING, intention.id)], intention.messaging).then(function () {
                            throw err;
                        }, function (cleanup) {
                            _end(attempt, cleanup);
                            throw err;
                        });
                }
                throw err;
            });
            return intention.promise;
        }

        _this.subscribe = function (target, options) {
            return Promise.resolve().then(function () {
                if (_readyState !== State.CONNECTED) {
                    throw _error('InvalidStateError', 'IM is not ready.');
                }
                options = options || {};
                var topic = options.topic || 'messages',
                    actions = options.actions === undefined ? Protocol.Action.MESSAGE_SUBSCRIBE |
                        (options.messaging ? Protocol.Action.MESSAGE_COMMIT | (_this.config.profile === 'channel' ? 0 : Protocol.Action.MESSAGE_READ) : 0) : options.actions;
                _target(target);
                if (topic === 'events') {
                    actions = options.actions === undefined ? Protocol.Action.MESSAGE_SUBSCRIBE : options.actions;
                }
                if ((topic !== 'messages' && topic !== 'events') || !_integer(actions, 1, 1023) ||
                    !(actions & Protocol.Action.MESSAGE_SUBSCRIBE) ||
                    (topic === 'events' && (!options.messaging || (target.type !== 'room' && target.type !== 'channel') || actions !== Protocol.Action.MESSAGE_SUBSCRIBE))) {
                    throw _error('TypeError', 'Invalid subscription options.');
                }
                if (options.speakers !== undefined && (typeof options.speakers !== 'boolean' || topic !== 'events')) {
                    throw _error('TypeError', 'Speaker observations require a room event subscription.');
                }
                if (options.speakers && (!_attempt.session.ext || _attempt.session.ext.speakersVersion !== 1)) {
                    throw _error('NotSupportedError', 'The server has not enabled speaker observations.');
                }
                if (_this.config.profile === 'channel') {
                    var channelTarget = target.type === 'channel' && target.id === _this.config.appId;
                    if (topic === 'events' ? !channelTarget : options.messaging ? target.type !== 'conversation' : !channelTarget) {
                        throw _error('NotAllowedError', 'Use this channel or its resolved message conversation.');
                    }
                    if (topic === 'messages' && options.messaging && (_attempt.ephemeral || _attempt.session.ext.messagesVersion !== 1)) {
                        throw _error('NotSupportedError', 'Channel messages require a named user, durable storage and messagesVersion 1.');
                    }
                    if (topic === 'messages' && !options.messaging && _attempt.session.ext.onlineMessages !== true) {
                        throw _error('NotSupportedError', 'The server has not enabled online channel messages.');
                    }
                }
                var key = topic + ':' + _targetKey(target, options.messaging),
                    existing = _subscriptions[key];
                if (existing && existing.speakers !== (options.speakers === true)) {
                    throw _error('InvalidStateError', 'Leave the visit before changing speaker observation options.');
                }
                if (existing && topic === 'events' && existing.id && !existing.promise) {
                    return _attempt.messaging.events().resolution(target.id);
                }
                if (existing && existing.promise) {
                    if (existing.actions !== actions) {
                        throw _error('InvalidStateError', 'Wait for the pending subscription before changing its actions.');
                    }
                    return existing.promise;
                }
                var intention = {
                    topic: topic,
                    target: { type: target.type, id: target.id, deviceId: target.deviceId },
                    messaging: options.messaging === true,
                    actions: actions,
                    resume: options.resume === true,
                    speakers: options.speakers === true,
                    id: null,
                    promise: null,
                };
                _subscriptions[key] = intention;
                return _subscribe(_attempt, key, intention);
            });
        };

        _this.unsubscribe = function (target, options) {
            options = options || {};
            var key = (options.topic || 'messages') + ':' + _targetKey(target, options.messaging),
                intention = _subscriptions[key];
            delete _subscriptions[key];
            if (!intention || !intention.id) {
                return Promise.resolve();
            }
            var attempt = _attempt;
            return _this.request(Protocol.Opcode.UNSUBSCRIBE,
                [_field('subscriptionId', Protocol.Type.STRING, intention.id)], intention.messaging).then(function (info) {
                    if (intention.topic === 'events' && _attempt === attempt && attempt.messaging) {
                        return attempt.messaging.events().leave(target.id).then(function () { return info; });
                    }
                    return info;
                });
        };

        _this.refresh = function (target, actions, messaging, force) {
            return Promise.resolve().then(function () {
                _target(target);
                if (!_integer(actions, 1, 1023)) {
                    throw _error('TypeError', 'Invalid requested actions.');
                }
                var key = _targetKey(target, messaging),
                    requestKey = key + ':' + actions,
                    current = _permissions[key];
                if (!force && current && _milliseconds(current.expiresAt) > Date.now() &&
                    current.actions.high === 0 && (current.actions.low & actions) === actions) {
                    return current;
                }
                if (_refreshing[requestKey]) {
                    return _refreshing[requestKey];
                }
                var attempt = _attempt,
                    version = _permissionVersions[key],
                    eventRoom = messaging && (target.type === 'room' || target.type === 'channel'),
                    fields = eventRoom ? [_field('topic', Protocol.Type.STRING, 'events'),
                        _field('target', Protocol.Type.OBJECT, _target(target))] : [
                        _field('target', Protocol.Type.OBJECT, _target(target)),
                        _field('requestedActions', Protocol.Type.UINT64, { high: 0, low: actions }),
                    ];
                if (eventRoom && attempt.session.ext.stateVersion >= 2) {
                    fields.push(_field('stateVersion', Protocol.Type.UINT16, target.type === 'channel' ? 5 : Math.min(attempt.session.ext.stateVersion, 4)));
                }
                var intention = eventRoom && _subscriptions['events:' + key];
                if (intention && intention.speakers) {
                    fields.push(_field('speakersVersion', Protocol.Type.UINT16, 1));
                }
                var started = performance.now();
                if (eventRoom && actions !== Protocol.Action.MESSAGE_SUBSCRIBE) {
                    throw _error('NotAllowedError', 'Gift permission is checked by the business service for each transaction.');
                }
                var promise = _this.request(Protocol.Opcode.REFRESH, fields, messaging).then(function (info) {
                        if (_attempt !== attempt) {
                            throw _error('AbortError', 'IM session changed while refreshing permission.');
                        }
                        _acceptPermission(target, messaging, info, version);
                        if (intention && intention.speakers && _subscriptions['events:' + key] === intention) {
                            attempt.messaging.events().negotiate(target.id, info, started);
                        }
                        return info;
                    });
                _refreshing[requestKey] = promise;
                return promise.then(function (info) {
                    if (_refreshing[requestKey] === promise) {
                        delete _refreshing[requestKey];
                    }
                    return info;
                }, function (err) {
                    if (_refreshing[requestKey] === promise) {
                        delete _refreshing[requestKey];
                    }
                    throw err;
                });
            });
        };

        _this.reauth = function (token) {
            var attempt = _attempt;
            return _this.request(Protocol.Opcode.AUTHENTICATE, [_field('token', Protocol.Type.STRING, token)], false, function (info) {
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

        _this.send = function (target, content, options) {
            return Promise.resolve().then(function () {
                options = options || {};
                var fields = [_field('target', Protocol.Type.OBJECT, _target(target))],
                    body = [],
                    permission = _permissions[_targetKey(target, options.messaging)];
                if (!permission || _milliseconds(permission.expiresAt) <= Date.now() ||
                    !(permission.actions.low & Protocol.Action.MESSAGE_PUBLISH)) {
                    var err = _error('NotAllowedError', 'Establish publish permission before sending.');
                    err.code = Protocol.Status.NOT_READY;
                    throw err;
                }
                if (options.messaging) {
                    body.push(_field('clientMessageId', Protocol.Type.BYTES, options.clientMessageId));
                }
                body.push(_field('type', Protocol.Type.STRING, typeof content === 'string' ? 'text' : 'binary'));
                body.push(_field('content', typeof content === 'string' ? Protocol.Type.STRING : Protocol.Type.BYTES, content));
                if (options.ext) {
                    body.push(_field('ext', Protocol.Type.OBJECT, options.ext));
                }
                fields.push(_field('body', Protocol.Type.OBJECT, body));
                if (options.messaging) {
                    var attempt = _attempt;
                    if (!attempt || !attempt.messaging) {
                        throw _error('NotSupportedError', 'Reliable sends require durable storage.');
                    }
                    return attempt.messaging.identity(target, options.clientMessageId).then(function (id) {
                        if (_attempt !== attempt) {
                            throw _error('AbortError', 'IM session changed before saving the send.');
                        }
                        body[0].value = id;
                        return _this.request(Protocol.Opcode.PUBLISH, fields, true);
                    });
                }
                return _this.request(Protocol.Opcode.PUBLISH, fields, false);
            });
        };

        _this.gift = function (room, gift, options) {
            return Promise.resolve().then(function () {
                var attempt = _attempt, target = { type: 'room', id: room };
                options = options || {};
                if (_readyState !== State.CONNECTED || !attempt || !attempt.messaging) {
                    throw _error('InvalidStateError', 'Reliable room events are not ready.');
                }
                return attempt.messaging.identity(target, options.clientMessageId).then(function (id) {
                    if (_attempt !== attempt) {
                        throw _error('AbortError', 'The connection changed before saving the gift.');
                    }
                    return _this.request(Protocol.Opcode.PUBLISH, [
                        _field('target', Protocol.Type.OBJECT, _target(target)),
                        _field('body', Protocol.Type.OBJECT, [
                            _field('clientMessageId', Protocol.Type.BYTES, id), _field('type', Protocol.Type.STRING, 'gift'),
                            _field('content', Protocol.Type.OBJECT, [
                                _field('giftId', Protocol.Type.STRING, gift.giftId),
                                _field('count', Protocol.Type.UINT32, gift.count),
                                _field('receiverId', Protocol.Type.STRING, gift.receiverId),
                                _field('catalogRevision', Protocol.Type.UINT64, gift.catalogRevision),
                            ]),
                        ]),
                    ], true);
                });
            });
        };

        _this.subscribeChannel = function (options) {
            if (_this.config.profile !== 'channel') { return Promise.reject(_error('NotSupportedError', 'A channel session is required.')); }
            return _this.subscribe({ type: 'channel', id: _this.config.appId },
                Object.assign({}, options, { topic: 'events', messaging: true, speakers: false }));
        };

        _this.channelState = function () {
            if (_this.config.profile !== 'channel' || !_attempt || !_attempt.messaging) {
                return Promise.reject(_error('InvalidStateError', 'Channel discovery is not connected.'));
            }
            return _attempt.messaging.events().state(_this.config.appId);
        };

        _this.roomState = function (room) {
            if (!_attempt || !_attempt.messaging) {
                return Promise.resolve({ roomId: room, known: false, states: [] });
            }
            var messaging = _attempt.messaging;
            return Promise.resolve().then(function () {
                return messaging.events().state(room);
            });
        };

        _this.roomSpeakers = function (room) {
            if (!_attempt || !_attempt.messaging) {
                return { roomId: room, known: false, complete: false, validUntil: '0', priority: [], items: [] };
            }
            return _attempt.messaging.events().speakers(room);
        };

        // Business authentication and HTTP errors stay with the application's
        // request provider. These operations never create another IM transport.
        function _stage(room, method, suffix, body) {
            return Promise.resolve().then(function () {
                var attempt = _attempt;
                if (_readyState !== State.CONNECTED || !attempt || !attempt.session || !attempt.session.ext ||
                    [2, 3, 4].indexOf(attempt.session.ext.stateVersion) < 0 ||
                    typeof _this.config.roomRequest !== 'function') {
                    throw _error('NotSupportedError', 'Stage operations require state version 2 and a roomRequest provider.');
                }
                if (typeof room !== 'string' || !/^[0-9a-f-]{36}$/.test(room)) {
                    throw _error('TypeError', 'A room ID is required.');
                }
                return Promise.resolve(_this.config.roomRequest({ method: method,
                    path: '/rooms/' + encodeURIComponent(room) + '/stage' + suffix,
                    body: body === undefined ? undefined : JSON.parse(JSON.stringify(body)) })).then(function (result) {
                    if (_attempt !== attempt) {
                        throw _error('AbortError', 'The connection changed; recover the original stage request before retrying.');
                    }
                    return result;
                });
            });
        }

        _this.stage = function (room) {
            return _stage(room, 'GET', '');
        };

        _this.saveStage = function (room, change) {
            return _stage(room, 'PUT', '', change);
        };

        _this.requestStage = function (room, request) {
            // The caller retains requestId/requestedAt before this call. Unknown
            // outcomes must reuse that intent, never generate a new request ID.
            return _stage(room, 'POST', '/requests', request);
        };

        _this.stageRequests = function (room, options) {
            options = options || {};
            var query = '?limit=' + encodeURIComponent(options.limit === undefined ? 50 : options.limit) +
                '&cursor=' + encodeURIComponent(options.cursor || '') + '&all=' + (options.all === true ? 'true' : 'false');
            return _stage(room, 'GET', '/requests' + query);
        };

        _this.stageRequest = function (room, request) {
            return _stage(room, 'GET', '/requests/' + encodeURIComponent(request));
        };

        _this.decideStage = function (room, request, decision) {
            return _stage(room, 'PUT', '/requests/' + encodeURIComponent(request), decision);
        };

        _this.cancelStage = function (room, request) {
            return _stage(room, 'DELETE', '/requests/' + encodeURIComponent(request));
        };

        _this.stageGrant = function (room, grant) {
            return _stage(room, 'GET', '/grants/' + encodeURIComponent(grant));
        };

        _this.endStage = function (room, grant) {
            return _stage(room, 'DELETE', '/grants/' + encodeURIComponent(grant));
        };

        _this.setStagePresentation = function (room, grant, change) {
            var attempt = _attempt;
            if (!attempt || !attempt.session || !attempt.session.ext || [3, 4].indexOf(attempt.session.ext.stateVersion) < 0) {
                return Promise.reject(_error('NotSupportedError', 'Stage presentation requires room state version 3.'));
            }
            return _stage(room, 'PUT', '/grants/' + encodeURIComponent(grant) + '/presentation', change);
        };

        _this.inspectGift = function (room, clientMessageId) {
            return _this.request(Protocol.Opcode.INSPECT, [
                _field('target', Protocol.Type.OBJECT, _target({ type: 'room', id: room })),
                _field('clientMessageId', Protocol.Type.BYTES, clientMessageId),
            ], true);
        };

        function _wallet(attempt, wallet) {
            if (!wallet || ['active', 'disabled', 'unavailable'].indexOf(wallet.status) < 0 ||
                typeof wallet.currency !== 'string' || !/^[0-9]+$/.test(wallet.available) ||
                !/^[0-9]+$/.test(wallet.walletRevision) || typeof wallet.canSend !== 'boolean') {
                throw _error('DataError', 'Invalid private wallet snapshot.');
            }
            var old = attempt.session.ext.wallet, revision = wallet.walletRevision;
            if (!old || old.currency !== wallet.currency || !old.walletRevision || revision.length > old.walletRevision.length ||
                (revision.length === old.walletRevision.length && revision >= old.walletRevision)) {
                attempt.session.ext.wallet = wallet;
            }
        }

        _this.wallet = function () {
            return _attempt && _attempt.session && _attempt.session.ext ? _attempt.session.ext.wallet || null : null;
        };

        _this.calls = function () {
            if (!_attempt || !_attempt.calls || _readyState !== State.CONNECTED) {
                throw _error('NotSupportedError', 'Enable Calls with durable storage before calling.');
            }
            return _attempt.calls;
        };

        _this.call = function (action, target, options) {
            return Promise.resolve().then(function () {
                return action === 'invite' ? _this.calls().invite(target, options) : _this.calls().action(target, action, options);
            });
        };

        _this.commit = function (kind, cursor) {
            return _this.request(Protocol.Opcode.COMMIT, [
                _field('kind', Protocol.Type.STRING, kind),
                _field('cursor', Protocol.Type.BYTES, cursor),
            ], true);
        };

        _this.read = function (conversationId, messageId, sequence) {
            return _this.request(Protocol.Opcode.READ, [
                _field('conversationId', Protocol.Type.STRING, conversationId),
                _field('messageId', Protocol.Type.BYTES, messageId),
                _field('messageSequence', Protocol.Type.UINT64, sequence),
            ], true);
        };

        _this.fetch = function (conversationId, cursor, limit) {
            return _this.request(Protocol.Opcode.FETCH, [
                _field('conversationId', Protocol.Type.STRING, conversationId),
                _field('cursor', Protocol.Type.BYTES, cursor || new Uint8Array(0)),
                _field('limit', Protocol.Type.UINT16, limit === undefined ? 50 : limit),
            ], true);
        };

        _this.inspect = function (conversationId, clientMessageId) {
            return _this.request(Protocol.Opcode.INSPECT, [
                _field('conversationId', Protocol.Type.STRING, conversationId),
                _field('clientMessageId', Protocol.Type.BYTES, clientMessageId),
            ], true);
        };

        _this.sync = function (kind, cursor, limit) {
            return _this.request(Protocol.Opcode.SYNC, [
                _field('kind', Protocol.Type.STRING, kind),
                _field('cursor', Protocol.Type.BYTES, cursor || new Uint8Array(0)),
                _field('limit', Protocol.Type.UINT16, limit === undefined ? 50 : limit),
            ], true);
        };

        _this.resolve = function (target) {
            return _this.request(Protocol.Opcode.RESOLVE, [
                _field('target', Protocol.Type.OBJECT, _target(target)),
            ], true);
        };

        _this.conversations = function (cursor, limit) {
            return _this.request(Protocol.Opcode.LIST, [
                _field('cursor', Protocol.Type.BYTES, cursor || new Uint8Array(0)),
                _field('limit', Protocol.Type.UINT16, limit === undefined ? 50 : limit),
            ], true);
        };

        _this.presence = function (userId) {
            return _this.request(Protocol.Opcode.PRESENCE, [_field('userId', Protocol.Type.STRING, userId)], false);
        };

        _this.storage = function () {
            return _attempt && _attempt.messaging ? _attempt.messaging.storage() : null;
        };

        _this.recover = function () {
            if (!_attempt || !(_attempt.messaging) || _readyState !== State.CONNECTED) {
                return Promise.reject(_error('InvalidStateError', 'Reliable messaging is not ready.'));
            }
            return _attempt.messaging.recover();
        };

        _this.close = function () {
            switch (_readyState) {
                case State.CLOSING:
                    if (!_manual) {
                        _manual = true;
                        _subscriptions = Object.create(null);
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
                    _subscriptions = Object.create(null);

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

