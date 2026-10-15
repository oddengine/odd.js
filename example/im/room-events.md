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
