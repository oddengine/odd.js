(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        IOEvent = events.IOEvent,

        _id = 0,
        _instances = {},
        _default = {
            airplay: 'allow',
            autoplay: false,
            playsinline: true,
            muted: false,
            volume: 0.8,
            retry: {
                delay: 3000,           // ms.
                count: 0,              // -1: always
            },
            service: {
                script: 'js/sw.js',
                scope: 'js/',
                enable: false,
            },
            loader: {
                mode: 'cors',          // cors, no-cors, same-origin
                credentials: 'omit',   // omit, include, same-origin
            },
            live: {
                bufferLength: 0.5,     // sec.
                maxBufferLength: 3,    // sec.
                maxPlaybackLength: 10, // min.
            },
            vod: {
                chunk: 2,              // MB.
                maxBufferLength: 30,   // sec.
                maxPlaybackLength: 30, // min.
                preload: 'metadata',   // none, metadata, auto
                loop: false,
            },
            rtc: {
                profile: '360P_2',
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
            },
            /**
             * Playlist, each containing:
             * @snapshot: The snapshot URL of the media source.
             * @title: The title of the media source.
             * @description: The description of the media source.
             * @type: The type of media source. Can be 'SRC', 'FLV', 'FMP4', 'RTC', 'DASH', or 'HLS'.
             * @vod: Whether the source is for video on demand (true) or live streaming (false).
             * @sources:
             *   @url: The URL of the media source.
             *   @label: The label of definition, such as '1080P'.
             */
            playlist: [],
        };

    function Player(id, logger) {
        var _this = this,
            _id = id,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger(id, logger),
            _container,
            _model,
            _view,
            _controller;

        EventDispatcher.call(this, 'Player', { id: id, logger: _logger }, Event, IOEvent);

        function _init() {
            _this.logger = _logger;
        }

        _this.id = function () {
            return _id;
        };

        _this.setup = function (container, config) {
            _container = container;
            _this.config = utils.extendz({ id: _this.id }, _default, config);

            _model = new Player.Model(_this.config, _logger);
            _view = new Player.View(_container, _model, _logger);
            _controller = new Player.Controller(_model, _view, _logger);
            _controller.addGlobalListener(_this.forward);

            _bind();

            if (_this.config.autoplay) {
                _controller.play();
            }
            return Promise.resolve();
        };

        function _bind() {
            _this.play = _controller.play;
            _this.pause = _view.pause;
            _this.reload = _controller.reload;
            _this.seek = _view.seek;
            _this.stop = _view.stop;
            _this.muted = _view.muted;
            _this.volume = _view.volume;
            _this.definition = _view.definition;
            _this.capture = _view.capture;
            _this.record = _view.record;
            _this.getProperty = _model.getProperty;
            _this.dispatchEvent(Event.BIND);
        }

        _this.duration = function () {
            if (_model) {
                return _model.duration();
            }
            return null;
        };

        _this.state = function () {
            if (_model) {
                return _model.state();
            }
            return null;
        };

        _this.element = function () {
            if (_view) {
                return _view.element();
            }
            return null;
        };

        _this.resize = function (width, height) {
            if (_view) {
                _view.resize(width, height);
            }
        };

        _this.destroy = function () {
            if (_controller) {
                _controller.destroy();
                _controller.removeGlobalListener(_this.forward);
            }
            if (_container) {
                _container.innerHTML = '';
            }
            delete _instances[_this.id];
        };

        _init();
    }

    Player.prototype = Object.create(EventDispatcher.prototype);
    Player.prototype.constructor = Player;
    Player.prototype.CONF = _default;

    Player.get = function (id, logger) {
        if (id == null) {
            id = 0;
        }
        var player = _instances[id];
        if (player == undefined) {
            player = new Player(id, logger);
            _instances[id] = player;
        }
        return player;
    };

    Player.create = function (logger) {
        return Player.get(_id++, logger);
    };

    odd.player = Player.get;
    odd.player.create = Player.create;
    odd.Player = Player;
})(odd);

