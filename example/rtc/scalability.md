# Simulcast 与 AV1 SVC

`video.simulcast` 与 `video.svc` 独立控制。SVC 只允许 AV1；H264/H265 仍可多编码 Simulcast。缺省 `svc:false`，缺省 `simulcast` 从旧 `encodings.length > 1` 推导，保持原配置兼容；显式 false 与多个 encoding 冲突时报错。

| simulcast | svc | encodings |
|---|---|---|
| false | false | 0 或 1 项；完整码流；AV1 为 L1T1 |
| true | false | 2—3 项，各自唯一 RID 与正 maxBitrate；AV1 每项 L1T1 |
| false | true | 1 项 AV1，可无 RID，必须明确模式及正 maxBitrate |
| true | true | 2—3 项 AV1，各自唯一 RID、正 maxBitrate 和模式 |

单编码 AV1 SVC：

```javascript
rtc.setup({
    codecpreferences: ['audio/opus', 'video/AV1'],
    video: {
        simulcast: false,
        svc: true,
        encodings: [{ maxBitrate: 1200000, scalabilityMode: 'L3T3_KEY' }],
    },
});
```

同时开启时，设 `simulcast:true`，提供多个如 `{rid:'high',maxBitrate:1200000,scalabilityMode:'L3T3_KEY'}` 的 encoding；按应用需要分别设置缩放与带宽。H26x Simulcast 使用原 H264/H265 codecpreferences、`svc:false` 和多 encoding，不指定分层模式。

支持的请求模式：L1T1/2/3、L2T1—L3T3 及 L2/L3 对应的 `_KEY`。不请求 S、h、`_KEY_SHIFT`，也不在失败时降级 H26x 或额外创建 PC。设备可能只实现这个集合的一部分；L1T1 本身不表示分层。

SVC 必须显式包含 `video/AV1`，视频 codec preferences 会限定为 AV1。`sendEncodings.scalabilityMode` 启动原生编码器；SDP 的 DD extmap 仅协商依赖信息传输，不能启动 SVC。answer 后检查 AV1、DD 接收方向、RID 集合／顺序和 `getParameters()` 返回的模式，失败沿 close 清理本地轨道及远端 Location；不会把成功 setLocalDescription 当作能力已成立。

服务端仍需收到合法 DD 和独立入口才建立实际目标，SDK 无法从 JavaScript 直接检验原生 RTP 的每个 DD。`setBitrate` 保留现有 encodings／RID／模式，只调整带宽；更改开关、codec 或 encoding 数量应关闭后重新发布。

RTC 示例参数：`?simulcast=1` 保留 H26x 多编码；`?av1=1` 请求完整 AV1；`?svc=1` 请求 AV1 L3T3_KEY；`?svc=1&simulcast=1` 请求多路 AV1 分层编码。所有设备能力以实际协商为准。本轮未构建 SDK 产物，也未执行浏览器或互通验证。
