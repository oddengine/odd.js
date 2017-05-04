(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		states = core.states,
		renders = core.renders,
		rendermodes = renders.modes,
		css = utils.css;
	
	renders.flash = function(layer, config) {
		var _this = utils.extend(this, new events.eventdispatcher('renders.flash')),
			_defaults = {
				debug: true//playease.debug
			},
			_video,
			_url,
			_duration;
		
		function _init() {
			_this.name = rendermodes.FLASH;
			
			_this.config = utils.extend({}, _defaults, config);
			
			_url = '';
			_duration = 0;
			
			if (utils.isMSIE(8)) {
				layer.innerHTML = ''
					+ '<object id="pla-swf" name="pla-swf" align="middle" classid="clsid:D27CDB6E-AE6D-11cf-96B8-444553540000">'
						+ '<param name="movie" value="' + _this.config.swf + '">'
						+ '<param name="quality" value="high">'
						+ '<param name="bgcolor" value="#ffffff">'
						+ '<param name="allowscriptaccess" value="sameDomain">'
						+ '<param name="allowfullscreen" value="true">'
						+ '<param name="wmode" value="transparent">'
					+ '</object>';
				
				_video = layer.firstChild;
				
				return;
			}
			
			_video = utils.createElement('object');
			_video.id = _video.name = 'pla-swf';
			_video.align = 'middle';
			_video.innerHTML = ''
				+ '<param name="quality" value="high">'
				+ '<param name="bgcolor" value="#ffffff">'
				+ '<param name="allowscriptaccess" value="sameDomain">'
				+ '<param name="allowfullscreen" value="true">'
				+ '<param name="wmode" value="transparent">';
			
			if (utils.isMSIE()) {
				_video.classid = 'clsid:D27CDB6E-AE6D-11cf-96B8-444553540000';
				_video.movie = _this.config.swf;
			} else {
				_video.type = 'application/x-shockwave-flash';
				_video.data = _this.config.swf;
			}
		}
		
		_this.setup = function() {
			setTimeout(function() {
				_video.setup(_this.config);
				_video.resize(_video.clientWidth, _video.clientHeight);
				
				//_this.dispatchEvent(events.PLAYEASE_READY, { id: _this.config.id });
				playease(_this.config.id).setupReady();
			}, 500);
		};
		
		_this.play = function(url) {
			if (url && url != _url) {
				if (!renders.flash.isSupported(url)) {
					_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR);
					return;
				}
				
				_url = url;
			}
			
			_video.iplay(_url);
		};
		
		_this.pause = function() {
			_video.pause();
		};
		
		_this.reload = function() {
			_video.load();
		};
		
		_this.seek = function(offset) {
			_video.seek(offset);
		};
		
		_this.stop = function() {
			_video.istop();
			_duration = 0;
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
			var info = _video.getRenderInfo();
			
			if (_duration !== info.duration) {
				_this.dispatchEvent(events.PLAYEASE_DURATION, { duration: info.duration });
			}
			
			switch (info.state) {
				case states.STOPPED:
					_this.dispatchEvent(events.PLAYEASE_VIEW_STOP);
					break;
				case states.ERROR:
					_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR);
					break;
				default:
					break;
			}
			
			return info;
		};
		
		_this.element = function() {
			return _video;
		};
		
		_this.resize = function(width, height) {
			try {
				_video.resize(width, height);
			} catch (err) {
				/* void */
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
			undefined, // live stream
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
