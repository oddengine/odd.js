(function (odd) {
    var utils = odd.utils,
        WriterState = utils.StreamWriter.WriterState,
        StreamSaver = utils.StreamSaver,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        NetStatusEvent = events.NetStatusEvent,
        SaverEvent = events.SaverEvent,
        Level = events.Level,
        Code = events.Code,
        RTC = odd.RTC,
        State = RTC.State,
        Constraints = RTC.Constraints,
        Mixer = RTC.Mixer,
        Beauty = RTC.Beauty,
        AudioMeter = RTC.AudioMeter,

        _default = {
            id: 0,
            profile: '720P_2',
            whip: `${location.protocol}//${location.host}/whip/live`,
            whep: `${location.protocol}//${location.host}/whep/live`,
            trickle: false,
            configuration: {
                iceServers: [{
                    urls: ["stun:stun.l.google.com:19302"],
                }],
            },
            codecpreferences: [
                'audio/opus',
                'video/H264',
            ],
            service: {
                script: 'js/sw.js',
                scope: 'js/',
                enable: false,
            },
        };

    function NetStream(config, logger) {
        EventDispatcher.call(this, 'NetStream', { logger: logger }, [Event.ERROR, Event.RELEASE], NetStatusEvent);

        var _this = this,
            _logger = logger,
            _video,
            _pc,
            _name,
            _stream,
            _videomixer,
            _screensharing = false,
            _withcamera = false,
            _beauty,
            _subscribing = [],
            _audiometer,
            _recorder,
            _location,
            _saver,
            _writer,
            _stats,
            _properties = {},
            _readyState;

        function _init() {
            _this.config = utils.extendz({}, _default, config);
            _this.constraints = utils.extendz({
                audio: {
                    deviceId: '',
                },
                video: {
                    deviceId: '',
                    facingMode: 'user',
                    cursor: 'always', // always, motion, never
                },
            }, Constraints[_this.config.profile]);

            _video = utils.createElement('video');
            _video.setAttribute('x-webkit-airplay', 'allow');
            _video.setAttribute('autoplay', '');
            _video.setAttribute('playsinline', '');
            _video.setAttribute('webkit-playsinline', 'isiPhoneShowPlaysinline');
            _video.setAttribute('x5-playsinline', '');
            _video.setAttribute('x5-video-player-type', 'h5-page');
            _video.setAttribute('x5-video-player-fullscreen', true);
            _video.setAttribute('t7-video-player-type', 'inline');

            _beauty = new Beauty(_logger);
            _audiometer = new AudioMeter(_logger);
            _stats = new RTC.Stats(_logger);
            _readyState = State.INITIALIZED;

            _saver = new StreamSaver(_this.config.service, _logger);
            _saver.addEventListener(SaverEvent.WRITERSTART, _onWriterStart);
            _saver.addEventListener(SaverEvent.WRITEREND, _onWriterEnded);
        }

        _this.name = function () {
            return _name;
        };

        _this.attach = async function () {
            switch (_readyState) {
                case State.CONNECTED:
                case State.PUBLISHING:
                case State.PLAYING:
                    return Promise.resolve();
                default:
                    _pc = new RTCPeerConnection(_this.config.configuration);
                    _pc.addEventListener('negotiationneeded', _onNegotiationNeeded);
                    _pc.addEventListener('track', _onTrack);
                    _pc.addEventListener('connectionstatechange', _onConnectionStateChange);
                    _pc.addEventListener('iceconnectionstatechange', _onIceConnectionStateChange);
                    if (_this.config.trickle) {
                        _pc.addEventListener('icecandidate', _onIceCandidate);
                    }

                    _readyState = State.CONNECTED;
                    return Promise.resolve();
            }
        };

        _this.applyConstraints = function (constraints) {
            _this.constraints = utils.extendz(_this.constraints, constraints);
            if (_stream) {
                _stream.getTracks().forEach(function (track) {
                    track.applyConstraints(_this.constraints[track.kind]);
                });
            }
        };

        _this.setCamera = async function (deviceId) {
            if (_readyState === State.PUBLISHING && (!_screensharing || _withcamera)) {
                var constraints = utils.extendz({}, _this.constraints, {
                    audio: false,
                    video: {
                        deviceId: deviceId,
                    },
                });
                var source;
                try {
                    source = await navigator.mediaDevices.getUserMedia(constraints);
                    _logger.log(`Got user media: id=${_this.config.id}, stream=${_name}, stream=${source.id}, constraints=`, constraints);
                } catch (err) {
                    _logger.error(`Failed to get user media: id=${_this.config.id}, stream=${_name}, constraints=`, constraints, `, error=${err}`);
                    return Promise.reject(err);
                }

                var track = source.getVideoTracks()[0];
                if (_screensharing) {
                    if (_withcamera) {
                        var found = false;
                        _videomixer.forEach(function (element) {
                            if (element.kind === 'camera') {
                                element.track.stop();
                                element.track = track;
                                element.srcObject = source;
                                element.play();
                                found = true;
                            }
                        });
                        if (found === false) {
                            track.stop();
                        }
                    }
                } else {
                    _this.replaceTrack(track, true).catch(function (err) {
                        track.stop();
                    });
                }
            }
            _this.applyConstraints({
                video: {
                    deviceId: deviceId,
                },
            });
        };

        _this.setMicrophone = function (deviceId) {
            _this.applyConstraints({
                audio: {
                    deviceId: deviceId,
                },
            });
        };

        _this.setProfile = function (profile) {
            _this.config.profile = profile;
            _this.applyConstraints(Constraints[_this.config.profile]);
        };

        _this.setResolution = function (width, height) {
            _this.applyConstraints({
                video: {
                    width: width,
                    height: height,
                },
            });
        };

        _this.setFramerate = function (fps) {
            _this.applyConstraints({
                video: {
                    frameRate: fps,
                },
            });
        };

        _this.setBitrate = function (bitrate) {
            _this.applyConstraints({
                video: {
                    maxBitrate: bitrate,
                },
            });
        };

        _this.getUserMedia = async function (constraints) {
            var stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                _logger.log(`Got user media: id=${_this.config.id}, stream=${_name}, stream=${stream.id}, constraints=`, constraints);
            } catch (err) {
                _logger.error(`Failed to get user media: id=${_this.config.id}, stream=${_name}, constraints=`, constraints, `, error=${err}`);
                return Promise.reject(err);
            }
            return Promise.resolve(stream);
        };

        _this.getDisplayMedia = async function (constraints) {
            var stream;
            try {
                stream = await navigator.mediaDevices.getDisplayMedia(constraints);
                _logger.log(`Got display media: id=${_this.config.id}, stream=${_name}, stream=${stream.id}, constraints=`, constraints);
            } catch (err) {
                _logger.error(`Failed to get display media: id=${_this.config.id}, stream=${_name}, constraints=`, constraints, `, error=${err}`);
                return Promise.reject(err);
            }
            return Promise.resolve(stream);
        };

        _this.addTrack = function (track, stream) {
            track.addEventListener('ended', _onEnded);
            track.addEventListener('mute', _onMute);
            track.addEventListener('unmute', _onUnmute);

            var sender = _pc.addTrack(track, stream);
            _logger.log(`AddTrack: id=${_this.config.id}, stream=${_name}, kind=${track.kind}, id=${track.id}, label=${track.label}`);
            if (sender.track.id !== track.id) {
                _logger.warn(`Track id changed: id=${_this.config.id}, stream=${_name}, ${sender.track.id} != ${track.id}`);
            }
            return sender;
        };

        _this.replaceTrack = function (track, stopprevious) {
            var origin;
            if (track.kind === 'audio') {
                origin = _stream.getAudioTracks()[0];
            } else {
                origin = _stream.getVideoTracks()[0];
            }
            if (origin == undefined) {
                return Promise.reject(`${track.kind} track not found`);
            }

            origin.removeEventListener('ended', _onEnded);
            origin.removeEventListener('mute', _onMute);
            origin.removeEventListener('unmute', _onUnmute);

            _stream.removeTrack(origin);
            _stream.addTrack(track);

            _pc.getSenders().forEach(function (sender) {
                var item = sender.track;
                if (item && item.kind === track.kind && item.getSettings().deviceId === origin.getSettings().deviceId) {
                    sender.replaceTrack(track);
                }
            });
            if (stopprevious) {
                origin.stop();
            }
            return Promise.resolve();
        };

        _this.removeTrack = function (sender) {
            var track = sender.track;
            if (track) {
                track.removeEventListener('ended', _onEnded);
                track.removeEventListener('mute', _onMute);
                track.removeEventListener('unmute', _onUnmute);

                _this.dispatchEvent(NetStatusEvent.NETSTATUS, {
                    level: Level.STATUS,
                    code: Code.NETSTREAM_UNPUBLISH_SUCCESS,
                    description: 'unpublish success',
                    info: {
                        track: track.id,
                    },
                });
            }
            _pc.removeTrack(sender);
        };

        function _onEnded(e) {
            var track = e.target;
            _logger.log(`Track ended: id=${_this.config.id}, stream=${_name}, kind=${track.kind}, id=${track.id}, label=${track.label}`);
        }

        function _onMute(e) {
            var track = e.target;
            _logger.log(`Track muted: id=${_this.config.id}, stream=${_name}, kind=${track.kind}, id=${track.id}, label=${track.label}`);
        }

        function _onUnmute(e) {
            var track = e.target;
            _logger.log(`Track unmuted: id=${_this.config.id}, stream=${_name}, kind=${track.kind}, id=${track.id}, label=${track.label}`);
        }

        _this.createStream = async function (screensharing, withcamera, option) {
            var stream;
            if (screensharing) {
                if (withcamera) {
                    stream = new MediaStream();

                    _videomixer = new Mixer.VideoMixer(_logger);
                    _videomixer.applyConstraints(_this.constraints.video);

                    var source = await _this.getDisplayMedia(_this.constraints);
                    source.getAudioTracks().forEach(function (track) {
                        stream.addTrack(track);
                    });
                    var screen = utils.createElement('video');
                    screen.setAttribute('playsinline', '');
                    screen.setAttribute('autoplay', '');
                    screen.width = _this.constraints.video.width;
                    screen.height = _this.constraints.video.height;
                    screen.muted = true;
                    screen.kind = 'screen';
                    screen.track = source.getVideoTracks()[0];
                    screen.srcObject = source;
                    screen.play();
                    _videomixer.add(screen, { layer: 0 });

                    source = await _this.getUserMedia(_this.constraints);
                    source.getAudioTracks().forEach(function (track) {
                        stream.addTrack(track);
                    });
                    var camera = utils.createElement('video');
                    camera.setAttribute('playsinline', '');
                    camera.setAttribute('autoplay', '');
                    camera.width = option && option.width ? option.width : screen.width / 4;
                    camera.height = option && option.height ? option.height : screen.height / 4;
                    camera.muted = true;
                    camera.kind = 'camera';
                    camera.track = source.getVideoTracks()[0];
                    camera.srcObject = source;
                    camera.play();
                    _videomixer.add(camera, utils.extendz({ layer: 9 }, utils.extendz({ top: 20, right: 20 }, option)));

                    _videomixer.start();
                    source = _videomixer.stream();
                    source.getVideoTracks().forEach(function (track) {
                        stream.addTrack(track);
                    });
                } else {
                    stream = await _this.getDisplayMedia(_this.constraints);
                }
            } else {
                stream = await _this.getUserMedia(_this.constraints);
            }

            _name = stream.id;
            _screensharing = screensharing;
            _withcamera = withcamera;
            _stream = stream;
            return Promise.resolve(stream);
        };

        _this.preview = async function (screensharing, withcamera, option) {
            if (_stream == null) {
                try {
                    await _this.createStream(screensharing, withcamera, option);
                } catch (err) {
                    _logger.error(`Failed to create stream: id=${_this.config.id}, stream=${_name}`);
                    return Promise.reject(err);
                }
            }
            _stream.getTracks().forEach(function (track) {
                _this.addTrack(track, _stream);
            });
            _video.muted = true;
            _video.srcObject = _stream;
            _video.play().catch(function (err) {
                if (err.name !== 'AbortError') {
                    _logger.warn(`Failed to play preview: id=${_this.config.id}, stream=${_name}, error=${err}`);
                }
            });
            return Promise.resolve();
        };

        _this.publish = async function () {
            _setCodecPreferences('sender');

            try {
                var offer = await _pc.createOffer();
                offer.sdp = offer.sdp.replace(/a=extmap:\d+ http:\/\/www.ietf.org\/id\/draft-holmer-rmcat-transport-wide-cc-extensions-01(\n|\r\n)/gi, '');
                offer.sdp = offer.sdp.replace(/a=rtcp-fb:\d+ goog-remb(\n|\r\n)/gi, '');
                offer.sdp = offer.sdp.replace(/a=rtcp-fb:\d+ transport-cc(\n|\r\n)/gi, '');
                _logger.log(`createOffer success: id=${_this.config.id}, stream=${_name}, sdp=\n${offer.sdp}`);

                await _pc.setLocalDescription(offer);

                var response = await _post(_this.config.whip, offer.sdp);
                var answer = new RTCSessionDescription({ type: 'answer', sdp: response });
                await _pc.setRemoteDescription(answer);
            } catch (err) {
                _logger.error(`Failed to publish: id=${_this.config.id}, stream=${_name}, error=${err}`);
                return Promise.reject(err);
            }

            _setMaxBitrate();
            _readyState = State.PUBLISHING;
            _this.dispatchEvent(NetStatusEvent.NETSTATUS, {
                level: Level.STATUS,
                code: Code.NETSTREAM_PUBLISH_START,
                description: 'publish start',
                info: {
                    stream: _this.getProperty('@id') || _this.getProperty('stream'),
                    id: _this.getProperty('@id'),
                    location: _location,
                },
            });
            return Promise.resolve();
        };

        function _setCodecPreferences(type) {
            var audiocodecs = [];
            var videocodecs = [];
            var factory = type === 'sender' ? RTCRtpSender : RTCRtpReceiver;

            var ac = factory.getCapabilities('audio');
            if (ac && ac.codecs) {
                ac.codecs.forEach(function (codec) {
                    if (codec.mimeType === 'audio/opus') {
                        audiocodecs.push(codec);
                    }
                });
            }
            var vc = factory.getCapabilities('video');
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
                switch (transceiver[type].track.kind) {
                    case 'audio':
                        transceiver.setCodecPreferences(audiocodecs);
                        break;
                    case 'video':
                        transceiver.setCodecPreferences(videocodecs);
                        break;
                }
            });
        }

        function _setMaxBitrate() {
            _pc.getSenders().forEach(function (sender) {
                var track = sender.track;
                if (track && track.kind === 'video' && _this.constraints.video && _this.constraints.video.maxBitrate) {
                    var bitrate = _this.constraints.video.maxBitrate * 1000;
                    var parameters = sender.getParameters();
                    if (parameters.encodings == null) {
                        parameters.encodings = [{}];
                    }
                    parameters.encodings.forEach(function (encoding) {
                        encoding.maxBitrate = bitrate;
                    });
                    sender.setParameters(parameters).then(function () {
                        _logger.log(`Set max bitrate: id=${_this.config.id}, stream=${_name}, value=${bitrate}`);
                    }).catch(function (err) {
                        _logger.warn(`Failed to set max bitrate: id=${_this.config.id}, stream=${_name}, value=${bitrate}, error=${err}`);
                    });
                }
            });
        }

        function _setJitterBufferTarget() {
            _pc.getReceivers().forEach(function (receiver) {
                if (receiver.track && receiver.track.kind === 'video') {
                    receiver.jitterBufferTarget = 300;
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
                        _location = xhr.getResponseHeader('Location');
                        if (_location) {
                            _logger.log(`Location: ${_location}`);
                            _location = new URL(_location, url).href;
                            _params = new URLSearchParams(new URL(_location).search);
                            _port = Number(_params.get('port'));
                            _setCookie(_params.toString(), Date.now() + 30000);
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
                xhr.open('PATCH', _location, true);
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

        async function _delete() {
            if (_location == null) {
                return Promise.resolve();
            }
            return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open('DELETE', _location, true);
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

        _this.beauty = function (enable, constraints) {
            if (enable) {
                _beauty.enable(_stream, constraints).then(function () {
                    _this.replaceTrack(_beauty.output(), false).catch(function (err) {
                        _logger.error(`Failed to replace track: id=${_this.config.id}, stream=${_name}, error=${err}`);
                    });
                });
            } else {
                var input = _beauty.input();
                if (input) {
                    _this.replaceTrack(input, true).catch(function (err) {
                        _logger.error(`Failed to replace track: id=${_this.config.id}, stream=${_name}, error=${err}`);
                    });
                    _beauty.disable();
                }
            }
        };

        _this.beautyEnabled = function () {
            return _beauty.enabled();
        };

        _this.play = async function (name) {
            _name = name;

            _pc.addTransceiver('audio', { direction: 'recvonly' });
            _pc.addTransceiver('video', { direction: 'recvonly' });
            _setCodecPreferences('receiver');

            try {
                var offer = await _pc.createOffer();
                offer.sdp = offer.sdp.replace(/a=extmap:\d+ http:\/\/www.ietf.org\/id\/draft-holmer-rmcat-transport-wide-cc-extensions-01(\n|\r\n)/gi, '');
                offer.sdp = offer.sdp.replace(/a=rtcp-fb:\d+ goog-remb(\n|\r\n)/gi, '');
                offer.sdp = offer.sdp.replace(/a=rtcp-fb:\d+ transport-cc(\n|\r\n)/gi, '');
                _logger.log(`createOffer success: id=${_this.config.id}, stream=${_name}, sdp=\n${offer.sdp}`);

                await _pc.setLocalDescription(offer);

                var response = await _post(`${_this.config.whep}/${_name}`, offer.sdp);
                var answer = new RTCSessionDescription({ type: 'answer', sdp: response });
                await _pc.setRemoteDescription(answer);
            } catch (err) {
                _logger.error(`Failed to play: id=${_this.config.id}, stream=${_name}, error=${err}`);
                return Promise.reject(err);
            }

            _setJitterBufferTarget();
            _readyState = State.PLAYING;
            return Promise.resolve();
        };

        function _onNegotiationNeeded(e) {
            // We don't negotiate at this moment, until user called publish manually.
            _logger.log(`onNegotiationNeeded: id=${_this.config.id}, stream=${_name}`);
        }

        function _onTrack(e) {
            var stream = e.streams[0];
            _logger.log(`onTrack: id=${_this.config.id}, stream=${_name}, kind=${e.track.kind}, track=${e.track.id}, stream=${stream.id}`);

            _subscribing.push(e.track);
            _audiometer.update(stream);
            _stream = stream;
            if (_video.srcObject !== stream) {
                _video.srcObject = stream;
            }
            _video.play().catch(function (err) {
                if (err.name !== 'AbortError') {
                    _logger.warn(`Failed to play stream: id=${_this.config.id}, stream=${_name}, error=${err}`);
                }
            });
            _this.dispatchEvent(NetStatusEvent.NETSTATUS, {
                level: Level.STATUS,
                code: Code.NETSTREAM_PLAY_START,
                description: 'play start',
                info: {
                    track: e.track,
                    streams: e.streams,
                },
            });
        }

        function _onConnectionStateChange(e) {
            var pc = e.target;
            _logger.log(`onConnectionStateChange: id=${_this.config.id}, stream=${_name}, state=${pc.connectionState}`);

            switch (pc.connectionState) {
                case 'failed':
                case 'closed':
                    _this.close(pc.connectionState);
                    break;
            }
        }

        function _onIceConnectionStateChange(e) {
            var pc = e.target;
            _logger.log(`onIceConnectionStateChange: id=${_this.config.id}, stream=${_name}, state=${pc.iceConnectionState}`);
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
            _logger.log(`onIceCandidate: id=${_this.config.id}, stream=${_name}, candidate=${candidate.candidate}, mid=${candidate.sdpMid}, mlineindex=${candidate.sdpMLineIndex}`);

            _patch(candidate).catch((err) => {
                _logger.error(`Failed to send candidate: id=${_this.config.id}, stream=${_name}, error=${err}`);
            });
        }

        _this.record = function (filename, ondata) {
            function handler() {
                if (_stream == null) {
                    return Promise.reject('Failed to record stream, not found.');
                }
                var writer = _saver.record(filename);
                if (ondata) {
                    writer.write = ondata;
                    writer.close = writer.abort;
                }
                _swapWriter(writer);
                return Promise.resolve(_writer);
            }
            if (_this.config.service.enable) {
                return handler();
            } else {
                return _saver.register().then(handler);
            }
        };

        function _swapWriter(writer) {
            if (_writer !== writer) {
                if (_writer) {
                    _writer.close();
                }
                _writer = writer;

                _recorder = new MediaRecorder(_stream);
                _recorder.addEventListener('dataavailable', _onDataAvailable);
                _recorder.start(200);
            }
        }

        function _onDataAvailable(e) {
            if (_writer) {
                if (_writer.readyState === WriterState.INIT) {
                    _writer.start();
                }
                e.data.arrayBuffer().then((buffer) => {
                    _writer.write(new Uint8Array(buffer));
                });
            }
        }

        function _onWriterStart(e) {
            _swapWriter(e.srcElement);
            _this.forward(e);
        }

        function _onWriterEnded(e) {
            if (_recorder) {
                _recorder.stop();
                _recorder = null;
            }
            _writer = null;
            _this.forward(e);
        }

        _this.getTransceivers = function () {
            return _pc.getTransceivers();
        };

        _this.getSenders = function () {
            return _pc.getSenders();
        };

        _this.getReceivers = function () {
            return _pc.getReceivers();
        };

        _this.volume = function () {
            return _audiometer.volume();
        };

        _this.enabled = function (kind, value) {
            if (_stream) {
                _stream.getTracks().forEach(function (track) {
                    if (track.kind === kind) {
                        track.enabled = !!value;
                    }
                });
            }
            return _stream ? _stream.getTracks().some(function (track) {
                return track.kind === kind && track.enabled;
            }) : false;
        };

        _this.stream = function () {
            return _stream;
        };

        _this.getStats = async function () {
            return await _pc.getStats().then((report) => {
                report.forEach((item) => {
                    _stats.parse(item);
                });
                return Promise.resolve(_stats.report);
            }).catch((err) => {
                _logger.warn(`Failed to getStats: id=${_this.config.id}, stream=${_name}, error=${err}`);
            });
        };

        _this.setProperty = function (key, value) {
            _properties[key] = value;
        };

        _this.getProperty = function (key) {
            return _properties[key];
        };

        _this.state = function () {
            return _readyState;
        };

        _this.element = function () {
            return _video;
        };

        _this.close = function (reason) {
            switch (_readyState) {
                case State.CONNECTED:
                case State.PUBLISHING:
                case State.PLAYING:
                    _readyState = State.CLOSING;
                    _delete();

                    var senders = _pc.getSenders();
                    senders.forEach(function (sender) {
                        var track = sender.track;
                        if (track) {
                            _this.dispatchEvent(NetStatusEvent.NETSTATUS, {
                                level: Level.STATUS,
                                code: Code.NETSTREAM_UNPUBLISH_SUCCESS,
                                description: 'unpublish success',
                                info: {
                                    track: track.id,
                                },
                            });
                        }
                    });
                    var receivers = _pc.getReceivers();
                    receivers.forEach(function (receiver) {
                        var track = receiver.track;
                        if (track) {
                            _this.dispatchEvent(NetStatusEvent.NETSTATUS, {
                                level: Level.STATUS,
                                code: Code.NETSTREAM_PLAY_STOP,
                                description: 'play stop',
                                info: {
                                    track: track.id,
                                },
                            });
                        }
                    });
                    if (_videomixer) {
                        _videomixer.stop();
                        _videomixer = undefined;
                    }
                    if (_writer) {
                        _writer.close();
                        _writer = null;
                    }
                    if (_stream) {
                        _stream.getTracks().forEach(function (track) {
                            _logger.log(`Stopping track: id=${_this.config.id}, stream=${_name}, kind=${track.kind}, id=${track.id}, label=${track.label}`);
                            track.stop();
                        });
                    }
                    if (_pc) {
                        _pc.removeEventListener('negotiationneeded', _onNegotiationNeeded);
                        _pc.removeEventListener('track', _onTrack);
                        _pc.removeEventListener('connectionstatechange', _onConnectionStateChange);
                        _pc.removeEventListener('iceconnectionstatechange', _onIceConnectionStateChange);
                        _pc.removeEventListener('icecandidate', _onIceCandidate);
                        _pc.close();
                        _pc = undefined;
                    }

                    _subscribing = [];
                    _audiometer.stop();
                // fallthrough
                case State.INITIALIZED:
                    _this.dispatchEvent(Event.RELEASE, { reason: reason });
                    _stream = null;
                    _video.srcObject = undefined;
                    _readyState = State.CLOSED;
                    break;
            }
        };

        _init();
    }

    NetStream.prototype = Object.create(EventDispatcher.prototype);
    NetStream.prototype.constructor = NetStream;
    NetStream.prototype.kind = 'signaling';
    NetStream.prototype.CONF = _default;

    RTC.NetStream = NetStream;
})(odd);

