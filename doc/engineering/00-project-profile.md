# odd.js v3.0.00 工程画像

## 产品与边界

odd.js 是由 Common、IM、RTC、Player、Famicom 及可选 UI 组成的框架型浏览器 SDK 集合。App 是组合层：聊天由 IM 负责，直播／视频由 Player 负责，云游戏由 Famicom 负责，视频会议由 RTC 负责；App 只创建、挂载、移动模块 UI 并转发事件。

## v3.0.00 代码风格

- 使用全局 `odd`、IIFE、构造函数闭包、`_this` 公共方法、前导下划线私有成员及 `prototype.kind/CONF`。
- 同类模块采用统一的 `get/create/setup/stop/destroy`、事件信封、插件注册和有序构建方式。
- 保留直接领域词汇与成熟入口，不为抽象感增加别名、包装 helper 或重复检查。
- 每个 JavaScript 源文件以两个换行符结束，保证 `compile.sh` 拼接后 IIFE 之间留一个空行。
- CSS 由模块根节点属性集中控制状态；规则按根与布局、组件、状态、响应式顺序组织。
- UI 插件只协调组件与 Core；复杂 DOM 实体下沉到 `ui/components` 并提供统一生命周期接口，同名组件保持同构，功能差异保留在模块默认 layout。

## 当前跨端契约

- RTC UI：组件事件 → UI → RTC/NetStream → 根节点 `microphone/camera/sharing/calling/layout` → CSS。
- IM：`setup()` 始终连接并 attach 消息流，随后可直接发送；连接生命周期只通过 `setup()`／`destroy()` 管理。插件采用 Contacts、Conversations、Conversation、Dashboard；Conversation 用 layout 装配 Messages、Message、Composer，Dashboard 引用 Settings。
- Famicom：`play(url)` 用 `game`、`instance`、`player` 的逐级参数表达创建、加入与快速重连；`controllers` 为新连接申请手柄数量，完整 `Location` 的 `ports` 返回稳定且可不连续的端口列表，并用于 POST/PATCH/DELETE。
- 游戏输入：DataChannel 负载为 `[port, keys]`；键盘、Gamepad、移动端 Display 虚拟按钮先映射到玩家连接持有的端口，再进入同一按键位图流，Controlbar 的键位项只是 Label。
- App：IM UI 的主 Tab 就是 App 框架；IM 提供 `contacts/messages`，App 注入 `play/game/meeting`。切到联系人或消息时，最近活动媒体在右侧上方以 popup 展示；切回媒体页时媒体恢复 full，Conversation 移到右侧 mini 展示。

## 标准验证入口

- JavaScript 语法与发布产物：`bash compile.sh`
- C++ 主程序：在 odd.d 运行 `cmake --build build -j2`
- C++ 单元测试：在 odd.d 以 `-DUT=ON` 配置后构建并运行 `build-ut/tests/odd.d-ut`
- 本轮按要求不使用浏览器截图作为样式验收。
