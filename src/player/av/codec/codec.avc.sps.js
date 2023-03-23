(function (odd) {
    var utils = odd.utils,
        Golomb = utils.Golomb,
        AV = odd.AV,
        Rational = AV.Rational,
        Codec = AV.Codec,
        AVC = Codec.AVC,

        MAX_PICTURE_COUNT = 36,
        MAX_SPS_COUNT = 32,
        MAX_LOG2_MAX_FRAME_NUM = 12 + 4,
        MIN_LOG2_MAX_FRAME_NUM = 4,
        EXTENDED_SAR = 255,

        PixelAspect = [
            new Rational(0, 1),
            new Rational(1, 1),
            new Rational(12, 11),
            new Rational(10, 11),
            new Rational(16, 11),
            new Rational(40, 33),
            new Rational(24, 11),
            new Rational(20, 11),
            new Rational(32, 11),
            new Rational(80, 33),
            new Rational(18, 11),
            new Rational(15, 11),
            new Rational(64, 33),
            new Rational(160, 99),
            new Rational(4, 3),
            new Rational(3, 2),
            new Rational(2, 1),
        ];

    function HRD(logger) {
        var _this = this,
            _logger = logger,
            _gb;

        function _init() {
            _this.CpbCnt = 0;                       // uint32: cpb_cnt_minus1 + 1, see H.264 E.1.2
            _this.BitRateScale = 0;                 // uint8:  4 bits
            _this.CpbSizeScale = 0;                 // uint8:  4 bits
            _this.BitRateValue = new Array(32);     // uint32[32]: bit_rate_value_minus1 + 1
            _this.CpbSizeValue = new Array(32);     // uint32[32]: cpb_size_value_minus1 + 1
            _this.CbrFlag = 0;                      // uint32
            _this.InitialCpbRemovalDelayLength = 0; // uint32: initial_cpb_removal_delay_length_minus1 + 1
            _this.CpbRemovalDelayLength = 0;        // uint32: cpb_removal_delay_length_minus1 + 1
            _this.DpbOutputDelayLength = 0;         // uint32: dpb_output_delay_length_minus1 + 1
            _this.TimeOffsetLength = 0;             // uint32
        }

        _this.parse = function (gb) {
            _gb = gb;

            _this.CpbCnt = _gb.ReadUE() + 1;
            if (_this.CpbCnt > 32) {
                throw { name: 'DataError', message: 'Invalid HRD.CpbCnt ' + _this.CpbCnt + '.' };
            }

            _this.BitRateScale = _gb.ReadBits(4);
            _this.CpbSizeScale = _gb.ReadBits(4);

            for (var i = 0; i < _this.CpbCnt; i++) {
                _this.BitRateValue[i] = _gb.ReadUE();
                _this.CpbSizeValue[i] = _gb.ReadUE();
                _this.CbrFlag |= _gb.ReadBits(1) << i;
            }

            _this.InitialCpbRemovalDelayLength = _b.ReadBits(5) + 1;
            _this.CpbRemovalDelayLength = _gb.ReadBits(5) + 1;
            _this.DpbOutputDelayLength = _gb.ReadBits(5) + 1;
            _this.TimeOffsetLength = _gb.ReadBits(5);
        };

        _init();
    }

    function VUI(logger) {
        var _this = this,
            _logger = logger,
            _gb;

        function _init() {
            _this.AspectRatioInfoPresentFlag = 0;         // uint8:  1 bits
            _this.AspectRatioIdc = 0;                     // uint8
            _this.Sar = new Rational(1, 1);
            _this.OverscanInfoPresentFlag = 0;            // uint8:  1 bits
            _this.OverscanAppropriateFlag = 0;            // uint8:  1 bits
            _this.VideoSignalTypePresentFlag = 0;         // uint8:  1 bits
            _this.VideoFormat = 0;                        // uint8:  3 bits
            _this.VideoFullRangeFlag = 0;                 // uint8:  1 bits
            _this.ColourDescriptionPresentFlag = 0;       // uint8:  1 bits
            _this.ColourPrimaries = 0;                    // uint8
            _this.TransferCharacteristics = 0;            // uint8
            _this.MatrixCoefficients = 0;                 // uint8
            _this.ChromaLocInfoPresentFlag = 0;           // uint8:  1 bits
            _this.ChromaSampleLocTypeTopField = 0;        // uint32
            _this.ChromaSampleLocTypeBottomField = 0;     // uint32
            _this.TimingInfoPresentFlag = 0;              // byte:   1 bits
            _this.NumUnitsInTick = 0;                     // uint32
            _this.TimeScale = 0;                          // uint32
            _this.FixedFrameRateFlag = 0;                 // uint8:  1 bits
            _this.NalHrdParametersPresentFlag = 0;        // uint8:  1 bits
            _this.NalHrd = new HRD(_logger);
            _this.VclHrdParametersPresentFlag = 0;        // uint8:  1 bits
            _this.VclHrd = new HRD(_logger);
            _this.LowDelayHrdFlag = 0;                    // uint8:  1 bits
            _this.PicStructPresentFlag = 0;               // uint8:  1 bits
            _this.BitstreamRestrictionFlag                // uint8:  1 bits
            _this.MotionVectorsOverPicBoundariesFlag = 0; // uint8:  1 bits
            _this.MaxBytesPerPicDenom = 0;                // uint32
            _this.MaxBitsPerMbDenom = 0;                  // uint32
            _this.Log2MaxMvLengthHorizontal = 0;          // uint32
            _this.Log2MaxMvLengthVertical = 0;            // uint32
            _this.MaxNumReorderFrames = 0;                // uint32
            _this.MaxDecFrameBuffering = 0;               // uint32
        }

        _this.parse = function (gb) {
            _gb = gb;

            _this.AspectRatioInfoPresentFlag = _gb.ReadBits(1);
            if (_this.AspectRatioInfoPresentFlag !== 0) {
                _this.AspectRatioIdc = _gb.ReadBits(8);
                if (_this.AspectRatioIdc === EXTENDED_SAR) {
                    _this.Sar.Num = _gb.ReadBits(16);
                    _this.Sar.Den = _gb.ReadBits(16);
                } else if (_this.AspectRatioIdc < PixelAspect.length) {
                    _this.Sar = PixelAspect[_this.AspectRatioIdc];
                } else {
                    throw { name: 'DataError', message: 'Illegal aspect ratio.' };
                }
            } else {
                _this.Sar.Num = 0;
                _this.Sar.Den = 0;
            }

            _this.OverscanInfoPresentFlag = _gb.ReadBits(1);
            if (_this.OverscanInfoPresentFlag !== 0) {
                _this.OverscanAppropriateFlag = _gb.ReadBits(1);
            }

            _this.VideoSignalTypePresentFlag = _gb.ReadBits(1);
            if (_this.VideoSignalTypePresentFlag !== 0) {
                _this.VideoFormat = _gb.ReadBits(3);
                _this.VideoFullRangeFlag = _gb.ReadBits(1);

                _this.ColourDescriptionPresentFlag = _gb.ReadBits(1);
                if (_this.ColourDescriptionPresentFlag !== 0) {
                    _this.ColourPrimaries = _gb.ReadBits(8);
                    _this.TransferCharacteristics = _gb.ReadBits(8);
                    _this.MatrixCoefficients = _gb.ReadBits(8);
                    if (_this.ColourPrimaries >= Codec.COL_PRI_NB) {
                        _this.ColourPrimaries = Codec.COL_PRI_UNSPECIFIED;
                    }
                    if (_this.TransferCharacteristics >= Codec.COL_TRC_NB) {
                        _this.TransferCharacteristics = Codec.COL_TRC_UNSPECIFIED;
                    }
                    if (_this.MatrixCoefficients >= Codec.COL_SPC_NB) {
                        _this.MatrixCoefficients = Codec.COL_SPC_UNSPECIFIED;
                    }
                }
            }

            _this.ChromaLocInfoPresentFlag = _gb.ReadBits(1);
            if (_this.ChromaLocInfoPresentFlag !== 0) {
                _this.ChromaSampleLocTypeTopField = _gb.ReadUE();
                _this.ChromaSampleLocTypeBottomField = _gb.ReadUE();
            }

            if (_gb.ReadBits(1) !== 0 && _gb.Left() < 10) {
                throw { name: 'DataError', message: 'Truncated VUI.' };
            }

            _this.TimingInfoPresentFlag = _gb.ReadBits(1);
            if (_this.TimingInfoPresentFlag !== 0) {
                _this.NumUnitsInTick = _gb.ReadBitsLong(32);
                _this.TimeScale = _gb.ReadBitsLong(32);
                if (_this.NumUnitsInTick === 0 || _this.TimeScale === 0) {
                    _logger.debug('time_scale/num_units_in_tick invalid or unsupported ' + _this.TimeScale + '/' + _this.NumUnitsInTick);
                    _this.TimingInfoPresentFlag = 0;
                }
                _this.FixedFrameRateFlag = _gb.ReadBits(1);
            }

            _this.NalHrdParametersPresentFlag = _gb.ReadBits(1);
            if (_this.NalHrdParametersPresentFlag !== 0) {
                _this.NalHrd.parse(_gb);
            }

            _this.VclHrdParametersPresentFlag = _gb.ReadBits(1);
            if (_this.VclHrdParametersPresentFlag !== 0) {
                _this.VclHrd.parse(_gb);
            }

            if (_this.NalHrdParametersPresentFlag !== 0 || _this.VclHrdParametersPresentFlag !== 0) {
                _this.LowDelayHrdFlag = _gb.ReadBits(1);
            }

            _this.PicStructPresentFlag = _gb.ReadBits(1);
            if (_gb.Left() === 0) {
                return
            }

            _this.BitstreamRestrictionFlag = _gb.ReadBits(1);
            if (_this.BitstreamRestrictionFlag !== 0) {
                _this.MotionVectorsOverPicBoundariesFlag = _gb.ReadBits(1);
                _this.MaxBytesPerPicDenom = _gb.ReadUE();
                _this.MaxBitsPerMbDenom = _gb.ReadUE();
                _this.Log2MaxMvLengthHorizontal = _gb.ReadUE();
                _this.Log2MaxMvLengthVertical = _gb.ReadUE();
                _this.MaxNumReorderFrames = _gb.ReadUE();
                _this.MaxDecFrameBuffering = _gb.ReadUE();

                if (_gb.Left() < 0) {
                    _this.MaxNumReorderFrames = 0;
                    _this.BitstreamRestrictionFlag = 0;
                }

                if (_this.MaxNumReorderFrames > 16 /* max_dec_frame_buffering || max_dec_frame_buffering > 16 */) {
                    _this.MaxNumReorderFrames = 16;
                    throw { name: 'DataError', message: 'Clipping illegal MaxNumReorderFrames ' + _this.MaxNumReorderFrames + '.' };
                }
            }
        };

        _init();
    }

    function SPS(info, logger) {
        var _this = this,
            _info = info,
            _logger = logger,
            _gb;

        function _init() {
            _this.ProfileIdc = 0;                     // uint8
            _this.ConstraintSetFlags = 0;             // uint8:  6 bits
            _this.ReservedZero2Bits = 0;              // uint8:  2 bits, equal to 0
            _this.LevelIdc = 0;                       // uint8
            _this.ID = 0;                             // uint32: seq_parameter_set_id
            _this.ChromaFormatIdc = 0;                // uint32
            _this.SeparateColourPlaneFlag = 0;        // uint8:  1 bits
            _this.BitDepthLuma = 0;                   // uint32: bit_depth_luma_minus8 + 8
            _this.BitDepthChroma = 0;                 // uint32: bit_depth_chroma_minus8 + 8
            _this.TransformBypass = 0;                // uint8:  1 bits, qpprime_y_zero_transform_bypass_flag
            _this.SeqScalingMatrixPresentFlag = 0;    // uint8:  1 bits
            _this.Log2MaxFrameNum = 0;                // uint32: log2_max_frame_num_minus4 + 4
            _this.PocType = 0;                        // uint32: pic_order_cnt_type
            _this.Log2MaxPocLsb = 0;                  // uint32: log2_max_pic_order_cnt_lsb_minus4 + 4
            _this.DeltaPicOrderAlwaysZeroFlag = 0;    // uint8:  1 bits
            _this.OffsetForNonRefPic = 0;             // uint32
            _this.OffsetForTopToBottomField = 0;      // uint32
            _this.NumRefFramesInPocCycle = 0;         // uint32: num_ref_frames_in_pic_order_cnt_cycle
            _this.OffsetForRefFrame = new Array(256); // uint16[256]
            _this.MaxNumRefFrames = 0;                // uint32
            _this.GapsInFrameNumValueAllowedFlag = 0; // uint8:  1 bits
            _this.PicWidth = 0;                       // uint32: pic_width_in_mbs_minus1 + 1
            _this.PicHeight = 0;                      // uint32: pic_height_in_map_units_minus1 + 1
            _this.FrameMbsOnlyFlag = 0;               // uint8:  1 bits
            _this.MbAdaptiveFrameFieldFlag = 0;       // uint8:  1 bits
            _this.Direct8x8InferenceFlag = 0;         // uint8:  1 bits
            _this.FrameCroppingFlag = 0;              // uint8:  1 bits
            _this.FrameCropLeftOffset = 0;            // uint32
            _this.FrameCropRightOffset = 0;           // uint32
            _this.FrameCropTopOffset = 0;             // uint32
            _this.FrameCropBottomOffset = 0;          // uint32
            _this.VuiParametersPresentFlag = 0;       // uint8:  1 bits
            _this.Vui = new VUI(_logger);
        }

        _this.parse = function (arr) {
            if (arr.byteLength < 4) {
                throw { name: 'DataError', message: 'Data not enough while parsing SPS.' };
            }

            _this.Codec = "avc1.";
            utils.forEach(arr.subarray(1, 4), function (i, c) {
                var hex = utils.padStart(c.toString(16), 2, '0');
                _this.Codec += hex;
            });

            var rbsp = utils.ebsp2rbsp(arr);
            _gb = new Golomb(rbsp);
            _this.Data = rbsp;

            _gb.ReadBits(8);

            _this.ProfileIdc = _gb.ReadBits(8);
            _this.ConstraintSetFlags = _gb.ReadBits(1) << 0;  // constraint_set0_flag
            _this.ConstraintSetFlags |= _gb.ReadBits(1) << 1; // constraint_set1_flag
            _this.ConstraintSetFlags |= _gb.ReadBits(1) << 2; // constraint_set2_flag
            _this.ConstraintSetFlags |= _gb.ReadBits(1) << 3; // constraint_set3_flag
            _this.ConstraintSetFlags |= _gb.ReadBits(1) << 4; // constraint_set4_flag
            _this.ConstraintSetFlags |= _gb.ReadBits(1) << 5; // constraint_set5_flag
            _this.ReservedZero2Bits = _gb.ReadBits(2);
            _this.LevelIdc = _gb.ReadBits(8);

            _this.ID = _gb.ReadUE();
            if (_this.ID >= MAX_SPS_COUNT) {
                throw { name: 'DataError', message: 'SPS ID(0x' + _this.ID.toString(16) + ') out of range.' };
            }

            _this.SeqScalingMatrixPresentFlag = 0;
            _this.Vui.VideoFullRangeFlag = 1;
            _this.Vui.MatrixCoefficients = Codec.COL_SPC_UNSPECIFIED;

            if (_this.ProfileIdc === 100 || // High profile
                _this.ProfileIdc === 110 || // High10 profile
                _this.ProfileIdc === 122 || // High422 profile
                _this.ProfileIdc === 244 || // High444 Predictive profile
                _this.ProfileIdc === 44 || // Cavlc444 profile
                _this.ProfileIdc === 83 || // Scalable Constrained High profile (SVC)
                _this.ProfileIdc === 86 || // Scalable High Intra profile (SVC)
                _this.ProfileIdc === 118 || // Stereo High profile (MVC)
                _this.ProfileIdc === 128 || // Multiview High profile (MVC)
                _this.ProfileIdc === 138 || // Multiview Depth High profile (MVCD)
                _this.ProfileIdc === 144) { // old High444 profile
                _this.ChromaFormatIdc = _gb.ReadUE();
                if (_this.ChromaFormatIdc > 3) {
                    throw { name: 'DataError', message: 'Bad ChromaFormatIdc ' + _this.ChromaFormatIdc + '.' };
                } else if (_this.ChromaFormatIdc === 3) {
                    _this.SeparateColourPlaneFlag = _gb.ReadBits(1);
                    if (_this.SeparateColourPlaneFlag !== 0) {
                        throw { name: 'DataError', message: 'Separate color planes are not supported.' };
                    }
                }

                _this.BitDepthLuma = _gb.ReadUE() + 8;
                _this.BitDepthChroma = _gb.ReadUE() + 8;
                if (_this.BitDepthChroma !== _this.BitDepthLuma) {
                    throw { name: 'DataError', message: 'Different chroma and luma bit depth.' };
                }
                if (_this.BitDepthLuma < 8 || _this.BitDepthLuma > 14 ||
                    _this.BitDepthChroma < 8 || _this.BitDepthChroma > 14) {
                    throw { name: 'DataError', message: 'Illegal bit depth value ' + _this.BitDepthLuma + ', ' + _this.BitDepthChroma + '.' };
                }

                _this.TransformBypass = _gb.ReadBits(1);

                _this.SeqScalingMatrixPresentFlag = _gb.ReadBits(1);
                if (_this.SeqScalingMatrixPresentFlag !== 0) {
                    var n = 8;
                    if (_this.ChromaFormatIdc === 3) {
                        n += 4;
                    }

                    for (var i = 0; i < n; i++) {
                        if (_gb.ReadBits(1) != 0) { // seq_scaling_list_present_flag
                            var size = 16;
                            if (i >= 6) {
                                size = 64;
                            }

                            var last = 8;
                            var next = 8;
                            for (var j = 0; j < size; j++) {
                                if (next !== 0) {
                                    var delta = _gb.ReadSE();
                                    next = (last + delta + 256) % 256;
                                    if (next !== 0) {
                                        last = next;
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                _this.ChromaFormatIdc = 1;
                _this.BitDepthLuma = 8;
                _this.BitDepthChroma = 8;
            }

            _this.Log2MaxFrameNum = _gb.ReadUE() + 4;
            if (_this.Log2MaxFrameNum < MIN_LOG2_MAX_FRAME_NUM || _this.Log2MaxFrameNum > MAX_LOG2_MAX_FRAME_NUM) {
                throw { name: 'DataError', message: 'log2_max_frame_num_minus4(' + (_this.Log2MaxFrameNum - 4) + ') out of range, expect 0-12.' };
            }

            _this.PocType = _gb.ReadUE();
            if (_this.PocType === 0) {
                _this.Log2MaxPocLsb = _gb.ReadUE() + 4;
                if (_this.Log2MaxPocLsb > 16) {
                    throw { name: 'DataError', message: 'log2_max_poc_lsb(' + _this.Log2MaxPocLsb + ') is out of range.' };
                }
            } else if (_this.PocType === 1) {
                _this.DeltaPicOrderAlwaysZeroFlag = _gb.ReadBits(1);
                _this.OffsetForNonRefPic = _gb.ReadUE();
                _this.OffsetForTopToBottomField = _gb.ReadUE();
                _this.NumRefFramesInPocCycle = _gb.ReadUE();

                var n = _this.OffsetForRefFrame.length;
                if (_this.NumRefFramesInPocCycle >= n) {
                    throw { name: 'DataError', message: 'poc_cycle_length(' + _this.NumRefFramesInPocCycle + ') overflow.' };
                }

                for (var i = 0; i < _this.NumRefFramesInPocCycle; i++) {
                    _this.OffsetForRefFrame[i] = _gb.ReadUE();
                }
            } else if (_this.PocType !== 2) {
                throw { name: 'DataError', message: 'Illegal POC type ' + _this.PocType + '.' };
            }

            _this.MaxNumRefFrames = _gb.ReadUE();
            if (_this.MaxNumRefFrames > MAX_PICTURE_COUNT - 2 || _this.MaxNumRefFrames > 16) {
                throw { name: 'DataError', message: 'Too many reference frames, ' + _this.MaxNumRefFrames + '.' };
            }

            _this.GapsInFrameNumValueAllowedFlag = _gb.ReadBits(1);
            _this.PicWidth = _gb.ReadUE() + 1;
            _this.PicHeight = _gb.ReadUE() + 1;
            if (_this.PicWidth >= utils.MAX_INT32 / 16 ||
                _this.PicHeight >= utils.MAX_INT32 / 16 ||
                _checkImageSize(16 * _this.PicWidth, 16 * _this.PicHeight) === false) {
                throw { name: 'DataError', message: 'pic_width or pic_height overflow.' };
            }

            _this.FrameMbsOnlyFlag = _gb.ReadBits(1);
            if (_this.FrameMbsOnlyFlag === 0) {
                _this.MbAdaptiveFrameFieldFlag = _gb.ReadBits(1);
            } else {
                _this.MbAdaptiveFrameFieldFlag = 0;
            }

            info.CodecWidth = 16 * _this.PicWidth;
            info.CodecHeight = 16 * _this.PicHeight * (2 - _this.FrameMbsOnlyFlag);

            _this.Direct8x8InferenceFlag = _gb.ReadBits(1);
            _this.FrameCroppingFlag = _gb.ReadBits(1);
            if (_this.FrameCroppingFlag !== 0) {
                var vsub,
                    hsub,
                    cropLeft = _gb.ReadUE(),
                    cropRight = _gb.ReadUE(),
                    cropTop = _gb.ReadUE(),
                    cropBottom = _gb.ReadUE();

                if (_this.ChromaFormatIdc === 1) {
                    vsub = 1;
                }
                if (_this.ChromaFormatIdc === 1 || _this.ChromaFormatIdc === 2) {
                    hsub = 1;
                }

                var stepX = 1 << hsub,
                    stepY = (2 - _this.FrameMbsOnlyFlag) << vsub;
                if (cropLeft > utils.MAX_INT32 / 4 / stepX ||
                    cropRight > utils.MAX_INT32 / 4 / stepX ||
                    cropTop > utils.MAX_INT32 / 4 / stepY ||
                    cropBottom > utils.MAX_INT32 / 4 / stepY ||
                    (cropLeft + cropRight) * stepX >= info.CodecWidth ||
                    (cropTop + cropBottom) * stepY >= info.CodecHeight) {
                    throw { name: 'DataError', message: 'Invalid crop values, l=' + cropLeft + ', r=' + cropRight + ', t=' + cropTop + ', b=' + cropBottom + ', w=' + info.CodecWidth + ', h=' + info.CodecHeight + '.' };
                }

                _this.FrameCropLeftOffset = cropLeft * stepX;
                _this.FrameCropRightOffset = cropRight * stepX;
                _this.FrameCropTopOffset = cropTop * stepY;
                _this.FrameCropBottomOffset = cropBottom * stepY;
            } else {
                _this.FrameCropLeftOffset = 0;
                _this.FrameCropRightOffset = 0;
                _this.FrameCropTopOffset = 0;
                _this.FrameCropBottomOffset = 0;
            }

            _this.VuiParametersPresentFlag = _gb.ReadBits(1);
            if (_this.VuiParametersPresentFlag !== 0) {
                try {
                    _this.Vui.parse(_gb);
                } catch (err) {
                    // Ignore parsing issue, leave it to the decoder.
                    // Fall through here, to calc the other info.
                    _logger.warn(err.name + ': ' + err.message);
                }
                if (_this.Vui.TimingInfoPresentFlag !== 0) {
                    info.FrameRate.Num = _this.Vui.TimeScale
                    info.FrameRate.Den = _this.Vui.NumUnitsInTick * 2;
                }
            }

            info.CodecWidth -= _this.FrameCropLeftOffset + _this.FrameCropRightOffset;
            info.CodecHeight -= _this.FrameCropTopOffset + _this.FrameCropBottomOffset;

            info.Width = info.CodecWidth;
            info.Height = info.CodecHeight;
            if (_this.Vui.Sar.Den > 1) {
                info.Width *= _this.Vui.Sar.Num / _this.Vui.Sar.Den;
            }
        };

        function _checkImageSize(w, h) {
            return w !== 0 && h !== 0 && (w + 128) * (h + 128) < utils.MAX_INT32 / 8;
        }

        _init();
    }

    AVC.SPS = SPS;
})(odd);

