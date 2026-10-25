# 共享地域入口

`odd.utils.Routing` 为同一部署的 IM、RTC、Player 提供可丢弃的地域提示。统一发现域名由智能 DNS 选择地域；提示中的 `endpoint` 是地域 odd.x 服务地址，具体 odd.d 仍由业务分配返回。`resolve/bind`只发现地域；`media`另提供一次公共媒体分配，`credentials`组合客户JWT回调与该分配。它不签发用户JWT。[English](routing.en.md)

```javascript
var routing = new odd.utils.Routing({
    deployment: 'production',
    url: 'https://route.example.com/routing/entry',
    origins: ['https://route-cn-east.example.com', 'https://route-overseas.example.com'],
    timeout: 10000,
    storage: true,
});
var provider = routing.bind(async function (context) {
    // context.routing.endpoint/region are public location preferences.
    // Return the existing IM/media/participation contract from your integration.
    return applicationCredentials(context);
});
// Pass provider as the module's credentials, or wrap RTC participation.route.
// On teardown of this shared owner, after its modules have stopped:
// routing.destroy();
```

`applicationCredentials` 是应用已有的业务接入回调，不是 SDK 内置接口。客户后端保管频道私钥；用户 JWT 仍不含流 ID。RTC 已固定参与节点、已存在源或原操作重试不能被地域偏好重新选址。正常换钥的 `reason: 'credential_expired'` 媒体重签沿原分配；调用方可直接走原凭据回调，不必再次发现地域。IM 的 `forceRefresh` 表示新连接取票，不等于媒体固定目标重签。

配置必须包含部署 ID、HTTPS 发现 URL、1–32 个可信地域 origin；origin 不含路径。`timeout` 默认 10000 毫秒，可设 1–60000；`storage` 默认 true。示例域名须替换为实际域名，不能把模板地址部署上线。发现响应为 `version:1`、`deployment`、`region`、`revision`、`endpoint`、`maxAge`；后三个标识与服务端配置一致，`maxAge` 以毫秒表示，范围 60000–3600000。响应最长 8192 字节；不接受重定向、跨可信列表地址或带用户名／查询串／片段的 URL。

`resolve({deadline, signal})` 返回冻结的公开提示，增加本机 `cachedAt/expiresAt`（毫秒）。相对期限避免服务器时钟差；命中不续期，进程内另用单调时钟限制寿命。并发冷发现合并为一次 GET；单个等待者取消不影响其余等待者，共享请求有独立超时。`bind(provider)` 原样传递上下文并添加 `routing`，不自动重放 provider。首次未缓存的操作当前多一次公开发现请求；已有缓存不增加发现请求，未来业务响应合并提示不代表当前已接入。

`invalidate(entry)` 仅在 entry 仍是当前提示时清除；不传参数清除当前提示。真实地域入口不可用时，provider 可抛带 `routingUnavailable: true` 的错误，使下次操作重新发现；不得给 401／403、业务失败或普通同源签发服务失败添加这个标记。原分配响应未知时，仍须按原 operationId／instanceId 恢复，不可换地域创建新操作。`navigator.connection.change` 可用时主动失效；没有该能力的环境依赖期限及明确失败。失效与到期都不关闭现有连接。

localStorage 仅保存上述公开白名单字段，键按部署＋发现 URL 隔离；不同站点不共享。存储不可用退回内存，损坏／过期提示丢弃。没有用户令牌、容量承诺或媒体证明，不使用 Cookie。`destroy()` 移除网络监听、取消发现及在途媒体分配并清除当前提示；由共享 Routing 的持有者统一调用，不由某一个媒体窗口销毁它。

IM 凭据上下文已增加绝对 `deadline` 与可选 `signal`；关闭或连接超时会中止该次准备，原连接代次与迟到结果防护保持。模块加载在 `utils.mediarequest.js` 之后，已加入 common 清单。仅源码交付；没有 SDK 独立构建、协议联调或 DNS 部署。

## 公共媒体分配

`media(context, credentials?)` 在已发现的地域 Endpoint 下 POST `media`，返回本次媒体分配及原用户 JWT。Endpoint 示例为 `https://route-cn-east.example.com/routing/`，对应 odd.x 的 `POST /routing/media`。每次媒体只申请一次，既有用户 JWT 可复用，不逐流重签。默认第二个参数为 context，便于直接使用 RTC participation.route 的完整请求。

```javascript
// Live: the customer backend returns token/connectBefore and
// appId/channelAppId/product/userId. It never handles platform secrets.
var liveCredentials = routing.credentials(customerMediaCredential);
// Pass liveCredentials as the existing Player/RTC live credentials callback.

// RTC: initial participation.credentials still returns its assigned entry.
// For each media operation use:
var route = function (request) { return routing.media(request); };
```

context 含 operationId/createdAt/instanceId/streamId/direction/protocol/deadline/signal；发布另含 purpose，RTC 另含固定 nodeId/bootId。credentials 必须含 token、connectBefore（秒）及 App/频道/产品/用户。它不是逐流签名接口。请求只传白名单字段，使用 Bearer 用户凭据，无 Cookie、无重定向；回复上限 16 KiB，在途请求最多 4096，超时/取消/销毁会中止请求。匿名播放需显式 userId="" 并获频道许可。

发布返回 ticket；播放返回 subscriptionTicket 和 relayInstanceId（本地原始源为 ""）。HTTP 媒体入口自动发送 Odd-Media-Subscription，RTC 仍固定已加入的节点。媒体管理继续使用独立随机证明，不重新分配。`routing.credentials(provider)` 在正常换钥的 forceRefresh/credential_expired 时只调用客户 provider，由 MediaRequest 沿原分配合并新用户凭据；若 provider 明确改变分配身份则拒绝。

分配失败不自动重试、不因超时换地域再占额。已知原操作未取得结果时，接入方只能保持原地域和所有操作标识恢复；不能刷新 createdAt 延长原操作或修改 instanceId 伪装重试。分配证明和 JWT 仅返回给本次调用，不存入地域缓存/localStorage。公共接口、原生 URL 适配及服务端容量桶见 [odd.x 接口](../../odd.x/docs/media-routing.md)。
