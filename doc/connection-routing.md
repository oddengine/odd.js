# 首次 IM／RTC 接入的地域选址

沿一个共享 `odd.utils.Routing` 使用现有智能解析和公开地域缓存。客户后台签发用户级频道凭据，SDK 取一次节点建议后仍由原 IM／RTC 对象建立连接；没有浏览器私钥、scheduler 密钥或每路订阅重签。

```js
const routing = new odd.utils.Routing({
    deployment: 'production',
    url: 'https://route.example.com/routing/entry',
    origins: ['https://route-east.example.com'],
});

const im = odd.IM.create();
await im.setup({
    appId: channelAppId,
    profile: 'channel',
    credentials: routing.im(getChannelCredential),
});

const rtc = odd.RTC.create();
await rtc.setup({
    participation: {
        credentials: routing.participation(getRtcCredential),
        route: (request) => routing.media(request),
    },
});
```

域名和 AppID 由真实部署提供。`getChannelCredential(context)` 访问客户业务后端，返回 `{ticket, appId, userId, expiresAt}`；ticket 为 `odd-app-im.v1+jwt`，expiresAt 为 UTC 毫秒。`getRtcCredential(context)` 返回 `{token, product:'rtc', appId, channelAppId, userId, connectBefore}`；connectBefore 为 UTC 秒。用户ID允许显式空字符串，但匿名策略仍由频道决定。两者首次均无需固定节点 URL；签发回调保留原 deadline、signal、reason／forceRefresh 语义。

IM 适配器每次新连接调用地域 `/connections`，回填 WSS url 并收紧本次 expiresAt。RTC 适配器只为首次参与选址，回填 HTTPS url 和短期 routeExpiresAt；它不收紧用户 JWT 的 connectBefore，避免因节点心跳窗口而增加重签频率。真正 POST 的等待期限仍受该次 routeExpiresAt 约束。

RTC 参与在 credentials 上下文追加 operationId、createdAt 和可选 url。首次 url 为空；刷新或已选端点后的凭据重试传入固定 url，适配器原样保留，不再发现地域或选择新节点。客户回调若返回不同 URL 会明确失败。适配器本身不保存参与状态，可共享给多个 RTC 实例，实际 node/boot 以各自创建结果为准。媒体 route 回调继续使用该实际参与身份，不使用初始选址的采样 boot。

底层也可直接调用 `routing.connection(context, credentials)`：context 包含 kind（im/rtc）、operationId、十进制字符串 createdAt、deadline、signal；IM 可额外传 appId 用于与凭据回显核对。operationId 由调用者本次尝试生成，接口无预占或参与副作用，不能把结果当作已连接。

响应最多8192字节、只接受规范 WSS／HTTPS 和原身份回显，拒绝重定向及过期结果。选址明确返回凭据失效时最多调用一次客户回调重签，保留原操作ID和截止；403、网络失败不按换钥重试，也不换地域。全部步骤共用原截止及取消；RTC首路并发沿原 Participation 合并，最后等待者退出才取消准备。实际创建结果未知时不自动换节点；普通换钥不断开已建立媒体。只有公开地域提示进入 localStorage，节点URL、JWT和管理秘密仅留在当前内存尝试。退出某个RTC／IM实例不销毁共享Routing，宿主退出时统一 destroy。

服务端配置与预算见 [odd.x 连接选址](https://github.com/oddengine/odd.x/blob/main/docs/connection-routing.md)。本次未改网站 SaaS 凭据接口，不宣称旧接口已接通；仅源码/diff 审阅，未编译SDK、重建release、测试或浏览器运行。
