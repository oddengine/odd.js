(function (odd) {
    var utils = odd.utils,
        css = utils.css,
        WriterState = utils.StreamWriter.WriterState,
        StreamSaver = utils.StreamSaver,
        OS = odd.OS,
        Browser = odd.Browser,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        IOEvent = events.IOEvent,
        MediaEvent = events.MediaEvent,
        MediaStreamTrackEvent = events.MediaStreamTrackEvent,
        SaverEvent = events.SaverEvent,
        TimerEvent = events.TimerEvent,
        IO = odd.IO,
        AMF = utils.AMF,
        AV = odd.AV,
        Packet = AV.Packet,
        Codec = AV.Codec,
        Format = AV.Format,
        MediaStreamTrack = Format.MediaStreamTrack,
        Formats = Format.FLV.Formats,
        Codecs = Format.FLV.Codecs,
        Module = odd.Module;

    function FLV(config, logger) {
        EventDispatcher.call(this, 'FLV', { logger: logger }, Event, IOEvent);

        var _this = this,
            _logger = logger,
            _ready,
            _escaped,
            _buffering,
            _ended,
            _video,
            _url,
            _ms,
            _sb,
            _loader,
            _demuxer,
            _remuxer,
            _segments,
            _saver,
            _writer,
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
            _escaped = false;
            _buffering = false;
            _ended = false;
            _url = new utils.URL();
            _sb = {};
            _segments = [];
            _writer = null;
            _need2remove = 0;
            _saver = new StreamSaver(_this.config.service, _logger);
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

            _video = utils.createElement('video');
            _video.addEventListener('play', _onPlay);
            _video.addEventListener('waiting', _onWaiting);
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
            _video.addEventListener('pause', _onPause);
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
            _demuxer = new Format.FLV(_logger);
            _demuxer.addEventListener(MediaEvent.PACKET, _onFLVPacket);
            _demuxer.addEventListener(MediaStreamTrackEvent.ADDTRACK, _onAddTrack);
            _demuxer.addEventListener(MediaStreamTrackEvent.REMOVETRACK, _onRemoveTrack);
            _demuxer.addEventListener(Event.ERROR, _this.forward);

            _remuxer = new Format.FMP4(_logger);
            _remuxer.addEventListener(Event.ERROR, _this.forward);
        }

        function _cleanupMuxer() {
            _demuxer.close();
            _demuxer.removeEventListener(MediaEvent.PACKET, _onFLVPacket);
            _demuxer.removeEventListener(MediaStreamTrackEvent.ADDTRACK, _onAddTrack);
            _demuxer.removeEventListener(MediaStreamTrackEvent.REMOVETRACK, _onRemoveTrack);
            _demuxer.removeEventListener(Event.ERROR, _this.forward);

            _remuxer.close();
            _remuxer.removeEventListener(Event.ERROR, _this.forward);
        }

        _this.setup = function () {
            if (_ready === false) {
                function handler() {
                    _ready = true;
                    _this.dispatchEvent(Event.READY, { kind: _this.kind });
                }
                if (_this.config.service.enable) {
                    _saver.register().then(handler).catch(function (err) {
                        _this.dispatchEvent(Event.ERROR, err);
                    });
                } else {
                    handler();
                }
            }
        };

        _this.play = function (file, option) {
            if (_ready === false) {
                _this.setup();
                return;
            }
            if (utils.typeOf(file) === 'string' && new utils.URL(file).href !== _url.href) {
                try {
                    _logger.log('URL: ' + file);
                    _url.parse(file);
                } catch (err) {
                    _logger.error('Failed to parse url \"' + file + '\".');
                    _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
                    return;
                }
                _ended = false;
                _demuxer.reset();
                _remuxer.reset();
                _remuxer.info = _demuxer.info;
                _initLoader(option || {});
                _this.dispatchEvent(Event.DURATIONCHANGE, { duration: NaN });
                _video.src = URL.createObjectURL(_ms);
                _video.load();
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
            _removingTimer.reset();
            _statsTimer.reset();
            if (_loader) {
                _loader.abort();
            }
            if (_writer) {
                _writer.close();
                _writer = null;
            }
            _clearSourceBuffer();
            _escaped = false;
            _buffering = false;
            _ended = false;
            _segments = [];
            _need2remove = 0;
            _url = new utils.URL();
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

        _this.record = function (filename) {
            function handler() {
                if (_ended) {
                    return Promise.reject('Failed to record stream, the download already ended.');
                }
                var writer = _saver.record(filename);
                _swapWriter(writer, !isNaN(_firstAudioFrameReceivedIn) || !isNaN(_firstVideoFrameReceivedIn));
                return Promise.resolve(_writer);
            }
            if (_this.config.service.enable) {
                return handler();
            } else {
                return _saver.register().then(handler);
            }
        };

        _this.element = function () {
            return _video;
        };

        _this.destroy = function () {
            _this.stop();
            _ready = false;
            _saver.removeEventListener(SaverEvent.WRITERSTART, _onWriterStart);
            _saver.removeEventListener(SaverEvent.WRITEREND, _onWriterEnded);
            _removingTimer.removeEventListener(TimerEvent.TIMER, _onRemovingTimer);
            _cleanupMSE();
            _cleanupMuxer();
            _cleanupLoader();
        };

        function _onPlay(e) {
            _sourceTimer.reset();
            _this.forward(e);
        }

        function _onWaiting(e) {
            if (_this.config.bufferLength > .1) {
                _buffering = true;
                _this.pause();
            }
            _this.forward(e);
        }

        function _onPause(e) {
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
            _loader.load(_url);
        }

        function _onSourceEnded(e) {
            _logger.log('MediaSource.onsourceended');
            if (_buffering) {
                _sourceTimer.start();
            }
        }

        function _onSourceClose(e) {
            _logger.log('MediaSource.onsourceclose');
            _sourceTimer.reset();
        }

        function _onSourceTimer(e) {
            if (_buffering) {
                _logger.warn('Seems stalled, stop playing manually.');
                _this.stop();
            }
        }

        function _onSourceError(e) {
            _logger.log('MediaSource.onsourceerror');
            _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
        }

        function _initLoader(option) {
            _cleanupLoader();

            var Loader;
            if (option.loader && option.loader.name !== 'auto') {
                Loader = IO[option.loader.name];
            }
            if (Loader == null || !Loader.prototype.isSupported(_url, _this.config.mode)) {
                Loader = odd.io(_url, _this.config.mode);
            }
            if (Loader == null) {
                throw { name: 'NotSupportedError', message: 'No supported io found.' };
            }

            _loader = new Loader(option.loader, _logger);
            _loader.addEventListener(IOEvent.LOADSTART, _this.forward);
            _loader.addEventListener(IOEvent.OPEN, _this.forward);
            _loader.addEventListener(IOEvent.STALLED, _this.forward);
            _loader.addEventListener(IOEvent.ABORT, _onIOAbort);
            _loader.addEventListener(IOEvent.TIMEOUT, _this.forward);
            _loader.addEventListener(IOEvent.PROGRESS, _onIOProgress);
            _loader.addEventListener(IOEvent.SUSPEND, _this.forward);
            _loader.addEventListener(IOEvent.LOAD, _this.forward);
            _loader.addEventListener(IOEvent.LOADEND, _onLoadEnd);
            _loader.addEventListener(Event.ERROR, _this.forward);
            _logger.log(_loader.kind + ' loader initialized.');
        }

        function _cleanupLoader() {
            if (_loader) {
                _loader.removeEventListener(IOEvent.LOADSTART, _this.forward);
                _loader.removeEventListener(IOEvent.OPEN, _this.forward);
                _loader.removeEventListener(IOEvent.STALLED, _this.forward);
                _loader.removeEventListener(IOEvent.ABORT, _onIOAbort);
                _loader.removeEventListener(IOEvent.TIMEOUT, _this.forward);
                _loader.removeEventListener(IOEvent.PROGRESS, _onIOProgress);
                _loader.removeEventListener(IOEvent.SUSPEND, _this.forward);
                _loader.removeEventListener(IOEvent.LOAD, _this.forward);
                _loader.removeEventListener(IOEvent.LOADEND, _onLoadEnd);
                _loader.removeEventListener(Event.ERROR, _this.forward);
                _loader.abort();
            }
        }

        function _onIOProgress(e) {
            _logger.debug('progress: ' + e.data.loaded + '/' + e.data.total);
            _bytesReceived += e.data.loaded;
            _bytesReceivedPerSecond += e.data.loaded;
            _this.dispatchEvent(MediaEvent.STATSUPDATE, { stats: { BytesReceived: _bytesReceived } });
            _demuxer.append(e.data.buffer);
        }

        function _onLoadEnd(e) {
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
            _this.dispatchEvent(MediaEvent.STATSUPDATE, { stats: stats });
            _bytesReceivedPerSecond = 0;
            _audioPacketsReceivedPerSecond = 0;
            _videoPacketsReceivedPerSecond = 0;
        }

        function _onIOAbort(e) {
            e.type = Event.ENDED;
            _this.forward(e);
        }

        function _onFLVPacket(e) {
            var pkt = e.data.packet;
            // _logger.log(pkt.kind + ': ' + pkt.timestamp);
            switch (pkt.kind) {
                case Packet.KindVideo:
                    if (pkt.get('Codec') !== Codecs.AVC) {
                        _this.dispatchEvent(Event.ERROR, { name: 'NotSupportedError', message: 'Video codec ' + utils.hex(pkt.get('Codec')) + ' not supported.' });
                        return;
                    }
                    var track = _demuxer.getVideoTracks()[0];
                    if (pkt.get('DataType') === Codec.AVC.DataTypes.SEQUENCE_HEADER) {
                        if (track) {
                            _logger.warn('Video track already exists, ignored.');
                            return;
                        }
                        var source = new Codec['AVC'](_demuxer.info, _logger);
                        track = new MediaStreamTrack(MediaStreamTrack.KindVideo, source, _logger);
                        _demuxer.addTrack(track);
                    } else if (pkt.timestamp > 0 && pkt.timestamp <= _demuxer.info.VideoTimestamp) {
                        // _logger.warn('Unordered video packet: ' + pkt.timestamp + ' <= ' + _demuxer.info.VideoTimestamp);
                        // return;
                    }
                    _videoPacketsReceivedPerSecond++;
                    track.source.parse(pkt);
                    if (isNaN(_firstVideoFrameReceivedIn) && pkt.get('DataType') === Codec.AVC.DataTypes.NALU) {
                        if (_writer && isNaN(_firstAudioFrameReceivedIn)) {
                            _writeInitSegment();
                        }
                        _firstVideoFrameReceivedIn = new Date().getTime() - _loadStartAt.getTime();
                        _this.dispatchEvent(MediaEvent.STATSUPDATE, { stats: { FirstVideoFrameReceivedIn: _firstVideoFrameReceivedIn } });
                    }
                    break;

                case Packet.KindAudio:
                    if (pkt.get('Format') !== Formats.AAC) {
                        _this.dispatchEvent(Event.ERROR, { name: 'NotSupportedError', message: 'Audio format ' + utils.hex(pkt.get('Format')) + ' not supported.' });
                        return;
                    }
                    var track = _demuxer.getAudioTracks()[0];
                    if (pkt.get('DataType') === Codec.AAC.DataTypes.SPECIFIC_CONFIG) {
                        if (track) {
                            _logger.warn('Audio track already exists, ignored.');
                            return;
                        }
                        var source = new Codec['AAC'](_demuxer.info, _logger);
                        track = new MediaStreamTrack(MediaStreamTrack.KindAudio, source, _logger);
                        _demuxer.addTrack(track);
                    } else if (pkt.timestamp > 0 && pkt.timestamp <= _demuxer.info.AudioTimestamp) {
                        // _logger.warn('Drops unordered audio packet: ' + pkt.timestamp + ' <= ' + _demuxer.info.AudioTimestamp);
                        // return;
                    }
                    _audioPacketsReceivedPerSecond++;
                    track.source.parse(pkt);
                    if (isNaN(_firstAudioFrameReceivedIn) && pkt.get('DataType') === Codec.AAC.DataTypes.RAW_FRAME_DATA) {
                        if (_writer && isNaN(_firstVideoFrameReceivedIn)) {
                            _writeInitSegment();
                        }
                        _firstAudioFrameReceivedIn = new Date().getTime() - _loadStartAt.getTime();
                        _this.dispatchEvent(MediaEvent.STATSUPDATE, { stats: { FirstAudioFrameReceivedIn: _firstAudioFrameReceivedIn } });
                    }
                    break;

                case Packet.KindScript:
                    var v = new AMF.Value();
                    var i = AMF.decode(v, pkt.payload.buffer, pkt.position);
                    v.key = v.get();
                    i += AMF.decode(v, pkt.payload.buffer, pkt.position + i);

                    var data = {};
                    utils.forEach(v.get(), function (i, item) { data[item.key] = item.get(); });
                    _logger.log(v.key + ':', data);
                    if (v.key === 'onMetaData') {
                        _setMetaData(v);
                    }
                    break;

                default:
                    _logger.error('Unrecognized flv tag ' + utils.hex(pkt.kind) + '.');
                    break;
            }
        }

        function _onAddTrack(e) {
            var track = e.data.track.clone();
            track.source.addEventListener(MediaEvent.AVC_CONFIG_RECORD, _onAVCConfigRecord);
            track.source.addEventListener(MediaEvent.AAC_SPECIFIC_CONFIG, _onAACSpecificConfig);
            track.source.addEventListener(MediaEvent.AVC_SAMPLE, _onAVCSample);
            track.source.addEventListener(MediaEvent.AAC_SAMPLE, _onAACSample);
            track.source.addEventListener(MediaEvent.SEI, _this.forward);
            track.source.addEventListener(MediaEvent.END_OF_STREAM, _onEndOfStream);
            track.source.addEventListener(Event.ERROR, _this.forward);
            _remuxer.addTrack(track);
        }

        function _onRemoveTrack(e) {
            var track = _remuxer.getTrackById(e.data.track.id);
            track.source.removeEventListener(MediaEvent.AVC_CONFIG_RECORD, _onAVCConfigRecord);
            track.source.removeEventListener(MediaEvent.AAC_SPECIFIC_CONFIG, _onAACSpecificConfig);
            track.source.removeEventListener(MediaEvent.AVC_SAMPLE, _onAVCSample);
            track.source.removeEventListener(MediaEvent.AAC_SAMPLE, _onAACSample);
            track.source.removeEventListener(MediaEvent.SEI, _this.forward);
            track.source.removeEventListener(MediaEvent.END_OF_STREAM, _onEndOfStream);
            track.source.removeEventListener(Event.ERROR, _this.forward);
            track.stop();
            _remuxer.removeTrack(track);
        }

        function _setMetaData(v) {
            var info = {
                MimeType: _demuxer.info.MimeType,
                Codecs: _demuxer.info.Codecs.join(', '),
                Timescale: _demuxer.info.Timescale,
            };
            var hash = {
                duration: 'Duration',
                fileSize: 'FileSize',
                width: 'Width',
                height: 'Height',
                framerate: 'FrameRate',
                audiodatarate: 'AudioDataRate',
                videodatarate: 'VideoDataRate',
                audiosamplerate: 'SampleRate',
                audiosamplesize: 'SampleSize',
                audiochannels: 'Channels',
                stereo: 'Stereo',
                encoder: 'Encoder',
            };
            utils.forEach(v.table, function (key, value) {
                var hashed = hash[key];
                if (hashed) {
                    switch (hashed) {
                        case 'FrameRate':
                            if (v.table[key].get()) {
                                _demuxer.info.FrameRate.Num = v.table[key].get();
                                _demuxer.info.FrameRate.Den = 1;
                            }
                            break;
                        default:
                            _demuxer.info[hashed] = v.table[key].get();
                            break;
                    }
                    info[hashed] = v.table[key].get();
                }
            });
            _this.dispatchEvent(MediaEvent.INFOCHANGE, { info: info });
        }

        function _onAVCConfigRecord(e) {
            var track = _remuxer.getVideoTracks()[0];
            _addSourceBuffer(track);

            var segment = _remuxer.getInitSegment(track);
            segment.kind = track.kind;
            _segments.push(segment);
            _appendBuffer();
        }

        function _onAACSpecificConfig(e) {
            var track = _remuxer.getAudioTracks()[0];
            _addSourceBuffer(track);

            var segment = _remuxer.getInitSegment(track);
            segment.kind = track.kind;
            _segments.push(segment);
            _appendBuffer();
        }

        function _onAVCSample(e) {
            var track = _remuxer.getVideoTracks()[0];
            if (_demuxer.hasAudio && !_demuxer.hasVideo) {
                _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Video sample arrived unexpectedly.' });
                return;
            }

            var segment = _remuxer.getSegment(track, e.data.packet);
            segment.kind = track.kind;
            _segments.push(segment);
            _appendBuffer();

            if (_writer) {
                if (_writer.readyState === WriterState.INIT && e.data.packet.get('Keyframe')) {
                    _writer.start();
                }
                _writer.write(segment);
            }
        }

        function _onAACSample(e) {
            var track = _remuxer.getAudioTracks()[0];
            if (_demuxer.hasVideo && !_demuxer.hasAudio) {
                _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Audio sample arrived unexpectedly.' });
                return;
            }

            var segment = _remuxer.getSegment(track, e.data.packet);
            segment.kind = track.kind;
            _segments.push(segment);
            _appendBuffer();

            if (_writer) {
                _writer.write(segment);
            }
        }

        function _onEndOfStream(e) {
            _ended = true;
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

        function _addSourceBuffer(track) {
            // These flags may be both false. If so, the flv info frames should be ahead of any sample frames.
            if (_demuxer.hasAudio || _demuxer.hasVideo) {
                // Ignore this track while the flag indicates false clearly.
                if (!_demuxer.hasAudio && track.kind === MediaStreamTrack.KindAudio || !_demuxer.hasVideo && track.kind === MediaStreamTrack.KindVideo) {
                    return;
                }
            }

            var source = track.source;
            var type = source.MimeType + '; codecs="' + source.Codec + '"';
            if (MediaSource.isTypeSupported(type) === false) {
                _logger.warn(type + ' not supported!');
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
                sb.kind = track.kind;
                _sb[sb.kind] = sb;
            } catch (err) {
                _logger.error(err.name + ': ' + err.message);
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
            utils.forEach(_sb, function (kind, sb) {
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
                _sb[kind] = undefined;
            });
        }

        function _appendBuffer() {
            // These flags may be both false. If so, the flv info frames should be ahead of any sample frames.
            if (_demuxer.hasAudio || _demuxer.hasVideo) {
                // Make sure that the init segments will be appended before any sample segments.
                if (_demuxer.hasAudio && !_sb[MediaStreamTrack.KindAudio] || _demuxer.hasVideo && !_sb[MediaStreamTrack.KindVideo]) {
                    return;
                }
            }

            if (_segments.length > 0) {
                var segment = _segments[0];
                var sb = _sb[segment.kind];
                if (sb === undefined) {
                    _segments.shift();
                    _appendBuffer();
                    return;
                }
                if (!sb.updating) {
                    try {
                        sb.appendBuffer(segment);
                        _segments.shift();
                    } catch (err) {
                        _logger.debug(err.name + ': ' + err.message);
                    }
                }
            }
        }

        function _onUpdateEnd(e) {
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
            if (_buffering) {
                var buffer = buffered - _video.currentTime;
                if (buffer >= _this.config.bufferLength) {
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
            _logger.error('SourceBuffer.onerror');
            _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'SourceBuffer error occurs.' });
        }

        function _swapWriter(writer, isReady) {
            if (_writer !== writer) {
                if (_writer) {
                    _writer.close();
                }
                _writer = writer;
                if (_writer && isReady) {
                    _writeInitSegment();
                }
            }
        }

        function _writeInitSegment() {
            var tracks = _remuxer.getTracks();
            var segment = _remuxer.getInitSegment.apply(_remuxer, tracks);
            _writer.write(segment);
        }

        function _onWriterStart(e) {
            _swapWriter(e.srcElement, !isNaN(_firstAudioFrameReceivedIn) || !isNaN(_firstVideoFrameReceivedIn));
            _this.forward(e);
        }

        function _onWriterEnded(e) {
            _writer = null;
            _this.forward(e);
        }

        function _onRemovingTimer(e) {
            _need2remove = _video.currentTime;
        }

        function _onDurationChange(e) {
            _this.dispatchEvent(Event.DURATIONCHANGE, { duration: _video.duration });
            _this.dispatchEvent(MediaEvent.INFOCHANGE, { info: { Duration: _video.duration } });
            if (_this.config.mode === 'live' && !isNaN(_this.config.maxPlaybackLength)) {
                _removingTimer.start();
            }
        }

        function _onTimeUpdate(e) {
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

    FLV.prototype = Object.create(EventDispatcher.prototype);
    FLV.prototype.constructor = FLV;
    FLV.prototype.kind = 'FLV';

    FLV.prototype.isSupported = function (file, mode) {
        if (Browser.isMSIE && Browser.major < 9 || !(window.MediaSource || window.WebKitMediaSource)) {
            return false;
        }
        var url = new utils.URL(file);
        if (url.protocol !== 'http:' && url.protocol !== 'https:' && url.protocol !== 'ws:' && url.protocol !== 'wss:') {
            return false;
        }
        var map = [
            'flv', '', undefined,
        ];
        for (var i = 0; i < map.length; i++) {
            if (url.filetype === map[i]) {
                return true;
            }
        }
        return false;
    };

    Module.register(FLV);
})(odd);

