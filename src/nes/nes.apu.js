(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        NES = odd.NES,
        CPU = NES.CPU;

    function APU(nes, logger) {
        EventDispatcher.call(this, 'APU', { logger: logger }, [Event.ERROR]);

        var _this = this,
            _nes = nes,
            _logger = logger;

        function _init() {
            _this.square1 = new APU.ChannelSquare(_nes, _this, true);
            _this.square2 = new APU.ChannelSquare(_nes, _this, false);
            _this.triangle = new APU.ChannelTriangle(_nes, _this);
            _this.noise = new APU.ChannelNoise(_nes, _this);
            _this.dmc = new APU.ChannelDM(_nes, _this);

            _this.frameIrqCounterMax = 4;
            _this.initCounter = 2048;

            _this.bufferIndex = 0;
            _this.bufferSize = 8192;
            _this.sampleRate = 44100;
            _this.sampleBuffer = new Array(_this.bufferSize * 2);

            _this.frameIrqEnabled = false;
            _this.frameIrqActive = false;
            _this.startedPlaying = false;
            _this.recordOutput = false;
            _this.initingHardware = false;

            _this.triValue = 0;
            _this.masterVolume = 256;
            _this.extraCycles = 0;

            // Panning.
            _this.panning = [80, 170, 100, 150, 128];
            _this.setPanning(_this.panning);

            // Initialize lookup tables.
            _this.initLengthLookup();
            _this.initDmcFrequencyLookup();
            _this.initNoiseWavelengthLookup();
            _this.initDACtables();

            // Init sound registers.
            for (var i = 0; i < 0x14; i++) {
                if (i === 0x10) {
                    _this.writeReg(0x4010, 0x10);
                } else {
                    _this.writeReg(0x4000 + i, 0);
                }
            }

            _this.reset();
        }

        _this.reset = function () {
            _this.sampleRate = _nes.config.sampleRate;
            _this.sampleTimerMax = Math.floor((1024.0 * CPU.FREQ_NTSC * _nes.config.frameRate) / (_this.sampleRate * 60.0));
            _this.frameTime = Math.floor((14915.0 * _nes.config.frameRate) / 60.0);

            _this.sampleTimer = 0;
            _this.bufferIndex = 0;

            _this.updateChannelEnable(0);
            _this.masterFrameCounter = 0;
            _this.derivedFrameCounter = 0;
            _this.countSequence = 0;
            _this.sampleCount = 0;
            _this.initCounter = 2048;
            _this.frameIrqEnabled = false;
            _this.initingHardware = false;

            _this.resetCounter();
            _this.square1.reset();
            _this.square2.reset();
            _this.triangle.reset();
            _this.noise.reset();
            _this.dmc.reset();

            _this.bufferIndex = 0;
            _this.accCount = 0;
            _this.smpSquare1 = 0;
            _this.smpSquare2 = 0;
            _this.smpTriangle = 0;
            _this.smpDmc = 0;

            _this.frameIrqEnabled = false;
            _this.frameIrqCounterMax = 4;

            _this.channelEnableValue = 0xFF;
            _this.startedPlaying = false;
            _this.prevSampleL = 0;
            _this.prevSampleR = 0;
            _this.smpAccumL = 0;
            _this.smpAccumR = 0;

            _this.maxSample = -500000;
            _this.minSample = 500000;
        };

        _this.readReg = function (address) {
            // Read 0x4015.
            var tmp = 0;
            tmp |= _this.square1.getLengthStatus();
            tmp |= _this.square2.getLengthStatus() << 1;
            tmp |= _this.triangle.getLengthStatus() << 2;
            tmp |= _this.noise.getLengthStatus() << 3;
            tmp |= _this.dmc.getLengthStatus() << 4;
            tmp |= (_this.frameIrqActive && _this.frameIrqEnabled ? 1 : 0) << 6;
            tmp |= _this.dmc.getIrqStatus() << 7;

            _this.frameIrqActive = false;
            _this.dmc.irqGenerated = false;
            return tmp & 0xFFFF;
        };

        _this.writeReg = function (address, value) {
            if (address >= 0x4000 && address < 0x4004) {
                // Square Wave 1 Control.
                _this.square1.writeReg(address, value);
            } else if (address >= 0x4004 && address < 0x4008) {
                // Square 2 Control.
                _this.square2.writeReg(address, value);
            } else if (address >= 0x4008 && address < 0x400C) {
                // Triangle Control.
                _this.triangle.writeReg(address, value);
            } else if (address >= 0x400C && address <= 0x400F) {
                // Noise Control.
                _this.noise.writeReg(address, value);
            } else if (address === 0x4010) {
                // DMC Play mode & DMA frequency.
                _this.dmc.writeReg(address, value);
            } else if (address === 0x4011) {
                // DMC Delta Counter.
                _this.dmc.writeReg(address, value);
            } else if (address === 0x4012) {
                // DMC Play code starting address.
                _this.dmc.writeReg(address, value);
            } else if (address === 0x4013) {
                // DMC Play code length.
                _this.dmc.writeReg(address, value);
            } else if (address === 0x4015) {
                // Channel enable.
                _this.updateChannelEnable(value);

                if (value !== 0 && _this.initCounter > 0) {
                    // Start hardware initialization.
                    _this.initingHardware = true;
                }

                // DMC/IRQ Status.
                _this.dmc.writeReg(address, value);
            } else if (address === 0x4017) {
                // Frame counter control.
                _this.countSequence = (value >> 7) & 1;
                _this.masterFrameCounter = 0;
                _this.frameIrqActive = false;
                if (((value >> 6) & 0x1) === 0) {
                    _this.frameIrqEnabled = true;
                } else {
                    _this.frameIrqEnabled = false;
                }

                if (_this.countSequence === 0) {
                    // NTSC.
                    _this.frameIrqCounterMax = 4;
                    _this.derivedFrameCounter = 4;
                } else {
                    // PAL.
                    _this.frameIrqCounterMax = 5;
                    _this.derivedFrameCounter = 0;
                    _this.frameCounterTick();
                }
            }
        };

        _this.resetCounter = function () {
            if (_this.countSequence === 0) {
                _this.derivedFrameCounter = 4;
            } else {
                _this.derivedFrameCounter = 0;
            }
        };

        // Updates channel enable status.
        // This is done on writes to the channel enable register (0x4015),
        // and when the user enables/disables channels in the GUI.
        _this.updateChannelEnable = function (value) {
            _this.channelEnableValue = value & 0xFFFF;
            _this.square1.setEnabled((value & 1) !== 0);
            _this.square2.setEnabled((value & 2) !== 0);
            _this.triangle.setEnabled((value & 4) !== 0);
            _this.noise.setEnabled((value & 8) !== 0);
            _this.dmc.setEnabled((value & 16) !== 0);
        };

        // Clocks the frame counter. It should be clocked at
        // twice the cpu speed, so the cycles will be divided by 2 
        // for those counters that are clocked at cpu speed.
        _this.clockFrameCounter = function (nCycles) {
            if (_this.initCounter > 0) {
                if (_this.initingHardware) {
                    _this.initCounter -= nCycles;
                    if (_this.initCounter <= 0) {
                        _this.initingHardware = false;
                    }
                    return;
                }
            }

            // Don't process ticks beyond next sampling.
            nCycles += _this.extraCycles;
            var maxCycles = _this.sampleTimerMax - _this.sampleTimer;
            if ((nCycles << 10) > maxCycles) {
                _this.extraCycles = ((nCycles << 10) - maxCycles) >> 10;
                nCycles -= _this.extraCycles;
            } else {
                _this.extraCycles = 0;
            }

            // Clock DMC.
            if (_this.dmc.isEnabled) {
                _this.dmc.shiftCounter -= (nCycles << 3);
                while (_this.dmc.shiftCounter <= 0 && _this.dmc.dmaFrequency > 0) {
                    _this.dmc.shiftCounter += _this.dmc.dmaFrequency;
                    _this.dmc.clockDmc();
                }
            }

            // Clock Triangle channel Prog timer.
            if (_this.triangle.progTimerMax > 0) {
                _this.triangle.progTimerCount -= nCycles;
                while (_this.triangle.progTimerCount <= 0) {
                    _this.triangle.progTimerCount += _this.triangle.progTimerMax + 1;
                    if (_this.triangle.linearCounter > 0 && _this.triangle.lengthCounter > 0) {
                        _this.triangle.triangleCounter++;
                        _this.triangle.triangleCounter &= 0x1F;
                        if (_this.triangle.isEnabled) {
                            if (_this.triangle.triangleCounter >= 0x10) {
                                // Normal value.
                                _this.triangle.sampleValue = (_this.triangle.triangleCounter & 0xF);
                            } else {
                                // Inverted value.
                                _this.triangle.sampleValue = (0xF - (_this.triangle.triangleCounter & 0xF));
                            }
                            _this.triangle.sampleValue <<= 4;
                        }
                    }
                }
            }

            // Clock Square channel 1 Prog timer.
            _this.square1.progTimerCount -= nCycles;
            if (_this.square1.progTimerCount <= 0) {
                _this.square1.progTimerCount += (_this.square1.progTimerMax + 1) << 1;
                _this.square1.squareCounter++;
                _this.square1.squareCounter &= 0x7;
                _this.square1.updateSampleValue();
            }

            // Clock Square channel 2 Prog timer.
            _this.square2.progTimerCount -= nCycles;
            if (_this.square2.progTimerCount <= 0) {
                _this.square2.progTimerCount += (_this.square2.progTimerMax + 1) << 1;
                _this.square2.squareCounter++;
                _this.square2.squareCounter &= 0x7;
                _this.square2.updateSampleValue();
            }

            // Clock noise channel Prog timer.
            var acc_c = nCycles;
            if (_this.noise.progTimerCount - acc_c > 0) {
                // Do all cycles at once.
                _this.noise.progTimerCount -= acc_c;
                _this.noise.accCount += acc_c;
                _this.noise.accValue += acc_c * _this.noise.sampleValue;
            } else {
                // Slow-step.
                while ((acc_c--) > 0) {
                    if (--_this.noise.progTimerCount <= 0 && _this.noise.progTimerMax > 0) {
                        // Update noise shift register.
                        _this.noise.shiftReg <<= 1;
                        _this.noise.tmp = (((_this.noise.shiftReg << (_this.noise.randomMode === 0 ? 1 : 6)) ^ _this.noise.shiftReg) & 0x8000);
                        if (_this.noise.tmp !== 0) {
                            // Sample value must be 0.
                            _this.noise.shiftReg |= 0x01;
                            _this.noise.randomBit = 0;
                            _this.noise.sampleValue = 0;
                        } else {
                            // Find sample value.
                            _this.noise.randomBit = 1;
                            if (_this.noise.isEnabled && _this.noise.lengthCounter > 0) {
                                _this.noise.sampleValue = _this.noise.masterVolume;
                            } else {
                                _this.noise.sampleValue = 0;
                            }
                        }
                        _this.noise.progTimerCount += _this.noise.progTimerMax;
                    }
                    _this.noise.accValue += _this.noise.sampleValue;
                    _this.noise.accCount++;
                }
            }

            // Frame IRQ handling.
            if (_this.frameIrqEnabled && _this.frameIrqActive) {
                _nes.cpu.requestIrq(CPU.IRQ.NORMAL);
            }

            // Clock frame counter at double CPU speed.
            _this.masterFrameCounter += (nCycles << 1);
            if (_this.masterFrameCounter >= _this.frameTime) {
                // 240Hz tick.
                _this.masterFrameCounter -= _this.frameTime;
                _this.frameCounterTick();
            }

            // Accumulate sample value.
            _this.accSample(nCycles);

            // Clock sample timer.
            _this.sampleTimer += nCycles << 10;
            if (_this.sampleTimer >= _this.sampleTimerMax) {
                // Sample channels.
                _this.sample();
                _this.sampleTimer -= _this.sampleTimerMax;
            }
        };

        _this.accSample = function (cycles) {
            // Special treatment for triangle channel - need to interpolate.
            if (_this.triangle.sampleCondition) {
                _this.triValue = Math.floor((_this.triangle.progTimerCount << 4) / (_this.triangle.progTimerMax + 1));
                if (_this.triValue > 16) {
                    _this.triValue = 16;
                }
                if (_this.triangle.triangleCounter >= 16) {
                    _this.triValue = 16 - _this.triValue;
                }

                // Add non-interpolated sample value.
                _this.triValue += _this.triangle.sampleValue;
            }

            // Now sample normally.
            if (cycles === 2) {
                _this.smpTriangle += _this.triValue << 1;
                _this.smpDmc += _this.dmc.sample << 1;
                _this.smpSquare1 += _this.square1.sampleValue << 1;
                _this.smpSquare2 += _this.square2.sampleValue << 1;
                _this.accCount += 2;
            } else if (cycles === 4) {
                _this.smpTriangle += _this.triValue << 2;
                _this.smpDmc += _this.dmc.sample << 2;
                _this.smpSquare1 += _this.square1.sampleValue << 2;
                _this.smpSquare2 += _this.square2.sampleValue << 2;
                _this.accCount += 4;
            } else {
                _this.smpTriangle += cycles * _this.triValue;
                _this.smpDmc += cycles * _this.dmc.sample;
                _this.smpSquare1 += cycles * _this.square1.sampleValue;
                _this.smpSquare2 += cycles * _this.square2.sampleValue;
                _this.accCount += cycles;
            }
        };

        _this.frameCounterTick = function () {
            _this.derivedFrameCounter++;
            if (_this.derivedFrameCounter >= _this.frameIrqCounterMax) {
                _this.derivedFrameCounter = 0;
            }
            if (_this.derivedFrameCounter === 1 || _this.derivedFrameCounter === 3) {
                // Clock length & sweep.
                _this.triangle.clockLengthCounter();
                _this.square1.clockLengthCounter();
                _this.square2.clockLengthCounter();
                _this.noise.clockLengthCounter();
                _this.square1.clockSweep();
                _this.square2.clockSweep();
            }
            if (_this.derivedFrameCounter >= 0 && _this.derivedFrameCounter < 4) {
                // Clock linear & decay.
                _this.square1.clockEnvDecay();
                _this.square2.clockEnvDecay();
                _this.noise.clockEnvDecay();
                _this.triangle.clockLinearCounter();
            }
            if (_this.derivedFrameCounter === 3 && _this.countSequence === 0) {
                // Enable IRQ.
                _this.frameIrqActive = true;
            }

            // End of 240Hz tick
        };

        // Samples the channels, mixes the output together,
        // writes to buffer and (if enabled) file.
        _this.sample = function () {
            if (_this.accCount > 0) {
                _this.smpSquare1 <<= 4;
                _this.smpSquare1 = Math.floor(_this.smpSquare1 / _this.accCount);
                _this.smpSquare2 <<= 4;
                _this.smpSquare2 = Math.floor(_this.smpSquare2 / _this.accCount);
                _this.smpTriangle = Math.floor(_this.smpTriangle / _this.accCount);
                _this.smpDmc <<= 4;
                _this.smpDmc = Math.floor(_this.smpDmc / _this.accCount);
                _this.accCount = 0;
            } else {
                _this.smpSquare1 = _this.square1.sampleValue << 4;
                _this.smpSquare2 = _this.square2.sampleValue << 4;
                _this.smpTriangle = _this.triangle.sampleValue;
                _this.smpDmc = _this.dmc.sample << 4;
            }

            var smpNoise = Math.floor((_this.noise.accValue << 4) / _this.noise.accCount);
            _this.noise.accValue = smpNoise >> 4;
            _this.noise.accCount = 1;

            // Stereo sound.
            // Left channel.
            var sq_index = (
                _this.smpSquare1 * _this.stereoPosLSquare1 +
                _this.smpSquare2 * _this.stereoPosLSquare2
            ) >> 8;
            var tnd_index = (
                3 * _this.smpTriangle * _this.stereoPosLTriangle +
                (smpNoise << 1) * _this.stereoPosLNoise +
                _this.smpDmc * _this.stereoPosLDMC
            ) >> 8;
            if (sq_index >= _this.square_table.length) {
                sq_index = _this.square_table.length - 1;
            }
            if (tnd_index >= _this.tnd_table.length) {
                tnd_index = _this.tnd_table.length - 1;
            }
            var sampleValueL = _this.square_table[sq_index] + _this.tnd_table[tnd_index] - _this.dcValue;

            // Right channel.
            sq_index = (
                _this.smpSquare1 * _this.stereoPosRSquare1 +
                _this.smpSquare2 * _this.stereoPosRSquare2
            ) >> 8;
            tnd_index = (
                3 * _this.smpTriangle * _this.stereoPosRTriangle +
                (smpNoise << 1) * _this.stereoPosRNoise +
                _this.smpDmc * _this.stereoPosRDMC
            ) >> 8;
            if (sq_index >= _this.square_table.length) {
                sq_index = _this.square_table.length - 1;
            }
            if (tnd_index >= _this.tnd_table.length) {
                tnd_index = _this.tnd_table.length - 1;
            }
            var sampleValueR = _this.square_table[sq_index] + _this.tnd_table[tnd_index] - _this.dcValue;

            // Remove DC from left channel.
            var smpDiffL = sampleValueL - _this.prevSampleL;
            _this.prevSampleL += smpDiffL;
            _this.smpAccumL += smpDiffL - (_this.smpAccumL >> 10);
            sampleValueL = _this.smpAccumL;

            // Remove DC from right channel.
            var smpDiffR = sampleValueR - _this.prevSampleR;
            _this.prevSampleR += smpDiffR;
            _this.smpAccumR += smpDiffR - (_this.smpAccumR >> 10);
            sampleValueR = _this.smpAccumR;

            // Write.
            if (sampleValueL > _this.maxSample) {
                _this.maxSample = sampleValueL;
            }
            if (sampleValueL < _this.minSample) {
                _this.minSample = sampleValueL;
            }
            _this.sampleBuffer[_this.bufferIndex++] = sampleValueL;
            _this.sampleBuffer[_this.bufferIndex++] = sampleValueR;

            // Write full buffer.
            if (_this.bufferIndex === _this.sampleBuffer.length) {
                _nes.writeAudio(_this.sampleBuffer);
                _this.sampleBuffer = new Array(_this.bufferSize * 2);
                _this.bufferIndex = 0;
            }

            // Reset sampled values.
            _this.smpSquare1 = 0;
            _this.smpSquare2 = 0;
            _this.smpTriangle = 0;
            _this.smpDmc = 0;
        };

        _this.getLengthMax = function (value) {
            return _this.lengthLookup[value >> 3];
        };

        _this.getDmcFrequency = function (value) {
            if (value >= 0 && value < 0x10) {
                return _this.dmcFreqLookup[value];
            }
            return 0;
        };

        _this.getNoiseWaveLength = function (value) {
            if (value >= 0 && value < 0x10) {
                return _this.noiseWavelengthLookup[value];
            }
            return 0;
        };

        _this.setPanning = function (pos) {
            for (var i = 0; i < 5; i++) {
                _this.panning[i] = pos[i];
            }
            _this.updateStereoPos();
        };

        _this.setMasterVolume = function (value) {
            if (value < 0) {
                value = 0;
            }
            if (value > 256) {
                value = 256;
            }
            _this.masterVolume = value;
            _this.updateStereoPos();
        };

        _this.updateStereoPos = function () {
            _this.stereoPosLSquare1 = (_this.panning[0] * _this.masterVolume) >> 8;
            _this.stereoPosLSquare2 = (_this.panning[1] * _this.masterVolume) >> 8;
            _this.stereoPosLTriangle = (_this.panning[2] * _this.masterVolume) >> 8;
            _this.stereoPosLNoise = (_this.panning[3] * _this.masterVolume) >> 8;
            _this.stereoPosLDMC = (_this.panning[4] * _this.masterVolume) >> 8;

            _this.stereoPosRSquare1 = _this.masterVolume - _this.stereoPosLSquare1;
            _this.stereoPosRSquare2 = _this.masterVolume - _this.stereoPosLSquare2;
            _this.stereoPosRTriangle = _this.masterVolume - _this.stereoPosLTriangle;
            _this.stereoPosRNoise = _this.masterVolume - _this.stereoPosLNoise;
            _this.stereoPosRDMC = _this.masterVolume - _this.stereoPosLDMC;
        };

        _this.initLengthLookup = function () {
            _this.lengthLookup = [
                0x0A, 0xFE,
                0x14, 0x02,
                0x28, 0x04,
                0x50, 0x06,
                0xA0, 0x08,
                0x3C, 0x0A,
                0x0E, 0x0C,
                0x1A, 0x0E,
                0x0C, 0x10,
                0x18, 0x12,
                0x30, 0x14,
                0x60, 0x16,
                0xC0, 0x18,
                0x48, 0x1A,
                0x10, 0x1C,
                0x20, 0x1E
            ];
        };

        _this.initDmcFrequencyLookup = function () {
            _this.dmcFreqLookup = new Array(16);
            _this.dmcFreqLookup[0x0] = 0xD60;
            _this.dmcFreqLookup[0x1] = 0xBE0;
            _this.dmcFreqLookup[0x2] = 0xAA0;
            _this.dmcFreqLookup[0x3] = 0xA00;
            _this.dmcFreqLookup[0x4] = 0x8F0;
            _this.dmcFreqLookup[0x5] = 0x7F0;
            _this.dmcFreqLookup[0x6] = 0x710;
            _this.dmcFreqLookup[0x7] = 0x6B0;
            _this.dmcFreqLookup[0x8] = 0x5F0;
            _this.dmcFreqLookup[0x9] = 0x500;
            _this.dmcFreqLookup[0xA] = 0x470;
            _this.dmcFreqLookup[0xB] = 0x400;
            _this.dmcFreqLookup[0xC] = 0x350;
            _this.dmcFreqLookup[0xD] = 0x2A0;
            _this.dmcFreqLookup[0xE] = 0x240;
            _this.dmcFreqLookup[0xF] = 0x1B0;
            // for (var i = 0; i < 16; i++) {
            //     _this.dmcFreqLookup[i] /= 8;
            // }
        };

        _this.initNoiseWavelengthLookup = function () {
            _this.noiseWavelengthLookup = new Array(16);
            _this.noiseWavelengthLookup[0x0] = 0x004;
            _this.noiseWavelengthLookup[0x1] = 0x008;
            _this.noiseWavelengthLookup[0x2] = 0x010;
            _this.noiseWavelengthLookup[0x3] = 0x020;
            _this.noiseWavelengthLookup[0x4] = 0x040;
            _this.noiseWavelengthLookup[0x5] = 0x060;
            _this.noiseWavelengthLookup[0x6] = 0x080;
            _this.noiseWavelengthLookup[0x7] = 0x0A0;
            _this.noiseWavelengthLookup[0x8] = 0x0CA;
            _this.noiseWavelengthLookup[0x9] = 0x0FE;
            _this.noiseWavelengthLookup[0xA] = 0x17C;
            _this.noiseWavelengthLookup[0xB] = 0x1FC;
            _this.noiseWavelengthLookup[0xC] = 0x2FA;
            _this.noiseWavelengthLookup[0xD] = 0x3F8;
            _this.noiseWavelengthLookup[0xE] = 0x7F2;
            _this.noiseWavelengthLookup[0xF] = 0xFE4;
        };

        _this.initDACtables = function () {
            var value, ival;
            var max_sqr = 0;
            var max_tnd = 0;

            _this.square_table = new Array(32 * 16);
            _this.tnd_table = new Array(204 * 16);

            for (var i = 0; i < 32 * 16; i++) {
                value = 95.52 / (8128.0 / (i / 16.0) + 100.0);
                value *= 0.98411;
                value *= 50000.0;
                ival = Math.floor(value);

                _this.square_table[i] = ival;
                if (ival > max_sqr) {
                    max_sqr = ival;
                }
            }

            for (var i = 0; i < 204 * 16; i++) {
                value = 163.67 / (24329.0 / (i / 16.0) + 100.0);
                value *= 0.98411;
                value *= 50000.0;
                ival = Math.floor(value);

                _this.tnd_table[i] = ival;
                if (ival > max_tnd) {
                    max_tnd = ival;
                }
            }

            _this.dacRange = max_sqr + max_tnd;
            _this.dcValue = _this.dacRange / 2;
        };

        _init();
    }

    APU.prototype = Object.create(EventDispatcher.prototype);
    APU.prototype.constructor = APU;

    NES.APU = APU;
})(odd);

