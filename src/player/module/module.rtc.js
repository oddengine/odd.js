(function (odd) {
    var utils = odd.utils,
        css = utils.css,
        OS = odd.OS,
        Browser = odd.Browser,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        MediaEvent = events.MediaEvent,
        NetStatusEvent = events.NetStatusEvent,
        TimerEvent = events.TimerEvent,
        Level = events.Level,
        Code = events.Code,
        Module = odd.Module;

    function RTC(config, logger) {
        EventDispatcher.call(this, 'RTC', { logger: logger }, Event);

        var _this = this,
            _logger = logger,
            _ready,
            _url,
            _rtc,
            _loadStartAt,
            _firstAudioFrameReceivedIn,
            _firstVideoFrameReceivedIn,
            _bytesReceived,
            _bytesReceivedPerSecond,
            _audioPacketsReceivedPerSecond,
            _videoPacketsReceivedPerSecond,
            _statsTimer;

        function _init() {
            _this.config = config;
            _ready = false;
            _url = new utils.URL();
            _statsTimer = new utils.Timer(1000, 0, _logger);
            _statsTimer.addEventListener(TimerEvent.TIMER, _onStatsTimer);

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
            if (_this.config.objectfit) {
                css.style(_video, {
                    'object-fit': _this.config.objectfit,
                });
            }
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
            _video.muted = _this.config.muted;
            _video.volume = _this.config.volume;
        }

        _this.setup = function () {
            if (_ready === false) {
                _rtc = odd.rtc.create(_this.config.client, { mode: 'feedback', url: 'https://fc.oddengine.com/rtc/log', interval: 60 });
                _rtc.addEventListener(NetStatusEvent.NET_STATUS, _onStatus);
                _rtc.addEventListener(Event.CLOSE, _onClose);
                _rtc.setup(_this.config.rtc).then(() => {
                    _ready = true;
                    _this.dispatchEvent(Event.READY, { kind: _this.kind });
                });
            }
        };

        _this.play = async function (file, option) {
            if (utils.typeOf(file) === 'string' && new utils.URL(file).href !== _url.href) {
                try {
                    _logger.log('URL: ' + file);
                    _url.parse(file);
                } catch (err) {
                    _logger.error('Failed to parse url \"' + file + '\".');
                    _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
                    return;
                }
                _this.dispatchEvent(Event.DURATIONCHANGE, { duration: NaN });
                _video.srcObject = undefined;

                _loadStartAt = new Date();
                _firstAudioFrameReceivedIn = NaN;
                _firstVideoFrameReceivedIn = NaN;
                _bytesReceived = 0;
                _bytesReceivedPerSecond = 0;
                _audioPacketsReceivedPerSecond = 0;
                _videoPacketsReceivedPerSecond = 0;
                _statsTimer.start();

                var args = {};
                var arr = _url.search.substr(1).split('&');
                for (var i = 0; i < arr.length; i++) {
                    var item = arr[i].split('=');
                    args[item[0]] = item[1];
                }
                _rtc.play(args.name).then(function (ns) {
                    ns.addEventListener(NetStatusEvent.NET_STATUS, function (e) {
                        switch (e.data.code) {
                            case Code.NETSTREAM_PLAY_START:
                                _video.srcObject = e.data.info.streams[0];
                                _video.play().catch(function (err) {
                                    _logger.warn(`${err}`);
                                });
                                _video.controls = false;
                                break;
                        }
                    });
                    ns.addEventListener(Event.RELEASE, function (e) {
                        _this.stop();
                    });
                }).catch(function (err) {
                    _logger.warn(`${err}`);
                });
            }

            var promise = _video.play();
            if (promise) {
                promise['catch'](function (err) {
                    switch (err.name) {
                        case 'AbortError':
                            _logger.debug(err.name + ': ' + err.message);
                            break;
                        case 'NotAllowedError':
                            // Chrome: play() failed because the user didn’t interact with the document first.
                            // Safari: The request is not allowed by the user agent or the platform in the current context, possibly because the user denied permission.
                            _logger.warn('Failed to play due to the autoplay policy, trying to play in mute.');
                            if (OS.isMobile) {
                                return;
                            }
                            _video.muted = true;

                            promise = _video.play();
                            if (promise) {
                                promise['catch'](function (err) {
                                    _video.muted = _this.config.muted;
                                });
                            }
                            break;
                        default:
                            _logger.error('Unexpected error occured, ' + err.name + ': ' + err.message);
                            _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
                            break;
                    }
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
            _statsTimer.reset();
            if (_rtc) {
                _rtc.stop();
            }
            _url = new utils.URL();
            _video.srcObject = undefined;
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

        _this.record = function (filename) {
            return Promise.reject('Failed to record stream, the operation is not supported by this module.');
        };

        _this.element = function () {
            return _video;
        };

        _this.destroy = function () {
            _this.stop();
            _ready = false;
            _statsTimer.removeEventListener(TimerEvent.TIMER, _onStatsTimer);
            _sourceTimer.removeEventListener(TimerEvent.TIMER, _onSourceTimer);
            if (_rtc) {
                _rtc.removeEventListener(NetStatusEvent.NET_STATUS, _onStatus);
                _rtc.removeEventListener(Event.CLOSE, _onClose);
            }
        };

        function _onStatus(e) {
            var level = e.data.level;
            var code = e.data.code;
            var description = e.data.description;
            var info = e.data.info;
            var method = { status: 'debug', warning: 'warn', error: 'error' }[level] || 'debug';
            _logger[method](`RTC.onStatus: level=${level}, code=${code}, description=${description}, info=`, info);
        }

        function _onClose(e) {
            _logger.log(`RTC.onClose: ${e.data.reason}`);
        }

        function _onStatsTimer(e) {
            var stats = {
                BytesReceivedPerSecond: _bytesReceivedPerSecond,
                AudioPacketsReceivedPerSecond: _audioPacketsReceivedPerSecond,
                VideoPacketsReceivedPerSecond: _videoPacketsReceivedPerSecond,
            };
            // 360 doesn't support this interface.
            if (utils.typeOf(_video.getVideoPlaybackQuality) === 'function') {
                var quality = _video.getVideoPlaybackQuality();
                stats.DroppedVideoFrames = quality.droppedVideoFrames;
                stats.TotalVideoFrames = quality.totalVideoFrames;
            }
            _this.dispatchEvent(MediaEvent.STATSUPDATE, { stats: stats });
            _bytesReceivedPerSecond = 0;
            _audioPacketsReceivedPerSecond = 0;
            _videoPacketsReceivedPerSecond = 0;
        }

        function _onDurationChange(e) {
            _this.dispatchEvent(Event.DURATIONCHANGE, { duration: _video.duration });
            _this.dispatchEvent(MediaEvent.INFOCHANGE, { info: { Duration: _video.duration } });
        }

        function _onTimeUpdate(e) {
            _this.dispatchEvent(Event.TIMEUPDATE, {
                start: 0,
                time: _video.currentTime,
                buffered: 0,
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

    RTC.prototype = Object.create(EventDispatcher.prototype);
    RTC.prototype.constructor = RTC;
    RTC.prototype.kind = 'RTC';

    RTC.prototype.isSupported = function (file, mode) {
        if (!window.RTCPeerConnection) {
            return false;
        }
        var url = new utils.URL(file);
        if (url.protocol !== 'rtc:') {
            return false;
        }
        return true;
    };

    Module.register(RTC);
})(odd);

