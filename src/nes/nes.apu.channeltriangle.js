(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,
        APU = NES.APU;

    function ChannelTriangle(nes, apu) {
        var _this = this,
            _nes = nes,
            _apu = apu;

        function _init() {
            _this.reset();
        }

        _this.reset = function () {
            _this.isEnabled = false;
            _this.sampleCondition = false;
            _this.lengthCounterEnable = false;
            _this.lcHalt = true;
            _this.lcControl = false;
            _this.progTimerCount = 0;
            _this.progTimerMax = 0;
            _this.triangleCounter = 0;
            _this.lengthCounter = 0;
            _this.linearCounter = 0;
            _this.lcLoadValue = 0;
            _this.sampleValue = 0xF;
            _this.tmp = 0;
        };

        _this.clockLengthCounter = function () {
            if (_this.lengthCounterEnable && _this.lengthCounter > 0) {
                _this.lengthCounter--;
                if (_this.lengthCounter === 0) {
                    _this.updateSampleCondition();
                }
            }
        };

        _this.clockLinearCounter = function () {
            if (_this.lcHalt) {
                // Load.
                _this.linearCounter = _this.lcLoadValue;
                _this.updateSampleCondition();
            } else if (_this.linearCounter > 0) {
                // Decrement.
                _this.linearCounter--;
                _this.updateSampleCondition();
            }
            if (!this.lcControl) {
                // Clear halt flag.
                _this.lcHalt = false;
            }
        };

        _this.getLengthStatus = function () {
            return ((_this.lengthCounter === 0 || !_this.isEnabled) ? 0 : 1);
        };

        _this.readReg = function (address) {
            return 0;
        };

        _this.writeReg = function (address, value) {
            if (address === 0x4008) {
                // New values for linear counter.
                _this.lcControl = (value & 0x80) !== 0;
                _this.lcLoadValue = value & 0x7F;
                // Length counter enable.
                _this.lengthCounterEnable = !this.lcControl;
            } else if (address === 0x400A) {
                // Programmable timer.
                _this.progTimerMax &= 0x700;
                _this.progTimerMax |= value;
            } else if (address === 0x400B) {
                // Programmable timer, length counter.
                _this.progTimerMax &= 0xFF;
                _this.progTimerMax |= ((value & 0x07) << 8);
                _this.lengthCounter = _apu.getLengthMax(value & 0xF8);
                _this.lcHalt = true;
            }

            _this.updateSampleCondition();
        };

        _this.clockProgrammableTimer = function (nCycles) {
            if (_this.progTimerMax > 0) {
                _this.progTimerCount += nCycles;
                while (_this.progTimerMax > 0 && _this.progTimerCount >= _this.progTimerMax) {
                    _this.progTimerCount -= _this.progTimerMax;
                    if (_this.isEnabled && _this.lengthCounter > 0 &&
                        _this.linearCounter > 0) {
                        _this.clockTriangleGenerator();
                    }
                }
            }
        };

        _this.clockTriangleGenerator = function () {
            _this.triangleCounter++;
            _this.triangleCounter &= 0x1F;
        };

        _this.setEnabled = function (value) {
            _this.isEnabled = value;
            if (!value) {
                _this.lengthCounter = 0;
            }
            _this.updateSampleCondition();
        };

        _this.updateSampleCondition = function () {
            _this.sampleCondition = _this.isEnabled &&
                _this.progTimerMax > 7 &&
                _this.linearCounter > 0 &&
                _this.lengthCounter > 0;
        };

        _init();
    }

    APU.ChannelTriangle = ChannelTriangle;
})(odd);

