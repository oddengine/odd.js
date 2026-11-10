(function (odd) {
    var utils = odd.utils, Event = odd.events.Event, IOEvent = odd.events.IOEvent,
        EventDispatcher = odd.events.EventDispatcher, Module = odd.Module;

    function DASH(config, logger) {
        EventDispatcher.call(this, 'DASH', { logger: logger }, Event, IOEvent);
        var _this = this, _native = new Module.SRC(utils.extendz({}, config, { credentials: null }), logger),
            _video = _native.element(), _source, _session, _media, _objectURL, _controller,
            _tracks = new Map(), _generation = 0, _ready = false, _closed = false, _resetting = false, _positioned = false;
        _this.config = config;
        _native.addGlobalListener(function (event) {
            if (_resetting) { return; }
            if (event.type === Event.ERROR) { _fail(event.data, _generation); }
            else {
                if (event.type === Event.ENDED && _session) { _session.close(); _session = undefined; }
                _this.forward(event);
            }
        });

        _this.setup = function () {
            if (!_closed && !_ready) { _ready = true; _this.dispatchEvent(Event.READY, { kind: _this.kind }); }
        };

        _this.play = function (program) {
            if (_closed) { return; }
            var source = program && program.sources && program.sources[0];
            if (source && (!_source || source.streamId !== _source.streamId)) {
                _release(); _source = source;
                _controller = new AbortController();
                _load(_generation);
            } else if (_objectURL) { _native.play(); }
        };

        async function _load(generation) {
            var Constructor = window.MediaSource || window.WebKitMediaSource;
            var session = new utils.PlaybackSession(config, function (error) { _fail(error, generation); });
            _session = session;
            try {
                await session.open({ protocol: 'DASH', streamId: _source.streamId });
                _check(generation);
                _media = new Constructor();
                var opened = _wait(_media, 'sourceopen', generation);
                _objectURL = URL.createObjectURL(_media);
                _native.play({ sources: [{ url: _objectURL }] });
                await opened;
                for (;;) {
                    _check(generation);
                    var data = await session.read(session.url, 1048576);
                    _check(generation);
                    var manifest = utils.MPD.parse(new TextDecoder().decode(data), session.url, function (mime) { return Constructor.isTypeSupported(mime); });
                    // A node generation uses stable track initialization URLs.
                    // Reconfiguration is explicit; obsolete buffered samples
                    // must never be mixed with a new period or codec.
                    await _configure(manifest, generation);
                    _check(generation);
                    await Promise.all(manifest.tracks.map(function (track) { return _pump(track, generation); }));
                    _check(generation);
                    _position(manifest);
                    if (!manifest.dynamic && manifest.tracks.every(function (track) {
                        var last = track.segments[track.segments.length - 1];
                        return _tracks.get(track.kind).next >= last.time + last.duration - 0.001;
                    })) {
                        if (_media.readyState === 'open') { _media.endOfStream(); }
                        return;
                    }
                    await _delay(Math.max(500, manifest.update * 1000), generation);
                }
            } catch (error) { _fail(error, generation); }
        }

        async function _configure(manifest, generation) {
            var active = new Set(manifest.tracks.map(function (track) { return track.kind; }));
            for (var pair of _tracks) {
                if (!active.has(pair[0])) { _media.removeSourceBuffer(pair[1].buffer); _tracks.delete(pair[0]); }
            }
            var edge = Math.min.apply(null, manifest.tracks.map(function (track) {
                var last = track.segments[track.segments.length - 1]; return last.time + last.duration;
            }));
            for (var track of manifest.tracks) {
                var current = _tracks.get(track.kind);
                if (current && current.initialization === track.initialization && current.mime === track.mime && current.period === track.period) {
                    current.segments = track.segments;
                    continue;
                }
                if (current) { _media.removeSourceBuffer(current.buffer); _tracks.delete(track.kind); _positioned = false; }
                var buffer = _media.addSourceBuffer(track.mime);
                buffer.timestampOffset = track.offset;
                var first = manifest.dynamic ? track.segments.find(function (segment) { return segment.time + segment.duration > edge - manifest.delay; }) : track.segments[0];
                current = { buffer: buffer, next: (first || track.segments[0]).time, initialization: track.initialization,
                    mime: track.mime, period: track.period, segments: track.segments };
                _tracks.set(track.kind, current);
                var initialization = await _session.read(track.initialization, 2097152);
                _check(generation);
                await _update(buffer, function () { buffer.appendBuffer(initialization); }, generation);
            }
        }

        async function _pump(track, generation) {
            var current = _tracks.get(track.kind), buffer = current.buffer,
                segments = track.segments.filter(function (segment) { return segment.time + 0.001 >= current.next; }).slice(0, 4);
            if (segments.length && segments[0].time > current.next + 0.1) { _positioned = false; }
            for (var segment of segments) {
                // Pausing keeps a bounded buffer instead of accumulating every
                // new live segment. Resume catches up to the current window.
                if (_positioned && segment.time > _video.currentTime + Math.max(10, config.maxPlaybackLength || 30)) { break; }
                var data = await _session.read(segment.url, 16777216);
                _check(generation);
                var before = _video.currentTime - Math.max(10, config.maxPlaybackLength || 30);
                if (before > 0 && buffer.buffered.length && buffer.buffered.start(0) < before) {
                    await _update(buffer, function () { buffer.remove(0, before); }, generation);
                }
                _check(generation);
                await _update(buffer, function () { buffer.appendBuffer(data); }, generation);
                _check(generation);
                current.next = segment.time + segment.duration;
            }
        }

        function _position(manifest) {
            var ranges = _video.buffered;
            if (!ranges.length) { return; }
            var start = ranges.start(ranges.length - 1), end = ranges.end(ranges.length - 1);
            if (!_positioned || _video.currentTime < start) {
                _video.currentTime = manifest.dynamic ? Math.max(start, end - manifest.delay) : start;
                _positioned = true;
            }
            if (manifest.dynamic && _media.setLiveSeekableRange && end > start) { _media.setLiveSeekableRange(start, end); }
        }

        function _check(generation) {
            if (_closed || generation !== _generation || !_controller || _controller.signal.aborted) {
                throw { name: 'AbortError', message: 'DASH playback cancelled.' };
            }
        }

        function _wait(target, success, generation, action) {
            _check(generation);
            var signal = _controller.signal;
            return new Promise(function (resolve, reject) {
                var timer, done = false;
                function finish(error) {
                    if (done) { return; } done = true;
                    clearTimeout(timer); target.removeEventListener(success, complete); target.removeEventListener('error', fail);
                    signal.removeEventListener('abort', cancel);
                    if (error) { reject(error); } else { resolve(); }
                }
                function complete() { finish(); }
                function fail() { finish({ name: 'EncodingError', message: 'DASH media could not be buffered.' }); }
                function cancel() { finish({ name: 'AbortError', message: 'DASH playback cancelled.' }); }
                target.addEventListener(success, complete); target.addEventListener('error', fail); signal.addEventListener('abort', cancel, { once: true });
                timer = setTimeout(function () { finish({ name: 'TimeoutError', message: 'DASH media preparation timed out.' }); }, config.timeout);
                try { if (action) { action(); } } catch (error) { finish(error); }
            });
        }
        function _update(buffer, action, generation) { return _wait(buffer, 'updateend', generation, action); }
        function _delay(delay, generation) {
            _check(generation);
            var signal = _controller.signal;
            return new Promise(function (resolve, reject) {
                var timer = setTimeout(function () { signal.removeEventListener('abort', cancel); resolve(); }, delay);
                function cancel() { clearTimeout(timer); reject({ name: 'AbortError', message: 'DASH playback cancelled.' }); }
                signal.addEventListener('abort', cancel, { once: true });
            });
        }

        function _release() {
            _generation++;
            if (_controller) { _controller.abort(); _controller = undefined; }
            if (_session) { _session.close(); _session = undefined; }
            _resetting = true; _native.stop(); _resetting = false;
            _tracks.clear(); _media = undefined; _source = undefined; _positioned = false;
            if (_objectURL) { URL.revokeObjectURL(_objectURL); _objectURL = undefined; }
        }
        function _fail(error, generation) {
            if (_closed || generation !== _generation) { return; }
            _release(); _this.dispatchEvent(Event.ERROR, { name: error.name || 'OperationError', message: error.message || 'DASH playback failed.' });
        }

        _this.pause = function () { _native.pause(); };
        _this.seek = function (time) { _native.seek(time); };
        _this.stop = function () { _release(); _this.dispatchEvent(Event.ENDED); };
        _this.muted = function (value) { return _native.muted(value); };
        _this.volume = function (value) { return _native.volume(value); };
        _this.record = function () { return _native.record(); };
        _this.element = function () { return _video; };
        _this.destroy = function () { if (_closed) { return; } _closed = true; _release(); _resetting = true; _native.destroy(); };
    }

    DASH.prototype = Object.create(EventDispatcher.prototype);
    DASH.prototype.constructor = DASH;
    DASH.prototype.kind = 'DASH';
    DASH.prototype.isSupported = function (program) {
        return !!((window.MediaSource || window.WebKitMediaSource) && window.fetch && window.AbortController && program &&
            program.sources && program.sources.length && program.sources.every(function (source) { return source && typeof source.streamId === 'string'; }));
    };
    Module.register(DASH);
})(odd);

