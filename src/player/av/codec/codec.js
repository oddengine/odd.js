(function (odd) {
    var utils = odd.utils,
        AV = odd.AV,

        Codec = {},
        _codecs = [];

    /*
     * Chromaticity coordinates of the source primaries.
     */
    Codec.COL_PRI_RESERVED0 = 0;
    Codec.COL_PRI_BT709 = 1;         // also ITU-R BT1361 / IEC 61966-2-4 / SMPTE RP177 Annex B
    Codec.COL_PRI_UNSPECIFIED = 2;
    Codec.COL_PRI_RESERVED = 3;
    Codec.COL_PRI_BT470M = 4;        // also FCC Title 47 Code of Federal Regulations 73.682 (a)(20)
    Codec.COL_PRI_BT470BG = 5;       // also ITU-R BT601-6 625 / ITU-R BT1358 625 / ITU-R BT1700 625 PAL & SECAM
    Codec.COL_PRI_SMPTE170M = 6;     // also ITU-R BT601-6 525 / ITU-R BT1358 525 / ITU-R BT1700 NTSC
    Codec.COL_PRI_SMPTE240M = 7;     // functionally identical to above
    Codec.COL_PRI_FILM = 8;          // colour filters using Illuminant C
    Codec.COL_PRI_BT2020 = 9;        // ITU-R BT2020
    Codec.COL_PRI_SMPTEST428_1 = 10; // SMPTE ST 428-1 (CIE 1931 XYZ)
    Codec.COL_PRI_NB = 11;           // Not part of ABI

    /*
     * Color Transfer Characteristic.
     */
    Codec.COL_TRC_RESERVED0 = 0;
    Codec.COL_TRC_BT709 = 1;         // also ITU-R BT1361
    Codec.COL_TRC_UNSPECIFIED = 2;
    Codec.COL_TRC_RESERVED = 3;
    Codec.COL_TRC_GAMMA22 = 4;       // also ITU-R BT470M / ITU-R BT1700 625 PAL & SECAM
    Codec.COL_TRC_GAMMA28 = 5;       // also ITU-R BT470BG
    Codec.COL_TRC_SMPTE170M = 6;     // also ITU-R BT601-6 525 or 625 / ITU-R BT1358 525 or 625 / ITU-R BT1700 NTSC
    Codec.COL_TRC_SMPTE240M = 7;
    Codec.COL_TRC_LINEAR = 8;        // "Linear transfer characteristics"
    Codec.COL_TRC_LOG = 9;           // "Logarithmic transfer characteristic (100:1 range)"
    Codec.COL_TRC_LOG_SQRT = 10;     // "Logarithmic transfer characteristic (100 * Sqrt(10) : 1 range)"
    Codec.COL_TRC_IEC61966_2_4 = 11; // IEC 61966-2-4
    Codec.COL_TRC_BT1361_ECG = 12;   // ITU-R BT1361 Extended Colour Gamut
    Codec.COL_TRC_IEC61966_2_1 = 13; // IEC 61966-2-1 (sRGB or sYCC)
    Codec.COL_TRC_BT2020_10 = 14;    // ITU-R BT2020 for 10-bit system
    Codec.COL_TRC_BT2020_12 = 15;    // ITU-R BT2020 for 12-bit system
    Codec.COL_TRC_SMPTEST2084 = 16;  // SMPTE ST 2084 for 10-, 12-, 14- and 16-bit systems
    Codec.COL_TRC_SMPTEST428_1 = 17; // SMPTE ST 428-1
    Codec.COL_TRC_ARIB_STD_B67 = 18; // ARIB STD-B67, known as "Hybrid log-gamma"
    Codec.COL_TRC_NB = 19;           // Not part of ABI

    /*
     * YUV colorspace type.
     */
    Codec.COL_SPC_RGB = 0;        // order of coefficients is actually GBR, also IEC 61966-2-1 (sRGB)
    Codec.COL_SPC_BT709 = 1;      // also ITU-R BT1361 / IEC 61966-2-4 xvYCC709 / SMPTE RP177 Annex B
    Codec.COL_SPC_UNSPECIFIED = 2;
    Codec.COL_SPC_RESERVED = 3;
    Codec.COL_SPC_FCC = 4;        // FCC Title 47 Code of Federal Regulations 73.682 (a)(20)
    Codec.COL_SPC_BT470BG = 5;    // also ITU-R BT601-6 625 / ITU-R BT1358 625 / ITU-R BT1700 625 PAL & SECAM / IEC 61966-2-4 xvYCC601
    Codec.COL_SPC_SMPTE170M = 6;  // also ITU-R BT601-6 525 / ITU-R BT1358 525 / ITU-R BT1700 NTSC
    Codec.COL_SPC_SMPTE240M = 7;  // functionally identical to above
    Codec.COL_SPC_YCOCG = 8;      // Used by Dirac / VC-2 and H.264 FRext, see ITU-T SG16
    Codec.COL_SPC_YCGCO = 8;
    Codec.COL_SPC_BT2020_NCL = 9; // ITU-R BT2020 non-constant luminance system
    Codec.COL_SPC_BT2020_CL = 10; // ITU-R BT2020 constant luminance system
    Codec.COL_SPC_NB = 11;        // Not part of ABI

    /*
     * MPEG vs JPEG YUV range.
     */
    Codec.COL_RANGE_UNSPECIFIED = 0;
    Codec.COL_RANGE_MPEG = 1; // the normal 219*2^(n-8) "MPEG" YUV ranges
    Codec.COL_RANGE_JPEG = 2; // the normal     2^n-1   "JPEG" YUV ranges
    Codec.COL_RANGE_NB = 2;   // Not part of ABI

    /*
     * Location of chroma samples.
     *
     * Illustration showing the location of the first (top left) chroma sample of the
     * image, the left shows only luma, the right
     * shows the location of the chroma sample, the 2 could be imagined to overlay
     * each other but are drawn separately due to limitations of ASCII
     *
     *                1st 2nd       1st 2nd horizontal luma sample positions
     *                 v   v         v   v
     *                 ______        ______
     *1st luma line > |X   X ...    |3 4 X ...     X are luma samples,
     *                |             |1 2           1-6 are possible chroma positions
     *2nd luma line > |X   X ...    |5 6 X ...     0 is undefined/unknown position
     */
    Codec.CHROMA_LOC_UNSPECIFIED = 0;
    Codec.CHROMA_LOC_LEFT = 1;    // MPEG-2/4 4:2:0, H.264 default for 4:2:0
    Codec.CHROMA_LOC_CENTER = 2;  // MPEG-1 4:2:0, JPEG 4:2:0, H.263 4:2:0
    Codec.CHROMA_LOC_TOPLEFT = 3; // ITU-R 601, SMPTE 274M 296M S314M(DV 4:1:1), mpeg2 4:2:2
    Codec.CHROMA_LOC_TOP = 4;
    Codec.CHROMA_LOC_BOTTOMLEFT = 5;
    Codec.CHROMA_LOC_BOTTOM = 6;
    Codec.CHROMA_LOC_NB = 7;      // Not part of ABI

    Codec.register = function (codec, index) {
        try {
            _codecs.splice(index || _codecs.length, 0, codec);
            Codec[codec.prototype.kind] = codec;
        } catch (err) {
            throw { name: err.name, message: 'Failed to register codec ' + codec.prototype.kind + ': ' + err.message };
        }
    };

    Codec.get = function (codec) {
        for (var i = 0; i < _codecs.length; i++) {
            var item = _codecs[i];
            if (item.prototype.kind === codec) {
                return item;
            }
        }
        return null;
    };

    AV.codec = Codec.get;
    AV.Codec = Codec;
})(odd);

