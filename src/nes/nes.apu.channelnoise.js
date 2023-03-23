(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,
        APU = NES.APU;

    function ChannelNoise(nes, apu) {
        var _this = this,
            _nes = nes,
            _apu = apu;

        function _init() {
            _this.reset();
        }

        _this.reset = function () {
            _this.isEnabled = false;
            _this.envDecayDisable = false;
            _this.envDecayLoopEnable = false;
            _this.envReset = false;
            _this.shiftNow = false;
            _this.lengthCounterEnable = false;
            _this.lengthCounter = 0;
            _this.progTimerCount = 0;
            _this.progTimerMax = 0;
            _this.envDecayRate = 0;
            _this.envDecayCounter = 0;
            _this.envVolume = 0;
            _this.masterVolume = 0;
            _this.shiftReg = 1;
            _this.randomBit = 0;
            _this.randomMode = 0;
            _this.sampleValue = 0;
            _this.accValue = 0;
            _this.accCount = 1;
            _this.tmp = 0;
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

        _this.updateSampleValue = function () {
            if (_this.isEnabled && _this.lengthCounter > 0) {
                _this.sampleValue = _this.randomBit * _this.masterVolume;
            }
        };

        _this.writeReg = function (address, value) {
            if (address === 0x400C) {
                // Volume/Envelope decay.
                _this.envDecayDisable = ((value & 0x10) !== 0);
                _this.envDecayRate = value & 0xF;
                _this.envDecayLoopEnable = ((value & 0x20) !== 0);
                _this.lengthCounterEnable = ((value & 0x20) === 0);
                _this.masterVolume = _this.envDecayDisable ? _this.envDecayRate : _this.envVolume;
            } else if (address === 0x400E) {
                // Programmable timer.
                _this.progTimerMax = _apu.getNoiseWaveLength(value & 0xF);
                _this.randomMode = value >> 7;
            } else if (address === 0x400F) {
                // Length counter
                _this.lengthCounter = _apu.getLengthMax(value & 248);
                _this.envReset = true;
            }
            // Update.
            // _this.updateSampleValue();
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

    APU.ChannelNoise = ChannelNoise;
})(odd);

