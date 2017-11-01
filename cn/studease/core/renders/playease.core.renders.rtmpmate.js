(function(playease) {
	var utils = playease.utils,
		css = utils.css,
		//filekeeper = utils.filekeeper,
		events = playease.events,
		CommandEvent = events.CommandEvent,
		NetStatusEvent = events.NetStatusEvent,
		Level = NetStatusEvent.Level,
		Code = NetStatusEvent.Code,
		AudioEvent = events.AudioEvent,
		VideoEvent = events.VideoEvent,
		DataEvent = events.DataEvent,
		AMF = playease.muxer.AMF,
		net = playease.net,
		rtmp = net.rtmp,
		core = playease.core,
		states = core.states,
		renders = core.renders,
		rendertypes = renders.types,
		rendermodes = renders.modes;
	
	renders.rtmpmate = function(layer, config) {
		var _this = utils.extend(this, new events.eventdispatcher('renders.rtmpmate')),
			_defaults = {},
			_video,
			_url,
			_src,
			_range,
			_contentLength,
			_application,
			_streamName,
			_args,
			_connection,
			_stream,
			_metadata,
			_ms,
			_sb,
			_segments,
			//_fileindex,
			//_filekeeper,
			_waiting,
			_endOfStream = false;
		
		function _init() {
			_this.name = rendertypes.RTMPMATE;
			
			_this.config = utils.extend({}, _defaults, config);
			
			_url = '';
			_src = '';
			_contentLength = 0;
			_waiting = true;
			
			_range = { start: 0, end: _this.config.mode == rendermodes.VOD ? 64 * 1024 * 1024 - 1 : '' };
			
			_metadata = {
				audioCodec: 'mp4a.40.2',
				videoCodec: 'avc1.42E01E'
			};
			
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
			_initNetConnection();
			_initNetStream();
			_initMSE();
		}
		
		function _initNetConnection() {
			_connection = new rtmp.netconnection();
			_connection.addEventListener(NetStatusEvent.NET_STATUS, _statusHandler);
			_connection.addEventListener(events.PLAYEASE_SECURITY_ERROR, _onConnectionError);
			_connection.addEventListener(events.PLAYEASE_IO_ERROR, _onConnectionError);
			_connection.client = _this;
		}
		
		function _initNetStream() {
			_stream = new rtmp.netstream(_connection);
			_stream.addEventListener(NetStatusEvent.NET_STATUS, _statusHandler);
			_stream.addEventListener(events.PLAYEASE_MP4_INIT_SEGMENT, _onMP4InitSegment);
			_stream.addEventListener(events.PLAYEASE_MP4_SEGMENT, _onMP4Segment);
			_stream.addEventListener(events.PLAYEASE_IO_ERROR, _onStreamError);
			_stream.client = _this;
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
		
		function _statusHandler(e) {
			utils.log(e.info.code);
			
			switch (e.info.code) {
				case Code.NETCONNECTION_CONNECT_SUCCESS:
					_this.play(_url);
					break;
					
				case Code.NETCONNECTION_CONNECT_CLOSED:
				case Code.NETSTREAM_FAILED:
				case Code.NETSTREAM_PLAY_FAILED:
				case Code.NETSTREAM_PLAY_FILESTRUCTUREINVALID:
				case Code.NETSTREAM_PLAY_STOP:
				case Code.NETSTREAM_PLAY_STREAMNOTFOUND:
				case Code.NETSTREAM_PLAY_UNPUBLISHNOTIFY:
				case Code.NETSTREAM_SEEK_FAILED:
					_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: e.info.code });
					break;
			}
		}
		
		function _onConnectionError(e) {
			utils.log(e.message);
			_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'NetConnection error ocurred.' });
		}
		
		function _onStreamError(e) {
			utils.log(e.message);
			_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'NetStream error ocurred.' });
		}
		
		_this.play = function(url) {
			if (!_video.src || _video.src !== _src || url && url != _url) {
				if (url && url != _url) {
					if (!renders.wss.isSupported(url)) {
						_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'Resource not supported by render "' + _this.name + '".' });
						return;
					}
					
					_url = url;
				}
				
				if (!_connection.connected()) {
					var arr = _url.match(rtmp.URLRe);
					if (arr && arr.length > 4) {
						_application = arr[1];
						_streamName = arr[arr.length - 2];
						_args = arr[arr.length - 1];
					} else {
						utils.log('Failed to match rtmp URL: ' + _url);
						_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'Bad URL format!' });
						return;
					}
					
					utils.log('Connecting to ' + _application + ' ...');
					_connection.connect(_application);
					
					return;
				}
				
				if (_stream) {
					//_stream.close();
				}
				
				_waiting = true;
				
				_segments.audio = [];
				_segments.video = [];
				
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
				if (_stream) {
					_stream.seek(offset * _video.duration / 100);
				}
				
				var promise = _video.play();
				if (promise) {
					promise['catch'](function(e) { /* void */ });
				}
			}
			
			_video.controls = false;
		};
		
		_this.stop = function() {
			if (_stream) {
				_stream.dispose();
			}
			_connection.close();
			
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
		
		
		_this.onMetaData = function(data) {
			_metadata = data;
			
			_this.addSourceBuffer('audio');
			_this.addSourceBuffer('video');
		};
		
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
				if (_fileindex == 500) {
					_filekeeper.save('sample.wss.normal.mp4');
				}
			}*/
			
			e.data.info = e.info;
			
			_segments[e.tp].push(e.data);
			_this.appendSegment(e.tp);
		}
		
		/**
		 * MSE
		 */
		_this.addSourceBuffer = function(type) {
			var mimetype = type + '/mp4; codecs="' + _metadata[type + 'Codec'] + '"';
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
			utils.log('Playing ' + _streamName + ' ...');
			
			// TODO: addSourceBuffer while metadata reached.
			_this.addSourceBuffer('audio');
			_this.addSourceBuffer('video');
			
			_stream.play(_streamName);
		}
		
		function _onUpdateEnd(e) {
			//utils.log('update end');
			
			var type = e.target.type;
			
			if (_endOfStream) {
				if (!_ms || _ms.readyState !== 'open') {
					return;
				}
				
				if (!_segments.audio.length && !_segments.video.length) {
					//_filekeeper.save('sample.wss.mp4');
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
	
	renders.rtmpmate.isSupported = function(file) {
		var protocol = utils.getProtocol(file);
		if (protocol != 'ws' && protocol != 'wss') {
			return false;
		}
		
		if (utils.isMSIE('(8|9|10)') || utils.isIETrident() || utils.isSogou() || utils.isIOS() || utils.isQQBrowser()
				|| utils.isAndroid('[0-4]\\.\\d') || utils.isAndroid('[5-8]\\.\\d') && utils.isChrome('([1-4]?\\d|5[0-5])\\.\\d')) {
			return false;
		}
		
		var map = [
			undefined, '', // live stream
			'mp4', 'm4s'
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
