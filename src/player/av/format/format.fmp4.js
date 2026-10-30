(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        Event = events.Event,
        MediaEvent = events.MediaEvent,
        AV = odd.AV,
        Format = AV.Format,
        MediaStreamTrack = Format.MediaStreamTrack,
        MediaStream = Format.MediaStream,

        types = {
            avc1: [], avcC: [], hvc1: [], hev1: [], hvcC: [], Opus: [], dOps: [], btrt: [], dinf: [],
            dref: [], esds: [], ftyp: [], hdlr: [],
            mdat: [], mdhd: [], mdia: [], mfhd: [],
            minf: [], moof: [], moov: [], mp4a: [],
            mvex: [], mvhd: [], sdtp: [], stbl: [],
            stco: [], stsc: [], stsd: [], stsz: [],
            stts: [], tfdt: [], tfhd: [], traf: [],
            trak: [], trun: [], trex: [], tkhd: [],
            vmhd: [], smhd: [],
        },
        sw = {
            size0: 0,
            size1: 1,
            size2: 2,
            size3: 3,
            type0: 4,
            type1: 5,
            type2: 6,
            type3: 7,
            payload: 8,
            complete: 9,
        },

        DREF = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x01, // entry_count
            0x00, 0x00, 0x00, 0x0C, // entry_size
            0x75, 0x72, 0x6C, 0x20, // type 'url '
            0x00, 0x00, 0x00, 0x01, // version(0) + flags
        ]),
        FTYP = new Uint8Array([
            0x69, 0x73, 0x6F, 0x6D, // major_brand: isom
            0x00, 0x00, 0x00, 0x01, // minor_version: 0x01
            0x69, 0x73, 0x6F, 0x6D, // isom
            0x69, 0x73, 0x6F, 0x36, // iso6
        ]),
        VIDEO_HDLR = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00, // pre_defined
            0x76, 0x69, 0x64, 0x65, // handler_type: 'vide'
            0x00, 0x00, 0x00, 0x00, // reserved: 3 * 4 bytes
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x56, 0x69, 0x64, 0x65, // name: VideoHandler
            0x6F, 0x48, 0x61, 0x6E,
            0x64, 0x6C, 0x65, 0x72,
            0x00,
        ]),
        AUDIO_HDLR = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00, // pre_defined
            0x73, 0x6F, 0x75, 0x6E, // handler_type: 'soun'
            0x00, 0x00, 0x00, 0x00, // reserved: 3 * 4 bytes
            0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00,
            0x53, 0x6F, 0x75, 0x6E, // name: SoundHandler
            0x64, 0x48, 0x61, 0x6E,
            0x64, 0x6C, 0x65, 0x72,
            0x00,
        ]),
        STSD = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x01, // entry_count
        ]),
        STTS = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00, // entry_count
        ]),
        STSC = STTS,
        STCO = STTS,
        STSZ = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00, // sample_size
            0x00, 0x00, 0x00, 0x00, // sample_count
        ]),
        // Video Media Header
        VMHD = new Uint8Array([
            0x00, 0x00, 0x00, 0x01, // version(0) + flags
            0x00, 0x00,             // graphicsmode: 2 bytes
            0x00, 0x00, 0x00, 0x00, // opcolor: 3 * 2 bytes
            0x00, 0x00,
        ]),
        // Sound Media Header
        SMHD = new Uint8Array([
            0x00, 0x00, 0x00, 0x00, // version(0) + flags
            0x00, 0x00, 0x00, 0x00, // balance(2) + reserved(2)
        ]);

    utils.forEach(types, function (name, arr) {
        arr.push(name.charCodeAt(0), name.charCodeAt(1), name.charCodeAt(2), name.charCodeAt(3));
    });

    function FMP4(logger, options) {
        MediaStream.call(this, 'FMP4', {
            logger: logger
        }, [ MediaEvent.PACKET ], [ Event.ERROR ]);
        var _this = this, _logger = logger, _header, _used, _need, _packet, _offset, _revision = 0;
        options = options || {};
        function _init() {
            _revision++;
            _header = new Uint8Array(16);
            _used = 0;
            _need = 8;
            _packet = null;
            _offset = 0;
        }
        function emit(packet) {
            if (packet.get('Type') === 'moov') {
                var tracks = FMP4.inspect(packet.payload, _logger);
                packet.set('Tracks', tracks);
                var video = tracks.find(function(track) {
                    return track.kind === 'video';
                });
                if (video) {
                    _this.info.Width = video.width;
                    _this.info.Height = video.height;
                }
                _this.info.Codecs = tracks.map(function(track) {
                    return track.codec;
                });
                _this.info.MimeType = tracks.some(function(track) {
                    return track.kind === 'video';
                }) ? 'video/mp4' : 'audio/mp4';
            }
            _this.dispatchEvent(MediaEvent.PACKET, {
                packet: packet
            });
        }
        _this.append = function(buffer) {
            var data = new Uint8Array(buffer), p = 0, revision = _revision;
            try {
                while (p < data.length && revision === _revision) {
                    if (!_packet) {
                        var n = Math.min(_need - _used, data.length - p);
                        _header.set(data.subarray(p, p + n), _used);
                        _used += n;
                        p += n;
                        _offset += n;
                        if (_used < _need) {
                            break;
                        }
                        var view = new DataView(_header.buffer), size = view.getUint32(0);
                        if (size === 1 && _need === 8) {
                            _need = 16;
                            continue;
                        }
                        if (size === 1) {
                            size = view.getUint32(8) * 4294967296 + view.getUint32(12);
                        }
                        var type = String.fromCharCode.apply(null, _header.subarray(4, 8));
                        if (!Number.isSafeInteger(size) || size < _need || type !== 'mdat' && size > (options.maxBoxBytes || 33554432)) {
                            throw {
                                name: 'DataError',
                                message: 'Invalid or oversized MP4 box.'
                            };
                        }
                        _packet = new AV.Packet;
                        _packet.length = size;
                        _packet.position = _need;
                        _packet.set('Type', type);
                        _packet.set('Offset', _offset - _need);
                        _packet.set('BodyOffset', _offset);
                        if (type === 'mdat' && options.streaming) {
                            _packet.payload = _header.slice(0, _need);
                            _packet.set('Partial', true);
                            _packet.set('Final', size === _need);
                            emit(_packet);
                            if (revision !== _revision) {
                                return;
                            }
                        } else {
                            if (size > (options.maxBoxBytes || 33554432)) {
                                throw {
                                    name: 'QuotaExceededError',
                                    message: 'MP4 box exceeds buffer budget.'
                                };
                            }
                            _packet.payload = new Uint8Array(size);
                            _packet.payload.set(_header.subarray(0, _need));
                        }
                        _used = 0;
                        _need = 8;
                    }
                    var packet = _packet, count = Math.min(packet.length - packet.position, data.length - p);
                    if (packet.get('Partial')) {
                        if (count) {
                            packet.payload = data.subarray(p, p + count);
                            packet.set('Offset', _offset);
                            packet.set('Final', packet.position + count === packet.length);
                            emit(packet);
                            if (revision !== _revision) {
                                return;
                            }
                        }
                    } else {
                        packet.payload.set(data.subarray(p, p + count), packet.position);
                    }
                    packet.position += count;
                    p += count;
                    _offset += count;
                    if (packet.position === packet.length) {
                        if (!packet.get('Partial')) {
                            emit(packet);
                        }
                        _packet = null;
                    }
                }
            } catch (error) {
                _this.dispatchEvent(Event.ERROR, {
                    name: error.name || 'DataError',
                    message: error.message
                });
            }
        };
        _this.complete = function() {
            return !_packet && !_used;
        };

        _this.getInitSegment = function () {
            var ftyp = _this.ftyp();
            var moov = _this.moov.apply(_this, arguments);
            return FMP4.merge(ftyp, moov);
        };

        _this.getSegment = function (track, pkt) {
            var source = track.source;
            if (track.kind === MediaStreamTrack.KindVideo) {
                if (pkt.get('Keyframe')) {
                    source.Flags.SampleDependsOn = 2;
                    source.Flags.SampleIsDependedOn = 1;
                } else {
                    source.Flags.SampleDependsOn = 1;
                    source.Flags.SampleIsDependedOn = 0;
                }
            }

            track.sn++;
            var moof = _this.moof(track, pkt);
            var mdat = _this.mdat(pkt.get('Data'));

            track.timestamp = pkt.get('DTS') - _this.info.TimeBase + (pkt.get('Duration') || source.RefSampleDuration);

            return FMP4.merge(moof, mdat);
        };

        _this.box = function (type) {
            var args = Array.prototype.slice.call(arguments, 1);
            var size = 8;
            for (var i = 0; i < args.length; i++) {
                size += args[i].byteLength;
            }

            var pos = 0;
            var data = new Uint8Array(size);

            // set size
            data[pos++] = size >>> 24 & 0xFF;
            data[pos++] = size >>> 16 & 0xFF;
            data[pos++] = size >>> 8 & 0xFF;
            data[pos++] = size & 0xFF;

            // set type
            data.set(type, pos);
            pos += 4;

            // set data
            for (var i = 0; i < args.length; i++) {
                data.set(args[i], pos);
                pos += args[i].byteLength;
            }

            return data;
        };

        _this.ftyp = function () {
            return _this.box(types.ftyp, FTYP);
        };

        // Movie Metadata Box
        _this.moov = function () {
            var trks = [];
            var trxs = [];
            var mvhd = _this.mvhd();

            var args = Array.prototype.slice.call(arguments, 0);
            for (var i = 0; i < args.length; i++) {
                var track = args[i];
                var trak = _this.trak(track);
                var trex = _this.trex(track);
                trks.push(trak);
                trxs.push(trex);
            }

            var mvex = _this.box.apply(_this, [types.mvex].concat(trxs));
            return _this.box.apply(_this, [types.moov].concat([mvhd], trks, [mvex]));
        };

        // Movie Header Box
        _this.mvhd = function () {
            var t = _this.info.Timescale;
            var d = _this.info.Duration * 1000;
            return _this.box(types.mvhd, new Uint8Array([
                0x00, 0x00, 0x00, 0x00, // version(0) + flags
                0x00, 0x00, 0x00, 0x00, // creation_time
                0x00, 0x00, 0x00, 0x00, // modification_time
                (t >>> 24) & 0xFF, (t >>> 16) & 0xFF, (t >>> 8) & 0xFF, t & 0xFF, // timescale: 4 bytes
                (d >>> 24) & 0xFF, (d >>> 16) & 0xFF, (d >>> 8) & 0xFF, d & 0xFF, // duration: 4 bytes
                0x00, 0x01, 0x00, 0x00, // Preferred rate: 1.0
                0x01, 0x00, 0x00, 0x00, // PreferredVolume(1.0, 2bytes) + reserved(2bytes)
                0x00, 0x00, 0x00, 0x00, // reserved: 4 + 4 bytes
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x01, 0x00, 0x00, // ----begin composition matrix----
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x01, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x40, 0x00, 0x00, 0x00, // ----end composition matrix----
                0x00, 0x00, 0x00, 0x00, // ----begin pre_defined 6 * 4 bytes----
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, // ----end pre_defined 6 * 4 bytes----
                0xFF, 0xFF, 0xFF, 0xFF, // next_track_ID
            ]));
        };

        // Track Box
        _this.trak = function (track) {
            var tkhd = _this.tkhd(track);
            var mdia = _this.mdia(track);
            return _this.box(types.trak, tkhd, mdia);
        };

        // Track Header Box
        _this.tkhd = function (track) {
            var i = track.id;
            var d = _this.info.Duration * 1000;
            var w = _this.info.Width;
            var h = _this.info.Height;
            if (track.kind === MediaStreamTrack.KindAudio) {
                w = 0;
                h = 0;
            }
            return _this.box(types.tkhd, new Uint8Array([
                0x00, 0x00, 0x00, 0x07, // version(0) + flags
                0x00, 0x00, 0x00, 0x00, // creation_time
                0x00, 0x00, 0x00, 0x00, // modification_time
                (i >>> 24) & 0xFF, (i >>> 16) & 0xFF, (i >>> 8) & 0xFF, i & 0xFF, // track_ID: 4 bytes
                0x00, 0x00, 0x00, 0x00, // reserved: 4 bytes
                (d >>> 24) & 0xFF, (d >>> 16) & 0xFF, (d >>> 8) & 0xFF, d & 0xFF, // duration: 4 bytes
                0x00, 0x00, 0x00, 0x00, // reserved: 2 * 4 bytes
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00, // layer(2bytes) + alternate_group(2bytes)
                0x00, 0x00, 0x00, 0x00, // volume(2bytes) + reserved(2bytes)
                0x00, 0x01, 0x00, 0x00, // ----begin composition matrix----
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x01, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x40, 0x00, 0x00, 0x00, // ----end composition matrix----
                (w >>> 8) & 0xFF, w & 0xFF, // width
                0x00, 0x00,
                (h >>> 8) & 0xFF, h & 0xFF, // height
                0x00, 0x00,
            ]));
        };

        // Media Box
        _this.mdia = function (track) {
            var mdhd = _this.mdhd();
            var hdlr = _this.hdlr(track);
            var minf = _this.minf(track);
            return _this.box(types.mdia, mdhd, hdlr, minf);
        };

        // Media Header Box
        _this.mdhd = function () {
            var t = _this.info.Timescale;
            var d = _this.info.Duration * 1000;
            return _this.box(types.mdhd, new Uint8Array([
                0x00, 0x00, 0x00, 0x00, // version(0) + flags
                0x00, 0x00, 0x00, 0x00, // creation_time
                0x00, 0x00, 0x00, 0x00, // modification_time
                (t >>> 24) & 0xFF, (t >>> 16) & 0xFF, (t >>> 8) & 0xFF, t & 0xFF, // timescale: 4 bytes
                (d >>> 24) & 0xFF, (d >>> 16) & 0xFF, (d >>> 8) & 0xFF, d & 0xFF, // duration: 4 bytes
                0x55, 0xC4,             // language: und (undetermined)
                0x00, 0x00,             // pre_defined = 0
            ]));
        };

        // Media Handler Reference Box
        _this.hdlr = function (track) {
            return _this.box(types.hdlr, track.kind === MediaStreamTrack.KindAudio ? AUDIO_HDLR : VIDEO_HDLR);
        };

        // Media Infomation Box
        _this.minf = function (track) {
            var xmhd;
            if (track.kind === MediaStreamTrack.KindAudio) {
                xmhd = _this.box(types.smhd, SMHD);
            } else {
                xmhd = _this.box(types.vmhd, VMHD);
            }
            var dinf = _this.dinf();
            var stbl = _this.stbl(track);
            return _this.box(types.minf, xmhd, dinf, stbl);
        };

        // Data Infomation Box
        _this.dinf = function () {
            var dref = _this.box(types.dref, DREF);
            return _this.box(types.dinf, dref);
        };

        // Sample Table Box
        _this.stbl = function (track) {
            var stsd = _this.stsd(track);           // Sample Description Table
            var stts = _this.box(types.stts, STTS); // Time-To-Sample
            var stsc = _this.box(types.stsc, STSC); // Sample-To-Chunk
            var stsz = _this.box(types.stsz, STSZ); // Sample size
            var stco = _this.box(types.stco, STCO); // Chunk offset
            return _this.box(types.stbl, stsd, stts, stsc, stsz, stco);
        };

        // Sample Description Box
        _this.stsd = function (track) {
            if (track.kind === MediaStreamTrack.KindAudio) {
                return _this.box(types.stsd, STSD, track.source.kind === 'Opus' ? _this.opus(track) : _this.mp4a(track));
            } else {
                return _this.box(types.stsd, STSD, _this.visualSampleEntry(track));
            }
        };

        _this.mp4a = function (track) {
            var n = track.source.ChannelConfiguration;
            var r = track.source.SamplingFrequency;
            var data = new Uint8Array([
                0x00, 0x00, 0x00, 0x00,       // reserved(4)
                0x00, 0x00, 0x00, 0x01,       // reserved(2) + data_reference_index(2)
                0x00, 0x00, 0x00, 0x00,       // reserved: 2 * 4 bytes
                0x00, 0x00, 0x00, 0x00,
                0x00, n,                      // channelCount(2)
                0x00, 0x10,                   // sampleSize(2)
                0x00, 0x00, 0x00, 0x00,       // reserved(4)
                (r >>> 8) & 0xFF, (r) & 0xFF, // Audio sample rate
                0x00, 0x00
            ]);
            var esds = _this.esds(track);
            return _this.box(types.mp4a, data, esds);
        };

        _this.opus = function (track) {
            var source = track.source;
            var data = new Uint8Array(28);
            var view = new DataView(data.buffer);
            view.setUint16(6, 1);
            view.setUint16(16, source.Channels);
            view.setUint16(18, 16);
            view.setUint32(24, 48000 * 65536);

            var config = new Uint8Array(11);
            var output = new DataView(config.buffer);
            output.setUint8(0, 0);
            output.setUint8(1, source.Channels);
            output.setUint16(2, source.PreSkip);
            output.setUint32(4, source.InputSampleRate);
            output.setInt16(8, source.OutputGain);
            output.setUint8(10, 0);
            return _this.box(types.Opus, data, _this.box(types.dOps, config));
        };

        _this.esds = function (track) {
            var config = track.source.Config;
            var n = config.byteLength;
            var data = new Uint8Array([
                0x00, 0x00, 0x00, 0x00, // version 0 + flags

                0x03,                   // descriptor_type
                0x17 + n,               // length3
                0x00, 0x01,             // es_id
                0x00,                   // stream_priority

                0x04,                   // descriptor_type
                0x0F + n,               // length
                0x40,                   // codec: mpeg4_audio
                0x15,                   // stream_type: Audio
                0x00, 0x00, 0x00,       // buffer_size
                0x00, 0x00, 0x00, 0x00, // maxBitrate
                0x00, 0x00, 0x00, 0x00, // avgBitrate

                0x05,                   // descriptor_type
                n,
            ]);
            return _this.box(types.esds, data, config, new Uint8Array([
                0x06, 0x01, 0x02,       // GASpecificConfig
            ]));
        };

        _this.visualSampleEntry = function (track) {
            var w = _this.info.CodecWidth;
            var h = _this.info.CodecHeight;
            var data = new Uint8Array([
                0x00, 0x00, 0x00, 0x00, // reserved(4)
                0x00, 0x00, 0x00, 0x01, // reserved(2) + data_reference_index(2)
                0x00, 0x00, 0x00, 0x00, // pre_defined(2) + reserved(2)
                0x00, 0x00, 0x00, 0x00, // pre_defined: 3 * 4 bytes
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                (w >>> 8) & 0xFF, w & 0xFF, // width: 2 bytes
                (h >>> 8) & 0xFF, h & 0xFF, // height: 2 bytes
                0x00, 0x48, 0x00, 0x00, // horizresolution: 4 bytes
                0x00, 0x48, 0x00, 0x00, // vertresolution: 4 bytes
                0x00, 0x00, 0x00, 0x00, // reserved: 4 bytes
                0x00, 0x01,             // frame_count
                0x10,                   // strlen
                0x6F, 0x64, 0x64, 0x2E, // compressorname: 32 bytes
                0x6A, 0x73, 0x20, 0xA9,
                0x20, 0x6F, 0x64, 0x64,
                0x65, 0x6E, 0x67, 0x69,
                0x6E, 0x65, 0x2E, 0x63,
                0x6F, 0x6D, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x00, 0x00, 0x00, 0x00,
                0x18,                   // depth
                0xFF, 0xFF,             // pre_defined = -1
            ]);
            var hevc = track.source.kind === 'HEVC';
            var config = _this.box(hevc ? types.hvcC : types.avcC, hevc ? track.source.HVCC : track.source.AVCC);
            return _this.box(hevc ? types[source.SampleEntry || 'hvc1'] : types.avc1, data, config);
        };

        // Track Extends Box
        _this.trex = function (track) {
            var i = track.id;
            return _this.box(types.trex, new Uint8Array([
                0x00, 0x00, 0x00, 0x00, // version(0) + flags
                (i >>> 24) & 0xFF, (i >>> 16) & 0xFF, (i >>> 8) & 0xFF, i & 0xFF, // track_ID
                0x00, 0x00, 0x00, 0x01, // default_sample_description_index
                0x00, 0x00, 0x00, 0x00, // default_sample_duration
                0x00, 0x00, 0x00, 0x00, // default_sample_size
                0x00, 0x01, 0x00, 0x01, // default_sample_flags
            ]));
        };

        // Movie Fragment Box
        _this.moof = function (track, pkt) {
            var mfhd = _this.mfhd(track);
            var traf = _this.traf(track, pkt)
            return _this.box(types.moof, mfhd, traf);
        };

        _this.mfhd = function (track) {
            var n = track.sn;
            var data = new Uint8Array([
                0x00, 0x00, 0x00, 0x00,
                (n >>> 24) & 0xFF, (n >>> 16) & 0xFF, (n >>> 8) & 0xFF, n & 0xFF, // sequence_number: int32
            ]);
            return _this.box(types.mfhd, data);
        };

        // Track Fragment Box
        _this.traf = function (track, pkt) {
            var i = track.id;
            var t = pkt.get('DTS') - _this.info.TimeBase;
            var tfhd = _this.box(types.tfhd, new Uint8Array([
                0x00, 0x00, 0x00, 0x00, // version(0) & flags
                (i >>> 24) & 0xFF, (i >>> 16) & 0xFF, (i >>> 8) & 0xFF, i & 0xFF, // track_ID
            ]));
            var tfdt = _this.box(types.tfdt, new Uint8Array([
                0x00, 0x00, 0x00, 0x00, // version(0) & flags
                (t >>> 24) & 0xFF, (t >>> 16) & 0xFF, (t >>> 8) & 0xFF, t & 0xFF, // baseMediaDecodeTime: int32
            ]));
            var trun = _this.trun(track, pkt);
            var sdtp = _this.sdtp(track);
            return _this.box(types.traf, tfhd, tfdt, trun, sdtp);
        };

        // Track Fragment Run Box
        _this.trun = function (track, pkt) {
            var source = track.source;
            var d = pkt.get('Duration') || source.RefSampleDuration;
            var n = pkt.get('Data').byteLength;
            var f = source.Flags;
            var t = pkt.get('CTS');
            return _this.box(types.trun, new Uint8Array([
                0x01, 0x00, 0x0F, 0x01,               // version(1, signed CTS) & flags
                0x00, 0x00, 0x00, 0x01,               // sample_count
                0x00, 0x00, 0x00, 0x79,               // data_offset
                (d >>> 24), (d >>> 16), (d >>> 8), d, // sample_duration
                (n >>> 24), (n >>> 16), (n >>> 8), n, // sample_size
                (f.IsLeading << 2) | f.SampleDependsOn,
                (f.SampleIsDependedOn << 6) | (f.SampleHasRedundancy << 4) | f.IsNonSync, // sample_flags
                0x00, 0x00,                           // sample_degradation_priority
                (t >>> 24), (t >>> 16), (t >>> 8), t, // sample_composition_time_offset
            ]));
        };

        // Sample Dependency Type Box
        _this.sdtp = function (track) {
            var f = track.source.Flags;
            return _this.box(types.sdtp, new Uint8Array([
                0x00, 0x00, 0x00, 0x00,     // version(0) + flags
                f.IsLeading << 6 |          // is_leading            (2 bits)
                f.SampleDependsOn << 4 |    // sample_depends_on     (2 bits)
                f.SampleIsDependedOn << 2 | // sample_is_depended_on (2 bits)
                f.SampleHasRedundancy,      // sample_has_redundancy (2 bits)
            ]));
        };

        _this.mdat = function (data) {
            return _this.box(types.mdat, data);
        };

        _this.reset = function () {
            _init();
            _this.close();
        };

        _init();
    }

    FMP4.prototype = Object.create(MediaStream.prototype);
    FMP4.prototype.constructor = FMP4;
    FMP4.prototype.kind = 'FMP4';

    function recordingBoxes(bytes, begin, end, visit) {
        var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), count = 0;
        for (var offset = begin; offset < end;) {
            if (++count > 4096 || end - offset < 8) { throw { name: 'DataError', message: 'Invalid recording box boundaries.' }; }
            var size = view.getUint32(offset), header = 8;
            if (size === 1) {
                if (end - offset < 16 || view.getUint32(offset + 8) !== 0) { throw { name: 'NotSupportedError', message: 'Recording box is too large.' }; }
                size = view.getUint32(offset + 12); header = 16;
            } else if (size === 0) { size = end - offset; }
            if (size < header || size > end - offset) { throw { name: 'DataError', message: 'Incomplete recording box.' }; }
            var type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7]);
            visit(type, offset + header, offset + size, view);
            offset += size;
        }
    }

    FMP4.recordingTracks = function (bytes) {
        var tracks = Object.create(null), defaults = Object.create(null), count = 0, root = false;
        recordingBoxes(bytes, 0, bytes.length, function (type, begin, end) {
            if (type !== 'moov' || root) { throw { name: 'DataError', message: 'A recording initialization box is required.' }; }
            root = true;
            recordingBoxes(bytes, begin, end, function (type, begin, end) {
                if (type === 'trak') {
                    if (++count > 64) { throw { name: 'NotSupportedError', message: 'Too many recording tracks.' }; }
                    var id, kind;
                    recordingBoxes(bytes, begin, end, function (type, begin, end, view) {
                        if (type === 'tkhd') {
                            var offset = begin + (bytes[begin] === 1 ? 20 : 12);
                            if (offset + 4 > end || bytes[begin] > 1) { throw { name: 'DataError', message: 'Invalid recording track header.' }; }
                            id = view.getUint32(offset);
                        } else if (type === 'mdia') {
                            recordingBoxes(bytes, begin, end, function (type, begin, end) {
                                if (type === 'hdlr') {
                                    if (end - begin < 12) { throw { name: 'DataError', message: 'Invalid recording handler.' }; }
                                    kind = String.fromCharCode.apply(null, bytes.subarray(begin + 8, begin + 12));
                                }
                            });
                        }
                    });
                    if (!id || tracks[id] || (kind !== 'vide' && kind !== 'soun')) { throw { name: 'NotSupportedError', message: 'Unsupported recording track layout.' }; }
                    tracks[id] = { kind: kind, flags: null, size: 0 };
                } else if (type === 'mvex') {
                    recordingBoxes(bytes, begin, end, function (type, begin, end, view) {
                        if (type !== 'trex') { return; }
                        if (end - begin < 24) { throw { name: 'DataError', message: 'Invalid recording fragment defaults.' }; }
                        defaults[view.getUint32(begin + 4)] = { size: view.getUint32(begin + 16), flags: view.getUint32(begin + 20) };
                    });
                }
            });
        });
        if (!root || !count) { throw { name: 'DataError', message: 'No recording tracks were found.' }; }
        Object.keys(tracks).forEach(function (id) { if (defaults[id]) { tracks[id].flags = defaults[id].flags; tracks[id].size = defaults[id].size; } });
        return tracks;
    };

    FMP4.recordingFragment = function (bytes, tracks) {
        var video = Object.keys(tracks).filter(function (id) { return tracks[id].kind === 'vide'; }),
            seen = Object.create(null), ranges = [], previousEnd = 0;
        recordingBoxes(bytes, 0, bytes.length, function (type, begin, end) {
            if (type !== 'moof') { throw { name: 'DataError', message: 'A recording fragment header is required.' }; }
            recordingBoxes(bytes, begin, end, function (type, begin, end) {
                if (type !== 'traf') { return; }
                var id, defaults, defaultSize, first, base = previousEnd, runEnd;
                recordingBoxes(bytes, begin, end, function (type, begin, end, view) {
                    if (type !== 'tfhd' && type !== 'trun') { return; }
                    if (end - begin < 8) { throw { name: 'DataError', message: 'Invalid recording fragment header.' }; }
                    var flags = view.getUint32(begin) & 0xffffff, offset = begin + 8;
                    if (type === 'tfhd') {
                        id = view.getUint32(begin + 4);
                        if (!tracks[id] || flags & 1) { throw { name: 'NotSupportedError', message: 'Recording needs fragment-relative media offsets.' }; }
                        if (flags & 0x20000) { base = 0; }
                        defaults = tracks[id].flags;
                        defaultSize = tracks[id].size;
                        offset += (flags & 2 ? 4 : 0) + (flags & 8 ? 4 : 0);
                        if (flags & 16) {
                            if (offset + 4 > end) { throw { name: 'DataError', message: 'Incomplete recording sample size.' }; }
                            defaultSize = view.getUint32(offset); offset += 4;
                        }
                        if (flags & 32) {
                            if (offset + 4 > end) { throw { name: 'DataError', message: 'Incomplete recording sample flags.' }; }
                            defaults = view.getUint32(offset); offset += 4;
                        }
                        if (offset > end) { throw { name: 'DataError', message: 'Incomplete recording track defaults.' }; }
                    } else {
                        var count = view.getUint32(begin + 4);
                        if (!count) { return; }
                        if (!id || ranges.length >= 4096 || (flags & 4 && flags & 0x400)) {
                            throw { name: 'NotSupportedError', message: 'Unsupported recording fragment run layout.' };
                        }
                        var start = runEnd, sampleFlags = defaults;
                        if (flags & 1) {
                            if (offset + 4 > end) { throw { name: 'DataError', message: 'Incomplete recording data offset.' }; }
                            start = base + view.getInt32(offset); offset += 4;
                        }
                        if (flags & 4) {
                            if (offset + 4 > end) { throw { name: 'DataError', message: 'Incomplete recording first-sample flags.' }; }
                            sampleFlags = view.getUint32(offset); offset += 4;
                        }
                        var stride = (flags & 0x100 ? 4 : 0) + (flags & 0x200 ? 4 : 0) + (flags & 0x400 ? 4 : 0) + (flags & 0x800 ? 4 : 0);
                        if (count * stride > end - offset || start === undefined || start < bytes.length) {
                            throw { name: 'NotSupportedError', message: 'Recording needs explicit complete fragment sample ranges.' };
                        }
                        if (flags & 0x400) { sampleFlags = view.getUint32(offset + (flags & 0x100 ? 4 : 0) + (flags & 0x200 ? 4 : 0)); }
                        if (first === undefined) { first = sampleFlags; }
                        var size = count * defaultSize;
                        if (flags & 0x200) {
                            size = 0;
                            for (var i = 0; i < count; i++) { size += view.getUint32(offset + (flags & 0x100 ? 4 : 0) + i * stride); }
                        }
                        if (!Number.isSafeInteger(size) || size <= 0 || !Number.isSafeInteger(start + size)) {
                            throw { name: 'DataError', message: 'Invalid recording sample range.' };
                        }
                        runEnd = start + size;
                        ranges.push({ start: start, end: runEnd });
                    }
                });
                if (runEnd !== undefined) { previousEnd = runEnd; }
                if (id && first !== undefined && seen[id] === undefined) {
                    seen[id] = first !== null && !(first & 0x10000) && ((first >>> 24) & 3) !== 1;
                }
            });
        });
        return { ranges: ranges, independent: ranges.length > 0 && (video.length ? video.every(function (id) { return seen[id] === true; }) : true) };
    };

    FMP4.recordingBody = function (header, body, ranges, totalLength) {
        var view = new DataView(body.buffer, body.byteOffset, body.byteLength),
            begin = header.byteLength + (view.getUint32(0) === 1 ? 16 : 8), end = header.byteLength + (totalLength || body.byteLength);
        if (!ranges.length || ranges.some(function (range) { return range.start < begin || range.end > end; })) {
            throw { name: 'NotSupportedError', message: 'Recording requires all fragment samples in one complete mdat body.' };
        }
    };

    FMP4.merge = function () {
        var args = Array.prototype.slice.call(arguments, 0);
        var size = 0;
        for (var i = 0; i < args.length; i++) {
            size += args[i].byteLength;
        }

        var pos = 0;
        var data = new Uint8Array(size);
        for (var i = 0; i < args.length; i++) {
            data.set(args[i], pos);
            pos += args[i].byteLength;
        }
        return data;
    };

    FMP4.parseDescriptor = function (buffer) {
        var v = new Uint8Array(buffer);
        var sw_type = 0,
            sw_size_0 = 1,
            sw_size_1 = 2,
            sw_size_2 = 3,
            sw_size_3 = 4,
            sw_data = 5;
        var state = sw_type;
        var o = {};
        var e;

        for (var i = 0; i < v.byteLength; i++) {
            switch (state) {
                case sw_type:
                    e = {
                        type: v[i],
                        size: 0,
                        data: undefined,
                    };
                    o[e.type] = e;
                    state = sw_size_0;
                    break;

                case sw_size_0:
                case sw_size_1:
                case sw_size_2:
                case sw_size_3:
                    var b = v[i];
                    if (e) {
                        e.size = (e.size << 7) | (b & 0x7F);
                    }
                    if (b & 0x80) {
                        state++;
                    } else {
                        state = sw_data;
                    }
                    break;

                case sw_data:
                    if (e) {
                        e.data = v.subarray(i, i + e.size);
                        i += e.size - 1;
                    }
                    state = sw_type;
                    break;

                default:
                    throw { name: 'InvalidStateError', message: 'Invalid state while parsing fmp4 descriptor.' };
            }
        }
        return o;
    };

    Format.FMP4 = FMP4;
})(odd);

