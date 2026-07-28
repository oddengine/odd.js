# RTC 接口与事件

[English](rtc-api.md) · [RTC SDK](rtc.zh.md) · [公共事件契约](common-api.zh.md#event-listener-contract)

当前源码没有 RTC `call()` 方法；通用远程调用属于 IM，旧 RTC 文档中的 `call()` 已过期。

## 接口

当前源码没有 RTC UI 门面。公开 API 由 Core 静态接口、Core 实例门面，以及 preview、publish、play 返回的 `NetStream` 对象组成。

### Core 静态接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `get` | id?: number, netConnection?: NetConnection, logger?: Logger \| LoggerConfig | 获取指定 id 的稳定 RTC Core，不存在时创建。由 `RTC.get` 实现，并通过 `odd.rtc` 暴露。 |
| `create` | netConnection?: NetConnection, logger?: Logger \| LoggerConfig | 使用下一个数字 id 创建 RTC Core。 |
| `getDevices` | logger?: Logger \| LoggerConfig | 枚举全部媒体设备。 |
| `getCameras` | logger?: Logger \| LoggerConfig | 枚举视频输入设备。 |
| `getMicrophones` | logger?: Logger \| LoggerConfig | 枚举音频输入设备。 |
| `getPlaybackDevices` | logger?: Logger \| LoggerConfig | 枚举音频输出设备。 |
| `getSupportedCodecs` | logger?: Logger \| LoggerConfig | **骨架：** 接口已存在，但当前实现没有返回结果。 |

### Core 实例接口

`state` 在 `setup()` 时挂载。

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `id` | — | 返回注册表 id。 |
| `setup` | config?: RTCConfig | 初始化 RTC 门面与统计定时器。 |
| `client` | — | 返回可选的 IM 连接。 |
| `preview` | constraints?: MediaStreamConstraints, screenshare?: boolean, withcamera?: boolean, option?: MixerOptions | 创建并返回本地预览 `NetStream`。 |
| `publish` | constraints?: MediaStreamConstraints, screenshare?: boolean, withcamera?: boolean, option?: MixerOptions | 创建预览并通过 WHIP 发布。 |
| `unpublish` | — | 释放全部发布流。 |
| `play` | resourceId: string | 创建并返回订阅 `NetStream`。 |
| `stop` | resourceId?: string | 停止一个或全部订阅。 |
| `state` | — | 返回 RTC 门面状态。 |
| `destroy` | reason?: string | 释放全部流并移除 Core 实例。 |

### NetStream 实例接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `pid` | — | 返回本地 pipe id。 |
| `uuid` | — | 存在时返回流 UUID。 |
| `client` | — | 返回绑定的 IM 连接。 |
| `attach` | netConnection?: NetConnection | 创建 PeerConnection 并绑定信令。 |
| `setProperty` | key: string, value: unknown | 保存流元数据。 |
| `getProperty` | key: string | 返回流元数据。 |
| `applyConstraints` | constraints: MediaStreamConstraints | 将约束应用到已有本地轨道。 |
| `setCamera` | deviceId: string | 选择摄像头，并在支持时替换活动视频轨。 |
| `setMicrophone` | deviceId: string | 在活动约束中选择麦克风。 |
| `setProfile` | profile: string | 应用命名的采集配置。 |
| `setResolution` | width: number, height: number | 更新视频分辨率约束。 |
| `setFramerate` | fps: number | 更新视频帧率约束。 |
| `setBitrate` | bitrate: number | 更新最大发送码率。 |
| `getUserMedia` | constraints: MediaStreamConstraints | 采集摄像头和/或麦克风。 |
| `getDisplayMedia` | constraints: DisplayMediaStreamOptions | 采集屏幕媒体。 |
| `addTrack` | track: MediaStreamTrack, stream: MediaStream | 向 PeerConnection 添加发布轨道。 |
| `replaceTrack` | track: MediaStreamTrack, stopprevious?: boolean | 替换匹配的发送轨道。 |
| `removeTrack` | sender: RTCRtpSender | 从 PeerConnection 移除发送器。 |
| `createStream` | screenshare?: boolean, withcamera?: boolean, option?: MixerOptions | 创建摄像头/麦克风或组合屏幕媒体。 |
| `preview` | screenshare?: boolean, withcamera?: boolean, option?: MixerOptions | 必要时创建媒体并绑定到视频元素。 |
| `publish` | — | 通过 WHIP 协商并发布本地媒体。 |
| `beauty` | enable: boolean, constraints?: BeautyConstraints | 启用或关闭 WebGL 美颜处理。 |
| `beautyEnabled` | — | 返回当前美颜状态。 |
| `play` | resourceId: string, mode?: string | 通过 WHEP 协商只接收播放。 |
| `stop` | name?: string | 停止并释放流。 |
| `record` | filename: string, ondata?: (chunk: Blob) => void | 使用 `MediaRecorder` 录制流。 |
| `getTransceivers` | — | 返回 PeerConnection 的 transceiver。 |
| `getSenders` | — | 返回 PeerConnection 的 sender。 |
| `getReceivers` | — | 返回 PeerConnection 的 receiver。 |
| `volume` | — | 返回归一化音量计数值。 |
| `getStats` | — | 返回解析后的 PeerConnection 统计。 |
| `state` | — | 返回流状态。 |
| `release` | reason?: string | 释放远端 WHIP/WHEP 资源并在本地关闭。 |
| `close` | reason?: string | 停止轨道、录制、媒体与 PeerConnection。 |

## 事件

所有回调接收 `{ type, data, target, srcElement, ... }`。属性列表示 `event.data` 中的字段。

### Event

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| BIND | — | RTC 初始化完成，运行时接口可用。 |
| READY | — | RTC Core 已就绪。 |
| ERROR | name: string, message: string | **Core 预留：** 当前大多数失败通过 Promise 拒绝返回。 |
| RELEASE | reason?: string | `NetStream` 已释放远端与本地资源；Core 消费该事件以更新流集合。 |
| CLOSE | reason?: string | **Core 预留：** 关闭处理器存在，但当前未注册。 |

### NetStatusEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| NET_STATUS | level: string, code: string, description: string, info?: unknown | 收到发布/播放状态，包括轨道发布、播放、取消发布与停止通知。 |

### SaverEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| WRITERSTART | writer: StreamWriter | `NetStream` 录制写入器已打开。 |
| WRITEREND | writer: StreamWriter | `NetStream` 录制写入器已结束。 |

原生协商、轨道、ICE 与连接状态回调由内部处理，不属于 SDK 事件类型。

## 审核依据

- [`rtc.js`](../../../src/rtc/rtc.js)
- [`rtc.netstream.js`](../../../src/rtc/rtc.netstream.js)
- [`src/rtc`](../../../src/rtc)
