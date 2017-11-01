(function(playease) {
	var utils = playease.utils,
		css = utils.css,
		//filekeeper = utils.filekeeper,
		events = playease.events,
		io = playease.io,
		responseTypes = io.responseTypes,
		readystates = io.readystates,
		priority = io.priority,
		muxer = playease.muxer,
		rtmp = playease.net.rtmp,
		core = playease.core,
		states = core.states,
		renders = core.renders,
		rendertypes = renders.types,
		rendermodes = renders.modes,
		
		AMF = rtmp.AMF,
		TAG = muxer.flv.TAG,
		FORMATS = muxer.flv.FORMATS,
		CODECS = muxer.flv.CODECS;
	
	renders.flv = function(layer, config) {
		var _this = utils.extend(this, new events.eventdispatcher('renders.flv')),
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
			_remuxer,
			_mediainfo,
			_ms,
			_sb,
			_segments,
			//_fileindex,
			//_filekeeper,
			_waiting,
			_endOfStream = false;
		
		function _init() {
			_this.name = rendertypes.FLV;
			
			_this.config = utils.extend({}, _defaults, config);
			
			_url = '';
			_src = '';
			_contentLength = 0;
			_waiting = true;
			
			_range = { start: 0, end: '' };
			_sb = { audio: null, video: null };
			_segments = { audio: [], video: [] };
			
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
			/*
			_fileindex = 0;
			_filekeeper = new filekeeper();
			*/
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
			
			if (_this.config.mode == rendermodes.VOD && name == io.types.XHR_CHUNKED_LOADER) {
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
				_loader = new io[name](utils.extend({}, _this.config.loader, { responseType: responseTypes.ARRAYBUFFER }));
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
			_demuxer = new muxer.flv();
			_demuxer.addEventListener(events.PLAYEASE_FLV_TAG, _onFLVTag);
			_demuxer.addEventListener(events.PLAYEASE_MEDIA_INFO, _onMediaInfo);
			_demuxer.addEventListener(events.PLAYEASE_AVC_CONFIG_RECORD, _onAVCConfigRecord);
			_demuxer.addEventListener(events.PLAYEASE_AVC_SAMPLE, _onAVCSample);
			_demuxer.addEventListener(events.PLAYEASE_AAC_SPECIFIC_CONFIG, _onAACSpecificConfig);
			_demuxer.addEventListener(events.PLAYEASE_AAC_SAMPLE, _onAACSample);
			_demuxer.addEventListener(events.PLAYEASE_END_OF_STREAM, _onEndOfStream);
			_demuxer.addEventListener(events.ERROR, _onDemuxerError);
			
			_remuxer = new muxer.mp4();
			_remuxer.addEventListener(events.PLAYEASE_MP4_INIT_SEGMENT, _onMP4InitSegment);
			_remuxer.addEventListener(events.PLAYEASE_MP4_SEGMENT, _onMP4Segment);
			_remuxer.addEventListener(events.ERROR, _onRemuxerError);
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
					if (!renders.flv.isSupported(url)) {
						_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'Resource not supported by render "' + _this.name + '".' });
						return;
					}
					
					_url = url;
				}
				
				_waiting = true;
				
				_segments.audio.splice(0, _segments.audio.length);
				_segments.video.splice(0, _segments.video.length);
				
				_initLoader();
				
				_demuxer.reset();
				_remuxer.reset();
				
				_video.src = URL.createObjectURL(_ms);
				_video.load();
				
				_src = _video.src;
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
			
			if (_this.config.mode == rendermodes.VOD && _mediainfo && _mediainfo.isSeekable()) {
				_waiting = true;
				_segments.audio.splice(0, _segments.audio.length);
				_segments.video.splice(0, _segments.video.length);
				
				_loader.abort();
				_demuxer.reset(true);
				_remuxer.reset();
				
				var ranges = _video.buffered;
				var start, end;
				for (var i = 0; i < ranges.length; i++) {
					start = ranges.start(i);
					end = ranges.end(i);
					if (start <= position && position < end) {
						var endKeyframe = _mediainfo.getNearestKeyframe(end);
						_range.end = endKeyframe.fileposition - 1;
						return;
					}
					
					if (position < start) {
						break;
					}
				}
				
				var startKeyframe = _mediainfo.getNearestKeyframe(position);
				_range.start = startKeyframe.fileposition;
				_range.end = _range.start + _this.config.bufferLength - 1;
				if (position < start) {
					var endKeyframe = _mediainfo.getNearestKeyframe(start);
					_range.end = Math.min(_range.end, endKeyframe.fileposition - 1);
				}
				
				_loader.load(_url, _range.start, _range.end);
			}
		};
		
		_this.stop = function() {
			_src = '';
			_waiting = true;
			
			if (_ms) {
				if (_sb.audio) {
					try {
						_ms.removeSourceBuffer(_sb.audio);
					} catch (err) {
						utils.log('Failed to removeSourceBuffer(audio): ' + err.toString());
					}
				}
				if (_sb.video) {
					try {
						_ms.removeSourceBuffer(_sb.video);
					} catch (err) {
						utils.log('Failed to removeSourceBuffer(video): ' + err.toString());
					}
				}
				
				_sb.audio = null;
				_sb.video = null;
			}
			
			_segments.audio.splice(0, _segments.audio.length);
			_segments.video.splice(0, _segments.video.length);
			
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
			_demuxer.parse(e.data);
		}
		
		function _onLoaderComplete(e) {
			utils.log('onLoaderComplete');
		}
		
		function _onLoaderError(e) {
			utils.log(e.message);
			_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: e.message });
		}
		
		/**
		 * Demuxer
		 */
		function _onFLVTag(e) {
			//utils.log('onFlvTag { tag: ' + e.tag + ', offset: ' + e.offset + ', size: ' + e.size + ' }');
			
			switch (e.tag) {
				case TAG.AUDIO:
					if (e.format && e.format != FORMATS.AAC) {
						utils.log('Unsupported audio format(' + e.format + ').');
						break;
					}
					
					_demuxer.parseAACAudioPacket(e.data, e.offset, e.size, e.timestamp, e.rate, e.samplesize, e.sampletype);
					break;
					
				case TAG.VIDEO:
					if (e.codec && e.codec != CODECS.AVC) {
						utils.log('Unsupported video codec(' + e.codec + ').');
						break;
					}
					
					_demuxer.parseAVCVideoPacket(e.data, e.offset, e.size, e.timestamp, e.frametype);
					break;
					
				case TAG.SCRIPT:
					var v = AMF.Decode(e.data, e.offset, e.size);
					utils.log(v.Key + ': ' + JSON.stringify(v.Hash));
					
					if (v.Key == 'onMetaData') {
						_demuxer.setMetaData(v.Hash);
					}
					break;
					
				default:
					utils.log('Skipping unknown tag type ' + e.tag);
			}
		}
		
		function _onMediaInfo(e) {
			_mediainfo = e.info;
			
			_this.addSourceBuffer('audio');
			_this.addSourceBuffer('video');
		}
		
		function _onAVCConfigRecord(e) {
			_remuxer.setVideoMeta(e.data);
			_remuxer.getInitSegment(e.data);
		}
		
		function _onAVCSample(e) {
			_remuxer.getVideoSegment(e.data);
		}
		
		function _onAACSpecificConfig(e) {
			_remuxer.setAudioMeta(e.data);
			_remuxer.getInitSegment(e.data);
		}
		
		function _onAACSample(e) {
			_remuxer.getAudioSegment(e.data);
		}
		
		function _onEndOfStream(e) {
			_endOfStream = true;
		}
		
		function _onDemuxerError(e) {
			utils.log(e.message);
			_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'Demuxer error ocurred.' });
		}
		
		/**
		 * Remuxer
		 */
		function _onMP4InitSegment(e) {
			/*if (e.tp == 'video') {
				_fileindex++
				_filekeeper.append(e.data);
				//_filekeeper.save('sample.' + e.tp + '.init.mp4');
			}*/
			
			_segments[e.tp].push(e.data);
		}
		
		function _onMP4Segment(e) {
			/*if (e.tp == 'video') {
				_fileindex++
				_filekeeper.append(e.data);
				//_filekeeper.save('sample.' + e.tp + '.' + (_fileindex++) + '.m4s');
				if (_fileindex == 300) {
					_filekeeper.save('sample.flv.mp4');
				}
			}*/
			
			e.data.info = e.info;
			
			_segments[e.tp].push(e.data);
			_this.appendSegment(e.tp);
		}
		
		function _onRemuxerError(e) {
			utils.log(e.message);
			_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'Remuxer error ocurred.' });
		}
		
		/**
		 * MSE
		 */
		_this.addSourceBuffer = function(type) {
			var mimetype = type + '/mp4; codecs="' + _mediainfo[type + 'Codec'] + '"';
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
			
			var sb;
			try {
				sb = _sb[type] = _ms.addSourceBuffer(mimetype);
			} catch (err) {
				utils.log('Failed to addSourceBuffer for ' + type + ', mimeType: ' + mimetype + '.');
				return;
			}
			
			sb.type = type;
			sb.addEventListener('updateend', _onUpdateEnd);
			sb.addEventListener('error', _onSourceBufferError);
		};
		
		_this.appendSegment = function(type) {
			if (_segments[type].length == 0) {
				return;
			}
			
			var sb = _sb[type];
			if (!sb || sb.updating) {
				return;
			}
			
			var seg = _segments[type].shift();
			try {
				sb.appendBuffer(seg);
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
			
			var type = e.target.type;
			
			if (_endOfStream) {
				if (!_ms || _ms.readyState !== 'open') {
					return;
				}
				
				if (!_segments.audio.length && !_segments.video.length) {
					//_filekeeper.save('sample.flv.mp4');
					_ms.endOfStream();
					return;
				}
			}
			
			_this.appendSegment(type);
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
			
			if (_this.config.mode == rendermodes.VOD && _loader && _loader.state() == readystates.DONE) {
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
	
	renders.flv.isSupported = function(file, mode) {
		var protocol = utils.getProtocol(file);
		if (protocol != 'http' && protocol != 'https'
				&& protocol != 'ws' && protocol != 'wss') {
			return false;
		}
		
		if (utils.isMSIE('(8|9|10)') || utils.isIETrident() || utils.isSogou() || utils.isIOS() || utils.isQQBrowser() 
				|| utils.isAndroid('[0-4]\\.\\d') || utils.isAndroid('[5-8]\\.\\d') && utils.isChrome('([1-4]?\\d|5[0-5])\\.\\d') || mode == rendermodes.LIVE && !fetch) {
			return false;
		}
		
		var extension = utils.getExtension(file);
		if (extension != 'flv' && extension != undefined) {
			return false;
		}
		
		return true;
	};
})(playease);
