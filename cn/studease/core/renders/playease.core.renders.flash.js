(function(playease) {
	var utils = playease.utils,
		css = utils.css,
		events = playease.events,
		core = playease.core,
		states = core.states,
		renders = core.renders,
		rendertypes = renders.types;
	
	renders.flash = function(layer, config) {
		var _this = utils.extend(this, new events.eventdispatcher('renders.flash')),
			_defaults = {
				debug: playease.debug
			},
			_video,
			_url,
			_duration;
		
		function _init() {
			_this.name = rendertypes.FLASH;
			
			_this.config = utils.extend({}, _defaults, config);
			
			_url = '';
			_duration = 0;
			
			if (utils.isMSIE(8)) {
				var div = utils.createElement('div');
				div.innerHTML = ''
					+ '<object id="pe-swf" name="pe-swf" align="middle" classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000">'
						+ '<param name="movie" value="' + _this.config.swf + '">'
						+ '<param name="quality" value="high">'
						+ '<param name="bgcolor" value="#ffffff">'
						+ '<param name="allowscriptaccess" value="sameDomain">'
						+ '<param name="allowfullscreen" value="true">'
						+ '<param name="wmode" value="transparent">'
						+ '<param name="FlashVars" value="id=' + _this.config.id + '">'
					+ '</object>';
				
				_video = div.firstChild;
				
				return;
			}
			
			_video = utils.createElement('object');
			_video.id = _video.name = 'pe-swf';
			_video.align = 'middle';
			_video.innerHTML = ''
				+ '<param name="quality" value="high">'
				+ '<param name="bgcolor" value="#ffffff">'
				+ '<param name="allowscriptaccess" value="sameDomain">'
				+ '<param name="allowfullscreen" value="true">'
				+ '<param name="wmode" value="transparent">'
				+ '<param name="FlashVars" value="id=' + _this.config.id + '">';
			
			if (utils.isMSIE()) {
				_video.classid = 'clsid:D27CDB6E-AE6D-11cf-96B8-444553540000';
				_video.movie = _this.config.swf;
			} else {
				_video.type = 'application/x-shockwave-flash';
				_video.data = _this.config.swf;
			}
		}
		
		_this.setup = function() {
			if (_video.setup) {
				_video.setup(_this.config);
				_video.resize(_video.clientWidth, _video.clientHeight);
				_this.dispatchEvent(events.PLAYEASE_READY, { id: _this.config.id });
			}
		};
		
		_this.play = function(url) {
			if (url && url != _url) {
				if (!renders.flash.isSupported(url)) {
					_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'Resource not supported by render "' + _this.name + '".' });
					return;
				}
				
				_url = url;
			}
			
			if (_video.xplay) {
				_video.xplay(_url);
			}
		};
		
		_this.pause = function() {
			if (_video.pause) {
				_video.pause();
			}
		};
		
		_this.reload = function() {
			if (_video.reload) {
				_video.reload();
			}
		};
		
		_this.seek = function(offset) {
			if (_video.seek) {
				_video.seek(offset);
			}
		};
		
		_this.stop = function() {
			if (_video.xstop) {
				_video.xstop();
			}

			_duration = 0;
		};
		
		_this.mute = function(muted) {
			if (_video.muted) {
				_video.muted(muted);
			}
		};
		
		_this.volume = function(vol) {
			if (_video.volume) {
				_video.volume(vol);
			}
		};
		
		_this.hd = function(index) {
			
		};
		
		
		_this.getRenderInfo = function() {
			if (!_video.getRenderInfo) {
				return {};
			}
			
			var info = _video.getRenderInfo();
			
			if (_duration !== info.duration) {
				_this.dispatchEvent(events.PLAYEASE_DURATION, { duration: info.duration });
			}
			
			return info;
		};
		
		_this.element = function() {
			return _video;
		};
		
		_this.resize = function(width, height) {
			if (!_video) {
				return;
			}
			
			css.style(_video, {
				width: width + 'px',
				height: height + 'px'
			});
			
			if (_video.resize) {
				_video.resize(width, height);
			}
		};
		
		_this.destroy = function() {
			
		};
		
		_init();
	};
	
	renders.flash.isSupported = function(file) {
		var protocol = utils.getProtocol(file);
		if (protocol != 'http' && protocol != 'https' && protocol != 'rtmp' && protocol != 'rtmpe') {
			return false;
		}
		
		if (utils.isMobile()) {
			return false;
		}
		
		var map = [
			undefined, '', // live stream
			'flv',
			'mp4', 'f4v', 'm4v', 'mov',
			'm4a', 'f4a', 'aac',
			'mp3'
		];
		var extension = utils.getExtension(file);
		for (var i = 0; i < map.length; i++) {
			if (extension === map[i]) {
				return true;
			}
		}
		
		return false;
	};
})(playease);
