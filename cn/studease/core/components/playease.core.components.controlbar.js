(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		components = core.components,
		
		types = {
			DEVIDER: 0,
			LABEL:   1,
			BUTTON:  2,
			SLIDER:  3
		};
	
	components.controlbar = function(layer, config) {
		var _this = utils.extend(this, new events.eventdispatcher('components.controlbar')),
			_defaults = {
				wrapper: '',
				bulletscreen: {}
			},
			_layout,
			_leftgroup,
			_centergroup,
			_rightgroup,
			_timeBar,
			_volumeBar,
			_labels,
			_buttons;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_layout = {
				left: [
					_layoutElement('play', types.BUTTON),
					_layoutElement('pause', types.BUTTON),
					_layoutElement('reload', types.BUTTON),
					_layoutElement('stop', types.BUTTON),
					_layoutElement('alt', types.LABEL),
					_layoutElement('elapsed', types.LABEL),
					_layoutElement('devider', types.DEVIDER),
					_layoutElement('duration', types.LABEL)
				],
				center: [
					
				],
				right: [
					_layoutElement('report', types.BUTTON),
					_layoutElement('volume', types.BUTTON),
					_layoutElement('volume', types.SLIDER),
					_layoutElement('hd', types.BUTTON),
					_layoutElement('bullet', types.BUTTON, _this.config.bulletscreen.enable ? '' : 'off'),
					_layoutElement('fullpage', types.BUTTON),
					_layoutElement('fpexit', types.BUTTON),
					_layoutElement('fullscreen', types.BUTTON),
					_layoutElement('fsexit', types.BUTTON)
				]
			};
			
			_timeBar = new components.slider({ wrapper: _this.config.wrapper, name: 'time' });
			_timeBar.addEventListener(events.PLAYEASE_SLIDER_CHANGE, _onTimeBarChange);
			layer.appendChild(_timeBar.element());
			
			_labels = {};
			_buttons = {};
			
			_buildLayout();
		}
		
		function _layoutElement(name, type, className) {
			return {
				name: name,
				type: type,
				className: className
			};
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
					element = _buildButton(elt.name, pos, elt.className);
					break;
				case types.SLIDER:
					if (elt.name === 'volume') {
						_volumeBar = new components.slider({ wrapper: _this.config.wrapper, name: elt.name });
						_volumeBar.addEventListener(events.PLAYEASE_SLIDER_CHANGE, _onVolumeBarChange);
						element = _volumeBar.element();
					}
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
			
			_labels[name] = element;
			
			return element;
		}
		
		function _buildButton(name, pos, className) {
			// Don't show volume or mute controls on mobile, since it's not possible to modify audio levels in JS
			if (utils.isMobile() && (name === 'volume' || name.indexOf('volume') === 0)) {
				return null;
			}
			// Having issues with stock (non-chrome) Android browser and showing overlays.
			// Just remove HD/CC buttons in that case
			if (utils.isAndroid(4, true) && /hd|cc/.test(name)) {
				return null;
			}
			
			var element = utils.createElement('span', 'plbutton pl' + name + (className ? ' ' + className : ''));
			element.name = name;
			try {
				element.addEventListener('click', _onButtonClick);
			} catch(err) {
				element.attachEvent('onclick', _onButtonClick);
			}
			
			_buttons[name] = element;
			
			return element;
		}
		
		function _onButtonClick(e) {
			var name = e.target.name;
			
			switch (name) {
				case 'play':
					_this.dispatchEvent(events.PLAYEASE_VIEW_PLAY);
					break;
				case 'pause':
					_this.dispatchEvent(events.PLAYEASE_VIEW_PAUSE);
					break;
				case 'reload':
					_this.dispatchEvent(events.PLAYEASE_VIEW_RELOAD);
					break;
				case 'stop':
					_this.dispatchEvent(events.PLAYEASE_VIEW_STOP);
					break;
				case 'report':
					_this.dispatchEvent(events.PLAYEASE_VIEW_REPORT);
					break;
				case 'volume':
					_this.dispatchEvent(events.PLAYEASE_VIEW_MUTE);
					break;
				case 'hd':
					_this.dispatchEvent(events.PLAYEASE_VIEW_HD);
					break;
				case 'bullet':
					_this.dispatchEvent(events.PLAYEASE_VIEW_BULLET);
					break;
				case 'fullpage':
				case 'fpexit':
					_this.dispatchEvent(events.PLAYEASE_VIEW_FULLPAGE);
					break;
				case 'fullscreen':
				case 'fsexit':
					_this.dispatchEvent(events.PLAYEASE_VIEW_FULLSCREEN);
					break;
				default:
					break;
			}
		}
		
		function _onTimeBarChange(e) {
			_this.dispatchEvent(events.PLAYEASE_VIEW_SEEK, { offset: e.value });
		}
		
		function _onVolumeBarChange(e) {
			_this.dispatchEvent(events.PLAYEASE_VIEW_VOLUME, { volume: e.value });
		}
		
		_this.setDuration = function(duration) {
			var h = Math.floor(duration / 3600);
			var m = Math.floor((duration % 3600) / 60);
			var s = Math.floor(duration % 60);
			var text = (h ? utils.pad(h, 2) + ':' : '') + utils.pad(m, 2) + ':' + utils.pad(s, 2);
			_labels.duration.innerHTML = text;
		};
		
		_this.setElapsed = function(elapsed) {
			var h = Math.floor(elapsed / 3600);
			var m = Math.floor((elapsed % 3600) / 60);
			var s = Math.floor(elapsed % 60);
			var text = (h ? utils.pad(h, 2) + ':' : '') + utils.pad(m, 2) + ':' + utils.pad(s, 2);
			_labels.elapsed.innerHTML = text;
		};
		
		_this.setProgress = function(elapsed, duration) {
			if (!duration) {
				return;
			}
			
			var percentage = Math.floor(elapsed / duration * 10000) / 100;
			_timeBar.update(percentage);
		};
		
		_this.setBuffered = function(buffered, total) {
			if (!total) {
				return;
			}
			
			var percentage = Math.floor(buffered / total * 10000) / 100;
			_timeBar.buffered(percentage);
		};
		
		_this.setMuted = function(muted, vol) {
			if (muted) {
				utils.addClass(_buttons.volume, 'mute');
				_volumeBar.update(0);
			} else {
				utils.removeClass(_buttons.volume, 'mute');
				_volumeBar.update(vol);
			}
		};
		
		_this.setVolume = function(vol) {
			if (vol) {
				utils.removeClass(_buttons.volume, 'mute');
			} else {
				utils.addClass(_buttons.volume, 'mute');
			}
			_volumeBar.update(vol);
		};
		
		_this.setBullet = function(on) {
			if (on) {
				utils.removeClass(_buttons.bullet, 'off');
			} else {
				utils.addClass(_buttons.bullet, 'off');
			}
		};
		
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
