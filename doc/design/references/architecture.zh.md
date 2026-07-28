# odd.js 架构

[English](architecture.md) · [产品目标](product-map.zh.md) · [SDK 地图](sdk-map.zh.md)

## Distribution

[`compile.sh`](../../../compile.sh) 构建一份共享基础、五个产品 SDK、四个可选 UI 包以及一个聚合包。

| 层 | 发布包 | 源码根目录 | 依赖 |
| --- | --- | --- | --- |
| 基础 | `odd.common` | `src/odd.js`、`src/utils`、`src/events`、`src/io` | 浏览器 |
| Player 内核 | `odd.player` | `src/player/av`、`src/player/module`、`src/player/player*` | Common；RTC 模块还依赖 RTC |
| Player UI | `odd.player.ui` | `src/player/ui` | Player；部分插件依赖 RTC/IM |
| RTC | `odd.rtc` | `src/rtc` | Common |
| IM 内核 | `odd.im` | `src/im`，不含 `ui` | Common |
| IM UI | `odd.im.ui` | `src/im/ui` | IM |
| NES 内核/UI | `odd.nes`、`odd.nes.ui` | `src/nes` | Common |
| Famicom 内核/UI | `odd.famicom`、`odd.famicom.ui` | `src/famicom` | Common |
| 聚合 | `odd.js` | 以上所有发布包 | 全部 |

仓库中的 release 文件是生成物；源码和 `compile.sh` 的证据优先级更高。

## 从产品到实现

```text
产品目标
  └── 所属 SDK
      └── 公共门面
          └── 运行模块或插件
              └── 浏览器／网络原语
```

例如：HTTP/WS-FLV → Player → `odd.player` → FLV 模块 → IO 加载器 + FLV 解析器 + AAC/AVC 编解码器 + FMP4 重封装 + MediaSource。

## 功能特征

### 多实例产品

Player、RTC、IM、NES、Famicom 都使用各自的 `get(id)` 和 `create()` 实例表。Player、IM、NES、Famicom UI 通过相同 id 与内核配对，显式销毁负责释放实例所有权。

### Player 7×24 低延迟运行

FLV 和 FMP4 通过周期性清理 SourceBuffer 限制直播缓冲窗口。低延迟模式结合 1.2 倍平滑追赶和五秒硬纠偏，避免 TCP/下载积压无限累积。

### 内核和 UI 可独立部署

Player、IM、NES 和 Famicom 都提供无界面内核包与可选 UI 包。UI 用相同数字 id 获取内核实例，转发内核事件，并在 `Event.BIND` 后绑定门面方法。协议和媒体逻辑因此可以脱离 DOM 策略使用，同时又有默认 UI。

### 有序注册表提供扩展点

IO 加载器、Player 模块、编解码器、格式、NES Mapper 和 UI 插件都通过 `prototype.kind` 注册构造函数。选择逻辑由数据驱动，不依赖一个中央分支；新增实现无需修改公共门面。

### 门面隐藏对象图

`odd.player()`、`odd.rtc()`、`odd.im()`、`odd.nes()`、`odd.famicom()` 从各自实例表返回稳定门面。Controller、PeerConnection、Stream、解析器和 DOM 插件等内部对象不会泄漏到顶层。

### 事件解耦各层

`EventDispatcher` 支持类型监听、全局转发、`on<event>` 回调和实例 id。Player 的 View/Controller、SDK/UI、加载器、编解码器、解析器和协议对象共用同一种事件信封。

### 协议和媒体职责分离

IM 将 WebSocket 帧（`NetConnection`）、逻辑管道（`NetStream`）、消息类型、命令负载和 Responder 分开。RTC 将 SDK 门面、单会话 `NetStream`、约束、统计、美颜、音量计和混流器分开。

### 多种输入先收敛再进入领域逻辑

NES 和 Famicom UI 将键盘、鼠标、触摸、摇杆和手柄统一转换为很小的内核按键接口。Famicom 对按键做引用计数，避免一个输入源松开仍被另一个输入源按住的键。

## 重复模式

| 模式 | SDK | 收益 |
| --- | --- | --- |
| `get(id)` + `create()` 实例表 | Player、RTC、IM、NES、Famicom 及其 UI | 多实例和稳定的 core/UI 配对 |
| `prototype.CONF` 默认值 | 全部产品 SDK 和插件 | 配置组合可检查 |
| `prototype.kind` 注册表 | Common、Player、NES、全部 UI | 可扩展 |
| 显式状态枚举 | RTC、IM、NES、Famicom | 统一生命周期词汇 |
| UI 转发内核事件 | Player、IM、NES、Famicom | UI 保持适配层定位 |

## 架构边界

- 全局 IIFE 与拼接顺序就是模块系统，没有 ES module import。
- `compile.sh` 声明 `/bin/sh`，却使用更接近 Bash 的数组语法，构建可移植性有限。
- 注册表插入使用 `index || length`，当前无法指定索引 `0`。
- `EventDispatcher` 会用 `new Function` 处理字符串监听器，不可信字符串并不安全。
- 仓库没有自动化测试套件或包清单。
- 源码版本为 `2.5.15`，仓库提交却标为 `v2.5.16`；需要精确基线时应使用提交标识。
