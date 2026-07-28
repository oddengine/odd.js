# Player 接口与事件

[English](player-api.md) · [Player SDK](player.zh.md) · [公共事件契约](common-api.zh.md#event-listener-contract)

本页依据 `src/player` 审核公开的 Core 与 UI 门面，包括仅在 `setup()` 后挂载的方法；内部扩展接口不在本页列出。

## 接口

这里只列对外的 Core 与 UI 门面。播放模块、编解码器、封装格式、插件、组件及其注册接口属于实现细节，不作为 Player SDK 实例 API。

### Core 静态接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `get` | id?: number, logger?: Logger \| LoggerConfig | 获取指定 id 的稳定 Core 实例，不存在时创建。由 `Player.get` 实现，并通过 `odd.player` 暴露。 |
| `create` | logger?: Logger \| LoggerConfig | 使用下一个数字 id 创建 Core 实例。 |

### Core 实例接口

`play` 至 `state` 在 `setup()` 完成 Core 绑定后挂载。

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `setup` | container: HTMLElement, config?: PlayerConfig | 创建并绑定播放 Model、View 与 Controller。 |
| `play` | file?: string, option?: PlaybackOptions | 选择媒体源与模块，或恢复暂停的播放。 |
| `pause` | — | 暂停当前播放模块。 |
| `seek` | offset: number | 跳转当前播放模块。 |
| `stop` | — | 停止播放并清理当前媒体源状态。 |
| `reload` | — | 重新加载当前媒体源。 |
| `muted` | status?: boolean | 读取或设置静音状态。 |
| `volume` | value?: number | 读取或设置输出音量。 |
| `definition` | index?: number | 读取或切换清晰度。 |
| `capture` | width?: number, height?: number, mime?: string | 截取当前画面并触发 `screenshot`。 |
| `record` | filename: string | 在当前播放模块支持时开始录制。 |
| `element` | — | 返回当前渲染元素。 |
| `getProperty` | key: string | 返回 `key` 对应的元信息/Model 数据。 |
| `duration` | — | 返回媒体时长，单位为秒。 |
| `state` | — | 返回当前播放状态。 |
| `destroy` | — | 销毁播放资源并移除 Core 实例。 |

### UI 静态接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `get` | id?: number, logger?: Logger \| LoggerConfig | 获取与同 id Core 配对的稳定 UI 实例。由 `Player.UI.get` 实现，并通过 `odd.player.ui` 暴露。 |
| `create` | logger?: Logger \| LoggerConfig | 使用下一个数字 id 创建 UI 实例。 |

### UI 实例接口

Core 绑定后，UI 也会转发上表中的 Core 实例接口；这里不再重复列出。

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `setup` | container: HTMLElement, config: PlayerUIConfig | 构建 UI 并初始化配对的 Core。 |
| `chat` | enable: boolean | 在插件已安装时启用或关闭聊天 UI。 |
| `danmu` | enable: boolean | 启用或关闭弹幕。 |
| `shoot` | text: string, data?: unknown | 向 Danmu 插件发送弹幕。 |
| `displayAD` | element: HTMLElement | 通过 AD 插件显示内容。 |
| `removeAD` | — | 移除 AD 插件显示的内容。 |
| `fullpage` | status?: boolean | 读取或设置铺满页面模式。 |
| `fullscreen` | status?: boolean | 读取或请求浏览器全屏。 |
| `resize` | — | 调整当前播放视图与 UI 插件尺寸。 |
| `destroy` | — | 移除 UI 资源、销毁配对的 Core 并注销 UI。 |

## 事件

所有回调接收 `{ type, data, target, srcElement, ... }`。属性列表示 `event.data` 中的字段；监听方式见 [Common](common-api.zh.md#事件监听契约) 中的 `on<type>` 与监听接口。Core 事件会转发到 UI。

### Event

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| BIND | — | Core 或 UI 门面已完成运行时接口挂载。 |
| READY | kind: string | 当前播放模块已就绪。 |
| PLAY | — | 播放开始或恢复。 |
| WAITING | — | 播放正在等待更多媒体数据。 |
| DURATIONCHANGE | duration: number | 媒体时长发生变化。 |
| LOADEDMETADATA | metadata: unknown | 媒体元信息已加载。 |
| LOADEDDATA | — | 当前帧数据已加载。 |
| CANPLAY | — | 已有足够数据开始播放。 |
| PLAYING | — | 暂停或缓冲后正在继续播放。 |
| CANPLAYTHROUGH | — | 浏览器预计能够连续播放而无需缓冲。 |
| PAUSE | timestamp: number | 播放已暂停。 |
| SEEKING | timestamp: number | 跳转操作开始。 |
| SEEKED | timestamp: number | 跳转操作完成。 |
| SWITCHING | index: number | 手动清晰度切换开始。 |
| SWITCHED | index: number | **预留：** 已声明并转发，但当前未找到派发。 |
| RATECHANGE | rate: number | 播放速率发生变化，包括低延迟追赶。 |
| TIMEUPDATE | start: number, time: number, buffered: number, duration: number | 播放位置或缓冲区发生变化，具体字段取决于模块。 |
| VOLUMECHANGE | muted: boolean, volume: number | 静音或输出音量发生变化。 |
| ENDED | — | 媒体播放结束。 |
| ERROR | name: string, message: string | 播放、媒体选择、解析、MSE 或截图失败。 |

### IOEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| LOADSTART | — | 资源加载开始。 |
| OPEN | — | 底层传输已打开。 |
| PROGRESS | buffer: ArrayBuffer, loaded: number, total: number | 收到增量资源数据。 |
| SUSPEND | — | 资源加载被挂起。 |
| STALLED | — | 资源加载停滞。 |
| ABORT | — | 资源加载被中止。 |
| TIMEOUT | — | 资源加载超时。 |
| LOAD | — | 资源加载成功。 |
| LOADEND | — | 资源加载生命周期结束。 |

### MediaEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| INFOCHANGE | info: MediaInfo | 媒体或封装信息发生变化。 |
| STATSUPDATE | stats: MediaStats | 运行时媒体统计发生变化。 |
| SEI | packet: Packet, nalu: NALUnit | 检测到 H264 补充增强信息单元。 |
| SCREENSHOT | image: string | `capture` 生成图片 Data URL。 |

### SaverEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| WRITERSTART | writer: StreamWriter | 录制写入器已打开。 |
| WRITEREND | writer: StreamWriter | 录制写入器已结束。 |

### UIEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| SHOOTING | text: string, data?: unknown | 已提交一条弹幕。 |
| FULLPAGE | status: boolean | 铺满页面状态发生变化。 |
| FULLSCREEN | status: boolean | 浏览器全屏状态发生变化。 |
| RESIZE | width: number, height: number | Player UI 尺寸发生变化。 |

### GlobalEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| CHANGE | name: string, value: unknown | 指定 UI 值发生变化。 |
| VISIBILITYCHANGE | name: string, state: 'visible' \| 'hidden' | 指定面板变为 `visible` 或 `hidden`。 |

### MouseEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| CLICK | name: string, value?: unknown | 点击指定 UI 目标。 |
| DOUBLE_CLICK | name: string | 双击指定 UI 目标。 |
| MOUSE_MOVE | name: string, value?: unknown | 指针在指定 UI 目标上移动。 |

Common 定义了 `KeyboardEvent`，但当前 Player UI 未绑定。

## 审核依据

- [`player.js`](../../../src/player/player.js)
- [`player.view.js`](../../../src/player/player.view.js)
- [`ui.js`](../../../src/player/ui/ui.js)
- [`src/player`](../../../src/player)
