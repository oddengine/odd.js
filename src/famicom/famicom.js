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
            channel: 'game-input',
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
            _location,
            _params,
            _ports,
            _pc,
            _channel,
            _stream,
            _xhr,
            _keys,
            _timer,
            _stats,
            _state;

        EventDispatcher.call(this, 'Famicom', { id: id, logger: _logger }, Event, MediaEvent, NetStatusEvent);

        function _init() {
            _this.logger = _logger;

            _location = _getCookie() || new URL(location.href);
            _params = new URLSearchParams(_location.search);
            _ports = (_params.get('ports') || '').split(',').filter(function (port) {
                return port !== '';
            }).map(Number);
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

        _this.load = async function (game, controllers) {
            var url = `${_this.config.base}/play?game=${game}`;
            if (controllers !== undefined) {
                url += `&controllers=${controllers}`;
            }
            return _this.play(url);
        };

        _this.play = async function (url) {
            if (url) {
                var location = new URL(url);
                var params = new URLSearchParams(location.search);
                if (params.get('instance') !== _params.get('instance')) {
                    await _this.stop();
                }
                _location = location;
                _params = params;
            }

            var game = _params.get('game');
            _initPeerConnection();

            try {
                var offer = await _pc.createOffer();
                offer.sdp = offer.sdp.replace(/a=extmap:\d+ http:\/\/www.ietf.org\/id\/draft-holmer-rmcat-transport-wide-cc-extensions-01(\n|\r\n)/gi, '');
                offer.sdp = offer.sdp.replace(/a=rtcp-fb:\d+ goog-remb(\n|\r\n)/gi, '');
                offer.sdp = offer.sdp.replace(/a=rtcp-fb:\d+ transport-cc(\n|\r\n)/gi, '');
                _logger.log(`createOffer success: id=${_id}, game=${game}, sdp=\n${offer.sdp}`);
                
                await _pc.setLocalDescription(offer);

                var response = await _post(_location.href, offer.sdp);
                var answer = new RTCSessionDescription({ type: 'answer', sdp: response });
                await _pc.setRemoteDescription(answer);
            } catch (err) {
                _logger.error(`Failed to play: id=${_id}, game=${game}, error=${err}`);
                return Promise.reject(err);
            }

            _setJitterBufferTarget();
            _state = State.PLAYING;
            return Promise.resolve();
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

            _channel = _pc.createDataChannel(_this.config.channel, {
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

        function _setJitterBufferTarget() {
            _pc.getReceivers().forEach(function (receiver) {
                if (receiver.track && receiver.track.kind === 'video') {
                    receiver.jitterBufferTarget = 40;
                }
            });
        }

        async function _post(url, sdp) {
            return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open('POST', url, true);
                xhr.setRequestHeader('Content-Type', 'application/sdp');
                xhr.onreadystatechange = function () {
                    if (xhr.readyState !== 4) {
                        return;
                    }
                    if (xhr.status < 200 || xhr.status > 299) {
                        _logger.error(`Loader NetworkError: ${xhr.status} ${xhr.statusText}`);
                        reject({ name: 'NetworkError', message: `${xhr.status} ${xhr.statusText}` });
                        return;
                    }
                    if (xhr.status >= 200 && xhr.status < 300) {
                        var location = xhr.getResponseHeader('Location');
                        if (location) {
                            _logger.log(`Location: ${location}`);
                            _location = new URL(location);
                            _params = new URLSearchParams(_location.search);
                            _ports = (_params.get('ports') || '').split(',').filter(function (port) {
                                return port !== '';
                            }).map(Number);
                            _setCookie(location, Date.now() + 30000);
                        }
                        resolve(xhr.responseText);
                        return;
                    }
                };
                xhr.onerror = function (err) {
                    _logger.error(`Loader ${err.name}: ${err.message}`);
                    reject(err);
                };
                xhr.send(sdp);
            });
        }

        async function _patch(candidate) {
            if (_this.config.trickle !== true || _location == null) {
                return Promise.resolve();
            }
            return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open('PATCH', _location.href, true);
                xhr.setRequestHeader('Content-Type', 'application/trickle-ice-sdpfrag');
                xhr.onreadystatechange = function () {
                    if (xhr.readyState !== 4) {
                        return;
                    }
                    if (xhr.status < 200 || xhr.status > 299) {
                        _logger.error(`Loader NetworkError: ${xhr.status} ${xhr.statusText}`);
                        reject({ name: 'NetworkError', message: `${xhr.status} ${xhr.statusText}` });
                        return;
                    }
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                        return;
                    }
                };
                xhr.onerror = function (err) {
                    _logger.error(`Loader ${err.name}: ${err.message}`);
                    reject(err);
                };
                if (candidate.candidate) {
                    xhr.send(`a=${candidate.candidate}\na=end-of-candidates`);
                } else {
                    xhr.send('a=end-of-candidates');
                }
            });
        }

        async function _stop() {
            if (!_params.get('instance') || !_params.get('player')) {
                return Promise.resolve();
            }
            return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open('DELETE', _location.href, true);
                xhr.send();
                xhr.onreadystatechange = function () {
                    if (xhr.readyState !== 4) {
                        return;
                    }
                    if (xhr.status < 200 || xhr.status > 299) {
                        _logger.error(`Loader NetworkError: ${xhr.status} ${xhr.statusText}`);
                        reject({ name: 'NetworkError', message: `${xhr.status} ${xhr.statusText}` });
                        return;
                    }
                    resolve();
                };
                xhr.onerror = function (err) {
                    _logger.error(`Loader ${err.name}: ${err.message}`);
                    reject(err);
                };
            });
        }

        async function _delete() {
            if (_location == null) {
                return Promise.resolve();
            }
            return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open('DELETE', _location.href, true);
                xhr.send();
                xhr.onreadystatechange = function () {
                    if (xhr.readyState !== 4) {
                        return;
                    }
                    if (xhr.status < 200 || xhr.status > 299) {
                        _logger.error(`Loader NetworkError: ${xhr.status} ${xhr.statusText}`);
                        reject({ name: 'NetworkError', message: `${xhr.status} ${xhr.statusText}` });
                        return;
                    }
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                        return;
                    }
                };
                xhr.onerror = function (err) {
                    _logger.error(`Loader ${err.name}: ${err.message}`);
                    reject(err);
                };
            });
        }

        function _onVolumeChange(e) {
            _this.dispatchEvent(Event.VOLUMECHANGE, { muted: _video.muted, volume: _video.volume });
        }

        function _onTrack(e) {
            var stream = e.streams[0];
            if (_video.srcObject !== stream) {
                _stream = stream;
                _video.srcObject = _stream;
                _timer.start();
            }
            _video.play().catch(function (err) {
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
                case 'failed':
                case 'closed':
                    _this.stop();
                    break;
            }
        }

        function _onIceConnectionStateChange(e) {
            var pc = e.target;
            _logger.log(`onIceConnectionStateChange: id=${_this.config.id}, state=${pc.iceConnectionState}`);
        }

        function _onIceCandidate(e) {
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
            _logger.debug(`onDataChannelOpen: ${e.target.label}`);
        }

        function _onDataChannelError(e) {
            _logger.warn(`onDataChannelError: ${e.error}`);
        }

        function _onDataChannelClose(e) {
            _logger.log(`onDataChannelClose: ${e.target.label}`);
        }

        _this.stop = async function () {
            if (_timer) {
                _timer.reset();
            }
            if (_xhr) {
                _xhr.abort();
            }
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

            await _stop();
            return Promise.resolve();
        };

        _this.keyDown = function (port, key) {
            _keys[port] |= key;
            _sendKeyState(port);
        };

        _this.keyUp = function (port, key) {
            _keys[port] &= ~key;
            _sendKeyState(port);
        };

        _this.ports = function () {
            return _ports.slice();
        };

        _this.location = function () {
            return _location.href;
        };

        function _sendKeyState(port) {
            if (_channel && _channel.readyState === 'open') {
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
            var report = await pc.getStats();

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

        function _setCookie(value, age) {
            var expires = new Date(age).toUTCString();
            document.cookie = `famicom=${value}; expires=${expires}`;
        }

        function _getCookie() {
            var cookies = document.cookie.split('; ');
            for (var cookie of cookies) {
                var i = cookie.indexOf('=');
                if (cookie.substring(0, i) === 'famicom') {
                    return new URL(cookie.substring(i + 1));
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

        _this.destroy = async function (reason) {
            switch (_state) {
                case State.INITIALIZED:
                case State.CONNECTING:
                case State.PLAYING:
                    _state = State.CLOSING;

                    await _this.stop();
                    if (_params.get('instance')) {
                        _params.delete('player');
                        _params.delete('ports');
                        _location.search = _params.toString();
                        await _delete();
                    }

                    if (_video) {
                        _video.removeEventListener('volumechange', _onVolumeChange);
                    }
                    _canvas = null;
                    _context = null;
                    if (_container) {
                        _container.innerHTML = '';
                    }
                    delete _instances[_id];

                    _this.dispatchEvent(Event.CLOSE, { reason: reason });
                    _state = State.CLOSED;
                    break;
            }
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

