(function(playease) {
	var utils = playease.utils,
		css = utils.css,
		events = playease.events,
		core = playease.core,
		components = core.components,
		
		types = {
			DEVIDER: 0,
			LABEL:   1,
			BUTTON:  2,
			SLIDER:  3
		},
		
		DEVIDER_CLASS = 'pe-devider',
		LABEL_CLASS = 'pe-label',
		BUTTON_CLASS = 'pe-button',
		
		OVERLAY_CLASS = 'pe-overlay',
		TOOLTIP_ITEM_CLASS = 'pe-tooltip-item';
	
	components.controlbar = function(layer, config) {
		var _this = utils.extend(this, new events.eventdispatcher('components.controlbar')),
			_defaults = {},
			_layout,
			_labels,
			_buttons,
			_overlays,
			_timeBar,
			_volumeBar;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_labels = {};
			_buttons = {};
			_overlays = {};
			
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
					_layoutElement('videooff', types.BUTTON),
					_layoutElement('hd', types.BUTTON),
					_layoutElement('bullet', types.BUTTON, _this.config.bulletscreen.enable ? '' : 'off'),
					_layoutElement('fullpage', types.BUTTON),
					_layoutElement('fpexit', types.BUTTON),
					_layoutElement('fullscreen', types.BUTTON),
					_layoutElement('fsexit', types.BUTTON)
				]
			};
			
			_timeBar = new components.slider({ name: 'time' });
			_timeBar.addEventListener(events.PLAYEASE_SLIDER_CHANGE, _onTimeBarChange);
			layer.appendChild(_timeBar.element());
			
			_buildLayout();
			
			try {
				document.addEventListener('fullscreenchange', _onFullscreenChange);
				document.addEventListener('webkitfullscreenchange', _onFullscreenChange);
				document.addEventListener('mozfullscreenchange', _onFullscreenChange);
				document.addEventListener('MSFullscreenChange', _onFullscreenChange);
			} catch (err) {
				/* void */
			}
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
			var group = utils.createElement('div', 'pe-' + pos);
			
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
					if (elt.name === 'volume' && !utils.isMobile()) {
						_volumeBar = new components.slider({ name: elt.name });
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
			var element = utils.createElement('span', DEVIDER_CLASS);
			element.innerHTML = '/';
			
			return element;
		}
		
		function _buildLabel(name) {
			var text = '';
			
			switch (name) {
				case 'alt':
					text = 'Live broadcast';
					break;
				case 'elapsed':
				case 'duration':
					text = '00:00';
					break;
				case 'devider':
					text = '/';
					break;
				default:
					break;
			}
			
			var element = utils.createElement('span', LABEL_CLASS + ' ' + name);
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
			
			if (name === 'report' && !_this.config.report) {
				return null;
			}
			if (name === 'hd' && (utils.typeOf(_this.config.playlist.sources) !== 'array' || _this.config.playlist.sources.length < 2)) {
				return null;
			}
			if (name === 'bullet' && !_this.config.bulletscreen.visible) {
				return null;
			}
			if ((name === 'fullpage' || name === 'fpexit') && !_this.config.fullpage.visible) {
				return null;
			}
			
			var element = utils.createElement('span', BUTTON_CLASS + ' ' + name + (className ? ' ' + className : ''));
			element.name = name;
			try {
				element.addEventListener('click', _onButtonClick);
			} catch (err) {
				element.attachEvent('onclick', function(e) {
					_onButtonClick.call(element, arguments);
				});
			}
			
			if (name === 'hd') {
				var tooltip = new components.tooltip({ name: name });
				
				var sources = _this.config.playlist.sources;
				for (var i = 0; i < sources.length; i++) {
					var item = utils.createElement('div', TOOLTIP_ITEM_CLASS);
					item.index = i;
					item.innerText = sources[i].label || i;
					
					try {
						item.addEventListener('click', _onHDItemClick);
					} catch (err) {
						item.attachEvent('onclick', function(e) {
							_onHDItemClick.call(item, arguments);
						});
					}
					
					tooltip.appendChild(item);
				}
				
				_overlays[name] = tooltip;
				
				element.innerHTML = '<span>HD</span>';
				element.appendChild(tooltip.element());
			}
			
			_buttons[name] = element;
			
			return element;
		}
		
		function _onButtonClick(e) {
			var target = e.target || this;
			
			switch (target.name) {
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
					_this.dispatchEvent(events.PLAYEASE_VIEW_MUTE, { mute: !utils.hasClass(target, 'mute') });
					break;
				case 'videooff':
					_this.dispatchEvent(events.PLAYEASE_VIEW_VIDEOOFF, { off: utils.hasClass(target, 'on') });
					break;
				case 'hd':
					/* void */
					break;
				case 'bullet':
					_this.dispatchEvent(events.PLAYEASE_VIEW_BULLET, { enable: utils.hasClass(target, 'off') });
					break;
				case 'fullpage':
					_this.dispatchEvent(events.PLAYEASE_VIEW_FULLPAGE, { exit: false });
					break;
				case 'fpexit':
					_this.dispatchEvent(events.PLAYEASE_VIEW_FULLPAGE, { exit: true });
					break;
				case 'fullscreen':
					_this.dispatchEvent(events.PLAYEASE_VIEW_FULLSCREEN, { exit: false });
					break;
				case 'fsexit':
					_this.dispatchEvent(events.PLAYEASE_VIEW_FULLSCREEN, { exit: true });
					break;
				default:
					break;
			}
		}
		
		function _onHDItemClick(e) {
			var item = e.target || this;
			_this.dispatchEvent(events.PLAYEASE_VIEW_HD, { index: item.index });
		}
		
		function _onFullscreenChange(e) {
			if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.mozFullScreenElement && !document.msFullscreenElement) {
				_this.dispatchEvent(events.PLAYEASE_VIEW_FULLSCREEN, { exit: true });
			}
		}
		
		function _onTimeBarChange(e) {
			_this.dispatchEvent(events.PLAYEASE_VIEW_SEEK, { offset: e.value });
		}
		
		function _onVolumeBarChange(e) {
			_this.dispatchEvent(events.PLAYEASE_VIEW_VOLUME, { volume: e.value });
		}
		
		
		_this.setBuffered = function(buffered) {
			_timeBar.buffered(buffered);
		};
		
		_this.setPosition = function(position) {
			_timeBar.update(position);
		};
		
		_this.setElapsed = function(elapsed) {
			var h = Math.floor(elapsed / 3600);
			var m = Math.floor((elapsed % 3600) / 60);
			var s = Math.floor(elapsed % 60);
			var text = (h ? utils.pad(h, 2) + ':' : '') + utils.pad(m, 2) + ':' + utils.pad(s, 2);
			_labels.elapsed.innerHTML = text;
		};
		
		_this.setDuration = function(duration) {
			if (isNaN(duration) || duration === Infinity) {
				duration = 0;
			}
			
			var h = Math.floor(duration / 3600);
			var m = Math.floor((duration % 3600) / 60);
			var s = Math.floor(duration % 60);
			var text = (h ? utils.pad(h, 2) + ':' : '') + utils.pad(m, 2) + ':' + utils.pad(s, 2);
			_labels.duration.innerHTML = text;
		};
		
		_this.setMuted = function(muted, vol) {
			if (utils.isMobile()) {
				return;
			}
			
			if (muted) {
				utils.addClass(_buttons.volume, 'mute');
				_volumeBar.update(0);
			} else {
				utils.removeClass(_buttons.volume, 'mute');
				_volumeBar.update(vol);
			}
		};
		
		_this.setVolume = function(vol) {
			if (utils.isMobile()) {
				return;
			}
			
			if (vol) {
				utils.removeClass(_buttons.volume, 'mute');
			} else {
				utils.addClass(_buttons.volume, 'mute');
			}
			
			_volumeBar.update(vol);
		};
		
		_this.setVideoOff = function(off, enable) {
			if (enable) {
				utils.addClass(_buttons.videooff, 'enable');
			} else {
				utils.removeClass(_buttons.videooff, 'enable');
			}
			
			if (off) {
				utils.removeClass(_buttons.videooff, 'on');
			} else {
				utils.addClass(_buttons.videooff, 'on');
			}
		};
		
		_this.activeHDItem = function(index, label) {
			if (_overlays.hd) {
				_overlays.hd.activeItemAt(index);
				
				if (_buttons.hd) {
					_buttons.hd.childNodes[0].innerText = label || 'HD';
				}
			}
		};
		
		_this.setBullet = function(on) {
			if (on) {
				utils.removeClass(_buttons.bullet, 'off');
			} else {
				utils.addClass(_buttons.bullet, 'off');
			}
		};
		
		_this.resize = function(width, height) {
			utils.foreach(_overlays, function(name, tooltip) {
				tooltip.resize(width, height);
			});
		};
		
		_this.destroy = function() {
			
		};
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_init();
	};
})(playease);
