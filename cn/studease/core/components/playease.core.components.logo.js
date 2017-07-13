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
		
		LOGO_CLASS = 'pla-logo';
	
	components.logo = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('components.logo')),
			_defaults = {
				file: '',
				link: 'http://studease.cn/playease',
				target: '_blank',
				margin: 20,
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
			
			css.style(_container, {
				visibility: _this.config.visible ? 'visible' : 'hidden'
			});
			
			_img = new Image();
			_img.onload = _onload;
			_img.onabort = _onerror;
			_img.onerror = _onerror;
			
			_img.src = _this.config.file;
		}
		
		function _onload(e) {
			_loaded = true;
			
			var style = {
				width: _img.width + 'px',
				height: _img.height + 'px',
				'background-image': 'url(' + _this.config.file + ')'
			};
			
			var arr = _this.config.position.match(/([a-z]+)-([a-z]+)/i);
			if (arr && arr.length > 2) {
				style['margin-' + arr[1]] = _this.config.margin + 'px';
				style['margin-' + arr[2]] = _this.config.margin + 'px';
				style[arr[1]] = '0';
				style[arr[2]] = '0';
			}
			
			css.style(_logo, style);
			
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
			if (!_loaded) {
				return;
			}
			
			width = _img.width * _container.clientWidth / 640;
			width = Math.max(width, _img.width * 0.7);
			width = Math.min(width, _img.width * 1.2);
			
			height = width * _img.height / _img.width;
			
			css.style(_logo, {
				width: width + 'px',
				height: height + 'px'
			});
		};
		
		_init();
	};
	
	components.logo.positions = positions;
})(playease);
