(function (odd) {
    var RTC = odd.RTC;

    function AudioMeter(logger) {
        var _this = this,
            _logger = logger,
            _context,
            _analyser,
            _buffer,
            _source;

        function _init() {

        }

        _this.update = function (stream) {
            if (stream.getAudioTracks().length > 0) {
                if (_source) {
                    _source.disconnect();
                } else {
                    _context = new (window.AudioContext || window.webkitAudioContext)();
                    _analyser = _context.createAnalyser();
                    _buffer = new Uint8Array(_analyser.frequencyBinCount);
                }
                _source = _context.createMediaStreamSource(stream);
                _source.connect(_analyser);
            }
        };

        _this.volume = function () {
            if (_analyser) {
                _analyser.getByteTimeDomainData(_buffer);

                var n = 0;
                for (var i = 0; i < _buffer.length; i++) {
                    var l = Math.abs(_buffer[i] - 128);
                    n = Math.max(n, l);
                }
                if (n === 1) {
                    // When getUserMedia uses a special audio constraints,
                    // getByteTimeDomainData() also generate a value of 127 while mic is quite.
                    n = 0;
                }
                return Math.round(n * 100 / 128);
            }
            return 0;
        };

        _this.stop = function () {
            if (_source) {
                _source.disconnect();
            }
            if (_context) {
                _context.close();
            }
        };

        _init();
    }

    RTC.AudioMeter = AudioMeter;
})(odd);

