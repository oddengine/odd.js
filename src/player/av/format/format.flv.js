(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        Event = events.Event,
        MediaEvent = events.MediaEvent,
        AV = odd.AV,
        Packet = AV.Packet,
        Format = AV.Format,
        MediaStream = Format.MediaStream,

        Tags = {
            AUDIO: 0x08,
            VIDEO: 0x09,
            SCRIPT: 0x12,
        },
        Frames = {
            KEYFRAME: 0x1,
            INTER_FRAME: 0x2,
            DISPOSABLE_INTER_FRAME: 0x3,
            GENERATED_KEYFRAME: 0x4,
            INFO_OR_COMMAND_FRAME: 0x5,
        },
        Formats = {
            LINEAR_PCM_PLATFORM_ENDIAN: 0x0,
            ADPCM: 0x1,
            MP3: 0x2,
            LINEAR_PCM_LITTLE_ENDIAN: 0x3,
            NELLYMOSER_16_kHz_MONO: 0x4,
            NELLYMOSER_8_kHz_MONO: 0x5,
            NELLYMOSER: 0x6,
            G_711_A_LAW_LOGARITHMIC_PCM: 0x7,
            G_711_MU_LAW_LOGARITHMIC_PCM: 0x8,
            RESERVED: 0x9,
            AAC: 0xA,
            SPEEX: 0xB,
            MP3_8_kHz: 0xE,
            DEVICE_SPECIFIC_SOUND: 0xF,
        },
        Rates = [5500, 11025, 22050, 44100],
        Codecs = {
            JPEG: 0x1,
            H263: 0x2,
            SCREEN_VIDEO: 0x3,
            VP6: 0x4,
            VP6_ALPHA: 0x5,
            SCREEN_VIDEO_2: 0x6,
            AVC: 0x7,
        },
        sw = {
            f: 0,
            l: 1,
            v: 2,
            version: 3,
            flags: 4,
            header0: 5,
            header1: 6,
            header2: 7,
            header3: 8,
            backpointer0: 9,
            backpointer1: 10,
            backpointer2: 11,
            backpointer3: 12,
            type: 13,
            length0: 14,
            length1: 15,
            length2: 16,
            timestamp0: 17,
            timestamp1: 18,
            timestamp2: 19,
            timestamp3: 20,
            streamid0: 21,
            streamid1: 22,
            streamid2: 23,
            payload: 24,
        };

    function FLV(logger) {
        MediaStream.call(this, 'FLV', { logger: logger }, [MediaEvent.PACKET], [Event.ERROR]);

        var _this = this,
            _logger = logger,
            _state,
            _backpointer,
            _packet;

        function _init() {
            _state = sw.f;
            _backpointer = 0;
            _this.hasAudio = false;
            _this.hasVideo = false;
        }

        _this.append = function (buffer) {
            var data = new Uint8Array(buffer);

            for (var i = 0; i < data.byteLength; i++) {
                switch (_state) {
                    case sw.f:
                        if (data[i] !== 0x46) {
                            _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Not \"F\"' });
                            return;
                        }
                        _state = sw.l;
                        break;

                    case sw.l:
                        if (data[i] !== 0x4C) {
                            _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Not \"L\"' });
                            return;
                        }
                        _state = sw.v;
                        break;

                    case sw.v:
                        if (data[i] !== 0x56) {
                            _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Not \"V\"' });
                            return;
                        }
                        _state = sw.version;
                        break;

                    case sw.version:
                        if (data[i] !== 0x01) {
                            // Not strict
                        }
                        _state = sw.flags;
                        break;

                    case sw.flags:
                        _this.hasAudio = !!(data[i] & 0x04);
                        _this.hasVideo = !!(data[i] & 0x01);
                        _logger.log('Flags: hasAudio=' + _this.hasAudio + ', hasVideo=' + _this.hasVideo);
                        if (!_this.hasAudio && !_this.hasVideo) {
                            // Not strict
                        }
                        _state = sw.header0;
                        break;

                    case sw.header0:
                        _state = sw.header1;
                        break;

                    case sw.header1:
                        _state = sw.header2;
                        break;

                    case sw.header2:
                        _state = sw.header3;
                        break;

                    case sw.header3:
                        _state = sw.backpointer0;
                        break;

                    case sw.backpointer0:
                        _backpointer = data[i] << 24;
                        _state = sw.backpointer1;
                        break;

                    case sw.backpointer1:
                        _backpointer |= data[i] << 16;
                        _state = sw.backpointer2;
                        break;

                    case sw.backpointer2:
                        _backpointer |= data[i] << 8;
                        _state = sw.backpointer3;
                        break;

                    case sw.backpointer3:
                        _backpointer |= data[i];
                        _state = sw.type;
                        break;

                    case sw.type:
                        _packet = new AV.Packet();
                        switch (data[i]) {
                            case Tags.AUDIO:
                                _packet.kind = Packet.KindAudio;
                                break;
                            case Tags.VIDEO:
                                _packet.kind = Packet.KindVideo;
                                break;
                            case Tags.SCRIPT:
                                _packet.kind = Packet.KindScript;
                                break;
                            default:
                                _this.dispatchEvent(Event.ERROR, { name: 'TypeError', message: 'Unrecognized flv tag ' + utils.hex(data[i]) + '.' });
                                return;
                        }
                        _state = sw.length0;
                        break;

                    case sw.length0:
                        _packet.length = data[i] << 16;
                        _state = sw.length1;
                        break;

                    case sw.length1:
                        _packet.length |= data[i] << 8;
                        _state = sw.length2;
                        break;

                    case sw.length2:
                        _packet.length |= data[i];
                        _packet.payload = new Uint8Array(_packet.length);
                        _packet.position = 0;
                        _state = sw.timestamp0;
                        break;

                    case sw.timestamp0:
                        _packet.timestamp = data[i] << 16;
                        _state = sw.timestamp1;
                        break;

                    case sw.timestamp1:
                        _packet.timestamp |= data[i] << 8;
                        _state = sw.timestamp2;
                        break;

                    case sw.timestamp2:
                        _packet.timestamp |= data[i];
                        _state = sw.timestamp3;
                        break;

                    case sw.timestamp3:
                        _packet.timestamp |= data[i] << 24;
                        _state = sw.streamid0;
                        break;

                    case sw.streamid0:
                        _packet.streamid = data[i] << 16;
                        _state = sw.streamid1;
                        break;

                    case sw.streamid1:
                        _packet.streamid |= data[i] << 8;
                        _state = sw.streamid2;
                        break;

                    case sw.streamid2:
                        _packet.streamid |= data[i];
                        _state = sw.payload;
                        break;

                    case sw.payload:
                        var n = Math.min(_packet.length - _packet.position, data.byteLength - i);
                        _packet.payload.set(data.subarray(i, i + n), _packet.position);
                        _packet.position += n;
                        i += n - 1;

                        if (_packet.position === _packet.length) {
                            switch (_packet.kind) {
                                case Packet.KindAudio:
                                    _packet.set('Format', (_packet.payload[0] >> 4) & 0x0F);
                                    _packet.set('SampleRate', (_packet.payload[0] >> 2) & 0x03);
                                    _packet.set('SampleSize', (_packet.payload[0] >> 1) & 0x01);
                                    _packet.set('SampleType', _packet.payload[0] & 0x01);
                                    _packet.set('DataType', _packet.payload[1]); // Extra parsing
                                    _packet.position = 1;
                                    break;
                                case Packet.KindVideo:
                                    _packet.set('FrameType', (_packet.payload[0] >> 4) & 0x0F);
                                    _packet.set('Codec', _packet.payload[0] & 0x0F);
                                    _packet.set('DataType', _packet.payload[1]); // Extra parsing
                                    _packet.set('Keyframe', _packet.get('FrameType') === Frames.KEYFRAME);
                                    _packet.position = 1;
                                    break;
                                case Packet.KindScript:
                                    _packet.position = 0;
                                    break;
                            }
                            _this.dispatchEvent(MediaEvent.PACKET, { packet: _packet });
                            _state = sw.backpointer0;
                        }
                        break;

                    default:
                        _this.dispatchEvent(Event.ERROR, { name: 'InvalidStateError', message: 'Invalid state while parsing flv tag.' });
                        return;
                }
            }
        };

        _this.reset = function () {
            _init();
            _this.close();
        };

        _init();
    }

    FLV.prototype = Object.create(MediaStream.prototype);
    FLV.prototype.constructor = FLV;
    FLV.prototype.kind = 'FLV';

    FLV.Tags = Tags;
    FLV.Frames = Frames;
    FLV.Formats = Formats;
    FLV.Rates = Rates;
    FLV.Codecs = Codecs;
    Format.FLV = FLV;
})(odd);

