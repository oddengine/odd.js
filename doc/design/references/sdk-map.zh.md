# odd.js SDK 地图

[English](sdk-map.md) · [架构](architecture.zh.md)

状态：**已验证**、**部分实现**、**骨架**、**待实现**、**风险**。

## 可点击树

- [odd.js 聚合包](architecture.zh.md#distribution)
  - [Common SDK](common.zh.md#common-sdk) — `odd.common`
    - [接口与事件](common-api.zh.md)
    - [工具](common.zh.md#utilities)
    - [事件](common.zh.md#events)
    - [IO 加载器](common.zh.md#io)
    - [MPD 模型](common.zh.md#mpd)
  - [Player SDK](player.zh.md#player-sdk)
    - [接口与事件](player-api.zh.md)
    - [内核与 MVC](player.zh.md#core)
    - [播放模块](player.zh.md#playback-modules)
      - SRC — **已验证**
      - FLV — **已验证**
      - FMP4/CMAF — **已验证**
      - RTC/WHEP — **已验证**
      - DASH — **骨架**
      - HLS JavaScript 模块 — **待实现**；原生 HLS 为**部分实现**
    - [音视频流水线](player.zh.md#av-pipeline)
    - [UI 框架与插件](player.zh.md#plugins)
  - [RTC SDK](rtc.zh.md#rtc-sdk)
    - [接口与事件](rtc-api.zh.md)
    - [门面](rtc.zh.md#facade)
    - [NetStream](rtc.zh.md#netstream)
    - [媒体辅助模块](rtc.zh.md#media-helpers)
  - [IM SDK](im.zh.md#im-sdk)
    - [接口与事件](im-api.zh.md)
    - [门面](im.zh.md#facade)
    - [传输与协议](im.zh.md#transport-and-protocol)
    - [UI 框架与插件](im.zh.md#plugins)
  - [NES SDK](nes.zh.md#nes-sdk)
    - [接口与事件](nes-api.zh.md)
    - [模拟器内核](nes.zh.md#emulation-core)
    - [Mapper 注册表](nes.zh.md#mapper-registry)
    - [UI 框架与插件](nes.zh.md#plugins)
  - [Famicom SDK](famicom.zh.md#famicom-sdk)
    - [接口与事件](famicom-api.zh.md)
    - [云游戏客户端](famicom.zh.md#cloud-game-client)
    - [输入与统计](famicom.zh.md#input-and-statistics)
    - [UI 框架与插件](famicom.zh.md#plugins)

## 构建树

```text
odd.common
├── odd.player ───── odd.player.ui
├── odd.rtc
├── odd.im ───────── odd.im.ui
├── odd.nes ──────── odd.nes.ui
└── odd.famicom ──── odd.famicom.ui

以上全部入口 ─────── release/odd.js
```

所有产品 SDK 都依赖 `odd.common`。Player 的 RTC 播放模块和 Chat 插件还依赖 `odd.rtc`；IM 与 RTC 可以共享 IM `NetConnection`。
