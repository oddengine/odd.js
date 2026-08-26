# odd.js 架构

[English](architecture.md)

<!-- TOC -->
## 目录

- [产品组合](#产品组合)
- [目标树](#目标树)
  - [1. 模块](#1-模块)
  - [2. 功能](#2-功能)
  - [3. 插件](#3-插件)
- [构建树](#构建树)
- [功能特征](#功能特征)
  - [多实例产品](#多实例产品)
  - [Player 7×24 低延迟运行](#player-724-低延迟运行)
  - [内核和 UI 可独立部署](#内核和-ui-可独立部署)
  - [有序注册表提供扩展点](#有序注册表提供扩展点)
  - [门面隐藏对象图](#门面隐藏对象图)
  - [事件解耦各层](#事件解耦各层)
  - [协议和媒体职责分离](#协议和媒体职责分离)
  - [多种输入先收敛再进入领域逻辑](#多种输入先收敛再进入领域逻辑)
- [重复模式](#重复模式)
- [架构边界](#架构边界)
<!-- /TOC -->

## 产品组合

- [Web 媒体与通信 SDK](#构建树)
  - [Player SDK](player.zh.md#player-sdk)
  - [RTC SDK](rtc.zh.md#rtc-sdk)
  - [IM SDK](im.zh.md#im-sdk)
- [Famicom 云游戏客户端](famicom.zh.md#famicom-sdk) — **已验证**
- [复合型 App SDK](app.zh.md#app-sdk) — **已验证**

## 目标树

这棵树描述产品希望提供什么；状态描述当前仓库。每个叶子都链接到负责实现的 SDK，SDK 页面再链接到源码。

### 1. 模块

- [1.1 HTTP MPEG-4 / OGG / WebM](player.zh.md#cap-native-media) — Player / SRC — **已验证**
- [1.2 HTTP/WS-FLV](player.zh.md#cap-flv) — Player / FLV — **已验证**
- [1.3 HTTP/WS-CMAF](player.zh.md#cap-cmaf) — Player / FMP4 — **CMAF 部分实现**
- [1.4 HLS](player.zh.md#cap-hls) — Player / SRC 原生路径 — **部分实现**
- [1.5 HLS-2nd](player.zh.md#cap-hls2) — Player 目标 — **待实现**
- [1.6 MPEG-DASH](player.zh.md#cap-dash) — Common MPD + Player 目标 — **骨架**
- [1.7 WHIP/WHEP](rtc.zh.md#cap-whip-whep) — RTC + Player RTC 适配器 — **核心已验证**
  - [1.7.1 实时信令](im.zh.md#产品信令能力)
    - [即时通信](im.zh.md#cap-im) — IM — **已验证**
    - [发布／订阅](rtc.zh.md#cap-publish-subscribe) — RTC — **已验证**
    - [呼叫／接听／拒绝／超时](rtc.zh.md#cap-call-control) — RTC/IM 目标 — **状态机待实现**
    - [闭麦](rtc.zh.md#cap-mute) — RTC/IM — **部分实现**
    - [踢出](rtc.zh.md#cap-kick) — RTC/IM 目标 — **待实现**
    - [开始／停止录制](rtc.zh.md#cap-record-signal) — RTC — **部分实现**
    - [结束](rtc.zh.md#cap-end) — RTC — **部分实现**
    - [自定义消息](im.zh.md#cap-custom-message) — IM — **已验证**
  - [1.7.2 动态轨道](rtc.zh.md#cap-dynamic-tracks) — RTC — **已验证**
  - [1.7.3 美颜磨皮](rtc.zh.md#cap-beauty) — RTC — **已验证**

### 2. 功能

- [2.1 编码／Codec 目标：H264、H265、AAC、Opus](player.zh.md#playback-modules) — Player + RTC — **部分实现**
- [2.2 字幕：TTML、WebVTT、SRT](player.zh.md#cap-subtitles) — Player — **待实现**
- [2.3 智能缓冲：播放、倍速、清理阈值](player.zh.md#cap-buffer) — Player / FLV/FMP4 — **已验证**
- [2.4 动态码率：BOLA-E](player.zh.md#cap-abr) — Player 目标 — **待实现**
- [2.5 断点下载：HTTP-FLV、HTTP-FMP4、HTTP-CMAF](player.zh.md#cap-resume) — Common IO + Player — **部分基础**
- [2.6 截图：JPG/PNG](player.zh.md#cap-capture) — Player — **已验证**
- [2.7 录制](player.zh.md#cap-record) — Player + RTC — **产品矩阵部分实现**
  - [2.7.1 Chrome：WebM + VP8/VP9/AVC1/Opus/PCM](rtc.zh.md#cap-rtc-record) — RTC 浏览器录制 — **矩阵未验证**
  - [2.7.2 Safari：MP4 + AVC1/MP4A](rtc.zh.md#cap-rtc-record) — RTC 浏览器录制 — **矩阵未验证**
- [2.8 事件回调](player.zh.md#cap-events) — Common 事件 + 产品 SDK — **覆盖较广，有明确缺口**
- [2.9 多实例](player.zh.md#cap-instances) — 全部 SDK 门面 — **已验证**
- [2.10 一键换肤](player.zh.md#cap-skins) — Player UI — **部分实现**

### 3. 插件

- [3.1 Content](player.zh.md#cap-content) — Player UI 目标 — **抽象待实现**
  - [3.1.1 Live](player.zh.md#cap-content) — 当前 Player 播放映射 — **部分具备**
  - [3.1.2 WatchParty](player.zh.md#cap-content) — Player + IM 目标 — **有部分构件**
  - [3.1.3 RTC](player.zh.md#cap-content) — Player Chat + RTC 映射 — **部分具备**
  - [3.1.4 IM](player.zh.md#cap-content) — IM 构建包映射 — **部分具备**
- [3.2 Subtitle](player.zh.md#cap-subtitle-plugin) — **待实现**
- [3.3 Poster](player.zh.md#cap-poster) — **已验证**
- [3.4 Comment](player.zh.md#cap-comment) — 当前 `Danmu` — **实现已验证／名称不同**
- [3.5 Dashboard](player.zh.md#cap-dashboard) — 当前 `Display` — **目标映射部分具备**
  - [3.5.1 Metadata](player.zh.md#cap-dashboard) — **已验证**
  - [3.5.2 Stats：首帧、速率、丢帧](player.zh.md#cap-dashboard) — **已验证**
- [3.6 Logo](player.zh.md#cap-logo) — **已验证**
- [3.7 Controlbar](player.zh.md#cap-controlbar) — **核心已验证／目标控件部分具备**
- [3.8 ContextMenu](player.zh.md#cap-contextmenu) — **已验证**
- [3.9 Sidebar](player.zh.md#cap-sidebar) — **待实现**
  - [3.9.1 Userlist：呼叫、闭麦、放大](player.zh.md#cap-sidebar) — **待实现**
  - [3.9.2 Playlist](player.zh.md#cap-sidebar) — **待实现**
  - [3.9.3 Tools](player.zh.md#cap-sidebar) — **组合能力待实现**
  - [3.9.4 Settings](player.zh.md#cap-sidebar) — **当前 UI 中有骨架**
    - [3.9.4.1 Layout：主屏、分屏、宫格](player.zh.md#cap-sidebar) — **待实现**
- [3.10 Dialog](player.zh.md#cap-dialog) — **目标抽象待实现**
  - [3.10.1 Notify](player.zh.md#cap-dialog) — **待实现**
  - [3.10.2 Alert](player.zh.md#cap-dialog) — **待实现**
  - [3.10.3 Confirm](player.zh.md#cap-dialog) — **待实现**

## 构建树

```text
odd.js
├── odd.common
├── odd.im ───────── odd.im.ui
├── odd.rtc
├── odd.player ───── odd.player.ui
├── odd.famicom ──── odd.famicom.ui
└── odd.app ───────── odd.app.ui
```

## 功能特征

### 多实例产品

Player、RTC、IM、Famicom、App 都使用各自的 `get(id)` 和 `create()` 实例表。Player、RTC、IM、Famicom、App UI 通过相同 id 与内核配对，显式销毁负责释放实例所有权。

### Player 7×24 低延迟运行

FLV 和 FMP4 通过周期性清理 SourceBuffer 限制直播缓冲窗口。低延迟模式结合 1.2 倍平滑追赶和五秒硬纠偏，避免 TCP/下载积压无限累积。

### 内核和 UI 可独立部署

Player、IM、Famicom、App 都提供无界面内核包与可选 UI 包。UI 用相同数字 id 获取内核实例并转发内核事件。协议和媒体逻辑因此可以脱离 DOM 策略使用，同时又有默认 UI。

### 有序注册表提供扩展点

IO 加载器、Player 模块、编解码器、格式和 UI 插件都通过 `prototype.kind` 注册构造函数。选择逻辑由数据驱动，不依赖一个中央分支；新增实现无需修改公共门面。

### 门面隐藏对象图

`odd.player()`、`odd.rtc()`、`odd.im()`、`odd.famicom()` 从各自实例表返回稳定门面。Controller、PeerConnection、Stream、解析器和 DOM 插件等内部对象不会泄漏到顶层。

### 事件解耦各层

`EventDispatcher` 支持类型监听、全局转发、`on<event>` 回调和实例 id。Player 的 View/Controller、SDK/UI、加载器、编解码器、解析器和协议对象共用同一种事件信封。

### IM UI 作为复合 App 框架

IM UI 主 Tab 原生承载联系人和消息，Conversations 与 Conversation 共用消息页。App 只向该 Tab 注入播放、游戏和会议页面；事件选择 section 后，现有媒体 wrapper 在 full 页面与右上 popup 之间移动，Conversation 插件在消息页与媒体右栏 mini 之间移动。App 不维护第二套导航或领域状态。

### 协议和媒体职责分离

IM 将 WebSocket 帧（`NetConnection`）、逻辑管道（`NetStream`）、消息类型、命令负载和 Responder 分开。RTC 将 SDK 门面、单会话 `NetStream`、约束、统计、美颜、音量计和混流器分开。

### 多种输入先收敛再进入领域逻辑

Famicom 的一个玩家连接可以拥有多个手柄槽位。UI 按 Location `ports` 列表将键盘、Gamepad 按钮／摇杆轴和移动端 Display 控制映射到实际端口，再统一转换为 `keyDown(port, key)` / `keyUp(port, key)`；Core 将每次更新序列化为两个字节 `[port, keys]`。Controlbar 的键位项保持为不可点击的键盘提示。

## 重复模式

| 模式 | SDK | 收益 |
| --- | --- | --- |
| `get(id)` + `create()` 实例表 | Player、RTC、IM、Famicom、App 及其 UI | 多实例和稳定的 core/UI 配对 |
| `prototype.CONF` 默认值 | 全部产品 SDK 和插件 | 配置组合可检查 |
| `prototype.kind` 注册表 | Common、Player、全部 UI | 可扩展 |
| 显式状态枚举 | RTC、IM、Famicom | 统一生命周期词汇 |
| UI 转发内核事件 | Player、IM、Famicom、App | UI 保持适配层定位 |

## 架构边界

- 全局 IIFE 与拼接顺序就是模块系统，没有 ES module import。
- `compile.sh` 使用 Bash 数组并声明 `#!/usr/bin/env bash`；有序清单仍属于模块依赖契约。
- 注册表插入使用 `index || length`，当前无法指定索引 `0`。
- `EventDispatcher` 会用 `new Function` 处理字符串监听器，不可信字符串并不安全。
- 仓库没有自动化测试套件或包清单。
- 当前重构基线为提交 `v3.0.00`；需要精确约定时同时参考提交标识和 [v3 风格说明](v3-style.zh.md)。
