(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		states = core.states,
		renders = core.renders,
		rendermodes = renders.modes,
		components = core.components,
		skins = core.skins,
		skinmodes = skins.modes,
		css = utils.css,
		
		WRAP_CLASS = 'pla-wrapper',
		SKIN_CLASS = 'pla-skin',
		RENDER_CLASS = 'pla-render',
		CONTROLS_CLASS = 'pla-controls',
		CONTEXTMENU_CLASS = 'pla-contextmenu';
	
	core.view = function(entity, model) {
		var _this = utils.extend(this, new events.eventdispatcher('core.view')),
			_wrapper,
			_renderLayer,
			_controlsLayer,
			_contextmenuLayer,
			_render,
			_controlbar,
			_bulletscreen,
			_skin,
			_canvas,
			_video,
			_timer,
			_autohidetimer,
			_errorOccurred = false;
		
		function _init() {
			SKIN_CLASS += '-' + model.config.skin.name;
			_wrapper = utils.createElement('div', WRAP_CLASS + ' ' + SKIN_CLASS + (model.config.type === 'vod' ? ' vod' : ''));
			_wrapper.id = entity.id;
			_wrapper.tabIndex = 0;
			
			_renderLayer = utils.createElement('div', RENDER_CLASS);
			_controlsLayer = utils.createElement('div', CONTROLS_CLASS);
			_contextmenuLayer = utils.createElement('div', CONTEXTMENU_CLASS);
			
			_wrapper.appendChild(_renderLayer);
			_wrapper.appendChild(_controlsLayer);
			_wrapper.appendChild(_contextmenuLayer);
			
			_initComponents();
			_initRender();
			_initSkin();
			
			var replace = document.getElementById(entity.id);
			replace.parentNode.replaceChild(_wrapper, replace);
			
			try {
				window.addEventListener('resize', _onResize);
			} catch (err) {
				window.attachEvent('onresize', _onResize);
			}
		}
		
		function _initComponents() {
			var cbcfg = utils.extend({}, {
				wrapper: entity.id,
				bulletscreen: model.getConfig('bulletscreen')
			});
			
			try {
				_controlbar = new components.controlbar(_controlsLayer, cbcfg);
				_controlbar.addGlobalListener(_forward);
				
				_controlbar.setVolume(model.getProperty('volume'));
			} catch (err) {
				utils.log('Failed to init controlbar!');
			}
			
			var bscfg = utils.extend({}, model.getConfig('bulletscreen'), {
				width: model.config.width,
				height: model.config.height - 40
			});
			
			try {
				_bulletscreen = new components.bulletscreen(bscfg);
				_bulletscreen.addGlobalListener(_forward);
				
				_canvas = _bulletscreen.element();
				_renderLayer.appendChild(_canvas);
			} catch (err) {
				utils.log('Failed to init bullet!');
			}
		}
		
		function _initRender() {
			var cfg = utils.extend({}, model.getConfig('render'), {
				id: entity.id,
				url: model.config.url,
				width: model.config.width,
				height: model.config.height - 40,
				controls: model.config.controls,
				autoplay: model.config.autoplay,
				playsinline: model.config.playsinline,
				poster: model.config.poster,
				loader: {
					mode: model.config.cors
				}
			});
			
			try {
				_render = _this.render = new renders[cfg.name](_this, cfg);
				_render.addEventListener(events.PLAYEASE_READY, _forward);
				_render.addEventListener(events.PLAYEASE_DURATION, _forward);
				_render.addEventListener(events.PLAYEASE_VIEW_STOP, _forward);
				_render.addEventListener(events.PLAYEASE_RENDER_ERROR, _onRenderError);
				
				_video = _render.element();
				_renderLayer.appendChild(_video);
			} catch (err) {
				utils.log('Failed to init render ' + cfg.name + '!');
			}
		}
		
		function _initSkin() {
			var cfg = utils.extend({}, model.getConfig('skin'), {
				id: entity.id,
				width: model.config.width,
				height: model.config.height
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
				_this.dispatchEvent(events.PLAYEASE_SETUP_ERROR, { message: 'Render not available!', name: model.config.render.name });
				return;
			}
			
			_render.setup();
			_this.resize();
			
			try {
				_wrapper.addEventListener('keydown', _onKeyDown);
			} catch (err) {
				_wrapper.attachEvent('onkeydown', _onKeyDown);
			}
		};
		
		_this.play = function(url) {
			utils.addClass(_wrapper, 'playing');
			_startTimer();
			_render.play(url);
		};
		
		_this.pause = function() {
			utils.removeClass(_wrapper, 'playing');
			_render.pause();
		};
		
		_this.reload = function() {
			utils.addClass(_wrapper, 'playing');
			_startTimer();
			_render.reload();
		};
		
		_this.seek = function(offset) {
			utils.addClass(_wrapper, 'playing');
			_controlbar.setProgress(offset, 100);
			_startTimer();
			_render.seek(offset);
		};
		
		_this.stop = function() {
			utils.removeClass(_wrapper, 'playing');
			_stopTimer();
			_controlbar.setDuration(0);
			_controlbar.setElapsed(0);
			_controlbar.setProgress(0, 1);
			_controlbar.setBuffered(0, 1);
			_render.stop();
		};
		
		_this.report = function() {
			
		};
		
		_this.mute = function(muted) {
			_controlbar.setMuted(muted, model.getProperty('volume'));
			_render.mute(muted);
		};
		
		_this.volume = function(vol) {
			_controlbar.setVolume(vol);
			_render.volume(vol);
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
				utils.removeClass(_wrapper, 'fs');
			}
			
			if (exit) {
				utils.removeClass(_wrapper, 'fp');
			} else {
				utils.addClass(_wrapper, 'fp');
			}
			
			_this.resize();
			
			if (_autohidetimer) {
				_autohidetimer.stop();
			}
			_wrapper.removeEventListener('mousemove', _onMouseMove);
			_controlsLayer.style.display = 'block';
		};
		
		_this.fullscreen = function(exit) {
			if (exit) {
				document.exitFullscreen = document.exitFullscreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || document.msExitFullscreen;
				if (!document.exitFullscreen) {
					_this.fullpage(exit);
					return;
				}
				
				document.exitFullscreen();
				utils.removeClass(_wrapper, 'fs');
				
				if (_autohidetimer) {
					_autohidetimer.stop();
				}
				_wrapper.removeEventListener('mousemove', _onMouseMove);
			} else {
				_wrapper.requestFullscreen = _wrapper.requestFullscreen || _wrapper.webkitRequestFullScreen || _wrapper.mozRequestFullScreen || _wrapper.msRequestFullscreen;
				if (!_wrapper.requestFullscreen) {
					_this.fullpage(exit);
					return;
				}
				
				_wrapper.requestFullscreen();
				utils.addClass(_wrapper, 'fs');
				
				if (_autohidetimer) {
					_autohidetimer.start();
				}
				_wrapper.addEventListener('mousemove', _onMouseMove);
			}
			
			_this.resize();
			
			_controlsLayer.style.display = 'block';
		};
		
		_this.setDuration = function(duration) {
			if (duration) {
				utils.addClass(_wrapper, 'vod');
			} else {
				utils.removeClass(_wrapper, 'vod');
			}
			
			_controlbar.setDuration(duration);
		};
		
		_this.shoot = function(text) {
			if (_bulletscreen) {
				_bulletscreen.shoot(text);
			}
		};
		
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
			var elapsed = _video.currentTime;
			_controlbar.setElapsed(elapsed);
			_controlbar.setProgress(elapsed, _video.duration);
			
			var ranges = _video.buffered;
			for (var i = 0; i < ranges.length; i++) {
				var start = ranges.start(i);
				var end = ranges.end(i);
				if (start <= elapsed && elapsed < end) {
					_controlbar.setBuffered(end, _video.duration);
				}
			}
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
		
		_this.display = function(icon, message) {
			
		};
		
		function _onResize(e) {
			_this.resize();
		}
		
		_this.resize = function(width, height) {
			setTimeout(function() {
				_bulletscreen.resize(_video.clientWidth, _video.clientHeight);
				if (_render) {
					_render.resize(_video.clientWidth, _video.clientHeight);
				}
			}, 0);
		};
		
		_this.destroy = function() {
			if (_wrapper) {
				try {
					_wrapper.removeEventListener('keydown', _onKeyDown);
				} catch (e) {
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
