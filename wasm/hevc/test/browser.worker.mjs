// Test-only module worker; not the Player's scheduling/rendering backend.
import scalar from '../dist/odd.hevc.scalar.mjs';
import simd from '../dist/odd.hevc.simd.mjs';

self.onmessage = async ({data: {variant, fixture}}) => {
    try {
        const module = await (variant === 'simd' ? simd : scalar)();
        const bytes = value => Uint8Array.from(atob(value), c => c.charCodeAt(0));
        const config = bytes(fixture.config), pointer = module._malloc(config.length);
        module.HEAPU8.set(config, pointer);
        const decoder = module._odd_hevc_create(pointer, config.length, 16777216, 16777216);
        module._free(pointer);
        if (!decoder) { throw Error('Decoder initialization failed'); }
        const frames = [];
        async function receive() {
            for (let n = 0; n < 64; n++) {
                const result = module._odd_hevc_receive(decoder);
                if (result === 1 || result === 2) { return result; }
                if (result !== 0) { throw Error('Receive: ' + result); }
                const depth = module._odd_hevc_frame(decoder, 2), sampleBytes = depth > 8 ? 2 : 1;
                const frame = new Uint8Array(fixture.width * fixture.height * 3 / 2 * sampleBytes);
                let offset = 0;
                for (let plane = 0; plane < 3; plane++) {
                    const width = fixture.width / (plane ? 2 : 1), height = fixture.height / (plane ? 2 : 1);
                    const data = module._odd_hevc_plane(decoder, plane), stride = module._odd_hevc_stride(decoder, plane);
                    for (let row = 0; row < height; row++) {
                        frame.set(module.HEAPU8.subarray(data + row * stride, data + row * stride + width * sampleBytes), offset);
                        offset += width * sampleBytes;
                    }
                }
                const pts = module._odd_hevc_frame(decoder, 11);
                module._odd_hevc_release(decoder);
                const hash = await crypto.subtle.digest('SHA-256', frame);
                frames.push({pts, sha256: [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('')});
            }
            throw Error('Unbounded receive');
        }
        try {
            for (const packet of fixture.packets) {
                const data = bytes(packet.data), input = module._odd_hevc_packet(decoder, data.length);
                if (!input) { throw Error('Packet allocation failed'); }
                module.HEAPU8.set(data, input);
                let result = module._odd_hevc_send(decoder, packet.pts, packet.dts, packet.duration);
                if (result === 1) {
                    await receive();
                    result = module._odd_hevc_send(decoder, packet.pts, packet.dts, packet.duration);
                }
                if (result !== 0) { throw Error('Send: ' + result); }
                await receive();
            }
            if (module._odd_hevc_drain(decoder) !== 0 || await receive() !== 2) { throw Error('Drain failed'); }
            postMessage({variant, frames, linearMemoryBytes: module.HEAPU8.byteLength});
        } finally {
            module._odd_hevc_destroy(decoder);
        }
    } catch (error) {
        postMessage({error: error.message});
    }
};
