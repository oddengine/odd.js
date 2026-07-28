<a id="rtc-sdk"></a>
# RTC SDK

[English](rtc.md) · [产品目标](product-map.zh.md) · [SDK 地图](sdk-map.zh.md)

构建包：`odd.rtc`。在线演示：[互动直播](https://oddengine.com/zh/solution/interactive.html)、[视频会议](https://oddengine.com/zh/solution/conference.html)、[呼叫](https://oddengine.com/zh/solution/call.html)。

<a id="facade"></a>
## 门面

`RTC` 管理发布者／订阅者 `NetStream` 和周期统计。它可以独立运行，也可以接收 IM `NetConnection`；后者提供用户身份，SDP 和媒体仍通过 WHIP/WHEP 传输。

<a id="netstream"></a>
## NetStream

<a id="cap-whip-whep"></a>`NetStream` 负责 `RTCPeerConnection`、本地预览／发布、WHEP 订阅、SDP Codec 偏好、可选 Trickle ICE、轨道变化、浏览器录制和清理。

| 路径 | 状态 | 网络行为 |
| --- | --- | --- |
| WHIP 发布 | **已验证** | `POST application/sdp`、读取 `Location`、可选 PATCH Trickle、释放时 DELETE |
| WHEP 播放 | **已验证** | 同样的资源生命周期，远端轨道挂到自动播放 video |
| Player RTC 适配器 | **已验证**，有清理风险 | 将 WHEP 事件／状态转换为 Player 模块契约 |

<a id="media-helpers"></a>
## 媒体辅助模块

| 模块 | 职责 |
| --- | --- |
| `Constraints` | 从低分辨率到 1080P 的命名采集档位 |
| `Stats` | 归一化 RTC 统计 |
| `AudioMeter` | WebAudio 音量测量 |
| <a id="cap-beauty"></a>`Beauty` | WebGL 亮度／磨皮；以 Canvas `captureStream` 输出 |
| `Mixer`、`AudioMixer`、`VideoMixer` | 统一混流接口以及 Canvas／Audio 合成 |

## 功能特征

- **多实例与多流：**稳定的 RTC 实例可以同时管理多个发布者和订阅者。
- **采集与合成：**摄像头、麦克风、屏幕分享、屏幕叠加摄像头、命名档位和运行时约束共用一套 Stream 流程。
- **协商控制：**Codec 偏好、ICE 配置、可选 Trickle ICE 和 WHIP/WHEP 资源生命周期均可配置。
- **媒体处理：**SDK 内置动态轨道、WebGL 美颜、音量测量、统计归一化和浏览器录制。
- SDK 门面管理集合，每个 `NetStream` 独占一个 Peer/HTTP 资源生命周期。
- WHIP/WHEP HTTP 资源与可选的 IM 身份／控制传输分离。
- 设备采集、约束、协商、录制、统计、美颜、混流分别放在聚焦模块中。
- 动态轨道直接操作 RTCRtpSender，不必重建整个 SDK。
- 同一 Stream 对象暴露 `video`、`stream`、属性、状态和事件，便于 UI 集成。

## 插件

RTC 没有独立 UI 包。`Beauty`、`AudioMeter` 和 Mixer 是媒体辅助模块，不是 UI 插件。Player 的 `Chat` 插件会使用本 SDK。

## 配置

| 分组 | 配置项 |
| --- | --- |
| 端点 | `whip`、`whep`、`trickle` |
| 媒体 | `profile`、`codecpreferences` |
| 请求／会话 | `parameters.token`、`rtcconfiguration` |
| 录制服务 | `service.script`、`service.scope`、`service.enable` |

`NetStream` 默认值还包含 ICE Server 和 `iceTransportPolicy`；采集约束包含音视频设备 id、facing mode 和光标策略。

## 接口

<a id="cap-dynamic-tracks"></a>
<a id="cap-rtc-record"></a>

| 参考 | 覆盖范围 |
| --- | --- |
| [已审核接口表](rtc-api.zh.md#接口) | 工厂/设备、RTC 门面、NetStream、动态轨道、录制与媒体辅助 |

## 事件

| 参考 | 覆盖范围 |
| --- | --- |
| [已审核事件表](rtc-api.zh.md#事件) | RTC/NetStream 状态、释放、录制以及已声明但不可达的事件与负载 |

## 信令能力

<a id="cap-publish-subscribe"></a>发布／订阅通过 WHIP/WHEP **已验证**。

<a id="cap-call-control"></a>呼叫／接听／拒绝／超时的产品状态机**待实现**。通用 `call()` 属于 IM，当前 RTC 接口中不存在。

<a id="cap-mute"></a>闭麦为**部分实现**：可以让输出 video 静音或禁用轨道，但没有统一的远端闭麦控制协议。

<a id="cap-kick"></a>RTC 内的踢出能力**待实现**。

<a id="cap-record-signal"></a>开始／停止录制信令为**部分实现**：有本地录制，没有统一的分布式录制命令和状态。

<a id="cap-end"></a>结束通过 stop/release/DELETE **部分具备**，但没有 Call 生命周期抽象。

## 源码地图

- 门面与工厂：[`rtc.js`](../../../src/rtc/rtc.js)
- Peer／会话实现：[`rtc.netstream.js`](../../../src/rtc/rtc.netstream.js)
- 约束／统计／媒体辅助：[`src/rtc`](../../../src/rtc)
- Player 适配器：[`module.rtc.js`](../../../src/player/module/module.rtc.js)

## 已知边界

- `RTC.getSupportedCodecs()` 为空。
- HTTP 请求没有从 `parameters.token` 构造 Authorization Header。
- 创建 `MediaRecorder` 时未指定 MIME 协商，精确浏览器编码／封装矩阵未验证。
- Beauty 依赖 WebGL 和 Canvas Capture；Player Chat 在 Apple WebKit 上禁用它。
- 没有自动化的协商、浏览器矩阵或重连测试。
