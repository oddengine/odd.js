(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		states = core.states,
		renders = core.renders,
		renderModes = renders.modes,
		css = utils.css,
		
		WRAP_CLASS = 'playerwrap';
	
	core.view = function(entity, model) {
		var _this = utils.extend(this, new events.eventdispatcher('core.view')),
			_wrapper,
			_render,
			_video,
			_mediainfo,
			_ms,
			_sbs,
			_segments,
			_endOfStream = false,
			_errorState = false;
		
		function _init() {
			_wrapper = utils.createElement('div', WRAP_CLASS);
			_wrapper.id = entity.id;
			_wrapper.tabIndex = 0;
			
			var replace = document.getElementById(entity.id);
			replace.parentNode.replaceChild(_wrapper, replace);
			
			window.onresize = function() {
				if (utils.typeOf(model.onresize) == 'function') 
					model.onresize.call(null);
				else 
					_this.resize();
			};
			
			window.MediaSource = window.MediaSource || window.WebKitMediaSource;
			
			_sbs = { audio: null, video: null };
			_segments = { audio: [], video: [] };
		}
		
		_this.setup = function() {
			/*
			There's no available render currently. Use the builtin controls of browser for now.
			
			_setupRender();
			try {
				_wrapper.addEventListener('keydown', _onKeyDown);
			} catch (e) {
				_wrapper.attachEvent('onkeydown', _onKeyDown);
			}
			*/
			_video = utils.createElement('video');
			_video.controls = 'controls';
			_video.autoplay = 'autoplay';
			_wrapper.appendChild(_video);
			
			_ms = new MediaSource();
			_ms.addEventListener('sourceopen', _onMediaSourceOpen);
			_ms.addEventListener('sourceended', _onMediaSourceEnded);
			_ms.addEventListener('sourceclose', _onMediaSourceClose);
			_ms.addEventListener('error', _onMediaSourceError);
			
			_ms.addEventListener('webkitsourceopen', _onMediaSourceOpen);
			_ms.addEventListener('webkitsourceended', _onMediaSourceEnded);
			_ms.addEventListener('webkitsourceclose', _onMediaSourceClose);
			_ms.addEventListener('webkiterror', _onMediaSourceError);
			
			_video.src = window.URL.createObjectURL(_ms);
		};
		
		function _setupRender() {
			switch (model.render.name) {
				case renderModes.DEFAULT:
					var cfg = utils.extend({}, model.getConfig('render'), {
						id: entity.id,
						width: model.width,
						height: model.height
					});
					_this.render = _render = new renders[renderModes.DEFAULT](_this, cfg);
					break;
				default:
					_this.dispatchEvent(events.PLAYEASE_SETUP_ERROR, { message: 'Unknown render mode!', name: model.render.name });
					break;
			}
			
			if (_render) {
				_render.addEventListener(events.PLAYEASE_VIEW_PLAY, _onPlay);
				_render.addEventListener(events.PLAYEASE_VIEW_PAUSE, _onPause);
				_render.addEventListener(events.PLAYEASE_VIEW_SEEK, _onSeek);
				_render.addEventListener(events.PLAYEASE_VIEW_STOP, _onStop);
				_render.addEventListener(events.PLAYEASE_VIEW_VOLUNE, _onVolume);
				_render.addEventListener(events.PLAYEASE_VIEW_MUTE, _onMute);
				_render.addEventListener(events.PLAYEASE_VIEW_FULLSCREEN, _onFullscreen);
				_render.addEventListener(events.PLAYEASE_RENDER_ERROR, _onRenderError);
				
				_wrapper.appendChild(_render.element());
			}
		}
		
		_this.appendInitSegment = function(type, seg) {
			var mimetype = type + '/mp4; codecs="' + _mediainfo[type + 'Codec'] + '"';
			var issurpported = MediaSource.isTypeSupported(mimetype);
			if (!issurpported) {
				utils.log('Mime type is not surpported: ' + mimetype + '.');
				model.state = states.ERROR;
				return;
			}
			utils.log('Mime type: ' + mimetype + '.');
			
			if (_ms.readyState == 'closed') {
				model.state = states.ERROR;
				return;
			}
			
			var sb = _sbs[type] = _ms.addSourceBuffer(mimetype);
			sb.type = type;
			sb.addEventListener('updateend', _onUpdateEnd);
			sb.addEventListener('error', _onSourceBufferError);
			sb.appendBuffer(seg);
		};
		
		_this.appendSegment = function(type, seg) {
			/*var state = model.getState();
			switch (state) {
				case states.BUFFERING:
				case states.PLAYING:
				case states.SEEKING:
					
					break;
				case states.PAUSED:
					
					break;
				case states.STOPPED:
					
					break;
				case states.ERROR:
					
					break;
				default:
					utils.log('Unknown model state ' + state);
			}*/
			
			_segments[type].push(seg);
			
			var sb = _sbs[type];
			if (sb.updating) {
				return;
			}
			
			var seg = _segments[type].shift();
			sb.appendBuffer(seg);
		};
		
		_this.setMediaInfo = function(info) {
			_mediainfo = info;
		};
		
		_this.endOfStream = function() {
			_endOfStream = true;
		};
		
		function _onMediaSourceOpen(e) {
			utils.log('source open');
			
			_this.dispatchEvent(events.PLAYEASE_READY, { id: entity.id });
		}
		
		function _onUpdateEnd(e) {
			utils.log('update end');
			
			var type = e.target.type;
			
			if (_endOfStream) {
				if (!_ms || _ms.readyState !== 'open') {
					return;
				}
				
				if (!_segments.audio.length && !_segments.video.length) {
					_ms.endOfStream();
					return;
				}
			}
			
			if (_segments[type].length == 0) {
				return;
			}
			
			var sb = _sbs[type];
			if (sb.updating) {
				return;
			}
			
			var seg = _segments[type].shift();
			try {
				sb.appendBuffer(seg);
			} catch (e) {
				utils.log(e);
			}
		}
		
		function _onSourceBufferError(e) {
			utils.log('source buffer error');
		}
		
		function _onMediaSourceEnded(e) {
			utils.log('source ended');
		}
		
		function _onMediaSourceClose(e) {
			utils.log('source close');
		}
		
		function _onMediaSourceError(e) {
			utils.log('media source error');
		}
		
		function _onPlay(e) {
			_forward(e);
		}
		
		function _onPause(e) {
			_forward(e);
		}
		
		function _onSeek(e) {
			_forward(e);
		}
		
		function _onStop(e) {
			_forward(e);
		}
		
		function _onVolume(e) {
			_forward(e);
		}
		
		function _onMute(e) {
			_forward(e);
		}
		
		function _onFullscreen(e) {
			_forward(e);
		}
		
		function _onRenderError(e) {
			_forward(e);
		}
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		function _onKeyDown(e) {
			if (e.ctrlKey || e.metaKey) {
				return true;
			}
			
			switch (e.keyCode) {
				case 13: // enter
					_render.send();
					break;
				default:
					break;
			}
			
			if (/13/.test(e.keyCode)) {
				// Prevent keypresses from scrolling the screen
				e.preventDefault ? e.preventDefault() : e.returnValue = false;
				return false;
			}
		}
		
		_this.display = function(icon, message) {
			if (_render) {
				_render.display(icon, message);
			}
		};
		
		_this.resize = function(width, height) {
			if (_render) 
				_render.resize(width, height);
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
		
		_init();
	};
})(playease);
