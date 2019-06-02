# playease.js

> [[domain] http://studease.cn](http://studease.cn/playease.html)

> [[source] https://github.com/studease/playease](https://github.com/studease/playease)

> [[中文] http://blog.csdn.net/icysky1989/article/details/75094205](http://blog.csdn.net/icysky1989/article/details/75094205)

> 公众号：STUDEASE

> QQ群：528109813

> Skype: live:670292548

This is a HTML5 video player for modern live streaming. It supports: 

* **RTMP (For MSIE8-10 with flash embed in)**
* **HTTP/WebSocket-FLV**
* **HTTP/WebSocket-fMP4**
* **MPEG-DASH**
* **HLS (on mobile)**
* **Original HTML5 media resources (eg. Ogg, Mpeg4, WebM)**


## Example
----------

### Basic Configuraion

The example below shows how to play a flv vod. It will find the element with an id of player and render a video into it.

Note: To play flv live streams, comment lines below out.

```js
loader.name
loader.chunkSize
render.bufferLength
```

```js
<div id='playwrap' style='margin: 0 auto; width: 100%; max-width: 640px; top: 0; left: 0;'>
	<div id='player'></div>
</div>
<div id='others' style='width: 100%;'>
	...
</div>
...

var pw = document.getElementById('playwrap');
var events = playease.events;

var player = playease('player');
player.addEventListener(events.PLAYEASE_FULLPAGE, onFullpage);
player.addEventListener(events.RESIZE, onResize);
player.setup({
	width: 640,
	height: 400,
	aspectratio: '16:9',
	file: '/vod/sample.flv',
	/*sources: [{
		file: 'http://127.0.0.1/live/_definst_/sample.flv',
		type: 'flv',
		label: 'HTTP-FLV'
	}, {
		file: 'http://127.0.0.1/live/_definst_/sample',
		type: 'fmp4',
		label: 'HTTP-FMP4'
	}, {
		file: 'http://127.0.0.1/live/_definst_/sample/manifest.mpd',
		type: 'dash',
		label: 'MPEG-DASH'
	}, {
		file: 'rtmp://127.0.0.1/live/_definst_/sample',
		type: 'flash',
		label: 'RTMP-STREAM'
	}, {
		file: 'http://127.0.0.1/live/_definst_/sample/index.m3u8',
		type: 'def',
		label: 'HLS'
	}],*/
	mode: 'vod',
	controls: true,
	autoplay: false,
	//poster: 'sample.png',
	//report: true,
	loader: {
		name: 'xhr-chunked-loader', // For flv render in vod mode only. Otherwise, don't name it out.
		chunkSize: 4 * 1024 * 1024, // For xhr-chunked-loader only
		mode: 'cors'
	},
	bulletCurtain: {
		enable: true,
		visible: true
	},
	fullpage: {
		visible: false
	},
	render: {
		name: 'flv',
		bufferLength: 4 * 1024 * 1024, // For flv render in vod mode only
		swf: '../swf/playease.swf'
	}
});

function onFullpage(e) {
	pw.style.margin = e.exit ? '0 auto' : '0';
	pw.style.height = e.exit ? '' : '100%';
	pw.style.position = e.exit ? '' : 'fixed';
	pw.style.maxWidth = e.exit ? '640px' : '100%';
	pw.style.zIndex = e.exit ? '' : '99';
}

function onResize(e) {
	// x5-playsinline
	if (playease.utils.isAndroid() && playease.utils.isQQBrowser()) {
		var video = document.getElementById('player').firstChild.lastChild;
		video.style.width = window.innerWidth + 'px';
		video.style.height = window.innerHeight + 'px';
		video.style['object-position'] = 'center top';
		
		var controlbar = document.getElementById('player').childNodes[1];
		controlbar.style.top = e.height - 40 + 'px';
		controlbar.style.position = 'absolute';
		
		var next = document.getElementById('others');
		next.style.top = e.height + 'px';
		next.style.bottom = '0px';
		next.style.position = 'absolute';
		next.style.zIndex = 999;
	}
	
	// Something else
}
```

### More Configuration

Please have a look at [cn/studease/embed/playease.embed.config.js](https://github.com/studease/playease/blob/master/cn/studease/embed/playease.embed.config.js#L18).

```js
_defaults = {
	width: 640,
	height: 400,
	aspectratio: '16:9',
	file: '',
	sources: [],
	mode: renderModes.VOD,
	bufferTime: .1,
	maxRetries: 0,
	retryDelay: 3000,
	controls: true,
	autoplay: true,
	airplay: 'allow',
	playsinline: true,
	poster: '',
	report: false,
	debug: false,
	loader: {
		//name: 'xhr-chunked-loader', // For flv render in vod mode only. Otherwise, don't name it out.
		//chunkSize: 2 * 1024 * 1024, // For xhr-chunked-loader only
		mode: io.modes.CORS
	},
	bulletCurtain: {
		enable: true,
		visible: false
	},
	fullpage: {
		visible: false
	},
	render: {
		name: renderTypes.DEFAULT,
		//bufferLength: 4 * 1024 * 1024, // For flv render in vod mode only
		swf: 'swf/playease.swf'
	},
	skin: {
		name: skinTypes.DEFAULT
	},
	events: {
		
	}
};
```

### Components

* **Context Menu**
```js
playease('player').setup({
	...
	contextmenu: {
		items: [{
			icon: '',
			text: 'Home',
			link: 'studease.cn',
			target: '_blank'
		}]
	}
});
```

* **Bullet Curtain**
```js
alphas = {
	NONE: 1,
	LOW:  0.75,
	MID:  0.5,
	HIGH: 0.25
},
positions = {
	FULLSCREEN: 0,
	TOP:        1,
	BOTTOM:     2
};

playease('player').setup({
	...
	bulletCurtain: {
		width: 640,
		height: 360,
		enable: true,
		fontsize: 14,
		lineHeight: 20,
		interval: 30,
		duration: 10000,
		alpha: alphas.LOW,
		position: positions.FULLSCREEN,
		visible: true
	}
});
```

### Add Callback

```js
playease('player').setup({
	...
	events: {
		onReady: function(e) {
			console.log('onReady');
		},
		...
	}
});

// or

var events = playease.events;
var player = playease('player');
player.addEventListener(events.PLAYEASE_READY, onReady);
player.setup({
	...
});

function onReady(e) {
	console.log('onReady');
}
```

For more events, please check cn/studease/api/playease.api.js, or the source of test/index.html.

```js
_eventMapping = {
	onError: events.ERROR,
	onReady: events.PLAYEASE_READY,
	onMetaData: events.PLAYEASE_METADATA,
	onBuffering: events.PLAYEASE_BUFFERING,
	onPlaying: events.PLAYEASE_PLAYING,
	onPaused: events.PLAYEASE_PAUSED,
	onReloading: events.PLAYEASE_RELOADING,
	onSeeking: events.PLAYEASE_SEEKING,
	onStopped: events.PLAYEASE_STOPPED,
	onReport: events.PLAYEASE_REPORT,
	onMute: events.PLAYEASE_MUTE,
	onVolume: events.PLAYEASE_VOLUME,
	onVideoOff: events.PLAYEASE_VIDEOOFF,
	onHD: events.PLAYEASE_HD,
	onBullet: events.PLAYEASE_BULLET,
	onFullpage: events.PLAYEASE_FULLPAGE,
	onFullscreen: events.PLAYEASE_FULLSCREEN,
	onResize: events.RESIZE
};
```

### Interface

* **play(url)**
* **pause()**
* **reload()**
* **seek(offset)**
* **stop()**
* **report()**
* **mute(mute)**
* **volume(vol)**
* **videoOff(off)**
* **hd(index)**
* **bullet(enable)**
* **fullpage(exit)**
* **fullscreen(exit)**
* **shoot(text)**
* **resize(width, height)**


## License
----------

BSD 3-Clause License ([NOTICE](https://github.com/studease/playease/blob/master/NOTICE))
