(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,
        CPU = NES.CPU,
        ROM = NES.ROM,
        Mirroring = ROM.Mirroring,
        Mapper = NES.Mapper;

    function Mapper066(nes, logger) {
        Mapper[0].call(this, nes, logger);

        var _this = this;

        function _init() {
            _this.nes = nes;
            _this.logger = logger;
        }

        _init();
    }

    Mapper066.prototype = Object.create(Mapper[0].prototype);
    Mapper066.prototype.constructor = Mapper066;
    Mapper066.prototype.id = 66;
    Mapper066.prototype.name = 'Bandai 74161';

    Mapper066.prototype.write = function (address, value) {
        if (address < 0x8000) {
            Mapper[0].prototype.write.apply(this, arguments);
            return;
        }

        // Swap in the given PRG-ROM bank at 0x8000.
        this.load32kRomBank((value >> 4) & 3, 0x8000);
        // Swap in the given VROM bank at 0x0000.
        this.load8kVromBank((value & 3) * 2, 0x0000);
    };

    Mapper.register(Mapper066);
})(odd);

