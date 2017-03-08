# playease.js

> [[domain] http://studease.cn](http://studease.cn)

> [[source] https://github.com/studease/playease](https://github.com/studease/playease)

This is a html5 media player for flv live streaming.


## Example (Uncompleted, coming soon.)
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
	cors: 'no-cors',
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
	cors: 'no-cors',
	bufferTime: .1,
	controls: true,
	autoplay: true,
	poster: null,
	render: {
		name: renderModes.DEFAULT
	},
	skin: {
		name: skinModes.DEFAULT
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
	onBuffer: events.PLAYEASE_BUFFER,
	onPlay: events.PLAYEASE_PLAY,
	onPause: events.PLAYEASE_PAUSE,
	onSeek: events.PLAYEASE_SEEK,
	onStop: events.PLAYEASE_STOP,
	onVolume: events.PLAYEASE_VIEW_VOLUME,
	onMute: events.PLAYEASE_VIEW_MUTE,
	onFullscreen: events.PLAYEASE_VIEW_FULLSCREEN
};
```

### Interface

* **play(url)**
* **pause()**
* **seek(offset)**
* **stop()**
* **volume(vol)**
* **mute(bool)**
* **fullscreen(bool)**
* **resize(width, height)**


## Software License
-------------------

MIT.
