(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		states = core.states;
	
	core.model = function(config) {
		 var _this = utils.extend(this, new events.eventdispatcher('core.model')),
		 	_defaults = {},
		 	_state = states.IDLE,
		 	_playlist,
		 	_properties;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_playlist = new utils.playlist(_this.config.sources, _this.config.render.name);
			_playlist.format();
			_playlist.addItem(_this.config.file);
			
			_properties = {
				ratio: _this.config.width / (_this.config.height - 40),
				playlist: _playlist,
				duration: 0,
				muted: false,
				volume: 80,
				videooff: false,
				bullet: _this.config.bulletscreen.enable,
				fullpage: false,
				fullscreen: false
			};
		}
		
		_this.setState = function(state) {
			if (state === _state) {
				return;
			}
			_state = state;
			_this.dispatchEvent(events.PLAYEASE_STATE, { state: state });
		};
		
		_this.getState = function() {
			return _state;
		};
		
		_this.setProperty = function(key, value) {
			if (_properties.hasOwnProperty(key) == true) {
				_properties[key] = value;
				_this.dispatchEvent(events.PLAYEASE_PROPERTY, { key: key, value: value });
			}
		};
		
		_this.getProperty = function(key) {
			return _properties[key];
		};
		
		_this.getConfig = function(name) {
			return _this.config[name];
		};
		
		_this.destroy = function() {
			
		};
		
		_init();
	};
})(playease);
