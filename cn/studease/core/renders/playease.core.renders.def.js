(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		renders = core.renders,
		rendermodes = renders.modes,
		css = utils.css,
		
		RENDER_CLASS = 'pla-render',
		
		// For all api instances
		CSS_SMOOTH_EASE = 'opacity .25s ease',
		CSS_100PCT = '100%',
		CSS_ABSOLUTE = 'absolute',
		CSS_IMPORTANT = ' !important',
		CSS_HIDDEN = 'hidden',
		CSS_NONE = 'none',
		CSS_BLOCK = 'block';
	
	renders.def = function(view, config) {
		var _this = utils.extend(this, new events.eventdispatcher('renders.def')),
			_defaults = {},
			_defaultLayout = '[play elapsed duration][time][hd volume fullscreen]',
			_video,
			_mediainfo,
			_ms,
			_sbs,
			_segments,
			_endOfStream = false;
		
		function _init() {
			_this.name = rendermodes.DEFAULT;
			
			_this.config = utils.extend({}, _defaults, config);
			
			_sbs = { audio: null, video: null };
			_segments = { audio: [], video: [] };
			
			_video = utils.createElement('video');
			_video.width = _this.config.width;
			_video.height = _this.config.height;
			_video.controls = _this.config.controls;
			_video.autoplay = _this.config.autoplay;
			_video.poster = _this.config.poster;
			if (!_this.config.autoplay) {
				_video.addEventListener('play', _onVideoPlay);
			}
			
			window.MediaSource = window.MediaSource || window.WebKitMediaSource;
			
			_ms = new MediaSource();
			_ms.addEventListener('sourceopen', _onMediaSourceOpen);
			_ms.addEventListener('sourceended', _onMediaSourceEnded);
			_ms.addEventListener('sourceclose', _onMediaSourceClose);
			_ms.addEventListener('error', _onMediaSourceError);
			
			_ms.addEventListener('webkitsourceopen', _onMediaSourceOpen);
			_ms.addEventListener('webkitsourceended', _onMediaSourceEnded);
			_ms.addEventListener('webkitsourceclose', _onMediaSourceClose);
			_ms.addEventListener('webkiterror', _onMediaSourceError);
		}
		
		_this.setup = function() {
			_video.src = window.URL.createObjectURL(_ms);
		};
		
		function _onVideoPlay(e) {
			_video.removeEventListener('play', _onVideoPlay);
			_this.dispatchEvent(events.PLAYEASE_VIEW_PLAY);
		}
		
		_this.appendInitSegment = function(type, seg) {
			var mimetype = type + '/mp4; codecs="' + _mediainfo[type + 'Codec'] + '"';
			var issurpported = MediaSource.isTypeSupported(mimetype);
			if (!issurpported) {
				_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'Mime type is not surpported: ' + mimetype + '.' });
				return;
			}
			utils.log('Mime type: ' + mimetype + '.');
			
			if (_ms.readyState == 'closed') {
				_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'MediaSource is closed while appending init segment.' });
				return;
			}
			
			var sb = _sbs[type] = _ms.addSourceBuffer(mimetype);
			sb.type = type;
			sb.addEventListener('updateend', _onUpdateEnd);
			sb.addEventListener('error', _onSourceBufferError);
			sb.appendBuffer(seg);
		};
		
		_this.appendSegment = function(type, seg) {
			_segments[type].push(seg);
			
			var sb = _sbs[type];
			if (sb.updating) {
				return;
			}
			
			var seg = _segments[type].shift();
			sb.appendBuffer(seg);
		};
		
		_this.setMediaInfo = function(info) {
			_mediainfo = info;
		};
		
		_this.endOfStream = function() {
			_endOfStream = true;
		};
		
		function _onMediaSourceOpen(e) {
			utils.log('source open');
			
			_this.dispatchEvent(events.PLAYEASE_READY, { id: _this.config.id });
		}
		
		function _onUpdateEnd(e) {
			utils.log('update end');
			
			var type = e.target.type;
			
			if (_endOfStream) {
				if (!_ms || _ms.readyState !== 'open') {
					return;
				}
				
				if (!_segments.audio.length && !_segments.video.length) {
					_ms.endOfStream();
					return;
				}
			}
			
			if (_segments[type].length == 0) {
				return;
			}
			
			var sb = _sbs[type];
			if (sb.updating) {
				return;
			}
			
			var seg = _segments[type].shift();
			try {
				sb.appendBuffer(seg);
			} catch (e) {
				utils.log(e);
			}
		}
		
		function _onSourceBufferError(e) {
			utils.log('source buffer error');
		}
		
		function _onMediaSourceEnded(e) {
			utils.log('source ended');
		}
		
		function _onMediaSourceClose(e) {
			utils.log('source close');
		}
		
		function _onMediaSourceError(e) {
			utils.log('media source error');
		}
		
		_this.display = function(icon, message) {
			
		};
		
		_this.element = function() {
			return _video;
		};
		
		_this.resize = function(width, height) {
			
		};
		
		_this.destroy = function() {
			
		};
		
		_init();
	};
})(playease);
