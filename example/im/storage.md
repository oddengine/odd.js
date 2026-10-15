# Reliable messaging / 可靠消息

E08a now connects the M=1 server source, durable SDK storage, receive COMMIT and
reconnection recovery. Release bundles have not been rebuilt. No build, tests,
browser run or deployment has been performed.

E08a 已接通服务端与 SDK 的可靠消息源码。release 未重建；本轮未编译、测试、运行浏览器或部署。

## Enable durable storage / 启用持久存储

```javascript
var im = odd.im.create();
await im.setup({
    url: 'wss://im.example.com/im',
    credentials: credentialsProvider, // existing short-lived admission provider
    storageFactory: function (identity) {
        return new odd.IM.IndexedDB(identity.scope, identity.userId, identity.deviceId);
    },
    connectTimeout: 120000,
    requestTimeout: 120000,
    retry: { delay: 2000, count: -1 },
});

var resolved = await im.resolve({ type: 'user', id: recipientUserId });
// A fixed group uses { type: 'group', id: groupId } instead.
var target = { type: 'conversation', id: resolved.conversationId };
var actions = odd.IM.Protocol.Action;
await im.subscribe(target, {
    messaging: true,
    actions: actions.MESSAGE_SUBSCRIBE | actions.MESSAGE_COMMIT |
        actions.MESSAGE_READ | actions.MESSAGE_PUBLISH,
});
await im.send(target, 'Hello', { messaging: true });
// Only when the user actually reads a received message:
await im.read(target.id, received.meta.messageId, received.meta.messageSequence);
```

Storage is optional for M=0 and required for M=1. Its identity comes from the
server-authenticated principal/device and CONNECT_SUCCESS.ext.scope. The adapter
must return that same namespace from identity(). Each reconnect creates a fresh
adapter object. No token, admission proof or secret is persisted.

M=0 不需要存储适配器，M=1 必须配置。命名空间来自服务端确认的 scope、用户和设备；每次
重连新建适配器，不能把旧账户的存储用于新身份。不保存 token、准入证明或私钥。较大固定群
首次恢复可能较慢，示例显式放宽连接／请求期限；服务端仍受其基线期限及授权有效期限制。

IndexedDB writes require `durability: 'strict'` and resolve only on transaction
completion. Unsupported storage, quota exhaustion, blocked upgrades and aborted
transactions fail explicitly. The adapter admits at most 32 outstanding storage
operations. Database version 3 preserves version 1/2 outbox, messages, positions and terminal
ranges, and adds room event visits/facts plus a pending-outbox index. See
[room-events.md](room-events.md) for the distinct room responsibility profile.

IndexedDB 写事务要求 strict 持久性，完成事件才兑现 Promise。存储不足或失败时不会 COMMIT；
连接关闭会终止未完成事务，迟到回调不能继续确认。v3 保留已有消息及终止范围，新增房间事件／访问证明和待发送索引。

## Sends, receives and recovery / 收发与恢复

RESOLVE supplies partition/partitions. `send` generates one secure UUIDv7 with the
partition profile, saves the canonical PUBLISH with SN=1, and only then sends it.
An explicit clientMessageId must already match that profile and is never rewritten.
Use the same ID/content to retry; unknown outcomes remain in the outbox. Expired,
conflicting or invalid identities are not silently replaced with a new send.

发送先 RESOLVE，使用安全随机数生成与分区绑定的 UUIDv7，保存规范报文后发出；调用者提供的
ID 只能验证，不能自动改写。网络结果未知时保留原 ID 和正文；过期或冲突需要应用明确处理。
不要把 UNKNOWN 当失败后重新调用一个没有原 ID 的 send，否则那是一次新的发送意图。

A reliable subscription receives bounded storage pages. The SDK checks packet
identity, atomically stores bodies/dedup/terminal ranges/cursor, then sends COMMIT
on the same connection generation. Message events follow this path. A disconnect
can cause duplicate events; applications identify messages by messageId. Saved
messages remain available through `im.storage().messages(conversationId, after,
limit)`, where after is an exact `{high, low}` sequence and limit is 1–64. The
returned packet is decoded with `odd.IM.Protocol.decode(record.packet)`.

