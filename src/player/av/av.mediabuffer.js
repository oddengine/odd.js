(function(odd) {
    // Own compressed access units only. Decoder output belongs to the worker's
    // bounded presentation pool and never enters this seek history.
    function MediaBuffer(config) {
        var video = [], audio = [], base = 0, next = 0, bytes = 0;
        var ranges = [], dirty = true;
        function size(sample) {
            return sample.data.byteLength + (sample.segment ? sample.segment.byteLength : 0);
        }
        this.append = function(sample) {
            sample.id = next++;
            if (sample.track.kind === 'video') {
                sample.sequence = base + video.length;
                var previous = video[video.length - 1];
                // FLV has no per-sample duration. MP4 already provides one.
                                if (previous && !previous.durationUnits && sample.dts > previous.dts && sample.dts - previous.dts < 1) {
                    previous.duration = sample.dts - previous.dts;
                    sample.duration = previous.duration;
                }
                video.push(sample);
                dirty = true;
            } else {
                audio.push(sample);
            }
            bytes += size(sample);
        };
        this.video = function(index) {
            return video[index - base];
        };
        this.first = function() {
            return video[0];
        };
        this.last = function() {
            return video[video.length - 1];
        };
        this.audio = function() {
            return audio;
        };
        this.bytes = function() {
            return bytes;
        };
        this.range = function(time) {
            if (dirty) {
                ranges = [];
                var range;
                for (var i = 0; i < video.length; i++) {
                    var sample = video[i], previous = video[i - 1];
                    if (previous && sample.dts - previous.dts > Math.max(.25, previous.duration * 3)) {
                        range = null;
                    }
                    if (!range) {
                        if (!sample.rap) {
                            continue;
                        }
                        range = {
                            start: sample.pts,
                            end: sample.pts + sample.duration
                        };
                        ranges.push(range);
                    }
                    range.end = Math.max(range.end, sample.pts + sample.duration);
                }
                dirty = false;
            }
            return ranges.find(function(range) {
                return range.end > time;
            }) || ranges[ranges.length - 1] || {
                start: 0,
                end: 0
            };
        };
        this.rap = function(time, after) {
            var result = null;
            for (var i = 0; i < video.length; i++) {
                var packet = video[i];
                if (!packet.rap) {
                    continue;
                }
                if (after) {
                    if (packet.pts >= time) {
                        return packet;
                    }
                } else if (packet.pts <= time) {
                    result = packet;
                }
            }
            return result;
        };
        this.prune = function(time, configured) {
            var cutoff = time - config.maxPlaybackLength, index = 0, removed = 0;
            for (var i = 0; i < video.length; i++) {
                var sample = video[i];
                // Never evict a future GOP or the one needed by the playhead.
                                if (sample.pts > time && sample.rap) {
                    break;
                }
                if (sample.rap && i > 0 && (video[index].pts < cutoff || bytes - removed > config.hevc.maxEncodedBytes)) {
                    index = i;
                }
                if (i < video.length - 1) {
                    removed += size(sample);
                }
            }
            if (index) {
                for (var n = 0; n < index; n++) {
                    bytes -= size(video[n]);
                }
                video = video.slice(index);
                base += index;
                dirty = true;
            }
            var start = video.length ? video[0].dts : time - (configured ? config.maxPlaybackLength : 1), count = 0;
            while (count < audio.length && audio[count].pts + audio[count].duration < start) {
                bytes -= size(audio[count++]);
            }
            if (count) {
                audio = audio.slice(count);
            }
            if (bytes > config.hevc.maxEncodedBytes) {
                throw {
                    name: 'QuotaExceededError',
                    message: 'Compressed media exceeds its byte budget before a safe GOP can be discarded.'
                };
            }
        };
        this.clear = function() {
            video = [];
            audio = [];
            ranges = [];
            base = next = bytes = 0;
            dirty = true;
        };
    }
    odd.AV.MediaBuffer = MediaBuffer;
})(odd);
