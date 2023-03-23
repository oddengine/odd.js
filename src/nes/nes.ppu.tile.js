(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,
        PPU = NES.PPU;

    function Tile() {
        var _this = this;

        function _init() {
            _this.pix = new Array(64);

            _this.fbIndex = null;
            _this.tIndex = null;
            _this.x = null;
            _this.y = null;
            _this.w = null;
            _this.h = null;
            _this.incX = null;
            _this.incY = null;
            _this.palIndex = null;
            _this.tpri = null;
            _this.c = null;
            _this.initialized = false;
            _this.opaque = new Array(8);
        }

        _this.setBuffer = function (scanline) {
            for (_this.y = 0; _this.y < 8; _this.y++) {
                _this.setScanline(_this.y, scanline[_this.y], scanline[_this.y + 8]);
            }
        };

        _this.setScanline = function (sline, b1, b2) {
            _this.initialized = true;
            _this.tIndex = sline << 3;
            for (_this.x = 0; _this.x < 8; _this.x++) {
                _this.pix[_this.tIndex + _this.x] = ((b1 >> (7 - _this.x)) & 1) + (((b2 >> (7 - _this.x)) & 1) << 1);
                if (_this.pix[_this.tIndex + _this.x] === 0) {
                    _this.opaque[sline] = false;
                }
            }
        };

        _this.render = function (buffer, srcx1, srcy1, srcx2, srcy2, dx, dy, palAdd, palette, flipHorizontal, flipVertical, pri, priTable) {
            if (dx < -7 || dx >= 256 || dy < -7 || dy >= 240) {
                return;
            }
            _this.w = srcx2 - srcx1;
            _this.h = srcy2 - srcy1;

            if (dx < 0) {
                srcx1 -= dx;
            }
            if (dx + srcx2 >= 256) {
                srcx2 = 256 - dx;
            }
            if (dy < 0) {
                srcy1 -= dy;
            }
            if (dy + srcy2 >= 240) {
                srcy2 = 240 - dy;
            }

            if (!flipHorizontal && !flipVertical) {
                _this.fbIndex = (dy << 8) + dx;
                _this.tIndex = 0;
                for (_this.y = 0; _this.y < 8; _this.y++) {
                    for (_this.x = 0; _this.x < 8; _this.x++) {
                        if (_this.x >= srcx1 && _this.x < srcx2 && _this.y >= srcy1 && _this.y < srcy2) {
                            _this.palIndex = _this.pix[_this.tIndex];
                            _this.tpri = priTable[_this.fbIndex];
                            if (_this.palIndex !== 0 && pri <= (_this.tpri & 0xFF)) {
                                // Render upright tile to buffer.
                                buffer[_this.fbIndex] = palette[_this.palIndex + palAdd];
                                _this.tpri = (_this.tpri & 0xF00) | pri;
                                priTable[_this.fbIndex] = _this.tpri;
                            }
                        }
                        _this.fbIndex++;
                        _this.tIndex++;
                    }
                    _this.fbIndex -= 8;
                    _this.fbIndex += 256;
                }
            } else if (flipHorizontal && !flipVertical) {
                _this.fbIndex = (dy << 8) + dx;
                _this.tIndex = 7;
                for (_this.y = 0; _this.y < 8; _this.y++) {
                    for (_this.x = 0; _this.x < 8; _this.x++) {
                        if (_this.x >= srcx1 && _this.x < srcx2 && _this.y >= srcy1 && _this.y < srcy2) {
                            _this.palIndex = _this.pix[_this.tIndex];
                            _this.tpri = priTable[_this.fbIndex];
                            if (_this.palIndex !== 0 && pri <= (_this.tpri & 0xFF)) {
                                buffer[_this.fbIndex] = palette[_this.palIndex + palAdd];
                                _this.tpri = (_this.tpri & 0xF00) | pri;
                                priTable[_this.fbIndex] = _this.tpri;
                            }
                        }
                        _this.fbIndex++;
                        _this.tIndex--;
                    }
                    _this.fbIndex -= 8;
                    _this.fbIndex += 256;
                    _this.tIndex += 16;
                }
            } else if (flipVertical && !flipHorizontal) {
                _this.fbIndex = (dy << 8) + dx;
                _this.tIndex = 56;
                for (_this.y = 0; _this.y < 8; _this.y++) {
                    for (_this.x = 0; _this.x < 8; _this.x++) {
                        if (_this.x >= srcx1 && _this.x < srcx2 && _this.y >= srcy1 && _this.y < srcy2) {
                            _this.palIndex = _this.pix[_this.tIndex];
                            _this.tpri = priTable[_this.fbIndex];
                            if (_this.palIndex !== 0 && pri <= (_this.tpri & 0xFF)) {
                                buffer[_this.fbIndex] = palette[_this.palIndex + palAdd];
                                _this.tpri = (_this.tpri & 0xF00) | pri;
                                priTable[_this.fbIndex] = _this.tpri;
                            }
                        }
                        _this.fbIndex++;
                        _this.tIndex++;
                    }
                    _this.fbIndex -= 8;
                    _this.fbIndex += 256;
                    _this.tIndex -= 16;
                }
            } else {
                _this.fbIndex = (dy << 8) + dx;
                _this.tIndex = 63;
                for (_this.y = 0; _this.y < 8; _this.y++) {
                    for (_this.x = 0; _this.x < 8; _this.x++) {
                        if (_this.x >= srcx1 && _this.x < srcx2 && _this.y >= srcy1 && _this.y < srcy2) {
                            _this.palIndex = _this.pix[_this.tIndex];
                            _this.tpri = priTable[_this.fbIndex];
                            if (_this.palIndex !== 0 && pri <= (_this.tpri & 0xFF)) {
                                buffer[_this.fbIndex] = palette[_this.palIndex + palAdd];
                                _this.tpri = (_this.tpri & 0xF00) | pri;
                                priTable[_this.fbIndex] = _this.tpri;
                            }
                        }
                        _this.fbIndex++;
                        _this.tIndex--;
                    }
                    _this.fbIndex -= 8;
                    _this.fbIndex += 256;
                }
            }
        };

        _this.isTransparent = function (x, y) {
            return (_this.pix[(y << 3) + x] === 0);
        };

        _init();
    }

    PPU.Tile = Tile;
})(odd);

