(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		states = core.states;
	
	core.controller = function(model, view) {
		var _this = utils.extend(this, new events.eventdispatcher('core.controller')),
			_ready = false,
			_urgent,
			_timer,
			_retrycount = 0;
		
		function _init() {
			model.addEventListener(events.PLAYEASE_STATE, _modelStateHandler);
			
			view.addEventListener(events.PLAYEASE_READY, _onReady);
			view.addEventListener(events.PLAYEASE_SETUP_ERROR, _onSetupError);
			
			view.addEventListener(events.PLAYEASE_STATE, _renderStateHandler);
			
			view.addEventListener(events.PLAYEASE_VIEW_PLAY, _onPlay);
			view.addEventListener(events.PLAYEASE_VIEW_PAUSE, _onPause);
			view.addEventListener(events.PLAYEASE_VIEW_RELOAD, _onReload);
			view.addEventListener(events.PLAYEASE_VIEW_SEEK, _onSeek);
			view.addEventListener(events.PLAYEASE_VIEW_STOP, _onStop);
			view.addEventListener(events.PLAYEASE_VIEW_REPORT, _onReport);
			view.addEventListener(events.PLAYEASE_VIEW_MUTE, _onMute);
			view.addEventListener(events.PLAYEASE_VIEW_VOLUME, _onVolume);
			view.addEventListener(events.PLAYEASE_VIEW_HD, _onHD);
			view.addEventListener(events.PLAYEASE_VIEW_BULLET, _onBullet);
			view.addEventListener(events.PLAYEASE_VIEW_FULLPAGE, _onFullpage);
			view.addEventListener(events.PLAYEASE_VIEW_FULLSCREEN, _onFullscreen);
			
			view.addEventListener(events.PLAYEASE_DURATION, _onDuration);
			view.addEventListener(events.PLAYEASE_RENDER_ERROR, _onRenderError);
		}
		
		function _modelStateHandler(e) {
			view.display(e.state, '');
			
			switch (e.state) {
				case states.BUFFERING:
					_this.dispatchEvent(events.PLAYEASE_BUFFERING);
					break;
				case states.PLAYING:
					_this.dispatchEvent(events.PLAYEASE_PLAYING);
					break;
				case states.PAUSED:
					_this.dispatchEvent(events.PLAYEASE_PAUSED);
					break;
				case states.STOPPED:
					_this.dispatchEvent(events.PLAYEASE_STOPPED);
					break;
				case states.ERROR:
					_retry();
					break;
				default:
					_this.dispatchEvent(events.ERROR, { message: 'Unknown model state!', state: e.state });
					break;
			}
		}
		
		function _onReady(e) {
			if (!_ready) {
				utils.log('Player ready!');
				
				_ready = true;
				_forward(e);
				
				if (model.getConfig('autoplay') || _urgent) {
					_this.play(_urgent);
				}
				
				window.onbeforeunload = function(ev) {
					
				};
			}
		}
		
		_this.setup = function(e) {
			if (!_ready) {
				view.setup();
			}
		};
		
		_this.play = function(url) {
			playease.api.displayError('', model.config);
			
			if (!_ready) {
				_this.dispatchEvent(events.ERROR, { message: 'Player is not ready yet!' });
				return;
			}
			
			var playlist = model.getProperty('playlist');
			
			var type = view.render.name;
			if (url == undefined) {
				var item = playlist.getItemAt(playlist.index);
				if (!item) {
					_this.dispatchEvent(events.ERROR, { message: 'Failed to get playlist item at ' + playlist.index + '!' });
					return;
				}
				
				url = item.file;
				type = item.type;
			} else {
				_urgent = url;
			}
			
			var render = core.renders[type];
			if (render == undefined || render.isSupported(url) == false) {
				type = playlist.getSupported(url);
				if (!type) {
					_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'No supported render found!' });
					return;
				}
			}
			
			if (view.render.name != type) {
				_ready = false;
				view.activeRender(type);
				return;
			}
			
			view.play(url);
		};
		
		_this.pause = function() {
			view.pause();
		};
		
		_this.reload = function() {
			playease.api.displayError('', model.config);
			
			if (!_ready) {
				_this.dispatchEvent(events.ERROR, { message: 'Player is not ready yet!' });
				return;
			}
			
			var playlist = model.getProperty('playlist');
			
			var url = _urgent;
			var type = view.render.name;
			
			if (url == undefined) {
				var item = playlist.getItemAt(playlist.index);
				if (!item) {
					_this.dispatchEvent(events.ERROR, { message: 'Failed to get playlist item at ' + playlist.index + '!' });
					return;
				}
				
				url = item.file;
				type = item.type;
			}
			
			var render = core.renders[type];
			if (render == undefined || render.isSupported(url) == false) {
				type = playlist.getSupported(url);
				if (!type) {
					_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'No supported render found!' });
					return;
				}
			}
			
			if (view.render.name != type) {
				_ready = false;
				view.activeRender(type);
				return;
			}
			
			view.reload(url);
		};
		
		_this.seek = function(offset) {
			if (!_ready) {
				_this.dispatchEvent(events.ERROR, { message: 'Player is not ready yet!' });
				return;
			}
			
			view.seek(offset);
		};
		
		_this.stop = function() {
			var playlist = model.getProperty('playlist');
			playlist.activeNextItem();
			
			_urgent = undefined;
			
			view.stop();
		};
		
		_this.report = function() {
			view.report();
		};
		
		_this.mute = function() {
			var muted = model.getProperty('muted');
			
			model.setProperty('muted', !muted);
			view.mute(!muted);
		};
		
		_this.volume = function(vol) {
			if (vol == 0) {
				model.setProperty('muted', true);
			}
			
			model.setProperty('volume', vol);
			view.volume(vol);
		};
		
		_this.hd = function(index) {
			var sources = model.getProperty('sources');
			if (!sources || !sources[index]) {
				return;
			}
			
			_this.play(sources[index]);
		};
		
		_this.bullet = function() {
			var bullet = model.getProperty('bullet');
			
			model.setProperty('bullet', !bullet);
			view.bullet(!bullet);
		};
		
		_this.fullpage = function(exit) {
			view.fullpage(exit);
		}
		_this.fullscreen = function(exit) {
			view.fullscreen(exit);
		};
		
		
		function _retry() {
			if (model.config.maxretries < 0 || _retrycount < model.config.maxretries) {
				var delay = Math.ceil(model.config.retrydelay + Math.random() * 5000);
				
				utils.log('Retry delay ' + delay / 1000 + 's ...');
				
				_retrycount++;
				_startTimer(delay);
			}
		}
		
		function _startTimer(delay) {
			if (!_timer) {
				_timer = new utils.timer(delay, 1);
				_timer.addEventListener(events.PLAYEASE_TIMER, function(e) {
					_this.play();
				});
			}
			_timer.delay = delay;
			_timer.reset();
			_timer.start();
		}
		
		function _stopTimer() {
			if (_timer) {
				_timer.stop();
			}
		}
		
		
		function _renderStateHandler(e) {
			model.setState(e.state);
			_forward(e);
		}
		
		function _onPlay(e) {
			_this.play(_urgent);
			_forward(e);
		}
		
		function _onPause(e) {
			_this.pause();
			_forward(e);
		}
		
		function _onReload(e) {
			_this.reload();
			_forward(e);
		}
		
		function _onSeek(e) {
			var state = model.getState();
			if (state != states.STOPPED && state != states.ERROR) {
				_this.seek(e.offset);
				_forward(e);
			}
		}
		
		function _onStop(e) {
			_this.stop();
			_forward(e);
		}
		
		function _onReport(e) {
			_this.report();
			_forward(e);
		}
		
		function _onMute(e) {
			_this.mute();
			_forward(e);
		}
		
		function _onVolume(e) {
			_this.volume(e.volume);
			_forward(e);
		}
		
		function _onHD(e) {
			
		}
		
		function _onBullet(e) {
			_this.bullet();
			_forward(e);
		}
		
		function _onFullpage(e) {
			var fp = model.getProperty('fullpage');
			if (e.exit == !fp) {
				return;
			}
			
			_this.fullpage(fp);
			_this.dispatchEvent(events.PLAYEASE_FULLPAGE, e);
		}
		
		function _onFullscreen(e) {
			var fs = model.getProperty('fullscreen');
			if (e.exit == !fs) {
				return;
			}
			
			_this.fullscreen(fs);
			_this.dispatchEvent(events.PLAYEASE_FULLSCREEN, e);
		}
		
		function _onSetupError(e) {
			model.setState(states.ERROR);
			view.display(null, e.message);
			
			_this.stop();
			_forward(e);
		}
		
		function _onDuration(e) {
			model.setProperty('duration', e.duration);
			view.setDuration(e.duration);
			
			_forward(e);
		}
		
		function _onRenderError(e) {
			model.setState(states.ERROR);
			view.display(null, e.message);
			
			_this.stop();
			_forward(e);
		}
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_init();
	};
})(playease);
