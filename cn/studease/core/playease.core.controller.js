(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		states = core.states;
	
	core.controller = function(model, view) {
		var _this = utils.extend(this, new events.eventdispatcher('core.controller')),
			_ready = false,
			_urgent;
		
		function _init() {
			model.addEventListener(events.PLAYEASE_STATE, _modelStateHandler);
			
			view.addEventListener(events.PLAYEASE_READY, _onReady);
			view.addEventListener(events.PLAYEASE_SETUP_ERROR, _onSetupError);
			
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
			if (url) {
				_urgent = url;
				
				var render = core.renders[view.render.name];
				if (render && render.isSupported(url)) {
					model.setState(states.PLAYING);
					view.play(url);
					
					return;
				}
				
				var name = playlist.getSupported(url);
				if (!name) {
					_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'No supported render found!' });
					return;
				}
				
				if (view.render.name != name) {
					_ready = false;
					view.activeRender(name);
					return;
				}
				
				model.setState(states.PLAYING);
				view.play(url);
				
				return;
			}
			
			var item = playlist.getItemAt(playlist.index);
			if (item) {
				if (view.render.name != item.type) {
					_ready = false;
					view.activeRender(item.type);
					return;
				}
				
				model.setState(states.PLAYING);
				view.play(item.file);
				
				return;
			}
			
			_this.dispatchEvent(events.ERROR, { message: 'Failed to get playlist item!' });
		};
		
		_this.pause = function() {
			model.setState(states.PAUSED);
			view.pause();
		};
		
		_this.reload = function() {
			playease.api.displayError('', model.config);
			
			if (!_ready) {
				_this.dispatchEvent(events.ERROR, { message: 'Player is not ready yet!' });
				return;
			}
			
			var url = _urgent;
			if (!url) {
				var playlist = model.getProperty('playlist');
				var item = playlist.getItemAt(playlist.index);
				if (item) {
					if (view.render.name != item.type) {
						_ready = false;
						view.activeRender(item.type);
						return;
					}
					
					url = item.file;
				}
			}
			
			model.setState(states.RELOADING);
			view.reload(url);
		};
		
		_this.seek = function(offset) {
			if (!_ready) {
				_this.dispatchEvent(events.ERROR, { message: 'Player is not ready yet!' });
				return;
			}
			
			model.setState(states.SEEKING);
			view.seek(offset);
		};
		
		_this.stop = function() {
			var playlist = model.getProperty('playlist');
			playlist.activeNextItem();
			
			_urgent = undefined;
			
			model.setState(states.STOPPED);
			view.stop();
		};
		
		_this.report = function() {
			view.report();
			_this.dispatchEvent(events.PLAYEASE_REPORT);
		};
		
		_this.mute = function() {
			var muted = model.getProperty('muted');
			model.setProperty('muted', !muted);
			view.mute(!muted);
			_this.dispatchEvent(events.PLAYEASE_MUTE, { muted: !muted });
		};
		
		_this.volume = function(vol) {
			if (vol == 0) {
				model.setProperty('muted', true);
			}
			model.setProperty('volume', vol);
			view.volume(vol);
			_this.dispatchEvent(events.PLAYEASE_VOLUME, { volume: vol });
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
			_this.dispatchEvent(events.PLAYEASE_BULLET, { bullet: !bullet ? 'on' : 'off' });
		};
		
		_this.fullpage = function(exit) {
			view.fullpage(exit);
			_this.dispatchEvent(events.PLAYEASE_FULLPAGE, { exit: exit });
		}
		_this.fullscreen = function(exit) {
			view.fullscreen(exit);
			_this.dispatchEvent(events.PLAYEASE_FULLSCREEN, { exit: exit });
		};
		
		function _modelStateHandler(e) {
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
				case states.RELOADING:
					_this.dispatchEvent(events.PLAYEASE_RELOADING);
					break;
				case states.SEEKING:
					_this.dispatchEvent(events.PLAYEASE_SEEKING);
					break;
				case states.STOPPED:
					_this.dispatchEvent(events.PLAYEASE_STOPPED);
					break;
				case states.ERROR:
					// do nothing here.
					break;
				default:
					_this.dispatchEvent(events.ERROR, { message: 'Unknown model state!', state: e.state });
					break;
			}
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
			_forward(e);
		}
		
		function _onFullscreen(e) {
			var fs = model.getProperty('fullscreen');
			if (e.exit == !fs) {
				return;
			}
			
			_this.fullscreen(fs);
			_forward(e);
		}
		
		function _onSetupError(e) {
			model.setState(states.ERROR);
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
			_this.stop();
			_forward(e);
		}
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_init();
	};
})(playease);
