(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,
        CPU = NES.CPU,
        ROM = NES.ROM,
        Mirroring = ROM.Mirroring,
        Mapper = NES.Mapper,

        CMD = {
            SEL_2_1K_VROM_0000: 0,
            SEL_2_1K_VROM_0800: 1,
            SEL_1K_VROM_1000: 2,
            SEL_1K_VROM_1400: 3,
            SEL_1K_VROM_1800: 4,
            SEL_1K_VROM_1C00: 5,
            SEL_ROM_PAGE1: 6,
            SEL_ROM_PAGE2: 7,
        };

    function Mapper004(nes, logger) {
        Mapper[0].call(this, nes, logger);

        var _this = this;

        function _init() {
            _this.nes = nes;
            _this.logger = logger;
        }

        _init();
    }

    Mapper004.prototype = Object.create(Mapper[0].prototype);
    Mapper004.prototype.constructor = Mapper004;
    Mapper004.prototype.id = 4;
    Mapper004.prototype.name = 'Nintendo MMC3';

    Mapper004.prototype.reset = function () {
        this.command = 0;
        this.prgAddressSelect = 0;
        this.chrAddressSelect = 0;
        this.irqCounter = 0;
        this.irqLatchValue = 0;
        this.irqEnable = 0;
        this.prgAddressChanged = false;
    };

    Mapper004.prototype.write = function (address, value) {
        // Writes to addresses other than MMC registers are handled by NoMapper.
        if (address < 0x8000) {
            Mapper[0].prototype.write.apply(this, arguments);
            return;
        }

        switch (address) {
            case 0x8000:
                // Command/Address Select register.
                this.command = value & 7;
                var tmp = (value >> 6) & 1;
                if (tmp != this.prgAddressSelect) {
                    this.prgAddressChanged = true;
                }
                this.prgAddressSelect = tmp;
                this.chrAddressSelect = (value >> 7) & 1;
                break;

            case 0x8001:
                // Page number for command.
                this.executeCommand(this.command, value);
                break;

            case 0xA000:
                // Mirroring select.
                if ((value & 1) !== 0) {
                    this.nes.ppu.setMirroring(Mirroring.HORIZONTAL);
                } else {
                    this.nes.ppu.setMirroring(Mirroring.VERTICAL);
                }
                break;

            case 0xA001:
                // SaveRAM Toggle.
                // TODO(spencer@lau):
                // this.nes.rom.setSaveState((value & 1) != 0);
                break;

            case 0xC000:
                // IRQ Counter register.
                this.irqCounter = value;
                this.nes.ppu.mapperIrqCounter = 0;
                break;

            case 0xC001:
                // IRQ Latch register.
                this.irqLatchValue = value;
                break;

            case 0xE000:
                // IRQ Control Reg 0 (disable).
                // this.irqCounter = this.irqLatchValue;
                this.irqEnable = 0;
                break;

            case 0xE001:
                // IRQ Control Reg 1 (enable).
                this.irqEnable = 1;
                break;

            default:
                // Not a MMC3 register.
                // The game has probably crashed, since it tries to write to ROM.
                // IGNORE.
                break;
        }
    };

    Mapper004.prototype.loadROM = function (rom) {
        if (this.nes.rom.valid === false) {
            this.logger.warn(`Mapper ${this.id} unable to load ROM: invalid.`);
            return;
        }

        // Load hardwired PRG banks (0xC000 and 0xE000).
        this.load8kRomBank(((this.nes.rom.romCount - 1) * 2), 0xC000);
        this.load8kRomBank(((this.nes.rom.romCount - 1) * 2) + 1, 0xE000);
        // Load swappable PRG banks (0x8000 and 0xA000).
        this.load8kRomBank(0, 0x8000);
        this.load8kRomBank(1, 0xA000);
        // Load CHR-ROM.
        this.loadCHRROM();
        // Load Battery RAM (if present).
        this.loadBatteryRam();
        // Do Reset-Interrupt.
        this.nes.cpu.requestIrq(CPU.IRQ.RESET);
    };

    Mapper004.prototype.executeCommand = function (cmd, arg) {
        switch (cmd) {
            case CMD.SEL_2_1K_VROM_0000:
                // Select 2 1KB VROM pages at 0x0000.
                if (this.chrAddressSelect === 0) {
                    this.load1kVromBank(arg, 0x0000);
                    this.load1kVromBank(arg + 1, 0x0400);
                } else {
                    this.load1kVromBank(arg, 0x1000);
                    this.load1kVromBank(arg + 1, 0x1400);
                }
                break;

            case CMD.SEL_2_1K_VROM_0800:
                // Select 2 1KB VROM pages at 0x0800.
                if (this.chrAddressSelect === 0) {
                    this.load1kVromBank(arg, 0x0800);
                    this.load1kVromBank(arg + 1, 0x0C00);
                } else {
                    this.load1kVromBank(arg, 0x1800);
                    this.load1kVromBank(arg + 1, 0x1C00);
                }
                break;

            case CMD.SEL_1K_VROM_1000:
                // Select 1K VROM Page at 0x1000.
                if (this.chrAddressSelect === 0) {
                    this.load1kVromBank(arg, 0x1000);
                } else {
                    this.load1kVromBank(arg, 0x0000);
                }
                break;

            case CMD.SEL_1K_VROM_1400:
                // Select 1K VROM Page at 0x1400.
                if (this.chrAddressSelect === 0) {
                    this.load1kVromBank(arg, 0x1400);
                } else {
                    this.load1kVromBank(arg, 0x0400);
                }
                break;

            case CMD.SEL_1K_VROM_1800:
                // Select 1K VROM Page at 0x1800.
                if (this.chrAddressSelect === 0) {
                    this.load1kVromBank(arg, 0x1800);
                } else {
                    this.load1kVromBank(arg, 0x0800);
                }
                break;

            case CMD.SEL_1K_VROM_1C00:
                // Select 1K VROM Page at 0x1C00.
                if (this.chrAddressSelect === 0) {
                    this.load1kVromBank(arg, 0x1C00);
                } else {
                    this.load1kVromBank(arg, 0x0C00);
                }
                break;

            case CMD.SEL_ROM_PAGE1:
                if (this.prgAddressChanged) {
                    // Load the two hardwired banks.
                    if (this.prgAddressSelect === 0) {
                        this.load8kRomBank(((this.nes.rom.romCount - 1) * 2), 0xC000);
                    } else {
                        this.load8kRomBank(((this.nes.rom.romCount - 1) * 2), 0x8000);
                    }
                    this.prgAddressChanged = false;
                }

                // Select first switchable ROM page.
                if (this.prgAddressSelect === 0) {
                    this.load8kRomBank(arg, 0x8000);
                } else {
                    this.load8kRomBank(arg, 0xC000);
                }
                break;

            case CMD.SEL_ROM_PAGE2:
                // Select second switchable ROM page.
                this.load8kRomBank(arg, 0xA000);

                // hardwire appropriate bank.
                if (this.prgAddressChanged) {
                    // Load the two hardwired banks.
                    if (this.prgAddressSelect === 0) {
                        this.load8kRomBank(((this.nes.rom.romCount - 1) * 2), 0xC000);
                    } else {
                        this.load8kRomBank(((this.nes.rom.romCount - 1) * 2), 0x8000);
                    }
                    this.prgAddressChanged = false;
                }
                break;
        }
    };

    Mapper004.prototype.clockIrqCounter = function () {
        if (this.irqEnable == 1) {
            this.irqCounter--;
            if (this.irqCounter < 0) {
                // Trigger IRQ.
                this.nes.cpu.requestIrq(CPU.IRQ.NORMAL);
                this.irqCounter = this.irqLatchValue;
            }
        }
    };

    Mapper004.CMD = CMD;
    Mapper.register(Mapper004);
})(odd);

