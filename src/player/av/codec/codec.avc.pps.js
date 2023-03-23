(function (odd) {
    var utils = odd.utils,
        Golomb = utils.Golomb,
        AV = odd.AV,
        Codec = AV.Codec,
        AVC = Codec.AVC,

        MAX_SPS_COUNT = 32,
        MAX_PPS_COUNT = 256;

    function PPS(sps, logger) {
        var _this = this,
            _sps = sps,
            _logger = logger,
            _gb;

        function _init() {
            _this.ID = 0;                                 // uint32: pic_parameter_set_id
            _this.SpsID = 0;                              // uint32: seq_parameter_set_id
            _this.EntropyCodingModeFlag = 0;              // uint8:  1 bits
            _this.PicOrderPresentFlag = 0;                // uint8:  1 bits, bottom_field_pic_order_in_frame_present_flag
            _this.NumSliceGroups = 0;                     // uint32: num_slice_groups_minus1 + 1
            _this.SliceGroupMapType = 0;                  // uint32
            _this.NumRefIdx = new Array(2);               // uint32[2]: num_ref_idx_l0/1_default_active_minus1 + 1
            _this.WeightedPredFlag = 0;                   // uint8:  1 bits
            _this.WeightedBipredIdc = 0;                  // uint8:  1 bits
            _this.PicInitQp = 0;                          // uint32: pic_init_qp_minus26 + 26
            _this.PicInitQs = 0;                          // uint32: pic_init_qs_minus26 + 26
            _this.ChromaQpIndexOffset = new Array(2);     // int32[2]
            _this.DeblockingFilterControlPresentFlag = 0; // uint8:  1 bits
            _this.ConstrainedIntraPredFlag = 0;           // uint8:  1 bits
            _this.RedundantPicCntPresentFlag = 0;         // uint8:  1 bits
            _this.Transform8x8ModeFlag = 0;               // uint8:  1 bits
            _this.PicScalingMatrixPresentFlag = 0;        // uint8:  1 bits
            _this.ChromaQpDiff = 0;                       // int32
        }

        _this.parse = function (arr) {
            var rbsp = utils.ebsp2rbsp(arr);
            _gb = new Golomb(rbsp);
            _this.Data = rbsp;

            _this.ID = _gb.ReadUE();
            if (_this.ID >= MAX_PPS_COUNT) {
                throw { name: 'DataError', message: 'PPS ID(0x' + _this.ID.toString(16) + ') out of range.' };
            }

            _this.SpsID = _gb.ReadUE();
            if (_this.SpsID >= MAX_SPS_COUNT) {
                throw { name: 'DataError', message: 'SPS ID(0x' + _this.SpsID.toString(16) + ') out of range.' };
            }

            if (_sps.BitDepthLuma > 14) {
                throw { name: 'DataError', message: 'Invalid BitDepthLuma ' + _sps.BitDepthLuma + '.' };
            } else if (_sps.BitDepthLuma === 11 || _sps.BitDepthLuma === 13) {
                throw { name: 'DataError', message: 'Unimplemented BitDepthLuma ' + _sps.BitDepthLuma + '.' };
            }

            _this.EntropyCodingModeFlag = _gb.ReadBits(1);
            _this.PicOrderPresentFlag = _gb.ReadBits(1);
            _this.NumSliceGroups = _gb.ReadUE() + 1;
            if (_this.NumSliceGroups > 1) {
                _this.SliceGroupMapType = _gb.ReadUE();
                _logger.debug('FMO not supported!');

                switch (_this.SliceGroupMapType) {
                    case 0:
                        /*
                            for (i = 0; i <= num_slice_groups_minus1; i++)  |   |      |
                            run_length[i]                                   |1  |ue(v) |
                        */
                        break;
                    case 2:
                        /*
                            for (i = 0; i < num_slice_groups_minus1; i++) { |   |      |
                                top_left_mb[i]                              |1  |ue(v) |
                                bottom_right_mb[i]                          |1  |ue(v) |
                            }                                               |   |      |
                        */
                        break;
                    case 3:
                    case 4:
                    case 5:
                        /*
                            slice_group_change_direction_flag               |1  |u(1)  |
                            slice_group_change_rate_minus1                  |1  |ue(v) |
                        */
                        break;
                    case 6:
                        /*
                            slice_group_id_cnt_minus1                       |1  |ue(v) |
                            for (i = 0; i <= slice_group_id_cnt_minus1; i++)|   |      |
                                slice_group_id[i]                           |1  |u(v)  |
                        */
                        break;
                }
            }

            _this.NumRefIdx[0] = _gb.ReadUE() + 1;
            _this.NumRefIdx[1] = _gb.ReadUE() + 1;
            if (_this.NumRefIdx[0] - 1 > 32 - 1 || _this.NumRefIdx[1] - 1 > 32 - 1) {
                throw { name: 'DataError', message: 'PPS reference overflow.' };
            }

            var qpBdOffset = 6 * (_sps.BitDepthLuma - 8);
            _this.WeightedPredFlag = _gb.ReadBits(1);
            _this.WeightedBipredIdc = _gb.ReadBits(2);
            _this.PicInitQp = _gb.ReadSE() + 26 + qpBdOffset;
            _this.PicInitQs = _gb.ReadSE() + 26 + qpBdOffset;
            _this.ChromaQpIndexOffset[0] = _gb.ReadSE();
            _this.DeblockingFilterControlPresentFlag = _gb.ReadBits(1);
            _this.ConstrainedIntraPredFlag = _gb.ReadBits(1);
            _this.RedundantPicCntPresentFlag = _gb.ReadBits(1);

            _this.Transform8x8ModeFlag = 0;
            if (_gb.Left() > 0 && _moreRBSPInPPS(_sps)) {
                _this.Transform8x8ModeFlag = _gb.ReadBits(1);
                _this.PicScalingMatrixPresentFlag = _gb.ReadBits(1);
                if (_this.PicScalingMatrixPresentFlag !== 0) {
                    var n = 2;
                    if (_sps.ChromaFormatIdc === 3) {
                        n = 6;
                    }
                    _gb.ReadBits(6 + n * _this.Transform8x8ModeFlag);
                }

                _this.ChromaQpIndexOffset[1] = _gb.ReadSE(); // second_chroma_qp_index_offset
            } else {
                _this.ChromaQpIndexOffset[1] = _this.ChromaQpIndexOffset[0];
            }

            if (_this.ChromaQpIndexOffset[0] !== _this.ChromaQpIndexOffset[1]) {
                _this.ChromaQpDiff = 1;
            }
        };

        function _moreRBSPInPPS() {
            if ((_sps.ProfileIdc === 66 || _sps.ProfileIdc === 77 || _sps.ProfileIdc === 88) && (_sps.ConstraintSetFlags & 7) !== 0) {
                _logger.debug('Current profile doesn\'t provide more RBSP data in PPS, skipping...');
                return false;
            }
            return true;
        }

        _init();
    }

    AVC.PPS = PPS;
})(odd);

