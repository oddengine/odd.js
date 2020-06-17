(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		muxer = playease.muxer,
		SPS = muxer.SPS,
		
		TAG = {
			AUDIO:  0x08,
			VIDEO:  0x09,
			SCRIPT: 0x12
		},
		FORMATS = {
			LINEAR_PCM_PLATFORM_ENDIAN:   0x0,
			ADPCM:                        0x1,
			MP3:                          0x2,
			LINEAR_PCM_LITTLE_ENDIAN:     0x3,
			NELLYMOSER_16_kHz_MONO:       0x4,
			NELLYMOSER_8_kHz_MONO:        0x5,
			NELLYMOSER:                   0x6,
			G_711_A_LAW_LOGARITHMIC_PCM:  0x7,
			G_711_MU_LAW_LOGARITHMIC_PCM: 0x8,
			RESERVED:                     0x9,
			AAC:                          0xA,
			SPEEX:                        0xB,
			MP3_8_kHz:                    0xE,
			DEVICE_SPECIFIC_SOUND:        0xF
		},
		FRAMES = {
			KEYFRAME:               0x1,
			INTER_FRAME:            0x2,
			DISPOSABLE_INTER_FRAME: 0x3,
			GENERATED_KEYFRAME:     0x4,
			INFO_OR_COMMAND_FRAME:  0x5
		},
		CODECS = {
			JPEG:           0x1,
			H263:           0x2,
			SCREEN_VIDEO:   0x3,
			VP6:            0x4,
			VP6_ALPHA:      0x5,
			SCREEN_VIDEO_2: 0x6,
			AVC:            0x7
		},
		AVC = {
			types: {
				SEQUENCE_HEADER: 0x00,
				NALU:            0x01,
				END_OF_SEQUENCE: 0x02
			}
		},
		AAC = {
			types: {
				SPECIFIC_CONFIG: 0x00,
				RAW_FRAME_DATA:  0x01
			},
			audioObjectTypes: {
				NULL:          0x00,
				AAC_MAIN:      0x01,
				AAC_LC:        0x02,
				AAC_SSR:       0x03, // Scalable Sample Rate
				AAC_LTP:       0x04, // Long Term Prediction
				AAC_HE_OR_SBR: 0x05, // Spectral Band Replication
				AAC_SCALABLE:  0x06
			},
			samplingRates: [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350],
			silentFrames: [
				new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x23, 0x80]),
				new Uint8Array([0x21, 0x00, 0x49, 0x90, 0x02, 0x19, 0x00, 0x23, 0x80]),
				new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x8e]),
				new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x80, 0x2c, 0x80, 0x08, 0x02, 0x38]),
				new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x38]),
				new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x00, 0xb2, 0x00, 0x20, 0x08, 0xe0])
			]
		},
		rates = [5500, 11025, 22050, 44100];
	
	var mediainfo = function() {
		var _this = this,
			_defaults = {};
		
		function _init() {
			_this.mimeType = null;
			_this.duration = null;
			
			_this.hasAudio = null;
			_this.hasVideo = null;
			_this.audioCodec = null;
			_this.videoCodec = null;
			_this.audioDataRate = null;
			_this.videoDataRate = null;
			
			_this.audioSampleRate = null;
			_this.audioChannelCount = null;
			
			_this.width = null;
			_this.height = null;
			_this.fps = null;
			_this.profile = null;
			_this.level = null;
			_this.chromaFormat = null;
			_this.sarNum = null;
			_this.sarDen = null;
			
			_this.metadata = null;
			_this.segments = null;  // MediaInfo[]
			_this.segmentCount = null;
			_this.hasKeyframesIndex = null;
			_this.keyframesIndex = null;
		}
		
		_this.isComplete = function() {
			var audioInfoComplete = (_this.hasAudio === false)
					|| (_this.hasAudio === true && _this.audioCodec != null && _this.audioSampleRate != null && _this.audioChannelCount != null);
			
			var videoInfoComplete = (_this.hasVideo === false)
					|| (_this.hasVideo === true && _this.videoCodec != null && _this.width != null && _this.height != null && _this.fps != null
					&& _this.profile != null && _this.level != null && _this.chromaFormat != null && _this.sarNum != null && _this.sarDen != null);
			
			// keyframesIndex may not be present
			return _this.mimeType != null && _this.duration != null && _this.metadata != null && _this.hasKeyframesIndex != null
					&& audioInfoComplete && videoInfoComplete;
		};
		
		_this.isSeekable = function() {
			return _this.hasKeyframesIndex === true;
		};
		
		_this.getNearestKeyframe = function(time, fileposition) {
			var table = _this.keyframesIndex;
			if (table == null) {
				return null;
			}
			
			var keyframeIndex;
			if (fileposition) {
				keyframeIndex = _search(table.filepositions, fileposition);
			} else {
				keyframeIndex = _search(table.times, time);
			}
			
			return {
				index: keyframeIndex,
				time: table.times[keyframeIndex],
				fileposition: table.filepositions[keyframeIndex]
			};
		};
		
		function _search(list, value) {
			var index = 0;
			var last = list.length - 1;
			var mid = 0;
			var lbound = 0;
			var ubound = last;
			
			if (value < list[0]) {
				return 0;
			}
			
			while (lbound <= ubound) {
				mid = lbound + Math.floor((ubound - lbound) / 2);
				if (mid === last || (value >= list[mid] && value < list[mid + 1])) {
					index = mid;
					break;
				} else if (list[mid] < value) {
					lbound = mid + 1;
				} else {
					ubound = mid - 1;
				}
			}
			
			return index;
		}
	};
	
	
	muxer.flv = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('muxer.flv')),
			_defaults = {},
			_offset,
			_length,
			_state,
			_hasAudio,
			_hasVideo,
			_cache,
			_mediainfo,
			_metadata,
			_lastAudioDts,
			_referenceFrameRate,
			_videoTrack,
			_audioTrack,
			_lengthSizeMinusOne,
			_timestampBase;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_offset = 0;
			_length = 0;
			
			_state = 16; // sw_f
			_cache = {
				type:      0x00,
				size:      0,
				timestamp: 0,
				streamId:  0,
				data:      undefined,
				pointer:   0
			};
			
			_mediainfo = new mediainfo();
			_metadata = {};
			_lastAudioDts = 0;
			
			_referenceFrameRate = {
				fixed: true,
				fps: 23.976,
				fps_num: 23976,
				fps_den: 1000
			};
			
			_videoTrack = { type: 'video', id: 1, sequenceNumber: 0, samples: [], length: 0 };
			_audioTrack = { type: 'audio', id: 2, sequenceNumber: 0, samples: [], length: 0 };
			
			_lengthSizeMinusOne = 0;
			_timestampBase = 0;
		}
		
		_this.reset = function(seeking) {
			_offset = 0;
			_length = 0;
			
			_state = seeking ? 0 : 16; // sw_type, sw_f
			_cache = {
				type:      0x00,
				size:      0,
				timestamp: 0,
				streamId:  0,
				data:      undefined,
				pointer:   0
			};
			
			_mediainfo = new mediainfo();
			_metadata = {};
			
			_referenceFrameRate = {
				fixed: true,
				fps: 23.976,
				fps_num: 23976,
				fps_den: 1000
			};
			
			_videoTrack = { type: 'video', id: 1, sequenceNumber: 0, samples: [], length: 0 };
			_audioTrack = { type: 'audio', id: 2, sequenceNumber: 0, samples: [], length: 0 };
			
			_lengthSizeMinusOne = 0;
			_timestampBase = 0;
		};
		
		_this.parse = function(buf) {
			var sw_type        = 0,
			    sw_size_0      = 1,
			    sw_size_1      = 2,
			    sw_size_2      = 3,
			    sw_timestamp_0 = 4,
			    sw_timestamp_1 = 5,
			    sw_timestamp_2 = 6,
			    sw_timestamp_3 = 7,
			    sw_stream_id_0 = 8,
			    sw_stream_id_1 = 9,
			    sw_stream_id_2 = 10,
			    sw_data        = 11,
			    sw_pointer_0   = 12,
			    sw_pointer_1   = 13,
			    sw_pointer_2   = 14,
			    sw_pointer_3   = 15,
			    sw_f           = 16,
			    sw_l           = 17,
			    sw_v           = 18,
			    sw_version     = 19,
			    sw_flags       = 20,
			    sw_header_0    = 21,
			    sw_header_1    = 22,
			    sw_header_2    = 23,
			    sw_header_3    = 24;
			
			var v = new Uint8Array(buf);
			
			for (var i = 0; i < v.byteLength; i++) {
				switch (_state) {
				case sw_type:
					_cache.type = v[i];
					_state = sw_size_0;
					break;
					
				case sw_size_0:
					_cache.size = v[i] << 16;
					_state = sw_size_1;
					break;
					
				case sw_size_1:
					_cache.size |= v[i] << 8;
					_state = sw_size_2;
					break;
					
				case sw_size_2:
					_cache.size |= v[i];
					_cache.data = new Uint8Array(_cache.size);
					_cache.data.position = 0;
					_state = sw_timestamp_0;
					break;
					
				case sw_timestamp_0:
					_cache.timestamp = v[i] << 16;
					_state = sw_timestamp_1;
					break;
					
				case sw_timestamp_1:
					_cache.timestamp |= v[i] << 8;
					_state = sw_timestamp_2;
					break;
					
				case sw_timestamp_2:
					_cache.timestamp |= v[i];
					_state = sw_timestamp_3;
					break;
					
				case sw_timestamp_3:
					_cache.timestamp |= v[i] << 24;
					_state = sw_stream_id_0;
					break;
					
				case sw_stream_id_0:
					_cache.streamId = v[i] << 16;
					_state = sw_stream_id_1;
					break;
					
				case sw_stream_id_1:
					_cache.streamId |= v[i] << 8;
					_state = sw_stream_id_2;
					break;
					
				case sw_stream_id_2:
					_cache.streamId |= v[i];
					_state = sw_data;
					break;
					
				case sw_data:
					var n = Math.min(_cache.data.byteLength - _cache.data.position, v.byteLength - i);
					_cache.data.set(v.subarray(i, i + n), _cache.data.position);
					_cache.data.position += n;
					
					i += n - 1;
					
					if (_cache.data.position == _cache.data.byteLength) {
						_state = sw_pointer_0;
						
						var e = {
							tag:       _cache.type,
							size:      _cache.size,
							timestamp: _cache.timestamp,
							streamId:  _cache.streamId,
							data:      _cache.data.buffer,
							offset:    0
						};
						
						switch (_cache.type) {
							case TAG.AUDIO:
								e.format = _cache.data[0] >> 4;
								e.rate = rates[(_cache.data[0] & 0x0C) >> 2];
								e.samplesize = (_cache.data[0] & 0x02) >> 1;
								e.sampletype = _cache.data[0] & 0x01;
								break;
								
							case TAG.VIDEO:
								e.frametype = _cache.data[0] >> 4;
								e.codec = _cache.data[0] & 0x0F;
								break;
						}
						
						_this.dispatchEvent(events.PLAYEASE_FLV_TAG, e);
					}
					break;
					
				case sw_pointer_0:
					_cache.pointer = v[i] << 24;
					_state = sw_pointer_1;
					break;
					
				case sw_pointer_1:
					_cache.pointer |= v[i] << 16;
					_state = sw_pointer_2;
					break;
					
				case sw_pointer_2:
					_cache.pointer |= v[i] << 8;
					_state = sw_pointer_3;
					break;
					
				case sw_pointer_3:
					_cache.pointer |= v[i];
					_state = sw_type;
					break;
					
				case sw_f:
					if (v[i] != 0x46) {
						_this.dispatchEvent(events.ERROR, { message: 'Not \"F\"' });
						return;
					}
					_state = sw_l;
					break;
					
				case sw_l:
					if (v[i] != 0x4C) {
						_this.dispatchEvent(events.ERROR, { message: 'Not \"L\"' });
						return;
					}
					_state = sw_v;
					break;
					
				case sw_v:
					if (v[i] != 0x56) {
						_this.dispatchEvent(events.ERROR, { message: 'Not \"V\"' });
						return;
					}
					_state = sw_version;
					break;
					
				case sw_version:
					if (v[i] != 0x01) {
						// Not strict
					}
					_state = sw_flags;
					break;
					
				case sw_flags:
					_hasAudio = !!((v[i] & 0x04) >> 2);
					_hasVideo = !!(v[i] & 0x01);
					if (!_hasAudio && !_hasVideo) {
						// Not strict
					}
					_state = sw_header_0;
					break;
					
				case sw_header_0:
					_state = sw_header_1;
					break;
					
				case sw_header_1:
					_state = sw_header_2;
					break;
					
				case sw_header_2:
					_state = sw_header_3;
					break;
					
				case sw_header_3:
					_state = sw_pointer_0;
					break;
					
				default:
					_this.dispatchEvent(events.ERROR, { message: 'Unknown state while parsing tag.' });
					return;
				}
			}
		};
		
		_this.parseAVCVideoPacket = function(arrayBuffer, dataOffset, dataSize, timestamp, frameType) {
			if (dataSize < 5) {
				_this.dispatchEvent(events.ERROR, { message: 'Data not enough while parsing AVC video packet.' });
				return;
			}
			
			var v = new DataView(arrayBuffer, dataOffset, dataSize);
			
			var pos = 1; // skip frametype & codec
			var type = v.getUint8(pos++);
			var cts = v.getUint8(pos++) << 16 | v.getUint8(pos++) << 8 | v.getUint8(pos++); // CompositionTime
			
			switch (type) {
				case AVC.types.SEQUENCE_HEADER:
					_parseAVCDecoderConfigurationRecord(arrayBuffer, dataOffset + pos, dataSize - pos);
					break;
				case AVC.types.NALU:
					_parseAVCVideoData(arrayBuffer, dataOffset + pos, dataSize - pos, timestamp, frameType, cts);
					break;
				case AVC.types.END_OF_SEQUENCE:
					_this.dispatchEvent(events.PLAYEASE_END_OF_STREAM);
					break;
				default:
					_this.dispatchEvent(events.ERROR, { message: 'Unknown AVC video packet type ' + type + '.' });
			}
		};
		
		function _parseAVCDecoderConfigurationRecord(arrayBuffer, dataOffset, dataSize) {
			if (dataSize < 7) {
				_this.dispatchEvent(events.ERROR, { message: 'Data not enough while parsing AVC decoder configuration record.' });
				return;
			}
			
			var track = _videoTrack;
			var videometa = {
				type: track.type,
				id: track.id,
				timescale: 1000,
				duration: _metadata.duration * 1000 || 0
			};
			
			var v = new DataView(arrayBuffer, dataOffset, dataSize);
			
			var pos = 0;
			var configurationVersion = v.getUint8(pos++);
			var AVCProfileIndication = v.getUint8(pos++);
			var profileCompatibility = v.getUint8(pos++);
			var AVCLevelIndication = v.getUint8(pos++);
			
			if (configurationVersion != 1 || AVCProfileIndication == 0) {
				_this.dispatchEvent(events.ERROR, { message: 'Invalid AVCDecoderConfigurationRecord.' });
				return;
			}
			
			_lengthSizeMinusOne = 1 + (v.getUint8(pos++) & 0x03);
			if (_lengthSizeMinusOne != 3 && _lengthSizeMinusOne != 4) {
				_this.dispatchEvent(events.ERROR, { message: 'Invalid lengthSizeMinusOne ' + _lengthSizeMinusOne + '.' });
				return;
			}
			
			var numOfSequenceParameterSets = v.getUint8(pos++) & 0x1F;
			for (var i = 0; i < numOfSequenceParameterSets; i++) {
				var sequenceParameterSetLength = v.getUint16(pos);
				pos += 2;
				
				if (sequenceParameterSetLength == 0) {
					continue;
				}
				
				var sps = new Uint8Array(arrayBuffer, dataOffset + pos, sequenceParameterSetLength);
				pos += sequenceParameterSetLength;
				
				var spsinfo = SPS.parse(sps);
				_copySPSInfo(videometa, spsinfo, sps);
				_copyVideoInfo(videometa, spsinfo);
			}
			
			var numOfPictureParameterSets = v.getUint8(pos++);
			for (var i = 0; i < numOfPictureParameterSets; i++) {
				var pictureParameterSetLength = v.getUint16(pos);
				pos += 2;
				
				if (pictureParameterSetLength == 0) {
					continue;
				}
				
				var pps = new Uint8Array(arrayBuffer, dataOffset + pos, pictureParameterSetLength);
				pos += pictureParameterSetLength;
			}
			
			videometa.avcc = new Uint8Array(dataSize);
			videometa.avcc.set(new Uint8Array(arrayBuffer, dataOffset, dataSize), 0);
			
			_this.dispatchEvent(events.PLAYEASE_AVC_CONFIG_RECORD, { data: videometa });
		}
		
		function _copySPSInfo(videometa, info, sps) {
			videometa.codecWidth = info.codec_size.width;
			videometa.codecHeight = info.codec_size.height;
			videometa.presentWidth = info.present_size.width;
			videometa.presentHeight = info.present_size.height;
			
			videometa.profile = info.profile_string;
			videometa.level = info.level_string;
			videometa.bitDepth = info.bit_depth;
			videometa.chromaFormat = info.chroma_format;
			videometa.sarRatio = info.sar_ratio;
			videometa.frameRate = info.frame_rate;
			
			if (info.frame_rate.fixed === false || info.frame_rate.fps_num === 0 || info.frame_rate.fps_den === 0) {
				videometa.frameRate = _referenceFrameRate;
			}
			
			var fps_den = videometa.frameRate.fps_den;
			var fps_num = videometa.frameRate.fps_num;
			videometa.refSampleDuration = Math.floor(videometa.timescale * (fps_den / fps_num));
			
			var codecArray = sps.subarray(1, 4);
			var codecString = 'avc1.';
			for (var j = 0; j < 3; j++) {
				var h = codecArray[j].toString(16);
				if (h.length < 2) {
					h = '0' + h;
				}
				
				codecString += h;
			}
			
			videometa.codec = codecString;
		}
		
		function _copyVideoInfo(metadata, info) {
			_mediainfo.hasAudio = _hasAudio;
			_mediainfo.hasVideo = _hasVideo;
			_mediainfo.duration = _metadata.duration * 1000;
			_mediainfo.metadata = _metadata;
			
			_mediainfo.width = metadata.codecWidth;
			_mediainfo.height = metadata.codecHeight;
			_mediainfo.fps = metadata.frameRate.fps;
			_mediainfo.profile = metadata.profile;
			_mediainfo.level = metadata.level;
			_mediainfo.chromaFormat = info.chroma_format_string;
			_mediainfo.sarNum = metadata.sarRatio.width;
			_mediainfo.sarDen = metadata.sarRatio.height;
			_mediainfo.videoCodec = metadata.codec;
			
			_mediainfo.mimeType = 'video/mp4; codecs="' + _mediainfo.videoCodec
					+ (_mediainfo.hasAudio && _mediainfo.audioCodec ? ',' + _mediainfo.audioCodec : '') + '"';
			
			//if (_mediainfo.isComplete()) {
				_this.dispatchEvent(events.PLAYEASE_MEDIA_INFO, { info: _mediainfo });
			//}
		}
		
		function _parseAVCVideoData(arrayBuffer, dataOffset, dataSize, timestamp, frameType, cts) {
			var v = new DataView(arrayBuffer, dataOffset, dataSize);
			
			var units = [];
			var dts = _timestampBase + timestamp;
			var keyframe = frameType == FRAMES.KEYFRAME;
			
			var pos = 0, length = 0;
			while (pos < dataSize) {
				if (pos + 4 >= dataSize) {
					_this.dispatchEvent(events.ERROR, { message: 'Data not enough for next NALU.' });
					return;
				}
				
				var nalusize = v.getUint32(pos);
				if (nalusize == 3) {
					nalusize >>>= 8;
				}
				
				if (nalusize > dataSize - _lengthSizeMinusOne) {
					utils.log('Malformed Nalus near timestamp ' + dts + '.');
					return;
				}
				
				var unitType = v.getUint8(pos + _lengthSizeMinusOne) & 0x1F;
				if (unitType == FRAMES.INFO_OR_COMMAND_FRAME) {
					keyframe = true;
				}
				
				var data = new Uint8Array(arrayBuffer, dataOffset + pos, _lengthSizeMinusOne + nalusize);
				length += data.byteLength;
				
				var unit = { type: unitType, data: data };
				units.push(unit);
				
				pos += _lengthSizeMinusOne + nalusize;
			}
			
			if (units.length == 0) {
				return;
			}
			
			var avcsample = {
				units: units,
				length: length,
				isKeyframe: keyframe,
				cts: cts,
				dts: dts,
				pts: cts + dts
			};
			if (keyframe) {
				//avcsample.fileposition = 
			}
			
			_videoTrack.samples.push(avcsample);
			_videoTrack.length += length;
			
			_this.dispatchEvent(events.PLAYEASE_AVC_SAMPLE, { data: _videoTrack });
		}
		
		
		_this.parseAACAudioPacket = function(arrayBuffer, dataOffset, dataSize, timestamp, rate, samplesize, sampletype) {
			if (dataSize < 2) {
				_this.dispatchEvent(events.ERROR, { message: 'Data not enough while parsing AAC audio packet.' });
				return;
			}
			
			var v = new DataView(arrayBuffer, dataOffset, dataSize);
			
			var pos = 1; // skip format & rate & samplesize & sampletype
			var type = v.getUint8(pos++);
			
			switch (type) {
				case AAC.types.SPECIFIC_CONFIG:
					_parseAACAudioSpecificConfig(arrayBuffer, dataOffset + pos, dataSize - pos, rate, sampletype);
					break;
				case AAC.types.RAW_FRAME_DATA:
					_parseAACAudioData(arrayBuffer, dataOffset + pos, dataSize - pos, timestamp);
					break;
				default:
					_this.dispatchEvent(events.ERROR, { message: 'Unknown AAC audio packet type ' + type + '.' });
			}
		};
		
		function _parseAACAudioSpecificConfig(arrayBuffer, dataOffset, dataSize, rate, sampletype) {
			if (dataSize < 2) {
				_this.dispatchEvent(events.ERROR, { message: 'Data not enough while parsing AAC audio specific config.' });
				return;
			}
			
			var v = new DataView(arrayBuffer, dataOffset, dataSize);
			var pos = 0;
			
			var audioObjectType = v.getUint8(pos) >>> 3;                                 // 5 bits
			var samplingIndex = (v.getUint8(pos++) & 0x07) << 1 | v.getUint8(pos) >>> 7; // 4 bits
			if (samplingIndex < 0 || samplingIndex >= AAC.samplingRates.length) {
				_this.dispatchEvent(events.ERROR, { message: 'Invalid AAC sampling frequency index.', index: samplingIndex });
				return;
			}
			
			var track = _audioTrack;
			var audiometa = {
				type: track.type,
				id: track.id,
				timescale: 1000,
				duration: _metadata.duration * 1000 || 0
			};
			
			audiometa.audioSampleRate = AAC.samplingRates[samplingIndex];
			audiometa.refSampleDuration = Math.floor(1024 / audiometa.audioSampleRate * audiometa.timescale);
			
			var channelConfig = (v.getUint8(pos) & 0x78) >>> 3; // 4 bits
			if (channelConfig < 0 || channelConfig >= 8) {
				_this.dispatchEvent(events.ERROR, { message: 'Invalid AAC channel configuration.', config: channelConfig });
				return;
			}
			
			var extensionSamplingIndex, audioExtensionObjectType;
			if (audioObjectType === AAC.audioObjectTypes.AAC_HE_OR_SBR) {
				if (dataSize < 3) {
					_this.dispatchEvent(events.ERROR, { message: 'Data not enough while parsing AAC_HE_OR_SBR audio specific config.' });
					return;
				}
				
				extensionSamplingIndex = (v.getUint8(pos++) & 0x07) << 1 | v.getUint8(pos) >>> 7; // 4 bits
				audioExtensionObjectType = (v.getUint8(pos) & 0x7C) >>> 2;                        // 5 bits
			}
			
			var config;
			var userAgent = self.navigator.userAgent.toLowerCase();
			if (userAgent.indexOf('firefox') !== -1) {        // firefox: use SBR (HE-AAC) if freq less than 24kHz
				if (samplingIndex >= AAC.audioObjectTypes.AAC_SCALABLE) {
					audioObjectType = AAC.audioObjectTypes.AAC_HE_OR_SBR;
					extensionSamplingIndex = samplingIndex - 3;
					config = new Array(4);
				} else { // use LC-AAC
					audioObjectType = AAC.audioObjectTypes.AAC_LC;
					extensionSamplingIndex = samplingIndex;
					config = new Array(2);
				}
			} else if (userAgent.indexOf('android') !== -1) { // android: always use LC-AAC
				audioObjectType = AAC.audioObjectTypes.AAC_LC;
				extensionSamplingIndex = samplingIndex;
				config = new Array(2);
			} else {                                          // for other browsers,  use HE-AAC to make it easier to switch aac codec profile
				audioObjectType = AAC.audioObjectTypes.AAC_HE_OR_SBR;
				extensionSamplingIndex = samplingIndex;
				config = new Array(4);
				
				if (samplingIndex >= AAC.audioObjectTypes.AAC_SCALABLE) {
					extensionSamplingIndex = samplingIndex - 3;
				} else if (channelConfig === 1) { // Mono channel
					audioObjectType = AAC.audioObjectTypes.AAC_LC;
					extensionSamplingIndex = samplingIndex;
					config = new Array(2);
				}
			}
			
			config[0] = audioObjectType << 3;
			config[0] |= (samplingIndex & 0x0F) >>> 1;
			config[1] = (samplingIndex & 0x0F) << 7;
			config[1] |= (channelConfig & 0x0F) << 3;
			
			if (audioObjectType === AAC.audioObjectTypes.AAC_HE_OR_SBR) {
				config[1] |= (extensionSamplingIndex & 0x0F) >>> 1;
				config[2] = (extensionSamplingIndex & 0x01) << 7;
				// extended audio object type: force to 2 (LC-AAC)
				config[2] |= 2 << 2;
				config[3] = 0;
			}
			
			audiometa.channelCount = channelConfig;
			audiometa.codec = 'mp4a.40.' + audioObjectType;
			audiometa.config = config;
			
			_copyAudioInfo(audiometa);
			
			_this.dispatchEvent(events.PLAYEASE_AAC_SPECIFIC_CONFIG, { data: audiometa });
		}
		
		function _copyAudioInfo(audiometa) {
			_mediainfo.audioCodec = audiometa.codec;
			_mediainfo.audioSampleRate = audiometa.audioSampleRate;
			_mediainfo.audioChannelCount = audiometa.channelCount;
			
			_mediainfo.mimeType = 'video/mp4; codecs="' + _mediainfo.videoCodec
					+ (_mediainfo.hasAudio && _mediainfo.audioCodec ? ',' + _mediainfo.audioCodec : '') + '"';
			
			//if (_mediainfo.isComplete()) {
				_this.dispatchEvent(events.PLAYEASE_MEDIA_INFO, { info: _mediainfo });
			//}
		}
		
		function _parseAACAudioData(arrayBuffer, dataOffset, dataSize, timestamp) {
			var unit = new Uint8Array(arrayBuffer, dataOffset, dataSize);
			var dts = _timestampBase + timestamp;
			
			var aacsample = {
				unit: unit,
				dts: dts,
				pts: dts
			};
			
			var delta = 1024 / _mediainfo.audioSampleRate * 1000;
			var frame = new Uint8Array(AAC.silentFrames[_mediainfo.audioChannelCount - 1]);
			var n = Math.floor((dts - _lastAudioDts) / delta);
			
			for (var i = 1; i < n; i++) {
				var tmp = Math.floor(_lastAudioDts + i * delta);
				
				aacsample.unit = frame;
				aacsample.dts = tmp;
				aacsample.pts = tmp;
				
				_audioTrack.samples.push(aacsample);
				_audioTrack.length += frame.length;
				
				_this.dispatchEvent(events.PLAYEASE_AAC_SAMPLE, { data: _audioTrack });
			}
			
			_lastAudioDts = dts;
			
			aacsample.unit = unit;
			aacsample.dts = dts;
			aacsample.pts = dts;
			
			_audioTrack.samples.push(aacsample);
			_audioTrack.length += unit.length;
			
			_this.dispatchEvent(events.PLAYEASE_AAC_SAMPLE, { data: _audioTrack });
		}
		
		
		_this.setMetaData = function(metadata) {
			_metadata = metadata;
			
			if (utils.typeOf(_metadata.audiodatarate) === 'number') {
				_mediainfo.audioDataRate = _metadata.audiodatarate;
			}
			if (utils.typeOf(_metadata.videodatarate) === 'number') {
				_mediainfo.videoDataRate = _metadata.videodatarate;
			}
			if (utils.typeOf(_metadata.framerate) === 'number') {
				var fps_num = Math.floor(_metadata.framerate * 1000);
				if (fps_num > 0) {
					var fps = fps_num / 1000;
					
					_referenceFrameRate.fixed = true;
					_referenceFrameRate.fps = fps;
					_referenceFrameRate.fps_num = fps_num;
					_referenceFrameRate.fps_den = 1000;
					_mediainfo.fps = fps;
				}
			}
			if (utils.typeOf(_metadata.keyframes) === 'object') {
				_mediainfo.keyframesIndex = _metadata.keyframes;
				_mediainfo.hasKeyframesIndex = true;
			} else {
				_mediainfo.hasKeyframesIndex = false;
			}
		};
		
		_this.getMetaData = function() {
			return _metadata;
		};
		
		_this.offset = function() {
			return _offset;
		};
		
		_this.length = function() {
			return _length;
		};
		
		_this.destroy = function() {
			
		};
		
		_init();
	};
	
	muxer.flv.TAG = TAG;
	muxer.flv.FORMATS = FORMATS;
	muxer.flv.FRAMES = FRAMES;
	muxer.flv.CODECS = CODECS;
	muxer.flv.AVC = AVC;
	muxer.flv.AAC = AAC;
})(playease);
