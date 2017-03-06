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
			_video;
		
		function _init() {
			_this.name = rendermodes.DEFAULT;
			
			_this.config = utils.extend({}, _defaults, config);
			
			_video = utils.createElement('video');
			_video.width = _this.config.width;
			_video.height = _this.config.height;
			_video.controls = _this.config.controls;
			_video.autoplay = _this.config.autoplay;
			_video.poster = _this.config.poster;
			if (!_this.config.autoplay) {
				_video.addEventListener('play', _onVideoPlay);
			}
		}
		
		_this.setup = function() {
			_this.dispatchEvent(events.PLAYEASE_READY, { id: _this.config.id });
		};
		
		_this.play = function() {
			_video.src = config.url;
		};
		
		_this.pause = function() {
			
		};
		
		_this.seek = function(time) {
			
		};
		
		_this.stop = function() {
			
		};
		
		_this.volume = function(vol) {
			
		};
		
		_this.mute = function(bool) {
			bool = !!bool;
		};
		
		_this.fullscreen = function(esc) {
			
		};
		
		function _onVideoPlay(e) {
			_video.removeEventListener('play', _onVideoPlay);
			_this.dispatchEvent(events.PLAYEASE_VIEW_PLAY);
		}
		
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
