(function (odd) {
    var utils = odd.utils,
        Logger = utils.Logger,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        MediaEvent = events.MediaEvent,
        NetStatusEvent = events.NetStatusEvent,
        TimerEvent = events.TimerEvent,
        Level = events.Level,
        Code = events.Code,

        State = {
            INITIALIZED: 'initialized',
            CONNECTING: 'connecting',
            PLAYING: 'playing',
            CLOSING: 'closing',
            CLOSED: 'closed',
        },
        Port = {
            P1: 0,
            P2: 1,
            P3: 2,
            P4: 3,
        },
        Key = {
            UP: 0x01,
            DOWN: 0x02,
            LEFT: 0x04,
            RIGHT: 0x08,
            START: 0x10,
            SELECT: 0x20,
            B: 0x40,
            A: 0x80,
        },

        _id = 0,
        _instances = {},
        _default = {
            airplay: 'allow',
            autoplay: false,
            playsinline: true,
            muted: false,
            volume: 0.8,
            base: `${location.protocol}//${location.host}/game`,
            token: '',
            game: '',
            controllers: 1,
            trickle: false,
            loader: {
                mode: 'cors',        // cors, no-cors, same-origin
                credentials: 'omit', // omit, include, same-origin
            },
            configuration: {
                iceServers: [{
                    urls: ["stun:stun.l.google.com:19302"],
                }],
            },
        };

    function Famicom(id, logger) {
        var _this = this,
            _id = id,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger(id, logger),
            _container,
            _video,
            _canvas,
            _context,
            _resource,
            _pc,
            _channel,
            _stream,
            _inputTimer,
            _keys,
            _timer,
            _stats,
            _candidates,
            _operation,
            _busy,
            _requests,
            _cookie,
            _state;

        EventDispatcher.call(this, 'Famicom', { id: id, logger: _logger }, Event, MediaEvent, NetStatusEvent);

        function _init() {
            _this.logger = _logger;

            _resource = { instance: '', player: '', ports: [], location: '', etag: '' };
            _candidates = [];
            _operation = 0;
            _busy = false;
            _requests = [];
            _keys = [0x00, 0x00, 0x00, 0x00];
            _stats = {
                timestamp: 0,
                framesPerSecond: 0,
                framesDecoded: 0,
                framesDropped: 0,
                nackCount: 0,
                pliCount: 0,
                freezeCount: 0,
            };
            _state = State.INITIALIZED;

            _timer = new utils.Timer(1000, 0, _logger);
            _timer.addEventListener(TimerEvent.TIMER, _onStatsTimer);
        }

        _this.id = function () {
            return _id;
        };

        _this.setup = async function (container, config) {
            _container = container;
            _this.config = utils.extendz({ id: _id }, _default, config);

            var digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(_this.config.token));
            var identity = Array.prototype.map.call(new Uint8Array(digest), function (byte) {
                return ('0' + byte.toString(16)).slice(-2);
            }).join('');
            _cookie = 'famicom-' + identity + '-' + encodeURIComponent(_url('play').href);
            if (_state === State.CLOSED) {
                throw { name: 'AbortError', message: 'The SDK was destroyed.' };
            }
            var saved = _getCookie();
            if (saved) {
                _resource.instance = saved.instance;
                _resource.player = saved.player;
            }

            _video = utils.createElement('video');
            _video.addEventListener('volumechange', _onVolumeChange);
            _video.setAttribute('x-webkit-airplay', 'allow');
            _video.setAttribute('autoplay', '');
            _video.setAttribute('playsinline', '');
            _video.setAttribute('webkit-playsinline', 'isiPhoneShowPlaysinline');
            _video.setAttribute('x5-playsinline', '');
            _video.setAttribute('x5-video-player-type', 'h5-page');
            _video.setAttribute('x5-video-player-fullscreen', true);
            _video.setAttribute('t7-video-player-type', 'inline');
            _video.muted = _this.config.muted;
            _video.volume = _this.config.volume;
            _container.appendChild(_video);

            _canvas = utils.createElement('canvas');
            _context = _canvas.getContext('2d');

            _bind();
            return Promise.resolve();
        };

        function _bind() {
            _this.dispatchEvent(Event.BIND);
            _this.dispatchEvent(Event.READY);
        }

        _this.list = async function () {
            if (!_this.config.token || _state === State.CLOSED) {
                _logger.error(`Failed to list games: id=${_id}, a token and an active SDK are required.`);
                return;
            }
            var response = await _request('GET', _url('list'));
            return JSON.parse(response.responseText);
        };

        _this.create = async function (game) {
            game = game || _this.config.game;
            if (_busy || !game || !_this.config.token || _state === State.CLOSED) {
                _logger.error(`Failed to create: id=${_id}, game and token are required; finish pending requests first.`);
                return;
            }

            var operation = _operation;
            _busy = true;
            try {
                var url = _url('create');
                url.searchParams.set('game', game);

                var response = await _request('GET', url);
                if (operation !== _operation) {
                    throw { name: 'AbortError', message: 'The operation was cancelled.' };
                }
                var resource = _parseLocation(response);
                if (resource.player) {
                    throw { name: 'DataError', message: 'Create returned a player resource.' };
                }
                return resource.instance;
            } finally {
                _busy = false;
            }
        };

        _this.load = async function (instance, game) {
            game = game || _this.config.game;
            if (!instance || !game) {
                _logger.error(`Failed to load: id=${_id}, instance and game are required.`);
                return;
            }
            if (_busy || !_this.config.token || _state === State.CLOSED) {
                _logger.error(`Failed to load: id=${_id}, token is required; finish pending requests first.`);
                return;
            }

            var operation = _operation;
            _busy = true;
            try {
                if (_resource.instance === instance) {
                    _releaseKeys();
                }
                var url = _url('load');
                url.searchParams.set('instance', instance);
                url.searchParams.set('game', game);
                await _request('GET', url);
                if (operation !== _operation) {
                    throw { name: 'AbortError', message: 'The operation was cancelled.' };
                }
                return true;
            } finally {
                _busy = false;
            }
        };

        _this.play = async function (instance, controllers, player) {
            if (_busy || !_this.config.token || _state === State.CLOSED ||
                _resource.instance && _resource.instance !== instance) {
                _logger.error(`Failed to play: id=${_id}, instance=${instance}, token and active SDK are required; leave another game and finish pending requests first.`);
                return;
            }
            if (!instance) {
                _logger.error(`Failed to play: id=${_id}, instance is required.`);
                return;
            }
            controllers = controllers === undefined ? _this.config.controllers : controllers;
            if (!Number.isInteger(controllers) || controllers < 1 || controllers > 4) {
                _logger.error(`Failed to play: id=${_id}, controllers must be between 1 and 4.`);
                return;
            }

            player = player || (_resource.instance === instance ? _resource.player : '');
            var previous = _resource;
            _disconnect();

            var operation = _operation;
            _resource = { instance: instance, player: player, ports: [], location: '', etag: '' };
            _busy = true;
            _state = State.CONNECTING;

            var url = _url('play');
            url.searchParams.set('instance', instance);
            url.searchParams.set('controllers', controllers);
            if (player) {
                url.searchParams.set('player', player);
            }

            var pc;
            var resource;
            try {
                _initPeerConnection();
                pc = _pc;

                var offer = await pc.createOffer();
                offer.sdp = offer.sdp.replace(/a=extmap:\d+ http:\/\/www.ietf.org\/id\/draft-holmer-rmcat-transport-wide-cc-extensions-01(\n|\r\n)/gi, '');
                offer.sdp = offer.sdp.replace(/a=rtcp-fb:\d+ goog-remb(\n|\r\n)/gi, '');
                offer.sdp = offer.sdp.replace(/a=rtcp-fb:\d+ transport-cc(\n|\r\n)/gi, '');
                await pc.setLocalDescription(offer);
                if (!_this.config.trickle && pc.iceGatheringState !== 'complete') {
                    await new Promise(function (resolve, reject) {
                        var timeout = setTimeout(function () {
                            cleanup();
                            reject({ name: 'TimeoutError', message: 'ICE gathering timed out.' });
                        }, 10000);

                        function cleanup() {
                            clearTimeout(timeout);
                            pc.removeEventListener('icegatheringstatechange', onGathering);
                            _this.removeEventListener(Event.CLOSE, onClose);
                        }

                        function onGathering() {
                            if (pc.iceGatheringState === 'complete') {
                                cleanup();
                                resolve();
                            }
                        }

                        function onClose() {
                            cleanup();
                            reject({ name: 'AbortError', message: 'The SDK was destroyed.' });
                        }

                        _this.addEventListener(Event.CLOSE, onClose);
                        pc.addEventListener('icegatheringstatechange', onGathering);
                        onGathering();
                    });
                }

                if (operation !== _operation || pc !== _pc) {
                    throw { name: 'AbortError', message: 'The connection was closed.' };
                }
                var response = await _request('POST', url, pc.localDescription.sdp, 'application/sdp');
                resource = _parseLocation(response);
                if (!resource.player || resource.instance !== instance) {
                    throw { name: 'DataError', message: 'Play did not return a player resource.' };
                }
                if (operation !== _operation) {
                    throw { name: 'AbortError', message: 'The connection was closed.' };
                }
                await pc.setRemoteDescription({ type: 'answer', sdp: response.responseText });
                if (operation !== _operation || pc !== _pc) {
                    throw { name: 'AbortError', message: 'The connection was closed.' };
                }
                _resource = resource;

                var candidates = _candidates.splice(0);
                for (var candidate of candidates) {
                    await _patch(candidate);
                }
                if (operation !== _operation) {
                    throw { name: 'AbortError', message: 'The connection was closed.' };
                }

                pc.getReceivers().forEach(function (receiver) {
                    if (receiver.track && receiver.track.kind === 'video') {
                        receiver.jitterBufferTarget = 40;
                    }
                });
                _state = pc.connectionState === 'connected' ? State.PLAYING : State.CONNECTING;
                _setCookie(Date.now() + 30000);
                return resource.player;
            } catch (err) {
                if (pc === _pc) {
                    _disconnect();
                    _resource = previous;
                }
                if (resource && resource.player) {
                    try {
                        await _delete(new URL(resource.location), resource.etag);
                    } catch (cleanup) {
                        if (cleanup.status !== 412) {
                            _logger.error(`Failed to release candidate player: ${cleanup.message}`);
                        }
                    }
                } else if (err.status === 404 && _resource.instance === instance) {
                    _resource = { instance: '', player: '', ports: [], location: '', etag: '' };
                    _setCookie(0);
                }
                throw err;
            } finally {
                _busy = false;
            }
        };

        _this.stop = async function () {
            if (_busy || _state === State.CLOSED || (_resource.player && !_this.config.token)) {
                _logger.error(`Failed to stop: id=${_id}, token is required; finish pending requests first.`);
                return;
            }

            var operation = _operation;
            _busy = true;
            try {
                if (_resource.instance && _resource.player) {
                    var url = _url('play');
                    url.searchParams.set('instance', _resource.instance);
                    url.searchParams.set('player', _resource.player);
                    await _delete(url, _resource.etag);
                }
                if (operation !== _operation) {
                    throw { name: 'AbortError', message: 'The operation was cancelled.' };
                }
                _disconnect();
                _resource = { instance: '', player: '', ports: [], location: '', etag: '' };
                _setCookie(0);
                return true;
            } finally {
                _busy = false;
            }
        };

        _this.remove = async function (instance) {
            if (_busy || !instance || !_this.config.token || _state === State.CLOSED) {
                _logger.error(`Failed to remove: id=${_id}, instance and token are required; finish pending requests first.`);
                return;
            }

            var operation = _operation;
            _busy = true;
            try {
                var url = _url('play');
                url.searchParams.set('instance', instance);
                await _delete(url);
                if (operation !== _operation) {
                    throw { name: 'AbortError', message: 'The operation was cancelled.' };
                }
                if (_resource.instance === instance) {
                    _disconnect();
                    _resource = { instance: '', player: '', ports: [], location: '', etag: '' };
                    _setCookie(0);
                }
                return true;
            } finally {
                _busy = false;
            }
        };

        function _initPeerConnection() {
            _pc = new RTCPeerConnection(_this.config.configuration);
            _pc.addEventListener('track', _onTrack);
            _pc.addEventListener('connectionstatechange', _onConnectionStateChange);
            _pc.addEventListener('iceconnectionstatechange', _onIceConnectionStateChange);
            if (_this.config.trickle) {
                _pc.addEventListener('icecandidate', _onIceCandidate);
            }

            _pc.addTransceiver('audio', { direction: 'recvonly' });
            _pc.addTransceiver('video', { direction: 'recvonly' });

            _channel = _pc.createDataChannel('game-input', {
                ordered: false,
                maxPacketLifeTime: 20,
            });
            _channel.addEventListener('open', _onDataChannelOpen);
            _channel.addEventListener('error', _onDataChannelError);
            _channel.addEventListener('close', _onDataChannelClose);

            _setCodecPreferences();
        }

        function _setCodecPreferences() {
            var audiocodecs = [];
            var videocodecs = [];

            var ac = RTCRtpReceiver.getCapabilities('audio');
            if (ac && ac.codecs) {
                ac.codecs.forEach(function (codec) {
                    if (codec.mimeType === 'audio/opus') {
                        audiocodecs.push(codec);
                    }
                });
            }
            var vc = RTCRtpReceiver.getCapabilities('video');
            if (vc && vc.codecs) {
                vc.codecs.forEach(function (codec) {
                    if (codec.mimeType === 'video/rtx' ||
                        codec.mimeType === 'video/H264' && codec.sdpFmtpLine &&
                        codec.sdpFmtpLine.indexOf('packetization-mode=1') !== -1 &&
                        codec.sdpFmtpLine.indexOf('profile-level-id=42e01f') !== -1) {
                        videocodecs.push(codec);
                    }
                });
            }
            _pc.getTransceivers().forEach(function (transceiver) {
                switch (transceiver.receiver.track.kind) {
                    case 'audio':
                        transceiver.setCodecPreferences(audiocodecs);
                        break;
                    case 'video':
                        transceiver.setCodecPreferences(videocodecs);
                        break;
                }
            });
        }

        function _url(action) {
            return new URL(_this.config.base.replace(/\/$/, '') + '/' + action, location.href);
        }

        function _request(method, url, body, type, etag) {
            return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open(method, url.href, true);
                xhr.timeout = 30000;
                xhr.withCredentials = _this.config.loader.credentials === 'include';
                xhr.setRequestHeader('Authorization', 'Bearer ' + _this.config.token);
                if (type) {
                    xhr.setRequestHeader('Content-Type', type);
                }
                if (etag) {
                    xhr.setRequestHeader('If-Match', etag);
                }

                _requests.push(xhr);
                xhr.onloadend = function () {
                    var index = _requests.indexOf(xhr);
                    if (index !== -1) {
                        _requests.splice(index, 1);
                    }
                };
                xhr.onload = function () {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(xhr);
                    } else {
                        reject({ name: 'NetworkError', message: xhr.status + ' ' + xhr.statusText, status: xhr.status });
                    }
                };
                xhr.onerror = xhr.ontimeout = function () {
                    reject({ name: 'NetworkError', message: 'The game request did not complete.' });
                };
                xhr.onabort = function () {
                    reject({ name: 'AbortError', message: 'The game request was cancelled.' });
                };

                try {
                    xhr.send(body);
                } catch (err) {
                    xhr.onloadend();
                    reject(err);
                }
            });
        }

        function _parseLocation(response) {
            var value = response.getResponseHeader('Location');
            if (!value) {
                throw { name: 'DataError', message: 'The server did not return a game resource.' };
            }
            var base = _url('play');
            var url = new URL(value, base);
            var instance = url.searchParams.get('instance');
            if (url.origin !== base.origin || url.pathname !== base.pathname || url.username || url.password || !instance) {
                throw { name: 'DataError', message: 'Invalid game resource.' };
            }

            var player = url.searchParams.get('player') || '';
            var values = url.searchParams.get('ports');
            var ports = values ? values.split(',').map(Number) : [];
            var etag = response.getResponseHeader('ETag') || '';
            if ((values && !/^[0-3](,[0-3])*$/.test(values)) || ports.some(function (port, index) {
                return !Number.isInteger(port) || port < 0 || port > 3 || ports.indexOf(port) !== index;
            }) || (player ? !ports.length || !etag : ports.length)) {
                throw { name: 'DataError', message: 'Invalid player or controller ports.' };
            }
            return { instance: instance, player: player, ports: ports, location: url.href, etag: etag };
        }

        async function _patch(candidate) {
            if (!_this.config.trickle) {
                return;
            }
            if (!_resource.etag) {
                _candidates.push(candidate);
                return;
            }

            var body = 'a=mid:' + (candidate.sdpMid || '0') + '\r\n';
            body += candidate.candidate ? 'a=' + candidate.candidate + '\r\n' : 'a=end-of-candidates\r\n';
            await _request('PATCH', new URL(_resource.location), body, 'application/trickle-ice-sdpfrag', _resource.etag);
        }

        async function _delete(url, etag) {
            try {
                await _request('DELETE', url, undefined, undefined, etag);
            } catch (err) {
                if (err.status !== 404) {
                    throw err;
                }
            }
        }

        function _onVolumeChange(e) {
            _this.dispatchEvent(Event.VOLUMECHANGE, { muted: _video.muted, volume: _video.volume });
        }

        function _onTrack(e) {
            if (e.target !== _pc) {
                return;
            }
            var stream = e.streams[0] || new MediaStream([e.track]);
            if (_video.srcObject !== stream) {
                _stream = stream;
                _video.srcObject = _stream;
                _timer.start();
            }
            _video.play().catch(function (err) {
                if (e.target !== _pc || !_video) {
                    return;
                }
                switch (err.name) {
                    case 'AbortError':
                        _logger.debug(err.name + ': ' + err.message);
                        break;
                    case 'NotAllowedError':
                        if (_video.muted == false) {
                            _video.muted = true;
                            _video.play().catch(function (err) {
                                _logger.warn(`${err}`);
                            });
                            break;
                        }
                    default:
                        _logger.error('Unexpected error occured, ' + err.name + ': ' + err.message);
                        _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
                        break;
                }
            });
            _video.controls = false;
        }

        function _onConnectionStateChange(e) {
            var pc = e.target;
            _logger.log(`onConnectionStateChange: id=${_this.config.id}, state=${pc.connectionState}`);

            switch (pc.connectionState) {
                case 'connected':
                    if (pc === _pc) {
                        _state = State.PLAYING;
                    }
                    break;
                case 'failed':
                case 'closed':
                    if (pc === _pc) {
                        _disconnect();
                    }
                    break;
            }
        }

        function _onIceConnectionStateChange(e) {
            var pc = e.target;
            _logger.log(`onIceConnectionStateChange: id=${_this.config.id}, state=${pc.iceConnectionState}`);
        }

        function _onIceCandidate(e) {
            if (e.target !== _pc) {
                return;
            }
            var candidate = e.candidate;
            if (candidate == null) {
                candidate = {
                    candidate: '',
                    sdpMid: '',
                    sdpMLineIndex: 0,
                };
            }
            _logger.log(`onIceCandidate: id=${_this.config.id}, candidate=${candidate.candidate}, mid=${candidate.sdpMid}, mlineindex=${candidate.sdpMLineIndex}`);

            _patch(candidate).catch((err) => {
                _logger.error(`Failed to send candidate: id=${_this.config.id}, error=${err}`);
            });
        }

        function _onDataChannelOpen(e) {
            if (e.target !== _channel) {
                return;
            }
            _logger.debug(`onDataChannelOpen: ${e.target.label}`);
            clearInterval(_inputTimer);
            _inputTimer = setInterval(function () {
                _resource.ports.forEach(_sendKeyState);
            }, 50);
        }

        function _onDataChannelError(e) {
            _logger.warn(`onDataChannelError: ${e.error}`);
        }

        function _onDataChannelClose(e) {
            _logger.log(`onDataChannelClose: ${e.target.label}`);
            if (e.target === _channel) {
                _disconnect();
            }
        }

        function _disconnect() {
            ++_operation;
            _releaseKeys();
            _candidates = [];
            _resource.ports = [];
            if (_state !== State.CLOSING && _state !== State.CLOSED) {
                _state = State.INITIALIZED;
            }

            if (_timer) {
                _timer.reset();
            }
            clearInterval(_inputTimer);
            _inputTimer = null;

            if (_stream) {
                _stream = null;
            }
            if (_channel) {
                _channel.removeEventListener('open', _onDataChannelOpen);
                _channel.removeEventListener('error', _onDataChannelError);
                _channel.removeEventListener('close', _onDataChannelClose);
                _channel.close();
                _channel = null;
            }

            if (_pc) {
                _pc.removeEventListener('track', _onTrack);
                _pc.removeEventListener('connectionstatechange', _onConnectionStateChange);
                _pc.removeEventListener('iceconnectionstatechange', _onIceConnectionStateChange);
                _pc.removeEventListener('icecandidate', _onIceCandidate);
                _pc.close();
                _pc = null;
            }

            if (_video) {
                _video.pause();
                _video.srcObject = null;
            }
        }

        function _releaseKeys() {
            _resource.ports.forEach(function (port) {
                _keys[port] = 0;
                _sendKeyState(port);
            });
        }

        _this.keyDown = function (port, key) {
            if (_resource.ports.indexOf(port) === -1) {
                return;
            }
            _keys[port] |= key;
            _sendKeyState(port);
        };

        _this.keyUp = function (port, key) {
            if (_resource.ports.indexOf(port) === -1) {
                return;
            }
            _keys[port] &= ~key;
            _sendKeyState(port);
        };

        _this.ports = function () {
            return _resource.ports.slice();
        };

        _this.instance = function () {
            return _resource.instance;
        };

        _this.player = function () {
            return _resource.player;
        };

        _this.location = function () {
            return _resource.location;
        };

        function _sendKeyState(port) {
            if (_resource.ports.indexOf(port) !== -1 && _channel && _channel.readyState === 'open') {
                try {
                    var payload = new Uint8Array([port, _keys[port]]);
                    _channel.send(payload);
                } catch (err) {
                    _logger.warn(`Failed to send input: port=${port}, keys=${_keys[port]}, error=${err}`);
                }
            }
        }

        async function _onStatsTimer() {
            var pc = _pc;
            if (!pc || pc.connectionState === 'closed') {
                return;
            }
            if (pc.connectionState === 'connected') {
                _setCookie(Date.now() + 30000);
            }
            var report;
            try {
                report = await pc.getStats();
            } catch (err) {
                _logger.debug(err.message);
                return;
            }
            if (pc !== _pc) {
                return;
            }

            var current = {
                timestamp: 0,
                framesPerSecond: 0,
                framesDecoded: 0,
                framesDropped: 0,
                nackCount: 0,
                pliCount: 0,
                freezeCount: 0,
            };
            report.forEach(function (stats) {
                if (stats.kind === 'video' && stats.type === 'inbound-rtp') {
                    current.timestamp = stats.timestamp;
                    current.framesPerSecond = stats.framesPerSecond;
                    current.framesDecoded = stats.framesDecoded;
                    current.framesDropped = stats.framesDropped;
                    current.nackCount = stats.nackCount;
                    current.pliCount = stats.pliCount;
                    current.freezeCount = stats.freezeCount;
                }
            });

            var elapsed = Math.max((current.timestamp - _stats.timestamp) / 1000, 1);
            _this.dispatchEvent(MediaEvent.STATSCHANGE, {
                stats: {
                    fps: current.framesPerSecond,
                    decoded: (current.framesDecoded - _stats.framesDecoded) / elapsed,
                    dropped: (current.framesDropped - _stats.framesDropped) / elapsed,
                    nack: (current.nackCount - _stats.nackCount) / elapsed,
                    pli: (current.pliCount - _stats.pliCount) / elapsed,
                    freeze: (current.freezeCount - _stats.freezeCount) / elapsed,
                },
            });
            _stats = current;
        }

        function _setCookie(age) {
            if (!_cookie || (age && (!_resource.instance || !_resource.player || !_resource.etag))) {
                return;
            }
            var value = age ? JSON.stringify({ instance: _resource.instance, player: _resource.player }) : '';
            var expires = new Date(age).toUTCString();
            document.cookie = `${_cookie}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`;
        }

        function _getCookie() {
            var cookies = document.cookie.split('; ');
            for (var cookie of cookies) {
                var index = cookie.indexOf('=');
                if (cookie.substring(0, index) === _cookie) {
                    try {
                        var data = JSON.parse(decodeURIComponent(cookie.substring(index + 1)));
                        if (typeof data.instance === 'string' && data.instance &&
                            typeof data.player === 'string' && data.player) {
                            return { instance: data.instance, player: data.player };
                        }
                    } catch (err) {
                        _logger.warn('Invalid game cookie.');
                    }
                }
            }
            return null;
        }

        _this.muted = function (status) {
            if (_video && status !== undefined) {
                _video.muted = status;
            }
            return _video ? _video.muted : _this.config.muted;
        };

        _this.capture = function (width, height, mime) {
            _canvas.width = width || _video.videoWidth;
            _canvas.height = height || _video.videoHeight;
            _context.drawImage(_video, 0, 0, _canvas.width, _canvas.height);

            var data;
            try {
                data = _canvas.toDataURL(mime || 'image/png');
            } catch (err) {
                _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
                return '';
            }
            _this.dispatchEvent(MediaEvent.SCREENSHOT, { image: data });
            return data;
        };

        _this.state = function () {
            return _state;
        };

        _this.element = function () {
            return _video;
        };

        _this.resize = function (width, height) {

        };

        _this.destroy = function (reason) {
            if (_state === State.CLOSING || _state === State.CLOSED) {
                return;
            }
            _state = State.CLOSING;
            _disconnect();

            var requests = _requests.splice(0);
            requests.forEach(function (xhr) {
                xhr.abort();
            });
            _timer.removeEventListener(TimerEvent.TIMER, _onStatsTimer);
            if (_video) {
                _video.removeEventListener('volumechange', _onVolumeChange);
                _video = null;
            }
            _canvas = null;
            _context = null;
            if (_container) {
                _container.innerHTML = '';
            }
            delete _instances[_id];

            _state = State.CLOSED;
            _this.dispatchEvent(Event.CLOSE, { reason: reason });
        };

        _init();
    }

    Famicom.prototype = Object.create(EventDispatcher.prototype);
    Famicom.prototype.constructor = Famicom;
    Famicom.prototype.CONF = _default;

    Famicom.State = State;
    Famicom.Port = Port;
    Famicom.Key = Key;

    Famicom.get = function (id, logger) {
        if (id == null) {
            id = 0;
        }
        var fc = _instances[id];
        if (fc === undefined) {
            fc = new Famicom(id, logger);
            _instances[id] = fc;
        }
        return fc;
    };

    Famicom.create = function (logger) {
        return Famicom.get(_id++, logger);
    };

    odd.famicom = Famicom.get;
    odd.famicom.create = Famicom.create;
    odd.Famicom = Famicom;
})(odd);

