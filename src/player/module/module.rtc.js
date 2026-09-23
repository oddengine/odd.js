(function (odd) {
    var utils = odd.utils,
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
            _video,
            _ready,
            _destroyed = false,
            _generation = 0,
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
            _video.muted = _this.config.muted;
            _video.volume = _this.config.volume;

            _rtc = odd.rtc.create({ mode: 'feedback', url: 'https://fc.oddengine.com/rtc/log', interval: 60 });
            _rtc.addEventListener(NetStatusEvent.NETSTATUS, _onStatus);
            _rtc.addEventListener(Event.CLOSE, _onClose);

            _statsTimer = new utils.Timer(1000, 0, _logger);
            _statsTimer.addEventListener(TimerEvent.TIMER, _onStatsTimer);
        }

        _this.setup = function () {
            if (_destroyed) {
                return;
            }
            if (_ready === false) {
                _rtc.setup(_this.config.rtc).then(function () {
                    if (_destroyed) {
                        return;
                    }
                    _ready = true;
                    _this.dispatchEvent(Event.READY, { kind: _this.kind });
                }).catch(function (err) {
                    if (!_destroyed) {
                        _this.dispatchEvent(Event.ERROR, { name: err.name || 'OperationError', message: 'Failed to initialize RTC playback.' });
                    }
                });
            }
        };

        _this.play = function (program) {
            if (_destroyed) {
                return;
            }
            if (!_ready) {
                _this.setup();
                return;
            }

            if (program && program.sources[0].url !== _url.href) {
                var url;
                try {
                    url = new utils.URL(program.sources[0].url);
                } catch (err) {
                    _logger.error('Failed to parse the selected source URL.');
                    _this.dispatchEvent(Event.ERROR, { name: err.name, message: 'Invalid RTC source URL.' });
                    return;
                }

                _generation++;
                _rtc.stop();
                _url = url;
                _video.srcObject = null;

                _loadStartAt = new Date();
                _firstAudioFrameReceivedIn = NaN;
                _firstVideoFrameReceivedIn = NaN;
                _bytesReceived = 0;
                _bytesReceivedPerSecond = 0;
                _audioPacketsReceivedPerSecond = 0;
                _videoPacketsReceivedPerSecond = 0;
                _statsTimer.start();
                _this.dispatchEvent(Event.DURATIONCHANGE, { duration: NaN });

                var generation = _generation,
                    index = _url.path.lastIndexOf('/'),
                    name = _url.path.substring(index + 1) + (_url.search || ''),
                    rtc = _rtc;
                rtc.config.whep = _url.origin + _url.path.substring(0, index);
                rtc.play(name).then(function (ns) {
                    if (_destroyed || generation !== _generation) {
                        ns.close('source changed');
                        if (_destroyed) {
                            rtc.destroy();
                        }
                        return;
                    }
                    ns.addEventListener(NetStatusEvent.NETSTATUS, function (e) {
                        if (_destroyed || generation !== _generation) {
                            return;
                        }
                        if (e.data.code === Code.NETSTREAM_PLAY_START) {
                            _video.srcObject = e.data.info.streams[0];
                            _this.play();
                        }
                    });
                    ns.addEventListener(Event.RELEASE, function (e) {
                        if (!_destroyed && generation === _generation) {
                            _this.stop();
                        }
                    });

                    // The first track can arrive before play() resolves.
                    var stream = ns.stream();
                    if (stream) {
                        _video.srcObject = stream;
                        _this.play();
                    }
                }).catch(function (err) {
                    if (!_destroyed && generation === _generation) {
                        _this.dispatchEvent(Event.ERROR, { name: err.name || 'NetworkError', message: 'Failed to open the selected RTC source.' });
                    }
                });
                return;
            }
            if (!_video.srcObject) {
                return;
            }

            var generation = _generation;
            _video.play().catch(function (err) {
                if (_destroyed || generation !== _generation) {
                    return;
                }
                if (err.name === 'AbortError') {
                    _logger.debug('RTC playback was interrupted.');
                    return;
                }
                if (err.name === 'NotAllowedError' && !_video.muted) {
                    _video.muted = true;
                    _this.play();
                    return;
                }
                _this.dispatchEvent(Event.ERROR, { name: err.name, message: 'Failed to start RTC playback.' });
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
            _generation++;
            _statsTimer.reset();
            if (_rtc) {
                _rtc.stop();
            }
            _url = new utils.URL();
            _video.srcObject = null;
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
            if (_destroyed) {
                return;
            }
            _destroyed = true;
            _this.stop();
            _ready = false;

            _statsTimer.removeEventListener(TimerEvent.TIMER, _onStatsTimer);

            if (_rtc) {
                _rtc.removeEventListener(NetStatusEvent.NETSTATUS, _onStatus);
                _rtc.removeEventListener(Event.CLOSE, _onClose);
                _rtc.destroy();
                _rtc = undefined;
            }

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
            _this.dispatchEvent(MediaEvent.STATSCHANGE, { stats: stats });
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
            if (_destroyed || !_video.error) {
                return;
            }
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

    RTC.prototype.isSupported = function (program) {
        if (!window.RTCPeerConnection) {
            return false;
        }
        for (var source of program.sources) {
            var url = new utils.URL(source.url);
            if (!url.protocol.match(/^(http|https)\:$/gi)) {
                return false;
            }
        }
        return !!program.sources.length;
    };

    Module.register(RTC);
})(odd);

