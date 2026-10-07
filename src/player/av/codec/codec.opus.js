(function (odd) {
    var events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        MediaEvent = events.MediaEvent,
        Codec = odd.AV.Codec,

        DataTypes = {
            SPECIFIC_CONFIG: 0,
            RAW_FRAME_DATA: 1,
            END_OF_SEQUENCE: 2,
        };

    function Opus(info, logger) {
        EventDispatcher.call(this, 'Opus', { logger: logger }, MediaEvent, [Event.ERROR]);

        var _this = this,
            _info = info;

        function _init() {
            _this.MimeType = 'audio/mp4';
            _this.Codec = 'opus';
            _this.Config = null;
            _this.Channels = 0;
            _this.ChannelConfiguration = 0;
            _this.SamplingFrequency = 48000;
            _this.PreSkip = 0;
            _this.InputSampleRate = 48000;
            _this.OutputGain = 0;
            _this.RefSampleDuration = _info.Timescale / 50;
            _this.Flags = {
                IsLeading: 0,
                SampleDependsOn: 1,
                SampleIsDependedOn: 0,
                SampleHasRedundancy: 0,
                IsNonSync: 0,
            };
        }

        _this.parse = function (pkt) {
            _info.Timestamp = Math.max(pkt.timestamp, _info.VideoTimestamp);

            switch (pkt.get('DataType')) {
                case DataTypes.SPECIFIC_CONFIG:
                    _parseSpecificConfig(pkt);
                    break;
                case DataTypes.RAW_FRAME_DATA:
                    _parseRawFrameData(pkt);
                    break;
                case DataTypes.END_OF_SEQUENCE:
                    _this.dispatchEvent(MediaEvent.ENDOFSTREAM, { packet: pkt });
                    break;
            }
        };

        function _parseSpecificConfig(pkt) {
            var data = pkt.payload.subarray(pkt.position);
            if (data.length !== 19 || String.fromCharCode.apply(null, data.subarray(0, 8)) !== 'OpusHead' ||
                data[8] > 15 || (data[9] !== 1 && data[9] !== 2) || data[18] !== 0) {
                throw { name: 'NotSupportedError', message: 'Unsupported Opus identification header.' };
            }

            var view = new DataView(data.buffer, data.byteOffset, data.length);
            _this.Config = new Uint8Array(data);
            _this.Channels = data[9];
            _this.ChannelConfiguration = data[9];
            _this.PreSkip = view.getUint16(10, true);
            _this.InputSampleRate = view.getUint32(12, true);
            _this.OutputGain = view.getInt16(16, true);
            _info.SampleRate = 48000;
            _info.Channels = data[9];
            if (!_info.MimeType) {
                _info.MimeType = _this.MimeType;
            }
            _info.Codecs.push(_this.Codec);
            _this.dispatchEvent(MediaEvent.OPUSSPECIFICCONFIG, { packet: pkt });
        }

        function _parseRawFrameData(pkt) {
            var data = pkt.payload.subarray(pkt.position);
            if (!_this.Config || !data.length) {
                throw { name: 'DataError', message: 'Opus configuration or packet is missing.' };
            }

            var configuration = data[0] >> 3;
            var samples = configuration >= 16 ? 120 << (configuration & 3) :
                configuration >= 12 ? 480 << (configuration & 1) : [480, 960, 1920, 2880][configuration & 3];
            var code = data[0] & 3;
            if (code === 3 && data.length < 2) {
                throw { name: 'DataError', message: 'Incomplete Opus frame count.' };
            }
            var count = code === 0 ? 1 : code === 3 ? data[1] & 63 : 2;
            if (samples * count !== 960) {
                throw { name: 'NotSupportedError', message: 'Only fixed 20 ms Opus packets are supported.' };
            }

            _info.AudioTimestamp = pkt.timestamp;
            pkt.set('DTS', _info.TimeBase + pkt.timestamp);
            pkt.set('PTS', pkt.get('DTS'));
            pkt.set('Data', data);
            _this.dispatchEvent(MediaEvent.OPUSSAMPLE, { packet: pkt });
        }

        _init();
    }

    Opus.prototype = Object.create(EventDispatcher.prototype);
    Opus.prototype.constructor = Opus;
    Opus.prototype.kind = 'Opus';
    Opus.DataTypes = DataTypes;
    Codec.register(Opus);
})(odd);
