# Reliable room events and gifts

R-045 adds source support. Release bundles are not rebuilt in this batch; do not
expect the existing release/example bundle to contain these APIs yet. No build,
test, browser or paid transaction was executed. The UI still uses its current
broadcast entry; this explicit source API example demonstrates the new profile.

Use the storageFactory and authenticated connection from [storage.md](storage.md).
IndexedDB version 3 preserves existing messages/outbox and adds room visits and
facts. Custom adapters need the methods listed below. Credentials, wallet access
secrets and IM signing keys are never persisted in the adapter.

```javascript
var im = odd.im.create();
await im.setup({
    url: configuredIMURL,
    credentials: credentialsProvider,
    storageFactory: function (identity) {
        return new odd.IM.IndexedDB(identity.scope, identity.userId, identity.deviceId, {
            maxEventRecords: 20000,
            maxEventBytes: 33554432,
        });
    },
    retry: { delay: 2000, count: -1 },
});

im.addEventListener(odd.events.IMEvent.MESSAGE, function (event) {
    var fact = event.data;
    if (fact.type === 'gift.confirmed') {
        showSavedGift(fact); // SDK dispatch occurs after a strict storage transaction
        if (fact.live) {
            showGiftEffect(fact); // UI policy; never an ACK or a billing operation
        }
    }
});

var room = { type: 'room', id: roomId };
var visit = await im.subscribe(room, { topic: 'events', messaging: true });
// New explicit join starts at the current barrier. Automatic reconnect resumes
// this visit. After a page reload, choose resume:true explicitly if still visiting.
var wallet = im.wallet(); // private display snapshot; decimal strings, not spending authority

// Catalog values come from your versioned business catalog, never a client price.
var id = odd.IM.Protocol.messageId(visit.partition, visit.partitions);
var gift = { giftId: catalogItem.id, count: 1, receiverId: hostUserId,
    catalogRevision: catalogItem.revision }; // exact {high, low} uint64 revision
try {
    var receipt = await im.gift(roomId, gift, { clientMessageId: id });
    // receipt.state=accepted means durable log acceptance, not all viewers saved it.
    // A locally recovered result may instead be committed/deliveryState=accepted.
} catch (error) {
    if (error.code === odd.IM.Protocol.Status.UNKNOWN) {
        var result = await im.inspectGift(roomId, id);
        // committed + pending/unresolved is a financial fact requiring delivery
        // or reconciliation. Do not replace id or automatically send another gift.
    } else {
        // Preserve the original ID. Only a definite business rejection proves
        // this operation did not debit; a later room-permission error does not.
        showGiftError(error);
    }
}



// Durable local history; packet data is a single typed fact record.
var records = await im.storage().roomEvents(visit.conversationId, visit.epoch, null, 64);
records.forEach(function (record) {
    var packet = odd.IM.Protocol.decode(record.packet);
    var fields = packet.fields[1].value;
    showStoredFact(fields);
});

await im.unsubscribe(room, { topic: 'events', messaging: true });
```

Register MESSAGE listeners before joining, as above, so there is no UI listener
gap. Stored history remains authoritative if the page closes
between storage completion and UI dispatch; UI callbacks are not exactly-once
execution. The SDK emits newly saved facts only once per visit storage position,
and applications can identify each fact by meta.messageId.

`im.recover()` uses the common outbox: inspect an original gift's financial
result first, settle definitive rejected/expired or delivery-accepted results,
and only retry a still-not-found intent if its room visit is active. Committed
pending/unresolved transactions remain queryable and are owned by the business
outbox. No gift-specific socket, reconnect loop or network ACK queue is created.
`inspectGift` needs an authenticated session but no current room subscription.

The normal send API still handles text/binary conversations. A gift only uses
M=1 room PUBLISH. The SDK's generic request cannot bypass event persistence with
an arbitrary COMMIT or FETCH. Ordinary room publish permission is not gift
permission; odd.x checks the current gift, price revision, room state and funds.
A zero/unavailable connection wallet does not prevent normal viewing/chat.

Room pages share server bytes. The SDK atomically saves facts and a contiguous
position, then batches COMMIT by the advertised interval/window. It persists the
returned signed cursor; losing an ACK response causes harmless deduplicated
replay. Idle cursor refresh uses the existing connection maintenance callback,
without SQL/Redis renewal. Unsupported event kinds, storage failure or conflicting
writer state are not acknowledged. A GONE resume or SubscribeStop(reason=gone)
is an explicit gap, requiring reconciliation or an explicit new visit; the SDK
does not silently discard the gap. Old gift animations expire independently of
retained financial facts.

| Adapter method | Contract |
|---|---|
| eventVisit(room) | Saved visit proof/stream/epoch and saved/confirmed exact positions, or null |
| beginEvents(room, value, previous, owner, resumed) | CAS the previous visit; store initial/resumed signed cursor before receipts |
| receiveEvents(room, owner, page, items) | Atomically save immutable facts/dedup and contiguous saved position; return newly saved item indexes |
| confirmEvents(room, owner, previous, cursor, through) | CAS receipt proof only through saved data; never move backwards |
| endEvents(room, owner) | End only this local writer's visit; preserve saved facts |
| roomEvents(stream, epoch, after, limit) | Bounded ordered local history, max 64 records/64 KiB |

