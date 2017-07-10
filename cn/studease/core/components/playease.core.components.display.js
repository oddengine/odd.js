(function(playease) {
	var utils = playease.utils,
		css = utils.css,
		events = playease.events,
		core = playease.core,
		states = core.states,
		components = core.components,
		
		DISPLAY_ICON_CLASS = 'pla-display-icon',
		DISPLAY_LABEL_CLASS = 'pla-display-label';
	
	components.display = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('components.display')),
			_defaults = {
				id: 'pla-display'
			},
			_container,
			_icon,
			_label,
			_timer;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_container = utils.createElement('div');
			_container.id = _this.config.id;
			
			_icon = utils.createElement('span', DISPLAY_ICON_CLASS);
			_label = utils.createElement('span', DISPLAY_LABEL_CLASS);
			
			_container.appendChild(_icon);
			_container.appendChild(_label);
		}
		
		_this.show = function(state, message) {
			switch (state) {
				case states.BUFFERING:
					css.style(_icon, {
						'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAACm0lEQVRYR81XS3LaQBDtLrSQVoENVerZOCcAnyDkBHZuACeIc4LYJ4h9A3ICOycIPkHwCUIWjKrYYDZAFZ92NTWihDQCjYSrMsv5dL/p6fe6B6HCiKKoy8wtRHwFgOcwDAeu5tD1gOyPouhiu90+ImI7df6eiL652CwFQGstN/2U4+gLET0VBeEMYDqd1heLxfSIg19EdF0ZQBRFHWa+YuY6Ig6J6MGEX+Z/H3HwTESdSgDG4/EtIn5PGmHmoVLqUua01vxuEZhMJu31ev3H5oCZ75RSt1rrewD4atuDiJ9d2JDJAdvtE4524TV50AeAq8TaDBFvwjCU+f3QWks+PALAAxHdpEGXAhAbMdHqGB0YhGE4SjtIXMianBkARZ6gaILF+yShfd8fNhoNEayDYaWh7Y2Z+UUplRYeVyyZ/bk6YN5O6HQBAAMiksQ7+3AWonMjOAAg77/ZbFq1Wu2l2WwOz+3MStt4Umst+r2nFTP3lVK99waxi4DWWvj5I5OhiL00r6sCMrRseZ53J1GOAeRVN6fCcgpcQpRk6852DOAg/AlDP4moe8pw0fWUxuxsxwBiuTwUCUddLwLEVNl2EAR9EaY9C0we3ALABwCYAUDXpbEo4vwoC8oaqHru/xKiqrcpcz43Aqm+4CkIgp6tmp1yKr3DcrlsAcA/W7nOq4Y2VjhTUpzP5/O/iFgXoJ7nXaYlvnA5BoAREX08dePkuqHcvoGNW7rknjwANmm2drvySfF9/9X2PLImzayhtvjN/BmsAEzoBogobydj5nleJxk+0xdKr7drwTGnboj6rVara9PaZz4sR2ko2m3eL9Pv2QpYEAQN10QtrQO27tmWZKdypjSAdPNatmcsDUBuZrJcKDuKi8upG6fX3wDkiU4w8YbpAwAAAABJRU5ErkJggg==)',
						display: 'inline-block'
					});
					
					_startTimer();
					break;
				default:
					css.style(_icon, {
						display: ''
					});
					
					_stopTimer();
					break;
			}
			
			_label.innerText = message;
		};
		
		function _startTimer() {
			if (!_timer) {
				_timer = new utils.timer(125);
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
			var angle = _timer.currentCount() * 45 % 360;
			
			css.style(_icon, {
				filter: 'progid:DXImageTransform.Microsoft.BasicImage(rotation=' + angle * Math.PI / 180 + ')',
				'transform': 'rotate(' + angle + 'deg)',
				'-ms-transform': 'rotate(' + angle + 'deg)',
				'-moz-transform': 'rotate(' + angle + 'deg)',
				'-webkit-transform': 'rotate(' + angle + 'deg)',
				'-o-transform': 'rotate(' + angle + 'deg)',
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
