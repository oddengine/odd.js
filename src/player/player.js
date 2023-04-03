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
            bufferLength: 0.5,       // sec.
            dynamic: false,          // dynamic streaming
            file: '',
            im: null,
            loop: false,
            lowlatency: true,        // ll-dash, ll-hls, ll-flv/fmp4 (auto reduce latency due to cumulative ack of tcp)
            maxBufferLength: 1.5,    // sec.
            maxPlaybackLength: 10,   // sec. for live mode only, set NaN to disable
            maxRetries: 0,           // maximum number of retries while some types of error occurs. -1 means always
            mode: 'auto',            // auto, live, vod
            module: '',              // SRC, FLV, FMP4, DASH*, HLS*, RTC
            muted: false,
            objectfit: 'contain',    // fill, contain, cover, none, scale-down
            playsinline: true,
            preload: 'none',         // none, metadata, auto
            retrying: 0,             // ms. retrying interval
            smoothing: false,        // smooth switching
            volume: 0.8,
            loader: {
                name: 'auto',
                mode: 'cors',        // cors, no-cors, same-origin
                credentials: 'omit', // omit, include, same-origin
            },
            rtc: {},
            service: {
                script: 'js/sw.js',
                scope: 'js/',
                enable: false,
            },
            sources: [],             // ignored if "file" is presented
        };

    function Player(id, logger) {
        var _this = this,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger(id, logger),
            _model,
            _view,
            _controller;

        EventDispatcher.call(this, 'Player', { id: id, logger: _logger }, Event, IOEvent);

        function _init() {
            _this.id = id;
            _this.logger = _logger;
        }

        _this.setup = function (container, config) {
            _this.config = utils.extendz({ id: _this.id }, _default, config);

            _model = new Player.Model(_this.config, _logger);
            _view = new Player.View(container, _model, _logger);
            _controller = new Player.Controller(_model, _view, _logger);
            _controller.addGlobalListener(_this.forward);
            _bindInterfaces();

            if (_this.config.autoplay) {
                _controller.play();
            }
        };

        function _bindInterfaces() {
            _this.play = _controller.play;
            _this.pause = _view.pause;
            _this.seek = _view.seek;
            _this.stop = _view.stop;
            _this.reload = _controller.reload;
            _this.muted = _view.muted;
            _this.volume = _view.volume;
            _this.definition = _view.definition;
            _this.capture = _view.capture;
            _this.record = _view.record;
            _this.element = _view.element;
            _this.getProperty = _model.getProperty;
            _this.duration = function () { return _model.duration(); };
            _this.state = function () { return _model.state(); };
            _this.dispatchEvent(Event.BIND);
        }

        _this.destroy = function () {
            if (_view) {
                _view.destroy();
                _controller.removeGlobalListener(_this.forward);
            }
            delete _instances[_this.id];
        };

        _init();
    }

    Player.prototype = Object.create(EventDispatcher.prototype);
    Player.prototype.constructor = Player;
    Player.prototype.CONF = _default;

    Player.get = function (id, logger) {
        if (id == undefined) {
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

