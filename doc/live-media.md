# 产品直播浏览器接入

沿用`credentials(context)`回调接入WHIP发布、WHEP播放、HTTP-FLV和HTTP-CMAF播放。产品为live时按成功出口字节计量，WHEP不会注册RTC参与或累计RTC分钟；RTC产品仍使用[participation](rtc-participation.md)。

## 凭据与调度

回调负责从业务后端取得已有频道用户JWT与平台可信调度结果。一个用户JWT可复用多路，SDK不会要求客户逐流重签；平台内部scheduler密钥不进入浏览器。没有产品凭据回调的原协议入口不在本页范围。

context含protocol、direction、streamId、connectionId、instanceId、operationId、createdAt、deadline、signal、generation、url；WHIP另含audio、video、purpose。instanceId等于本次连接的安全随机UUID；generation是SDK取消／异步请求代，不是服务端流代次。发布streamId由发布方提供，浏览器SDK未指定时在发布前生成随机UUID；发布和订阅的调度结果都必须回显请求中的streamId，平台不得替换。HTTP播放器的source必须显式提供streamId；`mode`为`live`。

这里的回调是SDK调用接入方提供的JavaScript函数，不是odd.d回调odd.x鉴权。函数可以返回已缓存的用户JWT，并按需要向可信调度获取连接信息；每路调用不等于每路重签用户凭据。streamId只随技术调度传递，不加入客户JWT，签发用户凭据也不依赖生成流ID的接口。

返回对象：

```javascript
{
    product: 'live',
    token: userToken,
    connectBefore: admissionDeadlineSeconds,
    appId: liveAppId,
    channelAppId: channelId,
    userId: userId,
    nodeId: selectedNode,
    bootId: selectedBoot,
    streamId: selectedStream,
    instanceId: context.instanceId,
    generation: placementGeneration, // 规范十进制字符串，1至2^53−1
    url: assignedHttpsUrl,
    // ticket: publicationTicket,    // 仅WHIP发布必填，订阅不返回
}
```

url是完整媒体URL，末段为`<streamId>`，HTTP-FLV为`<streamId>.flv`，HTTP-CMAF为`<streamId>.mp4`。只接受HTTPS，不带用户名、密码、查询或fragment；App／频道／boot／stream／instance为非零小写UUID，nodeId为1–128个字母、数字、点、下划线或短横线。回调结果不能修改本次instance或发布／订阅流。App与频道ID不能相同。

同一回调可以封装凭据复用与平台选址，但不能直接暴露内部调度API。发布预占重试使用context给出的固定operationId／createdAt（毫秒时间戳字符串），请求须遵守deadline并传递signal；取消或超时会中止凭据请求，新一次连接使用新instanceId。订阅目录返回的发布者userId／instanceId不可当作订阅者身份。用户JWT、平台调度票据、SDK独立媒体证明分别承担用户准入、发布槽证明和技术实例管理。

## 请求与关闭

SDK生成256位随机媒体证明，内存保留；POST／GET发送Bearer用户JWT及Odd-Media-Boot、Instance、Generation、Proof，WHIP另带Placement、Purpose。HTTP-FLV／CMAF使用原流式Fetch，清除loader里残留的授权及RTC／媒体身份头，强制无Cookie、禁止重定向、no-store。第一段数据前沿原准备截止取消请求；HTTP连接关闭即结束播放。

WHIP／WHEP使用有取消、字节上限的Fetch：SDP响应最多1MiB，PATCH／DELETE回复最多4KiB，最多32个普通请求并为DELETE保留一个槽。Location必须精确等于POST URL加`/instanceId`。管理请求只发送独立媒体Proof＋Boot及If-Match，不继续发送共享用户JWT。

发POST前已知精确管理URL，因此POST超时、失败或响应丢失时仍能尝试有界DELETE；取消不能证明服务器没有受理，节点超时及真实关闭仍承担最终回收。回调迟到不得创建媒体，关闭不会等待远端释放才报告本地终态。凭据和证明不进入URL或日志。

ICE候选先进入有界队列，POST及远端SDP成功后才串行PATCH，并逐次使用最新ETag；不在凭据准备期丢弃候选或向尚未建立的资源发送PATCH。队列最多64项、单项4Ki字符、合计64Ki字符，关闭立即清空；PATCH失败结束本次媒体，关闭后的迟到回调不得恢复发送。未启用trickle时不建候选队列。

## 源码与边界

`utils.MediaRequest`复用同一身份／请求头校验；`RTC.NetStream`继续原采集、PeerConnection和媒体生命周期；FLV／FMP4模块继续原解复用器和IO.Fetch。源码加载须在这些模块前包含`utils.mediarequest.js`，已加入common构建清单。

本次只做源码及diff审阅，未构建、运行浏览器或重建release产物；部署端须配置对应CORS请求头并暴露Location／ETag。自动顺序换资源包、RTMP／RTSP产品凭据入口及跨节点媒体中继仍由服务端后续工作闭合，不以SDK接线宣称全部上线。

正常轮转的失效恢复、forceRefresh 回调及取消边界见[凭据重取](key-rotation.md)。
