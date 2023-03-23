(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        MediaEvent = events.MediaEvent,
        AV = odd.AV,
        Codec = AV.Codec,

        DataTypes = {
            SEQUENCE_HEADER: 0x00,
            NALU: 0x01,
            END_OF_SEQUENCE: 0x02,
        },
        NAL = {
            SLICE: 1,
            DPA: 2,
            DPB: 3,
            DPC: 4,
            IDR_SLICE: 5,
            SEI: 6,
            SPS: 7,
            PPS: 8,
            AUD: 9,
            END_SEQUENCE: 10,
            END_STREAM: 11,
            FILLER_DATA: 12,
            SPS_EXT: 13,
            AUXILIARY_SLICE: 19,
            FF_IGNORE: 0xFF0F001,
        };

    function AVC(info, logger) {
        EventDispatcher.call(this, 'AVC', { logger: logger }, MediaEvent, [Event.ERROR]);

        var _this = this,
            _info = info,
            _logger = logger;

        function _init() {
            _this.MimeType = 'video/mp4';
            _this.Codec = '';
            _this.RefSampleDuration = Math.floor(_info.Timescale * info.FrameRate.Den / info.FrameRate.Num);

            // Decoder Configuration Record
            _this.AVCC = null;              // Uint8Array
            _this.ConfigurationVersion = 0; // byte
            _this.ProfileIndication = 0;    // byte
            _this.ProfileCompatibility = 0; // byte
            _this.LevelIndication = 0;      // byte
            _this.NalLengthSize = 0;        // byte: 0x03 + 1, length_size_minus1 + 1
            _this.SPS = new AVC.SPS(_info, _logger);
            _this.PPS = new AVC.PPS(_this.SPS, _logger);
            _this.Flags = {
                IsLeading: 0,
                SampleDependsOn: 0,
                SampleIsDependedOn: 0,
                SampleHasRedundancy: 0,
                IsNonSync: 0,
            };
        }

        _this.parse = function (pkt) {
            if (pkt.left() < 4) {
                _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Data not enough while parsing AVC packet.' });
                return;
            }

            _info.Timestamp = Math.max(pkt.timestamp, _info.AudioTimestamp);

            var v = new DataView(pkt.payload.buffer);
            pkt.set('DataType', v.getUint8(pkt.position++));
            pkt.set('CTS', v.getUint8(pkt.position++) << 16 | v.getUint8(pkt.position++) << 8 | v.getUint8(pkt.position++)); // CompositionTime

            switch (pkt.get('DataType')) {
                case DataTypes.SEQUENCE_HEADER:
                    _info.MimeType = _this.MimeType;
                    _parseDecoderConfigurationRecord(pkt);
                    break;
                case DataTypes.NALU:
                    _parseNalUnits(pkt);
                    break;
                case DataTypes.END_OF_SEQUENCE:
                    _logger.debug('AVC sequence end.');
                    _this.dispatchEvent(MediaEvent.END_OF_STREAM, { packet: pkt });
                    break;
                default:
                    _this.dispatchEvent(Event.ERROR, { name: 'TypeError', message: 'Unrecognized AVC packet type: ' + pkt.get('DataType') });
                    break;
            }
        };

        function _parseDecoderConfigurationRecord(pkt) {
            if (pkt.left() < 7) {
                _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Data not enough while parsing AVC decoder configuration record.' });
                return;
            }

            _this.AVCC = pkt.payload.subarray(pkt.position);

            var i = 0;
            var v = new DataView(pkt.payload.buffer, pkt.position);

            _this.ConfigurationVersion = v.getUint8(i++);
            _this.ProfileIndication = v.getUint8(i++);
            _this.ProfileCompatibility = v.getUint8(i++);
            _this.LevelIndication = v.getUint8(i++);
            if (_this.ConfigurationVersion !== 1 || _this.ProfileIndication === 0) {
                _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Invalid AVC configuration version or profile.' });
                return;
            }

            _this.NalLengthSize = (v.getUint8(i++) & 0x03) + 1;
            if (_this.NalLengthSize === 3) {
                _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Invalid NalLengthSize ' + _this.NalLengthSize });
                return;
            }

            var numOfSequenceParameterSets = v.getUint8(i++) & 0x1F;
            for (var j = 0; j < numOfSequenceParameterSets; j++) {
                var sequenceParameterSetLength = v.getUint16(i);
                i += 2;

                if (sequenceParameterSetLength === 0) {
                    continue;
                }

                var sps = _this.AVCC.subarray(i, i + sequenceParameterSetLength);
                i += sequenceParameterSetLength;
                try {
                    _this.SPS.parse(sps);
                    _this.RefSampleDuration = Math.floor(_info.Timescale * info.FrameRate.Den / info.FrameRate.Num);
                } catch (err) {
                    // Ignore parsing issue, leave it to the decoder.
                    _logger.warn(err.name + ': ' + err.message);
                    break;
                }
            }

            var numOfPictureParameterSets = v.getUint8(i++);
            for (var j = 0; j < numOfPictureParameterSets; j++) {
                var pictureParameterSetLength = v.getUint16(i);
                i += 2;

                if (pictureParameterSetLength === 0) {
                    continue;
                }

                // PPS is useless for extracting video information.
                // var pps = _this.AVCC.subarray(i, i + pictureParameterSetLength);
                i += pictureParameterSetLength;
                // try {
                //     _this.PPS.parse(pps);
                // } catch (err) {
                //     // Ignore parsing issue, leave it to the decoder.
                //     _logger.warn(err.name + ': ' + err.message);
                //     break;
                // }
            }

            _this.Codec = _this.SPS.Codec;
            _info.Codecs.push(_this.Codec);
            _this.dispatchEvent(MediaEvent.AVC_CONFIG_RECORD, { packet: pkt });
        }

        function _parseNalUnits(pkt) {
            _info.VideoTimestamp = pkt.timestamp;

            var i = 0;
            var v = new DataView(pkt.payload.buffer, pkt.position);
            var data = pkt.payload.subarray(pkt.position);
            var nalus = [];

            pkt.set('DTS', _info.TimeBase + pkt.timestamp);
            pkt.set('PTS', pkt.get('CTS') + pkt.get('DTS'));
            pkt.set('Data', data);
            pkt.set('NALUs', nalus);

            while (i < v.byteLength) {
                if (i + 4 >= v.byteLength) {
                    _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Data not enough for next NALU.' });
                    return;
                }

                var naluSize = 0;
                for (var j = 0; j < _this.NalLengthSize; j++) { // NalLengthSize: 1, 2 or 4 bytes
                    naluSize = naluSize << 8 | v.getUint8(i + j);
                }
                i += _this.NalLengthSize;

                if (i + naluSize > v.byteLength) {
                    _this.dispatchEvent(Event.ERROR, { name: 'DataError', message: 'Malformed Nalus near timestamp ' + pkt.get('DTS') + '.' });
                    return;
                }

                var header = v.getUint8(i);
                pkt.set('ForbiddenZeroBit', (header >> 7) & 0x01);
                pkt.set('NalRefIdc', (header >> 5) & 0x03);
                pkt.set('NalUnitType', header & 0x1F);
                if (pkt.get('ForbiddenZeroBit') !== 0) {
                    _logger.warn('Invalid NAL unit ' + pkt.get('NalUnitType') + ', skipping.');
                    return;
                }
                if (pkt.get('NalUnitType') === NAL.IDR_SLICE) {
                    pkt.set('Keyframe', true);
                }
                // _logger.log(`timestamp=${pkt.timestamp}, CTS=${pkt.get('CTS')}, i=${i}, NalRefIdc=${pkt.get('NalRefIdc')}, NalUnitType=${pkt.get('NalUnitType')}, size=${naluSize}`);

                var nalu = data.subarray(i, i + naluSize);
                if (nalu.length < naluSize) {
                    _logger.warn('Invalid NAL unit size (' + naluSize + ' > ' + nalu.length + ').');
                }
                nalus.push(nalu);

                if (pkt.get('NalUnitType') === NAL.SEI) {
                    _this.dispatchEvent(MediaEvent.SEI, { packet: pkt, nalu: nalu });
                }

                i += naluSize;
            }

            _this.dispatchEvent(MediaEvent.AVC_SAMPLE, { packet: pkt });
        }

        _init();
    }

    AVC.prototype = Object.create(EventDispatcher.prototype);
    AVC.prototype.constructor = AVC;
    AVC.prototype.kind = 'AVC';

    AVC.DataTypes = DataTypes;
    AVC.NAL = NAL;
    Codec.register(AVC);
})(odd);

