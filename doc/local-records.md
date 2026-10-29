# Local message recovery and call records

`IM.IndexedDB.callHistory(before, limit)` reads one page of the retained call projection. `limit` is 1–64, `before` is an optional 32-character hexadecimal call ID. It returns `{items,cursor}` in descending UUIDv7 order. The existing no-argument `calls()` used by the CALL lifecycle is unchanged. History reads neither accept calls nor retry call operations. The cache retains at most the existing 1,024 call records; it is not a complete cloud call history.

`IM.UI.History.pendingPage(storage, userId, after, limit)` projects `storage.pending()` into `{items,cursor}`. Each item includes `id`, `conversationId`, a bounded text preview, timestamp, state and gift flag. Packet decoding stays in the SDK. The original page byte limit can produce a short page; use `cursor`, not `items.length === limit`, to continue. A final empty page is possible.

`im.recover()` remains the existing recovery operation: resend/inspect original immutable IDs, never manufacture a new message or treat completion as proof of delivery/read. Applications should reread pending records afterward and return to the original conversation for authoritative outcomes. Borrowed record views must not close an application-owned IM instance, and must discard delayed results after account/session changes.

These additions were source-reviewed only, without building or running the SDK.

## 中文说明

`callHistory(before, limit)`按页读取本机保留的通话状态，`pendingPage(storage,userId,after,limit)`返回有界待发送摘要。均不发起通话或确认消息；网站不解析二进制包。`recover()`继续使用原消息ID恢复，返回不代表对方已保存或已读。切换身份必须丢弃旧结果；本机缓存不能替代完整云端历史，缺少实际接通/结束时间时不推算通话时长。
