(function (odd) {
    var _levels = { off: 0, error: 1, warn: 2, info: 3, debug: 4, trace: 5 },
        _tiers = { basic: 1, standard: 2, detailed: 3 },
        _default = { enabled: false, level: 'standard', endpoint: '', samplePercent: 100, maxEvents: 512,
            maxBytes: 524288, batchSize: 32, flushInterval: 1000, timeout: 3000 },
        _fields = {
            'session.start': [],
            'session.ready': ['durationMs'],
            'session.error': ['durationMs', 'errorCode'],
            'session.close': ['durationMs', 'outcome', 'firstFrame'],
            'media.first_frame': ['durationMs'],
            'playback.window': ['intervalMs', 'activeMs', 'bufferingMs', 'bufferingStarts', 'bufferMs', 'frames', 'dropped'],
            'transport.state': ['state'],
            'im.publish': ['durationMs', 'outcome', 'errorCode'],
            'media.window': ['intervalMs', 'stream', 'kind', 'direction', 'bytes', 'packets', 'lost', 'rttMs',
                'jitterMs', 'frames', 'dropped', 'freezes', 'freezeMs', 'concealedSamples', 'samples',
                'jitterBufferMs', 'nack', 'pli'],
            'collector.health': ['accepted', 'filtered', 'sampled', 'dropped', 'queueEvents', 'queueBytes', 'sent', 'failed'],
        };

    function _clock() { return performance.now(); }
    function _id() {
        var bytes = new Uint8Array(16);
        crypto.getRandomValues(bytes);
        return Array.prototype.map.call(bytes, function (n) { return ('0' + n.toString(16)).slice(-2); }).join('');
    }

    function Quality() {
        var _this = this,
            _config = Object.assign({}, _default),
            _normal = [], _urgent = [], _bytes = 0, _normalBytes = 0,
            _timer = null, _pending = null, _generation = 0, _sequence = 0,
            _boot = '', _sink = null, _healthAt = 0,
            _counts = { accepted: 0, filtered: 0, sampled: 0, dropped: 0, sent: 0, failed: 0 };

        _this.setup = function (config, sink) {
            var next = Object.assign({}, _default, config),
                bounds = { samplePercent: [0, 100], maxEvents: [64, 4096], maxBytes: [65536, 4194304],
                    batchSize: [1, 64], flushInterval: [100, 10000], timeout: [100, 10000] };
            if (typeof next.enabled !== 'boolean' || !Object.prototype.hasOwnProperty.call(_tiers, next.level)) { throw new TypeError('Invalid quality level.'); }
            Object.keys(bounds).forEach(function (key) {
                if (!Number.isInteger(next[key]) || next[key] < bounds[key][0] || next[key] > bounds[key][1]) {
                    throw new TypeError('Invalid quality limit: ' + key);
                }
            });
            if (next.batchSize > next.maxEvents) { throw new TypeError('Invalid quality batch size.'); }
            if (next.enabled && !sink) {
                var endpoint = new URL(next.endpoint, location.href);
                if (!next.endpoint || endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
                    (endpoint.protocol !== 'https:' && !(endpoint.protocol === 'http:' &&
                     ['localhost', '127.0.0.1', '[::1]'].indexOf(endpoint.hostname) >= 0))) {
                    throw new TypeError('Quality requires a trusted HTTPS endpoint.');
                }
                next.endpoint = endpoint.href;
                sink = function (events, signal) {
                    return fetch(next.endpoint, { method: 'POST', mode: 'cors', credentials: 'omit', redirect: 'error',
                        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: events }), signal: signal,
                    }).then(function (response) {
                        if (!response.ok) { throw new Error('Quality batch rejected.'); }
                    });
                };
            }
            if (sink && typeof sink !== 'function') { throw new TypeError('Quality sink must be a function.'); }
            // Complete validation first. Reconfiguration invalidates old timers,
            // scopes and in-flight completions without affecting SDK sessions.
            _this.close();
            _config = next;
            _sink = sink;
            if (next.enabled) {
                _boot = _id();
                _timer = setInterval(_this.flush, next.flushInterval);
            }
        };

        _this.enabled = function (level) {
            return _config.enabled && _levels[level] > 0 && (_levels[level] <= _levels.info || _config.level === 'detailed');
        };
        _this.interval = function () { return _config.level === 'detailed' ? 1000 : 10000; };
        _this.media = function () { return _config.enabled && _config.level !== 'basic'; };
        _this.status = function () { return Object.assign({}, _counts, { queueEvents: _normal.length + _urgent.length, queueBytes: _bytes }); };

        function _record(component, scope, selected, event, level, metrics, force) {
            if (!_this.enabled(level)) { _counts.filtered++; return; }
            if (!force && _levels[level] >= _levels.info && !selected) { _counts.sampled++; return; }
            var allowed = _fields[event];
            if (!allowed) { _counts.dropped++; return; }
            var values = {};
            Object.keys(metrics || {}).forEach(function (key) {
                var value = metrics[key];
                if (allowed.indexOf(key) >= 0 && Number.isFinite(value) && value >= 0 && value <= 1e15) { values[key] = value; }
            });
            if (Object.keys(values).length > 16) { _counts.dropped++; return; }
            var record = { schemaVersion: 1, timestamp: Date.now(), eventId: _boot + '.' + (++_sequence),
                scope: scope, component: component, event: event, level: level,
                samplePercent: force || _levels[level] <= _levels.warn ? 100 : _config.samplePercent, metrics: values },
                // Every permitted key/value is ASCII; this is also the UTF-8 size.
                bytes = JSON.stringify(record).length + 1,
                urgent = _levels[level] <= _levels.warn;
            if (bytes > 4096 || _bytes + bytes > _config.maxBytes || _normal.length + _urgent.length >= _config.maxEvents ||
                (!urgent && (_normal.length >= Math.floor(_config.maxEvents * 3 / 4) || _normalBytes + bytes > _config.maxBytes * 3 / 4))) {
                _counts.dropped++; return;
            }
            (urgent ? _urgent : _normal).push({ record: record, bytes: bytes });
            _bytes += bytes;
            if (!urgent) { _normalBytes += bytes; }
            _counts.accepted++;
        }

        _this.flush = function () {
            if (_pending || !_sink || !_config.enabled) { return; }
            if (_clock() - _healthAt >= 10000) {
                _healthAt = _clock();
                var status = _this.status();
                if (_this.enabled('info') || status.dropped || status.failed) {
                    _record('collector', _boot, true, 'collector.health', _this.enabled('info') ? 'info' : 'error', status, true);
                }
            }
            var batch = [], bytes = 16;
            while (batch.length < _config.batchSize && (_urgent.length || _normal.length)) {
                var urgent = _urgent.length > 0, queue = urgent ? _urgent : _normal, item = queue[0];
                if (bytes + item.bytes > 60000) { break; }
                queue.shift();
                _bytes -= item.bytes;
                if (!urgent) { _normalBytes -= item.bytes; }
                bytes += item.bytes;
                batch.push(item.record);
            }
            if (!batch.length) { return; }
            var controller = new AbortController(), generation = _generation, sink = _sink, timeout,
                deadline = new Promise(function (_, reject) {
                    timeout = setTimeout(function () { controller.abort(); reject(new Error('Quality timeout.')); }, _config.timeout);
                }), pending = { controller: controller, count: batch.length };
            _pending = pending;
            // A custom sink receives the same cancellation contract. Even if it
            // ignores cancellation, its late result cannot mutate a new setup.
            return Promise.race([Promise.resolve().then(function () { return sink(batch, controller.signal); }), deadline]).then(function () {
                if (generation === _generation) { _counts.sent += batch.length; }
            }, function () {
                if (generation === _generation) { _counts.failed += batch.length; }
            }).finally(function () {
                clearTimeout(timeout);
                if (_pending === pending) { _pending = null; }
            });
        };

        _this.session = function (component) {
            var generation = _generation, scope = '', selected = false, started = _clock(),
                closed = false, ready = false, first = false, statsAt = 0, previous = new Map(),
                video = null, frameCallback = null, streamSequence = 0,
                playbackAt = _clock(), windowAt = playbackAt, activeMs = 0, bufferingMs = 0, bufferingStarts = 0,
                playing = false, waiting = false, seeking = false, visible = !document.hidden,
                playbackFrames = null, playbackDropped = null;
            if (['game', 'rtc', 'im', 'live', 'vod'].indexOf(component) < 0) { throw new TypeError('Invalid quality component.'); }
            if (_config.enabled) {
                scope = _id();
                var hash = 2166136261;
                for (var i = 0; i < scope.length; i++) { hash = Math.imul(hash ^ scope.charCodeAt(i), 16777619) >>> 0; }
                selected = hash % 100 < _config.samplePercent;
            }
            function record(event, level, metrics) {
                if ((closed && event !== 'im.publish') || !scope || generation !== _generation) { return; }
                _record(component, scope, selected, event, level, metrics);
            }
            var session = {
                event: record,
                ready: function () {
                    if (!ready) { ready = true; record('session.ready', 'info', { durationMs: _clock() - started }); }
                },
                fail: function (error) {
                    record('session.error', 'error', { durationMs: _clock() - started, errorCode: error ? Number(error.code !== undefined ? error.code : error.status) : undefined });
                },
                video: function (element) {
                    if (closed || video || !scope || !element || !element.requestVideoFrameCallback) { return; }
                    video = element;
                    try {
                        frameCallback = video.requestVideoFrameCallback(function () {
                            frameCallback = null;
                            if (!closed) { first = true; record('media.first_frame', 'info', { durationMs: _clock() - started }); }
                        });
                    } catch (_) { video = null; frameCallback = null; _counts.dropped++; }
                },
                // Reuse the player's media/timeupdate events; no extra timer.
                // Startup, user pauses, seeks and hidden-tab time are excluded
                // from the playback buffering ratio, not counted as freezes.
                playback: function (type, element, position) {
                    if (closed || !scope || generation !== _generation || !_this.enabled('info') || !selected) { return; }
                    var now = _clock(), elapsed = Math.max(0, now - playbackAt);
                    if (playing && !seeking && visible) {
                        activeMs += elapsed;
                        if (waiting) { bufferingMs += elapsed; }
                    }
                    playbackAt = now;
                    visible = !document.hidden;
                    if (type === 'playing') { playing = true; waiting = false; seeking = false; session.ready(); }
                    if (type === 'pause' || type === 'ended') { playing = false; waiting = false; }
                    if (type === 'seeking') { seeking = true; waiting = false; }
                    if (type === 'seeked') { seeking = false; }
                    if (type === 'waiting' && playing && !seeking && visible && !waiting) { waiting = true; bufferingStarts++; }
                    if (element) { session.video(element); }
                    if (!_this.media() || now - windowAt < _this.interval() && type !== 'ended') { return; }
                    var values = { intervalMs: now - windowAt, activeMs: activeMs,
                        bufferingMs: bufferingMs, bufferingStarts: bufferingStarts };
                    if (position && Number.isFinite(position.buffered) && Number.isFinite(position.time)) {
                        values.bufferMs = Math.max(0, position.buffered - position.time) * 1000;
                    }
                    if (element && typeof element.getVideoPlaybackQuality === 'function') {
                        var quality;
                        try { quality = element.getVideoPlaybackQuality(); } catch (_) { _counts.dropped++; }
                        if (quality && Number.isFinite(quality.totalVideoFrames) && Number.isFinite(quality.droppedVideoFrames)) {
                            if (playbackFrames !== null && quality.totalVideoFrames >= playbackFrames && quality.droppedVideoFrames >= playbackDropped) {
                                values.frames = quality.totalVideoFrames - playbackFrames;
                                values.dropped = quality.droppedVideoFrames - playbackDropped;
                            }
                            playbackFrames = quality.totalVideoFrames;
                            playbackDropped = quality.droppedVideoFrames;
                        }
                    }
                    record('playback.window', _config.level === 'detailed' ? 'debug' : 'info', values);
                    windowAt = now; activeMs = bufferingMs = bufferingStarts = 0;
                },
                close: function (unexpected) {
                    record('session.close', unexpected ? 'warn' : 'info', { durationMs: _clock() - started,
                        outcome: unexpected ? 1 : 0, firstFrame: video ? (first ? 1 : 0) : undefined });
                    closed = true;
                    if (frameCallback !== null && video && video.cancelVideoFrameCallback) {
                        try { video.cancelVideoFrameCallback(frameCallback); } catch (_) { _counts.dropped++; }
                    }
                    frameCallback = null;
                    video = null;
                    previous.clear();
                },
                stats: function (report) {
                    if (closed || !scope || generation !== _generation || !_this.media() || !selected) { return; }
                    var now = _clock();
                    if (statsAt && now - statsAt < _this.interval()) { return; }
                    statsAt = now;
                    var next = new Map();
                    report.forEach(function (item) {
                        if ((item.type !== 'inbound-rtp' && item.type !== 'outbound-rtp') ||
                            (item.kind !== 'audio' && item.kind !== 'video') || next.size >= 64) { return; }
                        var before = previous.get(item.id), snapshot = {},
                            fields = ['timestamp', 'bytesReceived', 'bytesSent', 'packetsReceived', 'packetsSent', 'packetsLost',
                                'framesDecoded', 'framesEncoded', 'framesDropped', 'freezeCount', 'totalFreezesDuration',
                                'concealedSamples', 'totalSamplesReceived', 'jitterBufferDelay', 'jitterBufferEmittedCount', 'nackCount', 'pliCount'];
                        fields.forEach(function (key) { if (Number.isFinite(item[key])) { snapshot[key] = item[key]; } });
                        snapshot.stream = before ? before.stream : ++streamSequence;
                        next.set(item.id, snapshot);
                        if (!before || !(snapshot.timestamp > before.timestamp)) { return; }
                        var transport = item.transportId && report.get(item.transportId),
                            pair = transport && report.get(transport.selectedCandidatePairId),
                            rtt = pair && Number.isFinite(pair.currentRoundTripTime) ? pair.currentRoundTripTime * 1000 : undefined;
                        var inbound = item.type === 'inbound-rtp', values = { stream: snapshot.stream, intervalMs: snapshot.timestamp - before.timestamp,
                            kind: item.kind === 'video' ? 1 : 0, direction: inbound ? 0 : 1, rttMs: rtt, jitterMs: item.jitter * 1000 };
                        function delta(key) {
                            return Number.isFinite(snapshot[key]) && Number.isFinite(before[key]) && before[key] >= 0 && snapshot[key] >= before[key] ? snapshot[key] - before[key] : undefined;
                        }
                        values.bytes = delta(inbound ? 'bytesReceived' : 'bytesSent');
                        values.packets = delta(inbound ? 'packetsReceived' : 'packetsSent');
                        values.lost = delta('packetsLost');
                        values.frames = delta(inbound ? 'framesDecoded' : 'framesEncoded');
                        values.dropped = delta('framesDropped');
                        values.freezes = delta('freezeCount');
                        values.freezeMs = delta('totalFreezesDuration') * 1000;
                        values.concealedSamples = delta('concealedSamples');
                        values.samples = delta('totalSamplesReceived');
                        var emitted = delta('jitterBufferEmittedCount'), delay = delta('jitterBufferDelay');
                        if (emitted > 0 && Number.isFinite(delay)) { values.jitterBufferMs = delay * 1000 / emitted; }
                        // Window counters are cheap and needed to distinguish
                        // network loss from a source gap at the standard tier.
                        values.nack = delta('nackCount'); values.pli = delta('pliCount');
                        record('media.window', _config.level === 'detailed' ? 'debug' : 'info', values);
                    });
                    previous = next;
                },
            };
            record('session.start', 'info', {});
            return session;
        };

        _this.close = function () {
            ++_generation;
            clearInterval(_timer);
            _timer = null;
            _counts.dropped += _normal.length + _urgent.length;
            if (_pending) { _counts.dropped += _pending.count; _pending.controller.abort(); }
            _normal = []; _urgent = []; _bytes = _normalBytes = 0;
            _pending = null; _sink = null;
            _config = Object.assign({}, _default);
        };
    }

    Quality.prototype.kind = 'Quality';
    Quality.prototype.CONF = _default;
    odd.utils.Quality = Quality;
    odd.quality = new Quality();
})(odd);

