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
- core/UI 分离与同 id 配对方式和 Player、NES、Famicom 一致。

<a id="plugins"></a>
## 插件

| 插件 | 状态 | 主要职责／配置 |
| --- | --- | --- |
| `Messages` | **已验证** | 会话 Tab/Dialog 和文本消息；`layout`、嵌套 `dialog`、`visibility` |
| `Contacts` | **骨架** | 布局／组件外壳；`layout`、`visibility` |
| `Settings` | **骨架** | 布局／组件外壳；`layout`、`visibility` |

UI 组件包含 Button、Dialog、Label、Panel、Select、Slider、Tab。当前 `Dialog` 是会话编辑／展示组件，不是 Player 产品目标中的 Notify/Alert/Confirm 抽象。

## 配置

### 内核

| 配置项 | 含义 |
| --- | --- |
| `url` | IM WebSocket 端点 |
| `parameters.token` | connect 参数 |
| `maxRetries` | 重试次数；`-1` 表示不限 |
| `retryIn` | 初始随机重试延迟 |
| `maxRetryInterval` | 指数退避上限 |

`NetConnection` 还包含 ACK Window／Peer Bandwidth 默认值。`NetStream` 当前没有独立默认项。

### UI

`skin`、`plugins[]` 以及全部内核配置。插件配置由各插件的 `prototype.CONF` 合并而来。

## 接口

`join` 至 `state` 仅在消息 `NetStream` 完成绑定后挂到 IM/UI 门面。

公开 IM API 分为 Core 门面、可选 UI 门面，以及 Core 返回或暴露的 `NetConnection`/`NetStream` 实例。协议消息解析器和 UI 插件/组件契约属于实现细节。

### Core 静态接口

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `get` | id?: number, netConnection?: NetConnection, logger?: Logger \| LoggerConfig | 获取指定 id 的稳定 IM Core，不存在时创建。由 `IM.get` 实现，并通过 `odd.im` 暴露。 |
| `create` | netConnection?: NetConnection, logger?: Logger \| LoggerConfig | 使用下一个数字 id 创建 IM Core。 |

### Core 实例接口

`join` 至 `state` 在消息 `NetStream` 完成绑定后挂载。

| 方法 | 参数 | 描述 |
| --- | --- | --- |
| `id` | — | 返回注册表 id。 |
| `setup` | config?: IMConfig | 创建连接与消息流，然后建立连接。 |
| `client` | — | 返回活动 `NetConnection`。 |
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
| CHANGE | name: string, value: unknown | 选择项、标签页或滑块值发生变化。 |
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
- `Contacts` 和 `Settings` 只构建外壳，没有领域行为。
- 没有统一的用户列表、呼叫状态、闭麦、踢出或录制控制模型。
- UI 多处使用 `innerHTML`，不可信文本需要先清洗。
