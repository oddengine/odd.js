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

RTC Core 保持多流能力，RTC UI 在其上实现固定的会议模型：流 1 是摄像头和麦克风，流 2 是独立屏幕共享。两路流使用同一份 profile／约束配置，但拥有独立的发布生命周期。

| 控件 | SDK 动作 | 根属性 |
| --- | --- | --- |
| microphone | `microphone(enable)`；若流 1 正在发布则先挂断、更新 `_constraints`、再呼叫 | `microphone=on/off` |
| camera | `camera(enable)`；与麦克风使用同一条停止／更新／重发流程 | `camera=on/off` |
| sharing | `share()` 发布流 2；`cancel()` 单独停止流 2 | `sharing=on/off` |
| calling | `call()` 发布流 1；`hangup()` 单独停止流 1 | `calling=on/off` |

禁用摄像头或麦克风时，如果流 1 未发布，只更新 `_constraints`，等下一次 `call()` 使用。`play(name)`／`stop(name?)` 只管理订阅。`layout=right/top/grid` 控制视频布局。根节点属性是唯一可见状态来源，Controlbar 不镜像保存同一份状态；CSS 从根属性推导按钮外观和布局。

UI 工厂为 `odd.rtc.ui(id?, logger?)` 和 `.create(logger?)`。UI 提供 `setup`、`call`、`hangup`、`share`、`cancel`、`microphone`、`camera`、`play`、`stop`、`layout`、`theater`、`fullscreen`、`presentation`、`skin`、`element`、`resize`、`destroy`。Dashboard 的 Settings 按 Video／Audio 自上而下分类；Video 分类持有固定 `video` 预览元素，设备和 profile 修改经 Preview／Save 事件交回 UI，保存后按原发布状态重建两路流。

源码：[`src/rtc`](../../../src/rtc)。
