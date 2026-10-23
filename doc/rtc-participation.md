# RTC 产品参与接口

本接口使用频道用户凭据，同一 RTC 实例的发布和订阅共享一次参与。不同 RTC 实例分别计时；同实例多路媒体只计一份参与时长。源码接线不代表产品媒体已经开放，节点参与 HTTP 已有源码适配，发布归属及实际激活仍在实现中。

```js
const rtc = odd.RTC.create();
await rtc.setup({
    timeout: 5000,
    participation: {
        maxSessions: 128,
        credentials: async ({ reason, connectionId, generation }) => {
            // 从业务后端取得用户凭据与可信选址；不传入频道私钥。
            return { token, url, connectBefore };
        },
    },
});
const publishing = await rtc.publish();
// 将 publishing.name() 作为实际发布标识传给需要订阅的业务参与者。
await rtc.play(publicationId);
rtc.stop(publicationId);
rtc.destroy();
```

`participation.credentials` 与原逐流 `credentials` 互斥。`reason` 为 `join` 或 `refresh`；`connectionId` 为一次参与的安全随机 UUID，`generation` 为十进制字符串。返回 `token`、HTTPS 参与入口 `url` 和 UTC 秒 `connectBefore`，不要求客户逐流签发或返回 `streamId`。SDK 不解析客户 JWT，也不把实际流名加入客户凭据。

`setup`、`preview` 不联网。首次发布／订阅合并获取参与，准入截止前复用；截止后新媒体按需合并刷新，既有媒体不因普通凭据到期而自动退出。刷新必须保持原节点、启动实例、App、频道及用户。媒体 POST 与获取／刷新共用该路原始截止，后续 PATCH／DELETE 各沿原 timeout。

每个等待者可独立取消；最后等待者退出才取消共享准备。`maxSessions` 限制等待及持有租约的媒体数，缺省128，可配置1—1024；每路同时最多32个普通请求，并保留一个释放请求槽。回复按读取字节有界：参与JSON16KiB、媒体SDP1MiB、控制回复4KiB。超时、关闭及回复超额均取消请求。没有自动重试创建或跨节点回退。

`stop` 只停所选媒体；全部本地媒体释放后保留参与30秒，保留本身不计时、不续权。`destroy` 停止本实例子媒体并请求退出参与，CLOSE 仍是本地事件，不等待服务端真实释放。参与失效返回410时，SDK关闭该参与的媒体、取消刷新；后续显式新操作才重新获取。单路资源不存在用404，不以410关闭无关媒体。

## 节点协议

参与入口由配置及可信选址给出。POST使用 `Authorization: Bearer <token>` 和 `Odd-RTC-Proof`（客户端256位随机秘密的43字符base64url），正文为 `{requestId}`。刷新复用同 requestId 和证明，并携带 `Odd-RTC-Participant`、`Odd-RTC-Boot`。节点仅保存证明摘要，按原主体检查重复请求；不得因未知参与而在另一节点隐式创建。

JSON响应为 `profile:"odd-rtc-participation.v1"`、非零小写UUID `participantId/bootId/appId/channelAppId`、节点标识 `nodeId`（1—128个A-Z/a-z/0-9/点/下划线/短横线）、`userId`、`controlUrl/whipUrl/whepUrl` 及 `idleRetentionSeconds:30`。RTC App与频道App不同；`userId`允许空值时仍由频道策略决定。控制URL为入口加 `/participantId`，媒体基路径无尾斜杠，与入口同源。

媒体 POST 发送相同参与ID、boot、证明及用户JWT，URL为指定WHIP／WHEP基路径加 `/publicationId`。发布标识是技术请求的UUID，需节点实际登记所有权，不能单凭客户端ID取得归属。回复SDP及同源指定路径内的Location；之后PATCH／DELETE携带参与证明和ETag。DELETE参与控制URL不依赖未过期JWT或余额。证明仅在内存，不进Cookie、URL、持久存储或日志。所有产品请求HTTPS、禁重定向、无Cookie。

部署需允许POST／PATCH／DELETE及上述请求头，并暴露Location／ETag；SDK不自动扩大CORS。取消已发出的创建不能证明服务器未受理，未知创建结果由节点无媒体30秒期限回收，实际媒体仍须真实协议终态释放。

## 当前边界

直接使用 `RTC.NetStream` 不能自己建立共享参与，必须由RTC实例持有控制器。原逐流路径保持独立。CallMedia原通话的 `resourceId/roomId` 尚未接产品发布归属，显式拒绝配置产品参与，不能把旧ID当作频道或发布所有权；后续接通真实绑定再开放。源代码引用须按顺序加载 `rtc.js`、`rtc.participation.js`、`rtc.netstream.js`。

本次仅源码与差异审阅，未编译、测试、运行浏览器或重建发布产物。
