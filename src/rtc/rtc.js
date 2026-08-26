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

        State = {
            INITIALIZED: 'initialized',
            CONNECTING: 'connecting',
            CONNECTED: 'connected',
            PUBLISHING: 'publishing',
            PLAYING: 'playing',
            CLOSING: 'closing',
            CLOSED: 'closed',
        },

        _id = 0,
        _instances = {},
        _default = {
            profile: '720P_2',
            whip: `${location.protocol}//${location.host}/whip/live`,
            whep: `${location.protocol}//${location.host}/whep/live`,
            trickle: false,
            configuration: {
                iceServers: [{
                    urls: ["stun:stun.l.google.com:19302"],
                }],
            },
            codecpreferences: [
                'audio/opus',
                'video/H264',
            ],
            service: {
                script: 'js/sw.js',
                scope: 'js/',
                enable: false,
            },
        };

    function RTC(id, logger) {
        var _this = this,
            _id = id,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger(id, logger),
            _stats;

        EventDispatcher.call(this, 'RTC', { id: id, logger: _logger }, [Event.BIND, Event.READY, Event.ERROR, Event.RELEASE, Event.CLOSE], NetStatusEvent);

        function _init() {
            _this.logger = _logger;
            _this.publishing = {};
            _this.subscribing = {};
        }

        _this.id = function () {
            return _id;
        };

        _this.setup = async function (config) {
            _this.config = utils.extendz({ id: _id }, _default, config);

            _stats = new utils.Timer(1000, 0, _logger);
            _stats.addEventListener(TimerEvent.TIMER, _onStats);

            _bind();
            return Promise.resolve();
        };

        function _bind() {
            _this.dispatchEvent(Event.BIND);
            _this.dispatchEvent(Event.READY);
        }

        _this.preview = async function (constraints, screensharing, withcamera, option) {
            var ns = new RTC.NetStream({
                id: _id,
                profile: _this.config.profile,
                whip: _this.config.whip,
                whep: _this.config.whep,
                trickle: _this.config.trickle,
                configuration: _this.config.configuration,
                codecpreferences: _this.config.codecpreferences,
                service: _this.config.service,
            }, _logger);
            ns.addEventListener(NetStatusEvent.NETSTATUS, _onStatus);
            ns.addEventListener(Event.RELEASE, _onRelease);
            ns.applyConstraints(constraints);
            await ns.attach();

            try {
                await ns.preview(screensharing, withcamera, option);
                _this.publishing[ns.name()] = ns;
            } catch (err) {
                _logger.error(`Failed to preview: id=${_id}, stream=${ns.name()}`);
                return Promise.reject(err);
            }
            return Promise.resolve(ns);
        }

        _this.publish = async function (constraints, screensharing, withcamera, option) {
            var ns = new RTC.NetStream({
                id: _id,
                profile: _this.config.profile,
                whip: _this.config.whip,
                whep: _this.config.whep,
                trickle: _this.config.trickle,
                configuration: _this.config.configuration,
                codecpreferences: _this.config.codecpreferences,
                service: _this.config.service,
            }, _logger);
            ns.addEventListener(NetStatusEvent.NETSTATUS, _onStatus);
            ns.addEventListener(Event.RELEASE, _onRelease);
            ns.applyConstraints(constraints);
            await ns.attach();

            try {
                await ns.preview(screensharing, withcamera, option);
            } catch (err) {
                _logger.error(`Failed to preview: id=${_id}, stream=${ns.name()}`);
                return Promise.reject(err);
            }
            try {
                await ns.publish();
                _this.publishing[ns.name()] = ns;
            } catch (err) {
                _logger.error(`Failed to publish: id=${_id}, stream=${ns.name()}`);
                return Promise.reject(err);
            }
            _stats.start();
            return Promise.resolve(ns);
        };

        _this.play = async function (name) {
            if (_this.subscribing.hasOwnProperty(name)) {
                _logger.error(`Already playing: id=${_id}, stream=${name}`);
                return Promise.reject('playing');
            }

            var ns = new RTC.NetStream({
                id: _id,
                whip: _this.config.whip,
                whep: _this.config.whep,
                trickle: _this.config.trickle,
                configuration: _this.config.configuration,
                codecpreferences: _this.config.codecpreferences,
                service: _this.config.service,
            }, _logger);
            ns.addEventListener(NetStatusEvent.NETSTATUS, _onStatus);
            ns.addEventListener(Event.RELEASE, _onRelease);
            ns.setProperty('stream', name);
            _this.subscribing[name] = ns;

            try {
                await ns.attach();
                await ns.play(name, "all");
            } catch (err) {
                _logger.error(`Failed to play: id=${_id}, stream=${ns.name()}`);
                delete _this.subscribing[name];
                ns.close(err);
                return Promise.reject(err);
            }
            _stats.start();
            return Promise.resolve(ns);
        };

        _this.stop = function (name) {
            if (name) {
                var ns = _this.publishing[name] || _this.subscribing[name];
                if (ns) {
                    ns.close('stopping');
                }
                return;
            }
            for (var name in _this.publishing) {
                var ns = _this.publishing[name];
                if (ns) {
                    ns.close('stopping');
                }
            }
            for (var name in _this.subscribing) {
                var ns = _this.subscribing[name];
                if (ns) {
                    ns.close('stopping');
                }
            }
        };

        function _onStatus(e) {
            var level = e.data.level;
            var code = e.data.code;
            var description = e.data.description;
            var info = e.data.info;
            var method = { status: 'debug', warning: 'warn', error: 'error' }[level] || 'debug';
            _logger[method](`RTC.onStatus: id=${_id}, level=${level}, code=${code}, description=${description}, info=`, info);

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
            _logger.log(`RTC.onRelease: id=${_id}, reason=${e.data.reason}`);

            ns.removeEventListener(NetStatusEvent.NETSTATUS, _onStatus);
            ns.removeEventListener(Event.RELEASE, _onRelease);

            delete _this.publishing[ns.name()];
            delete _this.subscribing[ns.name()];
        }

        function _onStats(e) {
            utils.forEach(_this.publishing, function (_, ns) {
                _getStats(ns);
            });
            utils.forEach(_this.subscribing, function (_, ns) {
                _getStats(ns);
            });
            if ((_stats.currentCount() % _logger.config.interval) === 0) {
                _logger.flush();
            }
        }

        function _getStats(ns) {
            var stream = ns.stream();
            if (stream) {
                ns.getStats().then((stats) => {
                    _logger.append(Logger.Level.LOG, [{
                        id: _id,
                        stream: stream.id,
                        stats: stats,
                    }]);
                });
            }
        }

        _this.destroy = function (reason) {
            if (_stats) {
                _stats.stop();
                _stats.removeEventListener(TimerEvent.TIMER, _onStats);
            }
            _this.stop();
            _this.dispatchEvent(Event.CLOSE, { reason: reason });
            delete _instances[_id];
        };

        _init();
    }

    RTC.prototype = Object.create(EventDispatcher.prototype);
    RTC.prototype.constructor = RTC;
    RTC.prototype.CONF = _default;

    RTC.State = State;

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
        var codecs = { audio: [], video: [] };
        ['audio', 'video'].forEach(function (kind) {
            var capabilities = RTCRtpSender.getCapabilities(kind);
            if (capabilities && capabilities.codecs) {
                codecs[kind] = capabilities.codecs.slice(0);
            }
        });
        return codecs;
    };

    RTC.get = function (id, logger) {
        if (id == null) {
            id = 0;
        }
        var rtc = _instances[id];
        if (rtc === undefined) {
            rtc = new RTC(id, logger);
            _instances[id] = rtc;
        }
        return rtc;
    };

    RTC.create = function (logger) {
        return RTC.get(_id++, logger);
    };

    odd.rtc = RTC.get;
    odd.rtc.create = RTC.create;
    odd.RTC = RTC;
})(odd);

