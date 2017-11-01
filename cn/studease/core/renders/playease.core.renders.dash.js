(function(playease) {
	var utils = playease.utils,
		css = utils.css,
		//filekeeper = utils.filekeeper,
		events = playease.events,
		matchers = utils.matchers,
		io = playease.io,
		responseTypes = io.responseTypes,
		readystates = io.readystates,
		priority = io.priority,
		muxer = playease.muxer,
		core = playease.core,
		states = core.states,
		renders = core.renders,
		rendertypes = renders.types,
		rendermodes = renders.modes,
		
		fragmentTypes = {
			INIT_SEGMENT: 0,
			SEGMENT:      1
		},
		
		request = function(type) {
			var _this = this;
			
			function _init() {
				_this.type = type;
				_this.reset();
			}
			
			_this.reset = function() {
				_this.fragmentType = fragmentTypes.INIT_SEGMENT;
				_this.mimeType = type + '/mp4';
				_this.codecs = type == 'video' ? 'avc1.64001E' : 'mp4a.40.2';
				_this.index = NaN;
				_this.start = 0;
				_this.duration = NaN;
				_this.timescale = 1;
				_this.url = '';
			};
			
			_init();
		};
	
	renders.dash = function(layer, config) {
		var _this = utils.extend(this, new events.eventdispatcher('renders.dash')),
			_defaults = {
				videoOff: false
			},
			_video,
			_url,
			_src,
			_loader,
			_audioloader,
			_videoloader,
			_timer,
			_parser,
			_manifest,
			_range,
			_contentLength,
			_ms,
			_sb,
			_mpd,
			_segments,
			//_fileindex,
			//_filekeeper,
			_waiting,
			_endOfStream = false;
		
		function _init() {
			_this.name = rendertypes.DASH;
			
			_this.config = utils.extend({}, _defaults, config);
			
			_url = '';
			_src = '';
			_contentLength = 0;
			_waiting = true;
			
			_range = { start: 0, end: _this.config.mode == rendermodes.VOD ? 64 * 1024 * 1024 - 1 : '' };
			
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
			_initMSE();
		}
		
		function _initLoader() {
			if (_loader && _videoloader && _audioloader) {
				return;
			}
			
			var name = 'xhr-chunked-loader';
			
			try {
				_loader = new io[name](_this.config.loader);
				_loader.addEventListener(events.PLAYEASE_CONTENT_LENGTH, _onContenLength);
				_loader.addEventListener(events.PLAYEASE_PROGRESS, _onLoaderProgress);
				_loader.addEventListener(events.PLAYEASE_COMPLETE, _onLoaderComplete);
				_loader.addEventListener(events.ERROR, _onLoaderError);
				
				utils.log('"' + name + '" for MPD files initialized.');
			} catch (err) {
				utils.log('Failed to init loader "' + name + '" for MPD files!');
				_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'No supported loader found.' });
				return;
			}
			
			try {
				_audioloader = new io[name](utils.extend({}, _this.config.loader, { responseType: responseTypes.ARRAYBUFFER }));
				_audioloader.addEventListener(events.PLAYEASE_CONTENT_LENGTH, _onContenLength);
				_audioloader.addEventListener(events.PLAYEASE_PROGRESS, _onLoaderProgress);
				_audioloader.addEventListener(events.PLAYEASE_COMPLETE, _onLoaderComplete);
				_audioloader.addEventListener(events.ERROR, _onLoaderError);
				_audioloader.request = new request('audio');
				
				utils.log('"' + name + '" for audio segments initialized.');
			} catch (err) {
				utils.log('Failed to init loader "' + name + '" audio segments!');
				_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'No supported loader found.' });
				return;
			}
			
			try {
				_videoloader = new io[name](utils.extend({}, _this.config.loader, { responseType: responseTypes.ARRAYBUFFER }));
				_videoloader.addEventListener(events.PLAYEASE_CONTENT_LENGTH, _onContenLength);
				_videoloader.addEventListener(events.PLAYEASE_PROGRESS, _onLoaderProgress);
				_videoloader.addEventListener(events.PLAYEASE_COMPLETE, _onLoaderComplete);
				_videoloader.addEventListener(events.ERROR, _onLoaderError);
				_videoloader.request = new request('video');
				
				utils.log('"' + name + '" for video segments initialized.');
			} catch (err) {
				utils.log('Failed to init loader "' + name + '" video segments!');
				_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'No supported loader found.' });
				return;
			}
		}
		
		function _initParser() {
			if (!_parser) {
				_parser = new utils.xml2json({
					matchers: [
						new matchers.duration(),
						new matchers.datetime(),
						new matchers.numeric(),
						new matchers.string()
					]
				});
			}
		}
		
		function _initManifest() {
			if (!_manifest) {
				_manifest = new utils.manifest(_url);
			}
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
					if (!renders.dash.isSupported(url)) {
						_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'Resource not supported by render "' + _this.name + '".' });
						return;
					}
					
					_url = url;
				}
				
				_waiting = true;
				
				_segments.audio = [];
				_segments.video = [];
				
				_initLoader();
				_audioloader.request.reset();
				_videoloader.request.reset();
				
				_stopTimer();
				
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
			} else {
				_video.currentTime = offset * _video.duration / 100;
				
				var promise = _video.play();
				if (promise) {
					promise['catch'](function(e) { /* void */ });
				}
			}
			
			_video.controls = false;
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
			
			_segments.audio = [];
			_segments.video = [];
			
			if (_loader) {
				_loader.abort();
			}
			if (_audioloader) {
				_audioloader.abort();
				_audioloader.request.reset();
			}
			if (_videoloader) {
				_videoloader.abort();
				_videoloader.request.reset();
			}
			
			_stopTimer();
			
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
		
		_this.videoOff = function(off, playing) {
			_this.config.videoOff = off;
			
			if (playing) {
				if (off) {
					try {
						_ms.removeSourceBuffer(_sb.video);
						
						var mimetype = _videoloader.request.mimeType + '; codecs="' + _videoloader.request.codecs + '"';
						utils.log('Removed SourceBuffer(video), mimeType: ' + mimetype + '.');
					} catch (err) {
						utils.log('Failed to removeSourceBuffer(video): ' + err.toString());
					}
				} else {
					_this.reload();
				}
			}
		};
		
		_this.hd = function(index) {
			
		};
		
		/**
		 * Loader
		 */
		function _onContenLength(e) {
			var request = e.target.request;
			if (request) {
				if (_mpd['@profiles'] == 'urn:mpeg:dash:profile:isoff-on-demand:2011') {
					utils.log('onContenLength: ' + e.length);
					_contentLength += e.length;
				}
			}
		}
		
		function _onLoaderProgress(e) {
			var request = e.target.request;
			if (request) {
				if (request.fragmentType == fragmentTypes.INIT_SEGMENT) {
					request.fragmentType = fragmentTypes.SEGMENT;
				} else {
					request.index++;
					request.start += request.duration;
				}
				
				e.data.info = e.info;
				_segments[request.type].push(e.data);
				_this.appendSegment(request.type);
				
				_loadSegment(request);
				
				return;
			}
			
			_initParser();
			_initManifest();
			
			_mpd = _parser.parse(e.data);
			_manifest.update(_mpd);
			
			if (_audioloader.request.fragmentType == fragmentTypes.INIT_SEGMENT
					&& _videoloader.request.fragmentType == fragmentTypes.INIT_SEGMENT) {
				_this.addSourceBuffer('audio');
				_this.addSourceBuffer('video');
			}
			
			_loadSegment(_audioloader.request);
			_loadSegment(_videoloader.request);
			
			_startTimer(_mpd['@minimumUpdatePeriod'] * 1000 || 2000);
		}
		
		function _loadManifest() {
			_loader.load(_manifest.getLocation());
		}
		
		function _loadSegment(request) {
			var segmentLoader = request.type == 'audio' ? _audioloader : _videoloader;
			if (segmentLoader.state() != readystates.UNINITIALIZED && segmentLoader.state() != readystates.DONE) {
				return;
			}
			
			if (_this.config.videoOff && request.type == 'video') {
				return;
			}
			
			var segmentInfo = _manifest.getSegmentInfo(request.start, request.type, !request.fragmentType, request.start, request.index, 0);
			if (segmentInfo) {
				utils.extend(request, segmentInfo);
				segmentLoader.load(request.url);
			}
		}
		
		function _onLoaderComplete(e) {
			//utils.log('onLoaderComplete');
		}
		
		function _onLoaderError(e) {
			utils.log(e.message);
			_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: e.message });
		}
		
		function _startTimer(delay) {
			if (!_timer) {
				_timer = new utils.timer(delay, 1);
				_timer.addEventListener(events.PLAYEASE_TIMER, _loadManifest);
			}
			
			_timer.delay = _timer.running() ? Math.min(_timer.delay, delay) : delay;
			
			_timer.reset();
			_timer.start();
		}
		
		function _stopTimer() {
			if (_timer) {
				_timer.stop();
			}
		}
		
		/**
		 * MSE
		 */
		_this.addSourceBuffer = function(type) {
			if (_this.config.videoOff && type == 'video') {
				return;
			}
			
			var request = type == 'audio' ? _audioloader.request : _videoloader.request;
			var mimetype = request.mimeType + '; codecs="' + request.codecs + '"';
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
			
			_loader.load(_url);
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
			
			var ranges = _video.buffered, start, end;
			for (var i = 0; i < ranges.length; i++) {
				start = ranges.start(i);
				end = ranges.end(i);
				if (/*start <= position && */position < end) {
					buffered = duration ? Math.floor(end / _video.duration * 10000) / 100 : 0;
				}
				
				if (i == 0 && position < start) {
					_video.currentTime = start;
				}
			}
			
			if (_waiting && end - position >= _this.config.bufferTime) {
				_waiting = false;
				_this.dispatchEvent(events.PLAYEASE_STATE, { state: states.PLAYING });
			}
			
			if (_mpd['@type'] == 'static' 
					&& _audioloader && _audioloader.state() == readystates.DONE
					&& _videoloader && _videoloader.state() == readystates.DONE) {
				var dts = end * 1000;
				
				if (_segments.video.length) {
					dts = Math.max(dts, _segments.video[_segments.video.length - 1].info.endDts);
				}
				if (_segments.audio.length) {
					dts = Math.max(dts, _segments.audio[_segments.audio.length - 1].info.endDts);
				}
				
				if (dts && dts / 1000 - position < 120 && _range.end < _contentLength - 1) {
					_range.start = _range.end + 1;
					_range.end += 32 * 1024 * 1024;
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
			var duration = e.target.duration;
			if (_mpd && _mpd.hasOwnProperty('@profiles')) {
				var profiles = _mpd['@profiles'];
				if (profiles.indexOf('urn:mpeg:dash:profile:isoff-live:2011') != -1) {
					duration = 0;
				}
			}
			
			_this.dispatchEvent(events.PLAYEASE_DURATION, { duration: duration });
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
	
	renders.dash.isSupported = function(file) {
		var protocol = utils.getProtocol(file);
		if (protocol != 'http' && protocol != 'https') {
			return false;
		}
		
		if (utils.isMSIE('(8|9|10)') || utils.isIETrident() || utils.isSogou() || utils.isIOS() || utils.isQQBrowser() 
				|| utils.isAndroid('[0-4]\\.\\d') || utils.isAndroid('[5-8]\\.\\d') && utils.isChrome('([1-4]?\\d|5[0-5])\\.\\d')) {
			return false;
		}
		
		var extension = utils.getExtension(file);
		if (extension != 'mpd') {
			return false;
		}
		
		return true;
	};
})(playease);
