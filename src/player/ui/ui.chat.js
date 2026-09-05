(function (odd) {
    var utils = odd.utils,
        Kernel = odd.Kernel,
        css = utils.css,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        NetStatusEvent = events.NetStatusEvent,
        MouseEvent = events.MouseEvent,
        Level = events.Level,
        Code = events.Code,
        RTC = odd.RTC,
        Constraints = RTC.Constraints,
        Player = odd.Player,
        UI = Player.UI,

        CLASS_CHAT = 'pe-chat',
        CLASS_PLAYLIST = 'pe-playlist',

        _default = {
            kind: 'Chat',
            client: null,
            profile: '180P_1',
            camera: true,
            microphone: true,
            rtc: {},
            service: {},
            visibility: true,
        };

    function Chat(config, logger) {
        EventDispatcher.call(this, 'Chat', { logger: logger }, Event, NetStatusEvent, [MouseEvent.CLICK]);

        var _this = this,
            _logger = logger,
            _container,
            _content,
            _playlist;

        function _init() {
            _this.config = config;
            _this.constraints = _getConstraints(_this.config);
            _this.components = {};

            _this.rtc = odd.rtc.create({ mode: 'feedback', url: 'https://fc.oddengine.com/rtc/log', interval: 60 });
            _this.rtc.addEventListener(NetStatusEvent.NETSTATUS, _onStatus);
            _this.rtc.addEventListener(Event.CLOSE, _onClose);
            _this.rtc.setup(_this.config.rtc);

            _container = utils.createElement('div', CLASS_CHAT);
            _content = utils.createElement('div');
            _playlist = utils.createElement('div', CLASS_PLAYLIST);
            _content.appendChild(_playlist);
            _container.appendChild(_content);

            _bind();
        }

        function _bind() {
            _this.stop = _this.rtc.stop;
        }

        function _getConstraints(config) {
            var constraints = utils.extendz({}, Constraints[config.profile]);
            if (config.camera === false) {
                constraints.video = false;
            }
            if (config.microphone === false) {
                constraints.audio = false;
            }
            return constraints;
        }

        _this.configure = async function (config) {
            var publishing = '';
            for (var id in _this.rtc.publishing) {
                publishing = id;
                break;
            }
            if (publishing) {
                _this.rtc.stop(publishing);
            }
            _this.config = utils.extendz(_this.config, config || {});
            _this.constraints = _getConstraints(_this.config);
            if (publishing) {
                await _this.publish();
            }
            return _this.config;
        };

        _this.applyConstraints = function (constraints) {
            _this.constraints = utils.extendz(_this.constraints, constraints);
            utils.forEach(_this.rtc.publishing, function (_, ns) {
                ns.applyConstraints(_this.constraints);
            });
        };

        _this.publish = async function () {
            for (var id in _this.rtc.publishing) {
                _logger.error(`Already published: user=${_userId()}`);
                return Promise.reject('published');
            }
            return _this.rtc.publish(_this.constraints).then(function (ns) {
                ns.addEventListener(Event.RELEASE, function (e) {
                    var video = e.srcElement.element();
                    video.removeEventListener('click', _onClick);
                    _detachVideo(video);
                });

                var video = ns.element();
                video.addEventListener('click', _onClick);
                video.muted = true;
                video.play().catch(function (err) {
                    _logger.warn(`${err}`);
                });
                _playlist.appendChild(video);

                if (_this.constraints.video && !Kernel.isAppleWebKit) {
                    ns.beauty(true, {
                        brightness: 0.5,
                        smoothness: 1.0,
                    });
                }
            }).catch(function (err) {
                _logger.warn(`${err}`);
            });
        };

        _this.play = async function (name) {
            if (name === '') {
                _logger.warn('Stream id is empty.');
                return Promise.resolve();
            }
            return _this.rtc.play(name).then(function (ns) {
                ns.addEventListener(NetStatusEvent.NETSTATUS, function (e) {
                    switch (e.data.code) {
                        case Code.NETSTREAM_PLAY_START:
                            _attachVideo(e.srcElement, e.data.info.streams[0]);
                            break;
                    }
                });
                ns.addEventListener(Event.RELEASE, function (e) {
                    _detachVideo(e.srcElement.element());
                });
                if (ns.stream()) {
                    _attachVideo(ns, ns.stream());
                }
            }).catch(function (err) {
                _logger.warn(`${err}`);
            });
        };

        function _onStatus(e) {
            var level = e.data.level;
            var code = e.data.code;
            var description = e.data.description;
            var info = e.data.info;
            var method = { status: 'log', warning: 'warn', error: 'error' }[level];
            _logger[method](`RTC.onStatus: user=${_userId()}, level=${level}, code=${code}, description=${description}, info=`, info);

            _this.forward(e);
        }

        function _onClose(e) {
            _logger.log(`RTC.onClose: user=${_userId()}, reason=${e.data.reason}`);
            _this.forward(e);
        }

        function _userId() {
            var client = _this.config.client;
            if (client && client.userId) {
                return client.userId();
            }
            return '';
        }

        function _attachVideo(ns, stream) {
            var video = ns.element();
            video.addEventListener('click', _onClick);
            video.srcObject = stream;

            video.play().catch(function (err) {
                switch (err.name) {
                    case 'AbortError':
                        _logger.debug(err.name + ': ' + err.message);
                        break;
                    case 'NotAllowedError':
                        if (video.muted == false) {
                            video.muted = true;
                            video.play().catch(function (err) {
                                _logger.warn(`${err}`);
                            });
                            break;
                        }
                    default:
                        _logger.error('Unexpected error occured, ' + err.name + ': ' + err.message);
                        _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
                        break;
                }
            });
            video.controls = false;

            if (video.parentNode !== _playlist) {
                _playlist.appendChild(video);
            }
        }

        function _detachVideo(video) {
            if (video) {
                video.removeEventListener('click', _onClick);
                if (video.parentNode) {
                    video.parentNode.removeChild(video);
                }
            }
        }

        function _onClick(e) {
            // _this.dispatchEvent(MouseEvent.CLICK, { name: '' });
            // e.preventDefault();
        }

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _this.destroy = function () {
            _this.rtc.removeEventListener(NetStatusEvent.NETSTATUS, _onStatus);
            _this.rtc.removeEventListener(Event.CLOSE, _onClose);
            _this.rtc.destroy('closing');

            utils.forEach(_this.components, function (_, component) {
                component.removeGlobalListener(_this.forward);
                component.destroy();
            });
            _this.components = {};
        };

        _init();
    }

    Chat.prototype = Object.create(EventDispatcher.prototype);
    Chat.prototype.constructor = Chat;
    Chat.prototype.kind = 'Chat';
    Chat.prototype.CONF = _default;

    UI.register(Chat);
})(odd);

