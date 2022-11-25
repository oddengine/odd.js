(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        NetStatusEvent = events.NetStatusEvent,
        Level = events.Level,
        Code = events.Code,
        IM = odd.IM,
        Responder = IM.Responder,
        State = IM.State,
        Type = IM.Message.Type,
        Command = IM.Message.Command,

        _default = {
        };

    function NetStream(config, logger) {
        EventDispatcher.call(this, 'NetStream', { logger: logger }, Event, NetStatusEvent);

        var _this = this,
            _logger = logger,
            _pid,
            _client,
            _properties,
            _handlers,
            _responders,
            _transactionId,
            _readyState;

        function _init() {
            _this.config = utils.extendz({}, _default, config);
            _pid = 0;
            _properties = {};
            _handlers = {};
            _responders = {};
            _transactionId = 0;
            _readyState = State.INITIALIZED;

            _handlers[Command.SET_PROPERTY] = _processCommandSetProperty;
            _handlers[Command.SEND] = _processCommandSend;
            _handlers[Command.STATUS] = _processCommandStatus;
        }

        _this.pid = function () {
            return _pid;
        };

        _this.client = function () {
            return _client;
        };

        _this.attach = async function (nc) {
            _client = nc;

            return await _client.create(_this, new Responder(function (m) {
                _pid = m.Arguments.info.id;
                _readyState = State.CONNECTED;
            }, function (m) {
                _this.close(m.Arguments.description);
            }));
        };

        _this.setProperty = function (key, value) {
            _properties[key] = value;
        };

        _this.getProperty = function (key) {
            return _properties[key];
        };

        _this.join = async function (rid) {
            var result, status;
            var ret = new Promise((resolve, reject) => {
                result = resolve;
                status = reject;
            });
            var args = {
                name: Command.JOIN,
                rid: rid,
            };
            _this.call(0, args, null, new Responder(function (m) {
                _logger.log(`Join ${rid} success.`);
                result();
            }, function (m) {
                _logger.error(`Failed to join ${rid}: ${m.Arguments.description}`);
                status(m.Arguments.description);
            }));
            return await ret;
        };

        _this.leave = async function (rid) {
            var result, status;
            var ret = new Promise((resolve, reject) => {
                result = resolve;
                status = reject;
            });
            var args = {
                name: Command.LEAVE,
                rid: rid,
            };
            _this.call(0, args, null, new Responder(function (m) {
                _logger.log(`Leave ${rid} success.`);
                result();
            }, function (m) {
                _logger.error(`Failed to leave ${rid}: ${m.Arguments.description}`);
                status(m.Arguments.description);
            }));
            return await ret;
        };

        _this.chmod = async function (rid, tid, operator, mask) {
            var result, status;
            var ret = new Promise((resolve, reject) => {
                result = resolve;
                status = reject;
            });
            var args = {
                name: Command.CHMOD,
                rid: rid,
                tid: tid,
                operator: operator,
                mask: mask,
            };
            _this.call(0, args, null, new Responder(function (m) {
                _logger.log(`Chmod ${rid}/${tid} ${operator}${mask} success.`);
                result();
            }, function (m) {
                _logger.error(`Failed to chmod ${rid}/${tid} ${operator}${mask}: ${m.Arguments.description}`);
                status(m.Arguments.description);
            }));
            return await ret;
        };

        _this.send = async function (type, cast, id, data) {
            var result, status;
            var ret = new Promise((resolve, reject) => {
                result = resolve;
                status = reject;
            });
            var args = {
                name: Command.SEND,
                type: type,
                cast: cast,
                id: id,
                data: data,
            };
            _this.call(0, args, null, new Responder(function (m) {
                _logger.log(`[${cast}]${id}: ${data}`);
                result();
            }, function (m) {
                _logger.error(`Failed to send [${cast}]${id}: ${m.Arguments.description}`);
                status(m.Arguments.description);
            }));
            return await ret;
        };

        _this.sendStatus = async function (transactionId, status) {
            return _this.call(transactionId, {
                name: Command.STATUS,
                level: status.level,
                code: status.code,
                description: status.description,
                info: status.info,
            });
        };

        _this.call = function (transactionId, args, payload, responder) {
            if (responder) {
                transactionId = ++_transactionId;
                _responders[transactionId] = responder;
            }
            return _client.call(_pid, transactionId, args, payload);
        };

        _this.process = function (p) {
            switch (p.Type) {
                case Type.COMMAND:
                    var m = new IM.CommandMessage(p);
                    m.parse(p.Payload.buffer, p.Payload.byteOffset);
                    return _processCommand(m);

                default:
                    return Promise.reject(`unrecognized message type ${p.Type}`);
            }
        };

        function _processCommand(m) {
            var handler = _handlers[m.Arguments.name];
            if (handler) {
                return handler(m);
            }
            // Should not return error, just ignore.
            _logger.warn(`No handler found: command=${m.Arguments.name}, arguments=`, m.Arguments);
            return Promise.resolve();
        };

        function _processCommandSetProperty(m) {
            var info = m.Arguments.info;
            utils.forEach(info, function (key, value) {
                _this.setProperty(key, value);
            });
            return Promise.resolve();
        }

        function _processCommandSend(m) {
            _this.dispatchEvent(NetStatusEvent.NET_STATUS, {
                level: Level.STATUS,
                code: m.Arguments.cast === 'uni' ? Code.NETGROUP_SENDTO_NOTIFY : Code.NETGROUP_POSTING_NOTIFY,
                description: m.Arguments.cast === 'uni' ? 'sendto notify' : 'posting notify',
                info: m,
            });
        }

        function _processCommandStatus(m) {
            var level = m.Arguments.level;
            var code = m.Arguments.code;
            var description = m.Arguments.description;
            var info = m.Arguments.info;
            _logger.debug(`IM.onStatus: id=${_pid}, level=${level}, code=${code}, description=${description}, info=`, info);

            var responder = _responders[m.TransactionID];
            if (responder != null) {
                var callback = level === Level.ERROR ? responder.status : responder.result;
                if (callback != null) {
                    callback(m);
                }
            }
            delete _responders[m.TransactionID];

            switch (code) {
                case Code.NETGROUP_CONNECT_SUCCESS:
                    var user = info.user;
                    var room = info.room;
                    _this.setProperty(`@room:${room.id}/user`, user);
                    _this.setProperty(`@room:${room.id}`, room);
                    break;
                case Code.NETGROUP_CONNECT_CLOSED:
                    var room = info.room;
                    _this.setProperty(`@room:${room.id}/user`, undefined);
                    _this.setProperty(`@room:${room.id}`, undefined);
                    break;
            }

            _this.dispatchEvent(NetStatusEvent.NET_STATUS, m.Arguments);
            return Promise.resolve();
        }

        _this.state = function () {
            return _readyState;
        };

        _this.release = function (reason) {
            _client.call(0, 0, {
                name: Command.RELEASE,
                id: _pid,
            }).catch((err) => {
                _logger.error(`Failed to send release: ${err}`);
            });
            _this.close(reason);
        };

        _this.close = function (reason) {
            switch (_readyState) {
                case State.INITIALIZED:
                case State.CONNECTED:
                    _readyState = State.CLOSING;

                    _this.dispatchEvent(Event.RELEASE, { reason: reason });
                    _readyState = State.CLOSED;
                    break;
            }
        };

        _init();
    }

    NetStream.prototype = Object.create(EventDispatcher.prototype);
    NetStream.prototype.constructor = NetStream;
    NetStream.prototype.kind = 'messaging';
    NetStream.prototype.CONF = _default;

    IM.NetStream = NetStream;
})(odd);
