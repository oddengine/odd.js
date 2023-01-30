(function (odd) {
    var utils = odd.utils,
        OS = odd.OS,
        Kernel = odd.Kernel,
        Browser = odd.Browser,
        crypt = utils.crypt,
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
        Reason = IM.Message.Reason,

        _default = {
        };

    function NetConnection(config, logger) {
        EventDispatcher.call(this, 'NetConnection', { logger: logger }, Event, NetStatusEvent);

        var _this = this,
            _logger = logger,
            _pid,
            _conn,
            _resolve,
            _reject,
            _pipes,
            _properties,
            _messages,
            _handlers,
            _responders,
            _sequenceNumber,
            _transactionId,
            _queued,
            _farAckWindowSize,
            _nearAckWindowSize,
            _lastBytesIn,
            _lastBytesOut,
            _readyState;

        function _init() {
            _this.config = utils.extendz({}, _default, config);
            _pid = 0;
            _pipes = { 0: _this };
            _properties = {};
            _messages = {};
            _handlers = {};
            _responders = {};
            _sequenceNumber = 0;
            _transactionId = 0;
            _queued = [];
            _readyState = State.INITIALIZED;

            _handlers[Command.SET_PROPERTY] = _processCommandSetProperty;
            _handlers[Command.STATUS] = _processCommandStatus;
        }

        _this.pid = function () {
            return _pid;
        };

        _this.userId = function () {
            var user = _this.getProperty('@user');
            return user ? user.id : '';
        };

        _this.setProperty = function (key, value) {
            _properties[key] = value;
        };

        _this.getProperty = function (key) {
            return _properties[key];
        };

        _this.connect = async function (url, parameters) {
            switch (_readyState) {
                case State.CONNECTING:
                    _logger.warn(`Still connecting.`);
                    return Promise.reject('still connecting');
                case State.CONNECTED:
                    _logger.warn(`Already connected.`);
                    return Promise.reject('already connected');
            }
            _readyState = State.CONNECTING;

            _conn = new WebSocket(url);
            _conn.onopen = (function (parameters) {
                return function (e) {
                    var args = {
                        name: Command.CONNECT,
                        device: OS.model || '',
                        os: `${OS.name}/${OS.version}`,
                        kernel: `${Kernel.name}/${Kernel.version}`,
                        browser: `${Browser.name}/${Browser.version}`,
                        client: `odd.js/${odd().version}`,
                        uuid: _this.getProperty('@uuid'),
                        parameters: parameters,
                    };
                    _this.call(_pid, 0, args, null, new Responder(function (m) {
                        var info = m.Arguments.info;

                        var fastreconnect = _this.getProperty('@uuid') === info.uuid;
                        if (fastreconnect) {
                            _logger.log(`Fast reconnect success.`);
                            for (/* void */; _queued.length; _queued.shift()) {
                                try {
                                    var view = _queued[0];
                                    _conn.send(view);
                                } catch (err) {
                                    _logger.warn(`Failed to resend: ${err}`);
                                    break;
                                }
                            }
                        } else {
                            _logger.log(`Connect success.`);
                            for (var i in _pipes) {
                                if (i != 0) {
                                    var pipe = _pipes[i];
                                    pipe.release(`lost chance to do fast-reconnecting`);
                                }
                            }
                            _pipes = { 0: _this };
                            _queued = [];
                        }
                        _readyState = State.CONNECTED;
                        _resolve();
                        _resolve = _reject = undefined;
                    }, function (m) {
                        _logger.error(`Failed to connect: ${m.Arguments.description}`);
                        _reject(m.Arguments.description);
                        _resolve = _reject = undefined;
                    }));
                }
            })(parameters || {});
            _conn.onmessage = _onMessage;
            _conn.onerror = _onError;
            _conn.onclose = _onClose;
            _conn.binaryType = 'arraybuffer';
            return await new Promise((resolve, reject) => {
                _resolve = resolve;
                _reject = reject;
            });
        };

        function _onMessage(e) {
            _logger.debug(`IM.onMessage: ${e.data}`);

            var p = new IM.Message();
            try {
                p.parse(e.data, 0);
            } catch (err) {
                _logger.error(`Failed to parse im message: data=${e.data}, error=${err}`);
                return;
            }

            var pipe = _pipes[p.PipeID];
            if (pipe == null) {
                _logger.warn(`Pipe ${p.PipeID} not found, should create at first.`);
                return;
            }
            try {
                pipe.process(p);
            } catch (err) {
                _logger.error(`Failed to process message: type=${p.Type}, pipe=${p.PipeID}, error=${err}`);
                _this.close(err.message);
            }
        }

        _this.process = function (p) {
            switch (p.Type) {
                case Type.ABORT:
                    var m = new IM.AbortMessage(p);
                    m.parse(p.Payload.buffer, p.Payload.byteOffset);
                    delete _messages[m.Payload];
                    _logger.log(`Abort chunk stream: ${m.Payload}`);
                    return Promise.resolve();

                case Type.ACK_WINDOW_SIZE:
                    var m = new IM.AckWindowSizeMessage(p);
                    m.parse(p.Payload.buffer, p.Payload.byteOffset);
                    _farAckWindowSize = m.Payload;
                    _logger.log(`Set farAckWindowSize to ${_farAckWindowSize}`);
                    return Promise.resolve();

                case Type.ACK:
                    var m = new IM.AckMessage(p);
                    m.parse(p.Payload.buffer, p.Payload.byteOffset);
                    _logger.log(`ACK sequence number: ${m.Payload}/${_lastBytesOut}`);
                    return Promise.resolve();

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
        }

        function _processCommandSetProperty(m) {
            var info = m.Arguments.info;
            utils.forEach(info, function (key, value) {
                _this.setProperty(key, value);
            });
            return Promise.resolve();
        }

        function _processCommandStatus(m) {
            var level = m.Arguments.level;
            var code = m.Arguments.code;
            var description = m.Arguments.description;
            var info = m.Arguments.info;

            if (level && code) {
                _logger.debug(`IM.NetConnection.onStatus: id=${_pid}, level=${level}, code=${code}, description=${description}, info=`, info);
            }

            var responder = _responders[m.TransactionID];
            if (responder != null) {
                var callback = level === Level.ERROR ? responder.status : responder.result;
                if (callback != null) {
                    callback(m);
                }
            }
            delete _responders[m.TransactionID];

            switch (code) {
                case Code.NETCONNECTION_CONNECT_SUCCESS:
                    utils.forEach(info, function (key, value) {
                        _this.setProperty(`@${key}`, value);
                    });
                    break;
            }

            if (level && code) {
                _this.dispatchEvent(NetStatusEvent.NET_STATUS, m.Arguments);
            }
            return Promise.resolve();
        }

        function _onError(e) {
            _logger.error(`IM.NetConnection.onError: ${e}`);
            if (_reject) {
                _reject(e.message);
                _resolve = _reject = undefined;
            }
            _this.dispatchEvent(Event.ERROR, { name: e.name, message: e.message });
        }

        function _onClose(e) {
            _logger.log(`IM.NetConnection.onClose: ${e.code} ${e.reason || 'EOF'}`);
            _this.dispatchEvent(Event.CLOSE, { reason: `${e.code} ${e.reason || 'EOF'}` });
            _readyState = State.CLOSED;
        }

        _this.create = async function (ns, responder) {
            var result, status;
            var ret = new Promise((resolve, reject) => {
                result = resolve;
                status = reject;
            });
            var args = {
                name: Command.CREATE,
                kind: ns.kind,
                parameters: ns.config.parameters || {},
            };
            _this.call(_pid, 0, args, null, new Responder(function (m) {
                _logger.log(`Create pipe success: id=${m.Arguments.info.id}`);
                ns.addEventListener(Event.RELEASE, _onRelease);

                _pipes[m.Arguments.info.id] = ns;
                if (responder && responder.result) {
                    responder.result(m);
                }
                result();
            }, function (m) {
                _logger.error(`Failed to create pipe: level=${m.Arguments.level}, code=${m.Arguments.code}, description=${m.Arguments.description}`);
                if (responder && responder.status) {
                    responder.status(m);
                }
                status();
            }));
            return await ret;
        };

        function _onRelease(e) {
            var ns = e.target;
            ns.removeEventListener(Event.RELEASE, _onRelease);
            delete _pipes[ns.pid()];

            _this.call(_pid, 0, {
                name: Command.RELEASE,
                id: ns.pid(),
            });
        }

        _this.call = function (pipe, transactionId, args, payload, responder) {
            if (responder) {
                transactionId = ++_transactionId;
                _responders[transactionId] = responder;
            }

            var text = JSON.stringify(args || {});
            var byte = crypt.StringToUTF8ByteArray(text);
            var size = 8 + byte.length;
            if (payload) {
                size += payload.byteLength;
            }

            var i = 0;
            var data = new Uint8Array(size);
            var view = new DataView(data.buffer);

            view.setUint32(i, Math.floor(new Date().getTime() / 1000));
            i += 4;
            view.setUint16(i, transactionId);
            i += 2;
            view.setUint16(i, byte.length);
            i += 2;
            data.set(byte, i);
            i += byte.length;
            if (payload) {
                data.set(payload, i);
                i += payload.byteLength;
            }

            return _this.write(Type.COMMAND, pipe, data);
        };

        _this.write = function (type, pipe, payload) {
            var i = 0;
            var data = new Uint8Array(5 + payload.byteLength);
            var view = new DataView(data.buffer);

            view.setUint8(i, 0x80 | type);
            i++;
            view.setUint16(i, ++_sequenceNumber);
            i += 2;
            view.setUint16(i, pipe);
            i += 2;
            data.set(payload, i);
            i += payload.byteLength;

            try {
                _conn.send(view);
            } catch (err) {
                _queued.push(view);
                _logger.error(`Failed to send: type=${type}, pipe=${pipe}, error=${err}`);
                return Promise.reject(err);
            }
            return Promise.resolve();
        };

        _this.state = function () {
            return _readyState;
        };

        _this.release = function (reason) {
            _this.close(reason);
        };

        _this.close = function (reason) {
            switch (_readyState) {
                case State.CONNECTED:
                    _readyState = State.CLOSING;

                    for (var i in _pipes) {
                        if (i != 0) {
                            var pipe = _pipes[i];
                            pipe.release(reason);
                        }
                    }
                    _pipes = { 0: _this };
                // fallthrough
                case State.INITIALIZED:
                case State.CONNECTING:
                    _readyState = State.CLOSING;
                    if (_conn && (_conn.readyState == WebSocket.CONNECTING || _conn.readyState == WebSocket.OPEN)) {
                        _conn.close();
                        _conn = undefined;
                    }
                    _this.dispatchEvent(NetStatusEvent.NET_STATUS, {
                        level: Level.STATUS,
                        code: Code.NETCONNECTION_CONNECT_CLOSED,
                        description: 'connect closed',
                    });
                    _this.dispatchEvent(Event.CLOSE, { reason: reason });
                    _readyState = State.CLOSED;
                    break;
            }
        };

        _init();
    }

    NetConnection.prototype = Object.create(EventDispatcher.prototype);
    NetConnection.prototype.constructor = NetConnection;
    NetConnection.prototype.CONF = _default;

    IM.NetConnection = NetConnection;
})(odd);

