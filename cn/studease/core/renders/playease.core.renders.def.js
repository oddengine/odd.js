(function(playease) {
	var utils = playease.utils,
		css = utils.css,
		events = playease.events,
		core = playease.core,
		states = core.states,
		renders = core.renders,
		rendertypes = renders.types;
	
	renders.def = function(layer, config) {
		var _this = utils.extend(this, new events.eventdispatcher('renders.def')),
			_defaults = {},
			_video,
			_url,
			_src,
			_isWXReady,
			_waiting;
		
		function _init() {
			_this.name = rendertypes.DEFAULT;
			
			_this.config = utils.extend({}, _defaults, config);
			
			_url = '';
			_src = '';
			_weixinReady = false;
			_waiting = true;
			
			_video = utils.createElement('video');
			if (_this.config.airplay) {
				_video.setAttribute('x-webkit-airplay', 'allow');
			}
			if (_this.config.playsinline) {
				_video.setAttribute('playsinline', '');
				_video.setAttribute('webkit-playsinline', '');
				_video.setAttribute('x5-playsinline', '');
				_video.setAttribute('x5-video-player-type', 'h5');
				_video.setAttribute('x5-video-player-fullscreen', true);
			}
			_video.preload = 'none';
			
			_video.addEventListener('durationchange', _onDurationChange);
			_video.addEventListener('waiting', _onWaiting);
			_video.addEventListener('canplay', _onPlaying);
			_video.addEventListener('playing', _onPlaying);
			_video.addEventListener('pause', _onPause);
			_video.addEventListener('ended', _onEnded);
			_video.addEventListener('error', _onError);
			
			document.addEventListener('WeixinJSBridgeReady', function() {
				_weixinReady = true;
			});
		}
		
		_this.setup = function() {
			if (!_weixinReady && utils.isWeixin()) {
				document.addEventListener('WeixinJSBridgeReady', _onWeixinJSBridgeReady);
			} else {
				_onWeixinJSBridgeReady();
			}
		};
		
		function _onWeixinJSBridgeReady(e) {
			_this.dispatchEvent(events.PLAYEASE_READY, { id: _this.config.id });
		}
		
		_this.attach = function(url) {
			_video.src = url;
		};
		
		_this.play = function(url) {
			if (!_video.src || _video.src !== _src || url && url != _url) {
				if (url && url != _url) {
					if (!renders.def.isSupported(url)) {
						_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'Resource not supported by render "' + _this.name + '".' });
						return;
					}
					
					_url = url;
				}
				
				_waiting = true;
				
				_video.src = _url;
				_src = _video.src;
			}
			
			var promise = _video.play();
			if (promise) {
				promise['catch'](function(e) { /* void */ });
			}
			
			_video.controls = false;
		};
		
		_this.pause = function() {
			_waiting = false;
			
			_video.pause();
			_video.controls = false;
		};
		
		_this.reload = function() {
			_this.stop();
			_this.play(_url);
		};
		
		_this.seek = function(offset) {
			if (isNaN(_video.duration)) {
				_this.play();
			} else {
				_video.currentTime = offset * _video.duration / 100;
				
				var promise = _video.play();
				if (promise) {
					promise['catch'](function(e) { /* void */ });
				}
			}
			
			_video.controls = false;
		};
		
		_this.stop = function() {
			_src = '';
			_waiting = true;
			
			_video.removeAttribute('src');
			_video.pause();
			_video.load();
			_video.controls = false;
			
			_this.dispatchEvent(events.PLAYEASE_STATE, { state: states.IDLE });
		};
		
		_this.mute = function(muted) {
			_video.muted = muted;
		};
		
		_this.volume = function(vol) {
			_video.volume = vol / 100;
		};
		
		_this.hd = function(index) {
			
		};
		
		
		_this.getRenderInfo = function() {
			var buffered;
			var position = _video.currentTime;
			var duration = _video.duration;
			
			var ranges = _video.buffered, start, end;
			for (var i = 0; i < ranges.length; i++) {
				start = ranges.start(i);
				end = ranges.end(i);
				if (start <= position && position < end) {
					buffered = duration ? Math.floor(end / _video.duration * 10000) / 100 : 0;
				}
			}
			
			if (_waiting && end - position >= _this.config.bufferTime) {
				_waiting = false;
				_this.dispatchEvent(events.PLAYEASE_VIEW_PLAY);
			}
			
			return {
				buffered: buffered,
				position: position,
				duration: duration
			};
		};
		
		
		function _onDurationChange(e) {
			_this.dispatchEvent(events.PLAYEASE_DURATION, { duration: e.target.duration });
		}
		
		function _onWaiting(e) {
			_waiting = true;
			_this.dispatchEvent(events.PLAYEASE_STATE, { state: states.BUFFERING });
		}
		
		function _onPlaying(e) {
			_this.dispatchEvent(events.PLAYEASE_STATE, { state: states.PLAYING });
		}
		
		function _onPause(e) {
			if (!_waiting) {
				_this.dispatchEvent(events.PLAYEASE_STATE, { state: states.PAUSED });
			}
		}
		
		function _onEnded(e) {
			_this.dispatchEvent(events.PLAYEASE_STATE, { state: states.STOPPED });
		}
		
		function _onError(e) {
			var message = 'Video error ocurred!';
			_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: message });
			_this.dispatchEvent(events.PLAYEASE_STATE, { state: states.ERROR, message: message });
		}
		
		
		_this.element = function() {
			return _video;
		};
		
		_this.resize = function(width, height) {
			css.style(_video, {
				width: width + 'px',
				height: height + 'px'
			});
		};
		
		_this.destroy = function() {
			
		};
		
		_init();
	};
	
	renders.def.isSupported = function(file) {
		var protocol = utils.getProtocol(file);
		if (protocol != 'http' && protocol != 'https') {
			return false;
		}
		
		if (utils.isMSIE(8)) {
			return false;
		}
		
		var mobilemap = [
			'm3u8', 'm3u', 'hls',
			'mp4', 'f4v', 'm4v', 'mov',
			'm4a', 'f4a', 'aac',
			'ogv', 'ogg',
			'mp3',
			'oga',
			'webm'
		];
		var html5map = [
			'mp4', 'f4v', 'm4v', 'mov',
			'm4a', 'f4a', 'aac',
			'ogv', 'ogg',
			'mp3',
			'oga',
			'webm'
		];
		var map = utils.isMobile() || utils.isMac() ? mobilemap : html5map;
		var extension = utils.getExtension(file);
		for (var i = 0; i < map.length; i++) {
			if (extension === map[i]) {
				return true;
			}
		}
		
		return false;
	};
})(playease);
