(function (odd) {
    var AV = {};

    function Rational(num, den) {
        var _this = this;

        function _init() {
            _this.Num = num || 0; // Numerator
            _this.Den = den || 1;  // Denominator
        }

        _init();
    }

    function Information() {
        var _this = this;

        function _init() {
            _this.MimeType = '';         // string
            _this.Codecs = [];           // []string
            _this.Timescale = 1000;      // uint32
            _this.TimeBase = 0;          // uint32
            _this.Timestamp = 0;         // uint32
            _this.AudioTimestamp = 0;    // uint32
            _this.VideoTimestamp = 0;    // uint32
            _this.Duration = 0;          // uint32
            _this.FileSize = 0;          // int64
            _this.Width = 0;             // uint32
            _this.Height = 0;            // uint32
            _this.CodecWidth = 0;        // uint32
            _this.CodecHeight = 0;       // uint32
            _this.AudioDataRate = 0;     // uint32
            _this.VideoDataRate = 0;     // uint32
            _this.BitRate = 0;           // uint32
            _this.FrameRate = new Rational(30, 1);
            _this.SampleRate = 0;        // uint32
            _this.SampleSize = 0;        // uint32
            _this.Channels = 0;          // uint32
            _this.Stereo = false;
            _this.Encoder = '';          // string
        }

        _init();
    }

    function Packet() {
        var _this = this,
            _properties;

        function _init() {
            _properties = {};

            _this.kind = '';
            _this.codec = '';  // 'AAC', 'AVC', etc.
            _this.length = 0;
            _this.timestamp = 0;
            _this.streamid = 0;
            _this.payload = null; // Uint8Array
            _this.position = 0;
        }

        _this.left = function () {
            if (_this.payload == null) {
                return 0;
            }
            return _this.payload.byteLength - _this.position;
        };

        _this.set = function (key, value) {
            _properties[key] = value;
        };

        _this.get = function (key) {
            return _properties[key];
        };

        _init();
    }

    Packet.KindAudio = 'audio';
    Packet.KindVideo = 'video';
    Packet.KindScript = 'script';
    AV.Rational = Rational;
    AV.Information = Information;
    AV.Packet = Packet;
    odd.AV = AV;
})(odd);

