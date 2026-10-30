// Dedicated worker: one FFmpeg decoder, at most three external YUV buffers.
let module, decoder, generation = 0, pending = null, draining = false, held = false;

let maxFrameBytes = 25165824, limit = 1, nextToken = 1, closed = false, ended = false;

const outstanding = new Map, pool = [];

let chain = Promise.resolve();

const simd = WebAssembly.validate(new Uint8Array([ 0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11 ]));

function error(code) {
    const ptr = module._malloc(256);
    module._odd_hevc_error_string(code, ptr, 256);
    const text = (new TextDecoder).decode(module.HEAPU8.subarray(ptr, ptr + 256)).split('\0')[0];
    module._free(ptr);
    return Error(text);
}

async function configure(message) {
    generation = message.generation;
    if (!module) {
        async function load(kind) {
            const {default: factory} = await import(new URL('odd.hevc.' + kind + '.mjs', self.location.href));
            return factory({
                printErr: () => {}
            });
        }
        try {
            module = await load(simd ? 'simd' : 'scalar');
        } catch (reason) {
            if (!simd) {
                throw reason;
            }
            module = await load('scalar');
        }
    }
    if (decoder) {
        module._odd_hevc_destroy(decoder);
        decoder = 0;
    }
    const bytes = new Uint8Array(message.config), ptr = module._malloc(bytes.length);
    if (!ptr) {
        throw Error('HEVC configuration allocation failed.');
    }
    module.HEAPU8.set(bytes, ptr);
    decoder = module._odd_hevc_create(ptr, bytes.length, message.maxPixels, message.maxPacketBytes);
    module._free(ptr);
    if (!decoder) {
        throw error(module._odd_hevc_error(0));
    }
    maxFrameBytes = message.maxFrameBytes;
    generation = message.generation;
    pending = null;
    draining = held = ended = false;
    limit = 1;
    pool.length = 0;
    postMessage({
        type: 'ready',
        generation: generation
    });
}

function receive() {
    if (ended) {
        return;
    }
    while (outstanding.size < limit) {
        if (!held) {
            const result = module._odd_hevc_receive(decoder);
            if (result === 1) {
                return;
            }
            if (result === 2) {
                ended = true;
                postMessage({
                    type: 'drained',
                    generation: generation
                });
                draining = false;
                return;
            }
            if (result !== 0) {
                throw error(result);
            }
            held = true;
        }
        const value = field => module._odd_hevc_frame(decoder, field);
        const width = value(0), height = value(1), depth = value(2), format = value(13);
        if (format !== 1 && format !== 2 || [ 16, 18 ].includes(value(9))) {
            throw Error('HEVC rendering requires Main/Main10 SDR YUV420.');
        }
        const bytesPerSample = depth > 8 ? 2 : 1, chromaWidth = Math.ceil(width / 2), chromaHeight = Math.ceil(height / 2);
        const size = (width * height + 2 * chromaWidth * chromaHeight) * bytesPerSample;
        if (size > maxFrameBytes) {
            throw Error('Decoded HEVC frame exceeds the display byte budget.');
        }
        limit = Math.max(1, Math.min(3, Math.floor(maxFrameBytes / size)));
        // A larger configuration may lower the limit while old buffers are being returned.
                if (outstanding.size >= limit) {
            return;
        }
        let buffer = pool.pop();
        if (!buffer || buffer.byteLength !== size) {
            buffer = new ArrayBuffer(size);
        }
        const output = new Uint8Array(buffer);
        let offset = 0;
        for (let plane = 0; plane < 3; plane++) {
            const w = plane ? chromaWidth : width, h = plane ? chromaHeight : height;
            const ptr = module._odd_hevc_plane(decoder, plane), stride = module._odd_hevc_stride(decoder, plane);
            for (let row = 0; row < h; row++) {
                output.set(module.HEAPU8.subarray(ptr + row * stride, ptr + row * stride + w * bytesPerSample), offset);
                offset += w * bytesPerSample;
            }
        }
        const token = nextToken++, frame = {
            type: 'frame',
            generation: generation,
            token: token,
            buffer: buffer,
            width: width,
            height: height,
            depth: depth,
            pts: value(11) / 1e3,
            duration: value(12) / 1e3,
            range: value(6),
            space: value(7),
            primaries: value(8),
            trc: value(9)
        };
        module._odd_hevc_release(decoder);
        held = false;
        outstanding.set(token, size);
        postMessage(frame, [ buffer ]);
    }
}

function pump() {
    if (!decoder || closed) {
        return;
    }
    const start = performance.now();
    receive();
    if (pending) {
        const item = pending, code = module._odd_hevc_send(decoder, item.pts * 1e3, item.dts * 1e3, item.duration * 1e3);
        if (code === 1) {
            return;
        }
        if (code !== 0) {
            throw error(code);
        }
        pending = null;
        if (item.keyOnly) {
            draining = true;
        }
        receive();
        postMessage({
            type: 'accepted',
            generation: generation,
            id: item.id,
            cost: performance.now() - start,
            memoryBytes: module.HEAPU8.byteLength
        });
    }
    if (draining) {
        const code = module._odd_hevc_drain(decoder);
        if (code < 0) {
            throw error(code);
        }
        receive();
    }
}

self.onmessage = ({data: message}) => {
    chain = chain.then(async () => {
        switch (message.type) {
          case 'configure':
            await configure(message);
            break;

          case 'reset':
            generation = message.generation;
            module._odd_hevc_flush(decoder);
            pending = null;
            draining = held = ended = false;
            postMessage({
                type: 'ready',
                generation: generation
            });
            break;

          case 'packet':
            if (message.generation !== generation) {
                return;
            }
            if (pending) {
                throw Error('HEVC input backpressure violated.');
            }
            const bytes = new Uint8Array(message.buffer), ptr = module._odd_hevc_packet(decoder, bytes.length);
            if (!ptr) {
                throw error(module._odd_hevc_error(decoder));
            }
            module.HEAPU8.set(bytes, ptr);
            pending = message;
            pump();
            break;

          case 'release':
            if (outstanding.delete(message.token)) {
                if (pool.length < 3) {
                    pool.push(message.buffer);
                }
                pump();
            }
            break;

          case 'drain':
            if (message.generation === generation) {
                draining = true;
                pump();
            }
            break;

          case 'close':
            closed = true;
            if (decoder) {
                module._odd_hevc_destroy(decoder);
                decoder = 0;
            }
            pool.length = 0;
            outstanding.clear();
            self.close();
            break;
        }
    }).catch(reason => {
        pending = null;
        postMessage({
            type: 'error',
            generation: generation,
            name: reason.name || 'EncodingError',
            message: reason.message
        });
    });
};
