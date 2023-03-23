(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        NES = odd.NES,
        CPU = NES.CPU,

        Status = {
            VRAMWRITE: 4,
            SLSPRITECOUNT: 5,
            SPRITE0HIT: 6,
            VBLANK: 7,
        };

    function PPU(nes, logger) {
        EventDispatcher.call(this, 'PPU', { logger: logger }, [Event.ERROR]);

        var _this = this,
            _nes = nes,
            _logger = logger;

        function _init() {
            // Rendering Options:
            _this.showSpr0Hit = false;
            _this.clipToTvSize = true;

            _this.reset();
        }

        _this.reset = function () {
            // Memory.
            _this.vramMem = new Array(0x8000);
            for (var i = 0; i < _this.vramMem.length; i++) {
                _this.vramMem[i] = 0;
            }
            _this.spriteMem = new Array(0x100);
            for (var i = 0; i < _this.spriteMem.length; i++) {
                _this.spriteMem[i] = 0;
            }

            // VRAM I/O.
            _this.vramAddress = null;
            _this.vramTmpAddress = null;
            _this.vramBufferedReadValue = 0;
            _this.firstWrite = true; // VRAM/Scroll Hi/Lo latch

            // SPR-RAM I/O.
            _this.sramAddress = 0; // 8-bit only.

            _this.currentMirroring = -1;
            _this.requestEndFrame = false;
            _this.nmiOk = false;
            _this.dummyCycleToggle = false;
            _this.validTileData = false;
            _this.nmiCounter = 0;
            _this.scanlineAlreadyRendered = null;

            // Control Flags Register 1.
            _this.f_nmiOnVblank = 0;    // NMI on VBlank. 0=disable, 1=enable
            _this.f_spriteSize = 0;     // Sprite size. 0=8x8, 1=8x16
            _this.f_bgPatternTable = 0; // Background Pattern Table address. 0=0x0000,1=0x1000
            _this.f_spPatternTable = 0; // Sprite Pattern Table address. 0=0x0000,1=0x1000
            _this.f_addrInc = 0;        // PPU Address Increment. 0=1,1=32
            _this.f_nTblAddress = 0;    // Name Table Address. 0=0x2000,1=0x2400,2=0x2800,3=0x2C00

            // Control Flags Register 2.
            _this.f_color = 0;        // Background color. 0=black, 1=blue, 2=green, 4=red
            _this.f_spVisibility = 0; // Sprite visibility. 0=not displayed,1=displayed
            _this.f_bgVisibility = 0; // Background visibility. 0=Not Displayed,1=displayed
            _this.f_spClipping = 0;   // Sprite clipping. 0=Sprites invisible in left 8-pixel column,1=No clipping
            _this.f_bgClipping = 0;   // Background clipping. 0=BG invisible in left 8-pixel column, 1=No clipping
            _this.f_dispType = 0;     // Display type. 0=color, 1=monochrome

            // Counters.
            _this.cntFV = 0;
            _this.cntV = 0;
            _this.cntH = 0;
            _this.cntVT = 0;
            _this.cntHT = 0;

            // Registers.
            _this.regFV = 0;
            _this.regV = 0;
            _this.regH = 0;
            _this.regVT = 0;
            _this.regHT = 0;
            _this.regFH = 0;
            _this.regS = 0;

            // These are temporary variables used in rendering and sound procedures.
            // Their states outside of those procedures can be ignored.
            // TODO: the use of this is a bit weird, investigate.
            _this.curNt = null;

            // Variables used when rendering.
            _this.attrib = new Array(32);
            _this.buffer = new Array(256 * 240);
            _this.prevBuffer = new Array(256 * 240);
            _this.bgbuffer = new Array(256 * 240);
            _this.pixrendered = new Array(256 * 240);

            _this.validTileData = null;
            _this.scantile = new Array(32);

            // Initialize misc vars.
            _this.scanline = 0;
            _this.lastRenderedScanline = -1;
            _this.curX = 0;

            // Sprite data.
            _this.sprX = new Array(64);       // X coordinate
            _this.sprY = new Array(64);       // Y coordinate
            _this.sprTile = new Array(64);    // Tile Index (into pattern table)
            _this.sprCol = new Array(64);     // Upper two bits of color
            _this.vertFlip = new Array(64);   // Vertical Flip
            _this.horiFlip = new Array(64);   // Horizontal Flip
            _this.bgPriority = new Array(64); // Background priority
            _this.spr0HitX = 0;               // Sprite #0 hit X coordinate
            _this.spr0HitY = 0;               // Sprite #0 hit Y coordinate
            _this.hitSpr0 = false;

            // Palette data.
            _this.sprPalette = new Array(16);
            _this.imgPalette = new Array(16);

            // Create pattern table tile buffers.
            _this.ptTile = new Array(512);
            for (var i = 0; i < 512; i++) {
                _this.ptTile[i] = new PPU.Tile();
            }

            // Create nametable buffers.
            // Name table data.
            _this.ntable1 = new Array(4);
            _this.currentMirroring = -1;
            _this.nameTable = new Array(4);
            for (var i = 0; i < 4; i++) {
                _this.nameTable[i] = new PPU.NameTable(32, 32, "Nt" + i);
            }

            // Initialize mirroring lookup table.
            _this.vramMirrorTable = new Array(0x8000);
            for (var i = 0; i < 0x8000; i++) {
                _this.vramMirrorTable[i] = i;
            }

            _this.palTable = new PPU.PaletteTable();
            _this.palTable.loadNTSCPalette();
            // _this.palTable.loadDefaultPalette();

            _this.updateControlReg1(0);
            _this.updateControlReg2(0);
        };

        // Sets Nametable mirroring.
        _this.setMirroring = function (mirroring) {
            if (mirroring === _this.currentMirroring) {
                return;
            }
            _this.currentMirroring = mirroring;
            _this.triggerRendering();

            // Remove mirroring.
            if (_this.vramMirrorTable === null) {
                _this.vramMirrorTable = new Array(0x8000);
            }
            for (var i = 0; i < 0x8000; i++) {
                _this.vramMirrorTable[i] = i;
            }

            // Palette mirroring.
            _this.defineMirrorRegion(0x3f20, 0x3f00, 0x20);
            _this.defineMirrorRegion(0x3f40, 0x3f00, 0x20);
            _this.defineMirrorRegion(0x3f80, 0x3f00, 0x20);
            _this.defineMirrorRegion(0x3fc0, 0x3f00, 0x20);

            // Additional mirroring.
            _this.defineMirrorRegion(0x3000, 0x2000, 0xf00);
            _this.defineMirrorRegion(0x4000, 0x0000, 0x4000);

            switch (mirroring) {
                case NES.ROM.Mirroring.HORIZONTAL:
                    // Horizontal mirroring.
                    _this.ntable1[0] = 0;
                    _this.ntable1[1] = 0;
                    _this.ntable1[2] = 1;
                    _this.ntable1[3] = 1;
                    _this.defineMirrorRegion(0x2400, 0x2000, 0x400);
                    _this.defineMirrorRegion(0x2c00, 0x2800, 0x400);
                    break;

                case NES.ROM.Mirroring.VERTICAL:
                    // Vertical mirroring.
                    _this.ntable1[0] = 0;
                    _this.ntable1[1] = 1;
                    _this.ntable1[2] = 0;
                    _this.ntable1[3] = 1;
                    _this.defineMirrorRegion(0x2800, 0x2000, 0x400);
                    _this.defineMirrorRegion(0x2c00, 0x2400, 0x400);
                    break;

                case NES.ROM.Mirroring.SINGLESCREEN:
                    // Single Screen mirroring.
                    _this.ntable1[0] = 0;
                    _this.ntable1[1] = 0;
                    _this.ntable1[2] = 0;
                    _this.ntable1[3] = 0;
                    _this.defineMirrorRegion(0x2400, 0x2000, 0x400);
                    _this.defineMirrorRegion(0x2800, 0x2000, 0x400);
                    _this.defineMirrorRegion(0x2c00, 0x2000, 0x400);
                    break;

                case NES.ROM.Mirroring.SINGLESCREEN2:
                    _this.ntable1[0] = 1;
                    _this.ntable1[1] = 1;
                    _this.ntable1[2] = 1;
                    _this.ntable1[3] = 1;
                    _this.defineMirrorRegion(0x2400, 0x2400, 0x400);
                    _this.defineMirrorRegion(0x2800, 0x2400, 0x400);
                    _this.defineMirrorRegion(0x2c00, 0x2400, 0x400);
                    break;

                default:
                    // Assume Four-screen mirroring.
                    _this.ntable1[0] = 0;
                    _this.ntable1[1] = 1;
                    _this.ntable1[2] = 2;
                    _this.ntable1[3] = 3;
                    break;
            }
        };

        // Define a mirrored area in the address lookup table.
        // Assumes the regions don't overlap.
        // The 'to' region is the region that is physically in memory.
        _this.defineMirrorRegion = function (fromStart, toStart, size) {
            for (var i = 0; i < size; i++) {
                _this.vramMirrorTable[fromStart + i] = toStart + i;
            }
        };

        _this.startVBlank = function () {
            // Do NMI.
            _nes.cpu.requestIrq(CPU.IRQ.NMI);
            // Make sure everything is rendered.
            if (_this.lastRenderedScanline < 239) {
                _this.renderFramePartially(_this.lastRenderedScanline + 1, 240 - _this.lastRenderedScanline);
            }
            // End frame.
            _this.endFrame();
            // Reset scanline counter:
            _this.lastRenderedScanline = -1;
        };

        _this.endScanline = function () {
            switch (_this.scanline) {
                case 19:
                    // Dummy scanline. May be variable length.
                    if (_this.dummyCycleToggle) {
                        // Remove dead cycle at end of scanline, for next scanline.
                        _this.curX = 1;
                        _this.dummyCycleToggle = !_this.dummyCycleToggle;
                    }
                    break;

                case 20:
                    // Clear VBlank flag.
                    _this.setStatusFlag(Status.VBLANK, false);

                    // Clear Sprite #0 hit flag.
                    _this.setStatusFlag(Status.SPRITE0HIT, false);
                    _this.hitSpr0 = false;
                    _this.spr0HitX = -1;
                    _this.spr0HitY = -1;

                    if (_this.f_bgVisibility === 1 || _this.f_spVisibility === 1) {
                        // Update counters.
                        _this.cntFV = _this.regFV;
                        _this.cntV = _this.regV;
                        _this.cntH = _this.regH;
                        _this.cntVT = _this.regVT;
                        _this.cntHT = _this.regHT;

                        if (_this.f_bgVisibility == 1) {
                            // Render dummy scanline.
                            _this.renderBgScanline(false, 0);
                        }
                    }
                    if (_this.f_bgVisibility === 1 && _this.f_spVisibility === 1) {
                        // Check sprite 0 hit for first scanline.
                        _this.checkSprite0(0);
                    }
                    if (_this.f_bgVisibility === 1 || _this.f_spVisibility === 1) {
                        // Clock mapper IRQ Counter.
                        _nes.mmap.clockIrqCounter();
                    }
                    break;

                case 261:
                    // Dead scanline, no rendering.
                    // Set VINT.
                    _this.setStatusFlag(Status.VBLANK, true);
                    _this.requestEndFrame = true;
                    _this.nmiCounter = 9;

                    // Wrap around.
                    _this.scanline = -1; // will be incremented to 0
                    break;

                default:
                    if (_this.scanline >= 21 && _this.scanline <= 260) {
                        // Render normally.
                        if (_this.f_bgVisibility == 1) {
                            if (!_this.scanlineAlreadyRendered) {
                                // update scroll.
                                _this.cntHT = _this.regHT;
                                _this.cntH = _this.regH;
                                _this.renderBgScanline(true, _this.scanline + 1 - 21);
                            }
                            _this.scanlineAlreadyRendered = false;

                            // Check for sprite 0 (next scanline).
                            if (!_this.hitSpr0 && _this.f_spVisibility === 1) {
                                if (_this.sprX[0] >= -7 &&
                                    _this.sprX[0] < 256 &&
                                    _this.sprY[0] + 1 <= _this.scanline - 20 &&
                                    _this.sprY[0] + 1 + (_this.f_spriteSize === 0 ? 8 : 16) >= _this.scanline - 20) {
                                    if (_this.checkSprite0(_this.scanline - 20)) {
                                        _this.hitSpr0 = true;
                                    }
                                }
                            }
                        }
                        if (_this.f_bgVisibility === 1 || _this.f_spVisibility === 1) {
                            // Clock mapper IRQ Counter.
                            _nes.mmap.clockIrqCounter();
                        }
                    }
            }

            _this.scanline++;
            _this.regsToAddress();
            _this.cntsToAddress();
        };

        _this.startFrame = function () {
            // Set background color.
            var bgColor = 0;
            if (_this.f_dispType === 0) {
                // Color display.
                // f_color determines color emphasis.
                // Use first entry of image palette as BG color.
                bgColor = _this.imgPalette[0];
            } else {
                // Monochrome display.
                // f_color determines the bg color.
                switch (_this.f_color) {
                    case 0:
                        // Black
                        bgColor = 0x00000;
                        break;
                    case 1:
                        // Green
                        bgColor = 0x00FF00;
                        break;
                    case 2:
                        // Blue
                        bgColor = 0xFF0000;
                        break;
                    case 3:
                        // Invalid. Use black.
                        bgColor = 0x000000;
                        break;
                    case 4:
                        // Red
                        bgColor = 0x0000FF;
                        break;
                    default:
                        // Invalid. Use black.
                        bgColor = 0x0;
                }
            }
            for (var i = 0; i < 256 * 240; i++) {
                _this.buffer[i] = bgColor;
            }
            for (var i = 0; i < _this.pixrendered.length; i++) {
                _this.pixrendered[i] = 65;
            }
        };

        _this.endFrame = function () {
            var buffer = _this.buffer;

            // Draw spr#0 hit coordinates.
            if (_this.showSpr0Hit) {
                // Spr 0 position.
                if (_this.sprX[0] >= 0 && _this.sprX[0] < 256 &&
                    _this.sprY[0] >= 0 && _this.sprY[0] < 240) {
                    for (var i = 0; i < 256; i++) {
                        buffer[(_this.sprY[0] << 8) + i] = 0xFF5555;
                    }
                    for (var i = 0; i < 240; i++) {
                        buffer[(i << 8) + _this.sprX[0]] = 0xFF5555;
                    }
                }
                // Hit position.
                if (_this.spr0HitX >= 0 && _this.spr0HitX < 256 &&
                    _this.spr0HitY >= 0 && _this.spr0HitY < 240) {
                    for (var i = 0; i < 256; i++) {
                        buffer[(_this.spr0HitY << 8) + i] = 0x55FF55;
                    }
                    for (var i = 0; i < 240; i++) {
                        buffer[(i << 8) + _this.spr0HitX] = 0x55FF55;
                    }
                }
            }

            // This is a bit lazy.
            // if either the sprites or the background should be clipped,
            // both are clipped after rendering is finished.
            if (_this.clipToTvSize || _this.f_bgClipping === 0 || _this.f_spClipping === 0) {
                // Clip left 8-pixels column.
                for (var y = 0; y < 240; y++) {
                    for (var x = 0; x < 8; x++) {
                        buffer[(y << 8) + x] = 0;
                    }
                }
            }
            if (_this.clipToTvSize) {
                // Clip right 8-pixels column too.
                for (var y = 0; y < 240; y++) {
                    for (var x = 0; x < 8; x++) {
                        buffer[(y << 8) + 255 - x] = 0;
                    }
                }
                // Clip top and bottom 8 pixels.
                for (var y = 0; y < 8; y++) {
                    for (var x = 0; x < 256; x++) {
                        buffer[(y << 8) + x] = 0;
                        buffer[((239 - y) << 8) + x] = 0;
                    }
                }
            }

            if (_nes.config.drawFrame) {
                _nes.writeFrame(buffer, _this.prevBuffer);
            }
        };

        _this.updateControlReg1 = function (value) {
            _this.triggerRendering();

            _this.f_nmiOnVblank = (value >> 7) & 1;
            _this.f_spriteSize = (value >> 5) & 1;
            _this.f_bgPatternTable = (value >> 4) & 1;
            _this.f_spPatternTable = (value >> 3) & 1;
            _this.f_addrInc = (value >> 2) & 1;
            _this.f_nTblAddress = value & 3;

            _this.regV = (value >> 1) & 1;
            _this.regH = value & 1;
            _this.regS = (value >> 4) & 1;
        };

        _this.updateControlReg2 = function (value) {
            _this.triggerRendering();

            _this.f_color = (value >> 5) & 7;
            _this.f_spVisibility = (value >> 4) & 1;
            _this.f_bgVisibility = (value >> 3) & 1;
            _this.f_spClipping = (value >> 2) & 1;
            _this.f_bgClipping = (value >> 1) & 1;
            _this.f_dispType = value & 1;
            if (_this.f_dispType === 0) {
                _this.palTable.setEmphasis(_this.f_color);
            }
            _this.updatePalettes();
        };

        _this.setStatusFlag = function (flag, value) {
            var n = 1 << flag;
            _nes.cpu.mem[0x2002] = ((_nes.cpu.mem[0x2002] & (255 - n)) | (value ? n : 0));
        };

        // CPU Register $2002.
        // Read the Status Register.
        _this.readStatusRegister = function () {
            var tmp = _nes.cpu.mem[0x2002];

            // Reset scroll & VRAM Address toggle.
            _this.firstWrite = true;
            // Clear VBlank flag.
            _this.setStatusFlag(Status.VBLANK, false);
            // Fetch status data:
            return tmp;
        };

        // CPU Register $2003.
        // Write the SPR-RAM address that is used for sramWrite (Register 0x2004 in CPU memory map).
        _this.writeSRAMAddress = function (address) {
            _this.sramAddress = address;
        };

        // CPU Register $2004 (R).
        // Read from SPR-RAM (Sprite RAM).
        // The address should be set first.
        _this.sramLoad = function () {
            /* short tmp = sprMem.load(sramAddress);
            sramAddress++; // Increment address
            sramAddress %= 0x100;
            return tmp; */
            return _this.spriteMem[_this.sramAddress];
        };

        // CPU Register $2004 (W).
        // Write to SPR-RAM (Sprite RAM).
        // The address should be set first.
        _this.sramWrite = function (value) {
            _this.spriteMem[_this.sramAddress] = value;
            _this.spriteRamWriteUpdate(_this.sramAddress, value);
            _this.sramAddress++; // Increment address
            _this.sramAddress %= 0x100;
        };

        // CPU Register $2005.
        // Write to scroll registers.
        // The first write is the vertical offset, the second is the
        // horizontal offset.
        _this.scrollWrite = function (value) {
            _this.triggerRendering();

            if (_this.firstWrite) {
                // First write, horizontal scroll.
                _this.regHT = (value >> 3) & 31;
                _this.regFH = value & 7;
            } else {
                // Second write, vertical scroll.
                _this.regFV = value & 7;
                _this.regVT = (value >> 3) & 31;
            }
            _this.firstWrite = !_this.firstWrite;
        };

        // CPU Register $2006.
        // Sets the adress used when reading/writing from/to VRAM.
        // The first write sets the high byte, the second the low byte.
        _this.writeVRAMAddress = function (address) {
            if (_this.firstWrite) {
                _this.regFV = (address >> 4) & 3;
                _this.regV = (address >> 3) & 1;
                _this.regH = (address >> 2) & 1;
                _this.regVT = (_this.regVT & 7) | ((address & 3) << 3);
            } else {
                _this.triggerRendering();

                _this.regVT = (_this.regVT & 24) | ((address >> 5) & 7);
                _this.regHT = address & 31;

                _this.cntFV = _this.regFV;
                _this.cntV = _this.regV;
                _this.cntH = _this.regH;
                _this.cntVT = _this.regVT;
                _this.cntHT = _this.regHT;

                _this.checkSprite0(_this.scanline - 20);
            }

            _this.firstWrite = !_this.firstWrite;

            // Invoke mapper latch.
            _this.cntsToAddress();
            if (_this.vramAddress < 0x2000) {
                _nes.mmap.latchAccess(_this.vramAddress);
            }
        };

        // CPU Register $2007(R).
        // Read from PPU memory. The address should be set first.
        _this.vramLoad = function () {
            var tmp;

            _this.cntsToAddress();
            _this.regsToAddress();

            // If address is in range 0x0000-0x3EFF, return buffered values.
            if (_this.vramAddress <= 0x3EFF) {
                tmp = _this.vramBufferedReadValue;

                // Update buffered value.
                if (_this.vramAddress < 0x2000) {
                    _this.vramBufferedReadValue = _this.vramMem[_this.vramAddress];
                } else {
                    _this.vramBufferedReadValue = _this.mirroredLoad(
                        _this.vramAddress
                    );
                }

                // Mapper latch access.
                if (_this.vramAddress < 0x2000) {
                    _nes.mmap.latchAccess(_this.vramAddress);
                }

                // Increment by either 1 or 32, depending on d2 of Control Register 1.
                _this.vramAddress += (_this.f_addrInc == 1 ? 32 : 1);

                _this.cntsFromAddress();
                _this.regsFromAddress();
                return tmp; // Return the previous buffered value.
            }

            // No buffering in this mem range. Read normally.
            tmp = _this.mirroredLoad(_this.vramAddress);

            // Increment by either 1 or 32, depending on d2 of Control Register 1.
            _this.vramAddress += (_this.f_addrInc == 1 ? 32 : 1);

            _this.cntsFromAddress();
            _this.regsFromAddress();
            return tmp;
        };

        // CPU Register $2007(W).
        // Write to PPU memory. The address should be set first.
        _this.vramWrite = function (value) {
            _this.triggerRendering();
            _this.cntsToAddress();
            _this.regsToAddress();

            if (_this.vramAddress >= 0x2000) {
                // Mirroring is used.
                _this.mirroredWrite(_this.vramAddress, value);
            } else {
                // Write normally.
                _this.writeMem(_this.vramAddress, value);

                // Invoke mapper latch:
                _nes.mmap.latchAccess(_this.vramAddress);
            }

            // Increment by either 1 or 32, depending on d2 of Control Register 1.
            _this.vramAddress += (_this.f_addrInc == 1 ? 32 : 1);
            _this.regsFromAddress();
            _this.cntsFromAddress();
        };

        // CPU Register $4014.
        // Write 256 bytes of main memory into Sprite RAM.
        _this.sramDMA = function (value) {
            var baseAddress = value * 0x100;
            var data;
            for (var i = _this.sramAddress; i < 256; i++) {
                data = _nes.cpu.mem[baseAddress + i];
                _this.spriteMem[i] = data;
                _this.spriteRamWriteUpdate(i, data);
            }

            _nes.cpu.haltCycles(513);
        };

        // Updates the scroll registers from a new VRAM address.
        _this.regsFromAddress = function () {
            var address = (_this.vramTmpAddress >> 8) & 0xFF;
            _this.regFV = (address >> 4) & 7;
            _this.regV = (address >> 3) & 1;
            _this.regH = (address >> 2) & 1;
            _this.regVT = (_this.regVT & 7) | ((address & 3) << 3);

            address = _this.vramTmpAddress & 0xFF;
            _this.regVT = (_this.regVT & 24) | ((address >> 5) & 7);
            _this.regHT = address & 31;
        };

        // Updates the scroll registers from a new VRAM address.
        _this.cntsFromAddress = function () {
            var address = (_this.vramAddress >> 8) & 0xFF;
            _this.cntFV = (address >> 4) & 3;
            _this.cntV = (address >> 3) & 1;
            _this.cntH = (address >> 2) & 1;
            _this.cntVT = (_this.cntVT & 7) | ((address & 3) << 3);

            address = _this.vramAddress & 0xFF;
            _this.cntVT = (_this.cntVT & 24) | ((address >> 5) & 7);
            _this.cntHT = address & 31;
        };

        _this.regsToAddress = function () {
            var b1 = (_this.regFV & 7) << 4;
            b1 |= (_this.regV & 1) << 3;
            b1 |= (_this.regH & 1) << 2;
            b1 |= (_this.regVT >> 3) & 3;

            var b2 = (_this.regVT & 7) << 5;
            b2 |= _this.regHT & 31;

            _this.vramTmpAddress = ((b1 << 8) | b2) & 0x7FFF;
        };

        _this.cntsToAddress = function () {
            var b1 = (_this.cntFV & 7) << 4;
            b1 |= (_this.cntV & 1) << 3;
            b1 |= (_this.cntH & 1) << 2;
            b1 |= (_this.cntVT >> 3) & 3;

            var b2 = (_this.cntVT & 7) << 5;
            b2 |= _this.cntHT & 31;

            _this.vramAddress = ((b1 << 8) | b2) & 0x7FFF;
        };

        _this.incTileCounter = function (count) {
            for (var i = count; i !== 0; i--) {
                _this.cntHT++;
                if (_this.cntHT === 32) {
                    _this.cntHT = 0;
                    _this.cntVT++;
                    if (_this.cntVT >= 30) {
                        _this.cntH++;
                        if (_this.cntH === 2) {
                            _this.cntH = 0;
                            _this.cntV++;
                            if (_this.cntV === 2) {
                                _this.cntV = 0;
                                _this.cntFV++;
                                _this.cntFV &= 0x7;
                            }
                        }
                    }
                }
            }
        };

        // Reads from memory, taking into account
        // mirroring/mapping of address ranges.
        _this.mirroredLoad = function (address) {
            return _this.vramMem[_this.vramMirrorTable[address]];
        };

        // Writes to memory, taking into account
        // mirroring/mapping of address ranges.
        _this.mirroredWrite = function (address, value) {
            if (address >= 0x3f00 && address < 0x3f20) {
                // Palette write mirroring.
                if (address === 0x3F00 || address === 0x3F10) {
                    _this.writeMem(0x3F00, value);
                    _this.writeMem(0x3F10, value);
                } else if (address === 0x3F04 || address === 0x3F14) {
                    _this.writeMem(0x3F04, value);
                    _this.writeMem(0x3F14, value);
                } else if (address === 0x3F08 || address === 0x3F18) {
                    _this.writeMem(0x3F08, value);
                    _this.writeMem(0x3F18, value);
                } else if (address === 0x3F0C || address === 0x3F1C) {
                    _this.writeMem(0x3F0C, value);
                    _this.writeMem(0x3F1C, value);
                } else {
                    _this.writeMem(address, value);
                }
            } else {
                // Use lookup table for mirrored address.
                if (address < _this.vramMirrorTable.length) {
                    _this.writeMem(_this.vramMirrorTable[address], value);
                } else {
                    // FIXME
                    _logger.warn(`Invalid VRAM address: ${address.toString(16)}`);
                }
            }
        };

        _this.triggerRendering = function () {
            if (_this.scanline >= 21 && _this.scanline <= 260) {
                // Render sprites, and combine.
                _this.renderFramePartially(_this.lastRenderedScanline + 1, _this.scanline - 21 - _this.lastRenderedScanline);
                // Set last rendered scanline:
                _this.lastRenderedScanline = _this.scanline - 21;
            }
        };

        _this.renderFramePartially = function (startScan, scanCount) {
            if (_this.f_spVisibility === 1) {
                _this.renderSpritesPartially(startScan, scanCount, true);
            }
            if (_this.f_bgVisibility === 1) {
                var si = startScan << 8;
                var ei = (startScan + scanCount) << 8;
                if (ei > 0xF000) {
                    ei = 0xF000;
                }
                for (var destIndex = si; destIndex < ei; destIndex++) {
                    if (_this.pixrendered[destIndex] > 0xFF) {
                        _this.buffer[destIndex] = _this.bgbuffer[destIndex];
                    }
                }
            }
            if (_this.f_spVisibility === 1) {
                _this.renderSpritesPartially(startScan, scanCount, false);
            }
            _this.validTileData = false;
        };

        _this.renderBgScanline = function (bgbuffer, scan) {
            var baseTile = (_this.regS === 0 ? 0 : 256);
            var destIndex = (scan << 8) - _this.regFH;

            _this.curNt = _this.ntable1[_this.cntV + _this.cntV + _this.cntH];

            _this.cntHT = _this.regHT;
            _this.cntH = _this.regH;
            _this.curNt = _this.ntable1[_this.cntV + _this.cntV + _this.cntH];

            if (scan < 240 && (scan - _this.cntFV) >= 0) {
                var tscanoffset = _this.cntFV << 3;
                var targetBuffer = bgbuffer ? _this.bgbuffer : _this.buffer;

                var t, tpix, att, col;
                for (var tile = 0; tile < 32; tile++) {
                    if (scan >= 0) {
                        // Fetch tile & attrib data.
                        if (_this.validTileData) {
                            // Get data from array.
                            t = _this.scantile[tile];
                            tpix = t.pix;
                            att = _this.attrib[tile];
                        } else {
                            // Fetch data.
                            t = _this.ptTile[baseTile + _this.nameTable[_this.curNt].getTileIndex(_this.cntHT, _this.cntVT)];
                            tpix = t.pix;
                            att = _this.nameTable[_this.curNt].getAttrib(_this.cntHT, _this.cntVT);
                            _this.scantile[tile] = t;
                            _this.attrib[tile] = att;
                        }

                        // Render tile scanline.
                        var sx = 0;
                        var x = (tile << 3) - _this.regFH;
                        if (x > -8) {
                            if (x < 0) {
                                destIndex -= x;
                                sx = -x;
                            }
                            if (t.opaque[_this.cntFV]) {
                                for (; sx < 8; sx++) {
                                    targetBuffer[destIndex] = _this.imgPalette[tpix[tscanoffset + sx] + att];
                                    _this.pixrendered[destIndex] |= 256;
                                    destIndex++;
                                }
                            } else {
                                for (; sx < 8; sx++) {
                                    col = tpix[tscanoffset + sx];
                                    if (col !== 0) {
                                        targetBuffer[destIndex] = _this.imgPalette[col + att];
                                        _this.pixrendered[destIndex] |= 256;
                                    }
                                    destIndex++;
                                }
                            }
                        }
                    }

                    // Increase Horizontal Tile Counter.
                    _this.cntHT++;
                    if (_this.cntHT === 32) {
                        _this.cntHT = 0;
                        _this.cntH++;
                        _this.cntH %= 2;
                        _this.curNt = _this.ntable1[(_this.cntV << 1) + _this.cntH];
                    }
                }

                // Tile data for one row should now have been fetched,
                // so the data in the array is valid.
                _this.validTileData = true;
            }

            // update vertical scroll.
            _this.cntFV++;
            if (_this.cntFV === 8) {
                _this.cntFV = 0;
                _this.cntVT++;
                if (_this.cntVT === 30) {
                    _this.cntVT = 0;
                    _this.cntV++;
                    _this.cntV %= 2;
                    _this.curNt = _this.ntable1[(_this.cntV << 1) + _this.cntH];
                } else if (_this.cntVT === 32) {
                    _this.cntVT = 0;
                }

                // Invalidate fetched data.
                _this.validTileData = false;
            }
        };

        _this.renderSpritesPartially = function (startscan, scancount, bgPri) {
            if (_this.f_spVisibility === 1) {
                for (var i = 0; i < 64; i++) {
                    if (_this.bgPriority[i] === bgPri && _this.sprX[i] >= 0 &&
                        _this.sprX[i] < 256 && _this.sprY[i] + 8 >= startscan &&
                        _this.sprY[i] < startscan + scancount) {
                        // Show sprite.
                        if (_this.f_spriteSize === 0) {
                            // 8x8 sprites
                            _this.srcy1 = 0;
                            _this.srcy2 = 8;
                            if (_this.sprY[i] < startscan) {
                                _this.srcy1 = startscan - _this.sprY[i] - 1;
                            }
                            if (_this.sprY[i] + 8 > startscan + scancount) {
                                _this.srcy2 = startscan + scancount - _this.sprY[i] + 1;
                            }
                            if (_this.f_spPatternTable === 0) {
                                _this.ptTile[_this.sprTile[i]].render(
                                    _this.buffer,
                                    0, _this.srcy1,
                                    8, _this.srcy2,
                                    _this.sprX[i], _this.sprY[i] + 1,
                                    _this.sprCol[i],
                                    _this.sprPalette,
                                    _this.horiFlip[i],
                                    _this.vertFlip[i],
                                    i,
                                    _this.pixrendered
                                );
                            } else {
                                _this.ptTile[_this.sprTile[i] + 256].render(
                                    _this.buffer,
                                    0, _this.srcy1,
                                    8, _this.srcy2,
                                    _this.sprX[i], _this.sprY[i] + 1,
                                    _this.sprCol[i],
                                    _this.sprPalette,
                                    _this.horiFlip[i],
                                    _this.vertFlip[i],
                                    i,
                                    _this.pixrendered);
                            }
                        } else {
                            // 8x16 sprites
                            var top = _this.sprTile[i];
                            if ((top & 1) !== 0) {
                                top = _this.sprTile[i] - 1 + 256;
                            }
                            var srcy1 = 0;
                            var srcy2 = 8;
                            if (_this.sprY[i] < startscan) {
                                srcy1 = startscan - _this.sprY[i] - 1;
                            }
                            if (_this.sprY[i] + 8 > startscan + scancount) {
                                srcy2 = startscan + scancount - _this.sprY[i];
                            }
                            _this.ptTile[top + (_this.vertFlip[i] ? 1 : 0)].render(
                                _this.buffer,
                                0, srcy1,
                                8, srcy2,
                                _this.sprX[i], _this.sprY[i] + 1,
                                _this.sprCol[i],
                                _this.sprPalette,
                                _this.horiFlip[i],
                                _this.vertFlip[i],
                                i,
                                _this.pixrendered
                            );

                            srcy1 = 0;
                            srcy2 = 8;
                            if (_this.sprY[i] + 8 < startscan) {
                                srcy1 = startscan - (_this.sprY[i] + 8 + 1);
                            }
                            if (_this.sprY[i] + 16 > startscan + scancount) {
                                srcy2 = startscan + scancount - (_this.sprY[i] + 8);
                            }
                            _this.ptTile[top + (_this.vertFlip[i] ? 0 : 1)].render(
                                _this.buffer,
                                0, srcy1,
                                8, srcy2,
                                _this.sprX[i], _this.sprY[i] + 1 + 8,
                                _this.sprCol[i],
                                _this.sprPalette,
                                _this.horiFlip[i],
                                _this.vertFlip[i],
                                i,
                                _this.pixrendered
                            );
                        }
                    }
                }
            }
        };

        _this.checkSprite0 = function (scan) {
            _this.spr0HitX = -1;
            _this.spr0HitY = -1;

            var toffset;
            var tIndexAdd = (_this.f_spPatternTable === 0 ? 0 : 256);
            var x, y, t;
            var bufferIndex;
            var col;
            var bgPri;
            x = _this.sprX[0];
            y = _this.sprY[0] + 1;

            if (_this.f_spriteSize === 0) {
                // 8x8 sprites.
                // Check range.
                if (y <= scan && y + 8 > scan && x >= -7 && x < 256) {
                    // Sprite is in range.
                    // Draw scanline.
                    t = _this.ptTile[_this.sprTile[0] + tIndexAdd];
                    col = _this.sprCol[0];
                    bgPri = _this.bgPriority[0];
                    if (_this.vertFlip[0]) {
                        toffset = 7 - (scan - y);
                    } else {
                        toffset = scan - y;
                    }
                    toffset *= 8;

                    bufferIndex = scan * 256 + x;
                    if (_this.horiFlip[0]) {
                        for (var i = 7; i >= 0; i--) {
                            if (x >= 0 && x < 256) {
                                if (bufferIndex >= 0 && bufferIndex < 61440 &&
                                    _this.pixrendered[bufferIndex] !== 0) {
                                    if (t.pix[toffset + i] !== 0) {
                                        _this.spr0HitX = bufferIndex % 256;
                                        _this.spr0HitY = scan;
                                        return true;
                                    }
                                }
                            }
                            x++;
                            bufferIndex++;
                        }
                    } else {
                        for (var i = 0; i < 8; i++) {
                            if (x >= 0 && x < 256) {
                                if (bufferIndex >= 0 && bufferIndex < 61440 &&
                                    _this.pixrendered[bufferIndex] !== 0) {
                                    if (t.pix[toffset + i] !== 0) {
                                        _this.spr0HitX = bufferIndex % 256;
                                        _this.spr0HitY = scan;
                                        return true;
                                    }
                                }
                            }
                            x++;
                            bufferIndex++;
                        }
                    }
                }
            } else {
                // 8x16 sprites.
                // Check range.
                if (y <= scan && y + 16 > scan && x >= -7 && x < 256) {
                    // Sprite is in range.
                    // Draw scanline.
                    if (_this.vertFlip[0]) {
                        toffset = 15 - (scan - y);
                    } else {
                        toffset = scan - y;
                    }
                    if (toffset < 8) {
                        // first half of sprite.
                        t = _this.ptTile[_this.sprTile[0] + (_this.vertFlip[0] ? 1 : 0) + ((_this.sprTile[0] & 1) !== 0 ? 255 : 0)];
                    } else {
                        // second half of sprite.
                        t = _this.ptTile[_this.sprTile[0] + (_this.vertFlip[0] ? 0 : 1) + ((_this.sprTile[0] & 1) !== 0 ? 255 : 0)];
                        if (_this.vertFlip[0]) {
                            toffset = 15 - toffset;
                        } else {
                            toffset -= 8;
                        }
                    }
                    toffset *= 8;
                    col = _this.sprCol[0];
                    bgPri = _this.bgPriority[0];

                    bufferIndex = scan * 256 + x;
                    if (_this.horiFlip[0]) {
                        for (var i = 7; i >= 0; i--) {
                            if (x >= 0 && x < 256) {
                                if (bufferIndex >= 0 && bufferIndex < 61440 && _this.pixrendered[bufferIndex] !== 0) {
                                    if (t.pix[toffset + i] !== 0) {
                                        _this.spr0HitX = bufferIndex % 256;
                                        _this.spr0HitY = scan;
                                        return true;
                                    }
                                }
                            }
                            x++;
                            bufferIndex++;
                        }
                    } else {
                        for (var i = 0; i < 8; i++) {
                            if (x >= 0 && x < 256) {
                                if (bufferIndex >= 0 && bufferIndex < 61440 && _this.pixrendered[bufferIndex] !== 0) {
                                    if (t.pix[toffset + i] !== 0) {
                                        _this.spr0HitX = bufferIndex % 256;
                                        _this.spr0HitY = scan;
                                        return true;
                                    }
                                }
                            }
                            x++;
                            bufferIndex++;
                        }
                    }
                }
            }
            return false;
        };

        // This will write to PPU memory, and update internally buffered data appropriately.
        _this.writeMem = function (address, value) {
            _this.vramMem[address] = value;

            // Update internally buffered data.
            if (address < 0x2000) {
                _this.vramMem[address] = value;
                _this.patternWrite(address, value);
            } else if (address >= 0x2000 && address < 0x23c0) {
                _this.nameTableWrite(_this.ntable1[0], address - 0x2000, value);
            } else if (address >= 0x23c0 && address < 0x2400) {
                _this.attribTableWrite(_this.ntable1[0], address - 0x23c0, value);
            } else if (address >= 0x2400 && address < 0x27c0) {
                _this.nameTableWrite(_this.ntable1[1], address - 0x2400, value);
            } else if (address >= 0x27c0 && address < 0x2800) {
                _this.attribTableWrite(_this.ntable1[1], address - 0x27c0, value);
            } else if (address >= 0x2800 && address < 0x2bc0) {
                _this.nameTableWrite(_this.ntable1[2], address - 0x2800, value);
            } else if (address >= 0x2bc0 && address < 0x2c00) {
                _this.attribTableWrite(_this.ntable1[2], address - 0x2bc0, value);
            } else if (address >= 0x2c00 && address < 0x2fc0) {
                _this.nameTableWrite(_this.ntable1[3], address - 0x2c00, value);
            } else if (address >= 0x2fc0 && address < 0x3000) {
                _this.attribTableWrite(_this.ntable1[3], address - 0x2fc0, value);
            } else if (address >= 0x3f00 && address < 0x3f20) {
                _this.updatePalettes();
            }
        };

        // Reads data from $3f00 to $f20 
        // into the two buffered palettes.
        _this.updatePalettes = function () {
            for (var i = 0; i < 16; i++) {
                if (_this.f_dispType === 0) {
                    _this.imgPalette[i] = _this.palTable.getEntry(_this.vramMem[0x3f00 + i] & 63);
                } else {
                    _this.imgPalette[i] = _this.palTable.getEntry(_this.vramMem[0x3f00 + i] & 32);
                }
            }
            for (var i = 0; i < 16; i++) {
                if (_this.f_dispType === 0) {
                    _this.sprPalette[i] = _this.palTable.getEntry(_this.vramMem[0x3f10 + i] & 63);
                } else {
                    _this.sprPalette[i] = _this.palTable.getEntry(_this.vramMem[0x3f10 + i] & 32);
                }
            }
        };

        // Updates the internal pattern table buffers with this new byte.
        // In vNES, there is a version of this with 4 arguments which isn't used.
        _this.patternWrite = function (address, value) {
            var tileIndex = Math.floor(address / 16);
            var leftOver = address % 16;
            if (leftOver < 8) {
                _this.ptTile[tileIndex].setScanline(leftOver, value, _this.vramMem[address + 8]);
            } else {
                _this.ptTile[tileIndex].setScanline(leftOver - 8, _this.vramMem[address - 8], value);
            }
        };

        // Updates the internal name table buffers with this new byte.
        _this.nameTableWrite = function (index, address, value) {
            _this.nameTable[index].tile[address] = value;

            // Update Sprite #0 hit.
            // updateSpr0Hit();
            _this.checkSprite0(_this.scanline - 20);
        };

        // Updates the internal pattern table buffers with this new attribute table byte.
        _this.attribTableWrite = function (index, address, value) {
            _this.nameTable[index].writeAttrib(address, value);
        };

        // Updates the internally buffered sprite data with this new byte of info.
        _this.spriteRamWriteUpdate = function (address, value) {
            var tIndex = Math.floor(address / 4);
            if (tIndex === 0) {
                // updateSpr0Hit();
                _this.checkSprite0(_this.scanline - 20);
            }
            if (address % 4 === 0) {
                // Y coordinate
                _this.sprY[tIndex] = value;
            } else if (address % 4 == 1) {
                // Tile index
                _this.sprTile[tIndex] = value;
            } else if (address % 4 == 2) {
                // Attributes
                _this.vertFlip[tIndex] = ((value & 0x80) !== 0);
                _this.horiFlip[tIndex] = ((value & 0x40) !== 0);
                _this.bgPriority[tIndex] = ((value & 0x20) !== 0);
                _this.sprCol[tIndex] = (value & 3) << 2;
            } else if (address % 4 == 3) {
                // X coordinate
                _this.sprX[tIndex] = value;
            }
        };

        _this.doNMI = function () {
            // Set VBlank flag.
            _this.setStatusFlag(Status.VBLANK, true);
            // _nes.cpu.doNonMaskableInterrupt();
            _nes.cpu.requestIrq(CPU.IRQ.NMI);
        };

        _init();
    }

    PPU.prototype = Object.create(EventDispatcher.prototype);
    PPU.prototype.constructor = PPU;

    PPU.Status = Status;
    NES.PPU = PPU;
})(odd);

