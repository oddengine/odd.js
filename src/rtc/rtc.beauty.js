(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        TimerEvent = events.TimerEvent,
        RTC = odd.RTC,

        _default = {
            brightness: 0.5, // 0.0 ~ 1.0
            smoothness: 1.0, // 0.0 ~ 1.0
        };

    function BeautyContext(stream, logger) {
        var _this = this,
            _logger = logger;

        function _init() {
            var input = stream.getVideoTracks()[0];
            if (input == undefined) {
                throw { name: 'AbortError', message: `Video track not found.` };
            }
            var width = input.getSettings().width;
            var height = input.getSettings().height;
            var frameRate = input.getSettings().frameRate || 15;

            var canvas = utils.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            var gl = canvas.getContext('webgl');
            var vertexshader = _createShader(gl, gl.VERTEX_SHADER, Beauty.VERTEX_SHADER_SOURCE);
            var fragmentshader = _createShader(gl, gl.FRAGMENT_SHADER, Beauty.FRAGMENT_SHADER_SOURCE);
            if (vertexshader == null || fragmentshader == null) {
                throw { name: 'AbortError', message: `Error occurred while creating shader.` };
            }
            var program = _createProgram(gl, vertexshader, fragmentshader);
            if (program == null) {
                throw { name: 'AbortError', message: `Error occurred while creating program.` };
            }
            var sampler = gl.getUniformLocation(program, 'uSampler');
            var brightness = gl.getUniformLocation(program, 'brightness');
            var smoothness = gl.getUniformLocation(program, 'smoothness');
            if (sampler == null || brightness == null || smoothness == null) {
                throw { name: 'AbortError', message: `Error occurred while getting uniform location.` };
            }

            var positions = [
                -1.0, -1.0,
                1.0, -1.0,
                1.0, 1.0,
                -1.0, 1.0,
            ];
            var positionbuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, positionbuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

            // Now set up the texture coordinates for the faces.
            var texturecoordinates = [
                0.0, 1.0,
                1.0, 1.0,
                1.0, 0.0,
                0.0, 0.0,
            ];
            var texturecoordbuffer = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, texturecoordbuffer);
            gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texturecoordinates), gl.STATIC_DRAW);

            var indices = [
                0, 1, 2, 0, 2, 3,    // front
            ];
            const indicesbuffer = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesbuffer);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);

            var texture = _createTexture(gl);
            var vertexposition = gl.getAttribLocation(program, 'aVertexPosition');
            var texturecoord = gl.getAttribLocation(program, 'aTextureCoord');

            utils.extendz(_this, {
                canvas: canvas,
                gl: gl,
                vertexshader: vertexshader,
                fragmentshader: fragmentshader,
                program: program,
                sampler: sampler,
                brightness: brightness,
                smoothness: smoothness,
                positionbuffer: positionbuffer,
                texturecoordbuffer: texturecoordbuffer,
                indicesbuffer: indicesbuffer,
                texture: texture,
                vertexposition: vertexposition,
                texturecoord: texturecoord,
                video: _createVideoElement(input),
                stream: stream,
                input: input,
                output: canvas.captureStream(frameRate).getVideoTracks()[0],
            });
        }

        function _createShader(gl, type, source) {
            var shader = gl.createShader(type);
            if (shader) {
                gl.shaderSource(shader, source);
                gl.compileShader(shader);
                if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
                    _logger.error(`Failed to compile shader: ${gl.getShaderInfoLog(shader)}`);
                    gl.deleteShader(shader);
                    return null;
                }
            }
            return shader;
        }

        function _createProgram(gl, vertexshader, fragmentshader) {
            var program = gl.createProgram();
            if (program) {
                gl.attachShader(program, vertexshader);
                gl.attachShader(program, fragmentshader);
                gl.linkProgram(program);
                if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                    _logger.error(`Failed to link program: ${gl.getProgramInfoLog(program)}`);
                    return null;
                }
            }
            return program;
        }

        function _createTexture(gl) {
            var texture = gl.createTexture();
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            return texture;
        }

        function _createVideoElement(track) {
            var stream = new MediaStream();
            stream.addTrack(track);
            var video = utils.createElement('video');
            video.autoplay = true;
            video.muted = true;
            video.srcObject = stream;
            video.play().catch(function (err) {
                _logger.warn(`${err}`);
            });
            return video;
        }

        _this.update = function (constraints) {
            var gl = _this.gl,
                program = _this.program,
                sampler = _this.sampler,
                brightness = _this.brightness,
                smoothness = _this.smoothness,
                positionbuffer = _this.positionbuffer,
                texturecoordbuffer = _this.texturecoordbuffer,
                indicesbuffer = _this.indicesbuffer,
                texture = _this.texture,
                vertexposition = _this.vertexposition,
                texturecoord = _this.texturecoord,
                video = _this.video;

            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);

            gl.bindBuffer(gl.ARRAY_BUFFER, positionbuffer);
            gl.vertexAttribPointer(vertexposition, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(vertexposition);

            gl.bindBuffer(gl.ARRAY_BUFFER, texturecoordbuffer);
            gl.vertexAttribPointer(texturecoord, 2, gl.FLOAT, false, 0, 0);
            gl.enableVertexAttribArray(texturecoord);

            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indicesbuffer);
            gl.useProgram(program);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, texture);
            gl.uniform1i(sampler, 0);

            gl.uniform1f(brightness, constraints.brightness);
            gl.uniform1f(smoothness, constraints.smoothness);
            gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
        };

        _init();
    }

    function Beauty(logger) {
        EventDispatcher.call(this, 'VideoMixer', { logger: logger }, Event);

        var _this = this,
            _logger = logger,
            _constraints,
            _ctx,
            _timer;

        function _init() {
            _constraints = utils.extendz({}, _default);

            _timer = new utils.Timer(33, 0, _logger);
            _timer.addEventListener(TimerEvent.TIMER, _onTimer);
        }

        _this.applyConstraints = function (constraints) {
            if (constraints.hasOwnProperty('brightness')) {
                constraints.brightness = Math.max(0, constraints.brightness);
                constraints.brightness = Math.min(constraints.brightness, 1.0);
                constraints.brightness = constraints.brightness * 1.6 + 0.2;
            }
            if (constraints.hasOwnProperty('smoothness')) {
                constraints.smoothness = Math.max(0, constraints.smoothness);
                constraints.smoothness = Math.min(constraints.smoothness, 1.0);
            }
            _constraints = utils.extendz(_constraints, constraints);
        };

        _this.enable = function (stream, constraints) {
            if (_ctx == null) {
                try {
                    _ctx = new BeautyContext(stream, _logger);
                    _ctx.video.addEventListener('playing', _onPlaying);
                } catch (err) {
                    _logger.error(`Failed to create beauty context: name=${err.name}, message=${err.message}`);
                    return Promise.reject(err);
                }
            }
            _this.applyConstraints(constraints);
            return Promise.resolve();
        };

        _this.disable = function () {
            _timer.stop();
            if (_ctx) {
                _ctx.video.removeEventListener('playing', _onPlaying);

                _ctx.gl.deleteProgram(_ctx.program);
                _ctx.gl.deleteBuffer(_ctx.positionbuffer);
                _ctx.gl.deleteBuffer(_ctx.texturecoordbuffer);
                _ctx.gl.deleteBuffer(_ctx.indicesbuffer);
                _ctx.gl.deleteShader(_ctx.vertexshader);
                _ctx.gl.deleteShader(_ctx.fragmentshader);
                _ctx = undefined;
            }
        };

        _this.enabled = function () {
            return _ctx != null;
        };

        _this.stream = function () {
            return _ctx ? _ctx.stream : null;
        };

        _this.input = function () {
            return _ctx ? _ctx.input : null;
        };

        _this.output = function () {
            return _ctx ? _ctx.output : null;
        };

        function _onPlaying(e) {
            if (_ctx) {
                _ctx.video.removeEventListener('playing', _onPlaying);
            }
            _timer.start();
        }

        function _onTimer(e) {
            if (_ctx) {
                _ctx.update(_constraints);
            }
        }

        _init();
    }

    Beauty.prototype = Object.create(EventDispatcher.prototype);
    Beauty.prototype.constructor = Beauty;
    Beauty.prototype.CONF = _default;

    RTC.Beauty = Beauty;
})(odd);

