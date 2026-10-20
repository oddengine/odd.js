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

保存不挂断、重拨或立即修改活动发布者。默认 RTC 为 720P_2，IM／Player 连麦为 180P_1。当前支持 profile、camera、microphone、layout；布局只列已有 right/top/grid，完整四方向媒体浮窗与控制条折叠仍待实施。设备 UI 当前提供系统默认／关闭，不宣称已完成设备枚举、SVC 协商或扬声器选择。

默认存储只在实例内存。可注入 `storage.load(key)` 和 `storage.save(key,{value,version},{expectedVersion})`；宿主实现必须原子比较版本，并为 key 划分账号、产品、模块和 schema 身份。未提供跨窗口广播／访客合并，不声称偏好已跨窗口同步。

`skin({brand,theme})` 使用 `css/odd.products.css` 的根类，只改 SDK 所有的品牌／明暗类，保留其它 class。brand 为 account/paas/live/meeting/im，theme 为 light/dark；不重建连接、不打开设备。旧字符串皮肤继续使用原前缀。

网站 Vite 已按 SDK 源清单完成组合构建；Chromium 已加载独立设置页面并保存默认值。修复了 fMP4 的未声明 STCO 局部变量，使严格模块加载可用。没有重建 SDK release 包，没有运行真实 IM／RTC／Player 服务互通，也没有编写单元测试。
