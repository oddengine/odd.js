<a id="im-sdk"></a>
# IM SDK

[English](im.md) · [产品目标](architecture.zh.md#目标树) · [架构](architecture.zh.md)

<!-- TOC -->
## 目录

- [门面](#facade)
- [传输与协议](#transport-and-protocol)
- [功能特征](#功能特征)
- [插件](#plugins)
- [配置](#配置)
  - [内核](#内核)
  - [UI](#ui)
- [接口](#接口)
  - [Core 静态接口](#core-静态接口)
  - [Core 实例接口](#core-实例接口)
  - [UI 静态接口](#ui-静态接口)
  - [UI 实例接口](#ui-实例接口)
  - [NetConnection 实例接口](#netconnection-实例接口)
  - [NetStream 实例接口](#netstream-实例接口)
- [事件](#事件)
  - [Event](#event)
  - [NetStatusEvent](#netstatusevent)
  - [UIEvent](#uievent)
  - [GlobalEvent](#globalevent)
  - [MouseEvent](#mouseevent)
- [审核依据](#审核依据)
- [产品信令能力](#产品信令能力)
- [源码地图](#源码地图)
- [已知边界](#已知边界)
<!-- /TOC -->

构建包：`odd.im`，可选 `odd.im.ui`。在线演示：[即时通信](https://oddengine.com/zh/solution/im.html)。

<a id="facade"></a>
## 门面

`IM` 管理重连策略、一个 `NetConnection` 和一个消息 `NetStream`。Stream attach 后，会把房间、权限、进程控制、消息、状态和通用 call 操作直接绑定到门面。

<a id="transport-and-protocol"></a>
## 传输与协议

| 模块 | 职责 |
| --- | --- |
| `NetConnection` | WebSocket 生命周期、固定包头、序号／ACK 窗口、Pipe 创建和路由 |
| `NetStream` | 逻辑消息 Pipe、房间／消息命令、Pipe 级 Responder |
| Message 类 | Abort、ACK Window、ACK，以及携带可选二进制负载的 JSON Command |
| `Responder` | 请求—响应命令的 result/status 回调 |
| `State` | initialized、connecting、connected、closing、closed |

协议允许一条连接承载多条逻辑 Pipe。RTC 可以挂到同一连接，同时仍使用 WHIP/WHEP 做媒体协商。

## 功能特征

- **多实例内核与 UI：**`get/create` 实例表隔离连接，并让 UI 与同 id 的 IM 实例配对。
- **房间与点对点消息：**加入/离开、单播、组播、类型化 JSON、自定义消息和可选二进制负载共用一个 Command 通道。
- **重连策略：**门面内置随机初始延迟和有上限的指数退避。
- **控制面：**权限掩码、通用请求—响应调用以及远端进程 invoke/quit，使能力不局限于聊天。
- 帧、连接、逻辑 Stream、应用门面分层清晰。
- Command 携带 JSON 参数和可选二进制负载，扩展性好。
- 请求—响应关联被隔离在 Responder map 中。
- 门面提供小型领域 API，同时保留底层传输接口。
- 重连属于门面，不污染包解析器。
- core/UI 分离与同 id 配对方式和 Player、Famicom 一致。

<a id="plugins"></a>
## 插件

| 插件 | 状态 | 主要职责／配置 |
| --- | --- | --- |
| `Contacts` | **已实现** | 通讯录插件；`add(id, type, name, avatar)`／`remove(id)` 增量管理联系人条目 |
| `Conversations` | **已实现** | 最近会话列表；提供相同的 `add/remove`，并以 `update(id, date, message)` 更新最新消息摘要 |
| `Conversation` | **已实现** | 单个会话窗口插件；按 `layout` 组合 Messages 与 Composer，并协调 IM Core 发送／接收 |
| `Dashboard` | **已实现** | 按 `layout` 引用 Settings 等设置组件；Settings 不再是插件 |

UI 组件包含 Button、Label、Tab、Avatar、Panel、Messages、Message、Composer 和 Settings。联系人及会话列表条目由对应插件直接增量管理，不再抽象 People／Group／Contact 组件。条目元素将 `id`、`type` 直接设置为属性，其中 `type` 当前为 `people` 或 `group`。Messages 是 Message 的集合组件，Message 通过 `align="left|right"` 表达消息方向；Composer 保留旧 Dialog 的表情数据。

Contacts 使用 `contacts` Tab；Conversations 与 Conversation 共用 `messages` Tab。点击联系人或最近会话时，插件发出语义事件，IM UI 再设置 Conversation 的活动对象并切换到消息 Tab。Contacts 不接受 people/groups 列表配置，Conversations 不接受 `conversations` 配置；调用方在 setup 后通过增量接口装载条目。Tab 只构建按页面名分类的空白按钮，图标由 CSS 设置，插件不再配置 `label`。

## 配置

### 内核

| 配置项 | 含义 |
| --- | --- |
| `url` | IM WebSocket 端点 |
| `parameters.token` | connect 参数 |
| `retry.delay` | 基础重试延迟；每次连接会增加 0–3 秒随机量 |
| `retry.count` | 重试次数；`-1` 表示不限 |

`NetConnection` 还包含 ACK Window／Peer Bandwidth 默认值。`NetStream` 当前没有独立默认项。

### UI

`skin`、`plugins[]` 以及全部内核配置。插件配置由各插件的 `prototype.CONF` 合并而来。

Settings 已支持由 `update({groups:[...]})` 一次传入的纵向分类；每组包含 `name`、`title`、`items` 及可选 `footer`，首次传入时构建结构，之后全量更新控件值。IM 的产品项暂不固化，建议优先按三类落地：通知（消息音、桌面通知、免打扰）、隐私与在线状态（已读回执、输入状态、黑名单）、消息与存储（回车发送、历史同步、附件自动下载和缓存清理）。摄像头、麦克风和发布 profile 仍由 RTC 或 Player Chat 设置拥有，避免 IM 重复管理媒体状态。

## 接口

`setup()` 始终立即建立连接并 attach 消息 `NetStream`；成功返回后可以直接发送消息。公开生命周期只保留 `setup()` 和 `destroy()`，不提供第二个 `connect()` 入口。`join` 至 `state` 在消息 `NetStream` 绑定时挂到 IM/UI 门面。

公开 IM API 分为 Core 门面、可选 UI 门面，以及 Core 返回或暴露的 `NetConnection`/`NetStream` 实例。协议消息解析器和 UI 插件/组件契约属于实现细节。

### Core 静态接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `get` | id?: number, logger?: Logger \| LoggerConfig | 获取指定 id 的稳定 IM Core，不存在时创建。由 `IM.get` 实现，并通过 `odd.im` 暴露。 |
| `create` | logger?: Logger \| LoggerConfig | 使用下一个数字 id 创建 IM Core。 |

### Core 实例接口

`join` 至 `state` 在消息 `NetStream` 完成绑定后挂载。

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `id` | — | 返回注册表 id。 |
| `setup` | config?: IMConfig | 创建连接与消息流，然后建立连接。 |
| `client` | — | 返回活动 `NetConnection`。 |
| `connected` | — | 返回 IM 连接是否处于 connected 状态。 |
| `join` | resourceId: string | 加入群组/资源。 |
| `leave` | resourceId: string | 离开群组/资源。 |
| `chmod` | resourceId: string, targetId: string, operator: string, mask: number | 修改成员权限掩码。 |
| `invoke` | path: string, args?: unknown, env?: Record<string, unknown>, dir?: string, timeout?: number | 调用远程服务路径。 |
| `quit` | pid: number | 请求逻辑 pipe 退出。 |
| `send` | type: string, cast: string, id: string \| undefined, data: unknown, payload?: Uint8Array | 发送类型化消息。 |
| `sendStatus` | transactionId: number, status: { level: string; code: string; description: string; info?: unknown } | 发送关联的状态响应。 |
| `call` | transactionId: number, args: Record<string, unknown>, payload?: Uint8Array, responder?: Responder | 发送关联调用。 |
| `state` | — | 返回连接状态。 |
| `destroy` | reason?: string | 关闭 IM 资源并移除 Core 实例。 |

### UI 静态接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `get` | id?: number, logger?: Logger \| LoggerConfig | 获取与同 id Core 配对的稳定 UI 实例。由 `IM.UI.get` 实现，并通过 `odd.im.ui` 暴露。 |
| `create` | logger?: Logger \| LoggerConfig | 使用下一个数字 id 创建 IM UI 实例。 |

### UI 实例接口

绑定后，UI 会转发 `client` 至 `state` 的 Core 实例接口；下表不再重复列出。

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `setup` | container: HTMLElement, config: IMUIConfig | 构建 UI 并初始化配对的 Core。 |
| `presentation` | value?: 'full' \| 'mini' \| 'popup' | 读写 UI 展示形态。 |
| `skin` | value?: string | 读写皮肤。 |
| `attach` | container: HTMLElement, presentation?: string | 将同一个 IM wrapper 重新挂载到指定容器。 |
| `attachPlugin` | kind: string, container: HTMLElement, presentation?: string | 挂载指定插件。 |
| `restorePlugin` | kind: string, presentation?: string | 将插件恢复到它由 layout 创建的原始 Tab 容器。 |
| `insert` | name: string, content: HTMLElement, option?: object | 向 IM 主 Tab 注入页面；导航按钮保持空白并由 CSS 设置图标。 |
| `active` | value?: string \| number | 读写当前主 Tab。 |
| `page` | value: string \| number | 返回指定主 Tab 页面。 |
| `element` | — | 返回当前挂载容器。 |
| `resize` | — | 调整 IM 布局与插件尺寸。 |
| `destroy` | reason?: string | 移除 UI 资源、销毁配对的 Core 并注销 UI。 |

### NetConnection 实例接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `pid` | — | 返回连接 pipe id。 |
| `uuid` | — | 存在时返回连接 UUID。 |
| `userId` | — | 返回已认证用户 id。 |
| `setProperty` | key: string, value: unknown | 保存连接元数据。 |
| `getProperty` | key: string | 返回连接元数据。 |
| `connect` | url: string, parameters?: Record<string, unknown> | 打开 WebSocket 连接并完成初始化。 |
| `process` | packet: Message | 处理收到并解码的数据包。 |
| `create` | netStream: NetStream, responder?: Responder | 创建逻辑流/pipe。 |
| `call` | pipe: number, transactionId: number, args: Record<string, unknown>, payload?: Uint8Array, responder?: Responder | 在指定 pipe 上发送关联调用。 |
| `write` | type: number, pipe: number, payload?: Uint8Array | 序列化并发送协议数据包。 |
| `state` | — | 返回连接状态。 |
| `release` | reason?: string | 释放连接。 |
| `close` | reason?: string | 关闭传输与活动 pipe。 |

### NetStream 实例接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `pid` | — | 返回逻辑 pipe id。 |
| `uuid` | — | 存在时返回流 UUID。 |
| `client` | — | 返回绑定的 `NetConnection`。 |
| `attach` | netConnection: NetConnection | 将流绑定到连接。 |
| `setProperty` | key: string, value: unknown | 保存流元数据。 |
| `getProperty` | key: string | 返回流元数据。 |
| `join` | resourceId: string | 加入群组/资源。 |
| `leave` | resourceId: string | 离开群组/资源。 |
| `chmod` | resourceId: string, targetId: string, operator: string, mask: number | 修改成员权限掩码。 |
| `invoke` | path: string, args?: unknown, env?: Record<string, unknown>, dir?: string, timeout?: number | 调用远程服务路径。 |
| `quit` | pid: number | 请求逻辑 pipe 退出。 |
| `send` | type: string, cast: string, id: string \| undefined, data: unknown, payload?: Uint8Array | 发送类型化消息。 |
| `sendStatus` | transactionId: number, status: { level: string; code: string; description: string; info?: unknown } | 发送关联的状态响应。 |
| `call` | transactionId: number, args: Record<string, unknown>, payload?: Uint8Array, responder?: Responder | 发送关联调用。 |
| `process` | packet: Message | 处理收到并解码的数据包。 |
| `state` | — | 返回流状态。 |
| `release` | reason?: string | 释放逻辑流。 |
| `close` | reason?: string | 关闭逻辑流。 |

## 事件

所有回调接收 `{ type, data, target, srcElement, ... }`。属性列表示 `event.data` 中的字段；Core 事件会转发到 UI。

### Event

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| BIND | — | 消息流完成绑定，门面命令接口可用。 |
| READY | — | 连接与消息流已就绪。 |
| ERROR | name: string, message: string | **门面预留：** 当前大多数初始化或连接失败通过 Promise 拒绝或 `NET_STATUS` 返回。 |
| RELEASE | reason?: string | 逻辑 `NetStream` 已释放。 |
| CLOSE | reason?: string | 信令连接已关闭；门面可能会先安排重连。 |

### NetStatusEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| NET_STATUS | level: string, code: string, description: string, info?: unknown | 收到连接、群组、消息、请求或流通知，包括单播与群组消息送达。 |

### UIEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| RESIZE | width: number, height: number | IM UI 尺寸发生变化。 |

### GlobalEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| CHANGE | name: string, value: unknown | 选择项、标签页或设置值发生变化；主 Tab 将稳定页面名放入 `value`。 |
| VISIBILITYCHANGE | name: string, state: 'visible' \| 'hidden' | 指定面板变为 `visible` 或 `hidden`。 |

### MouseEvent

| 类型 | 属性 | 含义 |
| :--- | :--- | :--- |
| CLICK | name: string, value?: unknown | 点击指定按钮、选择项、消息或联系人。 |
| MOUSE_MOVE | name: string, value: number | 指针在滑块上移动。 |

具体 `NET_STATUS` 状态码见 [Common 事件常量](common.zh.md#event-constants)。

## 审核依据

- [`im.js`](../../../src/im/im.js)
- [`im.netconnection.js`](../../../src/im/im.netconnection.js)
- [`im.netstream.js`](../../../src/im/im.netstream.js)
- [`src/im/ui`](../../../src/im/ui)

## 产品信令能力

<a id="cap-im"></a>即时通信**已验证**：房间加入／离开、单播／组播、文本 UI、任意数据和可选二进制负载。

<a id="cap-custom-message"></a>自定义消息通过 `send(type, cast, id, data, payload)` **已验证**。

<a id="cap-im-call"></a>通用请求—响应 `call` **已验证**，但呼叫／接听／拒绝／超时产品状态机**待实现**。

<a id="cap-im-mute"></a>`chmod` 提供通用权限掩码，但没有命名的闭麦契约或参与者状态模型：**部分实现**。

<a id="cap-im-kick"></a>`invoke`、`quit` 控制服务端进程，不是从房间踢人；踢出能力**待实现**。

## 源码地图

- 门面／重试：[`im.js`](../../../src/im/im.js)
- 传输：[`im.netconnection.js`](../../../src/im/im.netconnection.js)
- 逻辑 Stream：[`im.netstream.js`](../../../src/im/im.netstream.js)
- Message／协议常量：[`src/im/message`](../../../src/im/message)
- UI／插件／组件：[`src/im/ui`](../../../src/im/ui)

## 已知边界

- 等待中的 Responder 没有基于超时的清理。
- Contacts、Conversations、Conversation 和 Dashboard 已按职责装配；People、Group、Contact、旧 Dialog、Workspace、组件级 Contacts/Conversations/Transcript 已移除。
- 没有统一的用户列表、呼叫状态、闭麦、踢出或录制控制模型。
- UI 多处使用 `innerHTML`，不可信文本需要先清洗。
