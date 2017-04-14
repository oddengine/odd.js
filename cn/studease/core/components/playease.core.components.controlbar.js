(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		components = core.components,
		
		modes = {
			LIVE: 0,
			VOD:  1
		},
		types = {
			DEVIDER: 0,
			LABEL:   1,
			BUTTON:  2,
			SLIDER:  3
		};
	
	components.controlbar = function(layer, config) {
		var _this = utils.extend(this, new events.eventdispatcher('components.controlbar')),
			_defaults = {
				mode: modes.LIVE,
				layout: [{
					left: [
						_layoutElement('play', types.BUTTON),
						_layoutElement('reload', types.BUTTON)
					],
					center: [
						_layoutElement('alt', types.LABEL)
					],
					right: [
						_layoutElement('report', types.BUTTON),
						_layoutElement('volume', types.BUTTON),
						_layoutElement('volume', types.SLIDER),
						_layoutElement('hd', types.BUTTON),
						_layoutElement('bullet', types.BUTTON),
						_layoutElement('fullpage', types.BUTTON),
						_layoutElement('fullscreen', types.BUTTON)
					]
				}, {
					left: [
						_layoutElement('play', types.BUTTON),
						_layoutElement('stop', types.BUTTON),
						_layoutElement('elapsed', types.LABEL),
						_layoutElement('devider', types.DEVIDER),
						_layoutElement('duration', types.LABEL)
					],
					center: [
						_layoutElement('time', types.SLIDER)
					],
					right: [
						_layoutElement('report', types.BUTTON),
						_layoutElement('volume', types.BUTTON),
						_layoutElement('volume', types.SLIDER),
						_layoutElement('hd', types.BUTTON),
						_layoutElement('bullet', types.BUTTON),
						_layoutElement('fullpage', types.BUTTON),
						_layoutElement('fullscreen', types.BUTTON)
					]
				}]
			},
			_layout,
			_leftgroup,
			_centergroup,
			_rightgroup,
			_sliders;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_layout = _this.config.layout[_this.config.mode];
			_sliders = { time: null, volume: null };
			
			_buildLayout();
		}
		
		function _buildLayout() {
			_buildGroup('left', _layout.left);
			_buildGroup('center', _layout.center);
			_buildGroup('right', _layout.right);
		}
		
		function _buildGroup(pos, elts) {
			var group = utils.createElement('div', 'pl' + pos);
			
			for (var i = 0; i < elts.length; i++) {
				var element = _buildElement(elts[i], pos);
				if (element) {
					group.appendChild(element);
				}
			}
			
			layer.appendChild(group);
		}
		
		function _buildElement(elt, pos) {
			var element;
			
			switch (elt.type) {
				case types.DEVIDER:
					element = _buildDevider(elt.name);
					break;
				case types.LABEL:
					element = _buildLabel(elt.name);
					break;
				case types.BUTTON:
					element = _buildButton(elt.name, pos);
					break;
				case types.SLIDER:
					var slider = _sliders[elt.name] = new components.slider({ name: elt.name });
					element = slider.element();
					break;
				default:
					break;
			}
			
			return element;
		}
		
		function _buildDevider(name) {
			var className = 'pldevider';
			var element = utils.createElement('span', className);
			element.innerHTML = '/';
			
			return element;
		}
		
		function _buildLabel(name) {
			var className = 'pllabel pl' + name;
			var text = '';
			
			switch (name) {
				case 'alt':
					text = 'Live broadcast';
					break;
				case 'elapsed':
				case 'duration':
					className += ' plhidden';
					text = '00:00';
					break;
				case 'devider':
					text = '/';
					break;
				default:
					break;
			}
			
			var element = utils.createElement('span', className);
			element.innerHTML = text;
			
			return element;
		}
		
		function _buildButton(name, pos) {
			// Don't show volume or mute controls on mobile, since it's not possible to modify audio levels in JS
			if (utils.isMobile() && (name === 'volume' || name.indexOf('volume') === 0)) {
				return null;
			}
			// Having issues with stock (non-chrome) Android browser and showing overlays.
			// Just remove HD/CC buttons in that case
			if (utils.isAndroid(4, true) && /hd|cc/.test(name)) {
				return null;
			}
			
			var element = utils.createElement('span', 'plbutton pl' + name);
			
			return element;
		}
		
		function _layoutElement(name, type, className) {
			return {
				name: name,
				type: type,
				className: className
			};
		}
		
		_this.resize = function(width, height) {
			
		};
		
		_this.destroy = function() {
			
		};
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_init();
	};
})(playease);
