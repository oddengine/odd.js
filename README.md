# playease.js 2.0

> [[domain] http://studease.cn](http://studease.cn/playease.html)  
> [[source] https://github.com/studease/playease](https://github.com/studease/playease)  
> [[中文] http://blog.csdn.net/icysky1989/article/details/75094205](http://blog.csdn.net/icysky1989/article/details/75094205)  
> 公众号：STUDEASE  
> QQ群：528109813  
> Skype: live:670292548  

This is a HTML5 Video Player for modern media streaming.  

It supports:

- RTMP (For MSIE8-10 with flash embed in)
- HTTP/WebSocket-FLV
- HTTP/WebSocket-fMP4
- MPEG-DASH
- HLS (on mobile)
- Original HTML5 media resources (eg. Ogg, Mpeg4, WebM)

Main features:

- ES5 + closure + prototype (IE9+)  
- Multiple SourceBuffer (Except Mac Safari)  

## Roadmap

- Components  
  - [x] poster  
  - [x] danmu  
  - [x] display  
  - [ ] ad  
  - [ ] share  
  - [x] logo  
  - [ ] controlbar  
  - [x] contextmenu  
  - [ ] playlist  

- Modules  
  - [ ] src  
  - [ ] flv  
  - [ ] fmp4  
  - [ ] dash  
  - [ ] hls (on desktop)  
  - [ ] rtc  
  - [ ] flash  

- [ ] Buffer control for playback  
- [ ] Fast forward/backward for playback  
- [ ] Reduce latency due to cumulative ack of tcp  
- [ ] Generates silent frame while remote dropped some frames  

## Example

Use the SDK directly:

```js
var Event = playease.events.Event;
var IOEvent = playease.events.IOEvent;
var api = playease();
api.addEventListener(Event.READY, console.log);
api.addEventListener(Event.PLAY, console.log);
api.addEventListener(IOEvent.SUSPEND, console.log);
api.addEventListener(IOEvent.STALLED, console.log);
api.addEventListener(IOEvent.LOADSTART, console.log);
api.addEventListener(Event.WAITING, console.log);
api.addEventListener(IOEvent.ABORT, console.log);
api.addEventListener(IOEvent.TIMEOUT, console.log);
api.addEventListener(Event.DURATIONCHANGE, console.log);
api.addEventListener(Event.LOADEDMETADATA, console.log);
api.addEventListener(Event.LOADEDDATA, console.log);
api.addEventListener(IOEvent.PROGRESS, _forward);
api.addEventListener(Event.CANPLAY, console.log);
api.addEventListener(Event.PLAYING, console.log);
api.addEventListener(Event.CANPLAYTHROUGH, console.log);
api.addEventListener(Event.PAUSE, console.log);
api.addEventListener(Event.SEEKING, console.log);
api.addEventListener(Event.SEEKED, console.log);
api.addEventListener(Event.SWITCHING, console.log);
api.addEventListener(Event.SWITCHED, console.log);
api.addEventListener(Event.RATECHANGE, console.log);
api.addEventListener(Event.TIMEUPDATE, console.log);
api.addEventListener(Event.VOLUMECHANGE, console.log);
api.addEventListener(Event.LOAD, console.log);
api.addEventListener(Event.ENDED, console.log);
api.addEventListener(Event.ERROR, console.error);
api.setup(container, {
    file: 'http://127.0.0.1/vod/sample.flv',
});
```

Use the builtin extendible UI framework:

```js
var UIEvent = playease.events.UIEvent;
var ui = playease.ui('player');
ui.addEventListener(UIEvent.SHOOTING, console.log);
ui.addEventListener(UIEvent.FULLPAGE, console.log);
ui.addEventListener(UIEvent.FULLSCREEN, console.log);
ui.addEventListener(UIEvent.RESIZE, console.log);
ui.setup(config);
```

## API

SDK:

| Method | Arguments | Description |
| :--- | :--- | :--- |
| setup | container, config | Setup the SDK with the given configuration. |
| play | url = '', options = null | Plays the specified media file or live stream, or the current item of the sources if the url doesn't provided. |
| pause |  | Pauses playing. Calling this method does nothing if the video is already paused. |
| seek | offset | Seeks the keyframe (also called an I-frame in the video industry) closest to the specified location. |
| stop |  | Stops playing, sets the time property to 0. |
| reload |  | Releases all the resources, reloads the media file or live stream. |
| muted | status | Mutes or unmutes the audio/video elements. |
| volume | f | Sets volume in the range of 0 to 1. |
| switch | index | Switches to the specified bandwidth. |
| state |  | Gets the state. |

UI (All SDK methods are also supported by UI):

| Method | Arguments | Description |
| :--- | :--- | :--- |
| setup | container, config | Setup the UI with the given configuration. |
| danmu | enable | Enables or disables the danmu component. |
| shoot | text, data = null | Shoots the text with the data binded to. |
| displayAD | element | Displays the AD element. |
| removeAD |  | Removes the AD element. |
| fullpage | status | Requests or exits fullpage. |
| fullscreen | status | Requests or exits fullscreen. |
| resize |  | Resizes the player to fit with the parent node. |

## Events

Event:

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| READY |  | The ready event occurs when the setup is succeeded. |
| PLAY |  | The play event occurs when it has been started or is no longer paused. |
| SUSPEND |  | The suspend event occurs when the browser is intentionally not getting media data. |
| STALLED |  | The stalled event occurs when the browser is trying to get media data, but data is not available. |
| LOADSTART |  | The loadstart event occurs when the browser starts loading. |
| WAITING |  | The waiting event occurs when it stops because it needs to buffer the next frame. |
| ABORT |  | The abort event occurs when the loading is aborted. |
| TIMEOUT |  | The timeout event occurs when progression is terminated due to preset time expiring. |
| DURATIONCHANGE | duration | The durationchange event occurs when the duration data is changed. |
| LOADEDMETADATA | metadata | The loadedmetadata event occurs when metadata has been loaded. |
| LOADEDDATA |  | The loadeddata event occurs when data for the current frame is loaded, but not enough data to play next frame. |
| PROGRESS | loaded, total, buffer | The progress event occurs when the browser is downloading. |
| CANPLAY |  | The canplay event occurs when the browser can start playing (when it has buffered enough to begin). |
| PLAYING |  | The playing event occurs when it is playing after having been paused or stopped for buffering. |
| CANPLAYTHROUGH |  | The canplaythrough event occurs when the browser estimates it can play through the specified media without having to stop for buffering. |
| PAUSE | timestamp | The pause event occurs when it is paused either by the user or programmatically. |
| SEEKING | timestamp | The seeking event occurs when the user starts moving/skipping to a new position. |
| SEEKED | timestamp | The seeked event occurs when the user is finished moving/skipping to a new position. |
| SWITCHING | index | The switching event occurs when the user starts switching to a different bandwidth. |
| SWITCHED | index | The switching event occurs when the user is finished switching to a different bandwidth. |
| RATECHANGE| rate | The ratechange event occurs when the playing speed is changed, which is invoked by the playbackRate method. |
| TIMEUPDATE | timestamp, buffered | The timeupdate event occurs when the playing position has changed. |
| VOLUMECHANGE | volume | The volumechange event occurs each time the volume has been changed. |
| LOAD |  | The onload event occurs when an object has been loaded. |
| ENDED |  | The ended event occurs when the media has reached the end. |
| ERROR | code, message | The error event occurs when an error occurred. |

UIEvent (All SDK events will be forward to UI):

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| SHOOTING | text, data | The shooting event occurs when a damnu message is shot. |
| FULLPAGE | status | The ended event occurs when the fullpage status is changed. |
| FULLSCREEN | status | The ended event occurs when the fullscreen status is changed. |
| RESIZE | width, height | The ended event occurs when the UI is resized. |

## Add Callback

```js
sdk.onready = function(e) {
    // do something
};
```

Or:

```js
sdk.addEventListener('ready', onReady);

function onReady(e) {
    // do something
}
```

## Configuration

```js
_default = {
    airplay: 'allow',
    aspectratio: '16:9',
    autoplay: false,
    dynamic: false,          // dynamic streaming
    bufferLength: 0.1,       // sec.
    file: '',
    latency: 'low',          // normal, low, dynamic (for tcp)
    maxBufferLength: 30,     // sec.
    mode: 'live',            // live, vod
    module: '',              // src, flv, fmp4, dash, hls, rtc, flash
    muted: false,
    retries: 0,
    retryInterval: 3,        // sec.
    playsinline: true,
    preload: 'none',         // none, metadata, auto
    smooth: false,           // smooth switching
    skin: 'classic-en',
    swf: 'swf/playease.swf',
    loader: {
        name: 'auto',
        mode: 'cors',        // cors, no-cors, same-origin
        credentials: 'omit', // omit, include, same-origin
    },
    sources: [{              // ignored if "file" is presented
        mime: 'application/vnd.apple.mpegurl',
        file: '',
        label: '',
        textTracks: [{
            kind: 'thumbnails',
            file: '',
            default: true,
        }],
        metadata: {
            bitrate: 1089536,
            videocodec: 'avc1.64001e',
            videodatarate: 1000,
            width: 640,
            height: 360,
            framerate: 30,
            audiocodec: 'mp4a.40.2',
            audiodatarate: 64,
            audiosamplerate: 48000,
            audiosamplesize: 16,
            channelcount: 2,
        },
    }],
    components: [{
        kind: 'Poster',
        index: 100,
        file: 'images/poster.png',
        visibility: true,
    }, {
        kind: 'Danmu',
        index: 200,
        fontSize: 14,
        lineHeight: 20,
        alpha: 1,               // 0 ~ 1
        duration: 10,           // sec. while width = 640 px
        salt: 0.5,              // real duration = duration * (1 + (width - 640) / 640 * salt)
        enable: true,
        visibility: true,
    }, {
        kind: 'Display',
        index: 300,
        controls: true,
        visibility: true,
    }, {
        kind: 'AD',
        index: 400,
        visibility: true,
    }, {
        kind: 'Share',
        index: 500,
        visibility: true,
    }, {
        kind: 'Logo',
        index: 600,
        file: 'http://studease.cn/images/content/playease-logo.png',
        link: 'http://studease.cn/playease',
        target: '_blank',
        style: 'margin: 3% 5%; width: 36px; height: 36px; top: 0px; right: 0px;',
        visibility: true,
    }, {
        kind: 'Controlbar',
        index: 700,
        layout: '[slider:time=Preview]|[button:play=Play][button:pause=Pause][button:stop=Stop][button:reload=Reload][label:alert=]||[button:report=Report][button:mute=Mute][button:unmute=Unmute][slider:volume=80][select:hd=Definition][button:danmuoff=Danmu Off][button:danmuon=Danmu On][button:fullpage=Fullpage][button:exitfullpage=Exit Fullpage][button:fullscreen=Fullscreen][button:exitfullscreen=Exit Fullscreen]',
        autohide: false,
        visibility: true,
    }, {
        kind: 'ContextMenu',
        index: 800,
        visibility: true,
        items: [{
            icon: 'http://studease.cn/images/content/playease-logo.png',
            text: 'PLAYEASE ' + playease.VERSION,
            shortcut: '',
            handler: function () { window.open('http://studease.cn/playease'); },
            enable: true,
        }]
    }]
};
```

## License

BSD 3-Clause License ([NOTICE](https://github.com/studease/playease/blob/master/NOTICE))
