(function (odd) {
    var utils = odd.utils,
        Logger = utils.Logger,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        NetStatusEvent = events.NetStatusEvent,
        TimerEvent = events.TimerEvent,
        Level = events.Level,
        Code = events.Code,

        _id = 0,
        _instances = {},
        _State = {
            INITIALIZED: 'initialized',
            CONNECTED: 'connected',
            PUBLISHING: 'publishing',
            PLAYING: 'playing',
            CLOSING: 'closing',
            CLOSED: 'closed',
        },
        _default = {
            profile: '540P_2',
            whip: location.protocol + '//' + location.host + '/whip/live',
            whep: location.protocol + '//' + location.host + '/whep/live',
            trickle: false,
            codecpreferences: [
                'audio/opus',
                'video/H264',
            ],
            parameters: {
                token: '',
            },
            rtcconfiguration: {
            },
            service: {
                script: 'js/sw.js',
                scope: 'js/',
                enable: false,
            },
        };

    function RTC(id, nc, logger) {
        var _this = this,
            _id = id,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger(id, logger),
            _nc,
            _stats;

        EventDispatcher.call(this, 'RTC', { id: id, logger: _logger }, [Event.BIND, Event.READY, Event.ERROR, Event.RELEASE, Event.CLOSE], NetStatusEvent);

        function _init() {
            _this.logger = _logger;
            _this.publishers = {};
            _this.subscribers = {};
            _nc = nc;
        }

        _this.id = function () {
            return _id;
        };

        _this.client = function () {
            return _nc;
        };

        _this.setup = async function (config) {
            _this.config = utils.extendz({ id: _id }, _default, config);

            _stats = new utils.Timer(1000, 0, _logger);
            _stats.addEventListener(TimerEvent.TIMER, _onStats);

            _bind();
            return Promise.resolve();
        };

        function _bind() {
            _this.state = function () {
                return _State.CONNECTED;
            };
            _this.dispatchEvent(Event.BIND);
            _this.dispatchEvent(Event.READY);
        }

        _this.preview = async function (constraints, screenshare, withcamera, option) {
            var ns = new RTC.NetStream({
                id: _id,
                profile: _this.config.profile,
                whip: _this.config.whip,
                whep: _this.config.whep,
                trickle: _this.config.trickle,
                codecpreferences: _this.config.codecpreferences,
                rtcconfiguration: _this.config.rtcconfiguration,
                service: _this.config.service,
            }, _logger);
            ns.addEventListener(NetStatusEvent.NET_STATUS, _onStatus);
            ns.addEventListener(Event.RELEASE, _onRelease);
            ns.applyConstraints(constraints);
            await ns.attach(_nc);

            try {
                await ns.preview(screenshare, withcamera, option);
                _this.publishers[ns.pid()] = ns;
            } catch (err) {
                _logger.error(`Failed to preview: user=${_userId()}, pipe=${ns.pid()}`);
                return Promise.reject(err);
            }
            return Promise.resolve(ns);
        }

        _this.publish = async function (constraints, screenshare, withcamera, option) {
            var ns = new RTC.NetStream({
                id: _id,
                profile: _this.config.profile,
                whip: _this.config.whip,
                whep: _this.config.whep,
                trickle: _this.config.trickle,
                codecpreferences: _this.config.codecpreferences,
                rtcconfiguration: _this.config.rtcconfiguration,
                service: _this.config.service,
            }, _logger);
            ns.addEventListener(NetStatusEvent.NET_STATUS, _onStatus);
            ns.addEventListener(Event.RELEASE, _onRelease);
            ns.applyConstraints(constraints);
            await ns.attach(_nc);

            try {
                await ns.preview(screenshare, withcamera, option);
                _this.publishers[ns.pid()] = ns;
            } catch (err) {
                _logger.error(`Failed to preview: user=${_userId()}, pipe=${ns.pid()}`);
                return Promise.reject(err);
            }
            try {
                await ns.publish();
                _this.publishers[ns.pid()] = ns;
            } catch (err) {
                _logger.error(`Failed to publish: user=${_userId()}, pipe=${ns.pid()}`);
                return Promise.reject(err);
            }
            _stats.start();
            return Promise.resolve(ns);
        };

        _this.unpublish = function () {
            for (var pid in _this.publishers) {
                var ns = _this.publishers[pid];
                ns.release('unpublishing');
            }
        };

        _this.play = async function (rid) {
            var name = rid.split('@')[0];
            if (_this.subscribers.hasOwnProperty(name)) {
                _logger.error(`Already playing: user=${_userId()}, stream=${rid}`);
                return Promise.reject('playing');
            }

            var ns = new RTC.NetStream({
                id: _id,
                whip: _this.config.whip,
                whep: _this.config.whep,
                trickle: _this.config.trickle,
                codecpreferences: _this.config.codecpreferences,
                rtcconfiguration: _this.config.rtcconfiguration,
                service: _this.config.service,
            }, _logger);
            ns.addEventListener(NetStatusEvent.NET_STATUS, _onStatus);
            ns.addEventListener(Event.RELEASE, _onRelease);
            ns.setProperty('stream', name);
            _this.subscribers[name] = ns;

            try {
                await ns.attach(_nc);
                await ns.play(rid, "all");
            } catch (err) {
                _logger.error(`Failed to play: user=${_userId()}, pipe=${ns.pid()}, stream=${rid}`);
                delete _this.subscribers[name];
                ns.close(err);
                return Promise.reject(err);
            }
            _stats.start();
            return Promise.resolve(ns);
        };

        _this.stop = function (rid) {
            if (rid) {
                var name = rid.split('@')[0];
                var ns = _this.subscribers[name];
                if (ns) {
                    ns.release('stopping');
                }
                return;
            }
            for (var name in _this.subscribers) {
                var ns = _this.subscribers[name];
                if (ns) {
                    ns.release('stopping');
                }
            }
        };

        function _onStatus(e) {
            var level = e.data.level;
            var code = e.data.code;
            var description = e.data.description;
            var info = e.data.info;
            var method = { status: 'debug', warning: 'warn', error: 'error' }[level] || 'debug';
            _logger[method](`RTC.onStatus: user=${_userId()}, level=${level}, code=${code}, description=${description}, info=`, info);

            switch (code) {
                case Code.NETSTREAM_FAILED:
                case Code.NETSTREAM_PLAY_FAILED:
                case Code.NETSTREAM_PLAY_RESET:
                    var ns = e.target;
                    ns.close(e.data.description);
                    break;
            }
            _this.forward(e);
        }

        function _onRelease(e) {
            var ns = e.target;
            _logger.log(`RTC.onRelease: user=${_userId()}, reason=${e.data.reason}`);

            ns.removeEventListener(NetStatusEvent.NET_STATUS, _onStatus);
            ns.removeEventListener(Event.RELEASE, _onRelease);

            delete _this.publishers[ns.pid()];
            var stream = ns.getProperty('stream');
            if (stream) {
                delete _this.subscribers[stream];
            }
        }

        function _onClose(e) {
            _logger.log(`RTC.onClose: user=${_userId()}, reason=${e.data.reason}`);
            _this.forward(e);
        }

        function _onStats(e) {
            utils.forEach(_this.publishers, function (_, ns) {
                _getStats(ns);
            });
            utils.forEach(_this.subscribers, function (_, ns) {
                _getStats(ns);
            });
            if ((_stats.currentCount() % _logger.config.interval) === 0) {
                _logger.flush();
            }
        }

        function _getStats(ns) {
            var stream = ns.stream;
            if (stream) {
                ns.getStats().then((stats) => {
                    _logger.append(Logger.Level.LOG, [{
                        reporter: _userId(),
                        stream: stream.id,
                        stats: stats,
                    }]);
                });
            }
        }

        _this.destroy = function (reason) {
            _stats.reset();
            _this.unpublish();
            _this.stop();
            delete _instances[_id];
        };

        function _userId() {
            if (_nc && _nc.userId) {
                return _nc.userId();
            }
            return _id;
        }

        _init();
    }

    RTC.prototype = Object.create(EventDispatcher.prototype);
    RTC.prototype.constructor = RTC;
    RTC.prototype.CONF = _default;

    RTC.getDevices = async function (_logger) {
        var devices = [];
        try {
            devices = await navigator.mediaDevices.enumerateDevices();
            devices.forEach(function (device, index) {
                _logger.log(`Got device: kind=${device.kind}, id=${device.deviceId}, label=${device.label}`);
            });
        } catch (err) {
            _logger.error(`Failed to get devices: ${err}`);
        }
        return devices;
    };

    RTC.getCameras = async function (_logger) {
        var cameras = [];
        try {
            var devices = await navigator.mediaDevices.enumerateDevices();
            devices.forEach(function (device, index) {
                if (device.kind === 'videoinput') {
                    _logger.log(`Camera: id=${device.deviceId}, label=${device.label}`);
                    cameras.push(device);
                }
            });
        } catch (err) {
            _logger.error(`Failed to get cameras: ${err}`);
        }
        return cameras;
    };

    RTC.getMicrophones = async function (_logger) {
        var microphones = [];
        try {
            var devices = await navigator.mediaDevices.enumerateDevices();
            devices.forEach(function (device, index) {
                if (device.kind === 'audioinput') {
                    _logger.log(`Microphone: id=${device.deviceId}, label=${device.label}`);
                    microphones.push(device);
                }
            });
        } catch (err) {
            _logger.error(`Failed to get microphones: ${err}`);
        }
        return microphones;
    };

    RTC.getPlaybackDevices = async function (_logger) {
        var playbacks = [];
        try {
            var devices = await navigator.mediaDevices.enumerateDevices();
            devices.forEach(function (device, index) {
                if (device.kind === 'audiooutput') {
                    _logger.log(`Playback device: id=${device.deviceId}, label=${device.label}`);
                    playbacks.push(device);
                }
            });
        } catch (err) {
            _logger.error(`Failed to get playback devices: ${err}`);
        }
        return playbacks;
    };

    RTC.getSupportedCodecs = function (_logger) {

    };

    RTC.get = function (id, nc, logger) {
        if (id == null) {
            id = 0;
        }
        var rtc = _instances[id];
        if (rtc === undefined) {
            rtc = new RTC(id, nc, logger);
            _instances[id] = rtc;
        }
        return rtc;
    };

    RTC.create = function (nc, logger) {
        if (nc && nc.userId == null && logger == null) {
            logger = nc;
            nc = null;
        }
        return RTC.get(_id++, nc, logger);
    };

    odd.rtc = RTC.get;
    odd.rtc.create = RTC.create;
    odd.RTC = RTC;
    RTC.State = _State;
})(odd);
