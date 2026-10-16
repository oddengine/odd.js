# Room speakers and microphone levels

R-051 adds source support; no browser, build or test was run. Load
`im.indexeddb.js`, `im.speakers.js`, `im.events.js`, `im.messaging.js` after the IM
protocol/request sources (see `compile.sh`), and the existing RTC UI/controlbar
sources and `odd.rtc.classic.css`. Release bundles are not regenerated.

Configure the existing authenticated IM client with `storageFactory` and
`roomRequest`, and obtain media resources/permissions through your business
service. The server must advertise `stateVersion=3,speakersVersion=1`. Speaker
observations are optional; ordinary chat does not subscribe to them by default.

```js
await im.subscribe({ type: 'room', id: roomId }, {
    topic: 'events', messaging: true, speakers: true,
});
// Read synchronously: this is the visit's current memory view, not IndexedDB.
var snapshot = im.roomSpeakers(roomId);
rtcUI.speakers(snapshot, [{
    resourceId: resource.id,
    publisherGeneration: resource.publisherGeneration, // exact decimal string
    netStream: ns, // the actual NetStream returned by this UI's call()/play()
    purpose: resource.purpose,
}]);
```

Use `speakers.js` as an optional adapter to update the UI from both reliable room
changes and `IM_SPEAKERS_CHANGE` notifications, clear on disconnect and unsubscribe
on leaving. Call `adapter.update(currentBindings)` after resource/stream changes;
call `adapter.close()` before disposing the room UI. A new stream generation needs
a new mapping. The helper does not publish media or reconstruct expired grants.
For Player or Famicom sessions, compose the same RTC UI in the host's companion
call area and pass its real streams; the media player/game and any legacy Chat
plugin are not silently replaced. The App's meeting module is already an RTC UI.

`roomSpeakers` returns `roomId, known, complete, epoch, sequence, validUntil,
priority, items`. Integers that can exceed JS precision are decimal strings.
`priority` contains current owner/host/anchor/presenter identities from saved M=1
state even when `known=false`. Items resolve resource identities through that
same directory, exclude screen resources and merge a person's main streams.
`observedAt` is a local monotonic timestamp and item `validFor` is the remaining
milliseconds at that timestamp; forward the snapshot unchanged so a delayed UI
callback cannot extend the audio observation. These values are not permissions.

The owner is first, followed by designated hosts, anchors and presenters; each
fixed group is stable by seat/user. Ordinary participants follow the server's
smoothed order. Fixed participants stay in front when silent or when all M=0
updates are lost. Missing audio is unknown, not a synthetic zero. Sharing remains
a content area; audio from a screen does not compete for a person slot. The UI
changes CSS order and emphasis without restarting any NetStream.

```js
await im.setStagePresentation(roomId, grant.id, {
    presentation: 'presenter', // '', host, anchor or presenter
    expectedRevision: grant.revision,
});
```

This needs current `room.stage.manage`; it never grants media permission. On an
unknown HTTP result, inspect the original grant before making another decision.
A conflict requires reviewing the current revision, not blindly retrying.

`AudioMeter.measure()` and `NetStream.measureAudio()` return
`{state: 'live'|'muted'|'unavailable', value: number|null}`. The existing `volume()`
still returns 0–100. RTC UI fills the existing microphone silhouette in its controlbar and participant
overlays at at most 25 Hz while visible, retiring overlays/animation/listeners
with their streams or UI. Independent remote tracks use the same measurement API; a mixed track cannot provide individual
participant levels. No level is uploaded or used as authority. A silent remote
track is not proof that its user pressed mute.

M=0 snapshots have no receipt, replay or durable history. Each item expires at
its original sample deadline, and the snapshot has its own deadline. The SDK
waits for the saved M=1 basis head, ignores another subscription/epoch/generation,
and uses the conservative server-time bound from SUBSCRIBE/REFRESH. High RTT,
clock jumps and visibility resume clear audio until the time basis is refreshed.
Recovery is coalesced to one request per room per 10 seconds on the existing
connection; a v2 saved visit requires explicitly joining a new v3 visit.
