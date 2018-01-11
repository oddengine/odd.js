(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		states = core.states,
		renders = core.renders,
		rendertypes = renders.types,
		priority = renders.priority,
		components = core.components,
		skins = core.skins,
		
		WRAP_CLASS = 'pe-wrapper',
		SKIN_CLASS = 'pe-skin',
		RENDER_CLASS = 'pe-render',
		CONTROLS_CLASS = 'pe-controls',
		CONTEXTMENU_CLASS = 'pe-contextmenu';
	
	core.view = function(model) {
		var _this = utils.extend(this, new events.eventdispatcher('core.view')),
			_wrapper,
			_renderLayer,
			_controlsLayer,
			_contextmenuLayer,
			_controlbar,
			_poster,
			_bulletscreen,
			_display,
			_logo,
			_contextmenu,
			_renders,
			_render,
			_skin,
			_canvas,
			_video,
			_timer,
			_autohidetimer,
			_checkFlashTimer,
			_previousClick = 0,
			_errorOccurred = false;
		
		function _init() {
			_wrapper = utils.createElement('div', WRAP_CLASS + ' ' + SKIN_CLASS + '-' + model.getConfig('skin').name + (model.getConfig('mode') === 'vod' ? ' vod' : ''));
			_wrapper.id = model.getConfig('id');
			//_wrapper.tabIndex = 0;
			
			_renderLayer = utils.createElement('div', RENDER_CLASS);
			_controlsLayer = utils.createElement('div', CONTROLS_CLASS);
			_contextmenuLayer = utils.createElement('div', CONTEXTMENU_CLASS);
			
			_wrapper.appendChild(_renderLayer);
			_wrapper.appendChild(_controlsLayer);
			_wrapper.appendChild(_contextmenuLayer);
			
			utils.addClass(_wrapper, states.IDLE);
			model.addEventListener(events.PLAYEASE_STATE, _modelStateHandler);
			
			_initComponents();
			_initRenders();
			_initSkin();
			
			_wrapper.oncontextmenu = function(e) {
				e = e || window.event;
				e.preventDefault ? e.preventDefault() : e.returnValue = false;
				return false;
			};
			
			try {
				window.addEventListener('resize', _onResize);
				_wrapper.addEventListener('keydown', _onKeyDown);
				_wrapper.addEventListener('mousedown', _onMouseDown);
				document.addEventListener('mousedown', _onMouseDown);
				_renderLayer.addEventListener('click', _onRenderClick);
			} catch (err) {
				window.attachEvent('onresize', _onResize);
				_wrapper.attachEvent('onkeydown', _onKeyDown);
				_wrapper.attachEvent('onmousedown', _onMouseDown);
				document.attachEvent('onmousedown', _onMouseDown);
				_renderLayer.attachEvent('onclick', _onRenderClick);
			}
			
			var replace = document.getElementById(model.getConfig('id'));
			replace.parentNode.replaceChild(_wrapper, replace);
		}
		
		function _modelStateHandler(e) {
			utils.removeClass(_wrapper, [states.IDLE, states.BUFFERING, states.PLAYING, states.PAUSED, states.STOPPED, states.ERROR]);
			utils.addClass(_wrapper, e.state);
		}
		
		function _initComponents() {
			// controlbar
			var cbcfg = {
				report: model.getConfig('report'),
				playlist: model.getProperty('playlist'),
				bulletscreen: model.getConfig('bulletscreen'),
				fullpage: model.getConfig('fullpage')
			};
			
			try {
				_controlbar = new components.controlbar(_controlsLayer, cbcfg);
				_controlbar.addGlobalListener(_forward);
				
				_controlbar.setVolume(model.getProperty('volume'));
			} catch (err) {
				utils.log('Failed to init "controlbar" component!');
			}
			
			// poster
			var ptcfg = {
				url: model.getConfig('poster'),
				width: model.getConfig('width'),
				height: model.getConfig('height') - 40
			};
			
			try {
				_poster = new components.poster(ptcfg);
				_poster.addGlobalListener(_forward);
				
				_renderLayer.appendChild(_poster.element());
			} catch (err) {
				utils.log('Failed to init "poster" component!');
			}
			
			// bulletscreen
			var bscfg = utils.extend({}, model.getConfig('bulletscreen'), {
				width: model.getConfig('width'),
				height: model.getConfig('height') - 40
			});
			
			try {
				_bulletscreen = new components.bulletscreen(bscfg);
				_bulletscreen.addGlobalListener(_forward);
				
				_canvas = _bulletscreen.element();
				_renderLayer.appendChild(_canvas);
			} catch (err) {
				utils.log('Failed to init "bulletscreen" component!');
			}
			
			// display
			var dicfg = utils.extend({}, model.getConfig('display'), {
				id: model.getConfig('id') + '-display'
			});
			
			try {
				_display = new components.display(dicfg);
				_display.addEventListener(events.PLAYEASE_VIEW_CLICK, _onDisplayClick);
				
				_renderLayer.appendChild(_display.element());
			} catch (err) {
				utils.log('Failed to init "display" component!');
			}
			
			// logo
			var lgcfg = utils.extend({}, model.getConfig('logo'), {
				width: model.getConfig('width'),
				height: model.getConfig('height') - 40
			});
			
			try {
				_logo = new components.logo(lgcfg);
				
				_renderLayer.appendChild(_logo.element());
			} catch (err) {
				utils.log('Failed to init "logo" component!');
			}
			
			// contextmenu
			var ctxcfg = utils.extend({}, model.getConfig('contextmenu'));
			
			try {
				_contextmenu = new components.contextmenu(_contextmenuLayer, ctxcfg);
				_contextmenu.addGlobalListener(_forward);
			} catch (err) {
				utils.log('Failed to init "contextmenu" component!');
			}
		}
		
		function _initRenders() {
			var cfg = utils.extend({}, model.getConfig('render'), {
				id: model.getConfig('id'),
				width: model.getConfig('width'),
				height: model.getConfig('height') - 40,
				aspectratio: model.getConfig('aspectratio'),
				playlist: model.getProperty('playlist'),
				mode: model.getConfig('mode'),
				bufferTime: model.getConfig('bufferTime'),
				muted: model.getProperty('muted'),
				volume: model.getProperty('volume'),
				autoplay: model.getConfig('autoplay'),
				airplay: model.getConfig('airplay'),
				playsinline: model.getConfig('playsinline'),
				poster: model.getConfig('poster'),
				loader: model.getConfig('loader')
			});
			
			_renders = {};
			
			for (var i = 0; i < priority.length; i++) {
				var name = priority[i];
				try {
					var render = new renders[name](_renderLayer, cfg);
					_renders[name] = render;
					
					utils.log('Render "' + name + '" initialized.');
				} catch (err) {
					utils.log('Failed to init render "' + name + '"!');
				}
			}
			
			var playlist = model.getProperty('playlist');
			for (var j = 0; j < playlist.sources.length; j++) {
				var source = playlist.sources[j];
				if (_renders.hasOwnProperty(source.type)) {
					_this.activeRender(source.type, source.file);
					break;
				}
			}
		}
		
		_this.activeRender = function(name, url) {
			if (_render && _render.name == name || _renders.hasOwnProperty(name) == false) {
				return;
			}
			
			if (_render) {
				_render.stop();
				_stopTimer();
				
				_render.removeEventListener(events.PLAYEASE_READY, _forward);
				_render.removeEventListener(events.PLAYEASE_STATE, _forward);
				_render.removeEventListener(events.PLAYEASE_DURATION, _forward);
				_render.removeEventListener(events.PLAYEASE_RENDER_ERROR, _onRenderError);
				
				_renderLayer.removeChild(_render.element());
			}
			
			_render = _this.render = _renders[name];
			_render.addEventListener(events.PLAYEASE_READY, _forward);
			_render.addEventListener(events.PLAYEASE_STATE, _forward);
			_render.addEventListener(events.PLAYEASE_DURATION, _forward);
			_render.addEventListener(events.PLAYEASE_RENDER_ERROR, _onRenderError);
			
			_video = _render.element();
			_renderLayer.appendChild(_video);
			
			switch (name) {
				case rendertypes.DEFAULT:
					_render.attach(url);
					break;
					
				case rendertypes.FLASH:
					if (utils.getFlashVersion() == 0) {
						model.setState(states.ERROR);
						_this.display(states.ERROR, 'Flash player is needed. Click <a href="http://get.adobe.com/cn/flashplayer/about/" target="_blank">here</a> to install.');
					}
					break;
					
				default:
					break;
			}
			
			_this.videoOff(model.getProperty('videooff'));
			_this.setup();
			
			utils.log('Actived render "' + _render.name + '".');
		};
		
		function _initSkin() {
			var cfg = utils.extend({}, model.getConfig('skin'), {
				id: model.getConfig('id'),
				width: model.getConfig('width'),
				height: model.getConfig('height')
			});
			
			try {
				_skin = new skins[cfg.name](cfg);
			} catch (err) {
				utils.log('Failed to init skin ' + cfg.name + '!');
			}
		}
		
		_this.setup = function() {
			// Ignore components & skin failure.
			if (!_render) {
				_this.dispatchEvent(events.PLAYEASE_SETUP_ERROR, { message: 'Render not available!', name: model.getConfig('render').name });
				return;
			}
			
			_render.setup();
			_this.resize();
		};
		
		_this.play = function(url) {
			if (_render) {
				try {
					_render.play(url);
				} catch (err) {
					utils.log('Failed to play: ' + err);
				}
			}
			
			_startTimer();
		};
		
		_this.pause = function() {
			if (_render) {
				_render.pause();
			}
		};
		
		_this.reload = function(url) {
			_this.stop();
			setTimeout(function() {
				_this.play(url);
			}, 100);
		};
		
		_this.seek = function(offset) {
			_controlbar.setPosition(offset);
			
			if (_render) {
				_render.seek(offset);
			}
			
			_startTimer();
		};
		
		_this.stop = function() {
			if (_render) {
				_render.stop();
			}
			
			_stopTimer();
			
			_controlbar.setBuffered(0);
			_controlbar.setPosition(0);
			_controlbar.setElapsed(0);
			_controlbar.setDuration(0);
		};
		
		_this.report = function() {
			
		};
		
		_this.mute = function(muted) {
			_controlbar.setMuted(muted, model.getProperty('volume'));
			
			if (_render) {
				_render.mute(muted);
				_this.dispatchEvent(events.PLAYEASE_MUTE, { muted: muted });
			}
		};
		
		_this.volume = function(vol) {
			_controlbar.setVolume(vol);
			
			if (_render) {
				_render.volume(vol);
				_this.dispatchEvent(events.PLAYEASE_VOLUME, { volume: vol });
			}
		};
		
		_this.videoOff = function(off) {
			var enable = _render && _render.name == rendertypes.DASH;
			_controlbar.setVideoOff(off, enable);
			
			if (enable) {
				var state = model.getState();
				var playing = state != states.IDLE && state != states.STOPPED && state != states.ERROR;
				_render.videoOff(off, playing);
			}
		};
		
		_this.hd = function(index, label) {
			_controlbar.activeHDItem(index, label);
		};
		
		_this.bullet = function(bullet) {
			_controlbar.setBullet(bullet);
			_bulletscreen.setProperty('enable', bullet);
		};
		
		_this.fullpage = function(exit) {
			if (document.fullscreen || document.webkitIsFullScreen || document.mozFullScreen || document.msFullscreenElement) {
				document.exitFullscreen = document.exitFullscreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || document.msExitFullscreen;
				if (!document.exitFullscreen) {
					return;
				}
				
				document.exitFullscreen();
			}
			
			utils.removeClass(_wrapper, 'fs');
			model.setProperty('fullscreen', false);
			
			if (exit) {
				utils.removeClass(_wrapper, 'fp');
			} else {
				utils.addClass(_wrapper, 'fp');
			}
			
			if (_autohidetimer) {
				_autohidetimer.stop();
			}
			_controlsLayer.style.display = 'block';
			
			try {
				_wrapper.removeEventListener('mousemove', _onMouseMove);
			} catch (err) {
				_wrapper.detachEvent('onmousemove', _onMouseMove);
			}
			
			model.setProperty('fullpage', !exit);
			_this.resize();
		};
		
		_this.fullscreen = function(exit) {
			if (exit) {
				document.exitFullscreen = document.exitFullscreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || document.msExitFullscreen;
				if (document.exitFullscreen) {
					document.exitFullscreen();
				} else {
					_this.dispatchEvent(events.PLAYEASE_VIEW_FULLPAGE, { exit: exit });
				}
				
				utils.removeClass(_wrapper, 'fs');
				
				if (_autohidetimer) {
					_autohidetimer.stop();
				}
				try {
					_wrapper.removeEventListener('mousemove', _onMouseMove);
				} catch (err) {
					_wrapper.detachEvent('onmousemove', _onMouseMove);
				}
			} else {
				_wrapper.requestFullscreen = _wrapper.requestFullscreen || _wrapper.webkitRequestFullScreen || _wrapper.mozRequestFullScreen || _wrapper.msRequestFullscreen;
				if (utils.isMobile() && _video.webkitEnterFullscreen) {
					_video.webkitEnterFullscreen();
					return;
				} else if (_wrapper.requestFullscreen) {
					_wrapper.requestFullscreen();
				} else {
					_this.dispatchEvent(events.PLAYEASE_VIEW_FULLPAGE, { exit: exit });
				}
				
				utils.addClass(_wrapper, 'fs');
				
				if (_autohidetimer) {
					_autohidetimer.start();
				}
				try {
					_wrapper.addEventListener('mousemove', _onMouseMove);
				} catch (err) {
					_wrapper.attachEvent('onmousemove', _onMouseMove);
				}
			}
			
			_controlsLayer.style.display = 'block';
			
			model.setProperty('fullscreen', !exit);
			_this.resize();
		};
		
		_this.setDuration = function(duration) {
			if (!duration || isNaN(duration) || duration == Infinity) {
				utils.removeClass(_wrapper, 'vod');
			} else {
				utils.addClass(_wrapper, 'vod');
			}
			
			_controlbar.setDuration(duration);
		};
		
		_this.shoot = function(text) {
			if (_bulletscreen) {
				_bulletscreen.shoot(text);
			}
		};
		
		
		function _onDisplayClick(e) {
			var state = model.getState();
			switch (state) {
				case states.IDLE:
				case states.PAUSED:
				case states.STOPPED:
					_this.dispatchEvent(events.PLAYEASE_VIEW_PLAY);
					break;
					
				default:
					break;
			}
		}
		
		function _startTimer() {
			if (!_timer) {
				_timer = new utils.timer(500);
				_timer.addEventListener(events.PLAYEASE_TIMER, _updateTime);
			}
			_timer.start();
		}
		
		function _stopTimer() {
			if (_timer) {
				_timer.stop();
			}
		}
		
		function _updateTime(e) {
			if (!_render || !_render.getRenderInfo) {
				return;
			}
			
			var data = _render.getRenderInfo();
			var position = Math.floor((data.duration ? data.position / data.duration : 0) * 10000) / 100;
			
			_controlbar.setBuffered(data.buffered);
			_controlbar.setPosition(position);
			_controlbar.setElapsed(data.position);
			_controlbar.setDuration(data.duration);
		}
		
		function _onMouseMove(e) {
			_controlsLayer.style.display = 'block';
			
			if (!_autohidetimer) {
				_autohidetimer = new utils.timer(3000, 1);
				_autohidetimer.addEventListener(events.PLAYEASE_TIMER, _autoHideControlBar);
			}
			_autohidetimer.start();
		}
		
		function _autoHideControlBar(e) {
			_controlsLayer.style.display = 'none';
		}
		
		function _onKeyDown(e) {
			if (e.ctrlKey || e.metaKey) {
				return true;
			}
			
			switch (e.keyCode) {
				case 13: // enter
					
					break;
				case 32: // space
					
					break;
				default:
					break;
			}
			
			if (/13|32/.test(e.keyCode)) {
				// Prevent keypresses from scrolling the screen
				e.preventDefault ? e.preventDefault() : e.returnValue = false;
				return false;
			}
		}
		
		function _onMouseDown(e) {
			if (!_contextmenu) {
				return;
			}
			
			if (e.currentTarget == undefined) {
				for (var node = e.srcElement; node; node = node.offsetParent) {
					if (node == _wrapper) {
						e.currentTarget = _wrapper;
						break;
					}
				}
			}
			
			if (e.button == (utils.isMSIE(8) ? 1 : 0) || e.currentTarget != _wrapper) {
				setTimeout(function() {
					_contextmenu.hide();
				}, 200);
			} else if (e.button == 2) {
				var offsetX = 0;
				var offsetY = 0;
				
				for (var node = e.srcElement || e.target; node && node != _wrapper; node = node.offsetParent) {
					offsetX += node.offsetLeft;
					offsetY += node.offsetTop;
				}
				
				_contextmenu.show(e.offsetX + offsetX, e.offsetY + offsetY);
				
				e.preventDefault ? e.preventDefault() : e.returnValue = false;
				e.stopPropagation ? e.stopPropagation() : e.cancelBubble = true;
				
				return false;
			}
		}
		
		function _onRenderClick(e) {
			var date = new Date();
			var time = date.getTime();
			if (time <= _previousClick + 700) {
				_previousClick = 0; // Avoid triple click
				
				var fs = model.getProperty('fullscreen');
				_this.dispatchEvent(events.PLAYEASE_VIEW_FULLSCREEN, { exit: fs });
				return;
			}
			
			_previousClick = time;
		}
		
		
		_this.onSWFState = function(e) {
			utils.log('onSWFState: ' + e.state);
			_this.dispatchEvent(events.PLAYEASE_STATE, { state: e.state });
		};
		
		_this.display = function(state, message) {
			if (_display) {
				_display.show(state, message);
			}
		};
		
		function _onResize(e) {
			_this.resize();
		}
		
		_this.resize = function(width, height) {
			setTimeout(function() {
				var fp = model.getProperty('fullpage');
				var fs = model.getProperty('fullscreen');
				
				if (width === undefined || height === undefined) {
					width = _renderLayer.clientWidth;
					height = model.getConfig('height');
				}
				if (fs || fp) {
					height = _wrapper.clientHeight;
				}
				if (!fs) {
					height -= 40;
				}
				
				var ratio = model.getConfig('aspectratio');
				if (ratio && !fp && !fs) {
					var arr = ratio.match(/(\d+)\:(\d+)/);
					if (arr && arr.length > 2) {
						var w = parseInt(arr[1]);
						var h = parseInt(arr[2]);
						height = width * h / w;
					}
				}
				
				if (_render) {
					_render.resize(width, height);
				}
				
				_this.dispatchEvent(events.RESIZE, { width: width, height: height + (fs ? 0 : 40) });
				
				_controlbar.resize(width, height);
				_poster.resize(width, height);
				_bulletscreen.resize(width, height);
				_display.resize(width, height);
				_logo.resize(width, height);
				_contextmenu.resize(width, height);
			});
		};
		
		_this.destroy = function() {
			if (_wrapper) {
				try {
					window.removeEventListener('resize', _onResize);
					_wrapper.removeEventListener('keydown', _onKeyDown);
				} catch (err) {
					window.detachEvent('onresize', _onResize);
					_wrapper.detachEvent('onkeydown', _onKeyDown);
				}
			}
			if (_render) {
				_render.destroy();
			}
		};
		
		function _onRenderError(e) {
			_stopTimer();
			_forward(e);
		}
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_init();
	};
})(playease);
