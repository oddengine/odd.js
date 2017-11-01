(function(playease) {
	var utils = playease.utils,
		events = playease.events;
	
	var _insts = {},
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
			onFullscreen: events.PLAYEASE_FULLSCREEN,
			onResize: events.RESIZE
		};
	
	playease.api = function(container) {
		var _this = utils.extend(this, new events.eventdispatcher('api')),
			_entity;
		
		_this.container = container;
		_this.id = container.id;
		
		function _init() {
			utils.foreach(_eventMapping, function(name, type) {
				_this[name] = function(callback) {
					_this.addEventListener(type, callback);
				};
			});
		}
		
		_this.setup = function(options) {
			utils.emptyElement(_this.container);
			
			playease.debug = !!options.debug;
			
			_this.config = options;
			_this.config.id = _this.id;
			
			_this.embedder = new playease.embed(_this);
			_this.embedder.addGlobalListener(_onEvent);
			_this.embedder.embed();
			
			return _this;
		};
		
		_this.setEntity = function(entity) {
			_entity = entity;
			
			_this.onSWFLoaded = _entity.setup;
			_this.onSWFState = _entity.onSWFState;
			
			_this.play = _entity.play;
			_this.pause = _entity.pause;
			_this.reload = _entity.reload;
			_this.seek = _entity.seek;
			_this.stop = _entity.stop;
			_this.report = _entity.report;
			_this.mute = _entity.mute;
			_this.volume = _entity.volume;
			_this.videoOff = _entity.videoOff;
			_this.hd = _entity.hd;
			_this.bullet = _entity.bullet;
			_this.fullpage = _entity.fullpage;
			_this.fullscreen = _entity.fullscreen;
			
			_this.shoot = _entity.shoot;
			_this.resize = _entity.resize;
		};
		
		function _onEvent(e) {
			_forward(e);
		}
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_init();
	};
	
	playease.api.getInstance = function(identifier) {
		var _container;
		
		if (identifier == null) {
			identifier = 0;
		} else if (identifier.nodeType) {
			_container = identifier;
		} else if (utils.typeOf(identifier) === 'string') {
			_container = document.getElementById(identifier);
		}
		
		if (_container) {
			var inst = _insts[_container.id];
			if (!inst) {
				_insts[identifier] = inst = new playease.api(_container);
			}
			return inst;
		} else if (utils.typeOf(identifier) === 'number') {
			return _insts[identifier];
		}
		
		return null;
	};
	
	playease.api.displayError = function(message, config) {
		var displayLayer = document.getElementById(config.id + '-display');
		if (displayLayer && message !== undefined) {
			(displayLayer.lastChild || displayLayer).innerHTML = message;
		}
	};
})(playease);
