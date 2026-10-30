(function(odd) {
    function YUV(canvas) {
        var gl = canvas.getContext('webgl2', {
            alpha: false,
            antialias: false,
            preserveDrawingBuffer: true
        }), textures = [], program, depth = 0, width = 0, height = 0;
        if (!gl) {
            throw {
                name: 'NotSupportedError',
                message: 'HEVC software rendering requires WebGL 2.'
            };
        }
        function shader(type, source) {
            var object = gl.createShader(type);
            gl.shaderSource(object, source);
            gl.compileShader(object);
            if (!gl.getShaderParameter(object, gl.COMPILE_STATUS)) {
                var error = gl.getShaderInfoLog(object);
                gl.deleteShader(object);
                throw Error(error);
            }
            return object;
        }
        function setup(bits) {
            if (program) {
                gl.deleteProgram(program);
            }
            var vs = shader(gl.VERTEX_SHADER, '#version 300 es\nin vec2 p;out vec2 uv;void main(){gl_Position=vec4(p,0.,1.);uv=vec2((p.x+1.)*.5,(1.-p.y)*.5);}');
            var integer = bits > 8, fs = shader(gl.FRAGMENT_SHADER, '#version 300 es\nprecision highp float;precision highp usampler2D;in vec2 uv;out vec4 color;uniform ' + (integer ? 'usampler2D' : 'sampler2D') + ' y,u,v;uniform vec3 offset;uniform mat3 matrix;void main(){vec3 c=vec3(texture(y,uv).r,texture(u,uv).r,texture(v,uv).r)' + (integer ? '/1023.' : '') + ';color=vec4(clamp(matrix*(c-offset),0.,1.),1.);}');
            program = gl.createProgram();
            gl.attachShader(program, vs);
            gl.attachShader(program, fs);
            gl.linkProgram(program);
            gl.deleteShader(vs);
            gl.deleteShader(fs);
            if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
                throw Error(gl.getProgramInfoLog(program));
            }
            gl.useProgram(program);
            var position = gl.getAttribLocation(program, 'p');
            gl.enableVertexAttribArray(position);
            gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
            [ 'y', 'u', 'v' ].forEach(function(name, index) {
                gl.uniform1i(gl.getUniformLocation(program, name), index);
            });
            depth = bits;
            width = height = 0;
        }
        var vertices = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([ -1, -1, 1, -1, -1, 1, 1, 1 ]), gl.STATIC_DRAW);
        for (var n = 0; n < 3; n++) {
            textures.push(gl.createTexture());
        }
        this.draw = function(frame) {
            if (gl.isContextLost()) {
                throw {
                    name: 'OperationError',
                    message: 'HEVC rendering context was lost.'
                };
            }
            if (depth !== frame.depth) {
                setup(frame.depth);
            }
            var resize = width !== frame.width || height !== frame.height;
            if (resize) {
                width = frame.width;
                height = frame.height;
                canvas.width = width;
                canvas.height = height;
                gl.viewport(0, 0, width, height);
            }
            gl.useProgram(program);
            gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
            var ten = depth > 8, offset = 0;
            for (var i = 0; i < 3; i++) {
                var w = i ? Math.ceil(width / 2) : width, h = i ? Math.ceil(height / 2) : height, size = w * h, bytes = ten ? 2 : 1;
                var data = ten ? new Uint16Array(frame.buffer, offset, size) : new Uint8Array(frame.buffer, offset, size);
                offset += size * bytes;
                gl.activeTexture(gl.TEXTURE0 + i);
                gl.bindTexture(gl.TEXTURE_2D, textures[i]);
                if (resize) {
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, ten ? gl.NEAREST : gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, ten ? gl.NEAREST : gl.LINEAR);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
                    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                    gl.texImage2D(gl.TEXTURE_2D, 0, ten ? gl.R16UI : gl.R8, w, h, 0, ten ? gl.RED_INTEGER : gl.RED, ten ? gl.UNSIGNED_SHORT : gl.UNSIGNED_BYTE, data);
                } else {
                    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, w, h, ten ? gl.RED_INTEGER : gl.RED, ten ? gl.UNSIGNED_SHORT : gl.UNSIGNED_BYTE, data);
                }
            }
            var kr = frame.space === 1 ? .2126 : frame.space === 9 ? .2627 : .299, kb = frame.space === 1 ? .0722 : frame.space === 9 ? .0593 : .114, kg = 1 - kr - kb;
            var full = frame.range === 2, max = ten ? 1023 : 255, scale = ten ? 4 : 1, yScale = full ? 1 : max / (219 * scale), cScale = full ? 1 : max / (224 * scale);
            gl.uniform3fv(gl.getUniformLocation(program, 'offset'), new Float32Array([ full ? 0 : 16 * scale / max, 128 * scale / max, 128 * scale / max ]));
            gl.uniformMatrix3fv(gl.getUniformLocation(program, 'matrix'), false, new Float32Array([ yScale, yScale, yScale, 0, -2 * kb * (1 - kb) / kg * cScale, 2 * (1 - kb) * cScale, 2 * (1 - kr) * cScale, -2 * kr * (1 - kr) / kg * cScale, 0 ]));
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        };
        this.destroy = function() {
            textures.forEach(function(texture) {
                gl.deleteTexture(texture);
            });
            if (program) {
                gl.deleteProgram(program);
            }
            gl.deleteBuffer(vertices);
            gl.getExtension('WEBGL_lose_context')?.loseContext();
        };
    }
    odd.AV.YUV = YUV;
})(odd);
