<a id="famicom-sdk"></a>
# Famicom SDK

[English](famicom.md) · [SDK 地图](sdk-map.zh.md)

构建包：`odd.famicom`，可选 `odd.famicom.ui`。在线演示：[FC/NES 云游戏](https://oddengine.com/zh/solution/nes-cloud-gaming.html)、[游戏房间](https://oddengine.com/zh/solution/nes-cloud-gaming-room.html)。

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

| 参考 | 覆盖范围 |
| --- | --- |
| [已审核接口表](famicom-api.zh.md#接口) | 工厂/常量、Core/UI 门面、按键/统计方法、插件与组件 |

## 事件

| 参考 | 覆盖范围 |
| --- | --- |
| [已审核事件表](famicom-api.zh.md#事件) | Core 生命周期/状态/统计、UI 显示与输入事件及负载 |

## 源码地图

- 内核：[`famicom.js`](../../../src/famicom/famicom.js)
- UI 协调器：[`ui.js`](../../../src/famicom/ui/ui.js)
- 插件／组件：[`src/famicom/ui`](../../../src/famicom/ui)
- 在线集成源码：[`www 游戏房间`](../../../../www/zh/solution/nes-cloud-gaming-room.html)

## 已知边界

- Famicom 依赖服务端匹配的 `/init`、`/join`、`/leave`、`/destroy` 语义。
- 请求固定 omit credentials，没有认证 Header 模型。
- DataChannel 输入故意使用不可靠传输，服务端必须容忍。
- `leave` 中有重复的 `var player` 声明。
- 没有自动化的多浏览器／手柄／会话资源测试。
