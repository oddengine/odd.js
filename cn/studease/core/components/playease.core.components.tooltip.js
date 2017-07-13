(function(playease) {
	var utils = playease.utils,
		css = utils.css,
		events = playease.events,
		core = playease.core,
		components = core.components,
		
		TOOLTIP_CLASS = 'pe-tooltip';
	
	components.tooltip = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('components.tooltip')),
			_defaults = {
				name: 'tooltip'
			},
			_container,
			_elements;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_elements = {};
			
			_container = utils.createElement('div', TOOLTIP_CLASS + ' ' + _this.config.name);
		}
		
		_this.appendChild = function(node) {
			_elements[node.index] = node;
			_container.appendChild(node);
		};
		
		_this.removeChild = function(node) {
			delete _elements[node.index];
			_container.removeChild(node);
		};
		
		_this.activeItemAt = function(index) {
			utils.foreach(_elements, function(idx, node) {
				if (idx == index) {
					utils.addClass(node, 'active');
				} else {
					utils.removeClass(node, 'active');
				}
			});
			
			setTimeout(function() {
				_this.resize();
			});
		};
		
		_this.element = function() {
			return _container;
		};
		
		_this.resize = function(width, height) {
			var offsetX = (_container.parentNode.clientWidth - _container.clientWidth) / 2;
			
			css.style(_container, {
				left: offsetX + 'px'
			});
		};
		
		_init();
	};
})(playease);
