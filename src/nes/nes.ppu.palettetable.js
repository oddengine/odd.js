(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,
        PPU = NES.PPU;

    function PaletteTable() {
        var _this = this;

        function _init() {
            _this.curTable = new Array(64);
            _this.emphTable = new Array(8);
            _this.currentEmph = -1;
        }

        _this.reset = function () {
            _this.setEmphasis(0);
        };

        _this.loadNTSCPalette = function () {
            _this.curTable = [
                0x525252, 0xB40000, 0xA00000, 0xB1003D,
                0x740069, 0x00005B, 0x00005F, 0x001840,
                0x002F10, 0x084A08, 0x006700, 0x124200,
                0x6D2800, 0x000000, 0x000000, 0x000000,
                0xC4D5E7, 0xFF4000, 0xDC0E22, 0xFF476B,
                0xD7009F, 0x680AD7, 0x0019BC, 0x0054B1,
                0x006A5B, 0x008C03, 0x00AB00, 0x2C8800,
                0xA47200, 0x000000, 0x000000, 0x000000,
                0xF8F8F8, 0xFFAB3C, 0xFF7981, 0xFF5BC5,
                0xFF48F2, 0xDF49FF, 0x476DFF, 0x00B4F7,
                0x00E0FF, 0x00E375, 0x03F42B, 0x78B82E,
                0xE5E218, 0x787878, 0x000000, 0x000000,
                0xFFFFFF, 0xFFF2BE, 0xF8B8B8, 0xF8B8D8,
                0xFFB6FF, 0xFFC3FF, 0xC7D1FF, 0x9ADAFF,
                0x88EDF8, 0x83FFDD, 0xB8F8B8, 0xF5F8AC,
                0xFFFFB0, 0xF8D8F8, 0x000000, 0x000000,
            ];
            _this.makeTables();
            _this.setEmphasis(0);
        };

        _this.loadPALPalette = function () {
            _this.curTable = [
                0x525252, 0xB40000, 0xA00000, 0xB1003D,
                0x740069, 0x00005B, 0x00005F, 0x001840,
                0x002F10, 0x084A08, 0x006700, 0x124200,
                0x6D2800, 0x000000, 0x000000, 0x000000,
                0xC4D5E7, 0xFF4000, 0xDC0E22, 0xFF476B,
                0xD7009F, 0x680AD7, 0x0019BC, 0x0054B1,
                0x006A5B, 0x008C03, 0x00AB00, 0x2C8800,
                0xA47200, 0x000000, 0x000000, 0x000000,
                0xF8F8F8, 0xFFAB3C, 0xFF7981, 0xFF5BC5,
                0xFF48F2, 0xDF49FF, 0x476DFF, 0x00B4F7,
                0x00E0FF, 0x00E375, 0x03F42B, 0x78B82E,
                0xE5E218, 0x787878, 0x000000, 0x000000,
                0xFFFFFF, 0xFFF2BE, 0xF8B8B8, 0xF8B8D8,
                0xFFB6FF, 0xFFC3FF, 0xC7D1FF, 0x9ADAFF,
                0x88EDF8, 0x83FFDD, 0xB8F8B8, 0xF5F8AC,
                0xFFFFB0, 0xF8D8F8, 0x000000, 0x000000,
            ];
            _this.makeTables();
            _this.setEmphasis(0);
        };

        _this.makeTables = function () {
            var r, g, b, col, rFactor, gFactor, bFactor;

            // Calculate a table for each possible emphasis setting.
            for (var emph = 0; emph < 8; emph++) {
                // Determine color component factors.
                rFactor = 1.0;
                gFactor = 1.0;
                bFactor = 1.0;
                if ((emph & 1) !== 0) {
                    rFactor = 0.75;
                    bFactor = 0.75;
                }
                if ((emph & 2) !== 0) {
                    rFactor = 0.75;
                    gFactor = 0.75;
                }
                if ((emph & 4) !== 0) {
                    gFactor = 0.75;
                    bFactor = 0.75;
                }
                _this.emphTable[emph] = new Array(64);

                // Calculate table.
                for (var i = 0; i < 64; i++) {
                    col = _this.curTable[i];
                    r = Math.floor(_this.getRed(col) * rFactor);
                    g = Math.floor(_this.getGreen(col) * gFactor);
                    b = Math.floor(_this.getBlue(col) * bFactor);
                    _this.emphTable[emph][i] = _this.getRgb(r, g, b);
                }
            }
        };

        _this.setEmphasis = function (emph) {
            if (emph != _this.currentEmph) {
                _this.currentEmph = emph;
                for (var i = 0; i < 64; i++) {
                    _this.curTable[i] = _this.emphTable[emph][i];
                }
            }
        };

        _this.getEntry = function (yiq) {
            return _this.curTable[yiq];
        };

        _this.getRed = function (rgb) {
            return (rgb >> 16) & 0xFF;
        };

        _this.getGreen = function (rgb) {
            return (rgb >> 8) & 0xFF;
        };

        _this.getBlue = function (rgb) {
            return rgb & 0xFF;
        };

        _this.getRgb = function (r, g, b) {
            return ((r << 16) | (g << 8) | (b));
        };

        _this.loadDefaultPalette = function () {
            _this.curTable[0] = _this.getRgb(117, 117, 117);
            _this.curTable[1] = _this.getRgb(39, 27, 143);
            _this.curTable[2] = _this.getRgb(0, 0, 171);
            _this.curTable[3] = _this.getRgb(71, 0, 159);
            _this.curTable[4] = _this.getRgb(143, 0, 119);
            _this.curTable[5] = _this.getRgb(171, 0, 19);
            _this.curTable[6] = _this.getRgb(167, 0, 0);
            _this.curTable[7] = _this.getRgb(127, 11, 0);
            _this.curTable[8] = _this.getRgb(67, 47, 0);
            _this.curTable[9] = _this.getRgb(0, 71, 0);
            _this.curTable[10] = _this.getRgb(0, 81, 0);
            _this.curTable[11] = _this.getRgb(0, 63, 23);
            _this.curTable[12] = _this.getRgb(27, 63, 95);
            _this.curTable[13] = _this.getRgb(0, 0, 0);
            _this.curTable[14] = _this.getRgb(0, 0, 0);
            _this.curTable[15] = _this.getRgb(0, 0, 0);
            _this.curTable[16] = _this.getRgb(188, 188, 188);
            _this.curTable[17] = _this.getRgb(0, 115, 239);
            _this.curTable[18] = _this.getRgb(35, 59, 239);
            _this.curTable[19] = _this.getRgb(131, 0, 243);
            _this.curTable[20] = _this.getRgb(191, 0, 191);
            _this.curTable[21] = _this.getRgb(231, 0, 91);
            _this.curTable[22] = _this.getRgb(219, 43, 0);
            _this.curTable[23] = _this.getRgb(203, 79, 15);
            _this.curTable[24] = _this.getRgb(139, 115, 0);
            _this.curTable[25] = _this.getRgb(0, 151, 0);
            _this.curTable[26] = _this.getRgb(0, 171, 0);
            _this.curTable[27] = _this.getRgb(0, 147, 59);
            _this.curTable[28] = _this.getRgb(0, 131, 139);
            _this.curTable[29] = _this.getRgb(0, 0, 0);
            _this.curTable[30] = _this.getRgb(0, 0, 0);
            _this.curTable[31] = _this.getRgb(0, 0, 0);
            _this.curTable[32] = _this.getRgb(255, 255, 255);
            _this.curTable[33] = _this.getRgb(63, 191, 255);
            _this.curTable[34] = _this.getRgb(95, 151, 255);
            _this.curTable[35] = _this.getRgb(167, 139, 253);
            _this.curTable[36] = _this.getRgb(247, 123, 255);
            _this.curTable[37] = _this.getRgb(255, 119, 183);
            _this.curTable[38] = _this.getRgb(255, 119, 99);
            _this.curTable[39] = _this.getRgb(255, 155, 59);
            _this.curTable[40] = _this.getRgb(243, 191, 63);
            _this.curTable[41] = _this.getRgb(131, 211, 19);
            _this.curTable[42] = _this.getRgb(79, 223, 75);
            _this.curTable[43] = _this.getRgb(88, 248, 152);
            _this.curTable[44] = _this.getRgb(0, 235, 219);
            _this.curTable[45] = _this.getRgb(0, 0, 0);
            _this.curTable[46] = _this.getRgb(0, 0, 0);
            _this.curTable[47] = _this.getRgb(0, 0, 0);
            _this.curTable[48] = _this.getRgb(255, 255, 255);
            _this.curTable[49] = _this.getRgb(171, 231, 255);
            _this.curTable[50] = _this.getRgb(199, 215, 255);
            _this.curTable[51] = _this.getRgb(215, 203, 255);
            _this.curTable[52] = _this.getRgb(255, 199, 255);
            _this.curTable[53] = _this.getRgb(255, 199, 219);
            _this.curTable[54] = _this.getRgb(255, 191, 179);
            _this.curTable[55] = _this.getRgb(255, 219, 171);
            _this.curTable[56] = _this.getRgb(255, 231, 163);
            _this.curTable[57] = _this.getRgb(227, 255, 163);
            _this.curTable[58] = _this.getRgb(171, 243, 191);
            _this.curTable[59] = _this.getRgb(179, 255, 207);
            _this.curTable[60] = _this.getRgb(159, 255, 243);
            _this.curTable[61] = _this.getRgb(0, 0, 0);
            _this.curTable[62] = _this.getRgb(0, 0, 0);
            _this.curTable[63] = _this.getRgb(0, 0, 0);

            _this.makeTables();
            _this.setEmphasis(0);
        };

        _init();
    }

    PPU.PaletteTable = PaletteTable;
})(odd);

