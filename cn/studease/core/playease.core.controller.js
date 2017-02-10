(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		muxer = playease.muxer,
		states = core.states,
		
		AMF = muxer.AMF,
		TAG = muxer.flv.TAG,
		FORMATS = muxer.flv.FORMATS,
		CODECS = muxer.flv.CODECS;
	
	core.controller = function(model, view) {
		var _this = utils.extend(this, new events.eventdispatcher('core.controller')),
			_ready = false,
			_loader,
			_demuxer,
			_remuxer;
		
		function _init() {
			model.addEventListener(events.PLAYEASE_STATE, _modelStateHandler);
			
			view.addEventListener(events.PLAYEASE_READY, _onReady);
			view.addEventListener(events.PLAYEASE_VIEW_PLAY, _onPlay);
			view.addEventListener(events.PLAYEASE_VIEW_PAUSE, _onPause);
			view.addEventListener(events.PLAYEASE_VIEW_SEEK, _onSeek);
			view.addEventListener(events.PLAYEASE_VIEW_STOP, _onStop);
			view.addEventListener(events.PLAYEASE_VIEW_VOLUNE, _onVolume);
			view.addEventListener(events.PLAYEASE_VIEW_FULLSCREEN, _onFullscreen);
			view.addEventListener(events.PLAYEASE_SETUP_ERROR, _onSetupError);
			view.addEventListener(events.PLAYEASE_RENDER_ERROR, _onRenderError);
			
			var loaderconfig = {};
			if (model.config.cors) {
				loaderconfig.mode = model.config.cors;
			}
			
			_loader = new utils.loader(loaderconfig);
			_loader.addEventListener(events.PLAYEASE_CONTENT_LENGTH, _onContenLength);
			_loader.addEventListener(events.PLAYEASE_PROGRESS, _onLoaderProgress);
			_loader.addEventListener(events.PLAYEASE_COMPLETE, _onLoaderComplete);
			_loader.addEventListener(events.ERROR, _onLoaderError);
			
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
		
		_this.play = function() {
			_loader.load(model.url);
		};
		
		function _onContenLength(e) {
			utils.log('onContenLength ' + e.length);
		}
		
		function _onLoaderProgress(e) {
			utils.log('onLoaderProgress ' + e.data.byteLength);
			_demuxer.parse(e.data);
		}
		
		function _onLoaderComplete(e) {
			utils.log('onLoaderComplete');
		}
		
		function _onLoaderError(e) {
			utils.log(e.message);
		}
		
		function _onFLVTag(e) {
			utils.log('onFlvTag { tag: ' + e.tag + ', offset: ' + e.offset + ', size: ' + e.size + ' }');
			
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
					var data = AMF.parse(e.data, e.offset, e.size);
					utils.log(data.key + ': ' + JSON.stringify(data.value));
					
					if (data.key == 'onMetaData') {
						_demuxer.setMetaData(data.value);
					}
					break;
				default:
					utils.log('Skipping unknown tag type ' + e.tag);
			}
		}
		
		function _onMediaInfo(e) {
			view.setMediaInfo(e.info);
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
			view.endOfStream();
		}
		
		function _onDemuxerError(e) {
			utils.log(e.message);
		}
		
		function _onMP4InitSegment(e) {
			view.appendInitSegment(e.tp, e.data);
		}
		
		function _onMP4Segment(e) {
			view.appendSegment(e.tp, e.data);
		}
		
		function _onRemuxerError(e) {
			utils.log(e.message);
		}
		
		_this.pause = function() {
			
		};
		
		_this.seek = function(time) {
			
		};
		
		_this.stop = function() {
			
		};
		
		_this.volume = function(vol) {
			
		};
		
		_this.mute = function(bool) {
			bool = !!bool;
		};
		
		_this.fullscreen = function(esc) {
			
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
				_ready = true;
				_forward(e);
				
				if (model.autoplay) {
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
