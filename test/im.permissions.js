// Exercise the real SDK, codec, request table and IndexedDB over a deterministic
// WebSocket adapter. The node replaces each requested channel permission grant.
(async function () {
    const P = odd.IM.Protocol, T = P.Type, A = P.Action, O = P.Opcode;
    const app = crypto.randomUUID(), device = crypto.randomUUID();
    const target = { type: 'conversation', id: 'c-' + 'a'.repeat(64) };
    const field = (key, type, value) => ({ key, type, value });
    const u64 = n => ({ high: Math.floor(n / 4294967296), low: n >>> 0 });
    const dest = [field('type', T.STRING, target.type), field('id', T.STRING, target.id)];
    const expires = u64(Date.now() + 60000), requests = [], checks = [];
    let socket, grant = 0, revision = 1, denied = 0, simultaneous = 0, peak = 0;
    const im = odd.IM.create();
    function assert(value, label) { if (!value) throw new Error(label); checks.push(label); }
    function notify(event, data, messaging = true) {
        socket.onmessage({ data: P.encode({ opcode: O.NOTIFY, sequenceNumber: 0, messaging,
            fields: [field('event', T.UINT16, event), field('data', T.OBJECT, data)] }).buffer });
    }
    try {
        await im.setup({ appId: app, profile: 'channel', deviceId: device, url: 'ws://localhost/im',
            credentials: async () => ({ ticket: 'test' }),
            storageFactory: identity => new odd.IM.IndexedDB(identity.appId, identity.userId, identity.deviceId),
            socketFactory: () => {
                socket = { readyState: 1, bufferedAmount: 0, protocol: 'odd.im.v3', close() { this.readyState = 3; },
                    send(bytes) {
                        const request = P.decode(bytes), actions = request.fields.find(f => f.key === 'requestedActions').value.low;
                        requests.push(actions); peak = Math.max(peak, ++simultaneous);
                        setTimeout(() => {
                            simultaneous--;
                            if (socket.readyState !== 1) return;
                            const code = actions & denied ? P.Status.FORBIDDEN : P.Status.OK;
                            let info = [];
                            if (!code) {
                                grant = actions;
                                if (request.opcode === O.SUBSCRIBE) info = [field('subscriptionId', T.STRING, 'subscription'),
                                    field('target', T.OBJECT, dest), field('cursor', T.UINT64, u64(0))];
                                info.push(field('authorizationId', T.STRING, target.id), field('revision', T.UINT64, u64(revision)),
                                    field('generation', T.UINT64, u64(1)), field('expiresAt', T.UINT64, expires), field('actions', T.UINT64, u64(grant)));
                            }
                            socket.onmessage({ data: P.encode({ opcode: O.STATUS, sequenceNumber: request.sequenceNumber,
                                messaging: true, fields: [field('code', T.UINT8, code), ...(code ? [] : [field('info', T.OBJECT, info)])] }).buffer });
                        }, 20);
                    } };
                setTimeout(() => {
                    socket.onopen();
                    notify(P.Event.IM_CONNECT_SUCCESS, [field('sessionId', T.BYTES, new Uint8Array(16)),
                        field('principal', T.OBJECT, [field('kind', T.UINT8, 1), field('id', T.STRING, 'tester')]),
                        field('deviceId', T.STRING, device), field('authRevision', T.UINT64, u64(1)),
                        field('expiresAt', T.UINT64, expires), field('protocolVersion', T.UINT8, 3),
                        field('serverVersion', T.STRING, 'test'), field('maxPacketBytes', T.UINT32, P.MAX_PACKET_SIZE),
                        field('maxPending', T.UINT16, 64), field('ext', T.OBJECT, [field('appId', T.STRING, app),
                            field('messaging', T.BOOL, true), field('events', T.BOOL, false), field('stateVersion', T.UINT16, 5),
                            field('profile', T.STRING, 'channel'), field('product', T.STRING, 'im'),
                            field('messagesVersion', T.UINT16, 1), field('messageDelivery', T.STRING, 'reliable')])], false);
                }, 0);
                return socket;
            } });
        const receiving = A.MESSAGE_SUBSCRIBE | A.MESSAGE_COMMIT;
        await im.subscribe(target, { messaging: true, actions: receiving });
        await Promise.all([im.refresh(target, A.MESSAGE_PUBLISH, true), im.refresh(target, A.MESSAGE_READ, true)]);
        assert(grant === (receiving | A.MESSAGE_PUBLISH | A.MESSAGE_READ), 'send and read retain subscription and commit');
        assert(peak === 1 && requests.length === 3, 'concurrent additions serialize on the resource');
        await im.refresh(target, A.MESSAGE_PUBLISH, true, true);
        assert(grant === (receiving | A.MESSAGE_PUBLISH | A.MESSAGE_READ), 'forced refresh preserves live actions');
        denied = A.MESSAGE_PUBLISH; revision++;
        notify(P.Event.IM_PERMISSION_CHANGE, [field('target', T.OBJECT, dest), field('revision', T.UINT64, u64(revision)),
            field('generation', T.UINT64, u64(1)), field('actions', T.UINT64, u64(receiving)), field('reason', T.STRING, 'restricted')]);
        const rejected = await im.refresh(target, A.MESSAGE_PUBLISH, true).then(() => false, e => e.code === P.Status.FORBIDDEN);
        assert(rejected && requests.at(-1) === A.MESSAGE_PUBLISH, 'revocation discards old grant and checks the node again');
        assert(im.connected(), 'ordinary request rejection keeps the connection open');
        window.testResult = { passed: true, checks };
    } finally { im.destroy(); }
})().catch(error => { window.testResult = { passed: false, error: error.stack }; });
