(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        NES = odd.NES,
        PPU = NES.PPU,

        Mirroring = {
            VERTICAL: 0,
            HORIZONTAL: 1,
            FOURSCREEN: 2,
            SINGLESCREEN: 3,
            SINGLESCREEN2: 4,
            SINGLESCREEN3: 5,
            SINGLESCREEN4: 6,
            CHRROM: 7,
        };

    function ROM(nes, logger) {
        EventDispatcher.call(this, 'ROM', { logger: logger }, [Event.ERROR]);

        var _this = this,
            _nes = nes,
            _logger = logger;

        function _init() {
            _this.valid = false;
        }

        _this.load = function (buffer) {
            var data = new Uint8Array(buffer);
            if (data[0] !== 0x4E || data[1] !== 0x45 || data[2] !== 0x53) {
                _logger.error(`Not a valid NES ROM.`);
                return Promise.reject('invalid');
            }
            _this.header = new Array(16);
            for (var i = 0; i < 16; i++) {
                _this.header[i] = data[i];
            }
            _this.romCount = _this.header[4];
            _this.vromCount = _this.header[5] * 2; // Get the number of 4kB banks, not 8kB.
            _this.mirroring = (_this.header[6] & 1) !== 0 ? 1 : 0;
            _this.batteryRam = (_this.header[6] & 2) !== 0;
            _this.trainer = (_this.header[6] & 4) !== 0;
            _this.fourScreen = (_this.header[6] & 8) !== 0;
            _this.mapperType = (_this.header[6] >> 4) | (_this.header[7] & 0xF0);
            // TODO(spencer@lau):
            // if (_this.batteryRam) {
            //     _this.loadBatteryRam();
            // }

            // Check whether byte 8-15 are zero's.
            var foundError = false;
            for (var i = 8; i < 16; i++) {
                if (_this.header[i] !== 0) {
                    foundError = true;
                    break;
                }
            }
            if (foundError) {
                _this.mapperType &= 0xF; // Ignore byte 7.
            }

            // Load PRG-ROM banks.
            _this.rom = new Array(_this.romCount);
            var offset = 16;
            for (var i = 0; i < _this.romCount; i++) {
                _this.rom[i] = new Array(16384);
                for (var j = 0; j < 16384; j++) {
                    if (offset + j >= data.length) {
                        break;
                    }
                    _this.rom[i][j] = data[offset + j];
                }
                offset += 16384;
            }

            // Load CHR-ROM banks.
            _this.vrom = new Array(_this.vromCount);
            for (var i = 0; i < _this.vromCount; i++) {
                _this.vrom[i] = new Array(4096);
                for (var j = 0; j < 4096; j++) {
                    if (offset + j >= data.length) {
                        break;
                    }
                    _this.vrom[i][j] = data[offset + j];
                }
                offset += 4096;
            }

            // Create VROM tiles.
            _this.vromTile = new Array(_this.vromCount);
            for (var i = 0; i < _this.vromCount; i++) {
                _this.vromTile[i] = new Array(256);
                for (var j = 0; j < 256; j++) {
                    _this.vromTile[i][j] = new PPU.Tile();
                }
            }

            // Convert CHR-ROM banks to tiles.
            var tileIndex;
            var leftOver;
            for (var v = 0; v < _this.vromCount; v++) {
                for (var i = 0; i < 4096; i++) {
                    tileIndex = i >> 4;
                    leftOver = i % 16;
                    if (leftOver < 8) {
                        _this.vromTile[v][tileIndex].setScanline(leftOver, _this.vrom[v][i], _this.vrom[v][i + 8]);
                    } else {
                        _this.vromTile[v][tileIndex].setScanline(leftOver - 8, _this.vrom[v][i - 8], _this.vrom[v][i]);
                    }
                }
            }

            _this.valid = true;
            return Promise.resolve();
        };

        _this.getMirroringType = function () {
            if (_this.fourScreen) {
                return Mirroring.FOURSCREEN;
            }
            if (_this.mirroring === 0) {
                return Mirroring.HORIZONTAL;
            }
            return Mirroring.VERTICAL;
        };

        _init();
    }

    ROM.prototype = Object.create(EventDispatcher.prototype);
    ROM.prototype.constructor = ROM;

    ROM.Mirroring = Mirroring;
    NES.ROM = ROM;
})(odd);

