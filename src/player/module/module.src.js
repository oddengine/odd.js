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
            _file,
            _generation = 0,
            _destroyed = false;

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
            if (_destroyed) {
                return;
            }
            if (_ready === false) {
                _ready = true;
                _this.dispatchEvent(Event.READY, { kind: _this.kind });
            }
        };

        _this.play = function (program) {
            if (_destroyed) {
                _logger.error('Cannot play after SRC has been destroyed.');
                return;
            }
            if (program) {
                if (!program.sources || !program.sources.length || !program.sources[0].url) {
                    _logger.error('No source provided for SRC playback.');
                    _this.dispatchEvent(Event.ERROR, { name: 'NotFoundError', message: 'No media source provided.' });
                    return;
                }

                var file = program.sources[0].url;
                if (file !== _file) {
                    _generation++;
                    _file = file;
                    _this.dispatchEvent(Event.DURATIONCHANGE, { duration: NaN });
                    _video.src = file;
                }
            }
            if (!_file) {
                _logger.error('No source loaded for SRC playback.');
                return;
            }

            var generation = _generation,
                result = _video.play();
            if (result && result.catch) {
                result.catch(function (err) {
                    if (_destroyed || generation !== _generation) {
                        return;
                    }
                    if (err.name === 'AbortError') {
                        _logger.debug('SRC playback was interrupted.');
                        return;
                    }
                    if (err.name === 'NotAllowedError' && !_video.muted) {
                        _video.muted = true;
                        _this.play();
                        return;
                    }
                    _logger.error('Failed to start native playback: ' + err.name + '.');
                    _this.dispatchEvent(Event.ERROR, { name: err.name, message: 'Native playback could not start.' });
                });
            }
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
            _generation++;
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
            if (_destroyed) {
                return;
            }
            _destroyed = true;
            _this.stop();
            _ready = false;

            _video.removeEventListener('play', _this.forward);
            _video.removeEventListener('waiting', _this.forward);
            _video.removeEventListener('loadstart', _this.forward);
            _video.removeEventListener('progress', _this.forward);
            _video.removeEventListener('suspend', _this.forward);
            _video.removeEventListener('stalled', _this.forward);
            _video.removeEventListener('abort', _this.forward);
            _video.removeEventListener('timeout', _this.forward);
            _video.removeEventListener('durationchange', _onDurationChange);
            _video.removeEventListener('loadedmetadata', _this.forward);
            _video.removeEventListener('loadeddata', _this.forward);
            _video.removeEventListener('canplay', _this.forward);
            _video.removeEventListener('playing', _this.forward);
            _video.removeEventListener('canplaythrough', _this.forward);
            _video.removeEventListener('pause', _this.forward);
            _video.removeEventListener('seeking', _this.forward);
            _video.removeEventListener('seeked', _this.forward);
            _video.removeEventListener('ratechange', _this.forward);
            _video.removeEventListener('timeupdate', _onTimeUpdate);
            _video.removeEventListener('volumechange', _onVolumeChange);
            _video.removeEventListener('load', _this.forward);
            _video.removeEventListener('ended', _this.forward);
            _video.removeEventListener('error', _onError);
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
            if (_destroyed || !_file || !_video.error) {
                return;
            }
            var err = {
                1: { name: 'AbortError', message: 'The operation was aborted.' },
                2: { name: 'NetworkError', message: 'A network error occurred.' },
                3: { name: 'EncodingError', message: 'The encoding or decoding operation failed.' },
                4: { name: 'NotSupportedError', message: 'Failed to load because no supported source was found.' },
            }[_video.error.code] || { name: 'OperationError', message: 'Native media playback failed.' };
            _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
        }

        _init();
    }

    SRC.prototype = Object.create(EventDispatcher.prototype);
    SRC.prototype.constructor = SRC;
    SRC.prototype.kind = 'SRC';

    SRC.prototype.isSupported = function (program) {
        if (Browser.isMSIE && Browser.major < 9 || !program || !program.sources || !program.sources.length) {
            return false;
        }
        var video = utils.createElement('video');
        var nativeHls = video.canPlayType('application/vnd.apple.mpegurl') || video.canPlayType('application/x-mpegURL');
        var extensions = ['mp4', 'f4v', 'm4v', 'mov', 'm4a', 'f4a', 'aac', 'ogv', 'ogg', 'mp3', 'oga', 'webm'];
        for (var source of program.sources) {
            if (!source || typeof source.url !== 'string') {
                return false;
            }
            try {
                var url = new utils.URL(source.url);
            } catch (err) {
                return false;
            }
            if (!/^https?:$/i.test(url.protocol)) {
                return false;
            }
            var extension = (url.filetype || '').replace(/^\./, '').toLowerCase();
            if (['m3u8', 'm3u', 'hls'].indexOf(extension) !== -1) {
                if (!nativeHls || !(OS.isMobile || OS.isMac && Browser.isSafari)) {
                    return false;
                }
            } else if (extensions.indexOf(extension) === -1) {
                return false;
            }
        }
        return true;
    };

    Module.register(SRC);
})(odd);

