(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		renders = core.renders,
		skins = renders.skins,
		skinModes = skins.modes,
		css = utils.css,
		
		RENDER_CLASS = 'render',
		
		// For all api instances
		CSS_SMOOTH_EASE = 'opacity .25s ease',
		CSS_100PCT = '100%',
		CSS_ABSOLUTE = 'absolute',
		CSS_IMPORTANT = ' !important',
		CSS_HIDDEN = 'hidden',
		CSS_NONE = 'none',
		CSS_BLOCK = 'block';
	
	renders.def = function(view, config) {
		var _this = utils.extend(this, new events.eventdispatcher('renders.def')),
			_defaults = {
				minWidth: 320,
		 		minHeight: 180,
				skin: {
					name: skinModes.DEFAULT
				}
			},
			_defaultLayout = '[play elapsed duration][time][hd volume fullscreen]',
			_skin,
			
			_renderLayer;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			_this.config.width = Math.max(_this.config.width, _this.config.minWidth);
			_this.config.height = Math.max(_this.config.height, _this.config.minHeight);
			
			_renderLayer = utils.createElement('div', RENDER_CLASS);
			
			_buildComponents();
			
			try {
				_skin = new skins[_this.config.skin.name](_this.config);
			} catch (e) {
				utils.log('Failed to init skin[' + _this.config.skin.name + '].');
			}
			if (!_skin) {
				_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'Skin not found!', name: _this.config.skin.name });
			}
		}
		
		function _buildComponents() {
			
		}
		
		_this.display = function(icon, message) {
			
		};
		
		_this.element = function() {
			return _renderLayer;
		};
		
		_this.resize = function(width, height) {
			width = width || _renderLayer.offsetWidth || config.width;
			height = height || _renderLayer.offsetHeight || config.height;
			if (_skin) 
				_skin.resize(Math.max(width, _this.config.minWidth), Math.max(height, _this.config.minHeight));
		};
		
		_this.destroy = function() {
			
		};
		
		_init();
	};
})(playease);
