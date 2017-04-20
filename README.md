# playease.js

> [[domain] http://studease.cn](http://studease.cn)

> [[source] https://github.com/studease/playease](https://github.com/studease/playease)

This is a html5 media player for flv live streaming.


## Example
----------

### Basic Configuraion

The example below will find the element with an id of player and render a video into it.

```js
<div id='player'></div>
...
playease('player').setup({
	url: '/vod/sample.flv',
	width: 640,
	height: 360,
	type: 'vod',
	cors: 'no-cors',
	controls: true,
	autoplay: true,
	poster: 'sample.png',
	render: {
		name: 'flv'
	}
});
```

### More Configuration

Please have a look at cn/studease/embed/playease.embed.config.js.

```js
_defaults = {
	url: 'http://' + window.location.host + '/vod/sample.mp4',
	width: 640,
	height: 360,
	sources: [],
	type: sourcetypes.LIVE,
	cors: 'no-cors',
	bufferTime: .1,
	controls: true,
	autoplay: true,
	playsinline: true,
	poster: '',
	bulletscreen: {
		enable: true,
		fontsize: 14,
		alpha: alphas.LOW,
		position: positions.FULLSCREEN
	},
	render: {
		name: rendermodes.DEFAULT
	},
	skin: {
		name: skinmodes.DEFAULT
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
	onReported: events.PLAYEASE_REPORTED,
	onMuted: events.PLAYEASE_MUTED,
	onVolume: events.PLAYEASE_VOLUME,
	onHD: events.PLAYEASE_HD,
	onBullet: events.PLAYEASE_BULLET,
	onFullpage: events.PLAYEASE_FULLPAFE,
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
* **hd()**
* **bullet()**
* **fullpage(exit)**
* **fullscreen(exit)**
* **shoot(text)**
* **resize(width, height)**


## Software License
-------------------

MIT.
