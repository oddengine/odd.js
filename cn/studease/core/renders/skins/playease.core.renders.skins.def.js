(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		skins = playease.core.renders.skins,
		css = utils.css,
		
		WRAP_CLASS = 'playerwrap',
		RENDER_CLASS = 'render',
		
		// For all api instances
		CSS_SMOOTH_EASE = 'opacity .25s ease',
		CSS_100PCT = '100%',
		CSS_ABSOLUTE = 'absolute',
		CSS_RELATIVE = 'relative',
		CSS_NORMAL = 'normal',
		CSS_IMPORTANT = ' !important',
		CSS_HIDDEN = 'hidden',
		CSS_NONE = 'none',
		CSS_BLOCK = 'block';
	
	skins.def = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('skins.def'));
		
		_this.name = 'def';
		
		css('.' + WRAP_CLASS, {
			width: config.width + 'px',
			height: config.height + 'px',
			'box-shadow': '0 1px 1px rgba(0, 0, 0, 0.05)'
		});
		css('.' + WRAP_CLASS + ' *', {
			margin: '0',
			padding: '0',
			'font-family': '微软雅黑,arial,sans-serif',
			'font-size': '14px',
			'font-weight': CSS_NORMAL,
			'box-sizing': 'content-box'
		});
		
		css('.' + RENDER_CLASS, {
			width: config.width - 2 + 'px',
			height: config.height - 2 + 'px',
			border: '1px solid #1184ce',
			'border-radius': '4px',
			position: CSS_RELATIVE
		});
		
		
		_this.resize = function(width, height) {
			utils.log('Resizing to ' + width + ', ' + height);
			config.width = parseInt(width);
			config.height = parseInt(height);
			
			var _wrapper = document.getElementById(config.id),
				_renderLayer = document.getElementById(_this.name + RENDER_CLASS);
			
			css.style(_wrapper, {
				width: config.width + 'px',
				height: config.height + 'px'
			});
			css.style(_renderLayer, {
				width: config.width - 2 + 'px',
				height: config.height - 2 + 'px'
			});
		};
	};
})(playease);
