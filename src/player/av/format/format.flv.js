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
            OPUS: 0x9,
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
            HEVC: 0xC,
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
            _parsing,
            _backpointer,
            _packet;

        function _init() {
            _parsing = sw.f;
            _backpointer = 0;
            _this.hasAudio = false;
            _this.hasVideo = false;
        }

        _this.append = function (buffer) {
            var data = new Uint8Array(buffer);

            for (var i = 0; i < data.byteLength; i++) {
                switch (_parsing) {
                    case sw.f:
                        if (data[i] !== 0x46) {
                            _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Not \"F\"' });
                            return;
                        }
                        _parsing = sw.l;
                        break;

                    case sw.l:
                        if (data[i] !== 0x4C) {
                            _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Not \"L\"' });
                            return;
                        }
                        _parsing = sw.v;
                        break;

                    case sw.v:
                        if (data[i] !== 0x56) {
                            _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Not \"V\"' });
                            return;
                        }
                        _parsing = sw.version;
                        break;

                    case sw.version:
                        if (data[i] !== 0x01) {
                            // Not strict
                        }
                        _parsing = sw.flags;
                        break;

                    case sw.flags:
                        _this.hasAudio = !!(data[i] & 0x04);
                        _this.hasVideo = !!(data[i] & 0x01);
                        _logger.log('Flags: hasAudio=' + _this.hasAudio + ', hasVideo=' + _this.hasVideo);
                        if (!_this.hasAudio && !_this.hasVideo) {
                            // Not strict
                        }
                        _parsing = sw.header0;
                        break;

                    case sw.header0:
                        _parsing = sw.header1;
                        break;

                    case sw.header1:
                        _parsing = sw.header2;
                        break;

                    case sw.header2:
                        _parsing = sw.header3;
                        break;

                    case sw.header3:
                        _parsing = sw.backpointer0;
                        break;

                    case sw.backpointer0:
                        _backpointer = data[i] << 24;
                        _parsing = sw.backpointer1;
                        break;

                    case sw.backpointer1:
                        _backpointer |= data[i] << 16;
                        _parsing = sw.backpointer2;
                        break;

                    case sw.backpointer2:
                        _backpointer |= data[i] << 8;
                        _parsing = sw.backpointer3;
                        break;

                    case sw.backpointer3:
                        _backpointer |= data[i];
                        _parsing = sw.type;
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
                        _parsing = sw.length0;
                        break;

                    case sw.length0:
                        _packet.length = data[i] << 16;
                        _parsing = sw.length1;
                        break;

                    case sw.length1:
                        _packet.length |= data[i] << 8;
                        _parsing = sw.length2;
                        break;

                    case sw.length2:
                        _packet.length |= data[i];
                        _packet.payload = new Uint8Array(_packet.length);
                        _packet.position = 0;
                        _parsing = sw.timestamp0;
                        break;

                    case sw.timestamp0:
                        _packet.timestamp = data[i] << 16;
                        _parsing = sw.timestamp1;
                        break;

                    case sw.timestamp1:
                        _packet.timestamp |= data[i] << 8;
                        _parsing = sw.timestamp2;
                        break;

                    case sw.timestamp2:
                        _packet.timestamp |= data[i];
                        _parsing = sw.timestamp3;
                        break;

                    case sw.timestamp3:
                        _packet.timestamp |= data[i] << 24;
                        _parsing = sw.streamid0;
                        break;

                    case sw.streamid0:
                        _packet.streamid = data[i] << 16;
                        _parsing = sw.streamid1;
                        break;

                    case sw.streamid1:
                        _packet.streamid |= data[i] << 8;
                        _parsing = sw.streamid2;
                        break;

                    case sw.streamid2:
                        _packet.streamid |= data[i];
                        _parsing = sw.payload;
                        break;

                    case sw.payload:
                        var n = Math.min(_packet.length - _packet.position, data.byteLength - i);
                        _packet.payload.set(data.subarray(i, i + n), _packet.position);
                        _packet.position += n;
                        i += n - 1;

                        if (_packet.position === _packet.length) {
                            switch (_packet.kind) {
                                case Packet.KindAudio:
                                    if (_packet.length < 2) {
                                        _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Incomplete FLV audio header.' });
                                        return;
                                    }
                                    var format = _packet.payload[0] >> 4;
                                    var type = _packet.payload[1];
                                    _packet.position = 2;
                                    if (format === 9) {
                                        if (_packet.length < 5) {
                                            _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Incomplete enhanced audio header.' });
                                            return;
                                        }
                                        var fourcc = String.fromCharCode.apply(null, _packet.payload.subarray(1, 5));
                                        if (fourcc !== 'Opus' && fourcc !== 'mp4a') {
                                            _this.dispatchEvent(Event.ERROR, { name: 'NotSupportedError', message: 'Unsupported enhanced audio codec.' });
                                            return;
                                        }
                                        format = fourcc === 'Opus' ? Formats.OPUS : Formats.AAC;
                                        type = _packet.payload[0] & 15;
                                        _packet.position = 5;
                                    }
                                    if (type > 2 || (format === Formats.AAC && (_packet.payload[0] >> 4) !== 9 && type === 2)) {
                                        _this.dispatchEvent(Event.ERROR, { name: 'NotSupportedError', message: 'Unsupported audio packet type.' });
                                        return;
                                    }
                                    _packet.set('Format', format);
                                    _packet.set('DataType', type);
                                    _packet.set('CTS', 0);
                                    break;
                                case Packet.KindVideo:
                                    if (_packet.length < 5) {
                                        _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Incomplete FLV video header.' });
                                        return;
                                    }
                                    _packet.set('FrameType', (_packet.payload[0] >> 4) & 15);
                                    _packet.set('Codec', _packet.payload[0] & 15);
                                    _packet.set('DataType', _packet.payload[1]);
                                    var cts = _packet.payload[2] << 16 | _packet.payload[3] << 8 | _packet.payload[4];
                                    cts = cts & 0x800000 ? cts - 0x1000000 : cts;
                                    if ((_packet.payload[0] & 0x80) || _packet.payload[1] > 2 || cts !== 0) {
                                        _this.dispatchEvent(Event.ERROR, { name: 'NotSupportedError', message: 'Unsupported FLV video header or composition time.' });
                                        return;
                                    }
                                    _packet.set('CTS', cts);
                                    _packet.set('Keyframe', _packet.get('FrameType') === Frames.KEYFRAME);
                                    _packet.position = 5;
                                    break;
                                case Packet.KindScript:
                                    _packet.position = 0;
                                    break;
                            }
                            if (_packet.get('DataType') === 2 && _packet.position !== _packet.length) {
                                throw { name: 'DataError', message: 'Unexpected sequence end payload.' };
                            }
                            _this.dispatchEvent(MediaEvent.PACKET, { packet: _packet });
                            _parsing = sw.backpointer0;
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

