(function (odd) {
    var utils = odd.utils,
        Logger = utils.Logger,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        NetStatusEvent = events.NetStatusEvent,
        Level = events.Level,
        Code = events.Code,

        State = {
            INITIALIZED: 'initialized',
            CONNECTING: 'connecting',
            CONNECTED: 'connected',
            CLOSING: 'closing',
            CLOSED: 'closed',
        },

        Key = {
            UP: 'up',
            DOWN: 'down',
            LEFT: 'left',
            RIGHT: 'right',
            START: 'start',
            SELECT: 'select',
            B: 'btn_b',
            A: 'btn_a',
        },

        KeyMask = {
            up: 0x01,
            down: 0x02,
            left: 0x04,
            right: 0x08,
            start: 0x10,
            select: 0x20,
            btn_b: 0x40,
            btn_a: 0x80,
        },

        _id = 0,
        _instances = {},
        _default = {
            url: 'http://' + location.host + '/game/',
            msid: '',
            game: '',
            autoplay: true,
            controls: false,
            muted: false,
            playsinline: true,
            audio: true,
            video: true,
            dataChannel: 'game-input',
            iceServers: [{
                urls: ['stun:stun.l.google.com:19302'],
            }],
            iceTransportPolicy: 'all',
            bundlePolicy: 'max-bundle',
            loader: {
                name: 'auto',
                mode: 'cors',        // cors, no-cors, same-origin
                credentials: 'omit', // omit, include, same-origin
            },
        };

    function Famicom(id, logger) {
        var _this = this,
            _id = id,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger(id, logger),
            _container,
            _video,
            _pc,
            _input,
            _stream,
            _state,
            _keyRefs,
            _keyState;

        EventDispatcher.call(this, 'Famicom', { id: id, logger: _logger }, Event, NetStatusEvent);

        function _init() {
            _this.logger = _logger;
            _state = State.INITIALIZED;
            _keyRefs = {};
            _keyState = 0x00;
        }

        _this.id = function () {
            return _id;
        };

        _this.setup = async function (container, config) {
            _this.config = utils.extendz({ id: _id }, _default, config);
            _container = container;
            _video = utils.createElement('video');
            _video.autoplay = _this.config.autoplay;
            _video.controls = _this.config.controls;
            _video.muted = _this.config.muted;
            _video.playsInline = _this.config.playsinline;
            _video.setAttribute('playsinline', '');
            _container.appendChild(_video);
            _bind();
            return Promise.resolve();
        };

        function _bind() {
            _this.video = function () { return _video; };
            _this.dispatchEvent(Event.BIND);
            _this.dispatchEvent(Event.READY);
        }

        _this.load = async function (game, msid) {
            if (game !== undefined) {
                _this.config.game = game;
            }
            if (msid !== undefined) {
                _this.config.msid = msid;
            }
            if (!_this.config.msid) {
                _this.config.msid = _this.config.id;
            }

            _cleanupPeerConnection();
            _setupPeerConnection();
            _state = State.CONNECTING;

            try {
                var offer = await _createOffer();
                var answer = await _postOffer(offer.sdp);
                await _pc.setRemoteDescription(answer);
                await _startGame();
                _state = State.CONNECTED;
                _this.dispatchEvent(NetStatusEvent.NET_STATUS, {
                    level: Level.STATUS,
                    code: Code.NETCONNECTION_CONNECT_SUCCESS,
                    description: 'Famicom connected.',
                    info: { msid: _this.config.msid, game: _this.config.game },
                });
            } catch (err) {
                _state = State.INITIALIZED;
                _logger.error(`Failed to load game: ${err}`);
                _this.dispatchEvent(Event.ERROR, { name: err.name || 'AbortError', message: err.message || err.toString() });
                return Promise.reject(err);
            }
        };

        function _setupPeerConnection() {
            _pc = new RTCPeerConnection({
                iceServers: _this.config.iceServers,
                iceTransportPolicy: _this.config.iceTransportPolicy,
                bundlePolicy: _this.config.bundlePolicy,
            });
            _pc.addEventListener('track', _onTrack);
            _pc.addEventListener('iceconnectionstatechange', _onIceConnectionStateChange);

            _input = _pc.createDataChannel(_this.config.dataChannel, { ordered: true });
            _input.addEventListener('open', _onDataChannelOpen);
            _input.addEventListener('close', _onDataChannelClose);
            _input.addEventListener('error', _onDataChannelError);

            if (_this.config.audio) {
                _pc.addTransceiver('audio', { direction: 'recvonly' });
            }
            if (_this.config.video) {
                _pc.addTransceiver('video', { direction: 'recvonly' });
            }
            _setCodecPreferences();
        }

        function _setCodecPreferences() {
            if (!window.RTCRtpSender || !window.RTCRtpReceiver) {
                return;
            }

            var audiocodecs = [];
            var videocodecs = [];
            var ac = RTCRtpSender.getCapabilities && RTCRtpSender.getCapabilities('audio');
            if (ac && ac.codecs) {
                ac.codecs.forEach(function (codec) {
                    if (codec.mimeType === 'audio/opus') {
                        audiocodecs.push(codec);
                    }
                });
            }

            var vc = RTCRtpReceiver.getCapabilities && RTCRtpReceiver.getCapabilities('video');
            if (vc && vc.codecs) {
                vc.codecs.forEach(function (codec) {
                    if (codec.mimeType === 'video/H264' &&
                        codec.sdpFmtpLine &&
                        codec.sdpFmtpLine.indexOf('packetization-mode=1') !== -1 &&
                        codec.sdpFmtpLine.indexOf('profile-level-id=42e01f') !== -1) {
                        videocodecs.push(codec);
                    }
                });
            }

            _pc.getTransceivers().forEach(function (transceiver) {
                if (!transceiver.setCodecPreferences || !transceiver.receiver || !transceiver.receiver.track) {
                    return;
                }
                switch (transceiver.receiver.track.kind) {
                    case 'audio':
                        if (audiocodecs.length) {
                            transceiver.setCodecPreferences(audiocodecs);
                        }
                        break;
                    case 'video':
                        if (videocodecs.length) {
                            transceiver.setCodecPreferences(videocodecs);
                        }
                        break;
                }
            });
        }

        async function _createOffer() {
            var offer = await _pc.createOffer();
            offer.sdp = offer.sdp.replace(/a=extmap:\d+ http:\/\/www.ietf.org\/id\/draft-holmer-rmcat-transport-wide-cc-extensions-01(\n|\r\n)/gi, '');
            offer.sdp = offer.sdp.replace(/a=rtcp-fb:\d+ goog-remb(\n|\r\n)a=rtcp-fb:\d+ transport-cc(\n|\r\n)/gi, '');
            await _pc.setLocalDescription(offer);
            return offer;
        }

        async function _postOffer(sdp) {
            var xhr = await _request('POST', _gameUrl(), { 'Content-Type': 'application/sdp' }, sdp);
            return new RTCSessionDescription({ type: 'answer', sdp: xhr.responseText || xhr.response });
        }

        async function _startGame() {
            var url = _gameUrl() + '?action=start';
            if (_this.config.game) {
                url += '&game=' + _this.config.game;
            }
            await _request('GET', url, {});
        }

        function _gameUrl() {
            return _this.config.url.replace(/\/?$/, '/') + _this.config.msid;
        }

        function _request(method, url, headers, body) {
            return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open(method, url, true);
                utils.forEach(headers || {}, function (key, value) {
                    xhr.setRequestHeader(key, value);
                });
                xhr.onload = function () {
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(xhr);
                        return;
                    }
                    reject({ name: 'NetworkError', message: method + ' ' + url + ' failed: status=' + xhr.status });
                };
                xhr.onerror = function () {
                    reject({ name: 'NetworkError', message: method + ' ' + url + ' failed.' });
                };
                xhr.send(body);
            });
        }

        function _onTrack(e) {
            var stream = e.streams[0];
            if (_video.srcObject !== stream) {
                _stream = stream;
                _video.srcObject = _stream;
            }
            _video.play().catch(function (err) {
                _logger.warn(`${err}`);
            });
        }

        function _onIceConnectionStateChange(e) {
            _logger.debug(`Famicom.onIceConnectionStateChange: ${e.target.iceConnectionState}`);
        }

        function _onDataChannelOpen(e) {
            _sendKeyState();
        }

        function _onDataChannelClose(e) {
            _logger.debug(`DataChannel closed: ${_this.config.dataChannel}`);
        }

        function _onDataChannelError(e) {
            _logger.warn(`DataChannel error: ${e && e.error ? e.error.message : 'unknown'}`);
        }

        _this.keyDown = function (key) {
            var count = _keyRefs[key] || 0;
            _keyRefs[key] = count + 1;
            if (count === 0) {
                _keyState |= KeyMask[key] || 0;
                _sendKeyState();
            }
        };

        _this.keyUp = function (key) {
            var count = _keyRefs[key] || 0;
            if (count <= 0) {
                return;
            }
            if (count === 1) {
                delete _keyRefs[key];
                _keyState &= ~(KeyMask[key] || 0);
                _sendKeyState();
                return;
            }
            _keyRefs[key] = count - 1;
        };

        _this.key = function (key, pressed) {
            return pressed ? _this.keyDown(key) : _this.keyUp(key);
        };

        _this.keys = function (state) {
            if (state !== undefined) {
                _keyState = state & 0xFF;
                _keyRefs = {};
                _sendKeyState();
            }
            return _keyState;
        };

        function _sendKeyState() {
            if (_input && _input.readyState === 'open') {
                try {
                    _input.send(new Uint8Array([_keyState]));
                } catch (err) {
                    _logger.warn(`Failed to send input: state=${_keyState}, error=${err}`);
                }
            }
        }

        _this.state = function () {
            return _state;
        };

        function _cleanupPeerConnection() {
            if (_input) {
                _input.removeEventListener('open', _onDataChannelOpen);
                _input.removeEventListener('close', _onDataChannelClose);
                _input.removeEventListener('error', _onDataChannelError);
                _input.close();
                _input = null;
            }
            if (_pc) {
                _pc.removeEventListener('track', _onTrack);
                _pc.removeEventListener('iceconnectionstatechange', _onIceConnectionStateChange);
                _pc.close();
                _pc = null;
            }
            if (_stream) {
                _stream.getTracks().forEach(function (track) {
                    track.stop();
                });
                _stream = null;
            }
            if (_video) {
                _video.srcObject = null;
            }
        }

        _this.destroy = function (reason) {
            _state = State.CLOSING;
            _cleanupPeerConnection();
            if (_container && _video && _video.parentNode === _container) {
                _container.removeChild(_video);
            }
            _state = State.CLOSED;
            _this.dispatchEvent(Event.CLOSE, { reason: reason });
            delete _instances[_id];
        };

        _init();
    }

    Famicom.prototype = Object.create(EventDispatcher.prototype);
    Famicom.prototype.constructor = Famicom;
    Famicom.prototype.CONF = _default;

    Famicom.State = State;
    Famicom.Key = Key;
    Famicom.KeyMask = KeyMask;

    Famicom.get = function (id, nc, logger) {
        if (id == null) {
            id = 0;
        }
        if (logger === undefined) {
            logger = nc;
        }
        var fc = _instances[id];
        if (fc === undefined) {
            fc = new Famicom(id, logger);
            _instances[id] = fc;
        }
        return fc;
    };

    Famicom.create = function (nc, logger) {
        if (logger === undefined) {
            logger = nc;
        }
        return Famicom.get(_id++, logger);
    };

    odd.famicom = Famicom.get;
    odd.famicom.create = Famicom.create;
    odd.Famicom = Famicom;
})(odd);
