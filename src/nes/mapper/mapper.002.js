(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,
        CPU = NES.CPU,
        Mapper = NES.Mapper;

    function Mapper002(nes, logger) {
        Mapper[0].call(this, nes, logger);

        var _this = this;

        function _init() {
            _this.nes = nes;
            _this.logger = logger;
        }

        _init();
    }

    Mapper002.prototype = Object.create(Mapper[0].prototype);
    Mapper002.prototype.constructor = Mapper002;
    Mapper002.prototype.id = 2;
    Mapper002.prototype.name = 'UNROM';

    Mapper002.prototype.write = function (address, value) {
        // Writes to addresses other than MMC registers are handled by NoMapper.
        if (address < 0x8000) {
            Mapper[0].prototype.write.apply(this, arguments);
            return;
        }

        // This is a ROM bank select command.
        // Swap in the given ROM bank at 0x8000.
        this.loadRomBank(value, 0x8000);
    };

    Mapper002.prototype.loadROM = function (rom) {
        if (this.nes.rom.valid === false) {
            this.logger.warn(`Mapper ${this.id} unable to load ROM: invalid.`);
            return;
        }

        // Load PRG-ROM.
        this.loadRomBank(0, 0x8000);
        this.loadRomBank(this.nes.rom.romCount - 1, 0xC000);
        // Load CHR-ROM.
        this.loadCHRROM();
        // Do Reset-Interrupt.
        this.nes.cpu.requestIrq(CPU.IRQ.RESET);
    };

    Mapper.register(Mapper002);
})(odd);

