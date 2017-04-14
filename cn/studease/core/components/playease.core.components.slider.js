(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		components = core.components,
		
		directions = {
			HORIZONTAL: 0,
			VERTICAL:   1
		};
	
	components.slider = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('components.controlbar')),
			_defaults = {
				name: '',
				rails: ['bg', 'buf', 'pro'],
				direction: directions.HORIZONTAL
			},
			_direction,
			_container,
			_percentage;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_direction = _this.config.direction;
			_percentage = 90;
			
			_build();
		}
		
		function _build() {
			if (utils.isMobile() && _this.config.name.indexOf('volume') === 0) {
				return;
			}
			
			_container = utils.createElement('div', 'plslider ' + _this.config.name);
			
			var arr = _this.config.rails;
			for (var i = 0; i < arr.length; i++) {
				var name = arr[i];
				var rail = utils.createElement('span', 'plrail ' + name);
				_container.appendChild(rail);
			}
			
			var thumb = utils.createElement('span', 'plthumb');
			_container.appendChild(thumb);
		}
		
		_this.update = function(percentage) {
			_percentage = percentage;
		};
		
		_this.element = function() {
			return _container;
		};
		
		_init();
	};
})(playease);
