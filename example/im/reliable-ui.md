# Reliable message UI / 可靠消息界面

R-058 connects IM.UI, App's embedded IM UI and the source examples to the existing
Messaging / Events storage path. Release bundles are not rebuilt. Source review
only: no build, lint, tests, browser run, service start or deployment was performed.

Private contacts and fixed groups resolve to canonical conversations, subscribe
with publish/receive/commit/read permissions and send M=1. Room ordinary text stays
M=0; the room's state, stage, media and gift facts come from its M=1 event visit.
IM.UI supplies IndexedDB by default. An explicit null factory disables reliable
conversations; the Core IM default remains unchanged.

## Visible states

| Label | Evidence |
|---|---|
| Sending | A local send is running; this is not an acceptance receipt |
| Accepted by server | Existing server commit/apply policy accepted responsibility |
| Delivery complete | Existing server delivery responsibility completed; no human-read claim |
| Delivery responsibility completed | Group responsibility completed or was released; not every member received/read |
| Saved on this device | Reliable receive transaction finished; UI rendering is not COMMIT |
| Read by this account | Explicit READ was confirmed or the server synchronized this account's shared READ |
| Result unknown | Original request has no confirmed outcome; retain its identity |
| Not sent | This UI attempt failed before it entered the durable outbox |
| Rejected / Permission withdrawn / Expired | Persisted terminal result; expiration alone cannot prove a formerly unknown operation never ran |
| Gift transaction confirmed; delivery pending | Inspect of the original gift confirms its transaction but not accepted message delivery |

Retry uses the stored canonical request and original clientMessageId. Gift retry
runs the existing recover/inspect path first, so unknown payment never creates a
replacement gift ID. If storage itself is unreadable, show uncertainty and retain
the visible text; do not offer an unsafe new-ID retry. Gift request status and
confirmed room gift records are distinct presentations. Replaying local history
never triggers payment or animations.

## History, unread and read

“Earlier local history” reads saved messages and outbox pages. Each read is bounded
and the visible window holds at most 200 messages. “Refresh saved messages and
results” uses the existing coalesced recover pass, then reads local data. It does
not add periodic message or media polling. A new device only recovers bodies still
available under the server's responsibility/retention policy. Expired ranges and
unknown room state are shown; a server receipt does not promise permanent history.

“Mark loaded messages read” is an explicit action in a visible page. It uses the
last loaded incoming saved message, refreshes READ permission and advances the
local read lower bound only after READ succeeds. Opening a conversation, loading
history, receiving a background push and saving/COMMIT never send READ. This is an
account read position; no counterpart read indicator is invented. Unread is a
boolean from incoming > read, not head minus read or a fabricated count.

A directory page contains canonical conversation IDs, not original peer/group
names. A locally resolved contact preserves its target/name; otherwise display the
canonical identifier. Calls still require a real user/group target. Room snapshots
have no sender and render separately from chat bubbles.

## Integration and ownership

`Conversation.active(id, contact)` remains synchronous selection; `open(id, contact)`
returns the asynchronous open result, and `ready()` returns the current open promise.
The bundled examples await that promise instead of creating a second room subscription.
Contact metadata uses the existing `people`, `group`, `channel` types; a canonical
entry uses `conversation` and may carry a validated local `target` for calling.

The Conversation plugin owns its active subscriptions by default, releases them
on switching/destroy and ignores stale display results. Do not share the same
subscription with another owner: Core subscriptions are not reference counted.
An integration that owns subscriptions can set `manageSubscriptions: false` in the
Conversation plugin and establish/remove the required M=1/M=0 topics itself. The
UI still obtains publish/read permission; room history uses the existing visit
and snapshot and never creates or removes that external visit.

IndexedDB v5 preserves v4 CALL stores; see [storage.md](storage.md). Endpoint URLs,
admission credentials and database identity continue to come from existing setup
providers. This UI adds no server database, cache, token registry or media checks.

R-086 的独立云历史、实际显示证据及中文阅读面板见[有限云历史与公开阅读](history.md)。历史保存不推进可靠确认或私人 READ。
