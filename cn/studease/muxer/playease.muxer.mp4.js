(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		muxer = playease.muxer,
		
		FRAMES = muxer.flv.FRAMES,
		AAC = muxer.flv.AAC;
	
	var datas = {};
	
	try {
	
	datas.FTYP = new Uint8Array([
		0x69, 0x73, 0x6F, 0x6D, // major_brand: isom
		0x0,  0x0,  0x0,  0x1,  // minor_version: 0x01
		0x69, 0x73, 0x6F, 0x6D, // isom
		0x61, 0x76, 0x63, 0x31  // avc1
	]);
	
	datas.STSD_PREFIX = new Uint8Array([
		0x00, 0x00, 0x00, 0x00, // version(0) + flags
		0x00, 0x00, 0x00, 0x01  // entry_count
	]);
	
	datas.STTS = new Uint8Array([
		0x00, 0x00, 0x00, 0x00, // version(0) + flags
		0x00, 0x00, 0x00, 0x00  // entry_count
	]);
	
	datas.STSC = datas.STCO = datas.STTS;
	
	datas.STSZ = new Uint8Array([
		0x00, 0x00, 0x00, 0x00, // version(0) + flags
		0x00, 0x00, 0x00, 0x00, // sample_size
		0x00, 0x00, 0x00, 0x00  // sample_count
	]);
	
	datas.HDLR_VIDEO = new Uint8Array([
		0x00, 0x00, 0x00, 0x00, // version(0) + flags
		0x00, 0x00, 0x00, 0x00, // pre_defined
		0x76, 0x69, 0x64, 0x65, // handler_type: 'vide'
		0x00, 0x00, 0x00, 0x00, // reserved: 3 * 4 bytes
		0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00,
		0x56, 0x69, 0x64, 0x65,
		0x6F, 0x48, 0x61, 0x6E,
		0x64, 0x6C, 0x65, 0x72, 0x00 // name: VideoHandler
	]);
	
	datas.HDLR_AUDIO = new Uint8Array([
		0x00, 0x00, 0x00, 0x00, // version(0) + flags
		0x00, 0x00, 0x00, 0x00, // pre_defined
		0x73, 0x6F, 0x75, 0x6E, // handler_type: 'soun'
		0x00, 0x00, 0x00, 0x00, // reserved: 3 * 4 bytes
		0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00,
		0x53, 0x6F, 0x75, 0x6E,
		0x64, 0x48, 0x61, 0x6E,
		0x64, 0x6C, 0x65, 0x72, 0x00 // name: SoundHandler
	]);
	
	datas.DREF = new Uint8Array([
		0x00, 0x00, 0x00, 0x00, // version(0) + flags
		0x00, 0x00, 0x00, 0x01, // entry_count
		0x00, 0x00, 0x00, 0x0C, // entry_size
		0x75, 0x72, 0x6C, 0x20, // type 'url '
		0x00, 0x00, 0x00, 0x01  // version(0) + flags
	]);
	
	// Sound media header
	datas.SMHD = new Uint8Array([
		0x00, 0x00, 0x00, 0x00, // version(0) + flags
		0x00, 0x00, 0x00, 0x00  // balance(2) + reserved(2)
	]);
	
	// video media header
	datas.VMHD = new Uint8Array([
		0x00, 0x00, 0x00, 0x01, // version(0) + flags
		0x00, 0x00,             // graphicsmode: 2 bytes
		0x00, 0x00, 0x00, 0x00, // opcolor: 3 * 2 bytes
		0x00, 0x00
	]);
	
	} catch(err) {
		/* void */
	}
	
	AAC.getSilentFrame = function(channelCount) {
		if (channelCount === 1) {
			return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x23, 0x80]);
		} else if (channelCount === 2) {
			return new Uint8Array([0x21, 0x00, 0x49, 0x90, 0x02, 0x19, 0x00, 0x23, 0x80]);
		} else if (channelCount === 3) {
			return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x8e]);
		} else if (channelCount === 4) {
			return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x80, 0x2c, 0x80, 0x08, 0x02, 0x38]);
		} else if (channelCount === 5) {
			return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x38]);
		} else if (channelCount === 6) {
			return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x00, 0xb2, 0x00, 0x20, 0x08, 0xe0]);
		}
		
		return null;
	};
	
	
	var sampleinfo = function(dts, pts, duration, originalDts, isSync) {
		var _this = this;
		
		function _init() {
			_this.dts = dts;
			_this.pts = pts;
			_this.duration = duration;
			_this.originalDts = originalDts;
			_this.isSyncPoint = isSync;
			_this.fileposition = null;
		}
		
		_init();
	};
	
	var segmentinfo = function() {
		var _this = this,
			_beginDts = 0,
			_endDts = 0,
			_beginPts = 0,
			_endPts = 0,
			_originalBeginDts = 0,
			_originalEndDts = 0,
			_syncPoints = [],    // SampleInfo[n], for video IDR frames only
			_firstSample = null, // SampleInfo
			_lastSample = null;  // SampleInfo
		
		function _init() {
			
		}
		
		_this.appendSyncPoint = function(sampleinfo) {
			sampleinfo.isSyncPoint = true;
			_syncPoints.push(sampleinfo);
		};
		
		_init();
	};
	
	var segmentinfolist = function(type) {
		var _this = this,
			_type = type,
			_list,
			_lastAppendLocation;
		
		function _init() {
			_list = [];
			_lastAppendLocation = -1;
		}
		
		_this.reset = _init;
		
		_this.searchNearestSegmentBefore = function(originalBeginDts) {
			if (_list.length === 0) {
				return -2;
			}
			
			var lastindex = _list.length - 1;
			var midindex = 0;
			var lbound = 0;
			var ubound = lastindex;
			
			var index = 0;
			if (originalBeginDts < _list[0].originalBeginDts) {
				index = -1;
				return index;
			}
			
			while (lbound <= ubound) {
				midindex = lbound + Math.floor((ubound - lbound) / 2);
				if (midindex === lastindex || originalBeginDts > _list[midindex].lastSample.originalDts && originalBeginDts < _list[midindex + 1].originalBeginDts) {
					index = midindex;
					break;
				}
				
				if (_list[midindex].originalBeginDts < originalBeginDts) {
					lbound = midindex + 1;
				} else {
					ubound = midindex - 1;
				}
			}
			
			return index;
		};
		
		_this.searchNearestSegmentAfter = function(originalBeginDts) {
			return _this.searchNearestSegmentBefore(originalBeginDts) + 1;
		};
		
		_this.append = function(seginfo) {
			var lastindex = _lastAppendLocation;
			var insertindex = 0;
			
			if (lastindex !== -1 && lastindex < _list.length
					&& seginfo.originalBeginDts >= _list[lastindex].lastSample.originalDts
					&& (lastindex === _list.length - 1 || lastindex < _list.length - 1
					&& seginfo.originalBeginDts < _list[lastindex + 1].originalBeginDts)) {
				insertindex = lastindex + 1; // use cached location idx
			} else {
				if (_list.length > 0) {
					insertindex = _this.searchNearestSegmentBefore(seginfo.originalBeginDts) + 1;
				}
			}
			
			_lastAppendLocation = insertindex;
			_list.splice(insertindex, 0, seginfo);
		};
		
		_this.getLastSegmentBefore = function(originalBeginDts) {
			var index = _this.searchNearestSegmentBefore(originalBeginDts);
			if (index < 0) {
				return null;
			}
			
			return _list[index];
		};
		
		_this.getLastSampleBefore = function(originalBeginDts) {
			var segment = _this.getLastSegmentBefore(originalBeginDts);
			if (segment == null) {
				return null;
			}
			
			return segment.lastSample;
		};
		
		_this.getLastSyncPointBefore = function(originalBeginDts) {
			var segindex = _this.searchNearestSegmentBefore(originalBeginDts);
			var syncPoints = _list[segindex].syncPoints;
			
			while (syncPoints.length === 0 && segindex--) {
				syncPoints = _list[segindex].syncPoints;
			}
			
			if (syncPoints.length <= 0) {
				return null;
			}
			
			return syncPoints[syncPoints.length - 1];
		};
		
		_this.isEmpty = function() {
			return _list.length === 0;
		};
		
		_this.clear = function() {
			_list = [];
			_lastAppendLocation = -1;
		};
		
		_init();
	};
	
	
	muxer.mp4 = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('muxer.mp4')),
			_defaults = {
				islive: false
			},
			_dtsBase,
			_videoNextDts,
			_audioNextDts,
			_videoMeta,
			_audioMeta,
			_videoseginfolist,
			_audioseginfolist,
			_fillSilentAfterSeek,
			
			_types = {
				avc1: [], avcC: [], btrt: [], dinf: [],
				dref: [], esds: [], ftyp: [], hdlr: [],
				mdat: [], mdhd: [], mdia: [], mfhd: [],
				minf: [], moof: [], moov: [], mp4a: [],
				mvex: [], mvhd: [], sdtp: [], stbl: [],
				stco: [], stsc: [], stsd: [], stsz: [],
				stts: [], tfdt: [], tfhd: [], traf: [],
				trak: [], trun: [], trex: [], tkhd: [],
				vmhd: [], smhd: []
			};
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			for (var name in _types) {
				_types[name] = [
					name.charCodeAt(0),
					name.charCodeAt(1),
					name.charCodeAt(2),
					name.charCodeAt(3)
				];
			}
			
			_dtsBase = 0;
			
			_videoseginfolist = new segmentinfolist('video');
			_audioseginfolist = new segmentinfolist('audio');
			
			_fillSilentAfterSeek = false;
		}
		
		_this.reset = function() {
			_dtsBase = 0;
			
			_videoNextDts = undefined;
			_audioNextDts = undefined;
			
			_videoseginfolist.reset();
			_audioseginfolist.reset();
			
			_fillSilentAfterSeek = false;
		};
		
		_this.getInitSegment = function(meta) {
			var ftyp = _this.box(_types.ftyp, datas.FTYP);
			var moov = _this.moov(meta);
			
			var seg = new Uint8Array(ftyp.byteLength + moov.byteLength);
			seg.set(ftyp, 0);
			seg.set(moov, ftyp.byteLength);
			
			_this.dispatchEvent(events.PLAYEASE_MP4_INIT_SEGMENT, { tp: meta.type, data: seg });
		};
		
		_this.getVideoSegment = function(track) {
			var samples = track.samples;
			var dtsCorrection = undefined;
			var firstDts = -1, lastDts = -1;
			var firstPts = -1, lastPts = -1;
			
			if (!samples || samples.length === 0) {
				return;
			}
			
			var pos = 0;
			
			var bytes = 8 + track.length;
			var mdatbox = new Uint8Array(bytes);
			mdatbox[pos++] = bytes >>> 24 & 0xFF;
			mdatbox[pos++] = bytes >>> 16 & 0xFF;
			mdatbox[pos++] = bytes >>>  8 & 0xFF;
			mdatbox[pos++] = bytes & 0xFF;
			
			mdatbox.set(_types.mdat, pos);
			pos += 4;
			
			var mp4Samples = [];
			var seginfo = new segmentinfo();
			
			while (samples.length) {
				var avcSample = samples.shift();
				var keyframe = avcSample.isKeyframe;
				var originalDts = avcSample.dts - _dtsBase;
				
				if (dtsCorrection == undefined) {
					if (_videoNextDts == undefined) {
						if (_videoseginfolist.isEmpty()) {
							dtsCorrection = 0;
						} else {
							var lastSample = _videoseginfolist.getLastSampleBefore(originalDts);
							if (lastSample != null) {
								var distance = originalDts - (lastSample.originalDts + lastSample.duration);
								if (distance <= 3) {
									distance = 0;
								}
								
								var expectedDts = lastSample.dts + lastSample.duration + distance;
								dtsCorrection = originalDts - expectedDts;
							} else {
								// lastSample == null
								dtsCorrection = 0;
							}
						}
					} else {
						dtsCorrection = originalDts - _videoNextDts;
					}
				}
				
				var dts = originalDts - dtsCorrection;
				var cts = avcSample.cts;
				var pts = dts + cts;
				
				if (firstDts === -1) {
					firstDts = dts;
					firstPts = pts;
				}
				
				// fill mdat box
				var sampleSize = 0;
				while (avcSample.units.length) {
					var unit = avcSample.units.shift();
					var data = unit.data;
					mdatbox.set(data, pos);
					pos += data.byteLength;
					sampleSize += data.byteLength;
				}
				
				var sampleDuration = 0;
				if (samples.length >= 1) {
					var nextDts = samples[0].dts - _dtsBase - dtsCorrection;
					sampleDuration = nextDts - dts;
				} else {
					if (mp4Samples.length >= 1) {
						sampleDuration = mp4Samples[mp4Samples.length - 1].duration;
					} else {
						sampleDuration = _videoMeta.refSampleDuration + dtsCorrection;
					}
				}
				
				if (keyframe) {
					var syncPoint = new sampleinfo(dts, pts, sampleDuration, avcSample.dts, true);
					syncPoint.fileposition = avcSample.fileposition;
					seginfo.appendSyncPoint(syncPoint);
				}
				
				var mp4Sample = {
					dts: dts,
					pts: pts,
					cts: cts,
					size: sampleSize,
					isKeyframe: keyframe,
					duration: sampleDuration,
					originalDts: originalDts,
					flags: {
						isLeading: 0,
						dependsOn: keyframe ? 2 : 1,
						isDependedOn: keyframe ? 1 : 0,
						hasRedundancy: 0,
						isNonSync: keyframe ? 0 : 1
					}
				};
				
				mp4Samples.push(mp4Sample);
			}
			
			var latest = mp4Samples[mp4Samples.length - 1];
			lastDts = latest.dts + latest.duration;
			lastPts = latest.pts + latest.duration;
			_videoNextDts = lastDts;
			
			// fill media segment info & add into info list
			seginfo.beginDts = firstDts;
			seginfo.endDts = lastDts;
			seginfo.beginPts = firstPts;
			seginfo.endPts = lastPts;
			seginfo.originalBeginDts = mp4Samples[0].originalDts;
			seginfo.originalEndDts = latest.originalDts + latest.duration;
			seginfo.firstSample = new sampleinfo(mp4Samples[0].dts, mp4Samples[0].pts, mp4Samples[0].duration, mp4Samples[0].originalDts, mp4Samples[0].isKeyframe);
			seginfo.lastSample = new sampleinfo(latest.dts, latest.pts, latest.duration, latest.originalDts, latest.isKeyframe);
			if (!_this.config.islive) {
				_videoseginfolist.append(seginfo);
			}
			
			track.samples = mp4Samples;
			track.sequenceNumber++;
			
			// workaround for chrome < 50: force first sample as a random access point
			// see https://bugs.chromium.org/p/chromium/issues/detail?id=229412
			/*if (_forceFirstIDR) {
				var flags = mp4Samples[0].flags;
				flags.dependsOn = 2;
				flags.isNonSync = 0;
			}*/
			
			var moofbox = _this.moof(track, firstDts);
			track.samples = [];
			track.length = 0;
			
			_this.dispatchEvent(events.PLAYEASE_MP4_SEGMENT, {
				tp: 'video',
				data: _mergeBoxes(moofbox, mdatbox),
				sampleCount: mp4Samples.length,
				info: seginfo
			});
		};
		
		_this.getAudioSegment = function(track) {
			var samples = track.samples;
			var dtsCorrection = undefined;
			var firstDts = -1, lastDts = -1;
			
			var remuxSilentFrame = false;
			var silentFrameDuration = -1;
			
			if (!samples || samples.length === 0) {
				return;
			}
			
			var pos = 0;
			
			var bytes = 8 + track.length;
			var mdatbox = new Uint8Array(bytes);
			mdatbox[pos++] = bytes >>> 24 & 0xFF;
			mdatbox[pos++] = bytes >>> 16 & 0xFF;
			mdatbox[pos++] = bytes >>>  8 & 0xFF;
			mdatbox[pos++] = bytes & 0xFF;
			
			mdatbox.set(_types.mdat, pos);
			pos += 4;
			
			var mp4Samples = [];
			
			while (samples.length) {
				var aacSample = samples.shift();
				var unit = aacSample.unit;
				var originalDts = aacSample.dts - _dtsBase;
				
				if (dtsCorrection == undefined) {
					if (_audioNextDts == undefined) {
						if (_audioseginfolist.isEmpty()) {
							dtsCorrection = 0;
							if (_fillSilentAfterSeek && !_videoseginfolist.isEmpty()) {
								remuxSilentFrame = true;
							}
						} else {
							var lastSample = _audioseginfolist.getLastSampleBefore(originalDts);
							if (lastSample != null) {
								var distance = originalDts - (lastSample.originalDts + lastSample.duration);
								if (distance <= 3) {
									distance = 0;
								}
								var expectedDts = lastSample.dts + lastSample.duration + distance;
								dtsCorrection = originalDts - expectedDts;
							} else {
								// lastSample == null
								dtsCorrection = 0;
							}
						}
					} else {
						dtsCorrection = originalDts - _audioNextDts;
					}
				}
				
				var dts = originalDts - dtsCorrection;
				if (remuxSilentFrame) {
					// align audio segment beginDts to match with current video segment's beginDts
					var videoSegment = _videoseginfolist.getLastSegmentBefore(originalDts);
					if (videoSegment != null && videoSegment.beginDts < dts) {
						silentFrameDuration = dts - videoSegment.beginDts;
						dts = videoSegment.beginDts;
					} else {
						remuxSilentFrame = false;
					}
				}
				if (firstDts === -1) {
					firstDts = dts;
				}
				
				if (remuxSilentFrame) {
					remuxSilentFrame = false;
					samples.unshift(aacSample);
					
					var frame = _generateSilentAudio(dts, silentFrameDuration);
					if (frame == null) {
						continue;
					}
					var mp4Spl = frame.mp4Sample;
					var unt = frame.unit;
					mp4Samples.push(mp4Spl);
					
					// re-allocate mdatbox buffer with new size, to fit with this silent frame
					pos = 0;
					
					bytes += unt.byteLength;
					mdatbox = new Uint8Array(bytes);
					mdatbox[pos++] = bytes >>> 24 & 0xFF;
					mdatbox[pos++] = bytes >>> 16 & 0xFF;
					mdatbox[pos++] = bytes >>>  8 & 0xFF;
					mdatbox[pos++] = bytes & 0xFF;
					
					mdatbox.set(_types.mdat, pos);
					pos += 4;
					
					mdatbox.set(unt, pos);
					pos += unt.byteLength;
					
					continue;
				}
				
				var sampleDuration = 0;
				
				if (samples.length >= 1) {
					var nextDts = samples[0].dts - _dtsBase - dtsCorrection;
					sampleDuration = nextDts - dts;
				} else {
					if (mp4Samples.length >= 1) {
						sampleDuration = mp4Samples[mp4Samples.length - 1].duration;
					} else {
						sampleDuration = _audioMeta.refSampleDuration + dtsCorrection;
					}
				}
				
				var mp4Sample = {
					dts: dts,
					pts: dts,
					cts: 0,
					size: unit.byteLength,
					duration: sampleDuration,
					originalDts: originalDts,
					flags: {
						isLeading: 0,
						dependsOn: 1,
						isDependedOn: 0,
						hasRedundancy: 0
					}
				};
				
				mp4Samples.push(mp4Sample);
				mdatbox.set(unit, pos);
				pos += unit.byteLength;
			}
			
			var latest = mp4Samples[mp4Samples.length - 1];
			lastDts = latest.dts + latest.duration;
			_audioNextDts = lastDts;
			
			// fill media segment info & add to info list
			var seginfo = new segmentinfo();
			seginfo.beginDts = firstDts;
			seginfo.endDts = lastDts;
			seginfo.beginPts = firstDts;
			seginfo.endPts = lastDts;
			seginfo.originalBeginDts = mp4Samples[0].originalDts;
			seginfo.originalEndDts = latest.originalDts + latest.duration;
			seginfo.firstSample = new sampleinfo(mp4Samples[0].dts, mp4Samples[0].pts, mp4Samples[0].duration, mp4Samples[0].originalDts, false);
			seginfo.lastSample = new sampleinfo(latest.dts, latest.pts, latest.duration, latest.originalDts, false);
			if (!_this.config.islive) {
				_audioseginfolist.append(seginfo);
			}
			
			track.samples = mp4Samples;
			track.sequenceNumber++;
			
			var moofbox = _this.moof(track, firstDts);
			track.samples = [];
			track.length = 0;
			
			_this.dispatchEvent(events.PLAYEASE_MP4_SEGMENT, {
				tp: 'audio',
				data: _mergeBoxes(moofbox, mdatbox),
				sampleCount: mp4Samples.length,
				info: seginfo
			});
		};
		
		function _generateSilentAudio(dts, frameDuration) {
			var unit = AAC.getSilentFrame(_audioMeta.channelCount);
			if (unit == null) {
				utils.log('Cannot generate silent aac frame, channelCount: ' + _audioMeta.channelCount + '.');
				return null;
			}
			
			var mp4Sample = {
				dts: dts,
				pts: dts,
				cts: 0,
				size: unit.byteLength,
				duration: frameDuration,
				originalDts: dts,
				flags: {
					isLeading: 0,
					dependsOn: 1,
					isDependedOn: 0,
					hasRedundancy: 0
				}
			};
			
			return {
				unit: unit,
				mp4Sample: mp4Sample
			};
		}
		
		_mergeBoxes = function(moof, mdat) {
			var res = new Uint8Array(moof.byteLength + mdat.byteLength);
			res.set(moof, 0);
			res.set(mdat, moof.byteLength);
			
			return res;
		};
		
		_this.setVideoMeta = function(meta) {
			_videoMeta = meta;
		};
		
		_this.setAudioMeta = function(meta) {
			_audioMeta = meta;
		};
		
		
		_this.box = function(type) {
			var size = 8;
			var arrs = Array.prototype.slice.call(arguments, 1);
			for (var i = 0; i < arrs.length; i++) {
				size += arrs[i].byteLength;
			}
			
			var data = new Uint8Array(size);
			var pos = 0;
			
			// set size
			data[pos++] = size >>> 24 & 0xFF;
			data[pos++] = size >>> 16 & 0xFF;
			data[pos++] = size >>>  8 & 0xFF;
			data[pos++] = size & 0xFF;
			
			// set type
			data.set(type, pos);
			pos += 4;
			
			// set data
			for (var i = 0; i < arrs.length; i++) {
				data.set(arrs[i], pos);
				pos += arrs[i].byteLength;
			}
			
			return data;
		};
		
		// Movie metadata box
		_this.moov = function(meta) {
			var mvhd = _this.mvhd(meta.timescale, meta.duration);
			var trak = _this.trak(meta);
			var mvex = _this.mvex(meta);
			
			return _this.box(_types.moov, mvhd, trak, mvex);
		}
		
		// Movie header box
		_this.mvhd = function(timescale, duration) {
			return _this.box(_types.mvhd, new Uint8Array([
				0x00, 0x00, 0x00, 0x00,    // version(0) + flags
				0x00, 0x00, 0x00, 0x00,    // creation_time
				0x00, 0x00, 0x00, 0x00,    // modification_time
				(timescale >>> 24) & 0xFF, // timescale: 4 bytes
				(timescale >>> 16) & 0xFF,
				(timescale >>>  8) & 0xFF,
				(timescale) & 0xFF,
				(duration >>> 24) & 0xFF,  // duration: 4 bytes
				(duration >>> 16) & 0xFF,
				(duration >>>  8) & 0xFF,
				(duration) & 0xFF,
				0x00, 0x01, 0x00, 0x00,    // Preferred rate: 1.0
				0x01, 0x00, 0x00, 0x00,    // PreferredVolume(1.0, 2bytes) + reserved(2bytes)
				0x00, 0x00, 0x00, 0x00,    // reserved: 4 + 4 bytes
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x01, 0x00, 0x00,    // ----begin composition matrix----
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x01, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x40, 0x00, 0x00, 0x00,    // ----end composition matrix----
				0x00, 0x00, 0x00, 0x00,    // ----begin pre_defined 6 * 4 bytes----
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,    // ----end pre_defined 6 * 4 bytes----
				0xFF, 0xFF, 0xFF, 0xFF     // next_track_ID
			]));
		};
		
		// Track box
		_this.trak = function(meta) {
			return _this.box(_types.trak, _this.tkhd(meta), _this.mdia(meta));
		};
		
		// Track header box
		_this.tkhd = function(meta) {
			var trackId = meta.id;
			var duration = meta.duration;
			var width = meta.presentWidth;
			var height = meta.presentHeight;
			
			return _this.box(_types.tkhd, new Uint8Array([
				0x00, 0x00, 0x00, 0x07,   // version(0) + flags
				0x00, 0x00, 0x00, 0x00,   // creation_time
				0x00, 0x00, 0x00, 0x00,   // modification_time
				(trackId >>> 24) & 0xFF,  // track_ID: 4 bytes
				(trackId >>> 16) & 0xFF,
				(trackId >>>  8) & 0xFF,
				(trackId) & 0xFF,
				0x00, 0x00, 0x00, 0x00,   // reserved: 4 bytes
				(duration >>> 24) & 0xFF, // duration: 4 bytes
				(duration >>> 16) & 0xFF,
				(duration >>>  8) & 0xFF,
				(duration) & 0xFF,
				0x00, 0x00, 0x00, 0x00,   // reserved: 2 * 4 bytes
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,   // layer(2bytes) + alternate_group(2bytes)
				0x00, 0x00, 0x00, 0x00,   // volume(2bytes) + reserved(2bytes)
				0x00, 0x01, 0x00, 0x00,   // ----begin composition matrix----
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x01, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x40, 0x00, 0x00, 0x00,   // ----end composition matrix----
				(width >>> 8) & 0xFF,     // width and height
				(width) & 0xFF,
				0x00, 0x00,
				(height >>> 8) & 0xFF,
				(height) & 0xFF,
				0x00, 0x00
			]));
		};
		
		// Media Box
		_this.mdia = function(meta) {
			return _this.box(_types.mdia, _this.mdhd(meta), _this.hdlr(meta), _this.minf(meta));
		};
		
		// Media header box
		_this.mdhd = function(meta) {
			var timescale = meta.timescale;
			var duration = meta.duration;
			
			return _this.box(_types.mdhd, new Uint8Array([
				0x00, 0x00, 0x00, 0x00,    // version(0) + flags
				0x00, 0x00, 0x00, 0x00,    // creation_time
				0x00, 0x00, 0x00, 0x00,    // modification_time
				(timescale >>> 24) & 0xFF, // timescale: 4 bytes
				(timescale >>> 16) & 0xFF,
				(timescale >>>  8) & 0xFF,
				(timescale) & 0xFF,
				(duration >>> 24) & 0xFF,  // duration: 4 bytes
				(duration >>> 16) & 0xFF,
				(duration >>>  8) & 0xFF,
				(duration) & 0xFF,
				0x55, 0xC4,                // language: und (undetermined)
				0x00, 0x00                 // pre_defined = 0
			]));
		};
		
		// Media handler reference box
		_this.hdlr = function(meta) {
			var data = null;
			
			if (meta.type === 'audio') {
				data = datas.HDLR_AUDIO;
			} else {
				data = datas.HDLR_VIDEO;
			}
			
			return _this.box(_types.hdlr, data);
		};
		
		// Media infomation box
		_this.minf = function(meta) {
			var xmhd = null;
			
			if (meta.type === 'audio') {
				xmhd = _this.box(_types.smhd, datas.SMHD);
			} else {
				xmhd = _this.box(_types.vmhd, datas.VMHD);
			}
			
			return _this.box(_types.minf, xmhd, _this.dinf(), _this.stbl(meta));
		};
		
		// Data infomation box
		_this.dinf = function() {
			return _this.box(_types.dinf, _this.box(_types.dref, datas.DREF));
		};
		
		// Sample table box
		_this.stbl = function(meta) {
			var result = _this.box(_types.stbl,   // type: stbl
				_this.stsd(meta),                   // Sample Description Table
				_this.box(_types.stts, datas.STTS), // Time-To-Sample
				_this.box(_types.stsc, datas.STSC), // Sample-To-Chunk
				_this.box(_types.stsz, datas.STSZ), // Sample size
				_this.box(_types.stco, datas.STCO)  // Chunk offset
			);
			
			return result;
		};
		
		// Sample description box
		_this.stsd = function(meta) {
			if (meta.type === 'audio') {
				return _this.box(_types.stsd, datas.STSD_PREFIX, _this.mp4a(meta));
			} else {
				return _this.box(_types.stsd, datas.STSD_PREFIX, _this.avc1(meta));
			}
		};
		
		_this.mp4a = function(meta) {
			var channelCount = meta.channelCount;
			var sampleRate = meta.audioSampleRate;
			
			var data = new Uint8Array([
				0x00, 0x00, 0x00, 0x00,    // reserved(4)
				0x00, 0x00, 0x00, 0x01,    // reserved(2) + data_reference_index(2)
				0x00, 0x00, 0x00, 0x00,    // reserved: 2 * 4 bytes
				0x00, 0x00, 0x00, 0x00,
				0x00, channelCount,        // channelCount(2)
				0x00, 0x10,                // sampleSize(2)
				0x00, 0x00, 0x00, 0x00,    // reserved(4)
				(sampleRate >>> 8) & 0xFF, // Audio sample rate
				(sampleRate) & 0xFF,
				0x00, 0x00
			]);
			
			return _this.box(_types.mp4a, data, _this.esds(meta));
		};
		
		_this.esds = function(meta) {
			var config = meta.config;
			var configSize = config.length;
			var data = new Uint8Array([
				0x00, 0x00, 0x00, 0x00, // version 0 + flags
				
				0x03,                   // descriptor_type
				0x17 + configSize,      // length3
				0x00, 0x01,             // es_id
				0x00,                   // stream_priority
				
				0x04,                   // descriptor_type
				0x0F + configSize,      // length
				0x40,                   // codec: mpeg4_audio
				0x15,                   // stream_type: Audio
				0x00, 0x00, 0x00,       // buffer_size
				0x00, 0x00, 0x00, 0x00, // maxBitrate
				0x00, 0x00, 0x00, 0x00, // avgBitrate
				
				0x05                    // descriptor_type
			].concat(
				[configSize]
			).concat(
				config
			).concat(
				[0x06, 0x01, 0x02]      // GASpecificConfig
			));
			
			return _this.box(_types.esds, data);
		};
		
		_this.avc1 = function(meta) {
			var avcc = meta.avcc;
			var width = meta.codecWidth;
			var height = meta.codecHeight;
			
			var data = new Uint8Array([
				0x00, 0x00, 0x00, 0x00, // reserved(4)
				0x00, 0x00, 0x00, 0x01, // reserved(2) + data_reference_index(2)
				0x00, 0x00, 0x00, 0x00, // pre_defined(2) + reserved(2)
				0x00, 0x00, 0x00, 0x00, // pre_defined: 3 * 4 bytes
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				(width >>> 8) & 0xFF,   // width: 2 bytes
				(width) & 0xFF,
				(height >>> 8) & 0xFF,  // height: 2 bytes
				(height) & 0xFF,
				0x00, 0x48, 0x00, 0x00, // horizresolution: 4 bytes
				0x00, 0x48, 0x00, 0x00, // vertresolution: 4 bytes
				0x00, 0x00, 0x00, 0x00, // reserved: 4 bytes
				0x00, 0x01,             // frame_count
				0x0A,                   // strlen
				0x78, 0x71, 0x71, 0x2F, // compressorname: 32 bytes
				0x66, 0x6C, 0x76, 0x2E,
				0x6A, 0x73, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00,
				0x00, 0x18,             // depth
				0xFF, 0xFF              // pre_defined = -1
			]);
			
			return _this.box(_types.avc1, data, _this.box(_types.avcC, avcc));
		};
		
		// Movie Extends box
		_this.mvex = function(meta) {
			return _this.box(_types.mvex, _this.trex(meta));
		};
		
		// Track Extends box
		_this.trex = function(meta) {
			var trackId = meta.id;
			var data = new Uint8Array([
				0x00, 0x00, 0x00, 0x00,  // version(0) + flags
				(trackId >>> 24) & 0xFF, // track_ID
				(trackId >>> 16) & 0xFF,
				(trackId >>>  8) & 0xFF,
				(trackId) & 0xFF,
				0x00, 0x00, 0x00, 0x01,  // default_sample_description_index
				0x00, 0x00, 0x00, 0x00,  // default_sample_duration
				0x00, 0x00, 0x00, 0x00,  // default_sample_size
				0x00, 0x01, 0x00, 0x01   // default_sample_flags
			]);
			
			return _this.box(_types.trex, data);
		};
		
		// Movie fragment box
		_this.moof = function(track, baseMediaDecodeTime) {
			return _this.box(_types.moof, _this.mfhd(track.sequenceNumber), _this.traf(track, baseMediaDecodeTime));
		};
		
		_this.mfhd = function(sequenceNumber) {
			var data = new Uint8Array([
				0x00, 0x00, 0x00, 0x00,
				(sequenceNumber >>> 24) & 0xFF, // sequence_number: int32
				(sequenceNumber >>> 16) & 0xFF,
				(sequenceNumber >>>  8) & 0xFF,
				(sequenceNumber) & 0xFF
			]);
			
			return _this.box(_types.mfhd, data);
		};
		
		// Track fragment box
		_this.traf = function(track, baseMediaDecodeTime) {
			var trackId = track.id;
			
			// Track fragment header box
			var tfhd = _this.box(_types.tfhd, new Uint8Array([
				0x00, 0x00, 0x00, 0x00,  // version(0) & flags
				(trackId >>> 24) & 0xFF, // track_ID
				(trackId >>> 16) & 0xFF,
				(trackId >>>  8) & 0xFF,
				(trackId) & 0xFF
			]));
			
			// Track Fragment Decode Time
			var tfdt = _this.box(_types.tfdt, new Uint8Array([
				0x00, 0x00, 0x00, 0x00,              // version(0) & flags
				(baseMediaDecodeTime >>> 24) & 0xFF, // baseMediaDecodeTime: int32
				(baseMediaDecodeTime >>> 16) & 0xFF,
				(baseMediaDecodeTime >>>  8) & 0xFF,
				(baseMediaDecodeTime) & 0xFF
			]));
			
			var sdtp = _this.sdtp(track);
			var trun = _this.trun(track, sdtp.byteLength + 16 + 16 + 8 + 16 + 8 + 8);
			
			return _this.box(_types.traf, tfhd, tfdt, trun, sdtp);
		};
		
		// Sample Dependency Type box
		_this.sdtp = function(track) {
			var samples = track.samples || [];
			var sampleCount = samples.length;
			var data = new Uint8Array(4 + sampleCount);
			
			// 0~4 bytes: version(0) & flags
			for (var i = 0; i < sampleCount; i++) {
				var flags = samples[i].flags;
				data[i + 4] = (flags.isLeading << 6) // is_leading: 2 (bit)
					| (flags.dependsOn << 4)           // sample_depends_on
					| (flags.isDependedOn << 2)        // sample_is_depended_on
					| (flags.hasRedundancy);           // sample_has_redundancy
			}
			
			return _this.box(_types.sdtp, data);
		};
		
		// Track fragment run box
		_this.trun = function(track, offset) {
			var samples = track.samples || [];
			var sampleCount = samples.length;
			var dataSize = 12 + 16 * sampleCount;
			var data = new Uint8Array(dataSize);
			
			offset += 8 + dataSize;
			
			data.set([
				0x00, 0x00, 0x0F, 0x01,      // version(0) & flags
				(sampleCount >>> 24) & 0xFF, // sample_count
				(sampleCount >>> 16) & 0xFF,
				(sampleCount >>>  8) & 0xFF,
				(sampleCount) & 0xFF,
				(offset >>> 24) & 0xFF,      // data_offset
				(offset >>> 16) & 0xFF,
				(offset >>>  8) & 0xFF,
				(offset) & 0xFF
			], 0);
			
			for (var i = 0; i < sampleCount; i++) {
				var duration = samples[i].duration;
				var size = samples[i].size;
				var flags = samples[i].flags;
				var cts = samples[i].cts;
				
				data.set([
					(duration >>> 24) & 0xFF, // sample_duration
					(duration >>> 16) & 0xFF,
					(duration >>>  8) & 0xFF,
					(duration) & 0xFF,
					(size >>> 24) & 0xFF,     // sample_size
					(size >>> 16) & 0xFF,
					(size >>>  8) & 0xFF,
					(size) & 0xFF,
					(flags.isLeading << 2) | flags.dependsOn, // sample_flags
					(flags.isDependedOn << 6) | (flags.hasRedundancy << 4) | flags.isNonSync,
					0x00, 0x00,               // sample_degradation_priority
					(cts >>> 24) & 0xFF,      // sample_composition_time_offset
					(cts >>> 16) & 0xFF,
					(cts >>>  8) & 0xFF,
					(cts) & 0xFF
				], 12 + 16 * i);
			}
			
			return _this.box(_types.trun, data);
		};
		
		_this.mdat = function(data) {
			return _this.box(_types.mdat, data);
		};
		
		
		_this.destroy = function() {
			
		};
		
		_init();
	};
})(playease);
