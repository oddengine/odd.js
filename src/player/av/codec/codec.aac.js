(function (odd) {
    var utils = odd.utils,
        Golomb = utils.Golomb,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        MediaEvent = events.MediaEvent,
        AV = odd.AV,
        Packet = AV.Packet,
        Codec = AV.Codec,

        DataTypes = {
            SPECIFIC_CONFIG: 0x00,
            RAW_FRAME_DATA: 0x01,
        },
        AOT = {
            NULL: 0,
            AAC_MAIN: 1,         // Main
            AAC_LC: 2,           // Low Complexity
            AAC_SSR: 3,          // Scalable Sample Rate
            AAC_LTP: 4,          // Long Term Prediction
            SBR: 5,              // Spectral Band Replication
            AAC_SCALABLE: 6,     // Scalable
            TWINVQ: 7,           // Twin Vector Quantizer
            CELP: 8,             // Code Excited Linear Prediction
            HVXC: 9,             // Harmonic Vector eXcitation Coding
            TTSI: 12,            // Text-To-Speech Interface
            MAINSYNTH: 13,       // Main Synthesis
            WAVESYNTH: 14,       // Wavetable Synthesis
            MIDI: 15,            // General MIDI
            SAFX: 16,            // Algorithmic Synthesis and Audio Effects
            ER_AAC_LC: 17,       // Error Resilient Low Complexity
            ER_AAC_LTP: 19,      // Error Resilient Long Term Prediction
            ER_AAC_SCALABLE: 20, // Error Resilient Scalable
            ER_TWINVQ: 21,       // Error Resilient Twin Vector Quantizer
            ER_BSAC: 22,         // Error Resilient Bit-Sliced Arithmetic Coding
            ER_AAC_LD: 23,       // Error Resilient Low Delay
            ER_CELP: 24,         // Error Resilient Code Excited Linear Prediction
            ER_HVXC: 25,         // Error Resilient Harmonic Vector eXcitation Coding
            ER_HILN: 26,         // Error Resilient Harmonic and Individual Lines plus Noise
            ER_PARAM: 27,        // Error Resilient Parametric
            SSC: 28,             // SinuSoidal Coding
            PS: 29,              // Parametric Stereo
            SURROUND: 30,        // MPEG Surround
            ESCAPE: 31,          // Escape Value
            L1: 32,              // Layer 1
            L2: 33,              // Layer 2
            L3: 34,              // Layer 3
            DST: 35,             // Direct Stream Transfer
            ALS: 36,             // Audio LosslesS
            SLS: 37,             // Scalable LosslesS
            SLS_NON_CORE: 38,    // Scalable LosslesS (non core)
            ER_AAC_ELD: 39,      // Error Resilient Enhanced Low Delay
            SMR_SIMPLE: 40,      // Symbolic Music Representation Simple
            SMR_MAIN: 41,        // Symbolic Music Representation Main
            USAC_NOSBR: 42,      // Unified Speech and Audio Coding (no SBR)
            SAOC: 43,            // Spatial Audio Object Coding
            LD_SURROUND: 44,     // Low Delay MPEG Surround
            USAC: 45,            // Unified Speech and Audio Coding
        },
        SamplingFrequencys = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350],
        Channels = [0, 1, 2, 3, 4, 5, 6, 8],
        SilentFramesOfLC = [
            new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x23, 0x80]),
            new Uint8Array([0x21, 0x00, 0x49, 0x90, 0x02, 0x19, 0x00, 0x23, 0x80]),
            new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x8e]),
            new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x80, 0x2c, 0x80, 0x08, 0x02, 0x38]),
            new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x38]),
            new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x00, 0xb2, 0x00, 0x20, 0x08, 0xe0]),
        ],
        SilentFramesOfSBR = [
            new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x4e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x1c, 0x6, 0xf1, 0xc1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]),
            new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x5e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x0, 0x95, 0x0, 0x6, 0xf1, 0xa1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]),
            new Uint8Array([0x1, 0x40, 0x22, 0x80, 0xa3, 0x5e, 0xe6, 0x80, 0xba, 0x8, 0x0, 0x0, 0x0, 0x0, 0x95, 0x0, 0x6, 0xf1, 0xa1, 0xa, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5a, 0x5e]),
        ];

    function AAC(info, logger) {
        EventDispatcher.call(this, 'AAC', { logger: logger }, MediaEvent, [Event.ERROR]);

        var _this = this,
            _info = info,
            _logger = logger,
            _gb;

        function _init() {
            _this.MimeType = 'audio/mp4';
            _this.Codec = '';
            _this.RefSampleDuration = Math.floor(_info.Timescale * 1024 / 44100);

            // Specific Config
            _this.AudioObjectType = 0;                 // uint8:   5 bits
            _this.SamplingFrequencyIndex = 0;          // uint8:   4 bits
            _this.SamplingFrequency = 0;               // uint32
            _this.ChannelConfiguration = 0;            // uint8:   4 bits
            _this.Channels = 0;                        // uint16
            _this.ExtensionAudioObjectType = 0;        // uint8:   5 bits
            _this.ExtensionSamplingFrequencyIndex = 0; // uint8:   4 bits
            _this.ExtensionSamplingFrequency = 0;      // uint32: 24 bits
            _this.ExtensionChannelConfiguration = 0;   // uint8:   4 bits
            _this.Config = null;                       // Uint8Array
            _this.Flags = {
                IsLeading: 0,
                SampleDependsOn: 1,
                SampleIsDependedOn: 0,
                SampleHasRedundancy: 0,
                IsNonSync: 0,
            };
        }

        _this.parse = function (pkt) {
            if (pkt.left() < 1) {
                _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Data not enough while parsing AAC packet.' });
                return;
            }

            _info.Timestamp = Math.max(pkt.timestamp, _info.VideoTimestamp);

            var v = new DataView(pkt.payload.buffer);
            pkt.set('DataType', v.getUint8(pkt.position++));
            pkt.set('CTS', 0); // CompositionTime

            switch (pkt.get('DataType')) {
                case DataTypes.SPECIFIC_CONFIG:
                    if (!_info.MimeType) {
                        _info.MimeType = _this.MimeType;
                    }
                    _parseSpecificConfig(pkt);
                    break;
                case DataTypes.RAW_FRAME_DATA:
                    _parseRawFrameData(pkt);
                    break;
                default:
                    _this.dispatchEvent(Event.ERROR, { name: 'TypeError', message: 'Unrecognized AAC packet type: ' + _this.DataType });
                    break;
            }
        };

        function _parseSpecificConfig(pkt) {
            if (pkt.left() < 2) {
                _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Data not enough while parsing AAC specific config.' });
                return;
            }

            _gb = new Golomb(pkt.payload.subarray(pkt.position));

            _this.AudioObjectType = _gb.ReadBits(5);
            if (_this.AudioObjectType === AOT.ESCAPE) {
                _this.AudioObjectType = 32 + _gb.ReadBits(6);
            }

            _this.SamplingFrequencyIndex = _gb.ReadBits(4);
            if (_this.SamplingFrequencyIndex === 0xF) {
                _this.SamplingFrequency = _gb.ReadBits(24);
            } else {
                _this.SamplingFrequency = SamplingFrequencys[_this.SamplingFrequencyIndex];
            }
            _info.SampleRate = _this.SamplingFrequency;

            _this.ChannelConfiguration = _gb.ReadBits(4);
            if (_this.ChannelConfiguration < 16) {
                _this.Channels = Channels[_this.ChannelConfiguration];
                _info.Channels = _this.Channels;
            }

            if (_this.AudioObjectType === AOT.SBR || (_this.AudioObjectType === AOT.PS &&
                // Check for W6132 Annex YYYY draft MP3onMP4
                (_gb.ShowBits(3) & 0x03) === 0 && (_gb.ShowBits(9) & 0x3F) === 0)) {
                _this.ExtensionSamplingFrequencyIndex = _gb.ReadBits(4);
                if (_this.ExtensionSamplingFrequencyIndex === 0xF) {
                    _this.ExtensionSamplingFrequency = _gb.ReadBits(24);
                } else {
                    _this.ExtensionSamplingFrequency = SamplingFrequencys[_this.ExtensionSamplingFrequencyIndex];
                }
                _info.SampleRate = _this.ExtensionSamplingFrequency;

                _this.ExtensionAudioObjectType = _gb.ReadBits(5);
                switch (_this.ExtensionAudioObjectType) {
                    case AOT.ESCAPE:
                        _this.ExtensionAudioObjectType = 32 + _gb.ReadBits(6);
                        break;
                    case AOT.ER_BSAC:
                        _this.ExtensionChannelConfiguration = _gb.ReadBits(4);
                        _this.Channels = Channels[_this.ExtensionChannelConfiguration];
                        _info.Channels = _this.Channels;
                        break;
                }
            } else {
                _this.ExtensionAudioObjectType = AOT.NULL;
                _this.ExtensionSamplingFrequency = 0;
            }

            if (_this.AudioObjectType === AOT.ALS) {
                _gb.ShowBits(5);
                if (_gb.ShowBitsLong(24) !== 0x00414C53) { // "\0ALS"
                    _gb.SkipBits(24);
                }

                try {
                    _parseConfigALS();
                } catch (err) {
                    _logger.error('Failed to parse AAC config ALS.');
                    _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
                    return;
                }
            }

            _this.RefSampleDuration = Math.floor(_info.Timescale * 1024 / _this.SamplingFrequency);

            // Force to AOT.SBR
            _this.AudioObjectType = AOT.SBR;
            _this.ExtensionSamplingFrequencyIndex = _this.SamplingFrequencyIndex;
            if (_this.SamplingFrequencyIndex >= 6) {
                _this.ExtensionSamplingFrequencyIndex -= 3;
            } else if (_this.ChannelConfiguration === 1) { // Mono channel
                _this.AudioObjectType = AOT.AAC_LC;
            }

            if (_this.AudioObjectType === AOT.SBR) {
                _this.Config = new Uint8Array([
                    _this.AudioObjectType << 3 | _this.SamplingFrequencyIndex >> 1,
                    _this.SamplingFrequencyIndex << 7 | _this.ChannelConfiguration << 3 | _this.ExtensionSamplingFrequencyIndex >> 1,
                    _this.ExtensionSamplingFrequencyIndex << 7 | 0x08,
                    0x00,
                ]);
            } else {
                _this.Config = new Uint8Array([
                    _this.AudioObjectType << 3 | _this.SamplingFrequencyIndex >> 1,
                    _this.SamplingFrequencyIndex << 7 | _this.ChannelConfiguration << 3,
                ]);
            }

            _this.Codec = 'mp4a.40.' + _this.AudioObjectType;
            _info.Codecs.push(_this.Codec);
            _this.dispatchEvent(MediaEvent.AAC_SPECIFIC_CONFIG, { packet: pkt });
        }

        function _parseRawFrameData(pkt) {
            _info.AudioTimestamp = pkt.timestamp;

            var delta = pkt.timestamp - _info.AudioTimestamp;
            var count = Math.ceil(delta / _this.RefSampleDuration);
            for (var i = 0; i < count - 1; i++) {
                var tmp = new AV.Packet();
                tmp.kind = Packet.KindAudio;
                tmp.codec = pkt.codec;
                tmp.timestamp = _info.AudioTimestamp + _this.RefSampleDuration;
                tmp.streamid = pkt.streamid;
                tmp.payload = _getSilentFrame();
                if (tmp.payload === undefined) {
                    _logger.warn('Failed to get silent frame: AudioObjectType=' + _this.AudioObjectType + ', Channels=' + _this.Channels);
                    break;
                }
                tmp.length = tmp.payload.byteLength;
                tmp.set('DTS', _info.TimeBase + tmp.timestamp);
                tmp.set('PTS', tmp.get('DTS'));
                tmp.set('Data', tmp.payload);

                _logger.warn('Generates silent frame: ' + tmp.timestamp);
                _info.AudioTimestamp = tmp.timestamp;
                _this.dispatchEvent(MediaEvent.AAC_SAMPLE, { packet: tmp });
            }

            pkt.set('DTS', _info.TimeBase + pkt.timestamp);
            pkt.set('PTS', pkt.get('DTS'));
            pkt.set('Data', pkt.payload.subarray(pkt.position));
            _this.dispatchEvent(MediaEvent.AAC_SAMPLE, { packet: pkt });
        }

        function _parseConfigALS() {
            if (_gb.Left() < 112) {
                throw { name: 'DataError', message: 'Data not enough while parsing ALS config.' };
            }

            if (_gb.ReadBitsLong(32) !== 0x414C5300) { // "ALS\0"
                throw { name: 'TypeError', message: 'Not ALS\\0' };
            }

            // Override AudioSpecificConfig channel configuration and sample rate
            // which are buggy in old ALS conformance files
            _this.SamplingFrequency = _gb.ReadBitsLong(32);
            _info.SampleRate = _this.SamplingFrequency;

            // Skip number of samples
            _gb.SkipBits(32);

            // Read number of channels
            _this.ChannelConfiguration = 0;
            _this.Channels = _gb.ReadBits(16) + 1;
            _info.Channels = _this.Channels;
        }

        function _getSilentFrame() {
            switch (_this.AudioObjectType) {
                case AAC_LC:
                    return SilentFramesOfLC[_this.Channels];
                default: // SBR, PS
                    return SilentFramesOfSBR[_this.Channels];
            }
        }

        _init();
    }

    AAC.prototype = Object.create(EventDispatcher.prototype);
    AAC.prototype.constructor = AAC;
    AAC.prototype.kind = 'AAC';

    AAC.DataTypes = DataTypes;
    AAC.AOT = AOT;
    AAC.SamplingFrequencys = SamplingFrequencys;
    AAC.Channels = Channels;
    AAC.SilentFramesOfLC = SilentFramesOfLC;
    AAC.SilentFramesOfSBR = SilentFramesOfSBR;
    Codec.register(AAC);
})(odd);

