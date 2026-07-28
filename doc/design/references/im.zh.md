<a id="im-sdk"></a>
# IM SDK

[English](im.md) · [产品目标](product-map.zh.md) · [SDK 地图](sdk-map.zh.md)

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

| 参考 | 覆盖范围 |
| --- | --- |
| [已审核接口表](im-api.zh.md#接口) | Core/UI 工厂与门面、NetConnection、NetStream、协议辅助、插件与组件 |

## 事件

| 参考 | 覆盖范围 |
| --- | --- |
| [已审核事件表](im-api.zh.md#事件) | 生命周期、连接/群组/消息状态、UI 以及间接事件与负载 |

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
