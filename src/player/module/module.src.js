(function (odd) {
    var utils = odd.utils,
        OS = odd.OS,
        Browser = odd.Browser,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        IOEvent = events.IOEvent,
        Module = odd.Module;

    function SRC(config, logger) {
        EventDispatcher.call(this, 'SRC', { logger: logger }, Event, IOEvent);

        var _this = this,
            _logger = logger,
            _video,
            _ready,
            _file,
            _source,
            _connectionId,
            _lease,
            _loading = false,
            _controller,
            _credentialReject,
            _credentialTimer,
            _renewTimer,
            _expiresTimer,
            _generation = 0,
            _destroyed = false;

        function _init() {
            _this.config = config;

            _ready = false;

            _video = utils.createElement('video');
            _video.addEventListener('play', _this.forward);
            _video.addEventListener('waiting', _this.forward);
            _video.addEventListener('loadstart', _this.forward);
            _video.addEventListener('progress', _this.forward);
            _video.addEventListener('suspend', _this.forward);
            _video.addEventListener('stalled', _this.forward);
            _video.addEventListener('abort', _this.forward);
            _video.addEventListener('timeout', _this.forward);
            _video.addEventListener('durationchange', _onDurationChange);
            _video.addEventListener('loadedmetadata', _this.forward);
            _video.addEventListener('loadeddata', _this.forward);
            _video.addEventListener('canplay', _this.forward);
            _video.addEventListener('playing', _this.forward);
            _video.addEventListener('canplaythrough', _this.forward);
            _video.addEventListener('pause', _this.forward);
            _video.addEventListener('seeking', _this.forward);
            _video.addEventListener('seeked', _this.forward);
            _video.addEventListener('ratechange', _this.forward);
            _video.addEventListener('timeupdate', _onTimeUpdate);
            _video.addEventListener('volumechange', _onVolumeChange);
            _video.addEventListener('load', _this.forward);
            _video.addEventListener('ended', _onEnded);
            _video.addEventListener('error', _onError);
            if (_this.config.airplay) {
                _video.setAttribute('x-webkit-airplay', 'allow');
            }
            if (_this.config.autoplay) {
                _video.setAttribute('autoplay', '');
            }
            if (_this.config.playsinline) {
                _video.setAttribute('playsinline', 'isiPhoneShowPlaysinline');
                _video.setAttribute('webkit-playsinline', 'isiPhoneShowPlaysinline');
                _video.setAttribute('x5-playsinline', '');
                _video.setAttribute('x5-video-player-type', 'h5-page');
                _video.setAttribute('x5-video-player-fullscreen', true);
                _video.setAttribute('t7-video-player-type', 'inline');
            }
            if (_this.config.preload) {
                _video.preload = _this.config.preload;
            }
            _video.muted = _this.config.muted;
            _video.volume = _this.config.volume;
        }

        _this.setup = function () {
            if (_destroyed) {
                return;
            }
            if (_ready === false) {
                _ready = true;
                _this.dispatchEvent(Event.READY, { kind: _this.kind });
            }
        };

        _this.play = function (program) {
            if (_destroyed) {
                _logger.error('Cannot play after SRC has been destroyed.');
                return;
            }
            if (program) {
                if (!program.sources || !program.sources.length || !program.sources[0].url) {
                    _logger.error('No source provided for SRC playback.');
                    _this.dispatchEvent(Event.ERROR, { name: 'NotFoundError', message: 'No media source provided.' });
                    return;
                }

                var file = program.sources[0].url;
                if (file !== _file) {
                    _generation++;
                    _release();
                    _file = file;
                    _source = program.sources[0];
                    _video.removeAttribute('src');
                    _video.load();
                    _this.dispatchEvent(Event.DURATIONCHANGE, { duration: NaN });
                    if (_this.config.credentials !== null && _this.config.credentials !== undefined) {
                        _authorize(_generation, false);
                        return;
                    }
                    _video.removeAttribute('crossorigin');
                    _video.src = file;
                }
            }
            if (_loading && !_lease) {
                return;
            }
            if (!_file) {
                _logger.error('No source loaded for SRC playback.');
                return;
            }

            var generation = _generation,
                result = _video.play();
            if (result && result.catch) {
                result.catch(function (err) {
                    if (_destroyed || generation !== _generation) {
                        return;
                    }
                    if (err.name === 'AbortError') {
                        _logger.debug('SRC playback was interrupted.');
                        return;
                    }
                    if (err.name === 'NotAllowedError' && !_video.muted) {
                        _video.muted = true;
                        _this.play();
                        return;
                    }
                    if (_lease) {
                        _fail({ name: err.name, message: 'Native playback could not start.' });
                        return;
                    }
                    _logger.error('Failed to start native playback: ' + err.name + '.');
                    _this.dispatchEvent(Event.ERROR, { name: err.name, message: 'Native playback could not start.' });
                });
            }
            _video.controls = false;
        };

        function _uuid() {
            var bytes = new Uint8Array(16),
                value = '';
            window.crypto.getRandomValues(bytes);
            bytes[6] = (bytes[6] & 15) | 64;
            bytes[8] = (bytes[8] & 63) | 128;
            for (var i = 0; i < bytes.length; i++) {
                if (i === 4 || i === 6 || i === 8 || i === 10) {
                    value += '-';
                }
                value += ('0' + bytes[i].toString(16)).slice(-2);
            }
            return value;
        }

        async function _authorize(generation, renew) {
            if (_destroyed || generation !== _generation || _loading) {
                return;
            }
            _loading = true;
            var controller,
                candidate;
            try {
                if (typeof _this.config.credentials !== 'function' || _this.config.mode !== 'live' ||
                    !Number.isSafeInteger(_this.config.timeout) || _this.config.timeout <= 0 ||
                    !window.fetch || !window.AbortController || !window.crypto || !window.crypto.getRandomValues) {
                    throw { name: 'NotSupportedError', message: 'Protected HLS requires credentials, Fetch, cancellation and secure randomness.' };
                }
                var stream = _source.streamId,
                    uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
                if (typeof stream !== 'string' || !uuid.test(stream) || stream === '00000000-0000-0000-0000-000000000000') {
                    throw { name: 'TypeError', message: 'Protected HLS requires an explicit streamId.' };
                }
                var original = new URL(_file, document.baseURI),
                    match = original.pathname.match(/\/([0-9a-f-]{36})\/v([12])\/index\.m3u8$/);
                if (!match || match[1] !== stream) {
                    throw { name: 'TypeError', message: 'Protected SRC playback requires an HLS manifest URL.' };
                }
                if (!_connectionId) {
                    _connectionId = _uuid();
                }
                controller = new AbortController();
                _controller = controller;
                var context = {
                    protocol: 'HLS',
                    direction: 'play',
                    format: match[2] === '1' ? 'mpegts' : 'cmaf',
                    streamId: stream,
                    connectionId: _connectionId,
                    generation: String(generation),
                    renew: renew,
                    url: original.href,
                    module: _this.kind,
                    signal: controller.signal,
                };
                _credentialTimer = setTimeout(function () {
                    controller.abort();
                    if (_controller === controller && _credentialReject) {
                        _credentialReject({ name: 'TimeoutError', message: 'Playback authorization timed out.' });
                    }
                }, _this.config.timeout);
                var credentials = await new Promise(function (resolve, reject) {
                    _credentialReject = reject;
                    Promise.resolve().then(function () {
                        if (controller.signal.aborted) {
                            throw { name: 'AbortError' };
                        }
                        return _this.config.credentials(context);
                    }).then(resolve, reject);
                });
                if (generation !== _generation || controller.signal.aborted || _destroyed) {
                    return;
                }
                _credentialReject = undefined;
                if (!credentials || typeof credentials.token !== 'string' || !credentials.token ||
                    credentials.token.length > 8192 || /[^\x21-\x7e]/.test(credentials.token) ||
                    credentials.streamId !== stream || typeof credentials.url !== 'string' ||
                    !Number.isSafeInteger(credentials.connectBefore) || credentials.connectBefore <= Date.now() / 1000 ||
                    !Number.isSafeInteger(credentials.playbackUntil) ||
                    (credentials.version === 2 ? credentials.playbackUntil !== credentials.connectBefore :
                        credentials.playbackUntil <= credentials.connectBefore)) {
                    throw { name: 'DataError', message: 'Invalid HLS credentials.' };
                }
                var endpoint = new URL(credentials.url, document.baseURI);
                if (!/^https?:$/.test(endpoint.protocol) || endpoint.username || endpoint.password || endpoint.search || endpoint.hash ||
                    endpoint.pathname.slice(-(stream.length + 14)) !== stream + '/v' + match[2] + '/index.m3u8' ||
                    (window.location.protocol === 'https:' && endpoint.protocol !== 'https:')) {
                    throw { name: 'SecurityError', message: 'Invalid HLS credential endpoint.' };
                }
                var root = endpoint.pathname.slice(0, -13),
                    target = renew ? _lease.sessionUrl : endpoint.origin + root + 'sessions';
                if (renew && (endpoint.origin !== _lease.origin || endpoint.pathname !== _lease.manifest)) {
                    throw { name: 'SecurityError', message: 'Playback renewal cannot change its node or resource.' };
                }
                if (renew && _lease.version !== (credentials.version === 2 ? 2 : 1)) {
                    throw { name: 'DataError', message: 'Playback admission version changed.' };
                }
                if (credentials.version === 2) {
                    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(credentials.token)) {
                        throw { name: 'DataError', message: 'Invalid signed playback credential.' };
                    }
                    candidate = {
                        version: 2,
                        url: endpoint.href + '?access=' + credentials.token,
                        expiresAt: credentials.playbackUntil,
                        origin: endpoint.origin,
                        manifest: endpoint.pathname,
                    };
                } else {
                    var response = await fetch(target, {
                        method: renew ? 'PATCH' : 'POST',
                        mode: 'cors',
                        credentials: 'include',
                        redirect: 'error',
                        cache: 'no-store',
                        headers: { Authorization: 'Bearer ' + credentials.token },
                        signal: controller.signal,
                    });
                    if (!response.ok) {
                        throw { name: 'NotAllowedError', message: 'Playback authorization was rejected.' };
                    }
                    var length = response.headers.get('Content-Length');
                    if (!length || !/^\d+$/.test(length) || Number(length) > 16384) {
                        throw { name: 'DataError', message: 'Invalid playback response size.' };
                    }
                    var text = await response.text();
                    if (text.length > 16384) {
                        throw { name: 'DataError', message: 'Playback response is too large.' };
                    }
                    var result = JSON.parse(text),
                        media = new URL(result.url, endpoint),
                        management = new URL(result.sessionUrl, endpoint),
                        secret = typeof result.credential === 'string' ? result.credential : '',
                        id = secret.slice(0, 36);
                    if (!uuid.test(id) || secret.length !== 109 || secret[36] !== '.' ||
                        !uuid.test(secret.slice(37, 73)) || !uuid.test(secret.slice(73)) ||
                        media.origin !== endpoint.origin || media.pathname !== endpoint.pathname || media.hash || media.username || media.password ||
                        management.origin !== endpoint.origin || management.pathname !== root + 'sessions' || management.hash || management.username || management.password ||
                        media.search !== '?playback=' + id || management.search !== media.search ||
                        !Number.isSafeInteger(result.expiresAt) || result.expiresAt <= Date.now() / 1000 || result.expiresAt > credentials.playbackUntil) {
                        throw { name: 'DataError', message: 'Invalid playback session response.' };
                    }
                    candidate = {
                        url: media.href,
                        sessionUrl: management.href,
                        credential: secret,
                        expiresAt: result.expiresAt,
                        origin: endpoint.origin,
                        manifest: endpoint.pathname,
                    };
                    if (_destroyed || generation !== _generation || controller.signal.aborted) {
                        if (!renew) {
                            _delete(candidate);
                        }
                        return;
                    }
                    if (renew && (candidate.credential !== _lease.credential || candidate.url !== _lease.url)) {
                        throw { name: 'DataError', message: 'Playback renewal changed its session.' };
                    }
                    candidate.version = 1;
                }
                _lease = candidate;
                clearTimeout(_renewTimer);
                clearTimeout(_expiresTimer);
                var remaining = candidate.expiresAt * 1000 - Date.now();
                _renewTimer = setTimeout(function () { _authorize(generation, true); }, Math.max(1, Math.floor(remaining * 0.75)));
                _expiresTimer = setTimeout(function () {
                    if (generation === _generation) {
                        _fail({ name: 'TimeoutError', message: 'Playback permission expired.' });
                    }
                }, remaining);
                if (!renew || candidate.version === 2) {
                    _video.crossOrigin = 'use-credentials';
                    var resume = renew && !_video.paused;
                    _video.src = candidate.url;
                    if (resume) {
                        _this.play();
                    }
                }
            } catch (err) {
                if (!_destroyed && generation === _generation) {
                    _fail({ name: err.name || 'OperationError', message: 'Protected HLS authorization failed.' });
                }
            } finally {
                if (_controller === controller) {
                    clearTimeout(_credentialTimer);
                    _controller = undefined;
                    _credentialReject = undefined;
                    _loading = false;
                }
            }
            if (!_destroyed && generation === _generation && _lease && !renew) {
                _this.play();
            }
        }

        function _delete(lease) {
            if (lease.version === 2) {
                return;
            }
            var controller = new AbortController(),
                timer = setTimeout(function () { controller.abort(); }, _this.config.timeout);
            fetch(lease.sessionUrl, {
                method: 'DELETE', mode: 'cors', credentials: 'include', redirect: 'error', cache: 'no-store',
                headers: { Authorization: 'Playback ' + lease.credential }, signal: controller.signal,
            }).catch(function () {
                // The server's finite lifetime bounds a lost stop request.
            }).then(function () { clearTimeout(timer); });
        }

        function _release() {
            clearTimeout(_credentialTimer);
            clearTimeout(_renewTimer);
            clearTimeout(_expiresTimer);
            if (_controller) {
                _controller.abort();
                _controller = undefined;
            }
            if (_credentialReject) {
                _credentialReject({ name: 'AbortError' });
                _credentialReject = undefined;
            }
            _loading = false;
            if (_lease) {
                _delete(_lease);
                _lease = undefined;
            }
        }

        function _fail(err) {
            _generation++;
            _release();
            _file = undefined;
            _video.removeAttribute('src');
            _video.load();
            _logger.error('Protected playback failed: ' + err.name + '.');
            _this.dispatchEvent(Event.ERROR, err);
        }

        function _onEnded(e) {
            _generation++;
            _release();
            _file = undefined;
            _this.forward(e);
        }

        _this.pause = function () {
            _video.pause();
            _video.controls = false;
        };

        _this.seek = function (offset) {
            _video.currentTime = offset;
        };

        _this.stop = function () {
            _generation++;
            _release();
            _file = undefined;
            _video.removeAttribute('src');
            _video.load();
            _video.controls = false;
            _this.dispatchEvent(Event.ENDED);
        };

        _this.muted = function (status) {
            if (utils.typeOf(status) === 'boolean') {
                _video.muted = status;
            }
            return _video.muted;
        };

        _this.volume = function (f) {
            if (utils.typeOf(f) === 'number') {
                _video.volume = f;
            }
            return _video.volume;
        };

        _this.record = function (mode, option) {
            return Promise.reject('Failed to record stream, the operation is not supported by this module.');
        };

        _this.element = function () {
            return _video;
        };

        _this.destroy = function () {
            if (_destroyed) {
                return;
            }
            _destroyed = true;
            _this.stop();
            _ready = false;

            _video.removeEventListener('play', _this.forward);
            _video.removeEventListener('waiting', _this.forward);
            _video.removeEventListener('loadstart', _this.forward);
            _video.removeEventListener('progress', _this.forward);
            _video.removeEventListener('suspend', _this.forward);
            _video.removeEventListener('stalled', _this.forward);
            _video.removeEventListener('abort', _this.forward);
            _video.removeEventListener('timeout', _this.forward);
            _video.removeEventListener('durationchange', _onDurationChange);
            _video.removeEventListener('loadedmetadata', _this.forward);
            _video.removeEventListener('loadeddata', _this.forward);
            _video.removeEventListener('canplay', _this.forward);
            _video.removeEventListener('playing', _this.forward);
            _video.removeEventListener('canplaythrough', _this.forward);
            _video.removeEventListener('pause', _this.forward);
            _video.removeEventListener('seeking', _this.forward);
            _video.removeEventListener('seeked', _this.forward);
            _video.removeEventListener('ratechange', _this.forward);
            _video.removeEventListener('timeupdate', _onTimeUpdate);
            _video.removeEventListener('volumechange', _onVolumeChange);
            _video.removeEventListener('load', _this.forward);
            _video.removeEventListener('ended', _onEnded);
            _video.removeEventListener('error', _onError);
        };

        function _onDurationChange(e) {
            _this.dispatchEvent(Event.DURATIONCHANGE, { duration: _video.duration });
        }

        function _onTimeUpdate(e) {
            var ranges = _video.buffered;
            var start = ranges.length ? ranges.start(0) : 0;
            var buffered = ranges.length ? ranges.end(ranges.length - 1) : 0;
            _this.dispatchEvent(Event.TIMEUPDATE, {
                start: start,
                time: _video.currentTime,
                buffered: buffered,
                duration: _video.duration,
            });
        }

        function _onVolumeChange(e) {
            _this.dispatchEvent(Event.VOLUMECHANGE, { muted: _video.muted, volume: _video.volume });
        }

        function _onError(e) {
            if (_destroyed || !_file || !_video.error) {
                return;
            }
            var err = {
                1: { name: 'AbortError', message: 'The operation was aborted.' },
                2: { name: 'NetworkError', message: 'A network error occurred.' },
                3: { name: 'EncodingError', message: 'The encoding or decoding operation failed.' },
                4: { name: 'NotSupportedError', message: 'Failed to load because no supported source was found.' },
            }[_video.error.code] || { name: 'OperationError', message: 'Native media playback failed.' };
            if (_lease || _loading) {
                _fail(err);
                return;
            }
            _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
        }

        _init();
    }

    SRC.prototype = Object.create(EventDispatcher.prototype);
    SRC.prototype.constructor = SRC;
    SRC.prototype.kind = 'SRC';

    SRC.prototype.isSupported = function (program) {
        if (Browser.isMSIE && Browser.major < 9 || !program || !program.sources || !program.sources.length) {
            return false;
        }
        var video = utils.createElement('video');
        var nativeHls = video.canPlayType('application/vnd.apple.mpegurl') || video.canPlayType('application/x-mpegURL');
        var extensions = ['mp4', 'f4v', 'm4v', 'mov', 'm4a', 'f4a', 'aac', 'ogv', 'ogg', 'mp3', 'oga', 'webm'];
        for (var source of program.sources) {
            if (!source || typeof source.url !== 'string') {
                return false;
            }
            try {
                var url = new utils.URL(source.url);
            } catch (err) {
                return false;
            }
            if (!/^https?:$/i.test(url.protocol)) {
                return false;
            }
            var extension = (url.filetype || '').replace(/^\./, '').toLowerCase();
            if (['m3u8', 'm3u', 'hls'].indexOf(extension) !== -1) {
                if (!nativeHls || !(OS.isMobile || OS.isMac && Browser.isSafari)) {
                    return false;
                }
            } else if (extensions.indexOf(extension) === -1) {
                return false;
            }
        }
        return true;
    };

    Module.register(SRC);
})(odd);

