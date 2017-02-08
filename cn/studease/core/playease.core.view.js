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
			_mimeType,
			_ms,
			_sb,
			_segments,
			_updateend = false,
			_errorState = false;
		
		function _init() {
			_segments = [];
			
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
			
			//_ms = new WebKitMediaSource();
			//_ms.addEventListener('webkitsourceopen', _onMediaSourceOpen);
			
			setTimeout(function() {
				_this.dispatchEvent(events.PLAYEASE_READY, { id: entity.id });
			}, 0);
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
				_render.addEventListener(events.PLAYEASE_VIEW_FULLSCREEN, _onFullscreen);
				_render.addEventListener(events.PLAYEASE_RENDER_ERROR, _onRenderError);
				
				_wrapper.appendChild(_render.element());
			}
		}
		
		_this.decode = function(seg) {
			var state = model.getState();
			switch (state) {
				case states.BUFFERING:
				case states.PLAYING:
				case states.SEEKING:
					
					break;
				case states.PAUSED:
					
					break;
				case states.STOPPED:
					_video.src = window.URL.createObjectURL(_ms);
					model.state = states.BUFFERING;
					break;
				case states.ERROR:
					
					break;
				default:
					utils.log('Unknown model state ' + state);
			}
			
			_segments.push(seg);
			
			if (_updateend == false) {
				return;
			}
			
			var seg = _segments.shift();
			_updateend = false;
			_sb.appendBuffer(seg);
		};
		
		_this.setMediaInfo = function(info) {
			_mediainfo = info;
			
			_mimeType = 'video/mp4; codecs="' + _mediainfo.videoCodec
					+ (_mediainfo.hasAudio && _mediainfo.audioCodec ? ',' + _mediainfo.audioCodec : '') + '"';
		};
		
		function _onMediaSourceOpen(e) {
			utils.log('source open');
			
			if (_ms.sourceBuffers.length > 0) {
				model.state = states.ERROR;
				return;
			}
			
			var typeName = _mimeType || 'video/mp4; codecs="avc1.42E01E"';
			var issurpported = MediaSource.isTypeSupported(typeName);
			if (!issurpported) {
				utils.log('Codecs is not surpported!');
				model.state = states.ERROR;
				return;
			}
			
			if (_ms.readyState == 'closed') {
				model.state = states.ERROR;
				return;
			}
			
			_sb = _ms.addSourceBuffer(typeName);
			_sb.addEventListener('updateend', _onUpdateEnd);
			_sb.addEventListener('error', _onSourceBufferError);
			
			if (_segments.length == 0) {
				return;
			}
			
			var seg = _segments.shift();
			_updateend = false;
			_sb.appendBuffer(seg);
		}
		
		function _onUpdateEnd(e) {
			utils.log('update end');
			
			_updateend = true;
			
			if (_segments.length == 0) {
				return;
			}
			
			var seg = _segments.shift();
			_updateend = false;
			_sb.appendBuffer(seg);
		}
		
		function _onSourceBufferError(e) {
			utils.log('buffer error');
		}
		
		function _onMediaSourceEnded(e) {
			utils.log('source ended');
		}
		
		function _onMediaSourceClose(e) {
			utils.log('source close');
		}
		
		function _onMediaSourceError(e) {
			utils.log('source error');
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
