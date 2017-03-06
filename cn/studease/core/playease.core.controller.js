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
			view.addEventListener(events.PLAYEASE_VIEW_SEEK, _onSeek);
			view.addEventListener(events.PLAYEASE_VIEW_STOP, _onStop);
			view.addEventListener(events.PLAYEASE_VIEW_VOLUNE, _onVolume);
			view.addEventListener(events.PLAYEASE_VIEW_FULLSCREEN, _onFullscreen);
			
			view.addEventListener(events.PLAYEASE_RENDER_ERROR, _onRenderError);
			
			_initializeAPI();
		}
		
		function _initializeAPI() {
			_this.play = view.render.play;
			_this.pause = view.render.pause;
			_this.seek = view.render.seek;
			_this.stop = view.render.stop;
			_this.volume = view.render.volume;
			_this.mute = view.render.mute;
			_this.fullscreen = view.render.fullscreen;
		}
		
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
		
		function _onSeek(e) {
			var state = model.getState();
			if (state != states.SEEKING) {
				_this.seek(e.time);
				_forward(e);
			}
		}
		
		function _onStop(e) {
			_this.stop();
			_forward(e);
		}
		
		function _onVolume(e) {
			_this.volume(e.vol);
			_forward(e);
		}
		
		function _onFullscreen(e) {
			_this.fullscreen(e.esc);
			_forward(e);
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
