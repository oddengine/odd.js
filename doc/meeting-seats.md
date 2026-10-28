# 可选的 RTC 发布席位提供器

R-087 源码接口；未构建／测试或运行媒体。网站业务权限、会议编号及根账号请求留在网站；SDK 只处理技术参与实例、发布引用、有限截止和取消。

在现有 `participation` 配置旁组合：

```js
participation: {
    credentials: participationCredentials,
    route: mediaRoute,
    publishSeats: {
        reserve: async ({ operationId, createdAt, participationId, nodeId, bootId, signal }) => { /* 返回席位结果 */ },
        release: async ({ seatId, generation, signal }) => { /* 返回原席位 ending/ended */ },
        change: ({ seatId, state }) => { /* 更新业务显示；不可在这里自行确认释放 */ },
    },
}
```

reserve 与 release 必须为函数，change 可选。首次实际发布前懒申请，预览／setup／纯订阅不占席；同一参与实例的主流和共享共用原申请。reserve 返回 seatId、generation（十进制字符串）、userId、participationId、nodeId、bootId、state、connectBefore、useUntil、seatBinding。身份与分配不可改变；JWT 仅驻留内存并随原 WHIP POST 作为 `Odd-Meeting-Seat` 发送，不包含流 ID。

未知网络结果保留原 operationId／createdAt，网站同样保留原 expectedRevision；超时用 Promise.race 限定等待，取消信号传给提供器，迟到成功仍按真实归属关闭。明确 400/401/403/404/409/429 拒绝可结束本次申请，并分别报告 seat_invalid/login/forbidden/conflict/capacity；未知结果为 seat_unknown。不要将带席位分类的 AbortError 当成主动取消吞掉。

最后一个发布引用离开时请求关闭，剩余收听不占席。release 有独立有限超时，ending 不等于归还；下次发布先核对原关闭，ended 才申请新席位。缺失或已过首次兑换期的 proof 不会偷偷延长原申请。释放迟到不能复活已结束席位，授权更新也不恢复过期 seat 对象。

change 是申请／关闭结果提示，不能冒充实际发出媒体。网站以可靠发布目录的真实 active 更新“正在发布”，通过完整有界席位列表手动刷新确认 ended；查询需绑定请求开始时的 seatId，旧结果不能覆盖新申请。平台／节点仍是归还权威。

此能力不改变 PaaS 客户 JWT、CALL 或 RTC 每路分别计费；省略 publishSeats 的普通 RTC 沿原流程，受管会议节点仍独立强制校验。
