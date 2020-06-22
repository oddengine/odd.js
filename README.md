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


### Roadmap
-----------

- Components  
   - [ ] poster  
   - [ ] danmu  
   - [ ] display  
   - [ ] ad  
   - [ ] share  
   - [ ] logo  
   - [ ] controlbar  
   - [ ] contextmenu  
   - [ ] playlist  

- Renders  
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


### Example
-----------

Use SDK directly: 

```js
var Event = playease.events.Event;
var api = playease('player');
api.addEventListener(Event.READY, console.log);
api.addEventListener(Event.LOADEDMETADATA, console.log);
api.addEventListener(Event.DURATIONCHANGE, console.log);
api.addEventListener(Event.WAITING, console.log);
api.addEventListener(Event.PLAYING, console.log);
api.addEventListener(Event.PAUSE, console.log);
api.addEventListener(Event.SEEKING, console.log);
api.addEventListener(Event.SEEKED, console.log);
api.addEventListener(Event.ENDED, console.log);
api.addEventListener(Event.TIMEUPDATE, console.log);
api.addEventListener(Event.VOLUMECHANGE, console.log);
api.addEventListener(Event.HD, console.log);
api.addEventListener(Event.ERROR, console.error);
api.setup(container, {
    file: 'http://127.0.0.1/vod/sample.flv',
});
```

Use the builtin and extendible UI: 

```js
var Event = playease.events.Event;
var UIEvent = playease.events.UIEvent;
var ui = playease.ui('player');
ui.addEventListener(UIEvent.SHOOTING, console.log);
ui.addEventListener(UIEvent.FULLPAGE, console.log);
ui.addEventListener(UIEvent.FULLSCREEN, console.log);
ui.addEventListener(UIEvent.RESIZE, console.log);
ui.setup(config);
```


### API
-------

SDK: 

| Method | Description |
| :--- | :--- |
| setup(container, config) | Setup the SDK with the given configuration. |
| play(url = '', options = null) | Plays the specified media file or live stream, or the current item of the sources if the url doesn't provided. |
| pause | Pauses playing. Calling this method does nothing if the video is already paused. |
| seek(offset) | Seeks the keyframe (also called an I-frame in the video industry) closest to the specified location. |
| stop | Stops playing, sets the time property to 0. |
| reload | Releases all the resources, reloads the media file or live stream. |
| muted(b) | Mutes or unmutes the audio/video elements. |
| volume(f) | Sets volume in the range of 0 to 1. |
| hd(index) | Switches to the specified bandwidth. |

UI (All SDK methods are also supported by UI): 

| Method | Description |
| :--- | :--- |
| setup(config) | Setup the UI with the given configuration. |
| danmu(enable) | Enables component of Danmu. |
| shoot(text, data = null) | Shoots the text with data binded to. |
| insertAd(element) | Inserts an AD element. |
| removeAd() | Removes the AD element. |
| fullpage(status) | Requests or exits fullpage. |
| fullscreen(status) | Requests or exits fullscreen. |
| resize() | Resizes the player to fit with the parent node. |


### Events
----------

Event: 

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| READY |  | The setup has succeeded. |
| LOADEDMETADATA | metadata | The loadedmetadata event occurs when metadata has been loaded. |
| DURATIONCHANGE | duration | The durationchange event occurs when the duration data is changed. |
| PLAY |  | The play event occurs when it has been started or is no longer paused. |
| WAITING |  | The waiting event occurs when it stops because it needs to buffer the next frame. |
| PLAYING |  | The playing event occurs when it is playing after having been paused or stopped for buffering. |
| PAUSE |  | The pause event occurs when it is paused either by the user or programmatically. |
| SEEKING |  | The seeking event occurs when the user starts moving/skipping to a new position. |
| SEEKED |  | The seeked event occurs when the user is finished moving/skipping to a new position. |
| ENDED |  | The ended event occurs when it has reached the end. |
| TIMEUPDATE | time, buffered | The timeupdate event occurs when the playing position has changed. |
| VOLUMECHANGE | volume | The volumechange event occurs each time the volume has been changed. |
| HD | index | Has switched to the indexed bandwidth. |
| ERROR | code, message | An error occurs. |

UIEvent (All SDK events will be forward to UI): 

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| SHOOTING | text, data | A Damnu message has been shot. |
| FULLPAGE | status | The fullpage status has changed. |
| FULLSCREEN | status | The fullscreen status has changed. |
| RESIZE | width, height | The UI has been resized. |


### Add Callback
----------------

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


### Configuration
-----------------

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
    swf: 'swf/playease.swf',
    loader: {
        name: 'auto',
        mode: 'cors',        // cors, no-cors, same-origin
        credentials: 'omit', // omit, include, same-origin
    },
    sources: [{              // ignored if "file" is presented
        file: '',
        label: '',
        render: '',
        loader: {
            name: 'auto'
        },
        representation: {
            mimeType: 'video/x-flv',
            codecs: 'avc1.64001e,mp4a.40.2',
            bandwidth: 448000,
            width: 640,
            height: 360,
            frameRate: 30,
            audioSamplingRate: 48000
        }
    }],
    components: [{
        name: 'poster',
        index: 100,
        file: 'images/poster.png',
        visibility: true,
    }, {
        name: 'danmu',
        index: 200,
        lineHeight: 20,
        alpha: 1,               // 0 ~ 1
        duration: 10,           // sec. while width = 640 px
        salt: 0.5,              // real duration = duration * (1 + (width - 640) / 640 * salt)
        position: 'fullscreen',
        enable: true,
        visibility: true,
    }, {
        name: 'display',
        index: 300,
        controls: true,
        visibility: true,
    }, {
        name: 'ad',
        index: 400,
        visibility: true,
    }, {
        name: 'share',
        index: 500,
        visibility: true,
    }, {
        name: 'logo',
        index: 600,
        file: 'http://studease.cn/images/content/playease-logo.png',
        link: 'http://studease.cn/playease',
        target: '_blank',
        style: 'margin: 3% 5%; width: 36px; height: 36px;',
        position: 'top-right',
        visibility: true,
    }, {
        name: 'controlbar',
        index: 700,
        layout: '[play][pause][stop][reload][time]|
            [report][mute][volume][hd][danmu][fullpage][exit-fullpage][fullscreen][exit-fullscreen]',
        autohide: false,
        visibility: true,
    }, {
        name: 'contextmenu',
        index: 800,
        visibility: true,
        items: [{
            icon: '',
            text: 'PLAYEASE ' + playease.version,
        }]
    }]
};
```


### License
-----------

BSD 3-Clause License ([NOTICE](https://github.com/studease/playease/blob/master/NOTICE))
