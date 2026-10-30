# FFmpeg 7.0.1 HEVC 解码器

Player 的 FLV/FMP4 已接入原生优先、WASM 回退、原生音频主时钟和有界 YUV 渲染，接入配置、预算与限制见 [播放说明](../../doc/player-hevc.md)。本目录同时保持独立 C/WASM 构建和验证能力。

`decoder.c`/`decoder.h` 封装 FFmpeg send/receive API，只启用 HEVC 解码；不包含 FFmpeg 命令行、网络、文件系统、解封装、转码、音频解码或渲染。`dist` 同时提供 scalar 和 SIMD 两份 ES module/WASM；每个实例单线程、独立内存，无 SharedArrayBuffer 要求。Main/Main10 的像素格式、PTS、时长和色彩元数据由解码器输出。

## 重建

推荐安装 Docker 后运行：

```sh
./wasm/hevc/build.sh /path/to/FFmpeg-n7.0.1
# 或使用随仓库提供的未修改原始源码包
./wasm/hevc/build.sh
```

脚本自动取得固定 Emscripten 3.1.64 镜像（版本＋digest），复制源码到隔离构建目录，分别编译 scalar/SIMD，生成 `dist/manifest.json` 校验记录。已有配置的源码只在副本中 distclean，不改用户输入目录。源码归档校验 SHA-256 和 RELEASE；镜像获取需要网络，真正的编译容器使用 `--network none`，不下载额外依赖。默认并行4任务，可用 `ODD_HEVC_JOBS` 调整。

因此不需要在新环境手动安装/配置 emcc、FFmpeg 开发包或其他编解码库；需要 Bash、Docker 和准备好的 FFmpeg 源码。没有任何编译工具/容器运行环境时，单独的 FFmpeg 源码不能自行生成 WASM。

已安装 Emscripten 3.1.64 时可跳过 Docker：

```sh
./wasm/hevc/build.sh --local /path/to/FFmpeg-n7.0.1
```

本机模式还需要 make、Python 3、tar、sha256sum 和标准 Unix 工具，FFmpeg构建路径不能含空白；Docker入口使用固定容器路径。构建中间文件只写 `.build/hevc`（Git忽略）；输出只有 `dist`，不将大型原生库或工具链提交到仓库。已有 `compile.sh` 的 JS 拼接流程不自动重编 FFmpeg。

## C/WASM 所有权

1. `odd_hevc_create(hvcC, length, maxPixels, maxPacketBytes)`。配置被复制；可释放传入的临时 hvcC。空配置仅用于后续 Annex B 自带参数集的流。调用者必须提供完整access unit，而不是任意网络分片。
2. `odd_hevc_packet(decoder, length)`分配带FFmpeg零填充的输入内存，调用者将压缩包写入此地址。它由解码器持有，不得free。返回0时读`odd_hevc_error`。
3. `odd_hevc_send(decoder, pts, dts, duration)`，单位均为毫秒，PTS/DTS允许NaN表示未知。返回0已接收；返回1时先receive/release，再以同一待发送包和时间戳重试；负数为错误。禁止覆盖pending包。
4. `odd_hevc_receive`返回0后最多借用**一张**输出AVFrame。`odd_hevc_frame`获取头文件枚举字段，`plane/stride`提供平面地址/行跨度；不得假设紧凑排列。重复receive会返回busy，避免无意覆盖未消费的帧。
5. 读取/拷贝完后`odd_hevc_release`。底层可能仍因参考关系持有图像，这是FFmpeg的DPB，不是外部显示缓存。需要预备2—3张显示帧时由上层有界池管理，不在C中无限累积。
6. EOF调用`odd_hevc_drain`，按AGAIN处理后继续receive至返回2。seek/新序列调用`flush`丢弃pending输入、当前输出及旧参考/重排；`destroy`释放实例。destroy后旧句柄不可再用。

所有可能增长WASM内存的调用后重新读取`module.HEAPU8`等视图；旧ArrayBuffer可能失效。不得转移WASM堆本体。内部时间单位为微秒，避免传到JS时依赖BigInt ABI。

`frame(FORMAT)`为1/2时分别表示YUV420P/YUV420P10LE；其他格式返回0，上层需明确支持或拒绝，不能按420直接渲染。色彩枚举沿FFmpeg 7.0.1。解码得到Main10/HDR数据不代表已有HDR色调映射。

用于浏览器时通过HTTP(S)提供同源mjs/wasm资源，WASM应使用`application/wasm`类型；页面CSP须允许相应模块Worker与WebAssembly执行。资源权限/CSP失败应向宿主明确报告，不退回到主线程同步解码。Player 已提供独立生产 Worker、SIMD 探测及 scalar 回退，构建脚本统一复制运行资产。

线性内存初始64MiB、上限512MiB，malloc失败返回错误；该上限不是每路正常占用。像素上限最多16Mi像素，单包上限最多64MiB，由调用者传入更小预算。真正进程/浏览器内存还包含压缩缓存、JS转移池和GPU纹理。Worker终止才能确定释放整个WASM实例；线性内存不会随每次release缩小。

## 验证

```sh
node wasm/hevc/test/decoder.mjs
# 可选浏览器Worker检查，另需Playwright和Chromium
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node wasm/hevc/test/browser.mjs
# 可选重生成合成样本；需要原生FFmpeg 7.0.1/ffprobe及libx265
python3 wasm/hevc/test/make-fixtures.py --ffmpeg /path/ffmpeg --ffprobe /path/ffprobe
```

随仓库包含小型合成Main/Main10样本及原生FFmpeg像素摘要；覆盖B帧、CRA/RASL、send背压、持有帧保护、flush/drain、20轮重复重播、输入大小限制。样本不依赖外部视频。`browser.worker.mjs`仅为独立解码验证入口；实际播放器 Worker 位于`src/player/av/av.hevc.worker.js`。小样本比对不是1080p/4K实时性能验收。

完整播放器验证（先运行 `compile.sh`，需要 terser；已包含合成码流）：

```sh
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node wasm/hevc/test/playback.mjs
PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node wasm/hevc/test/boundaries.mjs
# 可选重建 AV 封装样本；不需要 S3、后端或真实直播源
FFMPEG=/path/to/ffmpeg bash wasm/hevc/test/make-playback-fixtures.sh
```

`playback.mjs`验证真实 FLV/FMP4＋AAC、Main10、原生选择/初始化失败回退、AVC 不加载 WASM、快速 seek、暂停、截图与 EOF。`boundaries.mjs`验证 1/7/257/65536 字节输入切块、CRA 恢复、8/10bit 色阶、单帧预算、注入 200 ms 解码开销后的关键帧降级、直播追赶与失败释放。测试输出保存在 `/tmp/hevc-*-report.json`；没有把本机性能当作产品 SLA。

## 源码与许可

FFmpeg原始n7.0.1源归档随`vendor`提供，SHA-256为`8dab1da0c7ebccb2dce99265901f22ac40f8e0fbbe4a89a368d7645f2e79caa0`，来源：https://github.com/FFmpeg/FFmpeg/archive/refs/tags/n7.0.1.tar.gz 。可直接取源码修改/重编/替换WASM，不依赖平台私有工具。

此C适配层和FFmpeg构建产物按LGPL-2.1-or-later提供，见`licenses`及原始源码中各文件许可；不是将FFmpeg改为odd.js根目录的BSD许可。构建未启用GPL/nonfree组件。Emscripten生成胶水/运行时、musl和compiler-rt按各自原有许可，相关声明一并保存在`licenses`。重新分发时一并提供本目录源码、构建方法与适用许可，保留可重建/替换能力。
