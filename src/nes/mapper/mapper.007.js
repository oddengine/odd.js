(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,
        CPU = NES.CPU,
        ROM = NES.ROM,
        Mirroring = ROM.Mirroring,
        Mapper = NES.Mapper;

    function Mapper007(nes, logger) {
        Mapper[0].call(this, nes, logger);

        var _this = this;

        function _init() {
            _this.nes = nes;
            _this.logger = logger;
        }

        _init();
    }

    Mapper007.prototype = Object.create(Mapper[0].prototype);
    Mapper007.prototype.constructor = Mapper007;
    Mapper007.prototype.id = 7;
    Mapper007.prototype.name = 'AOROM';

    Mapper007.prototype.write = function (address, value) {
        // Writes to addresses other than MMC registers are handled by NoMapper.
        if (address < 0x8000) {
            Mapper[0].prototype.write.apply(this, arguments);
            return;
        }

        this.load32kRomBank(value & 0x7, 0x8000);
        if (value & 0x10) {
            this.nes.ppu.setMirroring(Mirroring.SINGLESCREEN2);
        } else {
            this.nes.ppu.setMirroring(Mirroring.SINGLESCREEN);
        }
    };

    Mapper007.prototype.loadROM = function (rom) {
        if (this.nes.rom.valid === false) {
            this.logger.warn(`Mapper ${this.id} unable to load ROM: invalid.`);
            return;
        }

        // Load PRG-ROM.
        this.loadPRGROM();
        // Load CHR-ROM.
        this.loadCHRROM();
        // Do Reset-Interrupt.
        this.nes.cpu.requestIrq(CPU.IRQ.RESET);
    };

    Mapper.register(Mapper007);
})(odd);

