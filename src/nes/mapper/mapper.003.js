(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,
        CPU = NES.CPU,
        Mapper = NES.Mapper;

    function Mapper003(nes, logger) {
        Mapper[0].call(this, nes, logger);

        var _this = this;

        function _init() {
            _this.nes = nes;
            _this.logger = logger;
        }

        _init();
    }

    Mapper003.prototype = Object.create(Mapper[0].prototype);
    Mapper003.prototype.constructor = Mapper003;
    Mapper003.prototype.id = 3;
    Mapper003.prototype.name = 'CNROM';

    Mapper003.prototype.write = function (address, value) {
        // Writes to addresses other than MMC registers are handled by NoMapper.
        if (address < 0x8000) {
            Mapper[0].prototype.write.apply(this, arguments);
            return;
        }

        // This is a VROM bank select command.
        // Swap in the given VROM bank at 0x0000.
        var bank = (value % (this.nes.rom.vromCount / 2)) * 2;
        this.loadVromBank(bank, 0x0000);
        this.loadVromBank(bank + 1, 0x1000);
        this.load8kVromBank(value * 2, 0x0000);
    };

    Mapper.register(Mapper003);
})(odd);

