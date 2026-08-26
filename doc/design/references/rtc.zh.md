<a id="rtc-sdk"></a>
# RTC SDK

[English](rtc.md) · [v3.0.00 方向](v3-style.zh.md)

RTC 是多流 WHIP/WHEP SDK。`RTC` 拥有 publishing/subscribing 集合和统计调度；每个 `NetStream` 独占一个 PeerConnection、本地或远端 MediaStream、HTTP 资源 `Location`、candidate 更新、录制辅助和关闭生命周期。

## Core 与 NetStream

- 工厂：`odd.rtc(id?, logger?)`、`odd.rtc.create(logger?)`。
- Core：`setup(config)`、`preview(constraints, screensharing, withcamera, option)`、`publish(...)`、`play(name)`、`stop(name?)`、`destroy(reason?)`。
- 设备辅助：`getDevices`、`getCameras`、`getMicrophones`、`getPlaybackDevices`、`getSupportedCodecs`。
- NetStream 支持约束、采集、预览／发布／播放、轨道替换、美颜／混流／录制、`enabled(kind, value)`、`stream()`、统计、属性、状态、元素和关闭。

WHIP/WHEP POST 读取绝对或相对 `Location`；PATCH candidate 和 DELETE 关闭使用该资源地址。远端轨道挂到 NetStream 自己的 video 元素。

## UI 事件／状态契约

RTC UI 注册由 Button、Toggle 组件组成的三段式 Controlbar。四条主要点击路径已补齐：

| 控件 | SDK 动作 | 根属性 |
| --- | --- | --- |
| microphone | 启用／停用本地音频 track | `microphone=on/off` |
| camera | 启用／停用本地视频 track | `camera=on/off` |
| sharing | 以屏幕采集重建 preview/publish | `sharing=on/off` |
| calling | 在本地预览和 WHIP 发布之间切换 | `calling=on/off` |

`layout=right/top/grid` 控制视频布局。CSS 从这些根属性推导按钮外观和布局；共享／呼叫失败时同时恢复 Toggle 和根状态。

UI 工厂为 `odd.rtc.ui(id?, logger?)` 和 `.create(logger?)`。UI 提供 `setup`、`preview`、`publish`、`play`、`stop`、`layout`、`theater`、`fullscreen`、`presentation`、`skin`、`element`、`resize`、`destroy`。

源码：[`src/rtc`](../../../src/rtc)。
