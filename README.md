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

- Renders  
   - [ ] src  
   - [ ] flv  
   - [ ] fmp4  
   - [ ] dash  
   - [ ] hls  
   - [ ] rtc  
   - [ ] flash  

- Components  
   - [ ] poster  
   - [ ] danmu  
   - [ ] display  
   - [ ] logo  
   - [ ] controlbar  
   - [ ] contextmenu  
   - [ ] ad  
   - [ ] playlist  

- [ ] Buffer control for playback  
- [ ] Fast forward/backward for playback  
- [ ] Reduce latency due to cumulative ack of tcp  
- [ ] Generates silent frame while remote dropped some frames  


### Example
-----------

Use SDK directly: 

```js
var sdk = playease('player');
sdk.addEventListener('ready', (e) => { _forward(e) });
sdk.addEventListener('readystatechange', (e) => { e.readyState });
sdk.addEventListener('loadedmetadata', (e) => { e.metadata });
sdk.addEventListener('durationchange', (e) => { e.duration });
sdk.addEventListener('progress', (e) => { e.loaded, e.total });
sdk.addEventListener('waiting', (e) => { });
sdk.addEventListener('play', (e) => { });
sdk.addEventListener('pause', (e) => { });
sdk.addEventListener('seeking', (e) => { });
sdk.addEventListener('seeked', (e) => { });
sdk.addEventListener('ended', (e) => { });
sdk.addEventListener('timeupdate', (e) => { });
sdk.addEventListener('volumechange', (e) => { e.volume });
sdk.addEventListener('hd', (e) => { e.index });
sdk.addEventListener('error', (e) => { e.code, e.message });
sdk.init(container, config);
```

Use skin module: 

```js
var skin = playease.build('player');
skin.addEventListener('ready', (e) => { });
skin.addEventListener('play', (e) => { sdk.play() });
skin.addEventListener('pause', (e) => { sdk.pause() });
skin.addEventListener('seek', (e) => { sdk.seek() });
skin.addEventListener('stop', (e) => { sdk.stop() });
skin.addEventListener('reload', (e) => { sdk.reload() });
skin.addEventListener('muted', (e) => { sdk.muted() });
skin.addEventListener('volume', (e) => { sdk.volume() });
skin.addEventListener('hd', (e) => { sdk.hd() });
skin.addEventListener('danmu', (e) => { e.text, e.data });
skin.addEventListener('fullpage', (e) => { e.enter });
skin.addEventListener('fullscreen', (e) => { e.enter });
skin.addEventListener('state', (e) => { e.state });
skin.addEventListener('resize', (e) => { e.width, e.height });
skin.addEventListener('error', (e) => { e.code, e.message });
skin.init(config);
```


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
_defaults = {
	airplay: 'allow',
	autoplay: false,
	debug: false,
	dynamic: false,       // dynamic streaming
	bufferLength: 0.1,    // sec.
	file: '',
	latency: 'low',       // normal, low, dynamic (for tcp)
	maxBufferLength: 30,  // sec.
	mode: 'live',         // live, vod
	muted: false,
	retries: 0,
	retryInterval: 3,     // sec.
	playsinline: true,
	preload: 'none',      // none, metadata, auto
	render: '',           // src, flv, fmp4, dash, hls, rtc, flash
	skin: 'classic',
	smooth: false,        // smooth switching
	swf: 'swf/playease.swf',
	loader: {
		name: 'auto',
		mode: 'cors',       // cors, no-cors, same-origin
		credentials: 'omit' // omit, include, same-origin
	},
	sources: [{
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
		visibility: true
	}, {
		name: 'danmu',
		index: 200,
		lineHeight: 20,
		salt: 1,
		position: 'fullscreen',
		visibility: true,
		enable: true
	}, {
		name: 'display',
		index: 300,
		controls: true,
		visibility: true
	}, {
		name: 'logo',
		index: 400,
		file: 'http://studease.cn/images/content/playease-logo.png',
		link: 'http://studease.cn/playease',
		target: '_blank',
		margin: '3% 5%',
		position: 'top-right',
		visibility: true
	}, {
		name: 'controlbar',
		index: 500,
		layout: '[play][pause][stop][reload][time]|[report][mute][volume][hd][danmu][fullpage][exit-fullpage][fullscreen][exit-fullscreen]',
		autohide: false,
		visibility: true
	}, {
		name: 'contextmenu',
		index: 600,
		visibility: true,
		items: [{
			icon: '',
			text: 'PLAYEASE ' + playease.version,
			handler: undefined
		}]
	}, {
		name: 'ad',
		index: 700,
		handler: undefined
	}]
};
```


### API
-------

SDK: 

| Method | Description |
| :--- | :--- |
| init(container, config) | Init with the given configuration. |
| play(url = '', options = null) | Plays the specified media file or live stream, or the current item of the sources if the url doesn't provided. |
| pause | Pauses playing. Calling this method does nothing if the video is already paused. |
| seek(offset) | Seeks the keyframe (also called an I-frame in the video industry) closest to the specified location. |
| stop | Stops playing, sets the time property to 0. |
| reload | Releases all the resources, reloads the media file or live stream. |
| muted(bool) | Mutes or unmutes the audio/video elements. |
| volume(f) | Sets volume in the range of 0 to 1. |
| hd(index) | Switches to the specified bandwidth. |

Skin: 

| Method | Description |
| :--- | :--- |
| init(config) | Init with the given configuration. |
| play(url = '', options = null) | -- |
| pause() | -- |
| seek(offset) | -- |
| stop() | -- |
| reload() | -- |
| muted(bool) | -- |
| volume(f) | -- |
| hd(index) | -- |
| danmu(enable) | Enables component of danmu. |
| shoot(text, data = null) | Shoots the text with data binded to. |
| fullpage(bool) | Requests or exits fullpage. |
| fullscreen(bool) | Requests or exits fullscreen. |
| resize() | Resizes the player to fit with the parent node. |


### Event
---------

| Type | Meaning |
| :--- | :--- |
| ready |  |
| readystatechange | e.readyState |
| loadedmetadata | e.metadata |
| durationchange | e.duration |
| progress | e.loaded, e.total |
| waiting |  |
| play |  |
| pause |  |
| seeking |  |
| seeked |  |
| ended |  |
| timeupdate |  |
| volumechange | e.volume |
| hd | e.index |
| error | e.code, e.message |


### License
-----------

BSD 3-Clause License ([NOTICE](https://github.com/studease/playease/blob/master/NOTICE))
