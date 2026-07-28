# IM 接口与事件

[English](im-api.md) · [IM SDK](im.zh.md) · [公共事件契约](common-api.zh.md#event-listener-contract)

`join` 至 `state` 仅在消息 `NetStream` 完成绑定后挂到 IM/UI 门面。

## 接口

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

具体 `NET_STATUS` 状态码见 [Common 事件常量](common-api.zh.md#事件常量)。

## 审核依据

- [`im.js`](../../../src/im/im.js)
- [`im.netconnection.js`](../../../src/im/im.netconnection.js)
- [`im.netstream.js`](../../../src/im/im.netstream.js)
- [`src/im/ui`](../../../src/im/ui)
