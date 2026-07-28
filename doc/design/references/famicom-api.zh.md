# Famicom 接口与事件

[English](famicom-api.md) · [Famicom SDK](famicom.zh.md) · [公共事件契约](common-api.zh.md#event-listener-contract)

## 接口

这里只列对外的 Famicom Core 与 UI 门面。UI 插件和组件契约属于实现细节。

### Core 静态接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `get` | id?: number, netConnection?: unknown, logger?: Logger \| LoggerConfig | 获取指定 id 的稳定 Famicom Core，不存在时创建。由 `Famicom.get` 实现，并通过 `odd.famicom` 暴露。 |
| `create` | netConnection?: unknown, logger?: Logger \| LoggerConfig | 使用下一个数字 id 创建 Core 实例。 |

### Core 实例接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `id` | — | 返回注册表 id。 |
| `setup` | container: HTMLElement, config?: FamicomConfig | 创建只接收视频并初始化 Core。 |
| `video` | — | 返回只接收视频元素。 |
| `load` | game: string, mediaStreamId: string | `init` 的兼容别名。 |
| `selectPlayer` | playerSlot?: number \| string | 读取或选择目标玩家槽位。 |
| `init` | game?: string, mediaStreamId?: string | 创建服务器游戏实例并协商 WebRTC。 |
| `join` | instance?: string, player?: string | 加入已有游戏实例并协商 WebRTC。 |
| `leave` | — | 释放当前玩家占位与本地 PeerConnection。 |
| `destroy` | reason?: string | 销毁持有的服务器资源、在本地关闭并移除 Core 实例。 |
| `keyDown` | key: string | 按下按键并发送变化后的手柄掩码。 |
| `keyUp` | key: string | 松开按键并发送变化后的手柄掩码。 |
| `key` | key: string, pressed: boolean | 分派给 `keyDown` 或 `keyUp`。 |
| `keys` | state?: number | 读取或设置完整手柄状态。 |
| `muted` | status?: boolean | 读取或设置视频静音。 |
| `state` | — | 返回会话状态。 |
| `getStats` | selector?: MediaStreamTrack | 返回 PeerConnection 统计并触发紧凑的视频增量。 |

### UI 静态接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `get` | id?: number, logger?: Logger \| LoggerConfig | 获取与同 id Core 配对的稳定 UI。由 `Famicom.UI.get` 实现，并通过 `odd.famicom.ui` 暴露。 |
| `create` | logger?: Logger \| LoggerConfig | 使用下一个数字 id 创建 UI 实例。 |

### UI 实例接口

Core 绑定后，UI 会转发游戏/会话/输入/媒体控制相关的 Core 接口；下表不再重复列出。Core 析构接口以 `destroyGame` 暴露，使 `destroy` 保持只清理 UI 的语义。

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `setup` | container: HTMLElement, config: FamicomUIConfig | 构建 UI、输入轮询与配对的 Core。 |
| `fullpage` | status?: boolean | 读取或设置铺满页面模式。 |
| `fullscreen` | status?: boolean | 读取或请求浏览器全屏。 |
| `resize` | — | 调整视频与 UI 插件尺寸。 |
| `destroyGame` | reason?: string | 调用转发的 Core/服务器析构接口。 |
| `destroy` | reason?: string | 移除 UI/输入资源并注销 UI。 |

## 事件

所有回调接收 `{ type, data, target, srcElement, ... }`。属性列表示 `event.data` 中的字段；Core 事件会转发到 UI。

### Event

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| BIND | — | Core 会话与媒体接口可用。 |
| READY | — | 客户端已准备初始化或加入游戏。 |
| ERROR | name: string, message: string | 信令、HTTP、SDP、Peer 或会话状态处理失败。 |
| VOLUMECHANGE | muted: boolean, volume: number | 输出音频状态发生变化。 |
| CLOSE | reason?: string | 游戏会话已关闭。 |

### NetStatusEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| NET_STATUS | level: string, code: string, description: string, info?: unknown | 收到 PeerConnection 或媒体轨道状态通知。 |

### MediaEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| STATSUPDATE | stats: FamicomStats | 每区间的紧凑游戏视频统计发生变化；`stats` 包含 `fps`、`nack`、`pli`、`droppedFrames`、`freezes` 与 `interval`。 |

### UIEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| FULLPAGE | status: boolean | 铺满页面状态发生变化。 |
| FULLSCREEN | status: boolean | 浏览器全屏状态发生变化。 |
| RESIZE | width: number, height: number | Famicom UI 尺寸发生变化。 |

### MouseEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| MOUSE_DOWN | name: string | 按下游戏控制按钮。 |
| MOUSE_UP | name: string | 松开游戏控制按钮。 |
| CLICK | name: string | 点击指定游戏控制按钮。 |

### TouchEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| TOUCH_START | name: string, touches: TouchList | 摇杆触控开始。 |
| TOUCH_MOVE | name: string, touches: TouchList | 摇杆触控移动。 |
| TOUCH_END | name: string | 摇杆触控结束。 |
| TOUCH_CANCEL | name: string | 摇杆触控取消。 |

键盘与手柄输入会直接规范化为 `keyDown`/`keyUp` 调用，不会单独派发 SDK 事件。

## 审核依据

- [`famicom.js`](../../../src/famicom/famicom.js)
- [`ui.js`](../../../src/famicom/ui/ui.js)
- [`src/famicom/ui`](../../../src/famicom/ui)
