<a id="famicom-sdk"></a>
# Famicom SDK

[English](famicom.md) · [v3.0.00 方向](v3-style.zh.md)

Famicom 通过 WebRTC 接收云游戏音视频，通过无序、短生命周期的 DataChannel 发送控制器状态。Core 拥有会话信令与输入；UI 拥有键盘、Gamepad、移动端 Display 虚拟控制、布局和展示形态。

## 基于 Location 的会话接口

`load(game, controllers?)` 调用 `play(base + '/play?game=' + game)`，指定 `controllers` 时请求本连接需要的手柄数量；省略表示 1。`play(url)` 仍是唯一会话入口：

| URL 查询参数 | POST 语义 |
| --- | --- |
| `game` | 创建游戏实例和玩家 |
| `game + instance` | 以新玩家加入实例 |
| `game + instance + player` | 页面刷新后快速重连指定玩家 |
| 可选 `controllers=1..4` | 新玩家连接申请的手柄槽位数量；快速重连时沿用原槽位 |

服务器返回包含 `game`、`instance`、`player`、`ports` 的绝对 `Location`；`ports` 是可不连续的逗号分隔槽位列表。SDK 短期保存它用于刷新重连。传输断开只进入快速重连宽限期并保留玩家端口；PATCH 使用同一地址更新 trickle candidate；显式 DELETE 使用同一地址删除玩家连接并整体释放其端口；删除 `player`、`ports` 后再 DELETE 则销毁实例。

游戏名按产品约束为纯英文，直接拼接。SDK 不调用 `encodeURIComponent`，也不增加重复的客户端校验器。

## 输入

`Port.P1..P4` 为 `0..3`。`Key` 是方向、Start、Select、B、A 的位图。每条 DataChannel 消息固定两个字节：

```text
byte 0: port
byte 1: keys 位图
```

一个 PeerConnection 可以拥有多个端口。UI 将本地键盘／Gamepad 序号映射到 Location 的 `ports` 列表，再统一调用 `keyDown(port, key)` / `keyUp(port, key)`；移动端 Display 虚拟按钮使用列表中的第一个端口。服务端只接受该连接已分配端口的输入。Controlbar 的方向和动作项是说明键盘映射的 Label；只有移动端 Display 控件接收指针输入。

## Core 接口

- 工厂：`odd.famicom(id?, logger?)`、`odd.famicom.create(logger?)`。
- 生命周期：`setup(container, config)`、`load(game, controllers?)`、`play(url?)`、`stop()`、`destroy(reason?)`。
- 会话／输入／媒体：`location()`、`ports()`、`keyDown(port, key)`、`keyUp(port, key)`、`muted(value?)`、`state()`、`element()`、`resize(width, height)`。
- 配置包含 `base`、`channel`、`trickle`、`configuration`、媒体元素属性、loader 策略和音量／静音默认值。

## UI

工厂为 `odd.famicom.ui(id?, logger?)` 和 `.create(logger?)`。UI 绑定 Core 方法，注册 Display、Controlbar、Dashboard 插件，轮询 Gamepad，在失焦／页面隐藏时释放输入，并提供 presentation、theater、fullscreen、skin、resize、destroy。Dashboard 的 stats 面板逐字段展示 `STATSCHANGE` 上报的 `fps/decoded/dropped/nack/pli/freeze` 等实时值；Settings 按 Player 1／Player 2 分类编辑现有键盘映射。

源码：[`src/famicom`](../../../src/famicom)。服务端对应 odd.d `HttpGameHandler` 与 `FamicomPlayer`。
