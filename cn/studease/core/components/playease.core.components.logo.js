(function(playease) {
	var utils = playease.utils,
		css = utils.css,
		events = playease.events,
		core = playease.core,
		components = core.components,
		
		positions = {
			TOP_LEFT:     'top-left',
			TOP_RIGHT:    'top-right',
			BOTTOM_LEFT:  'bottom-left',
			BOTTOM_RIGHT: 'bottom-right'
		},
		
		LOGO_CLASS = 'pe-logo';
	
	components.logo = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('components.logo')),
			_defaults = {
				file: '',
				link: 'http://studease.cn/playease',
				target: '_blank',
				margin: '3% 5%',
				visible: true,
				position: positions.TOP_RIGHT
			},
			_container,
			_logo,
			_img,
			_loaded = false;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_container = utils.createElement('div', LOGO_CLASS);
			_logo = utils.createElement('a');
			
			var style = {
				visibility: _this.config.visible ? 'visible' : 'hidden'
			};
			var arr = _this.config.position.match(/([a-z]+)-([a-z]+)/i);
			if (arr && arr.length > 2) {
				style.margin = _this.config.margin;
				style[arr[1]] = '0';
				style[arr[2]] = '0';
			}
			css.style(_container, style);
			
			_img = new Image();
			_img.onload = _onload;
			_img.onabort = _onerror;
			_img.onerror = _onerror;
			
			_img.src = _this.config.file;
		}
		
		function _onload(e) {
			_loaded = true;
			
			css.style(_container, {
				width: _img.width + 'px',
				height: _img.height + 'px'
			});
			css.style(_logo, {
				'background-image': 'url(' + _this.config.file + ')'
			});
			
			_logo.href = _this.config.link;
			_logo.target = _this.config.target;
			
			_container.appendChild(_logo);
			
			setTimeout(function() {
				_this.resize();
			});
		}
		
		function _onerror(e) {
			utils.log('Logo image not available.');
		}
		
		
		_this.element = function() {
			return _container;
		};
		
		_this.resize = function(width, height) {
			
		};
		
		_init();
	};
	
	components.logo.positions = positions;
})(playease);
