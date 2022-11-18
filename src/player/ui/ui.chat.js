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
            enable: false,
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
            _this.constraints = utils.extendz({}, Constraints[_this.config.profile || '180P_1']);

            _this.api = odd.rtc.create(_this.config.client, { mode: 'feedback', url: 'https://fc.oddcancer.com/rtc/log', interval: 60 });
            _this.api.addEventListener(NetStatusEvent.NET_STATUS, _onStatus);
            _this.api.addEventListener(Event.CLOSE, _onClose);
            _this.api.setup(_this.config);

            _container = utils.createElement('div', CLASS_CHAT);
            _content = utils.createElement('div');
            _playlist = utils.createElement('div', CLASS_PLAYLIST);
            _content.appendChild(_playlist);
            _container.appendChild(_content);

            _bind();
        }

        function _bind() {
            _this.unpublish = _this.api.unpublish;
            _this.stop = _this.api.stop;
        }

        _this.applyConstraints = function (constraints) {
            _this.constraints = utils.extendz(_this.constraints, constraints);
            utils.forEach(_this.api.publishers, function (_, ns) {
                ns.applyConstraints(_this.constraints);
            });
        };

        _this.enable = function (enable) {
            if (utils.typeOf(enable) === 'boolean') {
                _this.config.enable = enable;
                if (enable) {
                    _this.publish().catch(function (err) {
                        _logger.warn(`${err}`);
                    });
                } else {
                    _this.unpublish();
                    _this.stop();
                }
            }
            return _this.config.enable;
        };

        _this.publish = async function () {
            for (var id in _this.api.publishers) {
                _logger.error(`Already published.`);
                return Promise.reject('published');
            }
            return _this.api.publish(_this.constraints).then(function (ns) {
                ns.addEventListener(Event.CLOSE, function (e) {
                    var video = e.srcElement.video;
                    video.removeEventListener('click', _onClick);
                    _playlist.removeChild(video);
                });

                var video = ns.video;
                video.addEventListener('click', _onClick);
                video.muted = true;
                video.srcObject = ns.stream;
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
            if (_this.config.enable === false) {
                return Promise.reject('plugin not enabled');
            }
            return _this.api.play(name).then(function (ns) {
                ns.addEventListener(NetStatusEvent.NET_STATUS, function (e) {
                    switch (e.data.code) {
                        case Code.NETSTREAM_PLAY_START:
                            var video = e.srcElement.video;
                            video.addEventListener('click', _onClick);
                            video.srcObject = e.data.info.streams[0];
                            video.play().catch(function (err) {
                                _logger.warn(`${err}`);
                            });
                            _playlist.appendChild(video);
                            break;
                    }
                });
                ns.addEventListener(Event.CLOSE, function (e) {
                    var video = e.srcElement.video;
                    video.removeEventListener('click', _onClick);
                    _playlist.removeChild(video);
                });
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
            _logger[method](`RTC.onStatus: level=${level}, code=${code}, description=${description}, info=`, info);

            switch (code) {
                case Code.NETCONNECTION_CONNECT_SUCCESS:
                    if (_this.config.enable) {
                        _this.publish();
                    }
                    break;
            }
            _this.forward(e);
        }

        function _onClose(e) {
            _logger.log(`RTC.onClose: ${e.data.reason}`);
            _this.forward(e);
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

        _init();
    }

    Chat.prototype = Object.create(EventDispatcher.prototype);
    Chat.prototype.constructor = Chat;
    Chat.prototype.kind = 'Chat';
    Chat.prototype.CONF = _default;

    UI.register(Chat);
})(odd);

