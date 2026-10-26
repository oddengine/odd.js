# 频道普通消息

沿[频道连接](channel-events.md)配置 `profile:'channel'`、AppID、WebSocket URL 和客户 `credentials` 回调。普通消息与媒体事件共用连接，事件的 `subscribeChannel()` / `channelState()` 语义不变。

可靠消息要求具名用户、稳定非零 UUID `deviceId` 和持久 `storageFactory`。适配器除事件快照方法外，还须实现原 enqueue/pending/settle/receive/position/synchronize 方法并匹配认证后的 AppID、用户和设备。默认事件 Memory 不能承担普通消息持久保存。

连接完成后，先解析频道，再沿既有接口使用其消息会话：

```js
const channel = { type: 'channel', id: appId };
const resolved = await im.resolve(channel);
const conversation = { type: 'conversation', id: resolved.conversationId };
await im.subscribe(conversation, { messaging: true, actions: 1 | 2 | 256 });
await im.send(conversation, '你好', { messaging: true });
const page = await im.fetch(conversation.id, undefined, 32);
// 使用 page.nextCursor 分页；SDK 持久保存一页后自动 COMMIT。
```

握手必须宣告 `messagesVersion=1`。位 1=订阅、2=发送、256=保存确认；512=已读，可单独申请并调用 read。FETCH 不要求已读位，也没有查询速度限制，只限制单页数量/字节及原在途预算。conversationId 是频道内部日志标识，不需要客户额外创建房间；换钥不改变历史身份。

重连沿原 clientMessageId 和持久 outbox 恢复未知发送结果，不生成新操作。频道不扫描旧账户 LIST/SYNC 会话目录；历史和实时页仍走同一保存、确认链路。同设备可靠消息重取只按首次实际投递计费。

仅需在线消息时无需普通消息持久存储：

```js
await im.subscribe(channel, { messaging: false, topic: 'messages' });
// 具名发布者先申请发送权限；匿名仅接收。
await im.refresh(channel, 1 | 2, false);
await im.send(channel, '在线通知', { messaging: false });
```

在线广播要求服务宣告 `onlineMessages=true`，离线不补发、不增加客户端 ACK；每个实际接收连接的完整输出各计一次。内部转发和媒体发现不计普通消息用量。频道能力依赖当前连接和本地目录，不强制周期性向客户后台重签。

本次只做源码/diff审阅，未构建发布包或运行互通；使用当前 dev 源码集成。

首次频道连接可用 [Routing.im](connection-routing.md)获得 WSS 接入节点；仍使用同一用户级频道 JWT、本地准入及可靠消息保存流程，不逐消息访问路由服务。
