# odd.player.js

> [[官网] <https://www.oddcancer.com>](https://www.oddcancer.com/product/player.html)  
> [[源码] <https://github.com/oddcancer/odd.js>](https://github.com/oddcancer/odd.js)  
> [[English] <https://github.com/oddcancer/odd.js/blob/master/doc/odd.player.md>](https://github.com/oddcancer/odd.js/blob/master/doc/odd.player.md)  
> [[CSDN] <https://blog.csdn.net/icysky1989/article/details/75094205>](https://blog.csdn.net/icysky1989/article/details/75094205)  
> QQ群：528109813  
> Skype: live:670292548  
> 邮箱: 670292548@qq.com  

这不仅只是一个支持 HTTP/WS-FLV 直播流的 [HTML5 FLV Player](https://github.com/oddcancer/odd.js/blob/master/doc/odd.player.md#roadmap)，同时也支持 HTTP/WS-fMP4、MPEG-DASH、HLS，以及其它 HTML5 原生支持的媒体资源（如 Ogg、Mpeg4、WebM），并拥有一套独立的 UI 框架。

注：  

开源版本（v1.2）已不再维护。您仍然可以在 v1.2.xx 分支下找到源码，但由于稳定性和功能单一，不建议直接应用到产品中。

取而代之，我们针对商业用途开启了一个新版本（v2），不仅更专业、高效、稳定，并且兼容所有支持 [MSE](https://caniuse.com/?search=mse) 接口的浏览器，包括 iPad Safari 和 Android Chrome。在这版设计中，将 UI 框架与内核 SDK（即 API 类），并且更易于理解和扩展。同时，UI 框架于 v2.1.49 开始开源，以便用户定制 UI、插件和组件。

新版内核 SDK 提供更专业的配置、接口和事件通知。针对娱乐、监控、教育和 VR 等场景，能够 **多实例** 运行、动态销毁、自动检测轨道、丢帧时补偿音画同步。并且，可配置的抖动缓冲区使其 **具备 7x24 运行能力**。结合 **动态消除 tcp 累积延迟** 功能，让直播延迟始终保持在低位水平。此外，它还支持截图、fMP4 流录制、事件通知、日志上报等功能。

UI 框架采用事件驱动和独立的构建方式，设计为可扩展的多插件注册摸索，支持 **一键换肤**。在这些插件中，Display 和 Controlbar 提供了一种灵活的方法来初始化内部组件，允许自定义、删除和重排等。

如果您对这个播放器感兴趣，或者想了解更多直播方案，请联系我们。

## 路线图

### 核心模块

- [x] SRC（HTML5 原生支持的媒体源，如 Ogg、Mpeg4、WebM，以及移动端的 HLS 等）  
- [x] FLV（HTTP/WS）  
- [x] FMP4（HTTP/WS）  
- [ ] DASH（LL-CMAF）  
- [ ] HLS（LL-CMAF）  
- [x] RTC  
- [ ] ~~Flash~~  

### UI 插件

- [x] Poster（直播封面）  
- [x] Chat（连麦/一起看）  
- [x] Danmu（弹幕）  
- [x] Display（中央播放按钮、加载提示、错误提示、媒体和状态面板等）  
- [ ] AD（广告）  
- [ ] Share（分享）  
- [x] Logo  
- [x] Controlbar（控制条）  
- [x] ContextMenu（右键菜单）  
- [ ] Playlist（播放列表）  

### 功能特征

- [x] v2.0.89 - Synchronize video with audio while some frames are missing.  
- [x] v2.1.07 - Carry api.id while dispatching events.  
- [x] v2.1.10 - Remove media segments within a specific time range to release memory usage.  
- [x] v2.1.20 - Capture the current frame, and save as a picture.  
  - [x] v2.1.45 - New event for screenshot, and capture() will no longer auto download, but return the image data.  
- [x] v2.1.27 - Reduce latency by simply seeking.  
  - [x] v2.1.77 - Reduce latency smoothly, due to the cumulative ack of tcp.  
- [x] v2.1.33 - Ignore track depending on flv flags, to optimize audio only or video only streaming.  
- [x] v2.1.36 - Optimize track data into interleaved mode.  
- [x] v2.1.37 - Fix audio time issue.  
- [x] v2.1.38 - Fix incorrect ui display when exiting fullscreen by pressing esc.  
- [x] v2.1.43 - Buffer before starting to play.  
- [x] v2.1.50 - New interface[s]: create, destroy.  
- [x] v2.1.54 - New interface[s]: record.  
  - [x] v2.1.59 - StreamSaver using ServiceWorker.  
  - [x] v2.1.69 - StreamWriter starts while the first keyframe is detected.  
- [x] v2.1.67 - Implemented Logger class. New interface[s]: getProperty.  
  - [ ] Log feedback.  
- [x] v2.1.73 - New module[s]: FMP4.  
- [x] v2.1.93 - Fix sps parsing issue caused log2_max_frame_num_minus4 out of range.  
- [x] v2.2.22 - Implemented rtc sdk.  
- [x] v2.3.01 - Refactor im & rtc into one.  
- [x] v2.3.17 - New module[s]: RTC.  
- [x] v2.4.11 - Update Chat plugin.  
- [ ] Breakpoint download for http-flv playback (Send a HEAD request at first).  
- [ ] Experience statistics and analysis.  

## 解决方案

- [x] [直播](https://www.oddcancer.com/solution/live.html)  
- [x] [点播](https://www.oddcancer.com/solution/vod.html)  

## 示例

### 使用内核 SDK

```js
var utils = odd.utils,
    events = odd.events,
    Event = events.Event,
    IOEvent = events.IOEvent,
    MediaEvent = events.MediaEvent,
    SaverEvent = events.SaverEvent,
    index = 0;

var api = odd.player();
api.addEventListener(Event.READY, onReady);
api.addEventListener(Event.PLAY, console.log);
api.addEventListener(IOEvent.LOADSTART, console.log);
api.addEventListener(Event.WAITING, console.log);
api.addEventListener(IOEvent.STALLED, console.log);
api.addEventListener(IOEvent.ABORT, console.log);
api.addEventListener(IOEvent.TIMEOUT, console.log);
api.addEventListener(Event.DURATIONCHANGE, console.log);
api.addEventListener(Event.LOADEDMETADATA, console.log);
api.addEventListener(Event.LOADEDDATA, console.log);
api.addEventListener(IOEvent.PROGRESS, console.log);
api.addEventListener(Event.CANPLAY, console.log);
api.addEventListener(Event.PLAYING, console.log);
api.addEventListener(Event.CANPLAYTHROUGH, console.log);
api.addEventListener(IOEvent.SUSPEND, console.log);
api.addEventListener(Event.PAUSE, console.log);
api.addEventListener(Event.SEEKING, console.log);
api.addEventListener(Event.SEEKED, console.log);
api.addEventListener(Event.SWITCHING, console.log);
api.addEventListener(Event.SWITCHED, console.log);
api.addEventListener(Event.RATECHANGE, console.log);
api.addEventListener(Event.TIMEUPDATE, console.log);
api.addEventListener(Event.VOLUMECHANGE, console.log);
api.addEventListener(IOEvent.LOAD, console.log);
api.addEventListener(MediaEvent.INFOCHANGE, console.log);
api.addEventListener(MediaEvent.STATSUPDATE, console.log);
api.addEventListener(MediaEvent.SEI, console.log);
api.addEventListener(MediaEvent.SCREENSHOT, onScreenshot);
api.addEventListener(SaverEvent.WRITERSTART, console.log);
api.addEventListener(SaverEvent.WRITEREND, console.log);
api.addEventListener(Event.ENDED, console.log);
api.addEventListener(Event.ERROR, console.error);
api.setup(container, {
    file: 'http://127.0.0.1/vod/sample.flv',
});

function onReady(e) {
    // ui.record('fragmented.mp4');
}

function onScreenshot(e) {
    var arr = e.data.image.split(',');
    var ret = arr[0].match(/^data:(image\/(.+));base64$/);
    if (ret === null) {
        console.error('The string did not match the expected pattern.');
        return;
    }

    var link = document.createElement('a');
    link.href = e.data.image;
    link.download = 'screenshot-' + utils.padStart(index++, 3, '0') + '.' + ret[2];
    link.click();
}
```

### 使用 UI 框架

```js
var events = odd.events,
    Event = events.Event,
    UIEvent = events.UIEvent,
    MouseEvent = events.MouseEvent;

var ui = odd.player.ui(0, { mode: 'file' });
ui.addEventListener(Event.READY, onReady);
ui.addEventListener(MouseEvent.CLICK, onClick);
ui.addEventListener(UIEvent.SHOOTING, console.log);
ui.addEventListener(UIEvent.FULLPAGE, console.log);
ui.addEventListener(UIEvent.FULLSCREEN, console.log);
ui.addEventListener(UIEvent.RESIZE, console.log);
ui.setup(container, {
    ...
    service: {
        script: 'js/sw.js',
        scope: 'js/',
        enable: false,
    },
});

function onReady(e) {
    // ui.record('fragmented.mp4');
}

function onClick(e) {
    switch (e.data.name) {
        case 'report':
            ui.logger.flush();
            break;
    }
}
```

### 添加事件回调

```js
api.onready = function(e) {
    // do something
};
```

或：

```js
api.addEventListener('ready', onReady);

function onReady(e) {
    // do something
}
```

## 配置

### 内核 SDK

```js
{
    airplay: 'allow',
    autoplay: false,
    dynamic: false,          // dynamic streaming
    bufferLength: 0.3,       // sec.
    file: '',
    lowlatency: true,        // ll-dash, ll-hls, ll-flv/fmp4 (auto reduce latency due to cumulative ack of tcp)
    maxBufferLength: 1.2,    // sec.
    maxPlaybackLength: 10,   // sec. for live mode only
    maxRetries: 0,           // maximum number of retries while some types of error occurs. -1 means always
    mode: 'live',            // live, vod
    module: '',              // SRC, FLV, FMP4, DASH, HLS, RTC, Flash
    muted: false,
    objectfit: 'contain',    // fill, contain, cover, none, scale-down
    playsinline: true,
    preload: 'none',         // none, metadata, auto
    retrying: 0,             // ms. retrying interval
    smoothing: false,        // smooth switching
    volume: 0.8,
    loader: {
        name: 'auto',
        mode: 'cors',        // cors, no-cors, same-origin
        credentials: 'omit', // omit, include, same-origin
    },
    rtc: {},
    service: {
        script: 'js/sw.js',
        scope: 'js/',
        enable: false,
    },
    sources: [{              // ignored if "file" is presented
        file: '',
        module: '',
        label: '',
        default: false,
    }],
}
```

### UI 扩展项

```js
{
    aspectratio: '',         // deprecated! 16:9 etc.
    client: null,
    skin: 'classic',
    plugins: [{
        kind: 'Poster',
        file: 'images/poster.png',
        cors: 'anonymous',   // anonymous, use-credentials
        objectfit: 'fill',   // fill, contain, cover, none, scale-down
        visibility: true,
    }, {
        kind: 'Chat',
        visibility: true,
    }, {
        kind: 'Danmu',
        speed: 100,
        lineHeight: 32,
        enable: true,
        visibility: true,
    }, {
        kind: 'Display',
        layout: '[Button:play=][Button:waiting=][Label:error=][Panel:info=][Panel:stats=]',
        ondoubleclick: 'fullscreen', // fullpage, fullscreen
        visibility: true,
    }, {
        kind: 'AD',
        visibility: true,
    }, {
        kind: 'Share',
        visibility: true,
    }, {
        kind: 'Logo',
        file: 'https://www.oddcancer.com/image/odd-player-logo.png',
        link: 'https://www.oddcancer.com/product/player.html',
        cors: 'anonymous',   // anonymous, use-credentials
        target: '_blank',
        style: 'margin: 3% 5%; width: 36px; height: 36px; top: 0px; right: 0px;',
        visibility: true,
    }, {
        kind: 'Controlbar',
        layout: '[Slider:timebar=Preview]|[Button:play=Play][Button:pause=Pause][Button:reload=Reload][Button:stop=Stop][Label:quote=Live broadcast][Label:time=00:00/00:00]||[Button:report=Report][Button:capture=Capture][Button:download=Download][Button:mute=Mute][Button:unmute=Unmute][Slider:volumebar=80][Select:definition=Definition][Button:danmuoff=Danmu Off][Button:danmuon=Danmu On][Button:fullpage=Fullpage][Button:exitfullpage=Exit Fullpage][Button:fullscreen=Fullscreen][Button:exitfullscreen=Exit Fullscreen]',
        autohide: false,
        visibility: true,
    }, {
        kind: 'ContextMenu',
        visibility: true,
        items: [{
            mode: '',        // '', featured, disable
            icon: 'image/github.png',
            text: 'github.com',
            shortcut: '',
            handler: function () { window.open('https://www.oddcancer.com/product/player.html'); },
        }],
    }]
};
```

### 日志

```js
{
    level: 'log',    // debug, log, warn, error
    mode: 'console', // console, file, feedback
    maxLines: 60,
}
```

## 接口

### 内核 SDK 静态接口

| 方法 | 参数 | 描述 |
| :--- | :--- | :--- |
| get | id = 0, option = undefined | 获取指定 API 实例，不存在则创建。参数 option 为日志配置。 |
| create | option = undefined | 采用 id 自增的方式创建一个 API 实例。参数 option 为日志配置。 |

### API 实例

| 方法 | 参数 | 描述 |
| :--- | :--- | :--- |
| setup | container, config | 设置 API 实例。 |
| play | url = '', options = null | 播放指定的媒体源。若未指定 url 参数，则播放配置中的当前项；若处于暂停状态，则恢复播放。 |
| pause |  | 暂停播放。 |
| seek | offset | 尝试跳转到指定位置（秒）附近的关键帧，并开始播放。 |
| stop |  | 停止播放，并重置播放头。 |
| reload |  | 释放所有资源，重新加载媒体源。 |
| muted | status | 静音或取消静音。若参数 status 不为 boolean 类型，则只返回当前静音状态。 |
| volume | f | 设置音量（取值范围 0 到 1）。若参数 f 不为 number 类型，则只返回当前音量值。 |
| definition | index | 切换到指定索引的清晰度。若参数 index 不为 number 类型，则只返回当前清晰度索引号。 |
| capture | width, height, mime | 截取当前视频画面，抛出 screenshot 事件，并返回该图片。 |
| record | filename | 启动 ServiceWorker 并录制当前流，返回一个 StreamWriter 实例。若参数 filename 为 false，则关闭当前 StreamWriter。 |
| element |  | 返回当前渲染元素，如 video、~~flash~~、canvas 等元素。 |
| getProperty | key | 获取指定属性。目前，有效 key 有 info 和 stats。 |
| duration |  | 获取媒体源的当前总时长。 |
| state |  | 获取播放状态。 |
| destroy |  | 销毁实例，移除 dom 元素。 |

### UI 框架静态接口

| 方法 | 参数 | 描述 |
| :--- | :--- | :--- |
| get | id = 0, option = undefined | 获取指定 UI 实例，不存在则创建。参数 option 为日志配置。 |
| create | option = undefined | 采用 id 自增的方式创建一个 API 实例。参数 option 为日志配置。 |

### UI 实例

注：UI 实例支持所有 API 实例接口。

| 方法 | 参数 | 描述 |
| :--- | :--- | :--- |
| setup | container, config | 设置 UI 实例。 |
| danmu | enable | 激活或关闭弹幕插件。若参数 enable 不为 boolean 类型，则只返回当前激活状态。 |
| shoot | text, data = null | 向弹幕插件中发送指定内容。 |
| displayAD | element | 将指定元素展示为广告。 |
| removeAD |  | 移除广告。 |
| fullpage | status | 进入或退出网页全屏。若参数 status 不为 boolean 类型，则只返回当前网页全屏状态。 |
| fullscreen | status | 进入或退出全屏。若参数 status 不为 boolean 类型，则只返回当前全屏状态。 |
| resize |  | 调整插件以适应父容器大小。 |
| destroy |  | 销毁实例，移除 dom 元素。 |

## 事件

API 实例支持 Event 和 IOEvent 事件。所有 API 事件都会投递给对应的 UI 实例。

### Event

| 类型 | 属性 | 意义 |
| :--- | :--- | :--- |
| READY |  | 当核心模块准备就绪时触发。 |
| PLAY |  | 当开始播放或恢复播放时触发。 |
| WAITING |  | 当等待缓冲区加载数据时触发。 |
| DURATIONCHANGE | duration | 当媒体总时长发生变化时触发。 |
| LOADEDMETADATA | metadata | 当媒体元数据已加载时触发。 |
| LOADEDDATA |  | 当当前帧数据加载完成时触发。 |
| CANPLAY |  | 当缓冲区拥有足够的数据，可以开始播放时触发。 |
| PLAYING |  | 当从暂停或缓冲状态恢复播放时触发。 |
| CANPLAYTHROUGH |  | 当浏览器估算得知无需暂停缓冲就可以播放下去时触发。 |
| PAUSE | timestamp | 当播放被用户或编程方式暂停时触发。 |
| SEEKING | timestamp | 当开始跳转到新位置时触发。 |
| SEEKED | timestamp | 当完成新位置跳转时触发。 |
| SWITCHING | index | 当开始切换到另一个清晰度时触发。 |
| SWITCHED | index | 当完成切换到另一个清晰度时触发。 |
| RATECHANGE| rate | 当媒体播放速率因调用 playbackRate 而发生改变时触发。 |
| TIMEUPDATE | timestamp, buffered | 当改变媒体播放位置时触发。 |
| VOLUMECHANGE | volume | 当媒介改变音量，或开启、取消静音时触发。 |
| ENDED |  | 当媒体播放到结尾时触发。 |
| ERROR | code, message | 当加载和播放期间发生错误时触发。 |

### IOEvent

| 类型 | 属性 | 意义 |
| :--- | :--- | :--- |
| LOADSTART |  | 当浏览器开始加载媒体数据时触发。 |
| STALLED |  | 当取回媒体数据过程中发生错误时触发。 |
| ABORT |  | 当发生取消事件时触发。 |
| TIMEOUT |  | 当请求媒体源超时时触发。 |
| PROGRESS | loaded, total, buffer | 当浏览器正在取媒体数据时触发。 |
| SUSPEND |  | 当浏览器故意中止取媒体数据时触发。 |
| LOAD |  | 当取回媒体数据完成时触发。 |
| LOADEND |  | 当取回媒体数据停止时触发（在已触发 error、abort 或 load 事件之后）。 |

### MediaEvent

| 类型 | 属性 | 意义 |
| :--- | :--- | :--- |
| INFOCHANGE | info | 当媒体信息发生改变时触发。 |
| STATSUPDATE | stats | 当媒体统计信息发生更新时触发。 |
| SEI | packet, nalu | 当检测到 SEI NalUnit 时触发。 |
| SCREENSHOT | image | 当截图成功时触发。 |

### UIEvent

| 类型 | 属性 | 意义 |
| :--- | :--- | :--- |
| SHOOTING | text, data | 当新弹幕被发射时触发。 |
| FULLPAGE | status | 当网页全屏状态发生改变时触发。 |
| FULLSCREEN | status | 当全屏状态发生改变时触发。 |
| RESIZE | width, height | 当调整了插件大小时触发。 |

### GlobalEvent

| 类型 | 属性 | 意义 |
| :--- | :--- | :--- |
| CHANGE | name, value | 当组件的值发生改变时触发。 |
| VISIBILITYCHANGE | name, state | 当组件的可见状态发生改变时触发。有效的 state 值为 visible 和 hidden。 |

### MouseEvent

| 类型 | 属性 | 意义 |
| :--- | :--- | :--- |
| CLICK | name, value | 当用户点击了某个组件时触发。 |
| DOUBLE_CLICK | name, state | 当用户双击了某个组件时触发。 |
| MOUSE_MOVE | name, value | 当鼠标在某个组件上移动时触发。 |

### KeyboardEvent

| 类型 | 属性 | 意义 |
| :--- | :--- | :--- |
| KEY_DOWN | code, alt, control, shift, command | 当用户按下某个按键时触发。 |
| KEY_UP | code, alt, control, shift, command | 当用户释放某个按键时触发。 |

### TimerEvent

| 类型 | 属性 | 意义 |
| :--- | :--- | :--- |
| TIMER | | 当定时器到期时触发。 |
| COMPLETE | | 当定时器完成时触发。 |

## License

BSD 3-Clause License ([NOTICE](https://github.com/oddcancer/odd.js/blob/master/NOTICE))
