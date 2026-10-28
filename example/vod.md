# 平台HTTP磁盘点播

源码 `src/utils/utils.vod.js` 随common清单加载，暴露 `odd.VOD.Upload` / `Download`。SDK不持有账号Cookie业务、签名私钥或S3能力；宿主提供凭据回调和文件选择。

```javascript
const upload = new odd.VOD.Upload({
    identity: asset.identity,
    credentials: async ({ operation, exclude, signal }) => getAssetCredential(asset.id, { operation, exclude }, signal),
    onprogress: ({ phase, bytes, total }) => renderProgress(phase, bytes, total),
});
await upload.start(file); // Blob/File；先逐片核对已确认部分
await completeAsset(asset.id, asset.revision); // 宿主调用中央持久控制意图
// upload.pause() 可取消准备／哈希／传输；之后 start(同一原文件) 查询并补片。
```

identity来自中央，包含appId/assetId/version/uploadId/group/diskId及字符串size/partSize/uploadUntil。8MiB是默认业务分片，不是网络缓冲。重新选择文件必须核对已确认片内容，不能只比较文件名。Web Crypto一次读取一片，文件整体不放入浏览器存储。

```javascript
// 必须在用户点击事件内取得句柄。无文件访问API时由原生浏览器管理保存。
const handle = await window.showSaveFilePicker({ suggestedName: asset.name });
const download = new odd.VOD.Download({ identity: asset.identity,
    recordingRoot: asset.recordingRoot, // 录制清单才提供
    credentials: getCredential, onprogress: renderProgress });
let checkpoint = await download.start(handle, previousCheckpoint);
// pause() 后返回或错误.checkpoint只代表已经 close() 到本地的部分；进度回调不是持久证据。
```

当前页面保留句柄与checkpoint，跨页面持久句柄需由宿主明确实现；网站未宣称任意浏览器跨刷新自动续存。恢复校验本地长度／lastModified、原身份及ETag；206严格核对Content-Range，If-Range不匹配的200会截断旧部分重存。未确认或本地修改不能直接续接。

凭据5分钟更新、并发请求合并，正常分片复用端点；故障时仅选择当前路由中的同diskId候选，过期后由宿主回调重选。每轮有限重试／退避，不逐片远程鉴权。`download.prepare(signal)` 后 `download.url()` 生成已核对的原生只读地址；仅保留在内存。录制URL将只读凭据置于目录段，HLS/DASH相对资源继承同一任务许可。普通单文件URL使用credential查询参数。

下载录制清单不等于下载全部媒体分片；没有ZIP或自动FLV分段拼接。网站预览组合SDK Player/UI及同实例SettingsPanel，原生HLS仍取决于浏览器格式支持。

本轮仅源码审阅；未构建SDK、运行测试或浏览器验证。
