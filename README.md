# odd.js

聚合 App SDK 已移除。产品应用直接组合独立 Player、RTC、IM、Famicom 实例和可选 UI；巨蟹直播、天秤会议、双子通信的业务流程由网站产品层实现。`odd.min.js` 仅是独立 SDK 的合并分发文件，不提供 `odd.App`／`odd.app`。源码构建配方已更新，未重建 release。

[频道普通消息](doc/channel-messages.md)：具名用户使用稳定设备与持久存储；在线广播和可靠消息沿原消息接口，媒体发现仍使用 events。

Shared regional discovery / 共享地域入口：[中文](doc/routing.md) · [English](doc/routing.en.md)。IM、RTC、Player复用公开地域提示；媒体目标、凭据和原子分配保持各自职责。

[正常密钥轮转](doc/key-rotation.md)已接入按需重取：HTTP 明确凭据失效最多重试一次；频道 IM 新连接主动取新票据。已建立的连接不因普通换钥断开。

IM `fetch(conversationId, cursor, limit)`一次获取一页，默认50、可请求1–64条；不加查询速度／次数限制。页保存后的自动COMMIT同样免于查询限速，连接背压及原存储预算保留。实际页可因编码预算少于请求条数，继续使用nextCursor翻页。

R-075 新增[RTC 产品参与接口](doc/rtc-participation.md)：同一实例多路发布／订阅共享用户凭据与参与生命周期。节点WHIP／WHEP、独立资源管理证明和平台调度回调已有源码接线；可信调度部署、跨节点分发及运行验收仍待完成。

产品直播的WHIP／WHEP、HTTP-FLV／CMAF已接[新版App凭据与独立媒体证明](doc/live-media.md)，复用既有credentials回调；直播不注册RTC参与，按所属live产品计字节。本次仅源码接线，release未重建。

R-070 的独立视图、共享订阅、AppID 握手绑定与模块设置见 [组合接口](doc/ui-composition.md)。本轮在 dev 分支迭代；网站已运行源代码组合构建和设置页浏览器检查，实时服务联调仍未执行。

- [Website](https://oddengine.com)

odd.js is a modular Web SDK family for media playback, real-time communication, instant messaging, and cloud gaming. It provides a shared browser foundation together with independent Player, RTC, IM, and Famicom SDKs; keeps protocol and runtime logic separate from optional UI plugins; and supports multiple independently managed instances. The corresponding server-side runtime for communication, signaling, media routing, and cloud gaming is [odd.d](https://github.com/oddengine/odd.d).

odd.js 是面向媒体播放、实时通信、即时消息与云游戏的模块化 Web SDK 系列。它以共享浏览器基础库为底座，提供 独立的 Player、RTC、IM、Famicom SDK，并将协议及运行时逻辑与可选 UI 插件分离，支持多个实例独立运行。通信、信令、媒体路由及云游戏所需的配套服务器为 [odd.d](https://github.com/oddengine/odd.d)。

## Community

- QQ 群：528109813
- Skype: live:670292548
- Email: <670292548@qq.com>

## License

BSD 3-Clause License ([NOTICE](https://github.com/oddengine/odd.js/blob/master/NOTICE))

### Signed admission v2

IM accepts short signed tickets as well as legacy opaque tickets. The IM example
uses /session im.admissionVersion to avoid periodic v1 room renewal in v2; the
business session still has an expiry. Live-room creation and explicit timed /
permanent restrictions replace the old ambiguous banned/muted member writes.
An active subscription may request a fresh ordinary grant after a low-frequency
restriction event; closed subscriptions and media publishers are not resurrected.

For credentials.version=2, native HLS loads the signed manifest URL directly and
refreshes its proof at 75% of playbackUntil, without playback POST/PATCH/DELETE.
Refreshing replaces the native media URL and can affect continuity; this was not
exercised in a browser. v1 behavior below remains available. External DASH clients
can use the same signed GET URL; no native DASH module is included.

### Protected native HLS (v1 compatibility)

SRC supports protected HLS on browsers with native HLS playback. Supply an
explicit `streamId`, a configured manifest URL, `mode: 'live'`, and an async
`credentials(context)` callback. The context includes protocol `HLS`, format
`cmaf` or `mpegts`, connectionId, decimal-string generation, `renew`, and signal.
Forward only the media API fields; keep connectionId/generation unchanged when
renew is true. Return the backend credential response including playbackUntil.

SRC opens a bounded playback session, uses per-session HttpOnly cookies and
`crossOrigin = 'use-credentials'`, renews before expiry, and stops the permission
on stop, error, ended or destroy. Changing sources cancels pending work. A lost
DELETE is bounded by the node's playback lifetime. Renewal does not reload the
video or allocate each fragment. Configure exact media-server CORS and a
same-site HTTPS deployment; cookie restrictions still apply. No DASH decode
module or HLS software decoder is added, and no release bundle is rebuilt.

See `example/player/protected-hls.md` for the source-level integration example.
This delivery was reviewed as source only; no build, test or browser was run.

### Reliable messaging / 可靠消息

E08a connects optional strict-durability IndexedDB storage, partition-bound
UUIDv7 sends, durable receive/COMMIT and reconnect recovery to the M=1 server
source. See [configuration and the storage contract](example/im/storage.md).
The existing UI remains M=0. No release bundle was rebuilt and no build, test
or browser verification was performed.

E08a 已接通可选 IndexedDB、分区 UUIDv7、先落盘后确认及原 ID 重连恢复的 SDK／服务端源码；
现有 UI 仍走 M=0。参见[接入及适配器契约](example/im/storage.md)。
未重建 release，未编译、测试或运行浏览器。
