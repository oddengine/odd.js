(function(playease) {
	var utils = playease.utils,
		events = playease.events;
	
	var _insts = {},
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
		
		_this.setEntity = function(entity, renderName) {
			_entity = entity;
			_this.renderName = renderName;
			
			_this.play = _entity.play;
			_this.pause = _entity.pause;
			_this.seek = _entity.seek;
			_this.stop = _entity.stop;
			_this.volume = _entity.volume;
			_this.mute = _entity.mute;
			_this.fullscreen = _entity.fullscreen;
			
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
		
	};
})(playease);
