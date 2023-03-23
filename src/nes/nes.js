(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        MediaEvent = events.MediaEvent,
        TimerEvent = events.TimerEvent,

        State = {
            INITIALIZED: 'initialized',
            RUNNING: 'running',
            CLOSING: 'closing',
            CLOSED: 'closed',
        },

        _id = 0,
        _instances = {},
        _default = {
            drawFrame: true,
            frameRate: 60,
            muted: true,
            sampleRate: 44100,
        };

    function NES(id, logger) {
        var _this = this,
            _id = id,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger(id, logger),
            _container,
            _audio,
            _canvas,
            _context,
            _imageData,
            _buffer,
            _fps,
            _frame,
            _count,
            _readyState;

        EventDispatcher.call(this, 'NES', { id: id, logger: _logger }, [Event.BIND, Event.READY, Event.ERROR, Event.CLOSE, MediaEvent.INFOCHANGE]);

        function _init() {
            _this.logger = _logger;
            _fps = 0;
            _readyState = State.INITIALIZED;
        }

        _this.id = function () {
            return _id;
        };

        _this.setup = async function (container, config) {
            _this.config = utils.extendz({ id: _id }, _default, config);

            _container = container;
            _canvas = utils.createElement('canvas');
            _canvas.width = 256;
            _canvas.height = 240;
            _context = _canvas.getContext('2d');
            _context.fillStyle = 'black';
            _context.fillRect(0, 0, 256, 240);
            _container.appendChild(_canvas);

            _imageData = _context.getImageData(0, 0, 256, 240);
            for (var i = 3; i < _imageData.data.length - 3; i += 4) {
                _imageData.data[i] = 0xFF;
            }

            _this.cpu = new NES.CPU(_this, _logger);
            _this.cpu.addEventListener(Event.ERROR, _onError);

            _this.ppu = new NES.PPU(_this, _logger);
            _this.apu = new NES.APU(_this, _logger);
            _this.keyboard = new NES.Keyboard(_logger);

            _frame = new utils.Timer(1000 / _this.config.frameRate, 0, _logger);
            _frame.addEventListener(TimerEvent.TIMER, _onFrame);

            _count = new utils.Timer(1000, 0, _logger);
            _count.addEventListener(TimerEvent.TIMER, _onCount);

            _bind();
        };

        function _bind() {
            _this.dispatchEvent(Event.BIND);
            _this.dispatchEvent(Event.READY);
        }

        _this.load = function (buffer) {
            if (_readyState === State.RUNNING) {
                _this.stop();
                _this.reset();
            }

            try {
                _this.rom = new NES.ROM(_this, _logger);
                _this.rom.load(buffer);
                _logger.log(`Load rom success!`);
            } catch (err) {
                _logger.error(`Failed to load rom: ${err}`);
                return Promise.reject(err);
            }

            try {
                var Mapper = NES.Mapper.get(_this.rom.mapperType);
                _this.mmap = new Mapper(_this, _logger);
                _this.mmap.reset();
                _this.mmap.loadROM();
                _logger.log(`Load mapper ${Mapper.prototype.id} success!`);
            } catch (err) {
                _logger.error(`Failed to load mapper ${Mapper.prototype.id}: ${err}`);
                return Promise.reject(err);
            }

            _this.ppu.setMirroring(_this.rom.getMirroringType());
            _buffer = buffer;
            return Promise.resolve();
        };

        _this.start = function () {
            if (_this.rom == null) {
                _this.dispatchEvent(Event.ERROR, { name: 'AbortError', message: 'ROM not loaded.' });
                return;
            }
            switch (_readyState) {
                case State.INITIALIZED:
                case State.CLOSING:
                case State.CLOSED:
                    _readyState = State.RUNNING;
                    _fps = 0;
                    _frame.start();
                    _count.start();
                    break;
            }
        };

        function _onFrame(e) {
            _this.ppu.startFrame();
            _fps++;

            for (; _frame.running();) {
                var cycles = 0;
                if (_this.cpu.cyclesToHalt === 0) {
                    // Execute a CPU instruction.
                    cycles = _this.cpu.emulate();
                    if (_this.config.muted == false) {
                        _this.apu.clockFrameCounter(cycles);
                    }
                    cycles *= 3;
                } else {
                    if (_this.cpu.cyclesToHalt > 8) {
                        cycles = 24;
                        if (_this.config.muted == false) {
                            _this.apu.clockFrameCounter(8);
                        }
                        _this.cpu.cyclesToHalt -= 8;
                    } else {
                        cycles = _this.cpu.cyclesToHalt * 3;
                        if (_this.config.muted == false) {
                            _this.apu.clockFrameCounter(_this.cpu.cyclesToHalt);
                        }
                        _this.cpu.cyclesToHalt = 0;
                    }
                }

                for (; cycles > 0; cycles--) {
                    if (_this.ppu.curX === _this.ppu.spr0HitX &&
                        _this.ppu.f_spVisibility === 1 &&
                        _this.ppu.scanline - 21 === _this.ppu.spr0HitY) {
                        // Set sprite 0 hit flag.
                        _this.ppu.setStatusFlag(NES.PPU.Status.SPRITE0HIT, true);
                    }
                    if (_this.ppu.requestEndFrame) {
                        _this.ppu.nmiCounter--;
                        if (_this.ppu.nmiCounter === 0) {
                            _this.ppu.requestEndFrame = false;
                            _this.ppu.startVBlank();
                            return;
                        }
                    }
                    _this.ppu.curX++;
                    if (_this.ppu.curX === 341) {
                        _this.ppu.curX = 0;
                        _this.ppu.endScanline();
                    }
                }
            }
        }

        function _onCount(e) {
            _this.dispatchEvent(MediaEvent.INFOCHANGE, { info: { fps: _fps } });
            _fps = 0;
        }

        _this.stop = function () {
            if (_frame) {
                _frame.stop();
            }
            if (_count) {
                _count.stop();
            }
            _fps = 0;
            _readyState = State.INITIALIZED;
        };

        _this.reset = function () {
            if (_this.mmap != null) {
                _this.mmap.reset();
            }
            _this.cpu.reset();
            _this.ppu.reset();
            _this.apu.reset();
        };

        _this.reload = function () {
            if (_buffer) {
                return _this.load(_buffer);
            }
            return Promise.reject('rom not loaded');
        };

        _this.muted = function (status) {
            if (utils.typeOf(status) === 'boolean') {
                if (_this.config.muted == true && !status) {
                    _audio = new (window.AudioContext || window.webkitAudioContext)();

                    var source = _audio.createBufferSource();
                    source.connect(_audio.destination); // Output to sound.
                    source.start();
                }
                var changed = _this.config.muted !== status;
                _this.config.muted = status;
                if (changed) {
                    _this.dispatchEvent(Event.VOLUMECHANGE, { muted: status, volume: status ? 0 : 1 });
                }
            }
            return _this.config.muted;
        };

        _this.writeAudio = function (samples) {
            // Create output buffer (planar buffer format).
            var buffer = _audio.createBuffer(2, samples.length, _audio.sampleRate);
            var channelLeft = buffer.getChannelData(0);
            var channelRight = buffer.getChannelData(1);
            // Convert from interleaved buffer format to planar buffer
            // by writing right into appropriate channel buffers.
            var j = 0;
            for (var i = 0; i < samples.length; i += 2) {
                channelLeft[j] = samples[i] / 32767;
                channelRight[j] = samples[i + 1] / 32767;
                j++;
            }
            // Create sound source and play it.
            var source = _audio.createBufferSource();
            source.buffer = buffer;
            source.connect(_audio.destination); // Output to sound.
            source.start();
        };

        _this.writeFrame = function (buffer, prevBuffer) {
            for (var i = 0; i < 256 * 240; i++) {
                var pixel = buffer[i];
                if (pixel != prevBuffer[i]) {
                    var j = i * 4;
                    _imageData.data[j] = pixel & 0xFF;
                    _imageData.data[j + 1] = (pixel >> 8) & 0xFF;
                    _imageData.data[j + 2] = (pixel >> 16) & 0xFF;
                    prevBuffer[i] = pixel;
                }
            }
            _context.putImageData(_imageData, 0, 0);
        };

        function _onError(e) {
            _logger.error(`NES.onError: name=${e.data.name}, message=${e.data.message}`);
            _this.stop();
        }

        _this.state = function () {
            return _readyState;
        };

        _this.destroy = function (reason) {
            switch (_readyState) {
                case State.INITIALIZED:
                case State.RUNNING:
                    if (_frame) {
                        _frame.stop();
                    }
                    if (_count) {
                        _count.stop();
                    }
                    delete _instances[_id];
                    break;
            }
        };

        _init();
    }

    NES.prototype = Object.create(EventDispatcher.prototype);
    NES.prototype.constructor = NES;
    NES.prototype.CONF = _default;

    NES.get = function (id, logger) {
        if (id == null) {
            id = 0;
        }
        var nes = _instances[id];
        if (nes === undefined) {
            nes = new NES(id, logger);
            _instances[id] = nes;
        }
        return nes;
    };

    NES.create = function (logger) {
        return NES.get(_id++, logger);
    };

    NES.State = State;
    odd.nes = NES.get;
    odd.nes.create = NES.create;
    odd.NES = NES;
})(odd);

