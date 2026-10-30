(function(odd) {
    var AV = odd.AV, FMP4 = AV.Format.FMP4, HEVC = AV.Codec.HEVC;
    function fail(message) {
        throw {
            name: 'DataError',
            message: message
        };
    }
    function boxes(data, begin, end) {
        var result = [], view = new DataView(data.buffer, data.byteOffset, data.byteLength);
        for (var p = begin; p < end; ) {
            if (end - p < 8 || result.length >= 4096) {
                fail('Invalid MP4 box boundaries.');
            }
            var size = view.getUint32(p), header = 8;
            if (size === 1) {
                if (end - p < 16) {
                    fail('Incomplete extended MP4 header.');
                }
                size = view.getUint32(p + 8) * 4294967296 + view.getUint32(p + 12);
                header = 16;
            } else if (!size) {
                size = end - p;
            }
            if (!Number.isSafeInteger(size) || size < header || p + size > end) {
                fail('Incomplete MP4 box.');
            }
            result.push({
                type: String.fromCharCode.apply(null, data.subarray(p + 4, p + 8)),
                start: p,
                begin: p + header,
                end: p + size
            });
            p += size;
        }
        return result;
    }
    function child(data, parent, type) {
        return boxes(data, parent.begin, parent.end).find(function(box) {
            return box.type === type;
        });
    }
    function requireBox(box, bytes) {
        if (!box || box.end - box.begin < bytes) {
            fail('Missing or incomplete MP4 track metadata.');
        }
        return box.begin;
    }
    function u64(view, p) {
        var n = view.getUint32(p) * 4294967296 + view.getUint32(p + 4);
        if (!Number.isSafeInteger(n)) {
            fail('MP4 timestamp/offset exceeds exact integer range.');
        }
        return n;
    }
    function makeBox(type, payload) {
        var data = new Uint8Array(8 + payload.length), view = new DataView(data.buffer);
        view.setUint32(0, data.length);
        for (var n = 0; n < 4; n++) {
            data[4 + n] = type.charCodeAt(n);
        }
        data.set(payload, 8);
        return data;
    }
    function concat(parts) {
        return FMP4.merge.apply(null, parts);
    }
    function fields(size) {
        var bytes = new Uint8Array(size);
        return {
            bytes: bytes,
            view: new DataView(bytes.buffer)
        };
    }
    FMP4.inspect = function(data, logger) {
        var view = new DataView(data.buffer, data.byteOffset, data.byteLength), root = boxes(data, 0, data.length)[0];
        if (!root || root.type !== 'moov') {
            fail('Expected MP4 initialization.');
        }
        var children = boxes(data, root.begin, root.end), tracks = [], defaults = {}, movieScale = 1e3;
        var mvhd = children.find(function(b) {
            return b.type === 'mvhd';
        });
        if (mvhd) {
            var m = requireBox(mvhd, data[mvhd.begin] === 1 ? 32 : 20);
            movieScale = view.getUint32(m + (data[m] === 1 ? 20 : 12));
        }
        var mvex = children.find(function(b) {
            return b.type === 'mvex';
        });
        if (!mvex) {
            throw {
                name: 'NotSupportedError',
                message: 'FMP4 playback requires fragmented MP4 (mvex).'
            };
        }
        boxes(data, mvex.begin, mvex.end).forEach(function(box) {
            if (box.type !== 'trex') {
                return;
            }
            var p = requireBox(box, 24);
            defaults[view.getUint32(p + 4)] = {
                duration: view.getUint32(p + 12),
                size: view.getUint32(p + 16),
                flags: view.getUint32(p + 20),
                raw: data.slice(box.start, box.end)
            };
        });
        children.filter(function(b) {
            return b.type === 'trak';
        }).forEach(function(trak) {
            if (tracks.length >= 2) {
                throw {
                    name: 'NotSupportedError',
                    message: 'Only one video and one audio track are supported.'
                };
            }
            var tkhd = child(data, trak, 'tkhd'), t = requireBox(tkhd, 24), id = view.getUint32(t + (data[t] === 1 ? 20 : 12));
            var mdia = child(data, trak, 'mdia');
            requireBox(mdia, 8);
            var mdhd = child(data, mdia, 'mdhd'), h = requireBox(mdhd, data[mdhd?.begin] === 1 ? 32 : 20);
            var timescale = view.getUint32(h + (data[h] === 1 ? 20 : 12));
            if (!id || !timescale || tracks.some(function(track) {
                return track.id === id;
            })) {
                fail('Invalid MP4 track ID or timescale.');
            }
            var minf = child(data, mdia, 'minf');
            requireBox(minf, 8);
            var stbl = child(data, minf, 'stbl');
            requireBox(stbl, 8);
            var stsd = child(data, stbl, 'stsd'), s = requireBox(stsd, 8);
            if (view.getUint32(s + 4) !== 1) {
                throw {
                    name: 'NotSupportedError',
                    message: 'Multiple MP4 sample descriptions are unsupported.'
                };
            }
            var entry = boxes(data, s + 8, stsd.end)[0];
            var video = [ 'hvc1', 'hev1', 'avc1', 'avc3' ].indexOf(entry?.type) >= 0;
            var audio = entry && [ 'mp4a', 'Opus' ].indexOf(entry.type) >= 0;
            if (!video && !audio) {
                throw {
                    name: 'NotSupportedError',
                    message: 'Unsupported/encrypted MP4 sample entry.'
                };
            }
            var base = requireBox(entry, video ? 78 : 28), track = {
                id: id,
                kind: video ? 'video' : 'audio',
                timescale: timescale,
                entry: entry.type,
                offset: 0,
                raw: data.slice(trak.start, trak.end),
                defaults: defaults[id] || {
                    duration: 0,
                    size: 0,
                    flags: 0
                }
            };
            if (tracks.some(function(item) {
                return item.kind === track.kind;
            })) {
                fail('Duplicate MP4 media kind.');
            }
            var sub = boxes(data, base + (video ? 78 : 28), entry.end);
            function config(type) {
                var box = sub.find(function(b) {
                    return b.type === type;
                });
                requireBox(box, 1);
                return data.slice(box.begin, box.end);
            }
            if (video) {
                track.width = view.getUint16(base + 24);
                track.height = view.getUint16(base + 26);
                if (entry.type === 'hvc1' || entry.type === 'hev1') {
                    track.config = config('hvcC');
                    track.lengthSize = (track.config[21] & 3) + 1;
                    var source = new HEVC(new AV.Information, logger), pkt = new AV.Packet;
                    pkt.payload = track.config;
                    pkt.position = pkt.timestamp = 0;
                    pkt.set('DataType', 0);
                    source.parse(pkt);
                    track.codec = source.Codec.replace('hvc1', entry.type);
                } else {
                    track.config = config('avcC');
                    track.codec = entry.type + '.' + Array.from(track.config.subarray(1, 4)).map(function(b) {
                        return ('0' + b.toString(16)).slice(-2);
                    }).join('');
                }
            } else if (entry.type === 'Opus') {
                track.config = config('dOps');
                track.codec = 'opus';
            } else {
                var esds = config('esds'), descriptors = FMP4.parseDescriptor(esds.subarray(4));
                if (descriptors[3]) {
                    descriptors = FMP4.parseDescriptor(descriptors[3].data.subarray(3));
                }
                if (descriptors[4]) {
                    descriptors = FMP4.parseDescriptor(descriptors[4].data.subarray(13));
                }
                if (!descriptors[5]) {
                    fail('Missing AAC decoder configuration.');
                }
                track.config = new Uint8Array(descriptors[5].data);
                track.codec = 'mp4a.40.' + (track.config[0] >> 3);
            }
            var edts = child(data, trak, 'edts');
            if (edts) {
                var elst = child(data, edts, 'elst'), p = requireBox(elst, 8), version = data[p], count = view.getUint32(p + 4), elapsed = 0;
                p += 8;
                if (version > 1 || count > 2 || !movieScale) {
                    fail('Unsupported MP4 edit list.');
                }
                for (var n = 0; n < count; n++) {
                    var size = version ? 20 : 12;
                    if (p + size > elst.end) {
                        fail('Truncated edit list.');
                    }
                    var duration = version ? u64(view, p) : view.getUint32(p), media = version ? view.getInt32(p + 8) === -1 ? -1 : u64(view, p + 8) : view.getInt32(p + 4);
                    if (view.getInt16(p + size - 4) !== 1 || view.getInt16(p + size - 2) !== 0) {
                        fail('Unsupported MP4 edit rate.');
                    }
                    if (media === -1) {
                        elapsed += duration / movieScale;
                    } else {
                        track.offset = elapsed - media / timescale;
                    }
                    p += size;
                }
            }
            tracks.push(track);
        });
        tracks.forEach(function(track) {
            if (track.kind !== 'audio') {
                return;
            }
            var parts = children.filter(function(b) {
                return b.type === 'mvhd';
            }).map(function(b) {
                return data.slice(b.start, b.end);
            });
            parts.push(track.raw);
            if (track.defaults.raw) {
                parts.push(makeBox('mvex', track.defaults.raw));
            }
            track.init = makeBox('moov', concat(parts));
        });
        return tracks;
    };
    FMP4.fragment = function(bytes, tracks, origin, nextTimes) {
        var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), root = boxes(bytes, 0, bytes.length)[0], samples = [], implicitBase = origin;
        if (!root || root.type !== 'moof') {
            fail('Expected MP4 fragment.');
        }
        boxes(bytes, root.begin, root.end).filter(function(b) {
            return b.type === 'traf';
        }).forEach(function(traf) {
            var header = child(bytes, traf, 'tfhd'), p = requireBox(header, 8), flags = view.getUint32(p) & 16777215;
            var id = view.getUint32(p + 4), track = tracks.find(function(t) {
                return t.id === id;
            });
            if (!track) {
                fail('Fragment has no initialized track.');
            }
            var base = flags & 131072 ? origin : implicitBase, duration = track.defaults.duration, size = track.defaults.size, sf = track.defaults.flags;
            p += 8;
            function word() {
                if (p + 4 > header.end) {
                    fail('Truncated tfhd.');
                }
                var v = view.getUint32(p);
                p += 4;
                return v;
            }
            if (flags & 1) {
                if (p + 8 > header.end) {
                    fail('Truncated base offset.');
                }
                base = u64(view, p);
                p += 8;
            }
            if (flags & 2 && word() !== 1) {
                fail('Unsupported sample description index.');
            }
            if (flags & 8) {
                duration = word();
            }
            if (flags & 16) {
                size = word();
            }
            if (flags & 32) {
                sf = word();
            }
            var tfdt = child(bytes, traf, 'tfdt'), dts = nextTimes[id];
            if (tfdt) {
                p = requireBox(tfdt, bytes[tfdt.begin] === 1 ? 12 : 8);
                if (bytes[p] > 1) {
                    fail('Invalid tfdt version.');
                }
                dts = bytes[p] === 1 ? u64(view, p + 4) : view.getUint32(p + 4);
            }
            if (!Number.isFinite(dts)) {
                fail('First fragment requires a decode timestamp.');
            }
            var end;
            boxes(bytes, traf.begin, traf.end).filter(function(b) {
                return b.type === 'trun';
            }).forEach(function(run) {
                p = requireBox(run, 8);
                var version = bytes[p], f = view.getUint32(p) & 16777215, count = view.getUint32(p + 4);
                p += 8;
                if (version > 1 || count > 1e5 || samples.length + count > 1e5 || f & 4 && f & 1024) {
                    fail('Invalid MP4 sample run.');
                }
                function value(signed) {
                    if (p + 4 > run.end) {
                        fail('Truncated sample run.');
                    }
                    var v = signed ? view.getInt32(p) : view.getUint32(p);
                    p += 4;
                    return v;
                }
                var position = f & 1 ? base + value(true) : end, first = f & 4 ? value(false) : sf;
                if (position === undefined) {
                    position = base;
                }
                for (var n = 0; n < count; n++) {
                    var dur = f & 256 ? value(false) : duration, length = f & 512 ? value(false) : size, sampleFlags = f & 1024 ? value(false) : n === 0 ? first : sf, cts = f & 2048 ? value(version === 1) : 0;
                    if (!dur || !length || length > 67108864 || position < origin + bytes.length || !Number.isSafeInteger(position + length) || !Number.isSafeInteger(dts + dur)) {
                        fail('Invalid fragment sample range/duration.');
                    }
                    samples.push({
                        track: track,
                        position: position,
                        size: length,
                        decodeTime: dts,
                        durationUnits: dur,
                        cts: cts,
                        dts: dts / track.timescale + track.offset,
                        pts: (dts + cts) / track.timescale + track.offset,
                        duration: dur / track.timescale,
                        flags: sampleFlags
                    });
                    position += length;
                    dts += dur;
                }
                end = position;
            });
            nextTimes[id] = dts;
            if (end !== undefined) {
                implicitBase = end;
            }
        });
        samples.sort(function(a, b) {
            return a.position - b.position;
        });
        for (var i = 1; i < samples.length; i++) {
            if (samples[i].position < samples[i - 1].position + samples[i - 1].size) {
                fail('Overlapping MP4 samples.');
            }
        }
        return samples;
    };
    // One audio sample, keeping the original track ID/timebase and initialization.
        FMP4.sampleSegment = function(sample, sequence) {
        var mf = fields(8);
        mf.view.setUint32(4, sequence);
        var hd = fields(8);
        hd.view.setUint32(0, 131072);
        hd.view.setUint32(4, sample.track.id);
        var dt = fields(12);
        dt.bytes[0] = 1;
        dt.view.setUint32(4, Math.floor(sample.decodeTime / 4294967296));
        dt.view.setUint32(8, sample.decodeTime >>> 0);
        var run = fields(28);
        run.view.setUint32(0, 16781057);
        run.view.setUint32(4, 1);
        run.view.setUint32(12, sample.durationUnits);
        run.view.setUint32(16, sample.data.length);
        run.view.setUint32(20, sample.flags || 0);
        run.view.setInt32(24, sample.cts || 0);
        function moof() {
            return makeBox('moof', concat([ makeBox('mfhd', mf.bytes), makeBox('traf', concat([ makeBox('tfhd', hd.bytes), makeBox('tfdt', dt.bytes), makeBox('trun', run.bytes) ])) ]));
        }
        var head = moof();
        run.view.setUint32(8, head.length + 8);
        return concat([ moof(), makeBox('mdat', sample.data) ]);
    };
    FMP4.ftyp = function() {
        return makeBox('ftyp', new Uint8Array([ 105, 115, 111, 54, 0, 0, 0, 1, 105, 115, 111, 54, 109, 112, 52, 49 ]));
    };
    function Samples(tracks, callback, maxPacketBytes) {
        var pending = [], index = 0, current = null, copied = 0, nextTimes = {};
        maxPacketBytes = maxPacketBytes || 16777216;
        this.append = function(packet) {
            var type = packet.get('Type'), data = packet.payload, offset = packet.get('Offset');
            if (type === 'moof') {
                if (index < pending.length) {
                    fail('Missing media data before next fragment.');
                }
                pending = FMP4.fragment(data, tracks, offset, nextTimes);
                index = 0;
            } else if (type === 'mdat') {
                var begin = packet.get('BodyOffset'), end = offset + data.length;
                while (index < pending.length) {
                    var sample = pending[index], at = sample.position + copied;
                    if (at >= end) {
                        break;
                    }
                    if (at < Math.max(offset, begin)) {
                        fail('Media sample bytes are missing.');
                    }
                    if (!current) {
                        if (sample.size > maxPacketBytes) { throw { name: 'QuotaExceededError', message: 'MP4 sample exceeds decoder input budget.' }; }
                        current = new Uint8Array(sample.size);
                    }
                    var n = Math.min(end - at, sample.size - copied);
                    current.set(data.subarray(at - offset, at - offset + n), copied);
                    copied += n;
                    if (copied < sample.size) {
                        break;
                    }
                    sample.data = current;
                    current = null;
                    copied = 0;
                    index++;
                    if (sample.track.kind === 'video' && sample.track.lengthSize) {
                        Object.assign(sample, HEVC.inspect(sample.data, sample.track.lengthSize));
                    }
                    callback(sample);
                }
            }
        };
        this.complete = function() {
            return index === pending.length && !current;
        };
    }
    FMP4.Samples = Samples;
})(odd);
