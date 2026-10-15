# Protected native HLS example

Use the source build of Player with SRC on a browser that supports native HLS.
Replace both route roots with your configured deployment; the stream resource
must already exist and its publisher must be active. The backend session cookie
and media session cookie belong to their respective hosts. The media server must
allow this exact page Origin and enable the corresponding private DVR format.

```javascript
var streamId = '11111111-1111-4111-8111-111111111111';
var player = odd.player();
player.setup(container, {
    mode: 'live',
    credentials: async function (context) {
        var response = await fetch('/api/v1/streams/' + context.streamId + '/credentials', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            signal: context.signal,
            body: JSON.stringify({
                protocol: context.protocol,
                direction: context.direction,
                format: context.format,
                connectionId: context.connectionId,
                generation: context.generation,
            }),
        });
        if (!response.ok) {
            throw { name: 'NotAllowedError', message: 'Playback credentials were rejected.' };
        }
        return response.json();
    },
    playlist: [{
        type: 'SRC',
        sources: [{
            streamId: streamId,
            url: 'https://media.example.com/live/hls/' + streamId + '/v2/index.m3u8',
        }],
    }],
});
```

With credentials.version=2, the SDK directly loads the manifest with ?access=token.
It does not create or renew a server playback session. It obtains a new signed
URL at 75% of the access window; replacing the native media URL may interrupt
playback continuity. An external DASH client similarly requests DASH credentials
and loads credentials.url + '?access=' + credentials.token, replacing it before
playbackUntil. Child URLs carry the proof. No new DASH player is bundled.

The following playback-session instructions apply only to credentials.version=1.
The callback is used again for renewal with the same connectionId and generation;
do not create a new logical attempt for each fragment or renewal. Stop/destroy
ends the permission. Use a new playback attempt after expiry or rejection.

For an external DASH player, request protocol DASH / format cmaf, POST the short
Bearer to the configured stream's `/sessions`, and load the returned MPD URL
with credentials enabled. PATCH the returned sessionUrl with a fresh Bearer and
the existing cookie before expiresAt. DELETE it on exit. Clients unable to send
cookies can POST with `?transport=query` and use the returned URL; the same proof
is propagated into child URLs. This is an integration contract, not a bundled
DASH player, and was not exercised in a browser in this iteration.
