# 共享地域入口

`odd.utils.Routing` 为同一部署的 IM、RTC、Player 提供可丢弃的地域提示。统一发现域名由智能 DNS 选择地域；提示中的 `endpoint` 是地域 odd.x 服务地址，具体 odd.d 仍由业务分配返回。它不签发用户 JWT、不预占容量、不替换媒体凭据回调。[English](routing.en.md)

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

localStorage 仅保存上述公开白名单字段，键按部署＋发现 URL 隔离；不同站点不共享。存储不可用退回内存，损坏／过期提示丢弃。没有用户令牌、容量承诺或媒体证明，不使用 Cookie。`destroy()` 移除网络监听、取消发现并清除当前提示；由共享 Routing 的持有者统一调用，不由某一个媒体窗口销毁它。

IM 凭据上下文已增加绝对 `deadline` 与可选 `signal`；关闭或连接超时会中止该次准备，原连接代次与迟到结果防护保持。模块加载在 `utils.mediarequest.js` 之后，已加入 common 清单。仅源码交付；没有 SDK 独立构建、协议联调或 DNS 部署。
