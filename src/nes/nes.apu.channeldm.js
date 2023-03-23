(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,
        CPU = NES.CPU,
        APU = NES.APU,

        Mode = {
            NORMAL: 0,
            LOOP: 1,
            IRQ: 2,
        };

    function ChannelDM(nes, apu) {
        var _this = this,
            _nes = nes,
            _apu = apu;

        function _init() {
            _this.reset();
        }

        _this.reset = function () {
            _this.isEnabled = false;
            _this.hasSample = false;
            _this.irqGenerated = false;
            _this.playMode = Mode.NORMAL;
            _this.dmaFrequency = 0;
            _this.dmaCounter = 0;
            _this.deltaCounter = 0;
            _this.playStartAddress = 0;
            _this.playAddress = 0;
            _this.playLength = 0;
            _this.playLengthCounter = 0;
            _this.shiftCounter = 0;
            _this.reg4012 = 0;
            _this.reg4013 = 0;
            _this.sample = 0;
            _this.dacLsb = 0;
            _this.data = 0;
        };

        _this.clockDmc = function () {
            // Only alter DAC value if the sample buffer has data.
            if (_this.hasSample) {
                if ((_this.data & 1) === 0) {
                    // Decrement delta.
                    if (_this.deltaCounter > 0) {
                        _this.deltaCounter--;
                    }
                } else {
                    // Increment delta.
                    if (_this.deltaCounter < 63) {
                        _this.deltaCounter++;
                    }
                }
                // Update sample value.
                _this.sample = _this.isEnabled ? (_this.deltaCounter << 1) + _this.dacLsb : 0;
                // Update shift register.
                _this.data >>= 1;
            }

            _this.dmaCounter--;
            if (_this.dmaCounter <= 0) {
                // No more sample bits.
                _this.hasSample = false;
                _this.endOfSample();
                _this.dmaCounter = 8;
            }
            if (_this.irqGenerated) {
                _nes.cpu.requestIrq(CPU.IRQ.NORMAL);
            }
        };

        _this.endOfSample = function () {
            if (_this.playLengthCounter === 0 && _this.playMode === Mode.LOOP) {
                // Start from beginning of sample.
                _this.playAddress = _this.playStartAddress;
                _this.playLengthCounter = _this.playLength;
            }
            if (_this.playLengthCounter > 0) {
                // Fetch next sample.
                _this.nextSample();

                if (_this.playLengthCounter === 0) {
                    // Last byte of sample fetched, generate IRQ.
                    if (_this.playMode === Mode.IRQ) {
                        // Generate IRQ.
                        _this.irqGenerated = true;
                    }
                }
            }
        };

        _this.nextSample = function () {
            // Fetch byte.
            _this.data = _nes.mmap.load(_this.playAddress);
            _nes.cpu.haltCycles(4);

            _this.playLengthCounter--;
            _this.playAddress++;
            if (_this.playAddress > 0xFFFF) {
                _this.playAddress = 0x8000;
            }

            _this.hasSample = true;
        };

        _this.writeReg = function (address, value) {
            if (address === 0x4010) {
                // Play mode, DMA Frequency.
                if ((value >> 6) === 0) {
                    _this.playMode = Mode.NORMAL;
                } else if (((value >> 6) & 1) === 1) {
                    _this.playMode = Mode.LOOP;
                } else if ((value >> 6) === 2) {
                    _this.playMode = Mode.IRQ;
                }

                if ((value & 0x80) === 0) {
                    _this.irqGenerated = false;
                }

                _this.dmaFrequency = _apu.getDmcFrequency(value & 0xF);
            } else if (address === 0x4011) {
                // Delta counter load register.
                _this.deltaCounter = (value >> 1) & 63;
                _this.dacLsb = value & 1;
                _this.sample = ((_this.deltaCounter << 1) + _this.dacLsb); // update sample value
            } else if (address === 0x4012) {
                // DMA address load register.
                _this.playStartAddress = (value << 6) | 0x0C000;
                _this.playAddress = _this.playStartAddress;
                _this.reg4012 = value;
            } else if (address === 0x4013) {
                // Length of play code.
                _this.playLength = (value << 4) + 1;
                _this.playLengthCounter = _this.playLength;
                _this.reg4013 = value;
            } else if (address === 0x4015) {
                // DMC/IRQ Status.
                if (((value >> 4) & 1) === 0) {
                    // Disable.
                    _this.playLengthCounter = 0;
                } else {
                    // Restart.
                    _this.playAddress = _this.playStartAddress;
                    _this.playLengthCounter = _this.playLength;
                }
                _this.irqGenerated = false;
            }
        };

        _this.setEnabled = function (value) {
            if (!_this.isEnabled && value) {
                _this.playLengthCounter = _this.playLength;
            }
            _this.isEnabled = value;
        };

        _this.getLengthStatus = function () {
            return ((_this.playLengthCounter === 0 || !this.isEnabled) ? 0 : 1);
        };

        _this.getIrqStatus = function () {
            return (_this.irqGenerated ? 1 : 0);
        };

        _init();
    }

    ChannelDM.Mode = Mode
    APU.ChannelDM = ChannelDM;
})(odd);

