# RTC 产品参与接口

WHIP／WHEP的计费取决于可信目标App的产品：直播App按客户出口字节，RTC App按每路媒体会话时长。本页的participation接口专用于RTC产品，SDK不通过协议名判断或改写产品／计费单位；直播App不能把凭据传入RTC参与接口来复用计时账本。产品直播使用独立的[媒体凭据入口](live-media.md)。

本接口使用频道用户凭据，同一 RTC 实例的发布和订阅共享一次参与。每路实际RTC媒体会话分别计时：同实例1路发布＋9路订阅各持续10分钟累计100分钟。共享参与仅管理身份、凭据与关闭，不合并费用；同一路内音频／视频轨道、Simulcast／SVC层和重传不额外乘时长。节点参与、产品WHIP／WHEP和原媒体会话已有源码接线，实际激活才开始计时，真实Complete才停止。仍需部署可信调度服务、节点目录和计量窗口；源码交付不代表运行验收。

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
        route: async (request) => {
            // 应用接入层调用可信平台调度；以下函数由接入方提供。
            // 保留 request.operationId / instanceId / createdAt，传递 signal 与 deadline。
            return requestMediaRoute(request);
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

媒体 POST 发送相同参与ID、boot、参与证明及用户JWT，另带独立的 `Odd-Media-Proof`、`Odd-Media-Instance`、`Odd-Media-Generation`；发布还带 `Odd-Media-Placement`。URL为指定WHIP／WHEP基路径加 `/publicationId`。发布标识由客户端／SDK预先生成；Redis原子预占接受该标识并核验真实发布归属，标识本身不授予权限。回复SDP的Location必须精确等于POST URL加 `/instanceId`；之后PATCH／DELETE使用该媒体独立证明、boot和ETag，不依赖原用户JWT未过期。DELETE参与控制URL不依赖未过期JWT或余额。证明仅在内存，不进Cookie、URL、持久存储或日志。所有产品请求HTTPS、禁重定向、无Cookie。

部署需允许POST／PATCH／DELETE及上述请求头，并暴露Location／ETag；SDK不自动扩大CORS。取消已发出的创建不能证明服务器未受理，未知创建结果由节点无媒体30秒期限回收，实际媒体仍须真实协议终态释放。

## 调度回调与预占

回调指SDK调用接入方提供的JavaScript函数，不是odd.d向odd.x进行远程鉴权。`participation.credentials`为同一RTC实例获取／刷新可复用的用户凭据；`participation.route`为该实例中的每路媒体取得技术调度结果，不重新签发客户JWT。不同实例的身份不合并；同一实例内摄像头、屏幕及多路订阅各有独立技术实例。odd.d仍本地验签，客户签发JWT不需要streamId。

`participation.route` 必填，独立于用户凭据回调。每路媒体协商只调用一次，不自动重试，不逐流重新签发客户JWT。传入：`direction`、`protocol`、`product:"rtc"`、`operationId`、`instanceId`、毫秒字符串`createdAt`、`appId/channelAppId/userId`、`participantId/nodeId/bootId`、原截止毫秒`deadline`和`AbortSignal signal`；发布和订阅都传入`streamId`；发布未指定时由SDK在请求调度前生成随机UUID。

返回字段：`appId/channelAppId/product/userId/nodeId/bootId/instanceId/streamId`和规范十进制字符串`generation`（1至2^53−1）。发布还返回平台签名`ticket`，订阅不得返回ticket。App、用户、节点启动和技术实例必须与请求一致；发布和订阅streamId均须与请求相同，平台不能另换流ID。SDK不接受回调修改媒体端点，始终使用已确认参与的WHIP／WHEP同源路径。

平台接入层负责限制App、调用频率及可信选址，不把全局scheduler服务密钥交给浏览器或客户。odd.x现有内部 `POST /publications` 接收operationId、createdAt、streamId、instanceId、App／频道／用户、cell、WHIP及参与固定的nodeId／bootId；返回的placement字段加ticket可直接映射回调结果。订阅通过内部流目录取得generation；回调中的userId和instanceId仍属于订阅者，不复制发布者的身份或实例。客户端字段不能替代接入层的租户授权。当前仓库不提供匿名调用内部调度的公共转发接口。

RTC参与固定在原node／boot；当前实际媒体路径消费该节点的本地源。路由不能把既有参与悄悄移动到另一个节点；跨节点媒体分发尚待接通，不能伪报本地可播放。发布预占允许先被订阅发现，节点按共同等流机制等待发布，超时404。

路由、参与准备、等流及SDP共用这一路原始截止。取消会中止路由信号；忽略signal的外部回调即使迟到也不能发起媒体POST。取消预占后未建立媒体的输入由原确认窗口回收，不创建额外补偿鉴权。已知道instance的POST即使丢失响应，也尝试对精确管理URL发起有界DELETE；这不能替代节点超时及真实关闭。

## 当前边界

直接使用 `RTC.NetStream` 不能自己建立共享参与，必须由RTC实例持有控制器。原逐流路径保持独立。CallMedia原通话的 `resourceId/roomId` 尚未接产品发布归属，显式拒绝配置产品参与，不能把旧ID当作频道或发布所有权；后续接通真实绑定再开放。源代码引用须按顺序加载 `rtc.js`、`rtc.participation.js`、`rtc.netstream.js`。

本次仅源码与差异审阅，未编译、测试、运行浏览器或重建发布产物。

发布可用Odd-Media-Purpose声明audio／camera／screen；SDK沿现有采集purpose自动设置，节点仍从实际SDP提取音频／视频需求，screen将视频动作映射为已定义的发布屏幕权限，音轨仍要求发布音频权限。audio不得夹带视频，screen必须含视频；未声明沿摄像头视频权限。此声明表达操作用途，不证明编码图像一定来自某种物理设备。
