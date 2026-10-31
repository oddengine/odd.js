# 频道中的产品 CALL

R-119通信产品接线：私聊使用产品服务频道，群聊使用群本身频道；普通消息仍保留原会话。网站最多维持服务频道与一个群通话上下文，系统可靠通知只唤醒被邀请用户，读通话记录不打开群连接。`CallPanel.members(target,cursor)`兼容原数组，也可返回`{items,nextCursor}`逐页选择；最多1024候选，实际邀请不超过协商成员数减一。首批读取失败提供重读与取消；`onMinimize`仅收起窗口，不停止媒体。`calls().busy()`包含尚未确认的原操作，跨窗口不能据`current()===null`错误新建通话。

CALL v2会对邀请期限内仍未选端的当前受邀用户发送一次resume申请，供可靠唤醒后登记新端。已拒绝的同设备、过期邀请与v1不登记；是否准许由原分区及来源校验。来源签发的通信RTC凭据可带`callOnly:true`，仍不含流ID，由节点强制配合真实CALL参与。

新增Vue／CallPanel／Calls状态逻辑、IndexedDB本地检查通过，使用显式信令替身；没有运行真实后端或媒体互通。下文最初源码交付记录仅描述当时验证范围。

产品CALL v2沿真实频道的可靠消息运行，媒体使用频道绑定的RTC App。具名用户需要CALL权限位128、稳定deviceId和持久storageFactory；服务端协商callVersion=2后才启用。匿名和仅内存频道事件模式不支持CALL。旧静态CALL v1仍使用其原配置。

在现有频道IM setup配置加入以下部分；`routing`为已配置的共享`odd.utils.Routing`实例，`getUserMediaCredential`由客户应用提供：

```js
calls: {
    enabled: true,
    rtc: {
        participation: {
            routing,
            credentials: async (context) => {
                // context.appId 是本呼叫实际绑定的 RTC App。
                // 返回用户级凭据，支持原有 forceRefresh / signal / deadline。
                return getUserMediaCredential(context);
            },
        },
    },
}
```

凭据返回 `{product:'rtc', appId, channelAppId, userId, token, connectBefore}`，connectBefore为UTC秒。回调只取得客户用户凭据，不包裹Routing.participation；SDK负责私下领取和首次固定选址。客户私钥不进入浏览器，客户凭据不包含streamId。呼叫操作继续使用 `im.calls()`／`im.call()` 的invite、accept、cancel、leave、end及恢复接口。

SDK先取公开地域hint，被选IM设备会话私下领取selection，再请求该地域connections得到固定node／boot的callBinding。私下领取至多尝试3次，保持同requestId和原截止；不把未知结果改成另一节点新建。selection、callBinding和参与管理秘密只留内存，不进入可靠feed、IndexedDB、Cookie或日志。

每个CALL成员代次拥有独立RTC对象。客户端随机产生实际流ID；可靠CALL成员发布事实提供其他人的真实流列表。每路发布／订阅仍分别计时，不按参与对象合并收费。普通频道流目录不暴露私密CALL来源；普通频道媒体凭据也不能仅凭已知streamId绕过通话绑定。

挂断操作先停止本地媒体和发送参与DELETE，再处理可靠信令，不等待下一次心跳。即使迟到的非终态feed到达，本地停止标记也不允许同代次重新打开媒体；新代次依正常恢复规则处理。挂断请求丢失时，实际媒体关闭、节点原无媒体30秒期限和完整节点库存负责兜底；本地CLOSE不声称远端已实际释放。

凭据刷新保留固定参与URL、node／boot及callBinding，不延长原首次准入截止；既有媒体不因普通JWT轮转直接断开。呼叫结束、实际参与失效或使用截止仍会关闭本次CALL。浏览器CORS须允许 `Odd-Call-Binding`，部署与来源隔离见[节点契约](https://github.com/oddengine/odd.d/blob/main/docs/product-calls.md)。

仅源码／差异审阅，未执行SDK构建、浏览器或协议互通；release产物未重建。
