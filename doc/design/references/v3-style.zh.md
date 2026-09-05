# v3.0.00 代码风格与设计方向

[English](v3-style.md) · [架构](architecture.zh.md)

## 框架与功能归属

odd.js 是框架型 SDK 集合。聊天归 IM，直播／点播归 Player，云游戏会话和输入归 Famicom，采集、发布、订阅和会议控制归 RTC。每项能力先在所属模块及插件中完整实现；App 只创建和呈现这些模块 UI，不复制它们的控制条或状态机。

## 事件与状态流

统一 UI 流程为：

```text
组件语义事件
    → 模块 UI 协调器
    → Core SDK / Stream 操作
    → 模块根节点状态属性
    → CSS 展示
```

根属性是可见状态的权威来源。RTC 使用 `microphone`、`camera`、`sharing`、`calling`、`layout`；媒体／游戏 UI 同样使用 `state`、`muted`、`controls`、`theater`、`fullscreen`、`presentation`。不要再用并行布尔量、Controlbar 状态和临时 class 表示同一状态；异步失败直接把根属性恢复到实际 SDK 状态。

## 接口与词汇

- 保留成熟且聚合的入口。Famicom `play(url)` 通过 `game`、`instance`、`player` 查询参数表达创建、加入和快速重连。
- IM 的连接生命周期只有 `setup()` 和 `destroy()`；`setup()` 必须完成连接和消息流 attach，使调用方随后可以直接发送，不增加第二个公开 connect 入口。
- 保留协议原词。服务端返回的 HTTP `Location` 在代码中仍叫 `location`，并作为后续 POST、PATCH、DELETE 的权威地址。
- 没有独立不变量或复用边界时，不增加别名、重复校验、adapter，以及只调用一次的错误／helper 包装。
- 不可信输入只在权威边界校验。纯英文游戏名等产品约束不需要在每一层客户端重复实现。

## 源码与 CSS 组织

- JavaScript 延续全局 `odd`、IIFE、构造函数闭包、前导下划线私有成员、`_this` 公共方法、`prototype.kind/CONF` 和有序注册。
- 插件是轻量协调器。具有独立契约的数据、DOM 和交互实体通常下沉到 `ui/components`；简单且只属于一个列表的条目可由插件直接增量管理。IM 插件固定采用 Contacts、Conversations、Conversation、Dashboard：Contacts 使用 `add/remove` 管理联系人，Conversations 使用 `add/remove/update` 管理会话摘要，Conversation 通过默认 `layout` 装配 Messages、Message、Composer，Dashboard 引用 Settings。People、Group、Contact、旧 Dialog、Workspace、组件级 Contacts/Conversations/Transcript 不再保留。
- Player、Famicom、RTC 等模块的同名组件尽量保持相同结构、事件、状态属性和生命周期；真实功能差异放在各模块自己的默认 `layout` 中。
- Dashboard 只装配 Panel 类型，Settings 继承所属模块的 Panel；`show/hide` 负责保证同一时间只展示一个面板，不用组件 `state` 代替面板可见性。组件构造参数固定为 `(name, config, logger)`，其中 `config` 保持 layout 提示词／组件名语义，Settings 数据只能由 `update(data)` 传入。Settings 的默认组在初始化时一次性构建，每组统一为 title、content 和可选 footer；`update` 以 `{groups:[{name,title,items:[{name,type,value,options}],footer}]}` 全量更新现有控件，并可为 IM 等无默认产品项的模块补建首次传入的组。Settings 不追加专用根样式类，直接使用 Panel 根据实例名生成的 `.pe-panel.settings`／`.im-panel.settings` 组合选择器控制外观。Famicom 默认分为 P1／P2 键位，Player 分为 Chat profile／摄像头／麦克风，RTC 分为 Video／Audio 且 Video 持有预览元素。
- 所有 `Event.CHANGE` 数据只包含 `name` 和 `value`；`value` 可以是 number、string、boolean 或 object。动作、键位、Tab 名称和选择索引等附加语义放入 `name` 或 `value`，不再增加 `action`、`port`、`key`、`tab`、`index` 等平级字段。
- 每个 JavaScript 源文件以两个换行符结束，使直接拼接后的 IIFE 之间保留一个空行。
- CSS 按模块根／布局、组件基础、根属性状态、响应式覆盖排序；单条规则内稳定采用尺寸／位置、布局、盒模型、文字、视觉、交互顺序。
- 多个 SDK 皮肤共存时，通过模块根 `kind` 限定通用 `pe-*` 组件。

## Famicom 输入

DataChannel 负载固定两个字节 `[port, keys]`。一个玩家连接可以申请多个手柄槽位，服务端在完整 Location 的 `ports` 列表中返回稳定且可不连续的端口；刷新重连沿用该列表，释放玩家连接才归还端口。键盘映射、Gamepad 按钮／摇杆轴和移动端 Display 虚拟按钮先将本地序号映射到已分配端口，再调用 `keyDown(port, key)` / `keyUp(port, key)`。Controlbar 中的方向和动作 Label 只是键盘提示，不是鼠标控制按钮。

Famicom Dashboard 的 stats 面板直接展示 `STATSCHANGE` 上报的 FPS、解码、丢帧、NACK、PLI、freeze 等实时字段；设置面板修改现有 `config.keyboard` 中的 P1／P2 映射，不建立第二套键盘状态。

## App 组合

App 直接以 IM UI 的主 Tab 为框架。IM 提供 `contacts` 和 `messages`，其中 Conversations 与 Conversation 共用消息页；App 只向同一 Tab 注入 `play`、`game`、`meeting`。Tab 插页接口只接收名称、页面和选项，导航项始终是空白按钮，图标由 CSS 按页面名设置，插件不再携带 `label`。直播和点播共享一个 Player 实例。切换到联系人／消息时，最近活动媒体移到右侧上方并使用 `popup`；切回媒体页时，媒体恢复全尺寸，Conversation 插件移动到右侧并使用 `mini`。事件只驱动 section 和 DOM 重新挂载，模块实例与领域状态持续存活。
