(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		renders = core.renders,
		rendermodes = renders.modes,
		css = utils.css;
	
	renders.flash = function(view, config) {
		var _this = utils.extend(this, new events.eventdispatcher('renders.flash')),
			_defaults = {},
			_video,
			_currentSrc;
		
		var ranges = function() {
			var _self = this;
			
			_self.length = 0;
			
			_self.start = function(index) {
				
			};
			
			_self.end = function(index) {
				
			};
		};
		
		function _init() {
			_this.name = rendermodes.FLASH;
			
			_this.config = utils.extend({}, _defaults, config);
			
			_video = utils.createElement('object');
			_video.id = _video.name = 'playease';
			_video.align = 'middle';
			_video.innerHTML = ''
				+ '<param name="quality" value="high">'
				+ '<param name="bgcolor" value="#ffffff">'
				+ '<param name="allowscriptaccess" value="sameDomain">'
				+ '<param name="allowfullscreen" value="true">';
			
			if (utils.isMSIE()) {
				_video.classid = 'clsid:D27CDB6E-AE6D-11cf-96B8-444553540000';
				_video.movie = '../swf/playease.swf';
			} else {
				_video.type = 'application/x-shockwave-flash';
				_video.data = '../swf/playease.swf';
			}
		}
		
		_this.setup = function() {
			setTimeout(function() {
				_video.currentTime = 0;
				_video.duration = 0;
				_video.buffered = new ranges();
				
				_video.setup(_this.config);
				_video.resize(_video.clientWidth, _video.clientHeight);
				
				_this.dispatchEvent(events.PLAYEASE_READY, { id: _this.config.id });
			}, 1000);
		};
		
		_this.play = function(url) {
			if (_video.src !== _currentSrc || url && url != _this.config.url) {
				if (url && url != _this.config.url) {
					_this.config.url = url;
				}
				
				_video.src = _this.config.url;
				_video.load();
				
				_currentSrc = _video.src
			}
			
			_video.play();
		};
		
		_this.pause = function() {
			_video.pause();
		};
		
		_this.reload = function() {
			_video.load();
		};
		
		_this.seek = function(offset) {
			if (_video.duration === NaN) {
				_this.play();
			} else {
				_video.currentTime = offset * _video.duration / 100;
			}
		};
		
		_this.stop = function() {
			_video.pause();
			_video.src = _currentSrc = undefined;
		};
		
		_this.mute = function(muted) {
			_video.muted = muted;
		};
		
		_this.volume = function(vol) {
			_video.volume = vol / 100;
		};
		
		_this.hd = function(index) {
			
		};
		
		_this.element = function() {
			return _video;
		};
		
		_this.resize = function(width, height) {
			_video.resize(width, height);
		};
		
		_this.destroy = function() {
			
		};
		
		_init();
	};
})(playease);
