<a id="famicom-sdk"></a>
# Famicom SDK

[English](famicom.md) · [架构](architecture.zh.md)

<!-- TOC -->
## 目录

- [云游戏客户端](#cloud-game-client)
- [功能特征](#功能特征)
- [输入与统计](#input-and-statistics)
- [插件](#plugins)
- [配置](#配置)
  - [内核](#内核)
  - [UI](#ui)
- [接口](#接口)
  - [Core 静态接口](#core-静态接口)
  - [Core 实例接口](#core-实例接口)
  - [UI 静态接口](#ui-静态接口)
  - [UI 实例接口](#ui-实例接口)
- [事件](#事件)
  - [Event](#event)
  - [NetStatusEvent](#netstatusevent)
  - [MediaEvent](#mediaevent)
  - [UIEvent](#uievent)
  - [MouseEvent](#mouseevent)
  - [TouchEvent](#touchevent)
- [审核依据](#审核依据)
- [源码地图](#源码地图)
- [已知边界](#已知边界)
<!-- /TOC -->

构建包：`odd.famicom`，可选 `odd.famicom.ui`。在线演示：[FC/NES 云游戏](https://oddengine.com/zh/solution/nes-cloud-gaming.html)。

<a id="cloud-game-client"></a>
## 云游戏客户端

Famicom 是 WebRTC 单向接收的云游戏客户端。它通过 HTTP SDP 端点创建或加入服务端游戏实例，接收音视频，并通过无序、短生命周期的 DataChannel 发送一个字节的手柄状态。

| 模块 | 职责 |
| --- | --- |
| `Famicom` | 会话生命周期、信令请求、PeerConnection、媒体／Video、DataChannel 输入、Cookie、统计 |
| `Famicom.UI` | DOM 外壳、插件注册表、键盘／触摸／手柄输入、全屏／分享流程 |

## 功能特征

- **多实例云游戏：**独立客户端可以创建或加入不同的服务端游戏实例。
- **四玩家槽位：**玩家槽归一化、实例/槽位 Cookie 和分享链接支持 P1 到 P4 分配。
- **低延迟媒体与输入：**单向接收 WebRTC 承载音视频，无序短生命周期 DataChannel 承载紧凑手柄状态。
- **统一控制与遥测：**键盘、触摸、摇杆和 Gamepad 收敛到一个按键 API，并上报 FPS、NACK、PLI、丢帧和卡顿增量。
- `init`、`join`、`leave`、`destroy` 明确表达服务端资源所有权。
- 所有输入源在网络上统一为一个 bitmask。
- 按键引用计数避免键盘、触摸和手柄输入互相错误释放。
- 按键状态立即发送，并每 40ms 刷新，在响应性和丢包恢复之间取平衡。
- core/UI 分离，使会话控制不依赖默认控件。
- 统计归一化为适合游戏的 FPS、NACK、PLI、丢帧、卡顿。

<a id="input-and-statistics"></a>
## 输入与统计

按键为 `up`、`down`、`left`、`right`、`start`、`select`、`btn_b`、`btn_a`。UI 将 `KeyboardEvent.code`、Gamepad 按钮／摇杆轴、鼠标／触摸按钮和可选 4/8 向摇杆统一映射到这些按键。

浏览器支持 Codec Preferences 时，客户端优先选择 Opus 和 H264 packetization-mode 1／constrained-baseline 能力。

<a id="plugins"></a>
## 插件

| 插件 | 状态 | 主要职责／配置 |
| --- | --- | --- |
| `Display` | **已验证** | 游戏菜单、分享、实时统计；`layout`、`open`、`autohide`、`timeout`、`stats`、`visibility` |
| `Controlbar` | **已验证** | 移动端控制；`layout`、`mobileonly`、`visibility` |

UI 组件为 Button、JoyStick；两个插件都会收到顶层 joystick 配置。

## 配置

### 内核

| 分组 | 配置项 |
| --- | --- |
| 信令／资源 | `url`、`msid`、`game`、`instance`、`player`、`playerSlot` |
| 媒体 | `autoplay`、`controls`、`muted`、`playsinline`、`audio`、`video` |
| RTC／数据 | `dataChannel`、`iceServers`、`iceTransportPolicy`、`bundlePolicy` |
| HTTP | `loader.name`、`loader.mode`、`loader.credentials` |

### UI

`skin`、`keyboard`、`gamepad.buttons`、`gamepad.threshold`、`joystick.center`、`joystick.direction`、`plugins[]`，并与全部内核配置合并。

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

## 源码地图

- 内核：[`famicom.js`](../../../src/famicom/famicom.js)
- UI 协调器：[`ui.js`](../../../src/famicom/ui/ui.js)
- 插件／组件：[`src/famicom/ui`](../../../src/famicom/ui)
- 在线集成源码：[`www 云游戏`](../../../../www/zh/solution/nes-cloud-gaming.html)

## 已知边界

- Famicom 依赖服务端匹配的 `/init`、`/join`、`/leave`、`/destroy` 语义。
- 请求固定 omit credentials，没有认证 Header 模型。
- DataChannel 输入故意使用不可靠传输，服务端必须容忍。
- `leave` 中有重复的 `var player` 声明。
- 没有自动化的多浏览器／手柄／会话资源测试。
