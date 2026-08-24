(function (odd) {
    var utils = odd.utils,
        OS = odd.OS,
        Browser = odd.Browser,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        IOEvent = events.IOEvent,
        Module = odd.Module;

    function SRC(config, logger) {
        EventDispatcher.call(this, 'SRC', { logger: logger }, Event, IOEvent);

        var _this = this,
            _logger = logger,
            _video,
            _ready,
            _file;

        function _init() {
            _this.config = config;

            _ready = false;

            _video = utils.createElement('video');
            _video.addEventListener('play', _this.forward);
            _video.addEventListener('waiting', _this.forward);
            _video.addEventListener('loadstart', _this.forward);
            _video.addEventListener('progress', _this.forward);
            _video.addEventListener('suspend', _this.forward);
            _video.addEventListener('stalled', _this.forward);
            _video.addEventListener('abort', _this.forward);
            _video.addEventListener('timeout', _this.forward);
            _video.addEventListener('durationchange', _onDurationChange);
            _video.addEventListener('loadedmetadata', _this.forward);
            _video.addEventListener('loadeddata', _this.forward);
            _video.addEventListener('canplay', _this.forward);
            _video.addEventListener('playing', _this.forward);
            _video.addEventListener('canplaythrough', _this.forward);
            _video.addEventListener('pause', _this.forward);
            _video.addEventListener('seeking', _this.forward);
            _video.addEventListener('seeked', _this.forward);
            _video.addEventListener('ratechange', _this.forward);
            _video.addEventListener('timeupdate', _onTimeUpdate);
            _video.addEventListener('volumechange', _onVolumeChange);
            _video.addEventListener('load', _this.forward);
            _video.addEventListener('ended', _this.forward);
            _video.addEventListener('error', _onError);
            if (_this.config.airplay) {
                _video.setAttribute('x-webkit-airplay', 'allow');
            }
            if (_this.config.autoplay) {
                _video.setAttribute('autoplay', '');
            }
            if (_this.config.playsinline) {
                _video.setAttribute('playsinline', 'isiPhoneShowPlaysinline');
                _video.setAttribute('webkit-playsinline', 'isiPhoneShowPlaysinline');
                _video.setAttribute('x5-playsinline', '');
                _video.setAttribute('x5-video-player-type', 'h5-page');
                _video.setAttribute('x5-video-player-fullscreen', true);
                _video.setAttribute('t7-video-player-type', 'inline');
            }
            if (_this.config.preload) {
                _video.preload = _this.config.preload;
            }
            _video.muted = _this.config.muted;
            _video.volume = _this.config.volume;
        }

        _this.setup = function () {
            if (_ready === false) {
                _ready = true;
                _this.dispatchEvent(Event.READY, { kind: _this.kind });
            }
        };

        _this.play = function (program) {
            if (program && program.sources[_definition].url !== _file) {
                var file = program.sources[_definition].url;
                _logger.log('URL: ' + file);

                _file = file;
                _this.dispatchEvent(Event.DURATIONCHANGE, { duration: NaN });
                _video.src = file;
            }

            _video.play().catch(function (err) {
                switch (err.name) {
                    case 'AbortError':
                        _logger.debug(err.name + ': ' + err.message);
                        break;
                    case 'NotAllowedError':
                        if (_video.muted == false) {
                            _video.muted = true;
                            _video.play().catch(function (err) {
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
            _video.controls = false;
        };

        _this.pause = function () {
            _video.pause();
            _video.controls = false;
        };

        _this.seek = function (offset) {
            _video.currentTime = offset;
        };

        _this.stop = function () {
            _file = undefined;
            _video.removeAttribute('src');
            _video.load();
            _video.controls = false;
            _this.dispatchEvent(Event.ENDED);
        };

        _this.muted = function (status) {
            if (utils.typeOf(status) === 'boolean') {
                _video.muted = status;
            }
            return _video.muted;
        };

        _this.volume = function (f) {
            if (utils.typeOf(f) === 'number') {
                _video.volume = f;
            }
            return _video.volume;
        };

        _this.record = function (mode, option) {
            return Promise.reject('Failed to record stream, the operation is not supported by this module.');
        };

        _this.element = function () {
            return _video;
        };

        _this.destroy = function () {
            _this.stop();
            _ready = false;
        };

        function _onDurationChange(e) {
            _this.dispatchEvent(Event.DURATIONCHANGE, { duration: _video.duration });
        }

        function _onTimeUpdate(e) {
            var ranges = _video.buffered;
            var start = ranges.length ? ranges.start(0) : 0;
            var buffered = ranges.length ? ranges.end(ranges.length - 1) : 0;
            _this.dispatchEvent(Event.TIMEUPDATE, {
                start: start,
                time: _video.currentTime,
                buffered: buffered,
                duration: _video.duration,
            });
        }

        function _onVolumeChange(e) {
            _this.dispatchEvent(Event.VOLUMECHANGE, { muted: _video.muted, volume: _video.volume });
        }

        function _onError(e) {
            var err = {
                1: { name: 'AbortError', message: 'The operation was aborted.' },
                2: { name: 'NetworkError', message: 'A network error occurred.' },
                3: { name: 'EncodingError', message: 'The encoding or decoding operation failed.' },
                4: { name: 'NotSupportedError', message: 'Failed to load because no supported source was found.' },
            }[_video.error.code];
            _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
        }

        _init();
    }

    SRC.prototype = Object.create(EventDispatcher.prototype);
    SRC.prototype.constructor = SRC;
    SRC.prototype.kind = 'SRC';

    SRC.prototype.isSupported = function (program) {
        if (Browser.isMSIE && Browser.major < 9) {
            return false;
        }
        for (var source of program.sources) {
            var url = new utils.URL(file);
            if (!url.protocol.match(/^(http|https)\:$/gi)) {
                return false;
            }
            var arr = [
                'mp4', 'f4v', 'm4v', 'mov',
                'm4a', 'f4a', 'aac',
                'ogv', 'ogg',
                'mp3',
                'oga',
                'webm',
            ];
            if (OS.isMobile || OS.isMac && Browser.isSafari && OS.major > 10) {
                arr = arr.concat(['m3u8', 'm3u', 'hls']);
            }
            if (arr.indexOf(url.filetype) === -1) {
                return false;
            }
        }
        return !!program.sources.length;
    };

    Module.register(SRC);
})(odd);

