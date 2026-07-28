<a id="common-sdk"></a>
# Common SDK

[English](common.md) · [SDK 地图](sdk-map.zh.md)

构建包：`odd.common`。源码：[`src/odd.js`](../../../src/odd.js)、[`src/utils`](../../../src/utils)、[`src/events`](../../../src/events)、[`src/io`](../../../src/io)。

## 模块

<a id="utilities"></a>
### 工具

共享工具箱包含对象／数组复制、类型与格式化、浏览器检测、DOM/CSS、URL、端序与位读取、AMF、Golomb、XML-to-JSON、MPD、日志、Timer、文件保存和 ServiceWorker 流式保存。

主要导出为 `odd.utils`、`odd.OS`、`odd.Kernel` 和 `odd.Browser`。

<a id="events"></a>
### 事件

`EventDispatcher` 是公共事件总线。它会为绑定的事件组创建 `on<type>` 属性，并支持普通监听和全局转发。

<a id="io"></a>
### IO

有序 IO 注册表包含 `Fetch`、`MozStream`、`MSStream`、`Websocket`、`XHR`。HTTP 加载器通过 `load(url, start, end)` 暴露字节范围；WebSocket 只用于直播。

<a id="mpd"></a>
### MPD

`utils.MPD` 可解析和更新静态／动态 MPD、Period、AdaptationSet、SegmentTimeline、URL 和分片信息。它对 Player 来说仍是**骨架**：没有 DASH 播放模块消费它。

## 功能特征

- **浏览器适配：**统一检测操作系统、内核、浏览器和运行能力，供全部 SDK 复用。
- **增量传输：**HTTP 流、字节范围、WebSocket 流、取消、进度和状态统一使用 Loader 契约。
- **运维基础：**控制台/文件/反馈日志、Timer、文件保存和 ServiceWorker 流式保存可跨产品复用。
- 统一事件词汇让加载器和所有 SDK 无需转换即可转发事件。
- 有序加载器选择隔离浏览器差异。
- URL、位流、浏览器能力、日志、Timer 和保存逻辑没有复制到产品 SDK。
- `StreamSaver` 与 `StreamWriter` 隐藏 ServiceWorker/TransformStream 生命周期。

## 插件

Common 没有 UI 插件；它提供产品 UI 插件所需的注册表和基础能力。

## 配置

| 对象 | 配置项 |
| --- | --- |
| HTTP 加载器 | `method`、`headers`、`mode`、`credentials`、`cache`、`redirect`；XHR 还有 `responseType` |
| Logger | `level`、`mode`、`url`、`interval` |
| StreamSaver | `script`、`scope`、`enable` |
| Timer 构造参数 | `delay`、`repeatCount` |

## 接口

| 参考 | 覆盖范围 |
| --- | --- |
| [已审核接口表](common-api.zh.md#接口) | 通用工具、二进制/清单、日志/保存、EventDispatcher、IO 注册表与加载器 |

## 事件列表

| 参考 | 覆盖范围 |
| --- | --- |
| [已审核事件表](common-api.zh.md#事件) | 全部公共事件组、负载契约、拼写与可达性审核 |

## 源码地图

- 事件常量和状态码：[`events.js`](../../../src/events/events.js)
- 分发语义：[`events.eventdispatcher.js`](../../../src/events/events.eventdispatcher.js)
- 加载器注册表：[`io.js`](../../../src/io/io.js)
- 工具导出：[`utils.js`](../../../src/utils/utils.js)
- MPD 模型：[`mpd.js`](../../../src/utils/mpd/mpd.js)

## 已知边界

- `EventDispatcher` 会用 `new Function` 执行字符串监听器。
- 注册位置使用 `index || length`，因此不能插入到索引零。
- HTTP Range 只是传输能力；断点状态需要产品 SDK 自己实现。
- CSS 工具里出现 `utils.foreach`，但实际导出名是 `forEach`。
