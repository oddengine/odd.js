(async function () {
    var checks = [], sessions = [], originalFetch = window.fetch;
    function assert(value, name) { if (!value) { throw new Error(name); } checks.push(name); }
    async function rejects(action, name, message) {
        try { await action(); } catch (error) { assert(error.name === name, message); return; }
        throw new Error(message);
    }
    try {
        // Match the node's rolling SegmentList with absolute media timestamps.
        var xml = '<MPD type="dynamic" minimumUpdatePeriod="PT1S"><Period id="source">' +
            '<AdaptationSet mimeType="video/mp4"><Representation id="video" codecs="avc1.42E01E" bandwidth="800000">' +
            '<SegmentList timescale="90000" presentationTimeOffset="900000"><Initialization sourceURL="gen/video/init.mp4"/>' +
            '<SegmentTimeline><S t="1080000" d="180000" r="1"/></SegmentTimeline>' +
            '<SegmentURL media="gen/video/1.m4s"/><SegmentURL media="gen/video/2.m4s"/>' +
            '</SegmentList></Representation></AdaptationSet></Period></MPD>';
        var base = 'https://media.test/live/dash/stream/index.mpd?playback=opaque';
        var mpd = odd.utils.MPD.parse(xml, base, function () { return true; });
        assert(mpd.tracks[0].segments[0].time === 2 && mpd.tracks[0].offset === -10, 'DASH media timestamps align to presentation time');
        assert(mpd.tracks[0].segments[1].time === 4 && mpd.tracks[0].segments[1].duration === 2, 'DASH repeated timeline expands without losing duration');
        assert(mpd.tracks[0].initialization.endsWith('/gen/video/init.mp4?playback=opaque'), 'DASH initialization inherits the local lease');
        assert(mpd.tracks[0].segments[0].url.endsWith('/gen/video/1.m4s?playback=opaque'), 'DASH segment inherits the local lease');
        await rejects(function () { odd.utils.MPD.parse(xml.replace('r="1"', 'r="1000000"'), base); }, 'DataError', 'DASH expansion is bounded');
        await rejects(function () { odd.utils.MPD.parse(xml.replace('<S t="1080000" d="180000" r="1"/>', '<S t="1080000" d="180000"/>'), base); }, 'DataError', 'DASH rejects mismatched timeline and object counts');
        await rejects(function () { odd.utils.MPD.parse(xml, base, function () { return false; }); }, 'NotSupportedError', 'DASH rejects unsupported codecs');

        for (var protocol of ['HLS', 'HLS-2nd', 'DASH']) {
            var stream = crypto.randomUUID(), endpoint, credential, requests = [], provided = 0;
            window.fetch = async function (url, options) {
                requests.push({ url: String(url), method: options.method, headers: options.headers });
                if (options.method === 'POST') {
                    credential = options.headers['Odd-Media-Instance'] + '.' + crypto.randomUUID() + crypto.randomUUID();
                    return new Response(JSON.stringify({ credential: credential, expiresAt: Math.floor(Date.now() / 1000) + 60,
                        url: endpoint + '?playback=' + credential,
                        sessionUrl: 'https://media.test/live/' + stream + '/sessions?playback=' + credential }));
                }
                return new Response(new Uint8Array([1, 2, 3]));
            };
            var session = new odd.utils.PlaybackSession({ timeout: 2000, credentials: async function (context) {
                provided++;
                endpoint = 'https://media.test/live/' + stream + ({ HLS: '/v1/index.m3u8', 'HLS-2nd': '/v2/index.m3u8', DASH: '/index.mpd' })[context.protocol];
                return { product: 'live', token: 'user-jwt', connectBefore: Math.floor(Date.now() / 1000) + 60,
                    generation: '1', appId: crypto.randomUUID(), channelAppId: crypto.randomUUID(), nodeId: 'node',
                    bootId: crypto.randomUUID(), streamId: stream, instanceId: context.instanceId,
                    subscriptionTicket: 'signed-subscription', relayInstanceId: '', url: endpoint };
            } });
            sessions.push(session);
            await session.open({ protocol: protocol, streamId: stream });
            assert(requests[0].headers.Authorization === 'Bearer user-jwt' && requests[0].headers['Odd-Media-Subscription'] === 'signed-subscription', protocol + ' opens with identity and subscription proof');
            var segment = 'https://media.test/live/' + stream + '/gen/1.m4s?playback=' + credential;
            await session.read(segment, 100);
            assert(requests[1].headers === undefined && !requests[1].url.includes('user-jwt'), protocol + ' object reads do not expose the identity token');
            var count = requests.length;
            await rejects(function () { return session.read(segment.replace('media.test', 'other.test'), 100); }, 'SecurityError', protocol + ' denies a different origin');
            await rejects(function () { return session.read(segment.replace('/' + stream + '/', '/other/'), 100); }, 'SecurityError', protocol + ' denies another stream');
            await rejects(function () { return session.read(segment.replace(credential, 'other'), 100); }, 'SecurityError', protocol + ' denies a different lease');
            assert(requests.length === count && provided === 1, protocol + ' invalid reads do not fetch or reallocate');
            await rejects(function () { return session.read(segment, 2); }, 'QuotaExceededError', protocol + ' limits object size');
            session.close(); session.close();
            assert(requests.filter(function (r) { return r.method === 'DELETE'; }).length === 1, protocol + ' releases once');
            await rejects(function () { return session.read(segment, 100); }, 'AbortError', protocol + ' rejects reads after close');
        }
        window.testResult = { passed: true, checks: checks };
    } catch (error) { window.testResult = { passed: false, checks: checks, error: error.message || String(error), stack: error.stack }; }
    finally { sessions.forEach(function (session) { session.close(); }); window.fetch = originalFetch; }
    document.getElementById('result').textContent = JSON.stringify(window.testResult, null, 2);
})();
