# 独立窗口与设置

R-070 源码入口仍为 IIFE、`odd` 全局及现有构建清单。完整 UI 自建实例时保留所有权；网站只负责组合和业务接口。

## 借用 IM

```js
var view = odd.IM.UI.createView(connectedIM, {
    kind: 'Conversation',
    container: document.querySelector('#conversation'),
    skin: { brand: 'im', theme: 'light' }
});
await view.open({ type: 'user', id: canonicalUserID, name: displayName });
// 只销毁这个窗口，不销毁 IM 或其它窗口。
view.destroy();
```

kind 支持 Conversation、Conversations、Contacts、CallPanel 和 Settings。前四种使用既有组件；Settings 使用 `odd.utils.SettingsPanel`，要求提供 `config.settings`。Contacts 目录仍需宿主从授权接口取得并通过既有 add 方法提供；不伪造服务端联系人。

完整 `IM.UI.setup(container,{instance:connectedIM,ownsInstance:false,...})` 可借用已连接实例。独立 Conversation 的共享注册表按实例、目标和订阅参数引用计数；迟到的成功会在引用为零时释放，最后一个窗口关闭才退订。直接由宿主管理订阅的旧 `manageSubscriptions:false` 保持不变。

配置 `IM.setup({appId,...})` 后，credentials 上下文包含 appId；权威握手 ext 必须匹配 appId、scope 和 `product:"im"`，否则拒绝。AppID 不替代鉴权；此模式需要服务端 App 握手支持，不能用于尚未接通的新产品服务。

## 设置与皮肤

`IM.UI`、`RTC.UI`、`Player.UI` 的 `settings()` 返回 Settings；宿主也可创建 `new odd.utils.Settings({module:'rtc'})` 管理下一实例的默认参数。`read()` 返回 effective/defaults/version/capabilities；`validate()` 只校验，`preview()` 只在显式调用后启动独立设备流，`cancel()/destroy()` 仅释放自身预览。

```js
var settings = rtcUI.settings();
var state = settings.read();
await settings.save({ profile: '720P_2' }, {
    expectedVersion: state.version,
    scope: 'next-session'
});
```

保存不挂断、重拨或立即修改活动发布者。默认 RTC 为 720P_2，IM／Player 连麦为 180P_1。当前支持 profile、camera、microphone、layout；布局支持 right/top/bottom/left/grid；控制条与媒体浮窗见下文。输入设备支持枚举、系统默认／关闭；播放输出始终跟随系统，不提供扬声器选择。SVC／Simulcast 的设置接线仍待做。

默认存储只在实例内存。可注入 `storage.load(key)` 和 `storage.save(key,{value,version},{expectedVersion})`；宿主实现必须原子比较版本，并为 key 划分账号、产品、模块和 schema 身份。未提供跨窗口广播／访客合并，不声称偏好已跨窗口同步。

`skin({brand,theme})` 使用 `css/odd.products.css` 的根类，只改 SDK 所有的品牌／明暗类，保留其它 class。brand 为 account/paas/live/meeting/im，theme 为 light/dark；不重建连接、不打开设备。旧字符串皮肤继续使用原前缀。

R-070 曾以网站 Vite 按当时的 SDK 源清单完成组合构建，Chromium 加载独立设置页面并保存默认值。该历史证据不覆盖后续 R-079。修复了 fMP4 的未声明 STCO 局部变量，使严格模块加载可用。没有重建 SDK release 包，没有运行真实 IM／RTC／Player 服务互通，也没有编写单元测试。

## 媒体控制条与布局（R-079）

Player／RTC 仍用 `plugins: [{kind:'Controlbar', layout, labels}]` 定制，layout 保留 `[Type:name=value]` 与三个 `|` 分段。Player 左右分组，RTC 三段合为居中操作组；宿主可省略没有对应业务能力的操作。默认 SDK 文案为英文，网站通过 layout 和 labels 提供中文。

```js
rtcUI.layout('left'); // right / top / bottom / left / grid
// 初始布局使用 setup(..., {layout:'left'})；保存下一次默认仍用 settings.save。
```

四向布局将其他视频放在主画面内的可滚动浮窗列；grid 平铺已有视频。屏幕共享及已有主持／说话人排序保留，只移动 DOM，不新建发布或订阅。Player 的浮窗属于原 Chat 插件；网站外部聊天与 PK 监看仍由原会话管理。

