(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		states = core.states;
	
	core.controller = function(model, view) {
		var _this = utils.extend(this, new events.eventdispatcher('core.controller')),
			_ready = false;
		
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
			
			view.addEventListener(events.PLAYEASE_RENDER_ERROR, _onRenderError);
			
			_initializeAPI();
		}
		
		function _initializeAPI() {
			_this.report = view.report;
			_this.fullpage = view.fullpage;
			_this.fullscreen = view.fullscreen;
		}
		
		_this.play = function(url) {
			model.setState(states.PLAYING);
			view.play(url);
		};
		
		_this.pause = function() {
			model.setState(states.PAUSED);
			view.pause();
		};
		
		_this.reload = function() {
			model.setState(states.PLAYING);
			view.play();
		};
		
		_this.seek = function(offset) {
			model.setState(states.PLAYING);
			view.seek(offset);
		};
		
		_this.stop = function() {
			model.setState(states.STOPPED);
			view.stop();
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
		
		_this.bullet = function() {
			var bullet = model.getProperty('bullet');
			model.setProperty('bullet', !bullet);
			view.bullet(!bullet);
		};
		
		_this.hd = function(index) {
			var sources = model.getProperty('sources');
			if (!sources || !sources[index]) {
				return;
			}
			
			_this.play(sources[index]);
		};
		
		function _modelStateHandler(e) {
			switch (e.state) {
				case states.BUFFERING:
					_this.dispatchEvent(events.PLAYEASE_BUFFER);
					break;
				case states.PLAYING:
					_this.dispatchEvent(events.PLAYEASE_PLAY);
					break;
				case states.PAUSED:
					_this.dispatchEvent(events.PLAYEASE_PAUSE);
					break;
				case states.SEEKING:
					_this.dispatchEvent(events.PLAYEASE_SEEK);
					break;
				case states.STOPPED:
					_this.dispatchEvent(events.PLAYEASE_STOP);
					break;
				case states.ERROR:
					// do nothing here.
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
				
				if (model.config.autoplay) {
					_this.play();
				}
				
				window.onbeforeunload = function(ev) {
					
				};
			}
		}
		
		function _onPlay(e) {
			var state = model.getState();
			if (state == states.PAUSED || state == states.STOPPED || state == states.ERROR) {
				_this.play();
				_forward(e);
			}
		}
		
		function _onPause(e) {
			var state = model.getState();
			if (state == states.BUFFERING || state == states.PLAYING || state == states.ERROR) {
				_this.pause();
				_forward(e);
			}
		}
		
		function _onReload(e) {
			model.setState(states.BUFFERING);
			_this.reload();
			_forward(e);
		}
		
		function _onSeek(e) {
			var state = model.getState();
			if (state != states.SEEKING) {
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
			_this.fullpage(fp);
			_forward(e);
			
			model.setProperty('fullpage', !fp);
		}
		
		function _onFullscreen(e) {
			var fs = model.getProperty('fullscreen');
			_this.fullscreen(fs);
			_forward(e);
			
			model.setProperty('fullscreen', !fs);
		}
		
		function _onSetupError(e) {
			model.setState(states.ERROR);
			_forward(e);
		}
		
		function _onRenderError(e) {
			model.setState(states.ERROR);
			_forward(e);
		}
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_init();
	};
})(playease);
