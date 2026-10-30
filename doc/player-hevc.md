# Player H.265 播放

FLV/FMP4 收到真实 HEVC 配置后，先探测精确的 MSE codec。浏览器不支持或初始化、追加、解码失败时，同一节目自动切到 FFmpeg 7.0.1 WASM Worker；不在两条路径之间来回切换。MSE 优先使用浏览器的媒体能力，但 API 返回支持不代表一定使用硬件解码。

```js
player.setup(container, {
    autoplay: true,
    muted: true,
    hevc: { url: '/sdk-hevc/' },
    playlist: [{
        type: 'FLV', // 或 FMP4；HLS/SRC、RTC 不走此回退
        vod: false,
        sources: [{ url: 'https://example.com/live.flv' }],
    }],
});
```

`compile.sh` / `compile.bat` 将 Worker、scalar/SIMD 模块与 WASM 复制到 `release/wasm/hevc/`。默认相对于载入 SDK 的脚本定位；打包器、跨域脚本或自定义部署请显式指定 `hevc.url`。目录必须可从页面按 Worker/模块加载规则访问，`.js/.mjs` 使用 JavaScript MIME，`.wasm` 使用 `application/wasm`。CSP 需要允许该 Worker、模块与 WebAssembly。www 源码插件在开发和生产环境统一提供 `/sdk-hevc/`。未走软解时不下载解码器；不需要 SharedArrayBuffer、COOP/COEP 或多线程部署。

## 呈现与接口

FLV/FMP4 的 `element()` 返回稳定的容器。需要画面、播放位置或原生全屏能力时，请使用：

- `position()` → `{ time, rate }`，时间为秒。
- `frame()` → `{ source, width, height }` 或 `null`；`source` 可以是 video 或 canvas，截图立即消费，不持有历史帧。
- `capabilities()` → `{ capture, nativeFullscreen }`；`nativeFullscreen` 为可原生全屏的 video 或 `null`。

`play/pause/seek/muted/volume/capture/record/destroy` 与现有事件保持。SRC/RTC 仍返回 video。canvas 支持截图和容器全屏；仅支持视频原生全屏的设备使用剧场布局，不构造 canvas→video 的二次媒体管线。录制保存收到的压缩流，不录制降级后的屏幕。

音频仍由浏览器 MSE 解码，使用 audio.currentTime 作主时钟；纯视频用 performance.now。音频自动播放被限制时返回可恢复的 play 错误，等待用户点击播放，不当作网络重试。无可用原生 AAC/Opus 解码能力时明确报错，不静音冒充完整播放。

## 缓冲、调度与降级

`live/vod.bufferLength`、`maxBufferLength`、`maxPlaybackLength` **全部是秒**。直播默认起播 0.5、前向 3、回退 10 秒；点播前向/回退默认 30 秒。maxPlaybackLength 原有分钟注释已纠正，运行数值没有扩大 60 倍。

压缩样本按 DTS 缓存、按需送入 Worker，视频按 PTS 在 requestAnimationFrame 中呈现。通常提前约 2 帧、20–100 ms；待显示帧最多 3 张，并同时受字节预算限制。FFmpeg 内部的参考图像和重排图像另计，不能理解为整个解码器只有 3 张图片。显示后立即归还 YUV buffer，纹理与可转移缓冲复用，不缓存解码后的回退历史。

| hevc 配置 | 默认 | 用途 |
|---|---:|---|
| mode | auto | 原生优先；wasm 可用于排查、验证 |
| maxEncodedBytes | 64 MiB | 压缩视频、音频及保留的音频片段总预算 |
| maxFrameBytes | 24 MiB | 待显示 YUV buffer 总预算，与 3 帧取较小值 |
| maxPixels | 16 Mi 像素 | 单帧尺寸硬上限 |
| maxPacketBytes | 16 MiB | 单次解码输入硬上限 |
| loadTimeout | 10000 ms | 初始化、flush 重置及单次在途解码超时 |

WASM 线性内存初始 64 MiB、上限 512 MiB，单路使用独立实例。表中的预算不包含浏览器 MSE、FFmpeg DPB、GPU 和网络内部缓存。单个 GOP/帧无法安全容纳时明确失败，不无限扩容。

正常情况下只丢已解码的过期显示帧；连续算力不足后跳到真正 IDR/BLA/CRA，并丢弃被跳过的依赖链。严重不足时只尝试随机访问帧，允许 PPT，音频/主时钟继续前进。恢复有滞回。CPU 不足不反复转圈，只有真实媒体不足才等待起播水位；视频数据有时间戳缺口时，从新的随机访问点恢复。

从 CRA 重新进入时抑制它关联的 RASL；连续播放正常经过后续 CRA 时保留对应 RASL。缓存内 seek flush 后重新解码，目标前帧不呈现，连续 seek 只接受最新代次；暂停意图保持。压缩历史按完整 GOP 清理，返回的 `timeupdate.start` 才是实际可回退起点；当前 GOP 可能跨越时间水位，但始终受字节硬限约束。

直播超过 maxBufferLength 时仅在剩余缓冲仍不少于 bufferLength 加 150 ms 余量的随机访问点追赶；没有合适点则保留播放，不跳完立即等待。HTTP 点播在前向缓存满足后暂停读取，取消可解除等待；WebSocket 沿推送语义消费并受相同硬预算限制。

## 格式与验证边界

- FLV：CodecID 12，以及 enhanced hvc1/hev1 的 SequenceStart、CodedFrames、CodedFramesX；有符号 CTS、B 帧、序列变化。metadata 不作为视频包送解码。
- FMP4：有限长度的普通/扩展 box，未加密单视频＋可选单音轨，hvc1/hev1、AAC/Opus、tfdt 0/1、trex/tfhd 默认值、多 trun、trun v1 有符号 CTS、明确数据偏移；mdat 按片段增量提取样本，不整块缓存大媒体体。
- 软件渲染：WebGL 2，Main/Main10 SDR YUV420，limited/full range、BT.601/709/2020 矩阵；色彩元数据取自解码器。已识别的 PQ/HLG 明确拒绝；不提供 HDR tone mapping、只存在于容器中的独立色彩/HDR 解释或非 420 渲染。
- 不包含 DASH、软件 HLS、加密/多视频/非 fragmented MP4、远程任意位置 Range seek、软件音频和原生 PiP。

验证命令与 C/WASM 重建见 [解码器说明](../wasm/hevc/README.md)。已验证真实 Chromium Worker/WebGL/MSE 音频、Main/Main10、暂停/seek、降级、字节/帧预算、CRA/RASL、切块解析和失败释放；合成低分辨率样本与注入延迟不代表手机或 1080p/4K 实时性能保证。实际硬解设备、Safari/iOS 和生产直播仍需部署环境验收。
