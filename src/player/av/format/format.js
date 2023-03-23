(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        MediaStreamTrackEvent = events.MediaStreamTrackEvent,
        AV = odd.AV,
        Information = AV.Information,

        Format = {},
        _formats = [];

    function MediaStreamTrack(kind, source, logger) {
        EventDispatcher.call(this, 'MediaStreamTrack', { logger: logger });

        var _this = this,
            _logger = logger;

        function _init() {
            _this.id = 0;
            _this.kind = kind;
            _this.source = source;
            _this.sn = 0;
            _this.timestamp = 0;
        }

        _this.stop = function () {
            _this.source = null;
            _this.sn = 0;
            _this.timestamp = 0;
        };

        _this.clone = function () {
            return new MediaStreamTrack(_this.kind, _this.source, _logger);
        };

        _init();
    }

    MediaStreamTrack.prototype = Object.create(EventDispatcher.prototype);
    MediaStreamTrack.prototype.constructor = MediaStreamTrack;
    MediaStreamTrack.prototype.kind = 'MediaStreamTrack';

    function MediaStream(kind, option) {
        var args = Array.prototype.slice.call(arguments, 0);
        EventDispatcher.apply(this, args.concat([MediaStreamTrackEvent, [Event.ERROR]]));

        var _this = this,
            _logger = option.logger,
            _index,
            _tracks;

        function _init() {
            _index = 1; // iSO/IEC 14496-12 8.3.2.3: Track IDs are never re-used and cannot be zero.
            _tracks = [];
            _this.info = new Information();
        }

        _this.addTrack = function (track) {
            for (var i = 0; i < _tracks.length; i++) {
                if (_tracks[i] === track) {
                    _logger.warn('MediaStreamTrack already added.');
                    return;
                }
            }
            track.id = _index++;
            _tracks.push(track);
            _logger.log('Added ' + track.kind + ' track(' + track.id + ') to ' + _this.kind + '.');
            _this.dispatchEvent(MediaStreamTrackEvent.ADDTRACK, { track: track });
        };

        _this.removeTrack = function (track) {
            for (var i = 0; i < _tracks.length; i++) {
                if (_tracks[i] === track) {
                    _tracks.splice(i, 1);
                    _logger.log('Removed ' + track.kind + ' track(' + track.id + ') to ' + _this.kind + '.');
                    _this.dispatchEvent(MediaStreamTrackEvent.REMOVETRACK, { track: track });
                    break;
                }
            }
        };

        _this.getTrackById = function (id) {
            for (var i = 0; i < _tracks.length; i++) {
                if (_tracks[i].id === id) {
                    return _tracks[i];
                }
            }
            return null;
        };

        _this.getTracks = function () {
            var tracks = [];
            utils.forEach(_tracks, function (i, track) {
                tracks.push(track);
            });
            return tracks;
        };

        _this.getAudioTracks = function () {
            var tracks = [];
            utils.forEach(_tracks, function (i, track) {
                if (track.kind === MediaStreamTrack.KindAudio) {
                    tracks.push(track);
                }
            });
            return tracks;
        };

        _this.getVideoTracks = function () {
            var tracks = [];
            utils.forEach(_tracks, function (i, track) {
                if (track.kind === MediaStreamTrack.KindVideo) {
                    tracks.push(track);
                }
            });
            return tracks;
        };

        _this.attached = function (source) {
            for (var i = 0; i < _tracks.length; i++) {
                if (_tracks[i].source === source) {
                    return _tracks[i];
                }
            }
            return null;
        };

        _this.close = function () {
            utils.forEach(_tracks, function (i, track) {
                track.stop();
                _this.dispatchEvent(MediaStreamTrackEvent.REMOVETRACK, { track: track });
            });

            _init();
        };

        _init();
    }

    MediaStream.prototype = Object.create(EventDispatcher.prototype);
    MediaStream.prototype.constructor = MediaStream;
    MediaStream.prototype.kind = 'MediaStream';

    Format.register = function (format, index) {
        try {
            _formats.splice(index || _formats.length, 0, format);
            Format[format.prototype.kind] = format;
        } catch (err) {
            throw { name: err.name, message: 'Failed to register format ' + format.prototype.kind + ': ' + err.message };
        }
    };

    Format.get = function (kind) {
        for (var i = 0; i < _formats.length; i++) {
            var format = _formats[i];
            if (format.prototype.kind === kind) {
                return format;
            }
        }
        return null;
    };

    MediaStreamTrack.KindAudio = 'audio';
    MediaStreamTrack.KindVideo = 'video';
    Format.MediaStreamTrack = MediaStreamTrack;
    Format.MediaStream = MediaStream;
    AV.format = Format.get;
    AV.Format = Format;
})(odd);

