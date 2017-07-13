(function(playease) {
	var utils = playease.utils,
		css = utils.css,
		events = playease.events,
		core = playease.core,
		components = core.components,
		
		POSTER_CLASS = 'pe-poster';
	
	components.poster = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('components.poster')),
			_defaults = {
				url: ''
			},
			_ratio,
			_container,
			_image;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_ratio = _this.config.width / _this.config.height;
			
			_container = utils.createElement('div', POSTER_CLASS);
			if (_this.config.url) {
				_image = new Image();
				_image.onload = function(e) {
					_ratio = _image.naturalWidth / _image.naturalHeight;
				};
				_image.onerror = function(e) {
					utils.log('Poster not available.');
				};
				
				_image.src = _this.config.url;
				_container.appendChild(_image);
			}
		}
		
		_this.element = function() {
			return _container;
		};
		
		_this.resize = function(width, height) {
			if (!_image || !_ratio) {
				return;
			}
			
			var w, h;
			if (width / height >= _ratio) {
				w = height * _ratio;
				h = height;
			} else {
				w = width;
				h = width / _ratio;
			}
			
			var top = (height - h) / 2;
			var left = (width - w) / 2;
			
			css.style(_image, {
				width: w + 'px',
				height: h + 'px',
				top: top + 'px',
				left: left + 'px'
			});
		};
		
		_init();
	};
})(playease);
