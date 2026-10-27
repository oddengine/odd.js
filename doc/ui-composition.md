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

保存不挂断、重拨或立即修改活动发布者。默认 RTC 为 720P_2，IM／Player 连麦为 180P_1。当前支持 profile、camera、microphone、layout；布局支持 right/top/bottom/left/grid；控制条与媒体浮窗见下文。设备 UI 当前提供系统默认／关闭，不宣称已完成设备枚举、SVC 协商或扬声器选择。

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
