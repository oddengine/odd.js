# App SDK

[English](app.md) · [v3.0.00 方向](v3-style.zh.md)

App 是四类 SDK 能力的轻量组合层。它直接使用 IM UI 的主 Tab 作为应用骨架，只拥有板块选择、皮肤传递、模块注册、DOM 挂载和事件转发。协议、媒体、聊天、游戏输入和会议动作仍归 IM、Player、Famicom、RTC。

## 界面与归属

| Tab | 内容 | 右侧栏 |
| --- | --- | --- |
| `contacts` | IM Contacts | 最近活动媒体以 `popup` 显示在右上方 |
| `messages` | IM Conversations + Conversation | 最近活动媒体以 `popup` 显示在右上方 |
| `play` | Player（直播／点播） | IM Conversation 以 `mini` 显示 |
| `game` | Famicom | IM Conversation 以 `mini` 显示 |
| `meeting` | RTC | IM Conversation 以 `mini` 显示 |

“联系人”和“消息”由 IM 自己建立；App 只向同一个 Tab 注入“播放”“游戏”“会议”。App 不创建第二套导航。它只创建一个 Player 实例，直播／点播模式由 Player 自己决定。切换到 IM 分类时，最近活动的媒体 wrapper 被移动到右侧上方 popup；切回媒体分类时，媒体恢复到自己的页面，Conversation 插件移到右栏。所有切换都重挂载现有 wrapper，不重建模块实例。

## 接口

Core 工厂为 `odd.app(id?, logger?)`、`odd.app.create(logger?)`。Core 提供 `setup(config)`、`section(value?)`、`skin(value?)`、`module(name, instance?)`、`modules()`、`state()`、`destroy(reason?)`。

UI 工厂为 `odd.app.ui(id?, logger?)`、`odd.app.ui.create(logger?)`。UI 提供 `setup(container, config)`、`section(value?)`、`skin(value?)`、`module(name)`、`element()`、`resize()`、`destroy(reason?)`。

`events.AppEvent` 当前只定义 `app-section-change` 和 `app-skin-change`。模块事件保持原语义转发，不翻译成 App 私有 action 结构。

构建产物为 `odd.app.min.js`、`odd.app.ui.min.js`，并同时进入 `odd.min.js`。
