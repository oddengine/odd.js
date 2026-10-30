(function (odd) {
    var utils = odd.utils,
        WriterState = utils.StreamWriter.WriterState,
        StreamSaver = utils.StreamSaver,
        OS = odd.OS,
        Browser = odd.Browser,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        IOEvent = events.IOEvent,
        MediaEvent = events.MediaEvent,
        SaverEvent = events.SaverEvent,
        TimerEvent = events.TimerEvent,
        IO = odd.IO,
        AV = odd.AV,
        Format = AV.Format,
        Module = odd.Module;

    function FMP4(config, logger) {
        EventDispatcher.call(this, 'FMP4', { logger: logger }, Event, IOEvent);

        var _this = this,
            _logger = logger,
            _video,
            _surface,
            _hevc,
            _intent = false,
            _ready,
            _destroyed = false,
            _url,
            _ms,
            _sb,
            _escaped,
            _buffering,
            _ended,
            _failed = false,
            _loader,
            _source,
            _loading = false,
            _generation = 0,
            _connectionId,
            _credentialTimer,
            _credentialReject,
            _credentialController,
            _demuxer,
            _samples,
            _ftyp,
            _moov,
            _segments,
            _saver,
            _writer,
            _recordPending = false,
            _recordFragment,
            _recordTracks,
            _need2remove,
            _removingTimer,
            _loadStartAt,
            _firstAudioFrameReceivedIn,
            _firstVideoFrameReceivedIn,
            _bytesReceived,
            _bytesReceivedPerSecond,
            _audioPacketsReceivedPerSecond,
            _videoPacketsReceivedPerSecond,
            _statsTimer,
            _sourceTimer;

        function _init() {
            _this.config = config;

            _ready = false;
            _url = new utils.URL();
            _escaped = false;
            _buffering = false;
            _ended = false;
            _sb = [];
            _ftyp = null; // Packet
            _moov = null; // Packet
            _segments = [];
            _writer = null;
            _need2remove = 0;

            _surface = utils.createElement('div', 'odd-media-surface');
            _surface.style.cssText = 'width:100%;height:100%;position:relative';
            _video = utils.createElement('video');
            _video.style.cssText = 'width:100%;height:100%;object-fit:contain';
            _surface.appendChild(_video);
            _video.addEventListener('play', _onPlay);
            _video.addEventListener('waiting', _onWaiting);
            _video.addEventListener('loadstart', _forwardNative);
            _video.addEventListener('progress', _forwardNative);
            _video.addEventListener('suspend', _forwardNative);
            _video.addEventListener('stalled', _forwardNative);
            _video.addEventListener('abort', _forwardNative);
            _video.addEventListener('timeout', _forwardNative);
            _video.addEventListener('durationchange', _onDurationChange);
            _video.addEventListener('loadedmetadata', _forwardNative);
            _video.addEventListener('loadeddata', _forwardNative);
            _video.addEventListener('canplay', _forwardNative);
            _video.addEventListener('playing', _forwardNative);
            _video.addEventListener('canplaythrough', _forwardNative);
            _video.addEventListener('pause', _onPause);
            _video.addEventListener('seeking', _forwardNative);
            _video.addEventListener('seeked', _forwardNative);
            _video.addEventListener('ratechange', _forwardNative);
            _video.addEventListener('timeupdate', _onTimeUpdate);
            _video.addEventListener('volumechange', _onVolumeChange);
            _video.addEventListener('load', _forwardNative);
            _video.addEventListener('ended', _forwardNative);
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

            _saver = new StreamSaver(_this.config.service, _logger);
            _saver.addEventListener(Event.ERROR, _this.forward);
            _saver.addEventListener(Event.CHANGE, _this.forward);
            _saver.addEventListener(SaverEvent.WRITERSTART, _onWriterStart);
            _saver.addEventListener(SaverEvent.WRITEREND, _onWriterEnded);

            _removingTimer = new utils.Timer(_this.config.maxPlaybackLength * 500, 0, _logger);
            _removingTimer.addEventListener(TimerEvent.TIMER, _onRemovingTimer);

            _statsTimer = new utils.Timer(1000, 0, _logger);
            _statsTimer.addEventListener(TimerEvent.TIMER, _onStatsTimer);

            _sourceTimer = new utils.Timer(1000, 1, _logger);
            _sourceTimer.addEventListener(TimerEvent.TIMER, _onSourceTimer);

            _initMSE();
            _initMuxer();
        }

        function _forwardNative(e) {
            if (!_hevc || !_hevc.active) { _this.forward(e); }
        }

        function _resetPresentation() {
            if (_hevc) { _hevc.destroy(); }
            _video.hidden = false;
            _samples = null;
            _hevc = new AV.HEVCPlayback(_surface, _video, _this.config, _logger);
            _hevc.addGlobalListener(function (e) {
                if (e.type === Event.ERROR && !e.data.recoverable) {
                    _onDecodeError(e);
                } else { _this.forward(e); }
            });
        }

        function _fallback(reason) {
            if (!_hevc || !_hevc.configuration || _hevc.active) { return false; }
            _hevc.activate(_video.currentTime, _intent, reason && reason.name ? { name: reason.name, message: reason.message } : { name: 'NotSupportedError', message: 'Native HEVC presentation is unavailable or its configuration changed.' });
            _segments = [];
            _clearSourceBuffer();
            _removingTimer.reset();
            if (_ended) { _hevc.end(); }
            return true;
        }

        function _initMSE() {
            var MediaSource = window.MediaSource || window.WebKitMediaSource;
            _ms = new MediaSource();
            _ms.addEventListener('sourceopen', _onSourceOpen);
            _ms.addEventListener('sourceended', _onSourceEnded);
            _ms.addEventListener('sourceclose', _onSourceClose);
            _ms.addEventListener('error', _onSourceError);

            _ms.addEventListener('webkitsourceopen', _onSourceOpen);
            _ms.addEventListener('webkitsourceended', _onSourceEnded);
            _ms.addEventListener('webkitsourceclose', _onSourceClose);
            _ms.addEventListener('webkiterror', _onSourceError);
        }

        function _cleanupMSE() {
            _ms.removeEventListener('sourceopen', _onSourceOpen);
            _ms.removeEventListener('sourceended', _onSourceEnded);
            _ms.removeEventListener('sourceclose', _onSourceClose);
            _ms.removeEventListener('error', _onSourceError);

            _ms.removeEventListener('webkitsourceopen', _onSourceOpen);
            _ms.removeEventListener('webkitsourceended', _onSourceEnded);
            _ms.removeEventListener('webkitsourceclose', _onSourceClose);
            _ms.removeEventListener('webkiterror', _onSourceError);
        }

        function _initMuxer() {
            _demuxer = new Format.FMP4(_logger, { streaming: true });
            _demuxer.addEventListener(MediaEvent.PACKET, _onFMP4Packet);
            _demuxer.addEventListener(Event.ERROR, _onDecodeError);
        }

        function _cleanupMuxer() {
            _demuxer.close();
            _demuxer.removeEventListener(MediaEvent.PACKET, _onFMP4Packet);
            _demuxer.removeEventListener(Event.ERROR, _this.forward);
        }

        _this.setup = function () {
            if (_destroyed) {
                return;
            }
            if (_ready === false) {
                function handler() {
                    if (_destroyed) {
                        return;
                    }
                    _ready = true;
                    _this.dispatchEvent(Event.READY, { kind: _this.kind });
                }
                // Local downloads are optional; worker readiness must not gate playback.
                handler();
            }
        };

        _this.play = function (program) {
            _intent = true;
            if (_destroyed) {
                return;
            }
            if (_ready === false) {
                _this.setup();
                return;
            }

            if (program && (!_source || program.sources[0].url !== _source.url || program.sources[0].streamId !== _source.streamId)) {
                _cancelLoad();
                var file = program.sources[0].url;
                _logger.log('Loading selected source.');

                try {
                    _url.parse(file);
                } catch (err) {
                    _logger.error('Failed to parse the selected source URL.');
                    _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
                    return;
                }

                try { _resetPresentation(); } catch (error) { _onDecodeError({ data: error }); return; }
                _source = utils.extendz({}, program.sources[0]);
                _ended = false;
                _failed = false;
                _demuxer.reset();

                _this.dispatchEvent(Event.DURATIONCHANGE, { duration: NaN });
                _video.src = URL.createObjectURL(_ms);
                _video.load();
            }

            if (_hevc && _hevc.active) { _hevc.play(); return; }
            _video.play().catch(function (err) {
                if (_destroyed || (_hevc && _hevc.active)) {
                    return;
                }
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
            _intent = false;
            _buffering = false;
            if (_hevc && _hevc.active) { _hevc.pause(); return; }
            _video.pause();
            _video.controls = false;
        };

        _this.seek = function (offset) {
            if (_hevc && _hevc.active) { _hevc.seek(offset); return; }
            _video.currentTime = offset;
        };

        _this.stop = function () {
            _intent = false;
            if (_hevc) { _hevc.destroy(); _hevc = null; }
            _video.hidden = false;
            _sourceTimer.reset();
            _removingTimer.reset();
            _statsTimer.reset();
            _cancelLoad();
            _source = undefined;
            if (_writer) {
                _writer.close();
                _writer = null;
            }
            _clearSourceBuffer();
            _escaped = false;
            _buffering = false;
            _ended = false;
            _failed = true;
            _ftyp = null;
            _moov = null;
            _segments = [];
            _need2remove = 0;
            _url = new utils.URL();
            if (_video.src) {
                URL.revokeObjectURL(_video.src);
            }
            _video.removeAttribute('src');
            _video.load();
            _video.controls = false;
            _this.dispatchEvent(Event.ENDED);
        };

        _this.muted = function (status) {
            if (utils.typeOf(status) === 'boolean') {
                _video.muted = status;
                if (_hevc) { _hevc.muted(status); }
            }
            return _video.muted;
        };

        _this.volume = function (f) {
            if (utils.typeOf(f) === 'number') {
                _video.volume = f;
                if (_hevc) { _hevc.volume(f); }
            }
            return _video.volume;
        };

        _this.record = async function (filename) {
            if (_destroyed || _recordPending || _writer || !_source || _failed || _ended) {
                throw { name: 'InvalidStateError', message: 'The source is unavailable or a recording is already active.' };
            }
            var generation = _generation,
                deadline = Date.now() + _saver.config.startTimeout;
            _recordPending = true;
            try {
                await _saver.register();
                if (_destroyed || generation !== _generation || !_source || _failed || _ended) {
                    throw { name: 'AbortError', message: 'The recording source changed before setup completed.' };
                }
                if (Date.now() >= deadline) {
                    throw { name: 'TimeoutError', message: 'Recording setup exceeded its deadline.' };
                }
                _recordFragment = null;
                _recordTracks = _moov ? Format.FMP4.recordingTracks(_moov.payload) : null;
                _writer = _saver.record(filename, {
                    close: function () { _recordFragment = null; },
                    abort: function () { _recordFragment = null; },
                }, undefined, deadline);
                return _writer;
            } finally {
                _recordPending = false;
            }
        };

        _this.element = function () {
            return _surface;
        };

        _this.position = function () { return _hevc && _hevc.active ? _hevc.position() : { time: _video.currentTime, rate: _video.playbackRate }; };
        _this.frame = function () { return _hevc && _hevc.active ? _hevc.frame() : _video.readyState >= 2 ? { source: _video, width: _video.videoWidth, height: _video.videoHeight } : null; };
        _this.capabilities = function () { return { capture: true, nativeFullscreen: _hevc && _hevc.active ? null : _video }; };

        _this.destroy = function () {
            if (_destroyed) {
                return;
            }
            _destroyed = true;
            _this.stop();
            _ready = false;

            _saver.destroy();
            _saver.removeEventListener(Event.ERROR, _this.forward);
            _saver.removeEventListener(Event.CHANGE, _this.forward);
            _saver.removeEventListener(SaverEvent.WRITERSTART, _onWriterStart);
            _saver.removeEventListener(SaverEvent.WRITEREND, _onWriterEnded);
            _removingTimer.removeEventListener(TimerEvent.TIMER, _onRemovingTimer);
            _statsTimer.removeEventListener(TimerEvent.TIMER, _onStatsTimer);
            _sourceTimer.removeEventListener(TimerEvent.TIMER, _onSourceTimer);
            _cleanupMSE();
            _cleanupMuxer();
            _cleanupLoader();

            _video.removeEventListener('play', _onPlay);
            _video.removeEventListener('waiting', _onWaiting);
            _video.removeEventListener('loadstart', _forwardNative);
            _video.removeEventListener('progress', _forwardNative);
            _video.removeEventListener('suspend', _forwardNative);
            _video.removeEventListener('stalled', _forwardNative);
            _video.removeEventListener('abort', _forwardNative);
            _video.removeEventListener('timeout', _forwardNative);
            _video.removeEventListener('durationchange', _onDurationChange);
            _video.removeEventListener('loadedmetadata', _forwardNative);
            _video.removeEventListener('loadeddata', _forwardNative);
            _video.removeEventListener('canplay', _forwardNative);
            _video.removeEventListener('playing', _forwardNative);
            _video.removeEventListener('canplaythrough', _forwardNative);
            _video.removeEventListener('pause', _onPause);
            _video.removeEventListener('seeking', _forwardNative);
            _video.removeEventListener('seeked', _forwardNative);
            _video.removeEventListener('ratechange', _forwardNative);
            _video.removeEventListener('timeupdate', _onTimeUpdate);
            _video.removeEventListener('volumechange', _onVolumeChange);
            _video.removeEventListener('load', _forwardNative);
            _video.removeEventListener('ended', _forwardNative);
            _video.removeEventListener('error', _onError);
        };

        function _onPlay(e) {
            if (_hevc && _hevc.active) { return; }
            _sourceTimer.reset();
            _this.forward(e);
        }

        function _onWaiting(e) {
            if (_hevc && _hevc.active) { return; }
            if (!_intent) { return; }
            var ranges = _video.buffered;
            var remaining = ranges.length ? ranges.end(ranges.length - 1) - _video.currentTime : 0;
            if (remaining >= _this.config.bufferLength || (_ended && remaining > .01)) { return; }
            if (_buffering) { return; }
            _buffering = true;
            _video.pause();
            _this.forward(e);
        }

        function _onPause(e) {
            if (_hevc && _hevc.active) { return; }
            if (_buffering === false) {
                _this.forward(e);
            }
        }

        function _onSourceOpen(e) {
            _logger.log('MediaSource.onsourceopen');
            _loadStartAt = new Date();
            _firstAudioFrameReceivedIn = NaN;
            _firstVideoFrameReceivedIn = NaN;
            _bytesReceived = 0;
            _bytesReceivedPerSecond = 0;
            _audioPacketsReceivedPerSecond = 0;
            _videoPacketsReceivedPerSecond = 0;
            _statsTimer.start();
            _load();
        }

        function _onSourceEnded(e) {
            if (_hevc && _hevc.active) { return; }
            _logger.log('MediaSource.onsourceended');
            if (_buffering) {
                _sourceTimer.start();
            }
        }

        function _onSourceClose(e) {
            if (_hevc && _hevc.active) { return; }
            _logger.log('MediaSource.onsourceclose');
            _sourceTimer.reset();
        }

        function _onSourceTimer(e) {
            if (_hevc && _hevc.active) { return; }
            if (_buffering) {
                _logger.warn('Seems stalled, stop playing manually.');
                _this.stop();
            }
        }

        function _onSourceError(e) {
            if ((_hevc && _hevc.active) || _fallback()) { return; }
            _logger.log('MediaSource.onsourceerror');
            if (!_destroyed) {
                _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'MediaSource failed to process the selected stream.' });
            }
        }

        async function _load() {
            if (_destroyed || _loading || _ended || _failed || !_source) {
                return;
            }
            _loading = true;
            var generation = ++_generation,
                target = _url,
                option = utils.extendz({}, _this.config.loader || {});

            try {
                if (_this.config.credentials !== null && _this.config.credentials !== undefined) {
                    if (typeof _this.config.credentials !== 'function' || _this.config.mode !== 'live' ||
                        !Number.isSafeInteger(_this.config.timeout) || _this.config.timeout <= 0 || _this.config.timeout > 2147483647) {
                        throw { name: 'TypeError', message: 'Invalid live credentials or timeout configuration.' };
                    }
                    if (typeof _source.streamId !== 'string' ||
                        !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(_source.streamId) ||
                        _source.streamId === '00000000-0000-0000-0000-000000000000') {
                        throw { name: 'TypeError', message: 'Protected playback requires an explicit streamId.' };
                    }
                    if (!IO.Fetch || !window.fetch || !window.ReadableStream || !window.AbortController ||
                        !window.crypto || !window.crypto.getRandomValues || !utils.MediaRequest) {
                        throw { name: 'NotSupportedError', message: 'Protected playback requires streaming Fetch and secure randomness.' };
                    }
                    if (!_connectionId) {
                        var bytes = new Uint8Array(16);
                        window.crypto.getRandomValues(bytes);
                        bytes[6] = (bytes[6] & 15) | 64;
                        bytes[8] = (bytes[8] & 63) | 128;
                        _connectionId = '';
                        for (var i = 0; i < bytes.length; i++) {
                            if (i === 4 || i === 6 || i === 8 || i === 10) {
                                _connectionId += '-';
                            }
                            _connectionId += ('0' + bytes[i].toString(16)).slice(-2);
                        }
                    }

                    _credentialController = new AbortController();
                    var deadline = Date.now() + _this.config.timeout,
                        context = {
                            protocol: 'HTTP-CMAF',
                            direction: 'play',
                            streamId: _source.streamId,
                            connectionId: _connectionId,
                            instanceId: _connectionId,
                            operationId: _connectionId,
                            createdAt: String(Date.now()),
                            deadline: deadline,
                            signal: _credentialController.signal,
                            product: 'live',
                            generation: String(generation),
                            url: _url.href,
                            module: _this.kind,
                        };
                    _credentialTimer = setTimeout(function () {
                        if (generation === _generation) {
                            _onLoadError({ data: { name: 'TimeoutError', message: 'Live media admission timed out.' } });
                        }
                    }, _this.config.timeout);
                    var credentials = await new Promise(function (resolve, reject) {
                        _credentialReject = reject;
                        Promise.resolve().then(function () {
                            if (generation !== _generation) {
                                throw { name: 'AbortError', message: 'Live media admission was cancelled.' };
                            }
                            return _this.config.credentials(context);
                        }).then(resolve, reject);
                    });
                    if (_destroyed || generation !== _generation) {
                        return;
                    }
                    _credentialReject = undefined;
                    var media = new utils.MediaRequest(credentials, context);
                    deadline = Math.min(deadline, media.connectBefore * 1000);
                    if (Date.now() >= deadline) {
                        throw { name: 'TimeoutError', message: 'Live media admission timed out.' };
                    }
                    clearTimeout(_credentialTimer);
                    _credentialTimer = setTimeout(function () {
                        if (generation === _generation) {
                            _onLoadError({ data: { name: 'TimeoutError', message: 'Live media admission timed out.' } });
                        }
                    }, Math.max(1, deadline - Date.now()));
                    target = new utils.URL(media.url);
                    option.name = 'Fetch';
                    option.method = 'GET';
                    option.mode = IO.Mode.CORS;
                    option.credentials = IO.Credentials.OMIT;
                    option.redirect = IO.Redirect.ERROR;
                    option.cache = 'no-store';
                    option.headers = utils.extendz({}, option.headers || {});
                    for (var name in option.headers) {
                        if (/^(authorization|odd-media-.*|odd-rtc-.*)$/i.test(name)) {
                            delete option.headers[name];
                        }
                    }
                    utils.extendz(option.headers, media.headers('GET'));
                    option.renew = async function () {
                        await media.renew(_this.config.credentials);
                        if (_destroyed || generation !== _generation) {
                            throw { name: 'AbortError', message: 'Live media renewal was cancelled.' };
                        }
                        return media.headers('GET');
                    };
                }
                _initLoader(option, target);
                _loader.load(target);
            } catch (err) {
                if (!_destroyed && generation === _generation) {
                    _onLoadError({ data: err });
                }
            }
        }

        function _cancelLoad() {
            _generation++;
            _connectionId = undefined;
            _loading = false;
            clearTimeout(_credentialTimer);
            _credentialTimer = undefined;
            if (_credentialController) {
                _credentialController.abort();
                _credentialController = undefined;
            }
            if (_credentialReject) {
                var reject = _credentialReject;
                _credentialReject = undefined;
                reject({ name: 'AbortError', message: 'Live media admission was cancelled.' });
            }
            _cleanupLoader();
        }

        function _onDecodeError(e) {
            if (_failed) { return; }
            _this.stop();
            _this.dispatchEvent(Event.ERROR, e.data);
        }

        function _onLoadError(e) {
            _failed = true;
            _cancelLoad();
            _this.dispatchEvent(Event.ERROR, e.data);
        }

        function _initLoader(option, url) {
            option.wait = function (signal) { return _hevc ? _hevc.wait(signal) : Promise.resolve(); };
            _cleanupLoader();

            var Loader;
            if (option.name && option.name !== 'auto') {
                Loader = IO[option.name];
            }
            if (Loader == null || !Loader.prototype.isSupported(url, _this.config.mode)) {
                Loader = odd.io(url, _this.config.mode);
            }
            if (Loader == null) {
                throw { name: 'NotSupportedError', message: 'No supported io found.' };
            }

            _loader = new Loader(option, _logger);
            _loader.addEventListener(IOEvent.LOADSTART, _this.forward);
            _loader.addEventListener(IOEvent.OPEN, _this.forward);
            _loader.addEventListener(IOEvent.STALLED, _this.forward);
            _loader.addEventListener(IOEvent.ABORT, _onAbort);
            _loader.addEventListener(IOEvent.TIMEOUT, _this.forward);
            _loader.addEventListener(IOEvent.PROGRESS, _onProgress);
            _loader.addEventListener(IOEvent.SUSPEND, _this.forward);
            _loader.addEventListener(IOEvent.LOAD, _this.forward);
            _loader.addEventListener(IOEvent.LOADEND, _onLoadEnd);
            _loader.addEventListener(Event.ERROR, _onLoadError);
            _logger.log(_loader.kind + ' loader initialized.');
        }

        function _cleanupLoader() {
            if (_loader) {
                _loader.removeEventListener(IOEvent.LOADSTART, _this.forward);
                _loader.removeEventListener(IOEvent.OPEN, _this.forward);
                _loader.removeEventListener(IOEvent.STALLED, _this.forward);
                _loader.removeEventListener(IOEvent.ABORT, _onAbort);
                _loader.removeEventListener(IOEvent.TIMEOUT, _this.forward);
                _loader.removeEventListener(IOEvent.PROGRESS, _onProgress);
                _loader.removeEventListener(IOEvent.SUSPEND, _this.forward);
                _loader.removeEventListener(IOEvent.LOAD, _this.forward);
                _loader.removeEventListener(IOEvent.LOADEND, _onLoadEnd);
                _loader.removeEventListener(Event.ERROR, _onLoadError);
                _loader.abort();
                _loader = undefined;
            }
        }

        function _onAbort(e) {
            e.type = Event.ENDED;
            _this.forward(e);
        }

        function _onProgress(e) {
            if (e.data.loaded > 0) {
                clearTimeout(_credentialTimer);
                _credentialTimer = undefined;
            }
            _logger.debug('progress: ' + e.data.loaded + '/' + e.data.total);
            _bytesReceived += e.data.loaded;
            _bytesReceivedPerSecond += e.data.loaded;
            _this.dispatchEvent(MediaEvent.STATSCHANGE, { stats: { BytesReceived: _bytesReceived } });
            if (!_failed) {
                _demuxer.append(e.data.buffer);
            }
        }

        function _onLoadEnd(e) {
            _loading = false;
            if (_failed) { return; }
            if (!_demuxer.complete() || (_samples && !_samples.complete())) {
                _onDecodeError({ data: { name: 'DataError', message: 'Truncated MP4 media.' } }); return;
            }
            if (_credentialTimer !== undefined) {
                _onLoadError({ data: { name: 'NetworkError', message: 'Live media ended before the first data.' } });
                return;
            }
            _onEndOfStream(e);
            _this.forward(e);
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

        function _onFMP4Packet(e) {
            if (_failed) { return; }
            var pkt = e.data.packet, type = pkt.get('Type');
            try {
                if (type === 'ftyp') { _ftyp = pkt; }
                if (type === 'moov') {
                    _moov = pkt;
                    _this.dispatchEvent(MediaEvent.INFOCHANGE, { info: { MimeType: _demuxer.info.MimeType, Codecs: _demuxer.info.Codecs.join(','), Width: _demuxer.info.Width, Height: _demuxer.info.Height } });
                    var tracks = pkt.get('Tracks'), video = tracks.find(function (track) { return track.lengthSize; });
                    if (video) {
                        var changed = !!_hevc.configuration;
                        var audio = tracks.find(function (track) { return track.kind === 'audio'; });
                        _hevc.configure(video, !!audio);
                        if (audio) { _hevc.audio({ mime: 'audio/mp4; codecs="' + audio.codec + '"', init: Format.FMP4.merge(_ftyp ? _ftyp.payload : Format.FMP4.ftyp(), audio.init) }); }
                        _samples = new Format.FMP4.Samples(tracks, function (sample) { _hevc.append(sample); }, _this.config.hevc?.maxPacketBytes);
                        var mime = 'video/mp4; codecs="' + tracks.map(function (track) { return track.codec; }).join(',') + '"';
                        if (changed || _this.config.hevc?.mode === 'wasm' || !MediaSource.isTypeSupported(mime)) { _fallback(); }
                    }
                    if (!_hevc.active) { _addSourceBuffer(); }
                }
                if (_samples) { _samples.append(pkt); }
                if (!_hevc.active) { _segments.push(pkt.payload); _appendBuffer(); }
            } catch (error) { _onDecodeError({ data: error }); return; }

            var writer = _writer;
            if (!writer || writer.readyState === WriterState.CLOSING || writer.readyState === WriterState.END) { return; }
            try {
                if (type === 'moov') {
                    if (writer.readyState === WriterState.START) { throw { name: 'NotSupportedError', message: 'Recording initialization changed; start a new recording.' }; }
                    _recordTracks = Format.FMP4.recordingTracks(pkt.payload);
                } else if (type === 'moof' && _ftyp && _moov) {
                    if (_recordFragment) { throw { name: 'DataError', message: 'The previous recording fragment has no data body.' }; }
                    if (pkt.payload.byteLength > _saver.config.maxPendingBytes - writer.pendingBytes) {
                        throw { name: 'QuotaExceededError', message: 'The recording fragment exceeds its buffer budget.' };
                    }
                    var layout = Format.FMP4.recordingFragment(pkt.payload, _recordTracks);
                    _recordFragment = { packet: pkt, layout: layout };
                } else if (type === 'mdat' && _recordFragment) {
                    var fragment = _recordFragment;
                    if (!fragment.started) {
                        Format.FMP4.recordingBody(fragment.packet.payload, pkt.payload, fragment.layout.ranges, pkt.length);
                        fragment.started = true;
                        fragment.skip = writer.readyState === WriterState.INIT && !fragment.layout.independent;
                        if (!fragment.skip) {
                            if (writer.readyState === WriterState.INIT) { writer.start(); writer.write([_ftyp.payload, _moov.payload]); }
                            writer.write(fragment.packet.payload);
                        }
                    }
                    if (!fragment.skip) { writer.write(pkt.payload); }
                    if (pkt.get('Final')) { _recordFragment = null; }
                } else if (type === 'mdat' && writer.readyState === WriterState.START) {
                    throw { name: 'NotSupportedError', message: 'Additional mdat bodies require a different recording layout.' };
                }
            } catch (err) { writer.abort(err); }
        }

        function _onEndOfStream(e) {
            _ended = true;
            if (_hevc && _hevc.active) {
                _hevc.end();
                if (_writer) { _writer.close(); _writer = null; }
                return;
            }
            if (_ms.readyState !== 'open') {
                return;
            }
            var updating = false;
            for (var kind in _sb) {
                if (_sb[kind].updating) {
                    updating = true;
                    break;
                }
            }
            if (!updating && !_segments.length) {
                _ms.endOfStream();
                if (_writer) {
                    _writer.close();
                    _writer = null;
                }
                return;
            }
        }

        function _addSourceBuffer() {
            var type = _demuxer.info.MimeType + '; codecs="' + _demuxer.info.Codecs.join(',') + '"';
            if (MediaSource.isTypeSupported(type) === false) {
                _onDecodeError({ data: { name: 'NotSupportedError', message: type + ' is not supported.' } });
                return;
            }

            if (_ms.readyState === 'closed') {
                _this.dispatchEvent(Event.ERROR, { name: 'InvalidStateError', message: 'MediaSource is already closed while adding SourceBuffer.' });
                return;
            }

            _logger.log('Adding SourceBuffer: ' + type);
            try {
                var sb = _ms.addSourceBuffer(type);
                sb.addEventListener('updateend', _onUpdateEnd);
                sb.addEventListener('error', _onSourceBufferError);
                // sb.mode = 'sequence';
                _sb.push(sb);
            } catch (err) {
                if (!_fallback(err)) { _onDecodeError({ data: err }); }
            }

            _this.dispatchEvent(MediaEvent.INFOCHANGE, {
                info: {
                    MimeType: _demuxer.info.MimeType,
                    Codecs: _demuxer.info.Codecs.join(','),
                    Timescale: _demuxer.info.Timescale,
                }
            });
        }

        function _clearSourceBuffer() {
            utils.forEach(_sb, function (i, sb) {
                if (sb) {
                    sb.removeEventListener('updateend', _onUpdateEnd);
                    sb.removeEventListener('error', _onSourceBufferError);
                    try {
                        // The SourceBuffer may be removed already after an EncodingError occurred.
                        _ms.removeSourceBuffer(sb);
                    } catch (err) {
                        // NotFoundError: The object can not be found here.
                        _logger.warn(err.name + ': ' + err.message);
                    }
                }
            });
            _sb = [];
        }

        function _appendBuffer() {
            if (_hevc && _hevc.active) { return; }
            if (_segments.length > 0) {
                var segment = _segments[0];
                var sb = _sb[0];
                if (sb === undefined) { return; }
                if (!sb.updating) {
                    try {
                        sb.appendBuffer(segment);
                        _segments.shift();
                    } catch (err) {
                        if (!_fallback(err)) { _onDecodeError({ data: err }); }
                    }
                }
            }
        }

        function _onUpdateEnd(e) {
            if (_hevc && _hevc.active) { return; }
            _logger.debug('SourceBuffer.onupdateend');

            var ranges = _video.buffered;
            var start = ranges.length ? ranges.start(0) : 0;
            var buffered = ranges.length ? ranges.end(ranges.length - 1) : 0;
            if (_escaped === false) {
                var fudge = OS.isMac && Browser.isSafari ? .5 : 0.001;
                if (_video.currentTime < start) {
                    _video.currentTime = start + fudge;
                    _escaped = true;
                    _logger.warn('Seems stalled, seeking to the available time ' + _video.currentTime + '.');
                }
            }
            if (_buffering && _intent) {
                var buffer = buffered - _video.currentTime;
                if (buffer >= _this.config.bufferLength || (_ended && buffer > 0)) {
                    _buffering = false;
                    _this.play();
                }
            }
            if (_ended) {
                if (_ms.readyState !== 'open') {
                    return;
                }
                var updating = false;
                for (var kind in _sb) {
                    if (_sb[kind].updating) {
                        updating = true;
                        break;
                    }
                }
                if (!updating && !_segments.length) {
                    _ms.endOfStream();
                    if (_writer) {
                        _writer.close();
                        _writer = null;
                    }
                    return;
                }
            }
            if (start < _need2remove - _this.config.maxPlaybackLength) {
                var sb = e.target;
                try {
                    sb.remove(0, _need2remove - _this.config.maxPlaybackLength / 2);
                } catch (err) {
                    _logger.debug('Failed to remove ' + sb.kind + ' buffer: start=' + start + ', time=' + _video.currentTime + ', buffered=' + buffered + ', duration=' + _video.duration);
                }
                return;
            }
            _appendBuffer();
        }

        function _onSourceBufferError(err) {
            if ((_hevc && _hevc.active) || _fallback()) { return; }
            _logger.error('SourceBuffer.onerror');
            _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'SourceBuffer error occurs.' });
        }

        function _onWriterStart(e) {
            if (_writer === e.srcElement) { _this.forward(e); }
        }

        function _onWriterEnded(e) {
            if (_writer === e.srcElement) { _writer = null; }
            _this.forward(e);
        }

        function _onRemovingTimer(e) {
            if (_hevc && _hevc.active) { return; }
            _need2remove = _video.currentTime;
        }

        function _onDurationChange(e) {
            if (_hevc && _hevc.active) { return; }
            _this.dispatchEvent(Event.DURATIONCHANGE, { duration: _video.duration });
            _this.dispatchEvent(MediaEvent.INFOCHANGE, { info: { Duration: _video.duration } });
            if (_this.config.mode === 'live' && !isNaN(_this.config.maxPlaybackLength)) {
                _removingTimer.start();
            }
        }

        function _onTimeUpdate(e) {
            if (_hevc && _hevc.active) { return; }
            var ranges = _video.buffered;
            var start = ranges.length ? ranges.start(0) : 0;
            var buffered = ranges.length ? ranges.end(ranges.length - 1) : 0;
            var time = _video.currentTime;
            if (_this.config.mode === 'live' && _this.config.lowlatency) {
                var buffer = buffered - time;
                if (buffer > 5) {
                    _video.currentTime = buffered - 5;
                    time = _video.currentTime;
                }
                var rate = _getPlaybackRate(buffered - time);
                if (_video.playbackRate !== rate) {
                    _video.playbackRate = rate;
                }
            }
            _this.dispatchEvent(Event.TIMEUPDATE, {
                start: start,
                time: time,
                buffered: buffered,
                duration: _video.duration,
            });
        }

        function _getPlaybackRate(buffer) {
            switch (_video.playbackRate) {
                case 1:
                    if (buffer > _this.config.maxBufferLength) {
                        return 1.2;
                    }
                    return 1;
                default:
                    if (buffer <= _this.config.bufferLength + .1) {
                        return 1;
                    }
                    return _video.playbackRate;
            }
        }

        function _onVolumeChange(e) {
            _this.dispatchEvent(Event.VOLUMECHANGE, { muted: _video.muted, volume: _video.volume });
        }

        function _onError(e) {
            if ((_hevc && _hevc.active) || !_video.error) { return; }
            if ((_video.error.code === 3 || _video.error.code === 4) && _fallback()) { return; }
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

    FMP4.prototype = Object.create(EventDispatcher.prototype);
    FMP4.prototype.constructor = FMP4;
    FMP4.prototype.kind = 'FMP4';

    FMP4.prototype.isSupported = function (program) {
        if (Browser.isMSIE && Browser.major < 9 || !(window.MediaSource || window.WebKitMediaSource)) {
            return false;
        }
        for (var source of program.sources) {
            var url = new utils.URL(source.url);
            if (!url.protocol.match(/^(http|https|ws|wss)\:$/gi)) {
                return false;
            }
            var arr = ['.mp4', '.m4s', '.m4v', ''];
            if (arr.indexOf((url.filetype || '').toLowerCase()) === -1) {
                return false;
            }
        }
        return !!program.sources.length;
    };

    Module.register(FMP4);
})(odd);

