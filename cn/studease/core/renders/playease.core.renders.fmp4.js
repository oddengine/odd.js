(function(playease) {
	var utils = playease.utils,
		css = utils.css,
		//filekeeper = utils.filekeeper,
		events = playease.events,
		io = playease.io,
		priority = io.priority,
		muxer = playease.muxer,
		mp4 = muxer.mp4,
		core = playease.core,
		states = core.states,
		renders = core.renders,
		renderTypes = renders.types,
		renderModes = renders.modes;
	
	renders.fmp4 = function(layer, config) {
		var _this = utils.extend(this, new events.eventdispatcher('renders.fmp4')),
			_defaults = {
				bufferLength: 4 * 1024 * 1024
			},
			_video,
			_url,
			_src,
			_range,
			_contentLength,
			_loader,
			_demuxer,
			_videoCodec,
			_audioCodec,
			_mimeType,
			_ms,
			_sb,
			_segments,
			//_fileindex,
			//_filekeeper,
			_waiting,
			_endOfStream = false;
		
		function _init() {
			_this.name = renderTypes.FMP4;
			
			_this.config = utils.extend({}, _defaults, config);
			
			_url = '';
			_src = '';
			_videoCodec = '';
			_audioCodec = '';
			_mimeType = '';
			_contentLength = Number.MAX_VALUE;
			_waiting = true;
			
			_range = { start: 0, end: '' };
			_segments = [];
			
			_video = utils.createElement('video');
			if (_this.config.airplay) {
				_video.setAttribute('x-webkit-airplay', 'allow');
			}
			if (_this.config.playsinline) {
				_video.setAttribute('playsinline', '');
				_video.setAttribute('webkit-playsinline', '');
				_video.setAttribute('x5-playsinline', '');
				_video.setAttribute('x5-video-player-type', 'h5');
				_video.setAttribute('x5-video-player-fullscreen', true);
			}
			_video.preload = 'none';
			
			_video.addEventListener('durationchange', _onDurationChange);
			_video.addEventListener('waiting', _onWaiting);
			_video.addEventListener('playing', _onPlaying);
			_video.addEventListener('pause', _onPause);
			_video.addEventListener('ended', _onEnded);
			_video.addEventListener('error', _onError);
			
			//_fileindex = 0;
			//_filekeeper = new filekeeper();
			
			_initMuxer();
			_initMSE();
		}
		
		function _initLoader() {
			var name, type = _this.config.loader.name;
			
			if (type && io.hasOwnProperty(type) && io[type].isSupported(_url)) {
				name = type;
			} else {
				for (var i = 0; i < priority.length; i++) {
					type = priority[i];
					if (io[type].isSupported(_url)) {
						name = type;
						break;
					}
				}
			}
			
			if (_this.config.mode == renderModes.VOD && name == io.types.XHR_CHUNKED_LOADER) {
				_range.start = 0;
				_range.end = _this.config.bufferLength - 1;
			}
			
			if (_loader) {
				_loader.abort();
				
				if (_loader.name == name) {
					return;
				} else {
					_loader.removeEventListener(events.PLAYEASE_CONTENT_LENGTH, _onContenLength);
					_loader.removeEventListener(events.PLAYEASE_PROGRESS, _onLoaderProgress);
					_loader.removeEventListener(events.PLAYEASE_COMPLETE, _onLoaderComplete);
					_loader.removeEventListener(events.ERROR, _onLoaderError);
					
					delete _loader;
				}
			}
			
			try {
				_loader = new io[name](utils.extend({}, _this.config.loader, { responseType: io.responseTypes.ARRAYBUFFER }));
				_loader.addEventListener(events.PLAYEASE_CONTENT_LENGTH, _onContenLength);
				_loader.addEventListener(events.PLAYEASE_PROGRESS, _onLoaderProgress);
				_loader.addEventListener(events.PLAYEASE_COMPLETE, _onLoaderComplete);
				_loader.addEventListener(events.ERROR, _onLoaderError);
				
				utils.log('"' + name + '" initialized.');
			} catch (err) {
				utils.log('Failed to init loader "' + name + '"!');
				_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'No supported loader found.' });
			}
		}
		
		function _initMuxer() {
			_demuxer = new muxer.mp4();
			_demuxer.addEventListener(events.PLAYEASE_MP4_BOX, _onMP4Box);
			_demuxer.addEventListener(events.ERROR, _onDemuxerError);
		}
		
		function _initMSE() {
			window.MediaSource = window.MediaSource || window.WebKitMediaSource;
			
			_ms = new MediaSource();
			_ms.addEventListener('sourceopen', _onMediaSourceOpen);
			_ms.addEventListener('sourceended', _onMediaSourceEnded);
			_ms.addEventListener('sourceclose', _onMediaSourceClose);
			_ms.addEventListener('error', _onMediaSourceError);
			
			_ms.addEventListener('webkitsourceopen', _onMediaSourceOpen);
			_ms.addEventListener('webkitsourceended', _onMediaSourceEnded);
			_ms.addEventListener('webkitsourceclose', _onMediaSourceClose);
			_ms.addEventListener('webkiterror', _onMediaSourceError);
		}
		
		_this.setup = function() {
			_this.dispatchEvent(events.PLAYEASE_READY, { id: _this.config.id });
		};
		
		_this.play = function(url) {
			if (!_video.src || _video.src !== _src || url && url != _url) {
				if (url && url != _url) {
					if (!renders.fmp4.isSupported(url)) {
						_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'Resource not supported by render "' + _this.name + '".' });
						return;
					}
					
					_url = url;
				}
				
				_segments = [];
				_waiting = true;
				
				_initLoader();

				_video.src = URL.createObjectURL(_ms);
				_video.load();
				
				_src = _video.src;
			} else {
				_this.dispatchEvent(events.PLAYEASE_STATE, { state: states.PLAYING });
			}
			
			var promise = _video.play();
			if (promise) {
				promise['catch'](function(e) { /* void */ });
			}
			
			_video.controls = false;
		};
		
		_this.pause = function() {
			_waiting = false;
			
			_video.pause();
			_video.controls = false;
		};
		
		_this.reload = function() {
			_this.stop();
			_this.play(_url);
		};
		
		_this.seek = function(offset) {
			if (isNaN(_video.duration)) {
				_this.play();
				return;
			}
			
			var position = _video.duration * offset / 100;
			_video.currentTime = position;
			
			var promise = _video.play();
			if (promise) {
				promise['catch'](function(e) { /* void */ });
			}
			
			_video.controls = false;
		};
		
		_this.stop = function() {
			_src = '';
			_waiting = true;
			
			if (_ms) {
				if (_sb) {
					try {
						_ms.removeSourceBuffer(_sb);
					} catch (err) {
						utils.log('Failed to removeSourceBuffer(): ' + err.toString());
					}
				}
				
				_sb = null;
			}
			
			_segments = [];
			
			if (_loader) {
				_loader.abort();
			}
			
			_video.removeAttribute('src');
			_video.pause();
			_video.load();
			_video.controls = false;
			
			_this.dispatchEvent(events.PLAYEASE_STATE, { state: states.STOPPED });
		};
		
		_this.mute = function(muted) {
			_video.muted = muted;
		};
		
		_this.volume = function(vol) {
			_video.volume = vol / 100;
		};
		
		_this.hd = function(index) {
			
		};
		
		/**
		 * Loader
		 */
		function _onContenLength(e) {
			utils.log('onContenLength: ' + e.length);
			_contentLength = e.length;
		}
		
		function _onLoaderProgress(e) {
			//utils.log('onLoaderProgress: ' + e.data.byteLength);
			
			/*if (_fileindex < 20533) {
				_fileindex++;
				_filekeeper.append(e.data);
				
				if (_fileindex == 20533) {
					_filekeeper.save('sample.fmp4.mp4');
				}
			}*/
			
			if (_mimeType == '') {
				_demuxer.parse(e.data);
			}
			
			_segments.push(e.data);
			_this.appendSegment();
		}
		
		function _onLoaderComplete(e) {
			utils.log('onLoaderComplete');
			
			if (_this.config.mode == renderModes.LIVE) {
				_endOfStream = true;
				
				if (!_ms || _ms.readyState !== 'open') {
					return;
				}
				
				if (!_segments.length) {
					_ms.endOfStream();
				}
			}
		}
		
		function _onLoaderError(e) {
			utils.log(e.message);
			_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: e.message });
		}
		
		/**
		 * Demuxer
		 */
		function _onMP4Box(e) {
			var u8 = new Uint8Array(e.box.data);
			
			switch (e.box.type) {
			case 'stsd':
				u8 = new Uint8Array(e.box.data, 8);
				break;
				
			case 'avc1':
				u8 = new Uint8Array(e.box.data, 78);
				break;
				
			case 'mp4a':
				u8 = new Uint8Array(e.box.data, 28);
				break;
			}
			
			switch (e.box.type) {
			case 'moov':
			case 'trak':
			case 'mdia':
			case 'minf':
			case 'stbl':
			case 'stsd':
			case 'avc1':
			case 'mp4a':
				_demuxer.parse(u8);
				
				if (e.box.type == 'moov') {
					var codecs = _videoCodec + (_videoCodec && _audioCodec ? ',' : '') + _audioCodec;
					_this.addSourceBuffer('video/mp4; codecs="' + codecs + '"');
				}
				break;
				
			case 'avcC':
				_videoCodec = 'avc1.';
				u8 = new Uint8Array(e.box.data, 9, 3); // sps.slice(1, 4)
				
				for (var i = 0; i < u8.byteLength; i++) {
					var h = u8[i].toString(16);
					if (h.length < 2) {
						h = '0' + h;
					}
					
					_videoCodec += h;
				}
				break;
				
			case 'esds':
				_audioCodec = 'mp4a.40.';
				u8 = new Uint8Array(e.box.data, 4); // version 0 + flags
				
				var o = mp4.parseDescriptor(u8);
				if (o[3] && o[3].data) {
					o = mp4.parseDescriptor(o[3].data.slice(3));
					if (o[4] && o[4].data) {
						o = mp4.parseDescriptor(o[4].data.slice(13));
						if (o[5] && o[5].data) {
							_audioCodec += o[5].data[0] >> 3;
							break;
						}
					}
				}
				
				_audioCodec += 5;
				break;
			}
		}
		
		function _onDemuxerError(e) {
			utils.log(e.message);
			_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'Demuxer error ocurred.' });
		}
		
		/**
		 * MSE
		 */
		_this.addSourceBuffer = function(mimetype) {
			utils.log('Mime type: ' + mimetype + '.');
			
			var issurpported = MediaSource.isTypeSupported(mimetype);
			if (!issurpported) {
				_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'Mime type is not surpported: ' + mimetype + '.' });
				return;
			}
			
			if (_ms.readyState == 'closed') {
				_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'MediaSource is closed while appending init segment.' });
				return;
			}
			
			try {
				_sb = _ms.addSourceBuffer(mimetype);
				_sb.addEventListener('updateend', _onUpdateEnd);
				_sb.addEventListener('error', _onSourceBufferError);
			} catch (err) {
				utils.log('Failed to addSourceBuffer, mimeType: ' + mimetype + '.');
			}
		};
		
		_this.appendSegment = function() {
			if (_segments.length == 0) {
				return;
			}
			
			if (!_sb || _sb.updating) {
				return;
			}
			
			var seg = _segments.shift();
			try {
				_sb.appendBuffer(seg);
			} catch (err) {
				utils.log('Failed to appendBuffer: ' + err.toString());
			}
		};
		
		function _onMediaSourceOpen(e) {
			utils.log('media source open');
			
			_loader.load(_url, _range.start, _range.end);
		}
		
		function _onUpdateEnd(e) {
			//utils.log('update end');
			
			if (_endOfStream) {
				if (!_ms || _ms.readyState !== 'open') {
					return;
				}
				
				if (!_segments.length) {
					//_filekeeper.save('sample.mp4');
					_ms.endOfStream();
					return;
				}
			}
			
			_this.appendSegment();
		}
		
		function _onSourceBufferError(e) {
			utils.log('source buffer error');
		}
		
		function _onMediaSourceEnded(e) {
			utils.log('media source ended');
		}
		
		function _onMediaSourceClose(e) {
			utils.log('media source close');
		}
		
		function _onMediaSourceError(e) {
			utils.log('media source error');
			_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'MediaSource error ocurred.' });
		}
		
		
		_this.getRenderInfo = function() {
			var buffered;
			var position = _video.currentTime;
			var duration = _video.duration;
			
			var ranges = _video.buffered;
			var start, end;
			for (var i = 0; i < ranges.length; i++) {
				start = ranges.start(i);
				end = ranges.end(i);
				if (start <= position && position < end) {
					buffered = duration ? Math.floor(end / _video.duration * 10000) / 100 : 0;
					break;
				}
				
				if (i == 0 && position < start) {
					_video.currentTime = start;
				}
			}
			
			if (_waiting && position + _this.config.bufferTime <= end) {
				_waiting = false;
				_this.dispatchEvent(events.PLAYEASE_STATE, { state: states.PLAYING });
			}
			
			if (_this.config.mode == renderModes.VOD && _loader && _loader.state() == io.readyStates.DONE) {
				var cached = end || 0;
				if (_segments.video.length) {
					cached = Math.max(cached, _segments.video[_segments.video.length - 1].info.endDts);
				}
				
				if (_loader.name == io.types.XHR_CHUNKED_LOADER && cached < position + 60 && _range.end < _contentLength - 1) {
					_range.start = _range.end + 1;
					_range.end = _range.start + _loader.config.chunkSize - 1;
					
					_loader.load(_url, _range.start, _range.end);
				}
			}
			
			return {
				buffered: buffered,
				position: position,
				duration: duration
			};
		};
		
		
		function _onDurationChange(e) {
			_this.dispatchEvent(events.PLAYEASE_DURATION, { duration: e.target.duration });
		}
		
		function _onWaiting(e) {
			_waiting = true;
			_this.dispatchEvent(events.PLAYEASE_STATE, { state: states.BUFFERING });
		}
		
		function _onPlaying(e) {
			_this.dispatchEvent(events.PLAYEASE_STATE, { state: states.PLAYING });
		}
		
		function _onPause(e) {
			if (!_waiting) {
				_this.dispatchEvent(events.PLAYEASE_STATE, { state: states.PAUSED });
			}
		}
		
		function _onEnded(e) {
			_this.dispatchEvent(events.PLAYEASE_STATE, { state: states.STOPPED });
		}
		
		function _onError(e) {
			var message = 'Video error ocurred!';
			_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: message });
			_this.dispatchEvent(events.PLAYEASE_STATE, { state: states.ERROR, message: message });
		}
		
		
		_this.element = function() {
			return _video;
		};
		
		_this.resize = function(width, height) {
			css.style(_video, {
				width: width + 'px',
				height: height + 'px'
			});
		};
		
		_this.destroy = function() {
			
		};
		
		_init();
	};
	
	renders.fmp4.isSupported = function(file, mode) {
		var protocol = utils.getProtocol(file);
		if (protocol != 'http' && protocol != 'https'
				&& protocol != 'ws' && protocol != 'wss') {
			return false;
		}
		
		if (utils.isMSIE('(8|9|10)') || utils.isIETrident() || utils.isSogou() || utils.isIOS() || utils.isQQBrowser() 
				|| utils.isAndroid('[0-4]\\.\\d') || utils.isAndroid('[5-8]\\.\\d') && utils.isChrome('([1-4]?\\d|5[0-5])\\.\\d') || mode == renderModes.LIVE && !fetch) {
			return false;
		}
		
		var map = [
			'mp4', 'f4v', 'm4v', 'mov',
			'm4a', 'f4a',
			'm4s', undefined, ''
		];
		
		var extension = utils.getExtension(file);
		
		for (var i = 0; i < map.length; i++) {
			if (extension === map[i]) {
				return true;
			}
		}
		
		return false;
	};
})(playease);
