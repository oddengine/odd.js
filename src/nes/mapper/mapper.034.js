(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,
        CPU = NES.CPU,
        ROM = NES.ROM,
        Mirroring = ROM.Mirroring,
        Mapper = NES.Mapper;

    function Mapper034(nes, logger) {
        Mapper[0].call(this, nes, logger);

        var _this = this;

        function _init() {
            _this.nes = nes;
            _this.logger = logger;
        }

        _init();
    }

    Mapper034.prototype = Object.create(Mapper[0].prototype);
    Mapper034.prototype.constructor = Mapper034;
    Mapper034.prototype.id = 34;
    Mapper034.prototype.name = 'Nina-1';

    Mapper034.prototype.write = function (address, value) {
        if (address < 0x8000) {
            Mapper[0].prototype.write.apply(this, arguments);
            return;
        }

        this.load32kRomBank(value, 0x8000);
    };

    Mapper.register(Mapper034);
})(odd);

