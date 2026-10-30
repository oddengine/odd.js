(function (odd) {
    var AV = odd.AV, utils = odd.utils, Event = odd.events.Event, MediaEvent = odd.events.MediaEvent, Dispatcher = odd.events.EventDispatcher;
    var defaults = {
        url: new URL('wasm/hevc/', document.currentScript?.src || document.baseURI).href,
        mode: 'auto',
        maxEncodedBytes: 67108864,
        maxFrameBytes: 25165824,
        maxPixels: 16777216,
        maxPacketBytes: 16777216,
        loadTimeout: 10000
    };

    function HEVCPlayback(container, nativeVideo, config, logger) {
        Dispatcher.call(this, 'HEVCPlayback', {
            logger: logger
        }, Event, MediaEvent);
        var _this = this, options = utils.extendz({}, defaults, config.hevc), cache, videoConfig, audioConfig, expectedAudio = false, fallbackReason = null;
        var canvas, renderer, worker, ready = false, busy = false, generation = 0, index = null, frames = [], timer, animation, deadline, closed = false, intent = false, state = 'idle';
        var time = 0, anchor = 0, wall = 0, started = false, seeking = false, seekTarget = 0, recovering = false, drained = false, eof = false, sentDrain = false;
        var audio, mediaSource, sourceBuffer, audioURL, audioQueue = [], audioQueuedBytes = 0, audioIndex = -1, audioGeneration = 0, audioStarting = false;
        var frameInterval = 1 / 30, decodeCost = 0, level = 0, slowSince = 0, fastSince = 0, lastJump = 0, lastReport = 0, lastDisplay = NaN, failures = 0, contextRetries = 0, contextLost = false, contextTimer, awaitRAP = false, keyOnlySequence = null, keyOnly = false, packetDeadline = 0;
        var stats = {
            Backend: 'mse',
            DecodedFrames: 0,
            DisplayedFrames: 0,
            DisplayDroppedFrames: 0,
            DependencyDroppedFrames: 0,
            LiveCatchups: 0,
            DecodeMilliseconds: 0,
            RenderMilliseconds: 0
        };
        config = utils.extendz({}, config, {
            hevc: options
        });
        cache = new AV.MediaBuffer(config);
        _this.active = false;
        [ 'maxEncodedBytes', 'maxFrameBytes', 'maxPixels', 'maxPacketBytes', 'loadTimeout' ].forEach(function(key) {
            if (!Number.isFinite(options[key]) || options[key] <= 0) {
                throw {
                    name: 'DataError',
                    message: 'Invalid HEVC ' + key
                };
            }
        });
        if (![ 'auto', 'wasm' ].includes(options.mode) || !Number.isFinite(config.bufferLength) || config.bufferLength < 0 || !Number.isFinite(config.maxBufferLength) || config.maxBufferLength <= config.bufferLength || !Number.isFinite(config.maxPlaybackLength) || config.maxPlaybackLength <= 0) {
            throw {
                name: 'TypeError',
                message: 'Invalid HEVC buffer configuration (seconds).'
            };
        }

        function _emit(type, data) {
            if (!closed) {
                _this.dispatchEvent(type, data);
            }
        }

        function _clock() {
            return !started || state !== 'playing' ? time : audioConfig && audio && !audio.ended ? audio.currentTime : anchor + (performance.now() - wall) / 1000;
        }

        function _setState(value) {
            if (state === value) {
                return;
            }
            state = value;
            if (value === 'buffering') {
                _emit(Event.WAITING);
            } else if (value === 'playing') {
                _emit(Event.PLAYING);
            } else if (value === 'paused') {
                _emit(Event.PAUSE);
            }
        }

        function _release(frame) {
            if (worker && frame.buffer?.byteLength) {
                worker.postMessage({
                    type: 'release',
                    token: frame.token,
                    buffer: frame.buffer
                }, [ frame.buffer ]);
            }
        }

        function _clearFrames() {
            frames.forEach(_release);
            frames = [];
        }

        function _freeze() {
            time = _clock();
            anchor = time;
            wall = performance.now();
            if (audio) {
                audio.pause();
            }
        }

        function _fail(reason) {
            if (closed || state === 'error') {
                return;
            }
            _freeze();
            state = 'error';
            clearTimeout(deadline);
            clearInterval(timer);
            cancelAnimationFrame(animation);
            worker?.terminate();
            worker = null;
            _clearFrames();
            _closeAudio();
            _emit(Event.ERROR, {
                name: reason.name || 'EncodingError',
                message: reason.message,
                cause: fallbackReason
            });
        }

        function _bound() {
            return cache.range(time);
        }

        function _audioEnd() {
            if (!audioConfig || !audio) {
                return Infinity;
            }
            var ranges = audio.buffered;
            for (var n = 0; n < ranges.length; n++) {
                if (time >= ranges.start(n) - .05 && time < ranges.end(n)) {
                    return ranges.end(n);
                }
            }
            return time;
        }

        function _seekAudio(position) {
            if (audio && audioConfig) {
                try {
                    audio.currentTime = Math.max(0, position);
                } catch (error) {/* Media metadata will retry this position before playing. */}
            }
        }

        // A generation owns every asynchronous decode/seek result.
        function _reset(packet, target, configuration, keepClock) {
            if (!packet || !worker) {
                return false;
            }
            if (!keepClock) {
                _freeze();
            }
            generation++;
            ready = false;
            busy = false;
            packetDeadline = 0;
            sentDrain = drained = false;
            _clearFrames();
            index = packet.sequence;
            recovering = packet.rap === 21;
            seekTarget = target;
            if (!keepClock) {
                time = target;
                anchor = time;
                started = false;
                seeking = true;
                lastDisplay = NaN;
            }
            awaitRAP = false;
            clearTimeout(deadline);
            deadline = setTimeout(function () {
                _fail({ name: 'TimeoutError', message: 'HEVC decoder reset timed out.' });
            }, options.loadTimeout);
            if (configuration) {
                videoConfig = packet.configuration;
                worker.postMessage({
                    type: 'configure',
                    generation: generation,
                    config: videoConfig.config,
                    maxPixels: options.maxPixels,
                    maxPacketBytes: options.maxPacketBytes,
                    maxFrameBytes: options.maxFrameBytes
                });
            } else {
                worker.postMessage({
                    type: 'reset',
                    generation: generation
                });
            }
            if (!keepClock) {
                _seekAudio(time);
                _setState(intent ? 'buffering' : 'paused');
            }
            return true;
        }

        function _onWorker(event) {
            var message = event.data;
            if (closed || message.generation !== generation) {
                if (message.type === 'frame') {
                    _release(message);
                }
                return;
            }
            switch (message.type) {
              case 'ready':
                clearTimeout(deadline);
                ready = true;
                _tick();
                break;

              case 'frame':
                if (!Number.isFinite(message.pts)) {
                    _release(message);
                    _fail({
                        name: 'DataError',
                        message: 'Decoded frame has no presentation timestamp.'
                    });
                    return;
                }
                failures = 0;
                stats.DecodedFrames++;
                if (!intent && !seeking) {
                    _release(message);
                    break;
                }
                frames.push(message);
                frames.sort(function(a, b) {
                    return a.pts - b.pts;
                });
                _tick();
                break;

              case 'accepted':
                busy = false;
                packetDeadline = 0;
                decodeCost = decodeCost ? decodeCost * .9 + message.cost * .1 : message.cost;
                stats.DecodeMilliseconds = decodeCost;
                stats.WasmMemoryBytes = message.memoryBytes;
                _tick();
                break;

              case 'drained':
                drained = true;
                _tick();
                break;

              case 'error':
                busy = false;
                if (++failures > 3 || /requires|budget|allocat|memory|fetch|module|load/i.test(message.message)) {
                    _fail(message);
                    return;
                }
                var next = cache.rap((cache.video(index)?.pts || time) + .001, true);
                if (next) {
                    stats.DependencyDroppedFrames += Math.max(0, next.sequence - index);
                    _reset(next, Math.max(time, next.pts), false, state === 'playing');
                } else {
                    if (eof) { _fail(message); return; }
                    ready = false;
                    index = null;
                    awaitRAP = true;
                }
                break;
            }
        }

        // Worker owns FFmpeg and its DPB; the main thread owns only display credits.
        function _openWorker() {
            worker = new Worker(new URL('odd.hevc.worker.js', new URL(options.url, document.baseURI)), {
                type: 'module'
            });
            worker.onmessage = _onWorker;
            worker.onerror = function(event) {
                _fail({
                    name: 'OperationError',
                    message: event.message || 'HEVC worker failed.'
                });
            };
            generation++;
            worker.postMessage({
                type: 'configure',
                generation: generation,
                config: videoConfig.config,
                maxPixels: options.maxPixels,
                maxPacketBytes: options.maxPacketBytes,
                maxFrameBytes: options.maxFrameBytes
            });
            deadline = setTimeout(function() {
                _fail({
                    name: 'TimeoutError',
                    message: 'HEVC decoder initialization timed out.'
                });
            }, options.loadTimeout);
        }

        // Native audio remains the master clock. No PCM queue or audio resampling here.
        function _closeAudio() {
            audioGeneration++;
            audioStarting = false;
            if (sourceBuffer) {
                sourceBuffer.removeEventListener('updateend', _pumpAudio);
                sourceBuffer.removeEventListener('error', _audioError);
            }
            if (mediaSource) {
                mediaSource.removeEventListener('sourceopen', _onAudioOpen);
            }
            if (audio) {
                audio.pause();
                audio.removeAttribute('src');
                audio.load();
                audio.remove();
            }
            if (audioURL) {
                URL.revokeObjectURL(audioURL);
            }
            audio = mediaSource = sourceBuffer = audioURL = null;
            audioQueue = [];
            audioQueuedBytes = 0;
            audioIndex = -1;
        }

        function _audioError() {
            _fail({
                name: 'EncodingError',
                message: 'HEVC audio MSE failed.'
            });
        }

        function _onAudioOpen() {
            try {
                sourceBuffer = mediaSource.addSourceBuffer(audioConfig.mime);
                sourceBuffer.addEventListener('updateend', _pumpAudio);
                sourceBuffer.addEventListener('error', _audioError);
                _enqueue(audioConfig.init);
                _pumpAudio();
            } catch (error) {
                _fail(error);
            }
        }

        function _enqueue(bytes) {
            audioQueue.push(bytes);
            audioQueuedBytes += bytes.byteLength;
            if (audioQueuedBytes > options.maxEncodedBytes) {
                throw {
                    name: 'QuotaExceededError',
                    message: 'Audio append queue exceeds budget.'
                };
            }
        }

        function _openAudio() {
            if (!_this.active || !audioConfig || audio) {
                return;
            }
            var MSE = window.MediaSource || window.WebKitMediaSource;
            if (!MSE?.isTypeSupported(audioConfig.mime)) {
                throw {
                    name: 'NotSupportedError',
                    message: 'Native audio decoding is unavailable for ' + audioConfig.mime
                };
            }
            audio = document.createElement('audio');
            audio.hidden = true;
            audio.muted = nativeVideo.muted;
            audio.volume = nativeVideo.volume;
            container.appendChild(audio);
            mediaSource = new MSE;
            mediaSource.addEventListener('sourceopen', _onAudioOpen);
            audioURL = URL.createObjectURL(mediaSource);
            audio.src = audioURL;
            audio.load();
            audio.addEventListener('ended', function(event) {
                if (closed || audio !== event.currentTarget) { return; }
                time = audio.currentTime;
                anchor = time;
                wall = performance.now();
            });
            audio.addEventListener('error', _audioError);
            audio.addEventListener('waiting', function(event) {
                if (closed || audio !== event.currentTarget) { return; }
                if (intent && started) {
                    _freeze();
                    _setState('buffering');
                }
            });
        }

        function _pumpAudio() {
            if (!sourceBuffer || sourceBuffer.updating || closed || (state === 'error' || state === 'ended')) {
                return;
            }
            try {
                var packets = cache.audio(), low = 0, high = packets.length;
                while (low < high) {
                    var middle = low + high >>> 1;
                    if (packets[middle].id <= audioIndex) {
                        low = middle + 1;
                    } else {
                        high = middle;
                    }
                }
                for (var n = low; n < packets.length; n++) {
                    var p = packets[n];
                    if (p.id > audioIndex) {
                        _enqueue(p.segment || AV.Format.FMP4.sampleSegment(p, p.id + 1));
                        audioIndex = p.id;
                    }
                }
                if (audioQueue.length) {
                    var bytes = audioQueue[0];
                    sourceBuffer.appendBuffer(bytes);
                    audioQueue.shift();
                    audioQueuedBytes -= bytes.byteLength;
                } else if (sourceBuffer.buffered.length && sourceBuffer.buffered.start(0) < time - config.maxPlaybackLength) {
                    sourceBuffer.remove(0, Math.max(0, time - config.maxPlaybackLength));
                } else if (eof && mediaSource.readyState === 'open') {
                    mediaSource.endOfStream();
                }
            } catch (error) {
                _fail(error);
            }
        }

        function _start() {
            if (!intent || state === 'playing' || !frames.length || !ready) {
                return;
            }
            var range = _bound(), available = Math.min(range.end, _audioEnd()) - time;
            if (expectedAudio && !audioConfig) {
                return;
            }
            if (available < config.bufferLength && !(eof && range.end > time && (!audioConfig || _audioEnd() > time))) {
                return;
            }
            // Before seekTarget, decoded frames are preroll, not retained history.
            while (frames.length > 1 && frames[1].pts <= seekTarget) {
                _release(frames.shift());
                stats.DisplayDroppedFrames++;
            }
            if (audioConfig) {
                if (!audio || audio.readyState < 2 || audioStarting) {
                    return;
                }
                _seekAudio(time);
                audioStarting = true;
                var current = audioGeneration;
                audio.play().then(function() {
                    if (closed || current !== audioGeneration) {
                        return;
                    }
                    audioStarting = false;
                    if (!intent) {
                        audio.pause();
                        return;
                    }
                    started = true;
                    anchor = time;
                    wall = performance.now();
                    _setState('playing');
                }).catch(function(error) {
                    if (current !== audioGeneration || closed) {
                        return;
                    }
                    audioStarting = false;
                    intent = false;
                    _setState('paused');
                    _emit(Event.ERROR, {
                        name: error.name,
                        message: error.message,
                        recoverable: true,
                        operation: 'play'
                    });
                });
            } else {
                started = true;
                anchor = time;
                wall = performance.now();
                _setState('playing');
            }
        }

        function _degrade(now) {
            var utilization = (decodeCost + stats.RenderMilliseconds) / (frameInterval * 1000);
            if (utilization > 1.1) {
                fastSince = 0;
                if (!slowSince) {
                    slowSince = now;
                }
                if (now - slowSince > 1000) {
                    level = Math.min(2, level + 1);
                    slowSince = now;
                }
            } else if (utilization < .75) {
                slowSince = 0;
                if (!fastSince) {
                    fastSince = now;
                }
                if (now - fastSince > 3e3) {
                    level = Math.max(0, level - 1);
                    fastSince = now;
                }
            } else {
                slowSince = fastSince = 0;
            }
            stats.DegradationLevel = level;
        }

        // Decode in DTS order, on demand; display drops never break codec references.
        function _feed() {
            if (!ready || busy || !worker || contextLost || !intent && !seeking || document.hidden) {
                return;
            }
            if (level === 2 && state === 'playing' && !seeking) {
                var point = cache.rap(time);
                if (point && point.sequence !== keyOnlySequence) {
                    stats.DependencyDroppedFrames += Math.max(0, point.sequence - (index || 0));
                    _reset(point, time, false, true);
                    keyOnlySequence = point.sequence;
                    keyOnly = true;
                    return;
                }
                if (!keyOnly || index !== keyOnlySequence) {
                    return;
                }
            } else if (keyOnlySequence !== null) {
                keyOnlySequence = null;
                keyOnly = false;
                var recovery = cache.rap(time);
                if (recovery) {
                    _reset(recovery, time, false, true);
                    return;
                }
            }
            if (drained) {
                return;
            }
            if (index === null) {
                var initial = cache.rap(time) || cache.rap(-Infinity, true);
                if (!initial) {
                    return;
                }
                index = initial.sequence;
                recovering = initial.rap === 21;
                time = Math.max(time, initial.pts);
                seekTarget = time;
                _seekAudio(time);
            }
            var sample = cache.video(index);
            if (!sample) {
                if (cache.first() && index < cache.first().sequence) {
                    _reset(cache.first(), cache.first().pts);
                    return;
                }
                if (eof && !sentDrain) {
                    sentDrain = true;
                    worker.postMessage({
                        type: 'drain',
                        generation: generation
                    });
                }
                return;
            }
            if (sample.configuration !== videoConfig) {
                if (!sample.rap) {
                    index++;
                    stats.DependencyDroppedFrames++;
                    return;
                }
                _reset(sample, Math.max(time, sample.pts), true);
                return;
            }
            if (recovering && sample.rasl) {
                index++;
                stats.DependencyDroppedFrames++;
                return;
            }
            if (sample.vcl && !sample.rap && !sample.rasl && !sample.radl) {
                recovering = false;
            }
            if (level === 1 && state === 'playing' && performance.now() - lastJump > 500) {
                var stale = sample.pts < time - Math.max(.15, frameInterval * 3), next = cache.rap(time, true);
                if (next && next.sequence > index && stale && next.pts <= time + .1) {
                    stats.DependencyDroppedFrames += next.sequence - index;
                    lastJump = performance.now();
                    _reset(next, time, false, true);
                    return;
                }
                if (stale && !sample.rap) {
                    return;
                }
            }
            var lead = Math.min(.1, Math.max(.02, frameInterval * 2, decodeCost / 1000 * 2));
            if (frames.length >= 3 || frames.length && frames[frames.length - 1].pts >= time + lead) {
                return;
            }
            if (state === 'playing' && sample.dts > time + lead && !seeking) {
                return;
            }
            var buffer = sample.data.slice().buffer;
            busy = true;
            packetDeadline = performance.now() + options.loadTimeout;
            index++;
            frameInterval = Math.max(.001, sample.duration || frameInterval);
            worker.postMessage({
                type: 'packet',
                generation: generation,
                id: sample.id,
                buffer: buffer,
                pts: sample.pts,
                dts: sample.dts,
                duration: sample.duration,
                keyOnly: keyOnly
            }, [ buffer ]);
        }

        // Upload at display cadence, then return the transferable YUV buffer immediately.
        function _render() {
            if (!renderer || contextLost || !intent && !seeking || !frames.length || document.hidden) {
                return;
            }
            if (seeking) {
                while (frames.length && frames[0].pts < seekTarget - .005) {
                    _release(frames.shift());
                    stats.SeekPrerollDroppedFrames = (stats.SeekPrerollDroppedFrames || 0) + 1;
                }
            }
            var chosen = null;
            while (frames.length && frames[0].pts <= time + .005) {
                if (chosen) {
                    _release(chosen);
                    stats.DisplayDroppedFrames++;
                }
                chosen = frames.shift();
            }
            if (!chosen && seeking && frames[0]?.pts >= seekTarget && state !== 'playing') {
                chosen = frames.shift();
                time = Math.max(time, chosen.pts);
            }
            if (!chosen) {
                return;
            }
            try {
                var before = performance.now();
                renderer.draw(chosen);
                stats.RenderMilliseconds = performance.now() - before;
                stats.DisplayedFrames++;
                lastDisplay = chosen.pts;
            } finally {
                _release(chosen);
            }
            if (seeking) {
                seeking = false;
                if (!intent) {
                    _clearFrames();
                }
                _emit(Event.SEEKED);
                _emit(Event.CANPLAY);
            }
        }

        // Buffering is for missing media; slow decoding degrades video without stopping the clock.
        function _tick() {
            if (closed || !_this.active || (state === 'error' || state === 'ended')) {
                return;
            }
            try {
                var now = performance.now();
                if (packetDeadline && now > packetDeadline) {
                    throw {
                        name: 'TimeoutError',
                        message: 'HEVC access unit decoding timed out.'
                    };
                }
                time = _clock();
                var range = _bound();
                cache.prune(time, true);
                range = _bound();
                // A timestamp gap is not buffered media. Resume only at a new
                // random access point with the normal startup reserve.
                if (intent && started && range.start > time + .05) {
                    var nextRange = cache.rap(range.start, true);
                    if (nextRange && (range.end - nextRange.pts >= config.bufferLength || eof)) {
                        _reset(nextRange, nextRange.pts);
                    } else { _freeze(); _setState('buffering'); }
                    return;
                }
                if (eof && drained && !stats.DecodedFrames) {
                    throw { name: 'EncodingError', message: 'HEVC decoder produced no pictures.' };
                }
                _pumpAudio();
                if (intent && state === 'playing' && time >= range.end - .001 && !eof) {
                    _freeze();
                    time = Math.min(time, range.end);
                    _setState('buffering');
                }
                if (config.mode === 'live' && intent && range.end - time > config.maxBufferLength && now - lastJump > 1000) {
                    var reserve = config.bufferLength + .15, target = cache.rap(range.end - reserve);
                    if (target && target.pts > time + .1 && range.end - target.pts >= reserve) {
                        stats.LiveCatchups++;
                        lastJump = now;
                        _reset(target, target.pts);
                    }
                }
                _start();
                _degrade(now);
                _feed();
                if (eof && drained && !frames.length && time >= range.end - .02 && (!audioConfig || audio?.ended || time >= _audioEnd() - .02)) {
                    _freeze();
                    time = range.end;
                    intent = false;
                    _setState('ended');
                    _emit(Event.ENDED);
                }
                if (now - lastReport >= 250) {
                    lastReport = now;
                    _emit(Event.TIMEUPDATE, {
                        start: range.start,
                        time: time,
                        buffered: range.end,
                        duration: eof ? range.end : Infinity
                    });
                    _emit(MediaEvent.STATSCHANGE, {
                        stats: Object.assign({}, stats, {
                            EncodedBytes: cache.bytes(),
                            ReadyFrames: frames.length,
                            ReadyFrameBytes: frames.reduce(function(sum, f) {
                                return sum + f.buffer.byteLength;
                            }, 0)
                        })
                    });
                }
            } catch (error) {
                _fail(error);
            }
        }

        function _animate() {
            if (closed || state === 'error') {
                return;
            }
            try {
                _render();
            } catch (error) {
                _fail(error);
                return;
            }
            animation = requestAnimationFrame(_animate);
        }

        function _visibility() {
            if (document.hidden) { packetDeadline = 0; _clearFrames(); return; }
            if (!document.hidden && _this.active && intent) {
                var packet = cache.rap(_clock());
                if (packet) {
                    _reset(packet, _clock(), false, state === 'playing');
                }
            }
        }
        document.addEventListener('visibilitychange', _visibility);

        _this.configure = function(configuration, hasAudio) {
            videoConfig = videoConfig || configuration;
            _this.configuration = configuration;
            expectedAudio = !!hasAudio;
            _emit(MediaEvent.INFOCHANGE, { info: { Codecs: configuration.codec, Width: configuration.width, Height: configuration.height } });
        };

        _this.audio = function(configuration) {
            audioConfig = configuration;
            expectedAudio = true;
            if (_this.active) {
                _openAudio();
            }
        };

        _this.append = function(sample) {
            if (closed) {
                return;
            }
            if (sample.track.kind === 'video') {
                sample.configuration = _this.configuration;
            }
            cache.append(sample);
            if (awaitRAP && sample.rap) {
                _reset(sample, Math.max(_clock(), sample.pts), false, state === 'playing');
            }
            cache.prune(_this.active ? _clock() : nativeVideo.currentTime, !!_this.configuration);
            if (_this.active) {
                _tick();
            }
        };

        _this.activate = function(position, playing, reason) {
            if (_this.active || closed) {
                return;
            }
            _this.active = true;
            intent = playing;
            time = Number.isFinite(position) ? position : 0;
            seekTarget = time;
            seeking = true;
            stats.Backend = 'wasm';
            fallbackReason = reason || null;
            nativeVideo.pause();
            nativeVideo.hidden = true;
            canvas = document.createElement('canvas');
            canvas.className = 'odd-hevc-canvas';
            canvas.style.cssText = 'width:100%;height:100%;object-fit:contain;display:block';
            container.appendChild(canvas);
            try {
                renderer = new AV.YUV(canvas);
                _openWorker();
                _openAudio();
                timer = setInterval(_tick, 10);
                animation = requestAnimationFrame(_animate);
                _setState(intent ? 'buffering' : 'paused');
                _emit(MediaEvent.INFOCHANGE, {
                    info: {
                        VideoDecoder: 'FFmpeg 7.0.1 WASM'
                    }
                });
            } catch (error) {
                _fail(error);
            }
            canvas.addEventListener('webglcontextlost', function(event) {
                if (closed) { return; }
                event.preventDefault();
                if (++contextRetries > 1) {
                    _fail({
                        name: 'OperationError',
                        message: 'HEVC rendering context repeatedly lost.'
                    });
                    return;
                }
                contextLost = true;
                _clearFrames();
                contextTimer = setTimeout(function() {
                    _fail({
                        name: 'TimeoutError',
                        message: 'HEVC rendering context did not recover.'
                    });
                }, options.loadTimeout);
            });
            canvas.addEventListener('webglcontextrestored', function() {
                if (closed) { return; }
                try {
                    clearTimeout(contextTimer);
                    contextLost = false;
                    renderer = new AV.YUV(canvas);
                    var packet = cache.rap(time) || cache.rap(-Infinity, true);
                    if (packet) {
                        _reset(packet, time);
                    }
                } catch (error) {
                    _fail(error);
                }
            });
        };

        _this.play = function() {
            intent = true;
            _emit(Event.PLAY);
            if (state === 'paused') {
                var packet = cache.rap(time);
                if (packet) {
                    _reset(packet, time);
                } else {
                    _setState('buffering');
                }
            }
            if (audio) {
                audio.play().then(function() {
                    if (state !== 'playing') {
                        audio.pause();
                    }
                }).catch(function() {});
            }
            _tick();
        };

        _this.pause = function() {
            intent = false;
            packetDeadline = 0;
            _freeze();
            _setState('paused');
        };

        _this.seek = function(value) {
            var range = _bound();
            if (!Number.isFinite(value) || value < range.start || value > range.end) {
                _emit(Event.ERROR, {
                    name: 'IndexSizeError',
                    message: 'Seek target is outside the compressed buffer.',
                    recoverable: true,
                    operation: 'seek'
                });
                return;
            }
            var packet = cache.rap(value);
            if (packet) {
                _emit(Event.SEEKING);
                _reset(packet, value);
                _tick();
            }
        };

        _this.end = function() {
            eof = true;
            if (_this.active && (!cache.first() || awaitRAP || (expectedAudio && (!audioConfig || !cache.audio().length)))) {
                _fail({
                    name: 'DataError',
                    message: 'HEVC stream ended without the required video/audio data.'
                });
                return;
            }
            _emit(Event.DURATIONCHANGE, {
                duration: cache.range(time).end
            });
            _tick();
        };

        _this.position = function() {
            return {
                time: _clock(),
                rate: 1
            };
        };

        _this.frame = function() {
            return Number.isFinite(lastDisplay) ? {
                source: canvas,
                width: canvas.width,
                height: canvas.height
            } : null;
        };

        _this.muted = function(value) {
            if (audio && typeof value === 'boolean') {
                audio.muted = value;
            }
            return audio ? audio.muted : nativeVideo.muted;
        };

        _this.volume = function(value) {
            if (audio && typeof value === 'number') {
                audio.volume = value;
            }
            return audio ? audio.volume : nativeVideo.volume;
        };

        _this.wait = function(signal) {
            function available() {
                return closed || state === 'error' || !_this.configuration || config.mode !== 'vod' || eof || cache.range(_this.active ? _clock() : nativeVideo.currentTime).end - (_this.active ? _clock() : nativeVideo.currentTime) < config.maxBufferLength;
            }
            if (available()) {
                return Promise.resolve();
            }
            return new Promise(function(resolve) {
                var check;
                function finish() {
                    clearTimeout(check);
                    signal?.removeEventListener('abort', finish);
                    resolve();
                }
                function poll() {
                    if (available() || signal?.aborted) {
                        finish();
                    } else {
                        check = setTimeout(poll, 100);
                    }
                }
                signal?.addEventListener('abort', finish, {
                    once: true
                });
                poll();
            });
        };

        _this.destroy = function() {
            if (closed) {
                return;
            }
            closed = true;
            document.removeEventListener('visibilitychange', _visibility);
            clearInterval(timer);
            cancelAnimationFrame(animation);
            clearTimeout(deadline);
            clearTimeout(contextTimer);
            worker?.terminate();
            worker = null;
            frames = [];
            _closeAudio();
            renderer?.destroy();
            canvas?.remove();
            cache.clear();
        };
    }
    HEVCPlayback.prototype = Object.create(Dispatcher.prototype);
    HEVCPlayback.prototype.constructor = HEVCPlayback;
    HEVCPlayback.defaults = defaults;
    AV.HEVCPlayback = HEVCPlayback;
})(odd);
