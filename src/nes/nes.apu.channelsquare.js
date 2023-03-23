(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,
        APU = NES.APU;

    function ChannelSquare(nes, apu, square1) {
        var _this = this,
            _nes = nes,
            _apu = apu;

        function _init() {
            _this.sqr1 = square1;
            _this.dutyLookup = [
                0, 1, 0, 0, 0, 0, 0, 0,
                0, 1, 1, 0, 0, 0, 0, 0,
                0, 1, 1, 1, 1, 0, 0, 0,
                1, 0, 0, 1, 1, 1, 1, 1
            ];
            _this.impLookup = [
                1, -1, 0, 0, 0, 0, 0, 0,
                1, 0, -1, 0, 0, 0, 0, 0,
                1, 0, 0, 0, -1, 0, 0, 0,
                -1, 0, 1, 0, 0, 0, 0, 0
            ];

            _this.reset();
        }

        _this.reset = function () {
            _this.isEnabled = false;
            _this.lengthCounterEnable = false;
            _this.sweepActive = false;
            _this.sweepCarry = false;
            _this.envDecayDisable = false;
            _this.envDecayLoopEnable = false;
            _this.envReset = false;
            _this.updateSweepPeriod = false;
            _this.progTimerCount = 0;
            _this.progTimerMax = 0;
            _this.lengthCounter = 0;
            _this.squareCounter = 0;
            _this.sweepCounter = 0;
            _this.sweepCounterMax = 0;
            _this.sweepMode = 0;
            _this.sweepShiftAmount = 0;
            _this.envDecayRate = 0;
            _this.envDecayCounter = 0;
            _this.envVolume = 0;
            _this.masterVolume = 0;
            _this.dutyMode = 0;
            _this.sampleValue = 0;
            _this.vol = 0;
        };

        _this.clockLengthCounter = function () {
            if (_this.lengthCounterEnable && _this.lengthCounter > 0) {
                _this.lengthCounter--;
                if (_this.lengthCounter === 0) {
                    _this.updateSampleValue();
                }
            }
        };

        _this.clockEnvDecay = function () {
            if (_this.envReset) {
                // Reset envelope.
                _this.envReset = false;
                _this.envDecayCounter = _this.envDecayRate + 1;
                _this.envVolume = 0xF;
            } else if (--this.envDecayCounter <= 0) {
                // Normal handling.
                _this.envDecayCounter = _this.envDecayRate + 1;
                if (_this.envVolume > 0) {
                    _this.envVolume--;
                } else {
                    _this.envVolume = _this.envDecayLoopEnable ? 0xF : 0;
                }
            }

            _this.masterVolume = _this.envDecayDisable ? _this.envDecayRate : _this.envVolume;
            _this.updateSampleValue();
        };

        _this.clockSweep = function () {
            if (--this.sweepCounter <= 0) {
                _this.sweepCounter = _this.sweepCounterMax + 1;
                if (_this.sweepActive && _this.sweepShiftAmount > 0 && _this.progTimerMax > 7) {
                    // Calculate result from shifter.
                    _this.sweepCarry = false;
                    if (_this.sweepMode === 0) {
                        _this.progTimerMax += (_this.progTimerMax >> _this.sweepShiftAmount);
                        if (_this.progTimerMax > 4095) {
                            _this.progTimerMax = 4095;
                            _this.sweepCarry = true;
                        }
                    } else {
                        _this.progTimerMax = _this.progTimerMax - ((_this.progTimerMax >> _this.sweepShiftAmount) - (_this.sqr1 ? 1 : 0));
                    }
                }
            }

            if (_this.updateSweepPeriod) {
                _this.updateSweepPeriod = false;
                _this.sweepCounter = _this.sweepCounterMax + 1;
            }
        };

        _this.updateSampleValue = function () {
            if (_this.isEnabled && _this.lengthCounter > 0 && _this.progTimerMax > 7) {
                if (_this.sweepMode === 0 && (_this.progTimerMax + (_this.progTimerMax >> _this.sweepShiftAmount)) > 4095) {
                    _this.sampleValue = 0;
                } else {
                    _this.sampleValue = _this.masterVolume * _this.dutyLookup[(_this.dutyMode << 3) + _this.squareCounter];
                }
            } else {
                _this.sampleValue = 0;
            }
        };

        _this.writeReg = function (address, value) {
            var addrAdd = (_this.sqr1 ? 0 : 4);
            if (address === 0x4000 + addrAdd) {
                // Volume/Envelope decay.
                _this.envDecayDisable = ((value & 0x10) !== 0);
                _this.envDecayRate = value & 0xF;
                _this.envDecayLoopEnable = ((value & 0x20) !== 0);
                _this.dutyMode = (value >> 6) & 0x3;
                _this.lengthCounterEnable = ((value & 0x20) === 0);
                _this.masterVolume = _this.envDecayDisable ? _this.envDecayRate : _this.envVolume;
                _this.updateSampleValue();
            } else if (address === 0x4001 + addrAdd) {
                // Sweep.
                _this.sweepActive = ((value & 0x80) !== 0);
                _this.sweepCounterMax = ((value >> 4) & 7);
                _this.sweepMode = (value >> 3) & 1;
                _this.sweepShiftAmount = value & 7;
                _this.updateSweepPeriod = true;
            } else if (address === 0x4002 + addrAdd) {
                // Programmable timer.
                _this.progTimerMax &= 0x700;
                _this.progTimerMax |= value;
            } else if (address === 0x4003 + addrAdd) {
                // Programmable timer, length counter.
                _this.progTimerMax &= 0xFF;
                _this.progTimerMax |= ((value & 0x7) << 8);

                if (_this.isEnabled) {
                    _this.lengthCounter = _apu.getLengthMax(value & 0xF8);
                }
                _this.envReset = true;
            }
        };

        _this.setEnabled = function (value) {
            _this.isEnabled = value;
            if (!value) {
                _this.lengthCounter = 0;
            }
            _this.updateSampleValue();
        };

        _this.getLengthStatus = function () {
            return ((_this.lengthCounter === 0 || !_this.isEnabled) ? 0 : 1);
        };

        _init();
    }

    APU.ChannelSquare = ChannelSquare;
})(odd);