可靠订阅收到分页数据后，SDK 核对消息身份，将正文、去重、终止范围和游标同事务保存，再在
原连接代际提交 COMMIT。消息事件可能因断线重投而重复，应用以 messageId 去重。落盘后即使
页面关闭，也可用 messages 方法按序读取正文。READ 只由业务的明确阅读动作触发。

`fetch(conversationId, cursor, limit)` uses the same persistence/COMMIT path.
`commit('messages', cursor)` only retries a cursor this SDK instance has already
saved; it cannot acknowledge arbitrary bytes. Serialize explicit FETCH and a live
subscription to the same conversation: one live page owns its acknowledgement
window. Prefer the subscription for continuous delivery and FETCH when it is
not subscribed.

fetch 同样会落盘后确认；commit 只允许重试本实例已经保存的页，不允许制造假确认。一个会话
使用订阅持续接收，或在未订阅时显式 fetch，避免两个读取者争用同一个设备的连续确认窗口。

Reconnect restores existing subscription intentions, performs a bounded-page
conversation pass, retries pending outbox entries in order with their original
IDs, and synchronizes delivery results. `im.recover()` repeats that pass explicitly
and coalesces concurrent callers. Transient errors are surfaced; they do not
invent success or a replacement identity. On a new device, use conversations()
and subscribe to the conversations the application needs; the SDK does not open
every account conversation automatically.

重连恢复已有订阅意图，并分页同步会话、重发原 ID 的待定发送、同步结果。recover 可显式重试
恢复，多个调用合并执行。新设备由应用读取 conversations 并选择订阅，不自动打开所有会话。
新设备只取得用户尚未接收且未过期的正文，不保证恢复已确认回收的历史或发送者其他设备正文。

`conversations` and `sync('conversations'/'results')` are full bounded projection
passes, not change-log offsets. Continue while hasMore; the final nextCursor is
empty. Start each new pass empty. Changes to keys already visited appear in the
next pass. Results include accepted/delivered/settled/expired/revoked; group
settled means responsibilities completed or released, not that all members read
or received the body. Results expire with the server retry retention window.

会话／结果同步是有界分页全量投影。hasMore 为真时继续，最后游标为空；新一轮从空游标开始。
已遍历键的并发更新在下轮可见。固定群 settled 不是所有原成员送达或已读证明；结果有保留窗口。

## Adapter contract / 适配器契约

| Method | Durable contract / 持久契约 |
|---|---|
| identity(), open(), close() | Fixed scope/user/device; close aborts pending operations. 固定身份，关闭终止在途事务 |
| enqueue(id, packet) | Canonical immutable outbox before send; changed bytes conflict. 发送前保存，同 ID 异内容冲突 |
| pending(limit, after?) | At most 64 records / 256 KiB; after is the previous record's hex id. 有界发送箱分页 |
| settle(id, state, outcome?) | Known result only; preserves previous outcome if absent. 不将未知结果写成成功 |
| receive(conversation, items, cursor, previous) | Bodies, terminal ranges, dedup and cursor in one strict transaction. 同事务保存 |
| position(kind, id) | Persisted opaque cursor or empty bytes. 游标按不透明字节保存 |
| synchronize(items, cursor, previous) | Conversation revision, READ/head/incoming positions and cursor atomically. 保存共享已读及会话进度 |
| messages(conversation, after, limit) | Read durable local packets in sequence order. 有界读取本地正文 |

Normal receive items carry kind=message, messageId, messageSequence, packet;
terminal items carry kind=expired, first, last. All sequences are exact high/low
uint32 words. Cursor updates use compare-and-swap against previousCursor to
reject conflicting tabs/late operations. Use a distinct device identity per
independent writer; sharing one device between tabs may close a conflicting
connection rather than skip unsaved data.

正文项与终止范围项均随游标落盘，64 位序号使用 high/low，不转为有损浮点数。多个独立写入者
应使用不同设备身份；同设备多页签争用可能拒绝或关闭冲突连接，不能跳过未保存的数据。

Local history cleanup is application policy and is not automatic here. Storage
quota failure stops reliable receiving instead of deleting unacknowledged data.
Server TTL/physical collection and replication are separate concerns; see the
odd.d reliable-messaging document for node limits and the single-replica boundary.
