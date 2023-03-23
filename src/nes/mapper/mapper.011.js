(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,
        CPU = NES.CPU,
        ROM = NES.ROM,
        Mirroring = ROM.Mirroring,
        Mapper = NES.Mapper;

    function Mapper011(nes, logger) {
        Mapper[0].call(this, nes, logger);

        var _this = this;

        function _init() {
            _this.nes = nes;
            _this.logger = logger;
        }

        _init();
    }

    Mapper011.prototype = Object.create(Mapper[0].prototype);
    Mapper011.prototype.constructor = Mapper011;
    Mapper011.prototype.id = 11;
    Mapper011.prototype.name = 'Color Dreams';

    Mapper011.prototype.write = function (address, value) {
        if (address < 0x8000) {
            Mapper[0].prototype.write.apply(this, arguments);
            return;
        }

        // Swap in the given PRG-ROM bank.
        var prgbank1 = ((value & 0xf) * 2) % this.nes.rom.romCount;
        var prgbank2 = ((value & 0xf) * 2 + 1) % this.nes.rom.romCount;
        this.loadRomBank(prgbank1, 0x8000);
        this.loadRomBank(prgbank2, 0xc000);

        if (this.nes.rom.vromCount > 0) {
            // Swap in the given VROM bank at 0x0000.
            var bank = ((value >> 4) * 2) % this.nes.rom.vromCount;
            this.loadVromBank(bank, 0x0000);
            this.loadVromBank(bank + 1, 0x1000);
        }
    };

    Mapper.register(Mapper011);
})(odd);

