<a id="nes-sdk"></a>
# NES SDK

[English](nes.md) · [SDK 地图](sdk-map.zh.md)

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

| 参考 | 覆盖范围 |
| --- | --- |
| [已审核接口表](nes-api.zh.md#接口) | 工厂、Core/UI 门面、Mapper 注册表、插件与内部硬件边界 |

## 事件

| 参考 | 覆盖范围 |
| --- | --- |
| [已审核事件表](nes-api.zh.md#事件) | Core、ROM 加载、UI 输入以及已声明但不可达的事件与负载 |

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