The default event budget is 20000 records / 32 MiB. At most 128 expired records
are collected in one receive transaction. Live retained records are not deleted
to invent capacity; a full store stops acknowledgement. Application retention
and financial archives are separate. Each independent writer should use a
different authenticated device; concurrent tabs sharing one device can receive
an explicit storage conflict instead of skipping unsaved facts.

## R-046 public state snapshots

Use the matching odd.d R-046 protocol: events results add snapshot/snapshotReady.
The current Core API is `await im.roomState(roomId)`, returning
`{roomId, known, head, states}`. It returns known=false with no active visit;
an unavailable/closed reliable-events capability rejects. Connect and subscribe
to the reliable room event stream before reading a current state.

A local `room.snapshot` notification (`snapshot: true`) is emitted only after
snapshot and visit/cursor persistence. Existing notification delivery also emits
versioned room.state, media.resource and media.publication deltas. These are
public observations, never permission grants. View current media through roomState
or room.snapshot: R-056 uses lifecycle facts plus the current source boot view,
without a 60-second observation horizon. Raw historical facts remain immutable.

IndexedDB stays version 3 and extends existing visit records with states,
snapshotHead and snapshotReady. Custom storageFactory adapters must add
roomState(room), and atomically persist snapshot + H in beginEvents and state
projection + saved position in receiveEvents. roomState returns
`{owner, head, ready, states}` for that stored visit. On resume, still save/ACK
replayed gifts and facts, but apply state only above snapshotHead; otherwise old
replays could revive resources omitted from the complete current directory.
resource revoked removes both resource and publication projection. Never coalesce
gift facts. Storage failure cannot advance COMMIT. The default adapter limits
retained visits to 128 and public projection to 128 entries / 128 KiB JSON per visit.

M=0 room binary is now rejected; plain type=text is the legacy display/danmaku
path. Do not treat its extensions as authoritative gifts or permissions. The demo
UI has not been converted into a reliable-state product UI and release bundles
have not been rebuilt. No browser, runtime or functional testing was performed.

## R-048 room seats and free stage grants

Stage support starts at stateVersion 2; the SDK negotiates up to version 4 when
advertised by the connection. Custom adapters must save `value.stateVersion` in the
visit and refuse resume across versions. An old saved visit requires an explicit
new join after the application reconciles its state. `stage.policy` and
`stage.member` are saved by the same transaction before ACK; `ended` removes the
member from current projection. No approval requests or private reasons are in
these public events. Native encoded snapshots are bounded at 60 KiB; the default
adapter allows 128 KiB JSON to account for the decoded representation.

Provide `roomRequest({method, path, body})` in setup options. The provider prefixes
the business API base URL, supplies the existing authenticated session/Origin,
checks HTTP status and rejects with the original business code/message. It must
not turn an HTTP failure into a successful result. It owns no additional IM socket.
The SDK exposes `stage`, `saveStage`, `requestStage`, `stageGrant`, `endStage`;
all require a connected stateVersion-2 server and the provider.

```javascript
// Supply this alongside credentials/storageFactory in im.setup(...).
var roomRequest = function (operation) {
    return authenticatedBusinessRequest(operation.path, operation.method, operation.body);
};

var state = await im.stage(roomId); // implicit closed / 9 / revision "1"
await im.saveStage(roomId, { mode: 'free', capacity: 9,
    allowedActions: ['audio', 'video'], expectedRevision: state.policy.revision });

// Persist intent before sending. On timeout, resend this exact object.
var intent = { requestId: crypto.randomUUID(), requestedAt: String(Date.now()),
    actions: ['audio', 'video'] };
await saveStageIntent(roomId, intent);
try {
    var grant = await im.requestStage(roomId, intent);
    if (grant.state === 'reserved' || grant.state === 'in-use') {
        var stream = await authenticatedBusinessRequest('/rooms/' + roomId + '/streams', 'POST', {
            requestId: savedStreamRequestId, stageGrantId: grant.id,
            purpose: 'camera', audio: true, video: true,
        });
        // Pass this resource to the existing RTC/media credentials provider.
        // Do not create a publisher until the business grant/resource succeeds.
    }
} catch (error) {
    showStageError(error.code, error.message); // room_full / seats_occupied are explicit hints
}

var ending = await im.endStage(roomId, savedGrantId);
// ending is not release proof. Observe M=1 or stageGrant until state=ended.
// Explicitly end stage before leaving the business room / unsubscribing events.
```

Nine counts people, including the host: the same person's camera and screen share
one seat. Direct role publishers still reserve automatically and cannot bypass
capacity. Lowering the room limit does not evict occupied seats; end those grants
first. The stage directory is a public observation, not permission to use another
user's grant. Extra grants default to 30 minutes, with no automatic reconnect or
renewal. Retain original IDs to recover uncertain outcomes; the SDK does not
silently start a new attempt. RoomRequest results from an obsolete IM connection
reject with AbortError, which does not mean a server mutation was cancelled.

