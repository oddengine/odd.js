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
            avc1: [], avcC: [], btrt: [], dinf: [],
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
            0x61, 0x76, 0x63, 0x31, // avc1
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
        STSC = STCO = STTS,
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

    function FMP4(logger) {
        MediaStream.call(this, 'FMP4', { logger: logger }, [MediaEvent.PACKET], [Event.ERROR]);

        var _this = this,
            _logger = logger,
            _packet;

        function _init() {
            _packet = new AV.Packet();
            _packet.state = sw.size0;
        }

        _this.append = function (buffer) {
            var data = new Uint8Array(buffer);
            for (var i = 0; i < data.byteLength; /* void */) {
                try {
                    i += _parse(_packet, data, i);
                } catch (err) {
                    _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
                    break;
                }
                if (_packet.state === sw.complete) {
                    _this.dispatchEvent(MediaEvent.PACKET, { packet: _packet });
                    _packet = new AV.Packet();
                    _packet.state = sw.size0;
                }
            }
        };

        function _parse(dst, data, byteOffset) {
            for (var i = byteOffset; i < data.byteLength; i++) {
                switch (dst.state) {
                    case sw.size0:
                        dst.length = data[i] << 24;
                        dst.state = sw.size1;
                        break;

                    case sw.size1:
                        dst.length |= data[i] << 16;
                        dst.state = sw.size2;
                        break;

                    case sw.size2:
                        dst.length |= data[i] << 8;
                        dst.state = sw.size3;
                        break;

                    case sw.size3:
                        dst.length |= data[i];
                        dst.payload = new Uint8Array(dst.length);
                        dst.payload.set([dst.length >> 24, dst.length >> 16, dst.length >> 8, dst.length], dst.position);
                        dst.position += 4;
                        dst.state = sw.type0;
                        break;

                    case sw.type0:
                        dst.set('Type', String.fromCharCode(data[i]));
                        dst.payload.set([data[i]], dst.position++);
                        dst.state = sw.type1;
                        break;

                    case sw.type1:
                        dst.set('Type', dst.get('Type') + String.fromCharCode(data[i]));
                        dst.payload.set([data[i]], dst.position++);
                        dst.state = sw.type2;
                        break;

                    case sw.type2:
                        dst.set('Type', dst.get('Type') + String.fromCharCode(data[i]));
                        dst.payload.set([data[i]], dst.position++);
                        dst.state = sw.type3;
                        break;

                    case sw.type3:
                        dst.set('Type', dst.get('Type') + String.fromCharCode(data[i]));
                        dst.payload.set([data[i]], dst.position++);
                        dst.state = sw.payload;
                        break;

                    case sw.payload:
                        var n = Math.min(dst.length - dst.position, data.byteLength - i);
                        dst.payload.set(data.subarray(i, i + n), dst.position);
                        dst.position += n;
                        i += n;
                        if (dst.position === dst.length) {
                            dst.state = sw.complete;

                            var type = dst.get('Type');
                            var offset = 8;
                            switch (type) {
                                case 'stsd':
                                    offset += 8;
                                    break;
                                case 'avc1':
                                    offset += 78;
                                    break;
                                case 'mp4a':
                                    offset += 28;
                                    break;
                            }
                            switch (type) {
                                case 'moov':
                                case 'trak':
                                case 'mdia':
                                case 'minf':
                                case 'stbl':
                                case 'stsd':
                                case 'avc1':
                                case 'mp4a':
                                    var content = new Uint8Array(dst.payload.buffer, offset);
                                    for (var j = 0; j < content.byteLength; /* void */) {
                                        var sub = new AV.Packet();
                                        sub.state = sw.size0;
                                        j += _parse(sub, content, j);
                                    }
                                    break;
                                case 'avcC':
                                    var content = new Uint8Array(dst.payload.buffer, offset);
                                    var codec = "avc1.";
                                    utils.forEach(content.subarray(1, 4), function (j, c) {
                                        var hex = utils.padStart(c.toString(16), 2, '0');
                                        codec += hex;
                                    });
                                    _this.info.MimeType = 'video/mp4';
                                    _this.info.Codecs.push(codec);
                                    break;
                                case 'esds':
                                    var content = new Uint8Array(dst.payload.buffer, offset);
                                    var codec = 'mp4a.40.';
                                    var o = FMP4.parseDescriptor(content.subarray(4));
                                    if (o[3] && o[3].data) {
                                        o = FMP4.parseDescriptor(o[3].data.subarray(3));
                                        if (o[4] && o[4].data) {
                                            o = FMP4.parseDescriptor(o[4].data.subarray(13));
                                            if (o[5] && o[5].data) {
                                                codec += o[5].data[0] >> 3;
                                            }
                                        }
                                    }
                                    if (!_this.info.MimeType) {
                                        _this.info.MimeType = 'video/mp4';
                                    }
                                    _this.info.Codecs.push(codec);
                                    break;
                            }
                        }
                        return i - byteOffset;

                    default:
                        throw { name: 'InvalidStateError', message: 'Invalid state while parsing fmp4 box.' };
                }
            }
            return data.byteLength - byteOffset;
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

            var delta = pkt.get('DTS') - _this.info.TimeBase - track.timestamp;
            track.timestamp += source.RefSampleDuration + delta;

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
                return _this.box(types.stsd, STSD, _this.mp4a(track));
            } else {
                return _this.box(types.stsd, STSD, _this.avc1(track));
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

        _this.avc1 = function (track) {
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
            var avcc = _this.box(types.avcC, track.source.AVCC);
            return _this.box(types.avc1, data, avcc);
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
            var t = track.timestamp - _this.info.TimeBase;
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
            var delta = pkt.get('DTS') - _this.info.TimeBase - track.timestamp;
            var d = source.RefSampleDuration + delta;
            var n = pkt.get('Data').byteLength;
            var f = source.Flags;
            var t = pkt.get('CTS');
            return _this.box(types.trun, new Uint8Array([
                0x00, 0x00, 0x0F, 0x01,               // version(0) & flags
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

