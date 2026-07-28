# odd.js 产品目标

[English](product-map.md) · [SDK 实现树](sdk-map.zh.md) · [架构](architecture.zh.md)

这棵树描述产品希望提供什么；状态描述当前仓库。每个叶子都链接到负责实现的 SDK，SDK 页面再链接到源码。

## 产品组合

- [Web 媒体与通信 SDK](sdk-map.zh.md#可点击树)
  - [Player SDK](player.zh.md#player-sdk)
  - [RTC SDK](rtc.zh.md#rtc-sdk)
  - [IM SDK](im.zh.md#im-sdk)
- [浏览器本地 NES 模拟器](nes.zh.md#nes-sdk) — **已验证**
- [Famicom 云游戏客户端](famicom.zh.md#famicom-sdk) — **已验证**

## 目标树

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

- [2.1 编码／Codec 目标：H264、H265、AAC、Opus](player.zh.md#cap-codecs) — Player + RTC — **部分实现**
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
- [3.3 Poster](player.zh.md#cap-poster) — `Poster` — **已验证**
- [3.4 Comment](player.zh.md#cap-comment) — 当前 `Danmu` — **实现已验证／名称不同**
- [3.5 Dashboard](player.zh.md#cap-dashboard) — 当前 `Display` — **目标映射部分具备**
  - [3.5.1 Metadata](player.zh.md#cap-dashboard) — **已验证**
  - [3.5.2 Stats：首帧、速率、丢帧](player.zh.md#cap-dashboard) — **已验证**
- [3.6 Logo](player.zh.md#cap-logo) — **已验证**
- [3.7 ControlBar](player.zh.md#cap-controlbar) — **核心已验证／目标控件部分具备**
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