Only SDK source and this usage document changed; no demo UI, release build,
browser or runtime test was produced. [中文业务契约](https://github.com/oddengine/odd.x/blob/main/docs/stage.zh-CN.md).

## R-049 private stage applications

The same roomRequest provider now exposes `stageRequests(room, options)`,
`stageRequest(room, applicationId)`, `decideStage(room, applicationId, decision)`
and `cancelStage(room, applicationId)`. Options are `{limit: 50, cursor: '',
all: false}`; `all: true` is the manager's pending queue, otherwise only the
caller's own applications are listed. Results are `{items, cursor}` with a maximum
page size of 100. Refresh a new scan for later arrivals. There is no SDK polling
loop: query active views with bounded pages/backoff, stopping on close or terminal
result. Public seat updates continue on the reliable stream.

```javascript
var state = await im.stage(roomId);
await im.saveStage(roomId, { mode: 'apply', capacity: 9,
    allowedActions: ['audio', 'video'], expectedRevision: state.policy.revision });

// Applicant: save this intent before POST, then retain the returned application ID.
var intent = { requestId: crypto.randomUUID(), requestedAt: String(Date.now()),
    actions: ['audio', 'video'] };
await saveStageIntent(roomId, intent);
var application = await im.requestStage(roomId, intent);
await saveStageApplication(roomId, application);

// Manager, in a separate authenticated session:
var page = await im.stageRequests(roomId, { all: true });
var pending = page.items[0]; // UI chooses an existing pending item.
if (pending) {
    var decision = { decision: 'approve', expectedRevision: pending.revision,
        actions: ['audio'] }; // May narrow, never widen the requested permissions.
    await saveStageDecision(roomId, pending.id, decision);
    await im.decideStage(roomId, pending.id, decision);
}

// Applicant: on an uncertain result, query the same ID or repeat the original POST.
application = await im.stageRequest(roomId, application.id);
if (application.state === 'approved') {
    var grant = await im.stageGrant(roomId, application.grantId);
    // Use grant.actions / startDeadline / expiresAt for resource creation.
    // application.expiresAt is only the earlier approval deadline.
} else if (application.state === 'pending') {
    // Explicit user cancellation only; it cannot undo an already-approved grant.
    // await im.cancelStage(roomId, application.id);
}
```

The POST result remains the original application/grant across room mode changes.
Never treat HTTP success as approval without inspecting state; expired decisions
can return `expired`. Reuse the exact saved decision after timeout. A changed
decision or expectedRevision conflicts; use the detail query to reconcile it.
Approval can return `room_full` while the application remains pending. Applications
default to 60 seconds and consume no seats before approval. A pending list may
briefly contain due items; the server always checks the deadline before approval.
Private reasons and applicants are not broadcast as room events. No UI or release
bundle was rebuilt; these are source-level APIs and integration examples.

R-051 introduced stateVersion3 for presentation roles. Old v2 visits
require an explicit new visit; their saved cursor is not silently reused. Add
`speakers:true` to an events subscription only when short-lived speaker ordering
is wanted. It uses M=0 observations and in-memory `roomSpeakers`, independently
of reliable saved facts and ACKs. See [RTC speaker integration](../rtc/speakers.md).

## R-056 event-driven media state

Upgrade the server, all reliable routing nodes and SDK together to stateVersion 4.
Older saved visits require an explicit new join after reconciliation; their saved
cursors are not silently reused or discarded. IndexedDB remains version 3 and
the custom adapter interface is unchanged.

`reserved` means the publication's outbox slot is admitted; `starting` means its
protocol has activated; `active` means the first non-configuration audio or video
frame arrived. It does not guarantee a decodable video keyframe or all tracks.
Actual close, failure, grant expiry or protocol timeout produces terminal state.
Quiet/long-running streams do not expire by observation age. `payload.validUntil`
is retained on the wire with value zero for new lifecycle facts.

The SDK combines saved facts with source identities from M=1 `event-origins`
notifications on the same authorized subscription. These carry room epoch, a
feed-local revision and the current confirmed nodeId/bootId pairs. They stay in
connection memory and do not advance event COMMIT or create offline history.
Unavailable/replaced sources show `unknown`; same-boot reconnection can restore
the view, while a new boot cannot revive old publications. Unknown is not a seat
release or permission decision. Room/resource generations continue to apply.

`room.snapshot` is emitted after saved lifecycle changes and source identity
changes. Leaving emits an invalid view; connection CLOSE invalidates the whole
visit. `roomState` without an active visit returns known=false. A new SDK connected
to an old server has no source identity evidence and conservatively shows unknown
nonterminal media views. There is no polling fallback. Gift persistence/ACKs and
M=0 speaker expiry are unchanged. Only source review was performed; no release
bundle, build, browser or runtime validation was produced.
