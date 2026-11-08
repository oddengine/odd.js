// Browser regression with real WebRTC peers and synthetic capture. Serve the
// SDK checkout over localhost; use a browser's fake media device flags.
window.runTrackRegression = async function () {
    const results = [], peers = [], NativePC = window.RTCPeerConnection;
    const assert = (value, message) => { if (!value) { throw new Error(message); } };
    const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
    window.RTCPeerConnection = class extends NativePC {
        constructor(config) { super(config); peers.push(this); }
    };
    const logger = { log() {}, warn() {}, error() {}, debug() {} };
    async function fixture(beauty) {
        const server = new NativePC({ iceServers: [] });
        let savedOffer, savedAnswer, reject = false, lose = false, calls = [], routes = 0, released = 0;
        const resource = 'https://rtc.test/whip/' + crypto.randomUUID();
        const participant = {
            route: async (direction, streamId, instanceId) => { routes++; return { streamId, instanceId, url: resource }; },
            send: async (method, url, body, type) => {
                calls.push({ method, url, body, type });
                if (method === 'DELETE') { return { status: 204 }; }
                if (method === 'PATCH' && reject) { throw { status: 403, message: 'Denied by current media policy.' }; }
                if (body !== savedOffer) {
                    await server.setRemoteDescription({ type: 'offer', sdp: body });
                    await server.setLocalDescription(await server.createAnswer());
                    savedOffer = body; savedAnswer = server.localDescription.sdp;
                }
                if (method === 'PATCH' && lose) { lose = false; throw { name: 'NetworkError', message: 'Lost answer.' }; }
                return { status: method === 'POST' ? 201 : 200, body: savedAnswer,
                    headers: new Headers({ 'Content-Type': 'application/sdp', 'Location': url + '/' + ns.getProperty('instance-test'), ETag: '*' }) };
            },
            abort() {}, release() { released++; },
        };
        const ns = new odd.RTC.NetStream({ beauty, participation: {}, configuration: { iceServers: [] }, timeout: 3000 }, logger, {
            acquire: () => ({ promise: Promise.resolve(participant), cancel() {} }),
        });
        const originalRoute = participant.route;
        participant.route = async (...args) => { ns.setProperty('instance-test', args[2]); return originalRoute(...args); };
        const capturedTracks = [], capture = ns.getUserMedia;
        ns.getUserMedia = async constraints => { const stream = await capture(constraints); capturedTracks.push(...stream.getTracks()); return stream; };
        ns.applyConstraints({ audio: true, video: false });
        await ns.attach();
        const pc = peers.at(-1), queued = [];
        pc.addEventListener('icecandidate', e => { if (e.candidate) { if (server.remoteDescription) { server.addIceCandidate(e.candidate); } else { queued.push(e.candidate); } } });
        server.addEventListener('icecandidate', e => { if (e.candidate) { if (pc.remoteDescription) { pc.addIceCandidate(e.candidate); } else { setTimeout(() => pc.addIceCandidate(e.candidate), 100); } } });
        await ns.preview(false, false); await ns.publish();
        for (const candidate of queued) { await server.addIceCandidate(candidate); }
        const audio = ns.stream().getAudioTracks()[0], sender = ns.getSenders()[0], name = ns.name(), instance = ns.getProperty('@id');
        const check = () => {
            assert(peers.at(-1) === pc && pc.connectionState !== 'closed', 'PC replaced/closed');
            assert(ns.name() === name && ns.getProperty('@id') === instance, 'publication identity changed');
            assert(ns.stream().getAudioTracks()[0] === audio && audio.readyState === 'live', 'original microphone stopped');
            assert(ns.getSenders().includes(sender) && sender.track === audio, 'audio sender replaced');
            assert(routes === 1 && released === 0 && calls.filter(c => c.method === 'POST').length === 1 && !calls.some(c => c.method === 'DELETE'), 'publication/seat reacquired or deleted');
        };
        return { ns, pc, server, calls, check, capturedTracks, set reject(value) { reject=value; }, set lose(value) { lose=value; },
            async close() { await ns.close('regression-finished'); server.close(); await sleep(10); } };
    }
    try {
        let f = await fixture();
        try {
            await f.ns.updateInputs({ audio: true, video: true }); f.check();
            assert(f.ns.stream().getVideoTracks().length === 1, 'video missing');
            assert(f.calls.filter(c => c.method === 'PATCH').length === 1, 'unexpected renegotiation count');
            await f.ns.updateInputs({ audio: true, video: true }); f.check();
            assert(f.calls.filter(c => c.method === 'PATCH').length === 1, 'duplicate input adds another track');
            results.push('PASS real PC adds camera; same audio sender, stream, resource and lease');
        } finally { await f.close(); }
        f = await fixture();
        try {
            f.reject = true;
            let rejected = false;
            try { await f.ns.updateInputs({ audio: true, video: true }); } catch (error) { rejected = error.status === 403; }
            assert(rejected, 'authorization rejection swallowed'); f.check();
            assert(f.ns.stream().getVideoTracks().length === 0 && f.pc.signalingState === 'stable', 'failed camera not rolled back');
            f.reject = false; await f.ns.updateInputs({ audio: true, video: true }); f.check();
            results.push('PASS denied update rolls back only camera; original audio survives and retry works');
        } finally { await f.close(); }
        f = await fixture();
        try {
            f.lose = true; await f.ns.updateInputs({ audio: true, video: true }); f.check();
            const patches = f.calls.filter(c => c.method === 'PATCH');
            assert(patches.length === 2 && patches[0].body === patches[1].body && patches[0].url === patches[1].url, 'lost answer did not retry exact SDP/resource');
            results.push('PASS lost answer retries identical offer without another publication');
        } finally { await f.close(); }
        f = await fixture({enabled:true, whitening:0.3, smoothing:0.2});
        try {
            await f.ns.updateInputs({ audio:true, video:true }); f.check();
            const stream = f.ns.stream(), processed = stream.getVideoTracks()[0], sender = f.ns.getSenders().find(s => s.track === processed);
            assert(!f.capturedTracks.includes(processed), 'saved effects not applied to the added camera');
            await f.ns.setCamera(''); f.check();
            assert(f.ns.stream() === stream && sender.track === stream.getVideoTracks()[0] && sender.track !== processed && processed.readyState === 'ended', 'camera replacement lost publication or retained old effect track');
            results.push('PASS saved beauty processes a late camera and camera replacement keeps the same PC, stream, sender and seat');
        } finally { await f.close(); }
        return results;
    } finally {
        window.RTCPeerConnection = NativePC;
        document.getElementById('results').textContent = results.join('\n');
    }
};
