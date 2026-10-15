# Reliable messaging storage foundation / 可靠消息本地存储基础

This is an intermediate E08a source component. The server still rejects M=1;
`IM.send`, incoming notifications and reconnect do not call this adapter yet.
It does not enable reliable chat or provide an automatic COMMIT path. Release
bundles have not been rebuilt. No build, test or browser verification was run.

这是 E08a 的中间源码组件。服务端仍拒绝 M=1，IM.send、接收通知及重连尚未接入该适配器；
不能据此认为可靠聊天已经可用。release 未重建，未编译、测试或运行浏览器。

## Identity and lifecycle / 身份与生命周期

```javascript
var storage = new odd.IM.IndexedDB(scope, userId, deviceId);
await storage.open();
// ... use this adapter only for that authenticated principal/device ...
storage.close();
```

The database name includes the scope, user and device. Never reuse the adapter
for another principal. Close aborts pending transactions and closes late open
results; a closed adapter cannot reopen. Read/write transactions require the
browser's `durability: 'strict'` support. Unsupported storage, quota failures,
blocked upgrades and aborted transactions reject their promises. At most 32
operations may wait for/open a transaction per adapter.

数据库按 scope、用户和设备隔离，不允许切换身份后复用同一实例。close 终止未完成事务，
迟到的打开结果也会关闭；关闭后需新建实例。写事务要求浏览器支持 strict 持久性，
不支持、空间不足、升级被其他页签阻塞或事务中断都明确拒绝 Promise。
每个适配器最多32个等待打开或执行中的操作。

## Adapter operations / 适配器方法

| Method | Contract / 契约 |
|---|---|
| `enqueue(clientMessageId, packet)` | Save canonical PUBLISH bytes before sending; the same ID with changed bytes conflicts. 发送前保存规范化 PUBLISH，SN 固定为1；同 ID 异内容拒绝 |
| `pending(limit)` | Read at most 64 pending entries and 256 KiB per page. Unknown results remain pending. 最多64项、256 KiB；未知结果保持原 ID |
| `settle(clientMessageId, state, outcome)` | Store a known result; does not invent a new retry ID. 保存确定结果，不生成替代消息 ID |
| `receive(conversationId, items, cursor, previousCursor)` | Atomically save immutable message packets, dedup keys and the page position. 正文、去重和恢复位置同事务保存 |
| `synchronize(items, cursor, previousCursor)` | Save account conversation revisions/read positions and the synchronization position atomically. 会话版本／共享已读和同步位置同事务保存 |
| `position(kind, id)` | Read the persisted opaque position; a missing position is an empty Uint8Array. 读取已保存游标，缺失时返回空字节数组 |
| `close()` | Stop this adapter. It never acknowledges a message by itself. 关闭实例，不自行发送确认 |

A receive item contains `messageId` (16 bytes), `messageSequence` (exact
`{high, low}` uint32 words), and `packet` (canonical message notification bytes).
Pages are bounded to 64 records and 256 KiB. `previousCursor` must match the
stored position, or `cursor` must already be installed by the same duplicate
page. A stale concurrent page aborts the whole transaction. COMMIT may follow
only after receive resolves, and only on the still-current authenticated socket.
The future SDK wiring is responsible for that socket generation check.

receive 项包含16字节 messageId、精确 high/low 双32位 messageSequence，以及规范化消息
通知 packet。每页最多64条、256 KiB。previousCursor 必须匹配持久位置，或本页 cursor
已经由重复页保存；迟到的并发页会使整个事务中止。只有 receive Promise 成功后，且原认证
连接仍有效时，调用者才能 COMMIT；连接代际检查由后续 SDK 接线承担。

A synchronization item contains `conversationId`, `revision`, `readSequence`.
The two sequences use exact high/low words. A newer revision cannot move READ
backwards. This saves account metadata only; it cannot acknowledge message bodies.
For `settle`, known states are accepted/delivered/expired/revoked/rejected;
optional outcome fields are messageId/conversationId/messageSequence. Unknown or
pending network results must not be passed to settle. No token/key store exists.

同步项保存 conversationId、revision 和 readSequence，序号同样使用 high/low；新版本不能
回退已读。保存账户元数据不代表已经保存消息正文。settle 只接受 accepted、delivered、
expired、revoked、rejected；可选 outcome 只保存 messageId／conversationId／messageSequence。
未知网络结果继续留在发送箱；不保存令牌、密钥或完整登录响应。

This foundation does not implement local history deletion/retention, automatic
retry scheduling, wire cursor validation or server authorization. Those remain
with the application and the unfinished E08a protocol wiring. Client deletion
must eventually preserve dedup/recovery evidence rather than recreate content
on an acknowledged-message replay.

本基础组件尚不提供本地历史删除／保留策略、自动重试调度、线协议游标验证或服务端鉴权。
后续本地删除必须保留去重和恢复依据，避免已删除消息因重投重新出现。
