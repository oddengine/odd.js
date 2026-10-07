(function (odd) {
    var utils = odd.utils,
        Golomb = utils.Golomb,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        MediaEvent = events.MediaEvent,
        Codec = odd.AV.Codec,

        DataTypes = {
            SEQUENCE_HEADER: 0,
            NALU: 1,
            END_OF_SEQUENCE: 2,
        };

    function HEVC(info, logger) {
        EventDispatcher.call(this, 'HEVC', { logger: logger }, MediaEvent, [Event.ERROR]);

        var _this = this,
            _info = info,
            _started;

        function _init() {
            _started = false;
            _this.MimeType = 'video/mp4';
            _this.Codec = '';
            _this.HVCC = null;
            _this.NalLengthSize = 0;
            _this.RefSampleDuration = Math.floor(_info.Timescale * _info.FrameRate.Den / _info.FrameRate.Num);
            _this.Flags = {
                IsLeading: 0,
                SampleDependsOn: 0,
                SampleIsDependedOn: 0,
                SampleHasRedundancy: 0,
                IsNonSync: 0,
            };
        }

        _this.parse = function (pkt) {
            _info.Timestamp = Math.max(pkt.timestamp, _info.AudioTimestamp);

            switch (pkt.get('DataType')) {
                case DataTypes.SEQUENCE_HEADER:
                    _parseDecoderConfigurationRecord(pkt);
                    break;
                case DataTypes.NALU:
                    _parseNalUnits(pkt);
                    break;
                case DataTypes.END_OF_SEQUENCE:
                    _started = false;
                    _this.dispatchEvent(MediaEvent.ENDOFSTREAM, { packet: pkt });
                    break;
            }
        };

        function _parseDecoderConfigurationRecord(pkt) {
            var data = pkt.payload.subarray(pkt.position);
            if (data.length < 23 || data[0] !== 1 || (data[21] & 3) === 2) {
                throw { name: 'DataError', message: 'Invalid HEVC decoder configuration record.' };
            }

            var view = new DataView(data.buffer, data.byteOffset, data.byteLength);
            var position = 23;
            var vps = false;
            var sps;
            var pps = false;
            for (var i = 0; i < data[22]; i++) {
                if (position + 3 > data.length) {
                    throw { name: 'DataError', message: 'Incomplete HEVC parameter array.' };
                }
                var type = data[position++] & 63;
                var count = view.getUint16(position);
                position += 2;

                for (var j = 0; j < count; j++) {
                    if (position + 2 > data.length) {
                        throw { name: 'DataError', message: 'Incomplete HEVC parameter length.' };
                    }
                    var length = view.getUint16(position);
                    position += 2;
                    if (length < 2 || position + length > data.length || ((data[position] >> 1) & 63) !== type) {
                        throw { name: 'DataError', message: 'Invalid HEVC parameter NAL.' };
                    }
                    if (type === 32) {
                        vps = true;
                    } else if (type === 33 && !sps) {
                        sps = data.subarray(position, position + length);
                    } else if (type === 34) {
                        pps = true;
                    }
                    position += length;
                }
            }
            if (!vps || !sps || !pps || position !== data.length) {
                throw { name: 'DataError', message: 'Missing or invalid HEVC parameter sets.' };
            }
            var geometry = _parseGeometry(sps);

            var compatibility = view.getUint32(2);
            var reversed = 0;
            for (var i = 0; i < 32; i++) {
                reversed = reversed * 2 + (compatibility & 1);
                compatibility >>>= 1;
            }
            var codec = 'hvc1.' + ['', 'A', 'B', 'C'][data[1] >> 6] + (data[1] & 31) + '.' + reversed.toString(16).toUpperCase();
            codec += '.' + ((data[1] & 32) ? 'H' : 'L') + data[12];
            var last = 11;
            while (last >= 6 && data[last] === 0) {
                last--;
            }
            for (var i = 6; i <= last; i++) {
                codec += '.' + data[i].toString(16).toUpperCase();
            }

            _this.NalLengthSize = (data[21] & 3) + 1;
            _this.HVCC = new Uint8Array(data);
            _this.HVCC[21] |= 3;
            _this.Codec = codec;
            _info.CodecWidth = geometry.width;
            _info.CodecHeight = geometry.height;
            _info.Width = geometry.width;
            _info.Height = geometry.height;
            _info.MimeType = _this.MimeType;
            _info.Codecs.push(codec);
            _this.dispatchEvent(MediaEvent.HEVCCONFIGRECORD, { packet: pkt });
        }

        function _parseGeometry(nalu) {
            var bits = new Golomb(utils.ebsp2rbsp(nalu.subarray(2)));
            bits.SkipBits(4);
            var layers = bits.ReadBits(3);
            if (layers > 6) {
                throw { name: 'DataError', message: 'Invalid HEVC sublayer count.' };
            }
            bits.SkipBits(1);
            bits.SkipBits(96);

            var profiles = [];
            var levels = [];
            for (var i = 0; i < layers; i++) {
                profiles.push(bits.ReadBits(1));
                levels.push(bits.ReadBits(1));
            }
            if (layers) {
                bits.SkipBits((8 - layers) * 2);
            }
            for (var i = 0; i < layers; i++) {
                if (profiles[i]) {
                    bits.SkipBits(88);
                }
                if (levels[i]) {
                    bits.SkipBits(8);
                }
            }

            bits.ReadUE();
            var chroma = bits.ReadUE();
            if (chroma > 3) {
                throw { name: 'DataError', message: 'Invalid HEVC chroma format.' };
            }
            var separate = chroma === 3 ? bits.ReadBits(1) : 0;
            var width = bits.ReadUE();
            var height = bits.ReadUE();
            if (bits.ReadBits(1)) {
                var left = bits.ReadUE();
                var right = bits.ReadUE();
                var top = bits.ReadUE();
                var bottom = bits.ReadUE();
                var format = separate ? 0 : chroma;
                width -= (left + right) * (format === 1 || format === 2 ? 2 : 1);
                height -= (top + bottom) * (format === 1 ? 2 : 1);
            }
            if (bits.Left() < 0 || !width || !height || width < 0 || height < 0 || width > 65535 || height > 65535) {
                throw { name: 'DataError', message: 'Invalid HEVC picture size.' };
            }
            return { width: width, height: height };
        }

        function _parseNalUnits(pkt) {
            if (!_this.HVCC) {
                throw { name: 'InvalidStateError', message: 'HEVC configuration is missing.' };
            }

            var position = pkt.position;
            var nalus = [];
            var size = 0;
            var keyframe = false;
            while (position < pkt.payload.length) {
                if (position + _this.NalLengthSize > pkt.payload.length) {
                    throw { name: 'DataError', message: 'Incomplete HEVC NAL length.' };
                }
                var length = 0;
                for (var i = 0; i < _this.NalLengthSize; i++) {
                    length = length * 256 + pkt.payload[position++];
                }
                if (length < 2 || position + length > pkt.payload.length) {
                    throw { name: 'DataError', message: 'Invalid HEVC NAL length.' };
                }
                var type = (pkt.payload[position] >> 1) & 63;
                keyframe = keyframe || type === 19 || type === 20;
                nalus.push(pkt.payload.subarray(position, position + length));
                position += length;
                size += 4 + length;
            }
            if (!nalus.length || (!_started && !keyframe)) {
                return;
            }
            _started = true;

            var data = new Uint8Array(size);
            var view = new DataView(data.buffer);
            position = 0;
            for (var nalu of nalus) {
                view.setUint32(position, nalu.length);
                data.set(nalu, position + 4);
                position += 4 + nalu.length;
            }
            _this.Flags.SampleDependsOn = keyframe ? 2 : 1;
            _this.Flags.IsNonSync = keyframe ? 0 : 1;
            _info.VideoTimestamp = pkt.timestamp;
            pkt.set('Keyframe', keyframe);
            pkt.set('DTS', _info.TimeBase + pkt.timestamp);
            pkt.set('PTS', pkt.get('DTS'));
            pkt.set('Data', data);
            pkt.set('NALUs', nalus);
            _this.dispatchEvent(MediaEvent.HEVCSAMPLE, { packet: pkt });
        }

        _init();
    }

    HEVC.prototype = Object.create(EventDispatcher.prototype);
    HEVC.prototype.constructor = HEVC;
    HEVC.prototype.kind = 'HEVC';
    HEVC.DataTypes = DataTypes;
    Codec.register(HEVC);
})(odd);
