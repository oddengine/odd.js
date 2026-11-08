// Focused lifecycle regression checks; no device capture or network access.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { webcrypto, randomUUID } = require('node:crypto');
const sleep = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function fixture(timeout = 3500) {
    const base = 'https://example.test', id = randomUUID();
    const participant = { profile: 'odd-rtc-participation.v1', participantId: id, nodeId: 'node', bootId: randomUUID(),
        appId: randomUUID(), channelAppId: randomUUID(), userId: randomUUID(), idleRetentionSeconds: 30,
        controlUrl: `${base}/rtc/participants/${id}`, whipUrl: `${base}/whip`, whepUrl: `${base}/whep` };
    const state = { reserves: [], releases: [], routes: [], checks: 0, endAfter: 2, invalidRelease: false };
    const context = vm.createContext({ URL, AbortController, ReadableStream, TextDecoder, Uint8Array, Map, Set,
        performance, setTimeout, clearTimeout, btoa, crypto: webcrypto, document: { baseURI: base }, odd: { RTC: {}, utils: {} },
        fetch: async (url, request) => {
            const response = new Response(request.method === 'DELETE' ? null : JSON.stringify(participant),
                { status: request.method === 'DELETE' ? 204 : 200, headers: { 'Content-Type': 'application/json' } });
            Object.defineProperty(response, 'url', { value: url });
            return response;
        } });
    context.window = context;
    for (const name of ['src/utils/utils.mediarequest.js', 'src/rtc/rtc.participation.js']) {
        vm.runInContext(fs.readFileSync(path.resolve(__dirname, '..', name), 'utf8'), context, { filename: name });
    }
    const controller = new context.odd.RTC.Participation({
        credentials: async () => ({ url: `${base}/rtc/participants`, token: 'test-token', connectBefore: Math.floor(Date.now() / 1000) + 60 }),
        route: async request => {
            state.routes.push(request);
            return { ...request, generation: '1', ticket: 'test-ticket' };
        },
        publishSeats: {
            reserve: async request => {
                const seat = { ...request, seatId: randomUUID(), generation: String(state.reserves.length + 1), userId: participant.userId,
                    state: 'reserved', seatBinding: 'test-binding', connectBefore: String(Date.now() + 30000), useUntil: String(Date.now() + 60000) };
                state.reserves.push(seat);
                return seat;
            },
            release: async request => {
                state.releases.push(request);
                state.checks++;
                return { ...request, seatId: state.invalidRelease ? randomUUID() : request.seatId,
                    state: state.checks >= state.endAfter ? 'ended' : 'ending' };
            },
        },
    }, timeout, { warn() {} });
    const leases = [];
    return { state,
        async acquire() {
            const ticket = controller.acquire(Date.now() + timeout, () => ticket.cancel());
            const lease = await ticket.promise;
            leases.push(lease);
            return lease;
        },
        publish: (lease, purpose = 'camera') => lease.route('publish', randomUUID(), randomUUID(), Date.now() + timeout, purpose),
        close() { for (const lease of leases) { lease.abort(); lease.release(); } controller.close(); },
    };
}

async function check(name, run, timeout) {
    const f = fixture(timeout);
    try { await run(f); console.log(`PASS ${name}`); }
    finally { f.close(); }
}

(async () => {
    await check('replacement waits for media deletion and authoritative seat ending', async f => {
        const audio = await f.acquire();
        await f.publish(audio, 'audio');
        audio.abort(); // DELETE is still in flight; RELEASE has not run.
        const camera = await f.acquire(), pending = f.publish(camera);
        await sleep(30);
        assert.equal(f.state.routes.length, 1);
        assert.equal(f.state.reserves.length, 1);
        audio.release();
        await pending;
        assert.equal(f.state.reserves.length, 2);
        assert.equal(f.state.routes.length, 2);
        assert.equal(f.state.reserves[0].participationId, f.state.reserves[1].participationId);
        assert.notEqual(f.state.reserves[0].operationId, f.state.reserves[1].operationId);
        assert.ok(f.state.releases.every(item => item.seatId === f.state.reserves[0].seatId));
    });
    await check('camera and screen share a seat until the last publisher releases', async f => {
        const camera = await f.acquire(), screen = await f.acquire();
        await f.publish(camera); await f.publish(screen, 'screen');
        assert.equal(f.state.reserves.length, 1);
        camera.abort(); camera.release();
        await sleep(0); assert.equal(f.state.releases.length, 0);
        screen.abort(); screen.release();
        await sleep(0); assert.equal(f.state.releases.length, 1);
    });
    for (const phase of ['media-delete', 'seat-ending']) {
        await check(`cancellation during ${phase} cannot reserve or route later`, async f => {
            const old = await f.acquire(); await f.publish(old, 'audio'); old.abort();
            if (phase === 'seat-ending') { old.release(); }
            const next = await f.acquire(), pending = f.publish(next);
            await sleep(20); next.abort(); next.release();
            await assert.rejects(pending, error => error.name === 'AbortError');
            old.release();
            await sleep(1050);
            assert.equal(f.state.reserves.length, 1);
            assert.equal(f.state.routes.length, 1);
        });
    }
    await check('unconfirmed ending respects the deadline without reserving again', async f => {
        f.state.endAfter = Infinity;
        const old = await f.acquire(); await f.publish(old); old.abort(); old.release();
        const next = await f.acquire();
        await assert.rejects(f.publish(next), error => error.name === 'TimeoutError');
        assert.equal(f.state.reserves.length, 1);
        assert.equal(f.state.routes.length, 1);
    }, 100);
    await check('mismatched release evidence never frees a seat', async f => {
        f.state.invalidRelease = true;
        const old = await f.acquire(); await f.publish(old); old.abort();
        const next = await f.acquire(), pending = f.publish(next);
        old.release();
        await assert.rejects(pending, error => error.code === 'seat_unknown');
        assert.equal(f.state.reserves.length, 1);
        assert.equal(f.state.routes.length, 1);
    });
})().catch(error => { console.error(error); process.exitCode = 1; });