控件按实际容器宽度把低优先级动作移入“更多”，复用同一节点和事件，窗口极小时核心操作可横向滚动。选择布局或清晰度打开单选菜单；方向键、Home/End、Escape 和焦点返回由 SDK 管理。音量／播放进度支持键盘与指针操作，无 DVR 的直播仍不显示可拖动时轴。焦点、拖动或菜单打开时保持控制条可见；隐藏控件退出 Tab 顺序，媒体根保留可访问的唤出按钮，触屏点媒体空白处可切换显示。

`labels` 可提供 more、close、controls、show、layout、volume、timebar 和各控件的名称。`IM.UI.createView(null,{kind:'Settings',settings,labels,...})` 的 labels 可替换设置表单的标题、选项和状态文案；不改变设备权限、持久化或下一会话生效语义。

R-079 仅修改源码和 Linux／Windows 拼接清单，未生成 release，未编译、测试、启动浏览器或验证实际媒体与键盘交互。跨窗口偏好同步、设备枚举和 SVC 仍未完成。

## 本机偏好与设备列表（R-080）

`Settings` 保留现有读写方法，新增只读 `devices()`：通过浏览器枚举摄像头／麦克风，返回 `{kind,deviceId,label}`，不启动采集、不上传设备列表。`describe().devices` 表示枚举能力，设备名称为空不代表采集已授权。预览仍需显式 `preview(draft)`；设备缺失或权限拒绝作为实际错误返回，不静默换设备。

存储可选实现 `subscribe(key,listener)`，listener 仅提供最新版本；Settings重新读取，不从通知直接接受配置。返回解绑函数，在Settings.destroy时调用。Settings沿EventDispatcher发送CHANGE：`{name:'settings',reason:'saved'|'loaded',value:read()}` 或 `{name:'settings-error',error:{name,message}}`。旧未注入storage的实例继续只保留内存。存储实现必须在事务完成后返回，expectedVersion和写入比较必须原子；原有load/save签名不变。

SettingsPanel保留未保存草稿；其他实例改变默认值时提示加载最新设置，显式“加载最新并放弃修改”才覆盖草稿。设备变化重新枚举，保留已保存但不可用的ID；刷新／权限错误有恢复操作。保存只影响下次会话；面板关闭停止本Settings对象的独立预览，不停止发布流。

网站提供单独IndexedDB适配，key为schema／账号身份域／subject／产品／模块，不和IM消息存储共库。每key仅一条当前值，最多512条本机身份组合，达到上限时拒绝新增key，已有key仍可更新；不自动删除记录或重用版本。BroadcastChannel只传key/version，不包含设备ID或配置；没有此能力时可通过窗口focus或手动加载恢复。组织不是个人设备偏好的所有者。游客与账号分key，只有显式采用才按账号当前观察版本保存。

网站媒体创建等待本机设置加载完成，并在异步边界检查所属账号与会话；同账号后续加载复用对象。存储不可用时可以重试或明确选择仅本次会话；不会伪装持久成功。完整CALL业务接线仍以实际产品入口为准，存了IM偏好不等于相关呼叫入口已开通。SVC／Simulcast 设置待接；扬声器选择按 R-081 用户决定取消。

## R-081 输入设备与发布失败

仅选择 camera／microphone，输出交给系统，不新增 outputDevice、audioOutput 或 setSinkId。RTC UI、Player Chat 和 IM CallMedia 使用保存的具体输入 ID 时传 deviceId.exact；设备不可用／权限拒绝／占用由发布 Promise 返回，不静默换设备。默认空 ID 仍由浏览器选择；屏幕共享移除输入 deviceId，由浏览器选择共享表面。

NetStream 跟踪自己采集的原始轨道，包括 beauty／mixer 上游。发布中的采集轨道 ended 沿既有 NetStream.Failed 通知，info.operation 为 capture，info.kind 标明轨道类型，info.error 保留错误。RTC 先转发原因再关闭该 NetStream；不广播致命 ERROR 来终止所有观看。普通设备结束为 NotReadableError，共享结束为 CaptureEndedError。准备期间结束由发布 Promise 拒绝；正常静音和短暂 mute 不当作 ended。关闭移除采集监听并停止轨道，迟到的采集结果立即回收。

