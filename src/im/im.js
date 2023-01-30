(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        NetStatusEvent = events.NetStatusEvent,
        TimerEvent = events.TimerEvent,
        Level = events.Level,
        Code = events.Code,

        _id = 0,
        _instances = {},
        _default = {
            maxRetries: 0, // maximum number of retries while some types of error occurs. -1 means always
            maxRetryInterval: 30000, // ms.
            retryIn: 1000 + Math.random() * 2000, // ms. retrying interval
            url: 'wss://' + location.host + '/im',
            parameters: {
                token: '',
            },
        };

    function IM(id, nc, logger) {
        var _this = this,
            _id = id,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger(id, logger),
            _nc,
            _ns,
            _timer,
            _retried;

        EventDispatcher.call(this, 'IM', { id: id, logger: _logger }, Event, NetStatusEvent);

        function _init() {
            _this.logger = _logger;
            _nc = nc;
            _retried = 0;
        }

        _this.id = function () {
            return _id;
        };

        _this.client = function () {
            return _nc;
        };

        _this.setup = async function (config) {
            _this.config = utils.extendz({ id: _id }, _default, config);

            if (_nc == null) {
                _nc = new IM.NetConnection({}, _logger);
                _nc.addEventListener(NetStatusEvent.NET_STATUS, _onStatus);
                _nc.addEventListener(Event.CLOSE, _onClose);
            }

            _timer = new utils.Timer(_this.config.retryIn, 1, _logger);
            _timer.addEventListener(TimerEvent.TIMER, _onTimer);

            _bind();
            return await _connect();
        };

        function _bind() {
            _this.state = _nc.state;
            _this.dispatchEvent(Event.BIND);
            _this.dispatchEvent(Event.READY);
        }

        async function _connect() {
            if (_nc.state() !== IM.State.CONNECTING && _nc.state() !== IM.State.CONNECTED) {
                try {
                    await _nc.connect(_this.config.url, _this.config.parameters);
                    _timer.delay = _this.config.retryIn;
                } catch (err) {
                    _logger.error(`Failed to connect: ${err}`);
                    _timer.delay = Math.min(_timer.delay * 2, _this.config.maxRetryInterval);
                    return Promise.reject(err);
                }
            }
            return Promise.resolve();
        };

        _this.join = async function (rid) {
            if (_ns == null || _ns.state() === IM.State.CLOSING || _ns.state() === IM.State.CLOSED) {
                _ns = new IM.NetStream({}, _logger);
                _ns.addEventListener(NetStatusEvent.NET_STATUS, _onStatus);
                _ns.addEventListener(Event.RELEASE, _onRelease);
                await _ns.attach(_nc);
            }
            return _ns.join(rid);
        };

        _this.leave = async function (rid) {
            if (_ns == null) {
                return Promise.reject('should join at first');
            }
            return _ns.leave(rid);
        };

        _this.chmod = async function (rid, tid, operator, mask) {
            if (_ns == null) {
                return Promise.reject('should join at first');
            }
            return _ns.chmod(rid, tid, operator, mask);
        };

        _this.send = async function (type, cast, id, data) {
            if (_ns == null) {
                return Promise.reject('should join at first');
            }
            return _ns.send(type, cast, id, data);
        };

        _this.sendStatus = async function (transactionId, status) {
            if (_ns == null) {
                return Promise.reject('should join at first');
            }
            return _ns.sendStatus(transactionId, status);
        };

        _this.call = function (transactionId, args, payload, responder) {
            if (_ns == null) {
                return Promise.reject('should join at first');
            }
            return _ns.call(transactionId, args, payload, responder);
        };

        function _onStatus(e) {
            var level = e.data.level;
            var code = e.data.code;
            var description = e.data.description;
            var info = e.data.info;
            var method = { status: 'debug', warning: 'warn', error: 'error' }[level] || 'debug';
            _logger[method](`IM.onStatus: level=${level}, code=${code}, description=${description}, info=`, info);
            _this.forward(e);
        }

        function _onRelease(e) {
            _logger.log(`IM.onRelease: ${e.data.reason}`);
            _ns.removeEventListener(NetStatusEvent.NET_STATUS, _onStatus);
            _ns.removeEventListener(Event.RELEASE, _onRelease);
        }

        function _onClose(e) {
            _logger.log(`IM.onClose: ${e.data.reason}`);
            _this.forward(e);

            if (_retried++ < _this.config.maxRetries || _this.config.maxRetries === -1) {
                _logger.debug(`IM about to reconnect in ${_timer.delay} ...`);
                _timer.start();
            }
        }

        async function _onTimer(e) {
            await _connect().catch((err) => { });
        }

        _this.destroy = function (reason) {
            _timer.reset();
            switch (_this.state()) {
                case IM.State.CONNECTED:
                case IM.State.INITIALIZED:
                    if (_nc) {
                        _nc.close(reason);
                        _nc.removeEventListener(NetStatusEvent.NET_STATUS, _this.forward);
                        _nc.removeEventListener(Event.CLOSE, _onClose);
                    }
                    delete _instances[_id];
                    break;
            }
        };

        _init();
    }

    IM.prototype = Object.create(EventDispatcher.prototype);
    IM.prototype.constructor = IM;
    IM.prototype.CONF = _default;

    IM.get = function (id, nc, logger) {
        if (id == null) {
            id = 0;
        }
        var im = _instances[id];
        if (im === undefined) {
            im = new IM(id, nc, logger);
            _instances[id] = im;
        }
        return im;
    };

    IM.create = function (nc, logger) {
        return IM.get(_id++, nc, logger);
    };

    odd.im = IM.get;
    odd.im.create = IM.create;
    odd.IM = IM;
})(odd);

