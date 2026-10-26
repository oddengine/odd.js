# 可靠直播播放选择

`odd.Player.Program(player, config)` 消费现有 IM 的已验证 `channelState()`，不创建或关闭 IM，也不负责 PK 判定／签名。config 指定 appId、channelAppId、businessId 和可选 change 回调。调用 apply(snapshot)、select(originalStreamId)、refresh()、destroy()。

channel.program 是频道当前状态，固定 entityId=`program-<channelAppId>`；先比较 channelGeneration，再比较跨 PK 的事件 revision。details 带业务 revision、成员、gift-amount.v1、积分和最终结果。快照／增量支持晚加入与重连；临时 unknown 不直接停当前播放。channel.gift 是可靠赠礼事实，不进入当前状态快照，不按重新读取历史触发实时赠礼动画。

Player／Player.UI 新增 select(program)：完整替换源，销毁旧模块、使旧事件代次失效、取消旧重试，保留用户暂停／停止意图、音量和静音配置。允许 sources=[] 表示当前无权威原流，随后恢复流仍遵循用户意图。Program 选择 FLV＋streamId；凭据提供器和 Routing 返回实际节点 URL，无须客户为 PK 输出逐流签发凭据。

PK active 才切到本房间 output；结束回到当前可信原 WHIP 发布。PK 流 ERROR/ENDED 后最多回退一次，普通积分事件不触发重复切源；新 PK 或明确 refresh 才重试。不会去其他房间找任意回退源。原流和 PK 流内容时间可能跳跃，允许黑屏；无 MSE 配置热换、GOP 拼接或双播放器预加载。

主播维持原 RTC 发布并使用其他公开房间自己的普通凭据订阅其原 WHEP，不能把本房间凭据用于对侧，不监听含自身声音的混流。播放器类仅处理观众选择；这个主播组合在 www sdk-host 中接线。

新增源文件已登记 compile.sh/compile.bat。仅源码审查，未生成发布 bundle、编译或运行浏览器。与本轮 odd.d/odd.x 的 channel.program/channel.gift 同时部署，不声称旧节点能识别新事件。
