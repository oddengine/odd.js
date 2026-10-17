# CALL v1

Requires paired odd.d Messaging/Calls and odd.x IM/Calls, business migration 020,
Stage, reliable room Events/Baseline, v2 media admission and allocation receipts.
Migration and services are not started by the SDK. Rebuild the source bundles
through the normal release workflow; this source delivery does not update release/.

Use the existing account session and media credential endpoints over HTTPS.
The IM example enables calls when `/session` advertises `im.calls`; the WebSocket
handshake must separately advertise `callVersion: 1`. No URL, password or signing
key is embedded in CALL data.

```javascript
await im.setup({
    url: imURL,
    credentials: imCredentials,
    storageFactory: function (identity) {
        return new odd.IM.IndexedDB(identity.scope, identity.userId, identity.deviceId);
    },
    calls: { enabled: true, rtc: { credentials: mediaCredentials } },
});
var call = await im.calls().invite({ type: 'user', id: peerID }, { mode: 'audio' });
// Fixed groups require explicit invitees; the default limit of 9 includes caller.
// im.calls().invite({ type: 'group', id: groupID }, { mode: 'video', invitees: userIDs });
await im.calls().end(call.callId);
```

`mediaCredentials(context)` uses the prepared `context.streamId` for both publish
and play. Request `/streams/{streamId}/credentials` with protocol, direction,
connectionId and generation. Do not create a second stream or grant for a call.
`roomId`, `callId` and `grantId` are context for the application, not authority.

`im.calls()` provides invite, accept, reject(id, allDevices), cancel, leave, end,
inspect, state, current and retry. `im.call('invite', target, options)` delegates to
invite; subsequent `im.call(action, callId, options)` uses the same durable path.
The former M=0 CALL placeholder is replaced. Direct raw reliable CALL requests
are rejected by the Core so they cannot bypass persistent operation IDs.

Listen to IMEvent.NOTIFY / IM_CALL_CHANGE. Payload kinds are calls (snapshot),
call-operation (applied/unknown/rejected/expired), calls-media, calls-error and
calls-gap. `applied` means the server operation was committed and applied under
its configured replica policy. Only media publication and current source boot
establish connected; ending continues until actual allocation release. Operation
replies contain the current snapshot and `operation: {id,revision,state}` for the
original decision. An expired result after uncertainty does not prove failure.

The caller ends the whole call; a callee leaves its own seat. Reject can affect
only this endpoint or all invited endpoints. The server atomically selects one
endpoint per invited user; devices connecting after the invitation cannot join
that old invitation. Only the original selected device can resume during recovery.
The device's selected call media owns a separate RTC instance. Closing it does
not close a live, game or conference RTC instance owned by the application.

IndexedDB v4 adds calls and callOutbox without replacing message/event stores.
At most 128 unresolved operations and 1024 call snapshots are retained, with
8 KiB operation and 32 KiB snapshot/page limits. Only ended snapshots are evicted.
Unknown operations retain their original bytes/ID across reconnect; storage or
quota failures never cause a false COMMIT. A compacted history emits calls-gap.
No offline push or permanent cloud history is promised.

IM.UI includes an independent call panel. Enable `calls`, provide optional
`calls.name(userId)` and `calls.members(groupTarget)` returning bounded explicit
`{id,name}` candidates, then use the conversation voice/video tools. App consumers
pass the same settings through their existing IM UI configuration.

Delivery: source review only; no build, syntax check, browser, service, migration
or runtime test was executed.
