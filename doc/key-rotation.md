# 正常密钥轮转与凭据回调

客户后端持有频道私钥，客户前端／SDK 持有短期准入凭据。B 发布并配置到客户后端后，开始 A 的重叠窗口；窗口可以短于少量长期 A 凭据的有效期。节点按 kid 选择公钥，A 截止后新准入失败，已建立的连接不因此断开。客户端不会因为普通轮转设置周期续签任务。

## 回调契约

已有 `credentials(context)` 增加 `reason: "credential_expired"` 和 `forceRefresh: true`，要求提供者绕过旧凭据缓存。提供者应使用客户自身登录会话调用客户后端；后端重新检查当前权限，使用首选 B 私钥签发。返回原有凭据格式，绝不能把私钥返回浏览器。客户登录过期或业务拒绝应交给业务处理。

- RTC participation 复用一个 pending job，首次 join／正常 refresh 和失效重取均合并该实例的等待者。失败不会替换既有参与的凭据或关闭已建立媒体。只对明确未成功准入的 401 invalid_token 重试一次；本地 connectBefore 已过期同样最多重取一次。请求 ID、证明、端点、代次和原始截止不变。同一参与中新开媒体收到凭据失效时也共享这个 job，已刷新则直接用新凭据重试，不重新调度。不同用户／App／频道／权限实例不合并。
- 产品直播 WHIP／WHEP、HTTP-FLV／CMAF 在明确的 401 invalid_token 后重取一次。此时 `context` 保留原 operationId／instanceId／generation／createdAt／streamId／deadline，接入方复用原调度结果，仅更换用户凭据；返回的 App、频道、节点、boot、URL、流、实例、代次和发布 placement 必须不变。不能重新分配发布或移到其他节点。
- 上述 HTTP 错误由节点返回 `WWW-Authenticate: Bearer error="invalid_token"`，并暴露该头给跨域客户端。403 业务拒绝、未知网络结果、超时和管理请求不触发这种重试。第二次失败直接返回。
- 浏览器 WebSocket 无法读取失败握手的 HTTP 状态。频道 IM 每次新连接的回调发送 `forceRefresh:true`，reason 为 connect／reconnect，主动取得新票据，不增加一次预检鉴权、不把网络错误判作过期。已有一次连接中的请求共用同一个连接 attempt。
- 通用 RTMP／RTSP 工具由客户启动器／服务端适配在新连接时更新凭据或地址；SDK 无法替这些工具自动访问客户后端。

凭据回调及重试受原总截止和取消信号约束；回调即使忽略 AbortSignal，迟到结果也不能启动新请求。发布 placement 自身到期不能通过重新签用户凭据延长。

## 客户后端接入示意

以下是客户自己的接口，不是 odd.x 平台接口；客户负责认证、权限及密钥部署。

```js
async function credentials(context) {
    const response = await fetch('/my-app/admission', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        signal: context.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            reason: context.reason,
            forceRefresh: context.forceRefresh === true,
            connectionId: context.connectionId,
        }),
    });
    if (!response.ok) { throw new Error('无法取得准入凭据'); }
    return response.json(); // 按 IM／RTC／直播当前接入契约返回
}
```

RTC 返回 token／url／connectBefore；IM 返回 ticket／url／expiresAt。直播接入适配还组合原调度结果，因此不能把不同流的完整回调结果合并。客户可在签发层按登录会话、App、频道和权限范围复用用户 JWT、合并在途取票；forceRefresh 必须使该范围的旧缓存失效，账号改变清空其缓存。不能按用户名一个字段合并不同授权。

本次为源码交付，SDK 独立构建、服务端运行及真实协议互通未执行。网站集成构建的结果在对应迭代记录，不能视作服务验收。
