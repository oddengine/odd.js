(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        NES = odd.NES,

        FREQ_NTSC = 1789772.5,
        IRQ = {
            NORMAL: 0,
            NMI: 1,
            RESET: 2,
        };

    function CPU(nes, logger) {
        EventDispatcher.call(this, 'CPU', { logger: logger }, [Event.ERROR]);

        var _this = this,
            _nes = nes,
            _logger = logger;

        function _init() {
            _this.reset();
        }

        _this.reset = function () {
            // Main memory.
            _this.mem = new Array(0x10000);
            for (var i = 0; i < 0x2000; i++) {
                _this.mem[i] = 0xFF;
            }
            for (var p = 0; p < 4; p++) {
                var i = p * 0x800;
                _this.mem[i + 0x008] = 0xF7;
                _this.mem[i + 0x009] = 0xEF;
                _this.mem[i + 0x00A] = 0xDF;
                _this.mem[i + 0x00F] = 0xBF;
            }
            for (var i = 0x2001; i < _this.mem.length; i++) {
                _this.mem[i] = 0;
            }

            // CPU Registers.
            _this.REG_ACC = 0;
            _this.REG_X = 0;
            _this.REG_Y = 0;

            // Reset Stack pointer.
            _this.REG_SP = 0x01FF;

            // Reset Program counter.
            _this.REG_PC = 0x8000 - 1;
            _this.REG_PC_NEW = 0x8000 - 1;

            // Reset Status register.
            _this.REG_STATUS = 0x28;
            _this.setStatus(0x28);

            // Set flags.
            _this.F_CARRY = 0;
            _this.F_DECIMAL = 0;
            _this.F_INTERRUPT = 1;
            _this.F_INTERRUPT_NEW = 1;
            _this.F_OVERFLOW = 0;
            _this.F_SIGN = 0;
            _this.F_ZERO = 1;
            _this.F_NOTUSED = 1;
            _this.F_NOTUSED_NEW = 1;
            _this.F_BRK = 1;
            _this.F_BRK_NEW = 1;

            _this.opdata = new CPU.OpData().opdata;
            _this.cyclesToHalt = 0;

            // Reset crash flag.
            _this.crash = false;

            // Interrupt notification.
            _this.irqRequested = false;
            _this.irqType = null;
        };

        // Emulates a single CPU instruction, returns the number of cycles.
        _this.emulate = function () {
            var tmp;
            var add;

            // Check interrupts.
            if (_this.irqRequested) {
                tmp =
                    (_this.F_CARRY) |
                    ((_this.F_ZERO === 0 ? 1 : 0) << 1) |
                    (_this.F_INTERRUPT << 2) |
                    (_this.F_DECIMAL << 3) |
                    (_this.F_BRK << 4) |
                    (_this.F_NOTUSED << 5) |
                    (_this.F_OVERFLOW << 6) |
                    (_this.F_SIGN << 7);

                _this.REG_PC_NEW = _this.REG_PC;
                _this.F_INTERRUPT_NEW = _this.F_INTERRUPT;
                switch (_this.irqType) {
                    case 0:
                        // Normal IRQ:
                        if (_this.F_INTERRUPT != 0) {
                            _logger.warn(`Interrupt was masked.`);
                            break;
                        }
                        _this.doIrq(tmp);
                        _logger.debug(`Normal IRQ: I=${_this.F_INTERRUPT}`);
                        break;
                    case 1:
                        // NMI:
                        _this.doNonMaskableInterrupt(tmp);
                        break;
                    case 2:
                        // Reset:
                        _this.doResetInterrupt();
                        break;
                }

                _this.REG_PC = _this.REG_PC_NEW;
                _this.F_INTERRUPT = _this.F_INTERRUPT_NEW;
                _this.F_BRK = _this.F_BRK_NEW;
                _this.irqRequested = false;
            }

            var opinf = _this.opdata[_nes.mmap.load(_this.REG_PC + 1)];
            var cycleCount = (opinf >> 24);
            var cycleAdd = 0;

            // Find address mode:
            var addrMode = (opinf >> 8) & 0xFF;

            // Increment PC by number of op bytes:
            var opaddr = _this.REG_PC;
            _this.REG_PC += ((opinf >> 16) & 0xFF);

            var addr = 0;
            switch (addrMode) {
                case 0:
                    // Zero Page mode. Use the address given after the opcode, 
                    // but without high byte.
                    addr = _this.load(opaddr + 2);
                    break;
                case 1:
                    // Relative mode.
                    addr = _this.load(opaddr + 2);
                    if (addr < 0x80) {
                        addr += _this.REG_PC;
                    } else {
                        addr += _this.REG_PC - 256;
                    }
                    break;
                case 2:
                    // Ignore. Address is implied in instruction.
                    break;
                case 3:
                    // Absolute mode. Use the two bytes following the opcode as 
                    // an address.
                    addr = _this.load16bit(opaddr + 2);
                    break;
                case 4:
                    // Accumulator mode. The address is in the accumulator 
                    // register.
                    addr = _this.REG_ACC;
                    break;
                case 5:
                    // Immediate mode. The value is given after the opcode.
                    addr = _this.REG_PC;
                    break;
                case 6:
                    // Zero Page Indexed mode, X as index. Use the address given 
                    // after the opcode, then add the
                    // X register to it to get the final address.
                    addr = (_this.load(opaddr + 2) + _this.REG_X) & 0xFF;
                    break;
                case 7:
                    // Zero Page Indexed mode, Y as index. Use the address given 
                    // after the opcode, then add the
                    // Y register to it to get the final address.
                    addr = (_this.load(opaddr + 2) + _this.REG_Y) & 0xFF;
                    break;
                case 8:
                    // Absolute Indexed Mode, X as index. Same as zero page 
                    // indexed, but with the high byte.
                    addr = _this.load16bit(opaddr + 2);
                    if ((addr & 0xFF00) != ((addr + _this.REG_X) & 0xFF00)) {
                        cycleAdd = 1;
                    }
                    addr += _this.REG_X;
                    break;
                case 9:
                    // Absolute Indexed Mode, Y as index. Same as zero page 
                    // indexed, but with the high byte.
                    addr = _this.load16bit(opaddr + 2);
                    if ((addr & 0xFF00) != ((addr + _this.REG_Y) & 0xFF00)) {
                        cycleAdd = 1;
                    }
                    addr += _this.REG_Y;
                    break;
                case 10:
                    // Pre-indexed Indirect mode. Find the 16-bit address 
                    // starting at the given location plus
                    // the current X register. The value is the contents of that 
                    // address.
                    addr = _this.load(opaddr + 2);
                    if ((addr & 0xFF00) != ((addr + _this.REG_X) & 0xFF00)) {
                        cycleAdd = 1;
                    }
                    addr += _this.REG_X;
                    addr &= 0xFF;
                    addr = _this.load16bit(addr);
                    break;
                case 11:
                    // Post-indexed Indirect mode. Find the 16-bit address 
                    // contained in the given location
                    // (and the one following). Add to that address the contents 
                    // of the Y register. Fetch the value
                    // stored at that adress.
                    addr = _this.load16bit(_this.load(opaddr + 2));
                    if ((addr & 0xFF00) != ((addr + _this.REG_Y) & 0xFF00)) {
                        cycleAdd = 1;
                    }
                    addr += _this.REG_Y;
                    break;
                case 12:
                    // Indirect Absolute mode. Find the 16-bit address contained 
                    // at the given location.

                    // Find op.
                    addr = _this.load16bit(opaddr + 2);
                    if (addr < 0x1FFF) {
                        // Read from address given in op.
                        addr = _this.mem[addr] + (_this.mem[(addr & 0xFF00) | (((addr & 0xFF) + 1) & 0xFF)] << 8);
                    } else {
                        addr = _nes.mmap.load(addr) + (_nes.mmap.load((addr & 0xFF00) | (((addr & 0xFF) + 1) & 0xFF)) << 8);
                    }
                    break;
            }
            // Wrap around for addresses above 0xFFFF.
            addr &= 0xFFFF;

            // ----------------------------------------------------------------------------------------------------
            // Decode & execute instruction
            // ----------------------------------------------------------------------------------------------------

            // This should be compiled to a jump table.
            switch (opinf & 0xFF) {
                case 0:
                    // *******
                    // * ADC *
                    // *******

                    // Add with carry.
                    tmp = _this.REG_ACC + _this.load(addr) + _this.F_CARRY;
                    _this.F_OVERFLOW = ((!(((_this.REG_ACC ^ _this.load(addr)) & 0x80) != 0) && (((_this.REG_ACC ^ tmp) & 0x80)) != 0) ? 1 : 0);
                    _this.F_CARRY = (tmp > 255 ? 1 : 0);
                    _this.F_SIGN = (tmp >> 7) & 1;
                    _this.F_ZERO = tmp & 0xFF;
                    _this.REG_ACC = (tmp & 255);
                    cycleCount += cycleAdd;
                    break;

                case 1:
                    // *******
                    // * AND *
                    // *******

                    // AND memory with accumulator.
                    _this.REG_ACC = _this.REG_ACC & _this.load(addr);
                    _this.F_SIGN = (_this.REG_ACC >> 7) & 1;
                    _this.F_ZERO = _this.REG_ACC;
                    // _this.REG_ACC = tmp;
                    if (addrMode != 11) { // PostIdxInd = 11
                        cycleCount += cycleAdd;
                    }
                    break;

                case 2:
                    // *******
                    // * ASL *
                    // *******

                    // Shift left one bit.
                    if (addrMode == 4) { // ADDR.ACC = 4
                        _this.F_CARRY = (_this.REG_ACC >> 7) & 1;
                        _this.REG_ACC = (_this.REG_ACC << 1) & 255;
                        _this.F_SIGN = (_this.REG_ACC >> 7) & 1;
                        _this.F_ZERO = _this.REG_ACC;
                    } else {
                        tmp = _this.load(addr);
                        _this.F_CARRY = (tmp >> 7) & 1;
                        tmp = (tmp << 1) & 255;
                        _this.F_SIGN = (tmp >> 7) & 1;
                        _this.F_ZERO = tmp;
                        _this.write(addr, tmp);
                    }
                    break;

                case 3:
                    // *******
                    // * BCC *
                    // *******

                    // Branch on carry clear.
                    if (_this.F_CARRY == 0) {
                        cycleCount += ((opaddr & 0xFF00) != (addr & 0xFF00) ? 2 : 1);
                        _this.REG_PC = addr;
                    }
                    break;

                case 4:
                    // *******
                    // * BCS *
                    // *******

                    // Branch on carry set.
                    if (_this.F_CARRY == 1) {
                        cycleCount += ((opaddr & 0xFF00) != (addr & 0xFF00) ? 2 : 1);
                        _this.REG_PC = addr;
                    }
                    break;

                case 5:
                    // *******
                    // * BEQ *
                    // *******

                    // Branch on zero.
                    if (_this.F_ZERO == 0) {
                        cycleCount += ((opaddr & 0xFF00) != (addr & 0xFF00) ? 2 : 1);
                        _this.REG_PC = addr;
                    }
                    break;

                case 6:
                    // *******
                    // * BIT *
                    // *******

                    tmp = _this.load(addr);
                    _this.F_SIGN = (tmp >> 7) & 1;
                    _this.F_OVERFLOW = (tmp >> 6) & 1;
                    tmp &= _this.REG_ACC;
                    _this.F_ZERO = tmp;
                    break;

                case 7:
                    // *******
                    // * BMI *
                    // *******

                    // Branch on negative result.
                    if (_this.F_SIGN == 1) {
                        cycleCount++;
                        _this.REG_PC = addr;
                    }
                    break;

                case 8:
                    // *******
                    // * BNE *
                    // *******

                    // Branch on not zero.
                    if (_this.F_ZERO != 0) {
                        cycleCount += ((opaddr & 0xFF00) != (addr & 0xFF00) ? 2 : 1);
                        _this.REG_PC = addr;
                    }
                    break;

                case 9:
                    // *******
                    // * BPL *
                    // *******

                    // Branch on positive result.
                    if (_this.F_SIGN == 0) {
                        cycleCount += ((opaddr & 0xFF00) != (addr & 0xFF00) ? 2 : 1);
                        _this.REG_PC = addr;
                    }
                    break;

                case 10:
                    // *******
                    // * BRK *
                    // *******

                    _this.REG_PC += 2;
                    _this.push((_this.REG_PC >> 8) & 255);
                    _this.push(_this.REG_PC & 255);
                    _this.F_BRK = 1;

                    _this.push(
                        (_this.F_CARRY) |
                        ((_this.F_ZERO == 0 ? 1 : 0) << 1) |
                        (_this.F_INTERRUPT << 2) |
                        (_this.F_DECIMAL << 3) |
                        (_this.F_BRK << 4) |
                        (_this.F_NOTUSED << 5) |
                        (_this.F_OVERFLOW << 6) |
                        (_this.F_SIGN << 7)
                    );

                    _this.F_INTERRUPT = 1;
                    // _this.REG_PC = _this.load(0xFFFE) | (_this.load(0xFFFF) << 8);
                    _this.REG_PC = _this.load16bit(0xFFFE);
                    _this.REG_PC--;
                    break;

                case 11:
                    // *******
                    // * BVC *
                    // *******

                    // Branch on overflow clear.
                    if (_this.F_OVERFLOW == 0) {
                        cycleCount += ((opaddr & 0xFF00) != (addr & 0xFF00) ? 2 : 1);
                        _this.REG_PC = addr;
                    }
                    break;

                case 12:
                    // *******
                    // * BVS *
                    // *******

                    // Branch on overflow set.
                    if (_this.F_OVERFLOW == 1) {
                        cycleCount += ((opaddr & 0xFF00) != (addr & 0xFF00) ? 2 : 1);
                        _this.REG_PC = addr;
                    }
                    break;

                case 13:
                    // *******
                    // * CLC *
                    // *******

                    // Clear carry flag.
                    _this.F_CARRY = 0;
                    break;

                case 14:
                    // *******
                    // * CLD *
                    // *******

                    // Clear decimal flag.
                    _this.F_DECIMAL = 0;
                    break;

                case 15:
                    // *******
                    // * CLI *
                    // *******

                    // Clear interrupt flag.
                    _this.F_INTERRUPT = 0;
                    break;

                case 16:
                    // *******
                    // * CLV *
                    // *******

                    // Clear overflow flag.
                    _this.F_OVERFLOW = 0;
                    break;

                case 17:
                    // *******
                    // * CMP *
                    // *******

                    // Compare memory and accumulator.
                    tmp = _this.REG_ACC - _this.load(addr);
                    _this.F_CARRY = (tmp >= 0 ? 1 : 0);
                    _this.F_SIGN = (tmp >> 7) & 1;
                    _this.F_ZERO = tmp & 0xFF;
                    cycleCount += cycleAdd;
                    break;

                case 18:
                    // *******
                    // * CPX *
                    // *******

                    // Compare memory and index X.
                    tmp = _this.REG_X - _this.load(addr);
                    _this.F_CARRY = (tmp >= 0 ? 1 : 0);
                    _this.F_SIGN = (tmp >> 7) & 1;
                    _this.F_ZERO = tmp & 0xFF;
                    break;

                case 19:
                    // *******
                    // * CPY *
                    // *******

                    // Compare memory and index Y.
                    tmp = _this.REG_Y - _this.load(addr);
                    _this.F_CARRY = (tmp >= 0 ? 1 : 0);
                    _this.F_SIGN = (tmp >> 7) & 1;
                    _this.F_ZERO = tmp & 0xFF;
                    break;

                case 20:
                    // *******
                    // * DEC *
                    // *******

                    // Decrement memory by one.
                    tmp = (_this.load(addr) - 1) & 0xFF;
                    _this.F_SIGN = (tmp >> 7) & 1;
                    _this.F_ZERO = tmp;
                    _this.write(addr, tmp);
                    break;

                case 21:
                    // *******
                    // * DEX *
                    // *******

                    // Decrement index X by one.
                    _this.REG_X = (_this.REG_X - 1) & 0xFF;
                    _this.F_SIGN = (_this.REG_X >> 7) & 1;
                    _this.F_ZERO = _this.REG_X;
                    break;

                case 22:
                    // *******
                    // * DEY *
                    // *******

                    // Decrement index Y by one.
                    _this.REG_Y = (_this.REG_Y - 1) & 0xFF;
                    _this.F_SIGN = (_this.REG_Y >> 7) & 1;
                    _this.F_ZERO = _this.REG_Y;
                    break;

                case 23:
                    // *******
                    // * EOR *
                    // *******

                    // XOR Memory with accumulator, store in accumulator.
                    _this.REG_ACC = (_this.load(addr) ^ _this.REG_ACC) & 0xFF;
                    _this.F_SIGN = (_this.REG_ACC >> 7) & 1;
                    _this.F_ZERO = _this.REG_ACC;
                    cycleCount += cycleAdd;
                    break;

                case 24:
                    // *******
                    // * INC *
                    // *******

                    // Increment memory by one.
                    tmp = (_this.load(addr) + 1) & 0xFF;
                    _this.F_SIGN = (tmp >> 7) & 1;
                    _this.F_ZERO = tmp;
                    _this.write(addr, tmp & 0xFF);
                    break;

                case 25:
                    // *******
                    // * INX *
                    // *******

                    // Increment index X by one.
                    _this.REG_X = (_this.REG_X + 1) & 0xFF;
                    _this.F_SIGN = (_this.REG_X >> 7) & 1;
                    _this.F_ZERO = _this.REG_X;
                    break;

                case 26:
                    // *******
                    // * INY *
                    // *******

                    // Increment index Y by one.
                    _this.REG_Y++;
                    _this.REG_Y &= 0xFF;
                    _this.F_SIGN = (_this.REG_Y >> 7) & 1;
                    _this.F_ZERO = _this.REG_Y;
                    break;

                case 27:
                    // *******
                    // * JMP *
                    // *******

                    // Jump to new location.
                    _this.REG_PC = addr - 1;
                    break;

                case 28:
                    // *******
                    // * JSR *
                    // *******

                    // Jump to new location, saving return address.
                    // Push return address on stack.
                    _this.push((_this.REG_PC >> 8) & 255);
                    _this.push(_this.REG_PC & 255);
                    _this.REG_PC = addr - 1;
                    break;

                case 29:
                    // *******
                    // * LDA *
                    // *******

                    // Load accumulator with memory.
                    _this.REG_ACC = _this.load(addr);
                    _this.F_SIGN = (_this.REG_ACC >> 7) & 1;
                    _this.F_ZERO = _this.REG_ACC;
                    cycleCount += cycleAdd;
                    break;

                case 30:
                    // *******
                    // * LDX *
                    // *******

                    // Load index X with memory.
                    _this.REG_X = _this.load(addr);
                    _this.F_SIGN = (_this.REG_X >> 7) & 1;
                    _this.F_ZERO = _this.REG_X;
                    cycleCount += cycleAdd;
                    break;

                case 31:
                    // *******
                    // * LDY *
                    // *******

                    // Load index Y with memory.
                    _this.REG_Y = _this.load(addr);
                    _this.F_SIGN = (_this.REG_Y >> 7) & 1;
                    _this.F_ZERO = _this.REG_Y;
                    cycleCount += cycleAdd;
                    break;

                case 32:
                    // *******
                    // * LSR *
                    // *******

                    // Shift right one bit.
                    if (addrMode == 4) { // ADDR.ACC
                        tmp = (_this.REG_ACC & 0xFF);
                        _this.F_CARRY = tmp & 1;
                        tmp >>= 1;
                        _this.REG_ACC = tmp;
                    } else {
                        tmp = _this.load(addr) & 0xFF;
                        _this.F_CARRY = tmp & 1;
                        tmp >>= 1;
                        _this.write(addr, tmp);
                    }
                    _this.F_SIGN = 0;
                    _this.F_ZERO = tmp;
                    break;

                case 33:
                    // *******
                    // * NOP *
                    // *******

                    // No OPeration.
                    // Ignore.
                    break;

                case 34:
                    // *******
                    // * ORA *
                    // *******

                    // OR memory with accumulator, store in accumulator.
                    tmp = (_this.load(addr) | _this.REG_ACC) & 255;
                    _this.F_SIGN = (tmp >> 7) & 1;
                    _this.F_ZERO = tmp;
                    _this.REG_ACC = tmp;
                    if (addrMode != 11) { // PostIdxInd = 11
                        cycleCount += cycleAdd;
                    }
                    break;

                case 35:
                    // *******
                    // * PHA *
                    // *******

                    // Push accumulator on stack.
                    _this.push(_this.REG_ACC);
                    break;

                case 36:
                    // *******
                    // * PHP *
                    // *******

                    // Push processor status on stack.
                    _this.F_BRK = 1;
                    _this.push(
                        (_this.F_CARRY) |
                        ((_this.F_ZERO == 0 ? 1 : 0) << 1) |
                        (_this.F_INTERRUPT << 2) |
                        (_this.F_DECIMAL << 3) |
                        (_this.F_BRK << 4) |
                        (_this.F_NOTUSED << 5) |
                        (_this.F_OVERFLOW << 6) |
                        (_this.F_SIGN << 7)
                    );
                    break;

                case 37:
                    // *******
                    // * PLA *
                    // *******

                    // Pull accumulator from stack.
                    _this.REG_ACC = _this.pull();
                    _this.F_SIGN = (_this.REG_ACC >> 7) & 1;
                    _this.F_ZERO = _this.REG_ACC;
                    break;

                case 38:
                    // *******
                    // * PLP *
                    // *******

                    // Pull processor status from stack.
                    tmp = _this.pull();
                    _this.F_CARRY = (tmp) & 1;
                    _this.F_ZERO = (((tmp >> 1) & 1) == 1) ? 0 : 1;
                    _this.F_INTERRUPT = (tmp >> 2) & 1;
                    _this.F_DECIMAL = (tmp >> 3) & 1;
                    _this.F_BRK = (tmp >> 4) & 1;
                    _this.F_NOTUSED = (tmp >> 5) & 1;
                    _this.F_OVERFLOW = (tmp >> 6) & 1;
                    _this.F_SIGN = (tmp >> 7) & 1;
                    _this.F_NOTUSED = 1;
                    break;

                case 39:
                    // *******
                    // * ROL *
                    // *******

                    // Rotate one bit left.
                    if (addrMode == 4) { // ADDR.ACC = 4
                        tmp = _this.REG_ACC;
                        add = _this.F_CARRY;
                        _this.F_CARRY = (tmp >> 7) & 1;
                        tmp = ((tmp << 1) & 0xFF) + add;
                        _this.REG_ACC = tmp;
                    } else {
                        tmp = _this.load(addr);
                        add = _this.F_CARRY;
                        _this.F_CARRY = (tmp >> 7) & 1;
                        tmp = ((tmp << 1) & 0xFF) + add;
                        _this.write(addr, tmp);
                    }
                    _this.F_SIGN = (tmp >> 7) & 1;
                    _this.F_ZERO = tmp;
                    break;

                case 40:
                    // *******
                    // * ROR *
                    // *******

                    // Rotate one bit right.
                    if (addrMode == 4) { // ADDR.ACC = 4
                        add = _this.F_CARRY << 7;
                        _this.F_CARRY = _this.REG_ACC & 1;
                        tmp = (_this.REG_ACC >> 1) + add;
                        _this.REG_ACC = tmp;
                    } else {
                        tmp = _this.load(addr);
                        add = _this.F_CARRY << 7;
                        _this.F_CARRY = tmp & 1;
                        tmp = (tmp >> 1) + add;
                        _this.write(addr, tmp);
                    }
                    _this.F_SIGN = (tmp >> 7) & 1;
                    _this.F_ZERO = tmp;
                    break;

                case 41:
                    // *******
                    // * RTI *
                    // *******

                    // Return from interrupt. Pull status and PC from stack.
                    tmp = _this.pull();
                    _this.F_CARRY = (tmp) & 1;
                    _this.F_ZERO = ((tmp >> 1) & 1) == 0 ? 1 : 0;
                    _this.F_INTERRUPT = (tmp >> 2) & 1;
                    _this.F_DECIMAL = (tmp >> 3) & 1;
                    _this.F_BRK = (tmp >> 4) & 1;
                    _this.F_NOTUSED = (tmp >> 5) & 1;
                    _this.F_OVERFLOW = (tmp >> 6) & 1;
                    _this.F_SIGN = (tmp >> 7) & 1;

                    _this.REG_PC = _this.pull();
                    _this.REG_PC += (_this.pull() << 8);
                    if (_this.REG_PC == 0xFFFF) {
                        return;
                    }
                    _this.REG_PC--;
                    _this.F_NOTUSED = 1;
                    break;

                case 42:
                    // *******
                    // * RTS *
                    // *******

                    // Return from subroutine. Pull PC from stack.
                    _this.REG_PC = _this.pull();
                    _this.REG_PC += (_this.pull() << 8);

                    if (_this.REG_PC == 0xFFFF) {
                        // return from NSF play routine.
                        return;
                    }
                    break;

                case 43:
                    // *******
                    // * SBC *
                    // *******

                    tmp = _this.REG_ACC - _this.load(addr) - (1 - _this.F_CARRY);
                    _this.F_SIGN = (tmp >> 7) & 1;
                    _this.F_ZERO = tmp & 0xFF;
                    _this.F_OVERFLOW = ((((_this.REG_ACC ^ tmp) & 0x80) != 0 && ((_this.REG_ACC ^ _this.load(addr)) & 0x80) != 0) ? 1 : 0);
                    _this.F_CARRY = (tmp < 0 ? 0 : 1);
                    _this.REG_ACC = (tmp & 0xFF);
                    if (addrMode != 11) { // PostIdxInd = 11
                        cycleCount += cycleAdd;
                    }
                    break;

                case 44:
                    // *******
                    // * SEC *
                    // *******

                    // Set carry flag.
                    _this.F_CARRY = 1;
                    break;

                case 45:
                    // *******
                    // * SED *
                    // *******

                    // Set decimal mode.
                    _this.F_DECIMAL = 1;
                    break;

                case 46:
                    // *******
                    // * SEI *
                    // *******

                    // Set interrupt disable status.
                    _this.F_INTERRUPT = 1;
                    break;

                case 47:
                    // *******
                    // * STA *
                    // *******

                    // Store accumulator in memory.
                    _this.write(addr, _this.REG_ACC);
                    break;

                case 48:
                    // *******
                    // * STX *
                    // *******

                    // Store index X in memory.
                    _this.write(addr, _this.REG_X);
                    break;

                case 49:
                    // *******
                    // * STY *
                    // *******

                    // Store index Y in memory.
                    _this.write(addr, _this.REG_Y);
                    break;

                case 50:
                    // *******
                    // * TAX *
                    // *******

                    // Transfer accumulator to index X.
                    _this.REG_X = _this.REG_ACC;
                    _this.F_SIGN = (_this.REG_ACC >> 7) & 1;
                    _this.F_ZERO = _this.REG_ACC;
                    break;

                case 51:
                    // *******
                    // * TAY *
                    // *******

                    // Transfer accumulator to index Y.
                    _this.REG_Y = _this.REG_ACC;
                    _this.F_SIGN = (_this.REG_ACC >> 7) & 1;
                    _this.F_ZERO = _this.REG_ACC;
                    break;

                case 52:
                    // *******
                    // * TSX *
                    // *******

                    // Transfer stack pointer to index X.
                    _this.REG_X = (_this.REG_SP - 0x0100);
                    _this.F_SIGN = (_this.REG_SP >> 7) & 1;
                    _this.F_ZERO = _this.REG_X;
                    break;

                case 53:
                    // *******
                    // * TXA *
                    // *******

                    // Transfer index X to accumulator.
                    _this.REG_ACC = _this.REG_X;
                    _this.F_SIGN = (_this.REG_X >> 7) & 1;
                    _this.F_ZERO = _this.REG_X;
                    break;

                case 54:
                    // *******
                    // * TXS *
                    // *******

                    // Transfer index X to stack pointer.
                    _this.REG_SP = (_this.REG_X + 0x0100);
                    _this.stackWrap();
                    break;

                case 55:
                    // *******
                    // * TYA *
                    // *******

                    // Transfer index Y to accumulator.
                    _this.REG_ACC = _this.REG_Y;
                    _this.F_SIGN = (_this.REG_Y >> 7) & 1;
                    _this.F_ZERO = _this.REG_Y;
                    break;

                default:
                    // *******
                    // * ??? *
                    // *******

                    _this.dispatchEvent(Event.ERROR, { name: 'AbortError', message: `Invalid opcode at address 0x${opaddr.toString(16)}.` });
                    break;
            }
            return cycleCount;
        };

        _this.load = function (addr) {
            if (addr < 0x2000) {
                return _this.mem[addr & 0x7FF];
            } else {
                return _nes.mmap.load(addr);
            }
        };

        _this.load16bit = function (addr) {
            if (addr < 0x1FFF) {
                return _this.mem[addr & 0x7FF] | (_this.mem[(addr + 1) & 0x7FF] << 8);
            } else {
                return _nes.mmap.load(addr) | (_nes.mmap.load(addr + 1) << 8);
            }
        };

        _this.write = function (addr, val) {
            if (addr < 0x2000) {
                _this.mem[addr & 0x7FF] = val;
            } else {
                _nes.mmap.write(addr, val);
            }
        };

        _this.requestIrq = function (type) {
            if (_this.irqRequested) {
                if (type == IRQ.NORMAL) {
                    return;
                }
            }
            _this.irqRequested = true;
            _this.irqType = type;
        };

        _this.push = function (value) {
            _nes.mmap.write(_this.REG_SP, value);
            _this.REG_SP--;
            _this.REG_SP = 0x0100 | (_this.REG_SP & 0xFF);
        };

        _this.stackWrap = function () {
            _this.REG_SP = 0x0100 | (_this.REG_SP & 0xFF);
        };

        _this.pull = function () {
            _this.REG_SP++;
            _this.REG_SP = 0x0100 | (_this.REG_SP & 0xFF);
            return _nes.mmap.load(_this.REG_SP);
        };

        _this.pageCrossed = function (addr1, addr2) {
            return ((addr1 & 0xFF00) != (addr2 & 0xFF00));
        };

        _this.haltCycles = function (cycles) {
            _this.cyclesToHalt += cycles;
        };

        _this.doNonMaskableInterrupt = function (status) {
            if ((_nes.mmap.load(0x2000) & 128) != 0) { // Check whether VBlank Interrupts are enabled
                _this.REG_PC_NEW++;
                _this.push((_this.REG_PC_NEW >> 8) & 0xFF);
                _this.push(_this.REG_PC_NEW & 0xFF);
                // _this.F_INTERRUPT_NEW = 1;
                _this.push(status);

                _this.REG_PC_NEW = _nes.mmap.load(0xFFFA) | (_nes.mmap.load(0xFFFB) << 8);
                _this.REG_PC_NEW--;
            }
        };

        _this.doResetInterrupt = function () {
            _this.REG_PC_NEW = _nes.mmap.load(0xFFFC) | (_nes.mmap.load(0xFFFD) << 8);
            _this.REG_PC_NEW--;
        };

        _this.doIrq = function (status) {
            _this.REG_PC_NEW++;
            _this.push((_this.REG_PC_NEW >> 8) & 0xFF);
            _this.push(_this.REG_PC_NEW & 0xFF);
            _this.push(status);
            _this.F_INTERRUPT_NEW = 1;
            _this.F_BRK_NEW = 0;

            _this.REG_PC_NEW = _nes.mmap.load(0xFFFE) | (_nes.mmap.load(0xFFFF) << 8);
            _this.REG_PC_NEW--;
        };

        _this.setStatus = function (st) {
            _this.F_CARRY = (st) & 1;
            _this.F_ZERO = (st >> 1) & 1;
            _this.F_INTERRUPT = (st >> 2) & 1;
            _this.F_DECIMAL = (st >> 3) & 1;
            _this.F_BRK = (st >> 4) & 1;
            _this.F_NOTUSED = (st >> 5) & 1;
            _this.F_OVERFLOW = (st >> 6) & 1;
            _this.F_SIGN = (st >> 7) & 1;
        };

        _this.getStatus = function () {
            return (_this.F_CARRY)
                | (_this.F_ZERO << 1)
                | (_this.F_INTERRUPT << 2)
                | (_this.F_DECIMAL << 3)
                | (_this.F_BRK << 4)
                | (_this.F_NOTUSED << 5)
                | (_this.F_OVERFLOW << 6)
                | (_this.F_SIGN << 7);
        };

        _init();
    }

    CPU.prototype = Object.create(EventDispatcher.prototype);
    CPU.prototype.constructor = CPU;

    CPU.FREQ_NTSC = FREQ_NTSC;
    CPU.IRQ = IRQ;
    NES.CPU = CPU;
})(odd);