这些是源码行为说明，未执行构建、测试或真实浏览器／设备验证。

## R-082 发布编码默认值

加载RTC模块时，Settings在原字段之外保存既有`video`及`codecpreferences`结构。video沿`simulcast`／`svc`独立开关及`encodings`数组；不另造扁平媒体配置。新配置深复制，旧本机记录缺新字段时补模块原默认，不自动重写或丢弃旧偏好。RTC UI原默认H264优先和单编码保持；Player／IM沿其原RTC默认。独立RTC UI、Player Chat更新未来NetStream配置，IM自有实例更新calls.rtc对象的未来CALL默认；活动NetStream已复制配置，不重拨。借用的IM实例由宿主配置下次CALL，面板不偷偷修改外部所有者。

`RTC.Encodings.validate(video,codecpreferences)`复用原NetStream参数校验；`describe()`只读浏览器声明能力，不创建PC或保证协商；`preset(profile,simulcast,svc,mode)`生成明确选择的配置。标准多路预设沿已有示例high／medium／low、缩放1／2／4、码率1:1/3:1/8，低路至多15fps；最高路受profile上限，总上行会更高。两开关可组合，SVC仅AV1；模式沿核心支持集合，L1T1不表示分层。

SDK面板显示编码偏好、开关、模式及限制。未编辑编码时保留宿主自定义RID／各路参数；切换开关或模式才套预设。已存但当前未声明支持的选择可见、不静默降级；实际发布继续由既有answer／getParameters核对，不支持就失败并局部清理。预览只检查输入采集。Windows清单同步新增helper并补入既有participation依赖；未生成release、构建或运行设备测试。

R-080仍仅源码与diff审阅，未编译、测试、启动浏览器或设备，不将IndexedDB事务、跨窗口和权限分支称为运行通过。

## Local capture and recording tools (R-083)

Player UI keeps capture and local recording in its own Controlbar, including the existing overflow menu. `tools` supplies localized labels and result messages; the SDK defaults are English. The product mounts the same UI and passes Chinese strings. Unsupported actions remain focusable with `aria-disabled`, an explanatory name and a guarded action. A local tool result never replaces the playing/waiting/error state of the media.

`capture(width?, height?, mime?)` returns an image data URL or an empty string. It requires a decoded video frame and a 2D canvas; drawing and export failures emit `ERROR` with `{name, message, operation:'capture', recoverable:true}`. Invalid dimensions and captures above 16 megapixels fail before canvas allocation. `SCREENSHOT` still carries `{image}`. The UI provides an explicit Save capture link; generating an image does not prove the browser saved a file.

`record(filename)` returns a Promise for the existing StreamWriter. Player FLV and supported fragmented MP4 paths save locally; SRC and the Player RTC adapter reject with `NotSupportedError`. RTC NetStream has its separate MediaRecorder-based `record(filename, ondata?)` API. A stored/default publishing codec does not grant local recording support. Preparation, waiting for the first frame, recording, finishing and cancelled/failed/completed are distinct UI states. Finish requests graceful close; Cancel aborts this recording. Cancelling preparation invalidates its result and aborts a late writer; the preparation remains bounded by its original deadline.

Writer states are `INIT → START → CLOSING → END`. `close()` is idempotent and starts bounded draining; `abort()` cancels only this writer. `WRITEREND` now fires once after a terminal result, with `{outcome:'completed'|'aborted'|'failed', error?}` and the original writer as `srcElement`. This is an explicitly approved change from the old immediate-close event. `writer.result` exposes that result. `CHANGE` with `{name:'recording', value:{state:'closing'}}` describes the closing transition. Runtime errors retain `ERROR` and carry `operation:'record', recoverable:true`. Handle identity must be checked before clearing the current writer. `completed` means the SDK's byte stream closed successfully, not durable disk storage; the UI asks the user to inspect browser downloads.

Player Controller, Player UI and Program PK fallback ignore these classified local errors for playback recovery. Actual source/decoder errors retain their normal behavior. Stopping or switching media closes its local recording without waiting for the download; the returned writer can report its independent terminal result after its old media UI/module is gone. A media owner never destroys another instance's worker registration.

See [local recording delivery](local-recording.md) for configuration, worker deployment and producer details. This round was reviewed in source only; no build, browser, device, download or media interoperability run was performed.
