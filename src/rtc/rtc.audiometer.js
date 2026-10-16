(function (odd) {
    var RTC = odd.RTC;

    function AudioMeter(logger) {
        var _this = this,
            _logger = logger,
            _context,
            _analyser,
            _buffer,
            _source,
            _stream,
            _track;

        function _init() {

        }

        _this.update = function (stream) {
            if (!stream) {
                _this.stop();
                return;
            }
            if (_stream !== stream) {
                if (_stream) {
                    _stream.removeEventListener('addtrack', _onTrackChange);
                    _stream.removeEventListener('removetrack', _onTrackChange);
                }
                _stream = stream;
                _stream.addEventListener('addtrack', _onTrackChange);
                _stream.addEventListener('removetrack', _onTrackChange);
            }

            var tracks = stream.getAudioTracks();
            var track;
            for (var i = 0; i < tracks.length; i++) {
                if (tracks[i].readyState === 'live') {
                    track = tracks[i];
                    break;
                }
            }
            if (!track) {
                _release();
                return;
            }
            if (_track === track && _source && _context.state !== 'closed') {
                _resume();
                return;
            }

            _disconnect();
            try {
                if (!_context || _context.state === 'closed') {
                    _context = new (window.AudioContext || window.webkitAudioContext)();
                    _analyser = _context.createAnalyser();
                    _buffer = new Uint8Array(_analyser.frequencyBinCount);
                }
                // Select the same borrowed track that volume() checks. A browser
                // may otherwise choose another track from a multi-track stream.
                _source = _context.createMediaStreamSource(new MediaStream([track]));
                _source.connect(_analyser);
                _track = track;
                _track.addEventListener('ended', _onTrackChange);
                _resume();
            } catch (err) {
                _release();
                _warn(err);
            }
        };

        function _onTrackChange(e) {
            if ((!e.track || e.track.kind === 'audio') && (e.target === _stream || e.target === _track)) {
                _this.update(_stream);
            }
        }

        function _resume() {
            if (_context.state !== 'suspended') {
                return;
            }
            var context = _context;
            Promise.resolve().then(function () {
                if (_context === context) {
                    return context.resume();
                }
            }).catch(function (err) {
                if (_context === context) {
                    _warn(err);
                }
            });
        }

        _this.volume = function () {
            // MediaStreamTrack.stop() does not dispatch ended. A later read
            // still retires that graph or selects another live audio track.
            if (_track && _track.readyState !== 'live') {
                _this.update(_stream);
            }
            if (!_source || _context.state !== 'running' || _track.readyState !== 'live' || !_track.enabled || _track.muted) {
                return 0;
            }
            try {
                _analyser.getByteTimeDomainData(_buffer);
            } catch (err) {
                _release();
                _warn(err);
                return 0;
            }

            var n = 0;
            for (var i = 0; i < _buffer.length; i++) {
                var l = Math.abs(_buffer[i] - 128);
                n = Math.max(n, l);
            }
            if (n === 1) {
                // Some capture constraints report 127 even while the mic is quiet.
                n = 0;
            }
            return Math.round(n * 100 / 128);
        };

        _this.measure = function () {
            var value = _this.volume();
            if (!_track || !_source || !_context || _context.state !== 'running' || _track.readyState !== 'live') {
                return { state: 'unavailable', value: null };
            }
            if (!_track.enabled || _track.muted) {
                return { state: 'muted', value: 0 };
            }
            return { state: 'live', value: value };
        };

        function _disconnect() {
            if (_track) {
                _track.removeEventListener('ended', _onTrackChange);
                _track = undefined;
            }
            if (_source) {
                try {
                    _source.disconnect();
                } catch (err) {
                    _warn(err);
                }
                _source = undefined;
            }
        }

        function _release() {
            _disconnect();
            var context = _context;
            _context = _analyser = _buffer = undefined;
            if (context && context.state !== 'closed') {
                Promise.resolve().then(function () {
                    return context.close();
                }).catch(_warn);
            }
        }

        function _warn(err) {
            if (_logger) {
                _logger.warn('Audio measurement is unavailable: ', err);
            }
        }

        _this.stop = function () {
            if (_stream) {
                _stream.removeEventListener('addtrack', _onTrackChange);
                _stream.removeEventListener('removetrack', _onTrackChange);
                _stream = undefined;
            }
            _release();
        };

        _init();
    }

    RTC.AudioMeter = AudioMeter;
})(odd);

