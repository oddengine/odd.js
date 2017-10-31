# playease.js

> [[domain] http://studease.cn](http://studease.cn)

> [[source] https://github.com/studease/playease](https://github.com/studease/playease)

> [[zh_doc] http://blog.csdn.net/icysky1989/article/details/75094205](http://blog.csdn.net/icysky1989/article/details/75094205)

This is a HTML5 video player for FLV/fMP4 live streaming, FLV/fMP4 VoD, MPEG-DASH, and original HTML5 media resources, eg. Ogg, Mpeg4, WebM, HLS.
It also supports RTMP streaming for MSIE8-10 with flash embed in.


## Example
----------

### Basic Configuraion

The example below will find the element with an id of player and render a video into it.

```js
<div id='player'></div>
...
playease('player').setup({
	width: 640,
	height: 400,
	aspectratio: '16:9',
	file: '/vod/sample.flv',
	/*sources: [{
		file: 'http://127.0.0.1/live/sample.flv',
		type: 'flv',
		label: 'HTTP-FLV'
	}, {
		file: 'ws://127.0.0.1/live/sample.flv',
		type: 'flv',
		label: 'WS-FLV'
	}, {
		file: 'ws://127.0.0.1/live/sample',
		type: 'rtmpmate',
		label: 'WS-RTMPMATE'
	}, {
		file: 'ws://127.0.0.1/live/sample',
		type: 'wss',
		label: 'WS-fMP4'
	}, {
		file: 'http://127.0.0.1/live/sample/manifest.mpd',
		type: 'dash',
		label: 'MPEG-DASH'
	}, {
		file: 'rtmp://127.0.0.1/live/sample',
		type: 'flash',
		label: 'RTMP-STREAM'
	}, {
		file: 'http://127.0.0.1/live/sample/index.m3u8',
		type: 'def'
	}],*/
	mode: 'vod',
	controls: true,
	autoplay: false,
	//poster: 'sample.png',
	//report: true,
	loader: {
		name: 'xhr-chunked-loader',
		chunkSize: 2 * 1024 * 1024,
		mode: 'cors'
	},
	logo: {
		file: 'logo.png'
	},
	bulletscreen: {
		enable: true,
		visible: true
	},
	/*fullpage: {
		visible: true
	},*/
	render: {
		name: 'flv',
		bufferLength: 4 * 1024 * 1024,
		swf: '../swf/playease.swf'
	}
});
```

### More Configuration

Please have a look at cn/studease/embed/playease.embed.config.js.
Component config is at the front of their sources.

```js
_defaults = {
	width: 640,
	height: 400,
	aspectratio: '16:9',
	file: '',
	sources: [],
	mode: rendermodes.VOD,
	bufferTime: .1,
	maxretries: 0,
	retrydelay: 3000,
	controls: true,
	autoplay: true,
	airplay: 'allow',
	playsinline: true,
	poster: '',
	report: false,
	debug: false,
	loader: {
		//name: 'xhr-chunked-loader', // For flv render in vod mode only. For flv live broadcast, don't name it out.
		//chunkSize: 2 * 1024 * 1024, // For xhr-chunked-loader only
		mode: iomodes.CORS
	},
	logo: {
		visible: true
	},
	bulletscreen: {
		enable: true,
		visible: false
	},
	fullpage: {
		visible: false
	},
	render: {
		name: rendertypes.DEFAULT,
		//bufferLength: 4 * 1024 * 1024, // For flv render in vod mode only
		swf: 'swf/playease.swf'
	},
	skin: {
		name: skintypes.DEFAULT
	},
	events: {
		
	}
};
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
	onFullscreen: events.PLAYEASE_FULLSCREEN
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


## Software License
-------------------

MIT.
