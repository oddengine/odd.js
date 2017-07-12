# playease.js

> [[domain] http://studease.cn](http://studease.cn)

> [[source] https://github.com/studease/playease](https://github.com/studease/playease)

This is a HTML5 video player for FLV/fMP4 live streaming, FLV/fMP4 VoD and original HTML5 media resources, eg. Ogg, Mpeg4, WebM, HLS.
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
	file: '/vod/sample.flv',
	/*sources: [{
		file: '/vod/sample.mp4',
		type: 'def'
	}],*/
	mode: 'vod',
	controls: true,
	autoplay: true,
	poster: 'sample.png',
	loader: {
		mode: 'cors'
	},
	render: {
		name: 'flv'
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
	report: true,
	debug: false,
	loader: {
		mode: iomodes.CORS
	},
	logo: {
		visible: true
	},
	bulletscreen: {
		enable: true,
		visible: true
	},
	render: {
		name: rendertypes.DEFAULT,
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
* **mute()**
* **volume(vol)**
* **hd(index)**
* **bullet()**
* **fullpage(exit)**
* **fullscreen(exit)**
* **shoot(text)**
* **resize(width, height)**


## Software License
-------------------

MIT.
