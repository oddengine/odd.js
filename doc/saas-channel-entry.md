# SaaS 频道持有者接入

第一方网站从同源业务 API 获取动态频道／媒体 App 描述符和用户凭据。SDK 不持有托管私钥，不解析登录 Cookie，也不代办客户签名。v2 loginSessionId 是服务端签名字段，SDK 原样传递 token；PaaS v1 路径保持不变。

- IM 使用 `profile:'channel'` 与 `Routing.im(provider)`，真实流清单来自 `subscribeChannel()` / `channelState()`。可靠频道快照通过 IMEvent.MESSAGE 交付，不能只监听旧 NOTIFY。
- 会议使用 `participation.credentials=Routing.participation(provider)` 和 `route=Routing.media`，每路媒体仍独立计时；用户凭据按 kind 在持有者内合并获取并短期复用。
- 直播发布使用普通产品 credentials 包装器；观看的 RTC Player 可接收 `{type:'RTC',vod:false,sources:[{streamId,label}]}`。View 保留流标识，RTC module 要求非零 UUID 和 credentials provider，由实际选址结果提供 HTTPS WHEP 地址，不能伪造一个 URL 绕过来源检查。原 URL 来源照常可用。
- 同一具名 IM 连接可组合可靠流目录和 UI.Conversation；频道快照不是普通消息 meta，Conversation 明确忽略它，由目录持有者处理。具名聊天用稳定 deviceId 与 IndexedDB，仍保存后按页确认。匿名目录使用当前连接内存。
- 网站一次最多展示 9 路订阅画面并提供分组选择；这是视图预算，频道流清单没有 9 路总量限制。同账号其他设备／机位不会因 userId 相同而被全过滤，当前持有者已知自身发布源按实际 streamId 排除。

切换页面只移动持有者 DOM；显式离开／业务结束／账号会话变化才销毁其连接。读取同一登录账号不应触发销毁，网站按账号 ID 和登录上下文两个原始值分别观察。迟到媒体结果、已销毁目录持有者和旧页面回调不能复活连接。凭据仅在内存，断开清除；未知业务命令结果保留原 operationId 重试。

未执行 SDK 独立构建／测试或真实媒体互通。网站构建和演示响应截图另见 www/review/r075-saas-entry。
