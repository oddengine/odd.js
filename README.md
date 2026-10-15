# odd.js

- [Website](https://oddengine.com)

odd.js is a modular Web SDK family for media playback, real-time communication, instant messaging, and cloud gaming. It provides a shared browser foundation together with Player, RTC, IM, Famicom, and composite App SDKs; keeps protocol and runtime logic separate from optional UI plugins; and supports multiple independently managed instances. The corresponding server-side runtime for communication, signaling, media routing, and cloud gaming is [odd.d](https://github.com/oddengine/odd.d).

odd.js 是面向媒体播放、实时通信、即时消息与云游戏的模块化 Web SDK 系列。它以共享浏览器基础库为底座，提供 Player、RTC、IM、Famicom 与复合型 App SDK，并将协议及运行时逻辑与可选 UI 插件分离，支持多个实例独立运行。通信、信令、媒体路由及云游戏所需的配套服务器为 [odd.d](https://github.com/oddengine/odd.d)。

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

### Reliable messaging storage foundation / 可靠消息存储基础

E08a adds an optional strict-durability IndexedDB adapter and UUIDv7 format
checks. This is an intermediate source component: M=1 is still disabled on the
server, and automatic send/receive/reconnect wiring is unfinished. See
[the adapter contract](example/im/storage.md). No release bundle was rebuilt
and no build, test or browser verification was performed.

E08a 增加可选的 IndexedDB 严格持久化适配器和 UUIDv7 格式检查，当前为中间源码组件；
服务端 M=1 仍未开放，自动收发／重连接线尚未完成。参见[适配器契约](example/im/storage.md)。
未重建 release，未编译、测试或运行浏览器。
