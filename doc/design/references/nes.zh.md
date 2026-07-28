<a id="nes-sdk"></a>
# NES SDK

[English](nes.md) · [架构](architecture.zh.md)

<!-- TOC -->
## 目录

- [模拟器内核](#emulation-core)
- [Mapper 注册表](#mapper-registry)
- [功能特征](#功能特征)
- [插件](#plugins)
- [配置](#配置)
- [接口](#接口)
  - [Core 静态接口](#core-静态接口)
  - [Core 实例接口](#core-实例接口)
  - [UI 静态接口](#ui-静态接口)
  - [UI 实例接口](#ui-实例接口)
- [事件](#事件)
  - [Event](#event)
  - [IOEvent](#ioevent)
  - [MediaEvent](#mediaevent)
  - [UIEvent](#uievent)
  - [MouseEvent](#mouseevent)
  - [TouchEvent](#touchevent)
  - [KeyboardEvent](#keyboardevent)
- [审核依据](#审核依据)
- [源码地图](#源码地图)
- [已知边界](#已知边界)
<!-- /TOC -->

构建包：`odd.nes`，可选 `odd.nes.ui`。它是浏览器本地模拟器，与 Famicom 云游戏 SDK 不同。

<a id="emulation-core"></a>
## 模拟器内核

| 模块 | 职责 |
| --- | --- |
| `NES` | 生命周期、帧 Timer、Canvas／音频输出、组件组装 |
| `CPU` + opdata | 6502 执行与操作码元数据 |
| `PPU` + Name/Palette/Tile 辅助 | 扫描线、Sprite、调色板、帧输出 |
| `APU` + Channel 类 | DMC、Noise、Square、Triangle 音频 |
| `ROM` | iNES 解析与 Mapper 元数据 |
| `Keyboard` | 两个手柄的按键状态 |

<a id="mapper-registry"></a>
## Mapper 注册表

当前包含 000、001、002、003、004、005、007、011、034、066。`Mapper.get(id)` 可以选择卡带实现，无需改变 CPU/PPU/APU。

## 功能特征

- **多实例本地模拟：**每个实例独占 Canvas、音频路径、CPU、PPU、APU、ROM、Mapper 和手柄状态。
- **卡带覆盖：**Mapper 注册表支持十种 Mapper id，不需要在硬件内核中增加分支。
- **双手柄输入：**键盘、鼠标、触摸和摇杆 UI 输入统一映射到同一个手柄模型。
- **运行控制：**内核提供 ROM 加载/重载、启动/停止/复位、静音、帧输出、音频输出和 FPS 上报。
- 硬件领域拆成独立对象，由 `NES` 协调。
- Mapper 差异被隔离在注册表后。
- 帧执行和一秒一次的 FPS 上报使用独立 Timer。
- core/UI 分离，使 ROM 执行不依赖网络加载和控制界面。
- UI 将键盘、触摸、鼠标和摇杆统一为两个手柄的 Keyboard 模型。

<a id="plugins"></a>
## 插件

| 插件 | 状态 | 配置 |
| --- | --- | --- |
| `Controlbar` | **控件已验证／部分动作未实现** | `layout`、`visibility`、继承的 joystick 配置 |

Controlbar 包含摇杆、重载、截图、静音／取消静音、Select、Start、B、A。重载和截图点击处理为空，因此这两个可见动作仍是**骨架**。

UI 组件：Button、JoyStick、Label。

## 配置

| 层 | 配置项 |
| --- | --- |
| 内核 | `drawFrame`、`frameRate`、`muted`、`sampleRate` |
| UI | `skin`、按手柄分组的 `keyboard` 映射、`plugins[]` |
| 加载器选项 | 加载 ROM 时传给 Common XHR |

## 接口

本页审核公开的模拟器 Core 与 UI 门面；Mapper／插件契约以及 CPU/PPU/APU 对象仍属于内部实现接口。

这里只列对外的 NES Core 与 UI 门面。Mapper 注册、CPU/PPU/APU 对象、UI 插件与组件属于实现接口。

### Core 静态接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `get` | id?: number, logger?: Logger \| LoggerConfig | 获取指定 id 的稳定 NES Core，不存在时创建。由 `NES.get` 实现，并通过 `odd.nes` 暴露。 |
| `create` | logger?: Logger \| LoggerConfig | 使用下一个数字 id 创建 Core 实例。 |

### Core 实例接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `id` | — | 返回注册表 id。 |
| `setup` | container: HTMLElement, config?: NESConfig | 初始化 Canvas、音频、模拟器硬件、输入与定时器。 |
| `load` | buffer: ArrayBuffer | 解析 ROM、安装 Mapper 并重置模拟器。 |
| `start` | — | 开始执行帧。 |
| `stop` | — | 停止帧与音频调度。 |
| `reset` | — | 重置模拟器并开始执行。 |
| `reload` | — | 重新加载保留的 ROM。 |
| `muted` | status?: boolean | 读取或设置音频静音。 |
| `writeAudio` | samples: Float32Array \| number[] | 写入一个音频缓冲；作为 APU 回调对外挂载。 |
| `writeFrame` | buffer: Uint32Array, previousBuffer: Uint32Array | 绘制变化像素；作为 PPU 回调对外挂载。 |
| `state` | — | 返回模拟器状态。 |
| `destroy` | reason?: string | 停止并关闭资源，然后移除 Core 实例。 |

### UI 静态接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `get` | id?: number, logger?: Logger \| LoggerConfig | 获取与同 id Core 配对的稳定 UI。由 `NES.UI.get` 实现，并通过 `odd.nes.ui` 暴露。 |
| `create` | logger?: Logger \| LoggerConfig | 使用下一个数字 id 创建 UI 实例。 |

### UI 实例接口

Core 绑定后，UI 会转发 `start`、`stop`、`reset`、`reload`、`muted` 与 `state`；下表不再重复列出。

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `setup` | container: HTMLElement, config: NESUIConfig | 构建 UI 并初始化配对的 Core。 |
| `load` | file: string, option?: LoaderOptions | 加载 ROM 并将缓冲传给 Core。 |
| `resize` | — | 调整 Canvas 与 UI 插件尺寸。 |
| `destroy` | reason?: string | 中止加载、移除 UI 资源、销毁 Core 并注销 UI。 |

## 事件

所有回调接收 `{ type, data, target, srcElement, ... }`。属性列表示 `event.data` 中的字段；Core 与加载器事件会转发到 UI。

### Event

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| BIND | — | 模拟器硬件与运行时接口已完成连接。 |
| READY | — | 模拟器已准备加载 ROM。 |
| ERROR | name: string, message: string | ROM、Mapper、CPU 指令或运行时处理失败。 |
| VOLUMECHANGE | muted: boolean, volume: number | 模拟器音频静音状态发生变化。 |
| CLOSE | reason?: string | **预留：** 已绑定该事件，但当前未找到 Core 显式派发。 |

### IOEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| LOADSTART | — | ROM 加载开始。 |
| OPEN | — | ROM 传输已打开。 |
| PROGRESS | buffer: ArrayBuffer, loaded: number, total: number | 收到 ROM 数据；完整缓冲会传给 Core。 |
| SUSPEND | — | ROM 加载被挂起。 |
| STALLED | — | ROM 加载停滞。 |
| ABORT | — | ROM 加载被中止。 |
| TIMEOUT | — | ROM 加载超时。 |
| LOAD | — | ROM 加载成功。 |
| LOADEND | — | ROM 加载生命周期结束。 |

### MediaEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| INFOCHANGE | info: { fps: number } | 模拟器帧率信息发生变化。 |

### UIEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| RESIZE | width: number, height: number | NES UI 尺寸发生变化。 |

### MouseEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| MOUSE_DOWN | name: string | 按下虚拟手柄按钮。 |
| MOUSE_UP | name: string | 松开虚拟手柄按钮。 |
| CLICK | name: string | 点击指定 UI 控件。 |

### TouchEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| TOUCH_START | name: string, touches: TouchList | 虚拟手柄触控开始。 |
| TOUCH_MOVE | name: string, touches: TouchList | 虚拟手柄触控移动。 |
| TOUCH_END | name: string | 虚拟手柄触控结束。 |
| TOUCH_CANCEL | name: string | 虚拟手柄触控取消。 |

### KeyboardEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| KEY_DOWN | keyCode: number, altKey: boolean, ctrlKey: boolean, shiftKey: boolean, metaKey: boolean | **预留：** UI 已绑定，但当前原生处理器直接驱动手柄，未派发该 SDK 事件。 |
| KEY_UP | keyCode: number, altKey: boolean, ctrlKey: boolean, shiftKey: boolean, metaKey: boolean | **预留：** UI 已绑定，但当前原生处理器直接驱动手柄，未派发该 SDK 事件。 |
| KEY_PRESS | keyCode: number, altKey: boolean, ctrlKey: boolean, shiftKey: boolean, metaKey: boolean | **预留：** UI 已绑定，但当前未找到派发。 |

## 审核依据

- [`nes.js`](../../../src/nes/nes.js)
- [`ui.js`](../../../src/nes/ui/ui.js)
- [`src/nes/mapper`](../../../src/nes/mapper)

## 源码地图

- 协调器：[`nes.js`](../../../src/nes/nes.js)
- CPU/PPU/APU/ROM/Keyboard：[`src/nes`](../../../src/nes)
- Mapper：[`src/nes/mapper`](../../../src/nes/mapper)
- UI／插件／组件：[`src/nes/ui`](../../../src/nes/ui)

## 已知边界

- Mapper 覆盖有限，不支持的 Mapper id 会使 ROM 加载失败。
- 音频 Buffer 每次写入立即调度，没有长生命周期队列。
- UI 的重载和截图按钮没有实现。
- NES UI 销毁时没有移除所有已安装的 DOM 监听器。
