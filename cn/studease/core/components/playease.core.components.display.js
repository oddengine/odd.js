(function(playease) {
	var utils = playease.utils,
		css = utils.css,
		events = playease.events,
		core = playease.core,
		states = core.states,
		components = core.components,
		
		DISPLAY_CLASS = 'pe-display',
		DISPLAY_ICON_CLASS = 'pe-display-icon',
		DISPLAY_LABEL_CLASS = 'pe-display-label';
	
	components.display = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('components.display')),
			_defaults = {
				id: 'pla-display'
			},
			_container,
			_group,
			_icon,
			_label,
			_timer;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_container = utils.createElement('div', DISPLAY_CLASS);
			_group = utils.createElement('div');
			
			_icon = utils.createElement('span', DISPLAY_ICON_CLASS);
			_label = utils.createElement('span', DISPLAY_LABEL_CLASS);
			_label.id = _this.config.id;
			
			_group.appendChild(_icon);
			_group.appendChild(_label);
			_container.appendChild(_group);
		}
		
		_this.show = function(state, message) {
			_label.innerText = message;
			
			switch (state) {
				case states.BUFFERING:
					_startTimer();
					break;
				default:
					_stopTimer();
					break;
			}
		};
		
		
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
			
		};
		
		_init();
	};
})(playease);
