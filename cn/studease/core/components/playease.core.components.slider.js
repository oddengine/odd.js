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
				direction: directions.HORIZONTAL
			},
			_railnames = ['bg', 'buf', 'pro'],
			_rails,
			_direction,
			_container,
			_percentage;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_rails = {};
			_direction = _this.config.direction;
			_percentage = 90;
			
			_build();
		}
		
		function _build() {
			if (utils.isMobile() && _this.config.name.indexOf('volume') === 0) {
				return;
			}
			
			_container = utils.createElement('div', 'plslider ' + _this.config.name);
			
			for (var i = 0; i < _railnames.length; i++) {
				var name = _railnames[i];
				var rail = _rails[name] = utils.createElement('span', 'plrail ' + name);
				_container.appendChild(rail);
			}
			
			var thumb = utils.createElement('span', 'plthumb');
			_container.appendChild(thumb);
		}
		
		_this.buffered = function(percentage) {
			_rails.buf.style.width = percentage + '%';
		};
		
		_this.update = function(percentage) {
			_percentage = percentage;
			_rails.pro.style.width = _percentage + '%';
		};
		
		_this.element = function() {
			return _container;
		};
		
		_init();
	};
})(playease);
