// Deterministic signaling fixture: end-of-candidates arrives while the first
// queued PATCH is still in flight. It must remain behind every older candidate.
window.runIceRegression = async function () {
    const NativePC = window.RTCPeerConnection, NativeXHR = window.XMLHttpRequest;
    const assert = (value, name) => { if (!value) throw new Error(name); };
    const tick = () => new Promise(resolve => setTimeout(resolve, 0));
    let pc, first, sent = [], api;
    class Peer extends EventTarget {
        constructor() { super(); pc = this; this.connectionState = 'new'; }
        addTransceiver() {}
        getTransceivers() { return []; }
        getReceivers() { return []; }
        createDataChannel() { const channel = new EventTarget(); channel.close = () => {}; return channel; }
        async createOffer() { return { type: 'offer', sdp: 'v=0\r\n' }; }
        async setLocalDescription(offer) { this.localDescription = offer; this.candidate('first'); this.candidate('second'); }
        async setRemoteDescription() {}
        close() { this.connectionState = 'closed'; }
        candidate(value) {
            const event = new Event('icecandidate');
            event.candidate = value === null ? null : { candidate: 'candidate:' + value, sdpMid: '0' };
            this.dispatchEvent(event);
        }
    }
    class Request {
        open(method) { this.method = method; }
        setRequestHeader() {}
        getResponseHeader(name) {
            return name === 'Location' ? location.origin + '/famicom/play?instance=game&player=player&ports=0' : '"generation"';
        }
        reply() { this.status = this.method === 'POST' ? 201 : 204; this.responseText = 'v=0\r\n'; this.onload?.(); this.onloadend?.(); }
        send(body) {
            if (this.method === 'PATCH') {
                sent.push(body);
                if (!first) { first = this; return; }
            }
            queueMicrotask(() => this.reply());
        }
        abort() { this.onabort?.(); this.onloadend?.(); }
    }
    window.RTCPeerConnection = Peer;
    window.XMLHttpRequest = Request;
    try {
        api = odd.Famicom.create();
        await api.setup(document.getElementById('host'), { base: location.origin + '/famicom', trickle: true, credentials: async () => ({ token: 'fixture' }) });
        const playing = api.play('game');
        for (let i = 0; !first && i < 100; i++) await tick();
        assert(first, 'first candidate starts after POST');
        pc.candidate('third');
        pc.candidate(null);
        await tick();
        assert(sent.length === 1, 'later candidates and completion cannot overtake an in-flight PATCH');
        first.reply();
        await playing;
        assert(sent.length === 4 && sent[0].includes('first') && sent[1].includes('second') && sent[2].includes('third') && sent[3].includes('end-of-candidates'), 'all candidates precede completion');
        api.destroy();
        const before = sent.length;
        pc.candidate('late');
        await tick();
        assert(sent.length === before, 'destroyed peer sends no candidates');
        return { passed: true, checks: 3 };
    } finally {
        api?.destroy(); window.RTCPeerConnection = NativePC; window.XMLHttpRequest = NativeXHR;
    }
};
