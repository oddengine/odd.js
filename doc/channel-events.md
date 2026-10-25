# 频道可靠流发现

频道为一个 IM App，使用 `odd.im.create()` 创建实例，`setup` 中设置 `profile: 'channel'`、频道 `appId`、安全 WebSocket URL 和 `credentials(context)`。凭据回调返回客户后台签发的 `ticket`；客户私钥不进入浏览器，频道凭据不包含媒体流 ID。

连接完成后调用 `subscribeChannel(options)`，读取 `channelState()`，通过现有 IM 通知接收 `channel.snapshot` 及频道事件。目标类型为 `channel`，目标 ID 由已认证的 appId 决定；不能改填其他频道，也不需要构造旧 room 对象。

事件给出媒体 appId、channelAppId、streamId、instanceId、generation、revision 和实际状态。消费者用已有用户级媒体凭据播放该 streamId，不为每一路订阅重新签发。stopped／unknown 移除当前有效投影，旧实例／代次事件不得覆盖新发布；失去来源存活证据时不伪装为 active。

默认使用有界内存保存本连接的事件投影。匿名每次连接都取新快照，不跨连接复用游标；具名用户若配置持久 storageFactory，还必须给出稳定的非零 UUID deviceId。原 IndexedDB 按页保存后确认、断线失败与取消语义继续适用。

当前频道 profile 专用于可靠流发现；它不开放普通聊天发送、联系人或 CALL。消息权限位的定义与功能实际接线分别判断。服务回显 profile、appId、product、stateVersion 或具名 deviceId 不匹配时拒绝继续。

频道 v5 使用同一 H 水位的分页快照，每页最多 32 个实体并限制字节。自定义存储须实现 `beginEventSnapshot`、`saveEventSnapshot`、`finishEventSnapshot`；内置 Memory 和 IndexedDB 已实现。下一页请求表示上一页已存储，最后一页保存后原子切换，再沿原 COMMIT 确认 H；随后接 H 之后增量。中断／过期不会展示半份清单，重连重新建立基线。

默认内存投影预算为 8 MiB（setup 的 `channelStateBytes`），没有频道 64 条总量上限。IndexedDB 使用版本 6 的独立快照暂存表，沿原字节和记录预算，分批写入后一次原子切换。来源 node／boot 状态也分页；重建中的未知来源保持 unknown，不把分页截断误认为完整。

2026-10-25 完成源码／diff 审阅；网站按 SDK 源码清单完成集成构建。未执行 SDK 独立发布构建或协议互通测试，R-075 整体仍在进行。
