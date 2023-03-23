(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,
        CPU = NES.CPU,
        Mapper = NES.Mapper;

    function Mapper000(nes, logger) {
        var _this = this;

        function _init() {
            _this.nes = nes;
            _this.logger = logger;
        }

        _init();
    }

    Mapper000.prototype = Object.create(Object.prototype);
    Mapper000.prototype.constructor = Mapper000;
    Mapper000.prototype.id = 0;
    Mapper000.prototype.name = 'Direct Access';

    Mapper000.prototype.reset = function () {
        this.joy1StrobeState = 0;
        this.joy2StrobeState = 0;
        this.joypadLastWrite = 0;

        this.mousePressed = false;
        this.mouseX = 0;
        this.mouseY = 0;
    };

    Mapper000.prototype.write = function (address, value) {
        if (address < 0x2000) {
            // Mirroring of RAM.
            this.nes.cpu.mem[address & 0x7FF] = value;
        } else if (address > 0x4017) {
            this.nes.cpu.mem[address] = value;
            if (address >= 0x6000 && address < 0x8000) {
                // Write to SaveRAM. Store in file.
                // TODO(spencer@lau):
                // if (this.nes.rom != null) {
                //     this.nes.rom.writeBatteryRam(address, value);
                // }
            }
        } else if (address > 0x2007 && address < 0x4000) {
            this.regWrite(0x2000 + (address & 0x7), value);
        } else {
            this.regWrite(address, value);
        }
    };

    Mapper000.prototype.writelow = function (address, value) {
        if (address < 0x2000) {
            // Mirroring of RAM.
            this.nes.cpu.mem[address & 0x7FF] = value;
        } else if (address > 0x4017) {
            this.nes.cpu.mem[address] = value;
        } else if (address > 0x2007 && address < 0x4000) {
            this.regWrite(0x2000 + (address & 0x7), value);
        } else {
            this.regWrite(address, value);
        }
    };

    Mapper000.prototype.load = function (address) {
        // Wrap around.
        address &= 0xFFFF;
        // Check address range.
        if (address > 0x4017) {
            // ROM.
            return this.nes.cpu.mem[address];
        } else if (address >= 0x2000) {
            // I/O Ports.
            return this.regLoad(address);
        } else {
            // RAM (mirrored).
            return this.nes.cpu.mem[address & 0x7FF];
        }
    };

    Mapper000.prototype.regLoad = function (address) {
        switch (address >> 12) { // Use fourth nibble (0xF000).
            case 0:
                break;

            case 1:
                break;

            case 2:
            // fallthrough

            case 3:
                // PPU Registers.
                switch (address & 0x7) {
                    case 0x0:
                        // 0x2000
                        // PPU Control Register 1. The value is stored both
                        // in main memory and in the PPU as flags.
                        // Not in the real NES.
                        return this.nes.cpu.mem[0x2000];

                    case 0x1:
                        // 0x2001
                        // PPU Control Register 2. The value is stored both
                        // in main memory and in the PPU as flags.
                        // Not in the real NES.
                        return this.nes.cpu.mem[0x2001];

                    case 0x2:
                        // 0x2002
                        // PPU Status Register. The value is stored
                        // in main memory in addition to as flags in the PPU.
                        // Not in the real NES.
                        return this.nes.ppu.readStatusRegister();

                    case 0x3:
                        return 0;

                    case 0x4:
                        // 0x2004
                        // Sprite Memory read.
                        return this.nes.ppu.sramLoad();

                    case 0x5:
                        return 0;

                    case 0x6:
                        return 0;

                    case 0x7:
                        // 0x2007
                        // VRAM read.
                        return this.nes.ppu.vramLoad();
                }
                break;

            case 4:
                // Sound + Joypad registers.
                switch (address - 0x4015) {
                    case 0:
                        // 0x4015
                        // Sound channel enable, DMC Status.
                        return this.nes.apu.readReg(address);

                    case 1:
                        // 0x4016
                        // Joystick 1 + Strobe.
                        return this.joy1Read();

                    case 2:
                        // 0x4017
                        // Joystick 2 + Strobe.
                        if (this.mousePressed) {
                            // Check for white pixel nearby.
                            var sx = Math.max(0, this.mouseX - 4);
                            var ex = Math.min(256, this.mouseX + 4);
                            var sy = Math.max(0, this.mouseY - 4);
                            var ey = Math.min(240, this.mouseY + 4);
                            var w = 0;

                            for (var y = sy; y < ey; y++) {
                                for (var x = sx; x < ex; x++) {
                                    if (this.nes.ppu.buffer[(y << 8) + x] == 0xFFFFFF) {
                                        w |= 0x1 << 3;
                                        this.logger.debug(`Clicked on white!`);
                                        break;
                                    }
                                }
                            }
                            w |= (this.mousePressed ? (0x1 << 4) : 0);
                            return (this.joy2Read() | w) & 0xFFFF;
                        } else {
                            return this.joy2Read();
                        }
                }
                break;
        }
        return 0;
    };

    Mapper000.prototype.regWrite = function (address, value) {
        switch (address) {
            case 0x2000:
                // PPU Control register 1.
                this.nes.cpu.mem[address] = value;
                this.nes.ppu.updateControlReg1(value);
                break;

            case 0x2001:
                // PPU Control register 2.
                this.nes.cpu.mem[address] = value;
                this.nes.ppu.updateControlReg2(value);
                break;

            case 0x2003:
                // Set Sprite RAM address.
                this.nes.ppu.writeSRAMAddress(value);
                break;

            case 0x2004:
                // Write to Sprite RAM.
                this.nes.ppu.sramWrite(value);
                break;

            case 0x2005:
                // Screen Scroll offsets.
                this.nes.ppu.scrollWrite(value);
                break;

            case 0x2006:
                // Set VRAM address.
                this.nes.ppu.writeVRAMAddress(value);
                break;

            case 0x2007:
                // Write to VRAM.
                this.nes.ppu.vramWrite(value);
                break;

            case 0x4014:
                // Sprite Memory DMA Access.
                this.nes.ppu.sramDMA(value);
                break;

            case 0x4015:
                // Sound Channel Switch, DMC Status.
                this.nes.apu.writeReg(address, value);
                break;

            case 0x4016:
                // Joystick 1 + Strobe.
                if ((value & 1) === 0 && (this.joypadLastWrite & 1) === 1) {
                    this.joy1StrobeState = 0;
                    this.joy2StrobeState = 0;
                }
                this.joypadLastWrite = value;
                break;

            case 0x4017:
                // Sound channel frame sequencer.
                this.nes.apu.writeReg(address, value);
                break;

            default:
                // Sound registers.
                this.logger.debug(`Write to sound reg.`);
                if (address >= 0x4000 && address <= 0x4017) {
                    this.nes.apu.writeReg(address, value);
                }
                break;
        }
    };

    Mapper000.prototype.joy1Read = function () {
        var ret;

        switch (this.joy1StrobeState) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
                ret = this.nes.keyboard.state1[this.joy1StrobeState];
                break;
            case 8:
            case 9:
            case 10:
            case 11:
            case 12:
            case 13:
            case 14:
            case 15:
            case 16:
            case 17:
            case 18:
                ret = 0;
                break;
            case 19:
                ret = 1;
                break;
            default:
                ret = 0;
                break;
        }

        this.joy1StrobeState++;
        if (this.joy1StrobeState == 24) {
            this.joy1StrobeState = 0;
        }
        return ret;
    };

    Mapper000.prototype.joy2Read = function () {
        var ret;

        switch (this.joy2StrobeState) {
            case 0:
            case 1:
            case 2:
            case 3:
            case 4:
            case 5:
            case 6:
            case 7:
                ret = this.nes.keyboard.state2[this.joy2StrobeState];
                break;
            case 8:
            case 9:
            case 10:
            case 11:
            case 12:
            case 13:
            case 14:
            case 15:
            case 16:
            case 17:
            case 18:
                ret = 0;
                break;
            case 19:
                ret = 1;
                break;
            default:
                ret = 0;
                break;
        }

        this.joy2StrobeState++;
        if (this.joy2StrobeState == 24) {
            this.joy2StrobeState = 0;
        }
        return ret;
    };

    Mapper000.prototype.loadROM = function () {
        if (!this.nes.rom.valid || this.nes.rom.romCount < 1) {
            this.logger.warn(`Mapper ${this.id} unable to load ROM: invalid.`);
            return;
        }

        // Load ROM into memory.
        this.loadPRGROM();
        // Load CHR-ROM.
        this.loadCHRROM();
        // Load Battery RAM (if present).
        this.loadBatteryRam();
        // Reset IRQ.
        // this.nes.cpu.doResetInterrupt();
        this.nes.cpu.requestIrq(CPU.IRQ.RESET);
    };

    Mapper000.prototype.loadPRGROM = function () {
        if (this.nes.rom.romCount > 1) {
            // Load the two first banks into memory.
            this.loadRomBank(0, 0x8000);
            this.loadRomBank(1, 0xC000);
        } else {
            // Load the one bank into both memory locations.
            this.loadRomBank(0, 0x8000);
            this.loadRomBank(0, 0xC000);
        }
    };

    Mapper000.prototype.loadCHRROM = function () {
        this.logger.debug(`Loading CHR ROM ...`);
        if (this.nes.rom.vromCount > 0) {
            if (this.nes.rom.vromCount == 1) {
                this.loadVromBank(0, 0x0000);
                this.loadVromBank(0, 0x1000);
            } else {
                this.loadVromBank(0, 0x0000);
                this.loadVromBank(1, 0x1000);
            }
        } else {
            this.logger.debug(`There aren't any CHR-ROM banks.`);
        }
    };

    Mapper000.prototype.loadBatteryRam = function () {
        if (this.nes.rom.batteryRam) {
            var ram = this.nes.rom.batteryRam;
            if (ram !== null && ram.length == 0x2000) {
                // Load Battery RAM into memory.
                this.copyArrayElements(this.nes.cpu.mem, 0x6000, ram, 0, 0x2000);
            }
        }
    };

    Mapper000.prototype.loadRomBank = function (bank, address) {
        // Loads a ROM bank into the specified address.
        bank %= this.nes.rom.romCount;
        // var data = this.nes.rom.rom[bank];
        // cpuMem.write(address, data, data.length);
        this.copyArrayElements(this.nes.cpu.mem, address, this.nes.rom.rom[bank], 0, 16384);
    };

    Mapper000.prototype.loadVromBank = function (bank, address) {
        if (this.nes.rom.vromCount === 0) {
            return;
        }
        this.nes.ppu.triggerRendering();
        this.copyArrayElements(this.nes.ppu.vramMem, address, this.nes.rom.vrom[bank % this.nes.rom.vromCount], 0, 4096);

        var vromTile = this.nes.rom.vromTile[bank % this.nes.rom.vromCount];
        this.copyArrayElements(this.nes.ppu.ptTile, address >> 4, vromTile, 0, 256);
    };

    Mapper000.prototype.load32kRomBank = function (bank, address) {
        this.loadRomBank((bank * 2) % this.nes.rom.romCount, address);
        this.loadRomBank((bank * 2 + 1) % this.nes.rom.romCount, address + 16384);
    };

    Mapper000.prototype.load8kVromBank = function (bank4kStart, address) {
        if (this.nes.rom.vromCount === 0) {
            return;
        }
        this.nes.ppu.triggerRendering();

        this.loadVromBank((bank4kStart) % this.nes.rom.vromCount, address);
        this.loadVromBank((bank4kStart + 1) % this.nes.rom.vromCount, address + 4096);
    };

    Mapper000.prototype.load1kVromBank = function (bank1k, address) {
        if (this.nes.rom.vromCount === 0) {
            return;
        }
        this.nes.ppu.triggerRendering();

        var bank4k = Math.floor(bank1k / 4) % this.nes.rom.vromCount;
        var bankoffset = (bank1k % 4) * 1024;
        this.copyArrayElements(this.nes.ppu.vramMem, bankoffset, this.nes.rom.vrom[bank4k], 0, 1024);

        // Update tiles.
        var vromTile = this.nes.rom.vromTile[bank4k];
        var baseIndex = address >> 4;
        for (var i = 0; i < 64; i++) {
            this.nes.ppu.ptTile[baseIndex + i] = vromTile[((bank1k % 4) << 6) + i];
        }
    };

    Mapper000.prototype.load2kVromBank = function (bank2k, address) {
        if (this.nes.rom.vromCount === 0) {
            return;
        }
        this.nes.ppu.triggerRendering();

        var bank4k = Math.floor(bank2k / 2) % this.nes.rom.vromCount;
        var bankoffset = (bank2k % 2) * 2048;
        this.copyArrayElements(this.nes.ppu.vramMem, address, this.nes.rom.vrom[bank4k], bankoffset, 2048);

        // Update tiles.
        var vromTile = this.nes.rom.vromTile[bank4k];
        var baseIndex = address >> 4;
        for (var i = 0; i < 128; i++) {
            this.nes.ppu.ptTile[baseIndex + i] = vromTile[((bank2k % 2) << 7) + i];
        }
    };

    Mapper000.prototype.load8kRomBank = function (bank8k, address) {
        var bank16k = Math.floor(bank8k / 2) % this.nes.rom.romCount;
        var offset = (bank8k % 2) * 8192;

        // this.nes.cpu.mem.write(address, this.nes.rom.rom[bank16k], offset, 8192);
        this.copyArrayElements(this.nes.cpu.mem, address, this.nes.rom.rom[bank16k], offset, 8192);
    };

    Mapper000.prototype.copyArrayElements = function (dst, pos, src, index, length) {
        for (var i = 0; i < length; ++i) {
            dst[pos + i] = src[index + i];
        }
    };

    Mapper000.prototype.clockIrqCounter = function () {
        // Does nothing. This is used by MMC3.
    };

    Mapper000.prototype.latchAccess = function (address) {
        // Does nothing. This is used by MMC2.
    };

    Mapper.register(Mapper000);
})(odd);

