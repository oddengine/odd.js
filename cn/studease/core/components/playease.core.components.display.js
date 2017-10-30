(function(playease) {
	var utils = playease.utils,
		css = utils.css,
		events = playease.events,
		core = playease.core,
		states = core.states,
		components = core.components,
		
		DISPLAY_CLASS = 'pe-display',
		DISPLAY_ICON_CLASS = 'pe-display-icon',
		DISPLAY_LABEL_CLASS = 'pe-display-label',
		
		CSS_NONE = 'none',
		CSS_BLOCK = 'block',
		CSS_INLINE_BLOCK = 'inline-block';
	
	components.display = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('components.display')),
			_defaults = {
				id: 'pe-display'
			},
			_container,
			_icon,
			_label,
			_timer;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_container = utils.createElement('div', DISPLAY_CLASS);
			
			_icon = utils.createElement('span', 'pe-button ' + DISPLAY_ICON_CLASS);
			try {
				_icon.addEventListener('click', _onClick);
			} catch (err) {
				_icon.attachEvent('onclick', _onClick);
			}
			
			_label = utils.createElement('span', DISPLAY_LABEL_CLASS);
			_label.id = _this.config.id;
			
			_container.appendChild(_icon);
			_container.appendChild(_label);
		}
		
		_this.show = function(state, message) {
			switch (state) {
				case states.BUFFERING:
					_startTimer();
					break;
					
				default:
					_stopTimer();
					break;
			}
			
			css.style(_icon, {
				filter: 'progid:DXImageTransform.Microsoft.BasicImage(rotation=0)',
				'transform': 'rotate(0deg)',
				'-o-transform': 'rotate(0deg)',
				'-ms-transform': 'rotate(0deg)',
				'-moz-transform': 'rotate(0deg)',
				'-webkit-transform': 'rotate(0deg)',
				display: state == states.ERROR ? CSS_NONE : CSS_BLOCK
			});
			css.style(_label, {
				display: message ? CSS_INLINE_BLOCK : CSS_NONE
			});
			
			_label.innerHTML = message;
		};
		
		function _onClick(e) {
			_this.dispatchEvent(events.PLAYEASE_VIEW_CLICK);
		}
		
		function _startTimer() {
			if (!_timer) {
				_timer = new utils.timer(80);
				_timer.addEventListener(events.PLAYEASE_TIMER, _rotateIcon);
			}
			_timer.start();
		}
		
		function _stopTimer() {
			if (_timer) {
				_timer.stop();
			}
			
			css.style(_icon, {
				filter: 'progid:DXImageTransform.Microsoft.BasicImage(rotation=0)',
				'transform': 'rotate(0deg)',
				'-o-transform': 'rotate(0deg)',
				'-ms-transform': 'rotate(0deg)',
				'-moz-transform': 'rotate(0deg)',
				'-webkit-transform': 'rotate(0deg)'
			});
		}
		
		function _rotateIcon(e) {
			var angle = _timer.currentCount() * 30 % 360;
			
			css.style(_icon, {
				filter: 'progid:DXImageTransform.Microsoft.BasicImage(rotation=' + angle * Math.PI / 180 + ')',
				'transform': 'rotate(' + angle + 'deg)',
				'-o-transform': 'rotate(' + angle + 'deg)',
				'-ms-transform': 'rotate(' + angle + 'deg)',
				'-moz-transform': 'rotate(' + angle + 'deg)',
				'-webkit-transform': 'rotate(' + angle + 'deg)'
			});
		}
		
		
		_this.element = function() {
			return _container;
		};
		
		_this.resize = function(width, height) {
			css.style(_icon, {
				top: (height - 48) / 2 + 'px',
				left: (width - 48) / 2 + 'px'
			});
			css.style(_label, {
				'margin-top': (height - 32) / 2 + 'px'
			});
		};
		
		_init();
	};
})(playease);
