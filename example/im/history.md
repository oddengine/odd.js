# 有限云历史与公开阅读

R-086 仅源码交付，未构建、运行或验证浏览器。服务端配置及完整包定义见 odd.d 的 `docs/im-history-receipts.md`；部署须启用 Messaging/History 及显式容量预算。只支持私聊和持久成员的可靠频道，不用于系统通知、临时直播观众或旧静态 group。

`im.historyCapabilities()` 返回独立的 `history/publicRead` 能力。会话开启后，`im.receipts(conversationId, 'policy')` 查询保留天数、频道公开开关、本人同意、memberEpoch、policyRevision 和 visibleFrom。频道开关不代表本人同意；所有结果仍受当前会话权限约束。

```js
// 每次用户操作取一页；不能用定时轮询自动公开阅读。
const page = await im.history(conversationId, cursor, 32);
cursor = page.nextCursor;
// page.records 已通过存储适配器保存；hasMore=false 为当前成员期起点。

await im.receipt(conversationId, 'enable'); // 本人明确同意
await im.receipt(conversationId, 'read', { messageIds: visibleSavedMessageIds });
await im.receipt(conversationId, 'disable'); // 停止新增，已有公开事实按期保留

const summary = await im.receipts(conversationId, 'summary', { sequences: [sequence] });
const members = await im.receipts(conversationId, 'detail', {
    sequences: [sequence], category: 'read', cursor: undefined, limit: 32,
});
```

HISTORY 从最新向前取页，`cursor=null` 开始新查询。默认32、请求上限64、服务实际最多32条并受字节预算约束；expired 条目表示缺口，不能生成阅读证据。历史与正常接收复用正文身份校验和 IndexedDB，但不会推进 received、发 COMMIT、清除私人未读或公开阅读。自己的历史正文也可返回。查询没有按秒限速，仍须遵守页大小和并发预算。

存储适配器新增 `receiveHistory(conversationId, records)`、`display(conversationId, memberEpoch, messageIds)`。后者只供渲染层的显式操作调用，要求1–64条已保存消息，记录本期最近一次实际可见序号，返回去重排序的序号；不得从最大接收水位推断可见消息。内置 IndexedDB 使用原 messages/positions，不新建数据库版本，不将签名 proof 持久化。

SDK 将实际序号按洞和 proof 边界分组，每请求最多8段，服务合并最多64个连续范围。HISTORY proof 绑定设备和成员期，短期只保留内存；失效后重新读取对应历史。退群重进不能使用旧成员期 proof。enable/disable 在结果未确认时保留同一操作ID及 CAS；重读当前策略后，以当前策略为准，旧回执不能恢复旧同意。

摘要单次最多50个序号；SDK 把服务端 counts:BYTES6 解码为 read/unknown/released。unknown 是无公开证据，不能标成未读；released 是已退出且无公开证据。detail 请求上限100，实际每页最多64。详情游标绑定摘要快照；conflict 时重读摘要，expired 时从头查询，不能拼接不同快照。只按需查询，不广播名单。

内置 `UI.Reading` 提供中文折叠面板、重新读取、个人公开开关、当前可见消息公开、发送侧摘要和分页成员表。恢复策略查询会更新已有消息入口；仅 history 能力时保留历史操作、关闭公开入口。面板结果采用稳定焦点区，经典皮肤使用明确网格区域，隐藏面板不改变消息区弹性位置。

实际正文输出复用服务端网络 Complete 和设备级去重计量；摘要、名册和公开声明不计正文投递。本机翻阅不产生网络投递。
