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

        _id = 0,
        _default = {
            profile: '540P_2',
            whip: location.protocol + '//' + location.host + '/whip/live',
            whep: location.protocol + '//' + location.host + '/whep/live',
            trickle: false,
            codecpreferences: [
                'audio/opus',
                'video/H264',
            ],
            rtcconfiguration: {
                iceServers: [{
                    urls: ["stun:stun.l.google.com:19302"],
                }],
                iceTransportPolicy: "all", // all, relay
            },
        };

    function NetStream(config, logger) {
        EventDispatcher.call(this, 'NetStream', { logger: logger }, [Event.ERROR, Event.RELEASE], NetStatusEvent);

        var _this = this,
            _logger = logger,
            _pid,
            _client,
            _pc,
            _videomixer,
            _screenshare,
            _withcamera,
            _beauty,
            _subscribing,
            _audiometer,
            _recorder,
            _location,
            _saver,
            _writer,
            _stats,
            _properties,
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

            _this.stream = null;
            _this.video = utils.createElement('video');
            _this.video.setAttribute('playsinline', '');
            _this.video.setAttribute('autoplay', '');

            _pid = ++_id;
            _screenshare = false;
            _withcamera = false;
            _beauty = new Beauty(_logger);
            _subscribing = [];
            _audiometer = new AudioMeter(_logger);
            _stats = new RTC.Stats(_logger);
            _properties = {};
            _readyState = State.INITIALIZED;

            _saver = new StreamSaver(_this.config.service, _logger);
            _saver.addEventListener(SaverEvent.WRITERSTART, _onWriterStart);
            _saver.addEventListener(SaverEvent.WRITEREND, _onWriterEnded);
        }

        _this.pid = function () {
            return _pid;
        };

        _this.uuid = function () {
            var uuid = _this.getProperty('@uuid');
            return uuid || '';
        };

        _this.client = function () {
            return _client;
        };

        function _userId() {
            if (_client && _client.userId) {
                return _client.userId();
            }
            return _this.config.id || 0;
        }

        _this.attach = async function (nc) {
            _client = nc;

            switch (_readyState) {
                case State.CONNECTED:
                case State.PUBLISHING:
                case State.PLAYING:
                    return Promise.resolve();
                default:
                    _pc = new RTCPeerConnection(_this.config.rtcconfiguration);
                    _pc.addEventListener('negotiationneeded', _onNegotiationNeeded);
                    _pc.addEventListener('track', _onTrack);
                    _pc.addEventListener('connectionstatechange', _onConnectionStateChange);
                    // _pc.addEventListener('icecandidate', _onIceCandidate);
                    _pc.addEventListener('iceconnectionstatechange', _onIceConnectionStateChange);

                    _readyState = State.CONNECTED;
                    return Promise.resolve();
            }
        };

        _this.setProperty = function (key, value) {
            _properties[key] = value;
        };

        _this.getProperty = function (key) {
            return _properties[key];
        };

        _this.applyConstraints = function (constraints) {
            _this.constraints = utils.extendz(_this.constraints, constraints);
            if (_this.stream) {
                _this.stream.getTracks().forEach(function (track) {
                    track.applyConstraints(_this.constraints[track.kind]);
                });
            }
        };

        _this.setCamera = async function (deviceId) {
            if (_readyState === State.PUBLISHING && (!_screenshare || _withcamera)) {
                var constraints = utils.extendz({}, _this.constraints, {
                    audio: false,
                    video: {
                        deviceId: deviceId,
                    },
                });
                var source;
                try {
                    source = await navigator.mediaDevices.getUserMedia(constraints);
                    _logger.log(`Got user media: user=${_userId()}, stream=${source.id}, constraints=`, constraints);
                } catch (err) {
                    _logger.error(`Failed to get user media: user=${_userId()}, constraints=`, constraints, `, error=${err}`);
                    return Promise.reject(err);
                }

                var track = source.getVideoTracks()[0];
                if (_screenshare) {
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
                _logger.log(`Got user media: user=${_userId()}, stream=${stream.id}, constraints=`, constraints);
            } catch (err) {
                _logger.error(`Failed to get user media: user=${_userId()}, constraints=`, constraints, `, error=${err}`);
                return Promise.reject(err);
            }
            return Promise.resolve(stream);
        };

        _this.getDisplayMedia = async function (constraints) {
            var stream;
            try {
                stream = await navigator.mediaDevices.getDisplayMedia(constraints);
                _logger.log(`Got display media: user=${_userId()}, stream=${stream.id}, constraints=`, constraints);
            } catch (err) {
                _logger.error(`Failed to get display media: user=${_userId()}, constraints=`, constraints, `, error=${err}`);
                return Promise.reject(err);
            }
            return Promise.resolve(stream);
        };

        _this.addTrack = function (track, stream) {
            track.addEventListener('ended', _onEnded);
            track.addEventListener('mute', _onMute);
            track.addEventListener('unmute', _onUnmute);

            var sender = _pc.addTrack(track, stream);
            _logger.log(`AddTrack: user=${_userId()}, kind=${track.kind}, id=${track.id}, label=${track.label}`);
            if (sender.track.id !== track.id) {
                _logger.warn(`Track id changed: user=${_userId()}, ${sender.track.id} != ${track.id}`);
            }
            return sender;
        };

        _this.replaceTrack = function (track, stopprevious) {
            var origin;
            if (track.kind === 'audio') {
                origin = _this.stream.getAudioTracks()[0];
            } else {
                origin = _this.stream.getVideoTracks()[0];
            }
            if (origin == undefined) {
                return Promise.reject(`${track.kind} track not found`);
            }

            origin.removeEventListener('ended', _onEnded);
            origin.removeEventListener('mute', _onMute);
            origin.removeEventListener('unmute', _onUnmute);

            _this.stream.removeTrack(origin);
            _this.stream.addTrack(track);

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

                _this.dispatchEvent(NetStatusEvent.NET_STATUS, {
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
            _logger.log(`Track ended: user=${_userId()}, kind=${track.kind}, id=${track.id}, label=${track.label}`);
        }

        function _onMute(e) {
            var track = e.target;
            _logger.log(`Track muted: user=${_userId()}, kind=${track.kind}, id=${track.id}, label=${track.label}`);
        }

        function _onUnmute(e) {
            var track = e.target;
            _logger.log(`Track unmuted: user=${_userId()}, kind=${track.kind}, id=${track.id}, label=${track.label}`);
        }

        _this.createStream = async function (screenshare, withcamera, option) {
            var stream;
            if (screenshare) {
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

            _screenshare = screenshare;
            _withcamera = withcamera;
            _this.stream = stream;
            _this.setProperty('stream', stream.id);
            return Promise.resolve(stream);
        };

        _this.preview = async function (screenshare, withcamera, option) {
            if (_this.stream == null) {
                try {
                    await _this.createStream(screenshare, withcamera, option);
                } catch (err) {
                    _logger.error(`Failed to create stream: user=${_userId()}, pipe=${_pid}`);
                    return Promise.reject(err);
                }
            }
            _this.stream.getTracks().forEach(function (track) {
                _this.addTrack(track, _this.stream);
            });
            return Promise.resolve();
        };

        _this.publish = async function () {
            _setCodecPreferences('send');
            try {
                var offer = await _pc.createOffer();
                offer.sdp = _modify(offer.sdp, _this.config.codecpreferences);
                _logger.log(`createOffer success: user=${_userId()}, pipe=${_pid}, sdp=\n${offer.sdp}`);
            } catch (err) {
                _logger.error(`Failed to createOffer: user=${_userId()}, pipe=${_pid}`);
                return Promise.reject(err);
            }
            try {
                await _pc.setLocalDescription(offer);
                _logger.log(`setLocalDescription success: user=${_userId()}, pipe=${_pid}, type=${offer.type}`);
            } catch (err) {
                _logger.error(`Failed to setLocalDescription: user=${_userId()}, pipe=${_pid}, type=${offer.type}`);
                return Promise.reject(err);
            }
            _readyState = State.PUBLISHING;

            try {
                var answer = await _post(_this.config.whip, offer.sdp);
                await _setAnswer(answer);
                _this.dispatchEvent(NetStatusEvent.NET_STATUS, {
                    level: Level.STATUS,
                    code: Code.NETSTREAM_PUBLISH_START,
                    description: 'publish start',
                    info: {
                        stream: _this.getProperty('@id') || _this.getProperty('stream'),
                        id: _this.getProperty('@id'),
                        location: _location,
                    },
                });
            } catch (err) {
                _logger.error(`Failed to publish: user=${_userId()}, pipe=${_pid}, error=${err}`);
                return Promise.reject(err);
            }
            return Promise.resolve();
        };

        function _modify(sdp, mimetypes) {
            sdp = sdp.replace(/a=extmap:\d+ http:\/\/www.ietf.org\/id\/draft-holmer-rmcat-transport-wide-cc-extensions-01(\n|\r\n)/gi, '');
            sdp = sdp.replace(/a=rtcp-fb:\d+ goog-remb(\n|\r\n)a=rtcp-fb:\d+ transport-cc(\n|\r\n)/gi, '');

            var lines = sdp.split('\r\n');
            var state = 'v=';
            var dst = '';
            var kind = '';
            var codec = '';
            var block = [];
            var pts = [];
            var last = -1;

            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                if (line === '') {
                    continue;
                }
                switch (state) {
                    case 'dropping':
                    // fallthrough

                    case 'a=rtpmap':
                        var arr = line.match(/^a=rtcp-fb:(\d+)/);
                        if (arr) {
                            if (state === 'dropping') {
                                // Drop this line.
                                break;
                            }
                            var pt = pts[pts.length - 1];
                            line = line.replace(/^a=rtcp-fb:(\d+)/, `a=rtcp-fb:${pt}`);
                            block.push(line);
                            break;
                        }
                        arr = line.match(/^a=fmtp:(\d+)/);
                        if (arr) {
                            if (state === 'dropping') {
                                // Drop this line.
                                break;
                            }
                            var pt = pts[pts.length - 1];
                            var apt = pts[pts.length - 2];
                            line = line.replace(/^a=fmtp:(\d+)/, `a=fmtp:${pt}`);
                            line = line.replace(/apt=(\d+)/, `apt=${apt}`);
                            switch (codec) {
                                case 'H264':
                                    line = line.replace(/packetization-mode=(0|1)/i, 'packetization-mode=1');
                                    line = line.replace(/profile-level-id=([a-z\d]+)/i, 'profile-level-id=42e01f');
                                    break;
                                case 'VP9':
                                    line = line.replace(/profile-id=(\d+)/i, 'profile-id=2');
                                    break;
                            }
                            block.push(line);
                            break;
                        }
                    // fallthrough

                    case 'm=':
                        var arr = line.match(/^a=rtpmap:(\d+) ([a-zA-Z\d\-]+)\/(\d+)(?:\/(\d))?/);
                        if (arr) {
                            var pt = arr[1];
                            codec = arr[2];
                            switch (codec) {
                                case 'opus':
                                    pt = 111;
                                    break;
                                case 'VP8':
                                    pt = 96;
                                    break;
                                case 'VP9':
                                    pt = 98;
                                    break;
                                case 'H264':
                                    pt = 106;
                                    break;
                                case 'H265':
                                    pt = 108;
                                    break;
                                case 'AV1':
                                    pt = 41;
                                    break;
                                case 'red':
                                case 'rtx':
                                case 'ulpfec':
                                    switch (last) {
                                        case 111:
                                            pt = 63;
                                            break;
                                        default:
                                            pt = last + 1;
                                            break;
                                    }
                                    break;
                            }

                            var found = false;
                            for (var j = 0; j < mimetypes.length; j++) {
                                if (mimetypes[j] === kind + '/' + codec) {
                                    found = true;
                                    break;
                                }
                            }
                            if (found || last !== -1 && (codec === 'red' || codec === 'rtx' || codec === 'ulpfec')) {
                                var inserted = false;
                                for (var j = 0; j < pts.length; j++) {
                                    if (pts[j] === pt) {
                                        inserted = true;
                                        break;
                                    }
                                }
                                if (inserted === false) {
                                    line = line.replace(/^a=rtpmap:(\d+)/, `a=rtpmap:${pt}`);
                                    block[0] += ` ${pt}`;
                                    block.push(line);
                                    pts.push(pt);
                                    last = pt;
                                    state = 'a=rtpmap';
                                    break;
                                }
                            }
                            // Drop this line.
                            last = -1;
                            state = 'dropping';
                            break;
                        }
                    // fallthrough

                    case 'v=':
                        var arr = line.match(/^m=(audio|video) 9 UDP\/TLS\/RTP\/SAVPF/);
                        if (arr) {
                            dst += block.join('\r\n') + '\r\n';

                            kind = arr[1];
                            block = [arr[0]];
                            pts = [];
                            state = 'm=';
                            break;
                        }
                        block.push(line);
                        break;
                }
            }
            dst += block.join('\r\n') + '\r\n';
            return dst;
        }

        function _setCodecPreferences(type) {
            var audio = _codecs(type === 'send' ? RTCRtpSender : RTCRtpReceiver, 'audio');
            var video = _codecs(type === 'send' ? RTCRtpSender : RTCRtpReceiver, 'video');
            _pc.getTransceivers().forEach(function (transceiver) {
                switch (_kind(transceiver, type)) {
                    case 'audio':
                        if (audio.length) {
                            transceiver.setCodecPreferences(audio);
                        }
                        break;
                    case 'video':
                        if (video.length) {
                            transceiver.setCodecPreferences(video);
                        } else {
                            _logger.warn(`No preferred video codec found: user=${_userId()}, codecpreferences=`, _this.config.codecpreferences);
                        }
                        break;
                }
            });
        }

        function _kind(transceiver, type) {
            var track = type === 'send' ? transceiver.sender.track : transceiver.receiver.track;
            return track ? track.kind : '';
        }

        function _codecs(factory, kind) {
            var items = [];
            if (factory.getCapabilities == null) {
                return items;
            }
            var capabilities = factory.getCapabilities(kind);
            if (capabilities == null) {
                return items;
            }
            capabilities.codecs.forEach(function (codec) {
                for (var i = 0; i < _this.config.codecpreferences.length; i++) {
                    if (_matchCodec(codec, _this.config.codecpreferences[i])) {
                        items.push(codec);
                        break;
                    }
                }
            });
            return items;
        }

        function _matchCodec(codec, mimetype) {
            if (mimetype.toLowerCase() !== codec.mimeType.toLowerCase()) {
                return false;
            }
            switch (mimetype.toLowerCase()) {
                case 'video/h264':
                    var fmtp = codec.sdpFmtpLine || '';
                    fmtp = fmtp.toLowerCase();
                    return fmtp.indexOf('packetization-mode=1') !== -1 &&
                        fmtp.indexOf('profile-level-id=42e01f') !== -1;
            }
            return true;
        }

        function _post(url, sdp) {
            return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open('POST', url, true);
                xhr.setRequestHeader('Content-Type', 'application/sdp');
                xhr.onreadystatechange = function () {
                    if (xhr.readyState !== 4) {
                        return;
                    }
                    if (xhr.status >= 200 && xhr.status < 300) {
                        _location = xhr.getResponseHeader('Location') || url;
                        _this.setProperty('@id', _location.split('/').pop() || _pid);
                        _this.setProperty('@location', _location);
                        resolve(xhr.responseText);
                        return;
                    }
                    reject(`status=${xhr.status}, response=${xhr.responseText}`);
                };
                xhr.onerror = function () {
                    reject('network error');
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
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve();
                        return;
                    }
                    reject(`status=${xhr.status}, response=${xhr.responseText}`);
                };
                xhr.onerror = function () {
                    reject('network error');
                };
                if (candidate.candidate) {
                    xhr.send(`a=${candidate.candidate}\na=end-of-candidates`);
                } else {
                    xhr.send('a=end-of-candidates');
                }
            });
        }

        function _delete() {
            if (_location == null) {
                return;
            }
            var xhr = new XMLHttpRequest();
            xhr.open('DELETE', _location, true);
            xhr.send();
            _location = undefined;
        }

        function _join(prefix, name) {
            return prefix.replace(/\/$/, '') + '/' + encodeURIComponent(name);
        }

        async function _setAnswer(sdp) {
            var answer = new RTCSessionDescription({
                type: 'answer',
                sdp: sdp,
            });
            _logger.log(`onRemoteAnswer: user=${_userId()}, pipe=${_pid}, sdp=\n${answer.sdp}`);
            try {
                await _pc.setRemoteDescription(answer);
                _logger.log(`setRemoteDescription success: user=${_userId()}, pipe=${_pid}, type=${answer.type}`);
            } catch (err) {
                _logger.error(`Failed to setRemoteDescription: user=${_userId()}, pipe=${_pid}, type=${answer.type}`);
                return Promise.reject(err);
            }
            _setMaxBitrate();
            _setJitterBufferTarget();
            return Promise.resolve();
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
                        _logger.log(`Set max bitrate: user=${_userId()}, value=${bitrate}`);
                    }).catch(function (err) {
                        _logger.warn(`Failed to set max bitrate: user=${_userId()}, value=${bitrate}, error=${err}`);
                    });
                }
            });
        }

        function _setJitterBufferTarget() {
            _pc.getReceivers().forEach(function (receiver) {
                if (receiver.track && receiver.track.kind === 'video' && 'jitterBufferTarget' in receiver) {
                    receiver.jitterBufferTarget = 300;
                }
            });
        }

        _this.beauty = function (enable, constraints) {
            if (enable) {
                _beauty.enable(_this.stream, constraints).then(function () {
                    _this.replaceTrack(_beauty.output(), false).catch(function (err) {
                        _logger.error(`Failed to replace track: user=${_userId()}, error=${err}`);
                    });
                });
            } else {
                var input = _beauty.input();
                if (input) {
                    _this.replaceTrack(input, true).catch(function (err) {
                        _logger.error(`Failed to replace track: user=${_userId()}, error=${err}`);
                    });
                    _beauty.disable();
                }
            }
        };

        _this.beautyEnabled = function () {
            return _beauty.enabled();
        };

        _this.play = async function (rid, mode) {
            _this.setProperty('stream', rid.split('@')[0]);

            _pc.addTransceiver('audio', {
                direction: 'recvonly',
            });
            _pc.addTransceiver('video', {
                direction: 'recvonly',
            });
            _setCodecPreferences('recv');

            try {
                var offer = await _pc.createOffer();
                offer.sdp = _modify(offer.sdp, _this.config.codecpreferences);
                _logger.log(`createOffer success: user=${_userId()}, pipe=${_pid}, sdp=\n${offer.sdp}`);
            } catch (err) {
                _logger.error(`Failed to createOffer: user=${_userId()}, pipe=${_pid}`);
                return Promise.reject(err);
            }
            try {
                await _pc.setLocalDescription(offer);
                _logger.log(`setLocalDescription success: user=${_userId()}, pipe=${_pid}, type=${offer.type}`);
            } catch (err) {
                _logger.error(`Failed to setLocalDescription: user=${_userId()}, pipe=${_pid}, type=${offer.type}`);
                return Promise.reject(err);
            }
            _readyState = State.PLAYING;

            try {
                var answer = await _post(_join(_this.config.whep, rid), offer.sdp);
                await _setAnswer(answer);
            } catch (err) {
                _logger.error(`Failed to play: user=${_userId()}, pipe=${_pid}, stream=${rid}, error=${err}`);
                return Promise.reject(err);
            }
            return Promise.resolve();
        };

        _this.stop = function (name) {
            _this.release('stopping');
            return Promise.resolve();
        };

        _this.record = function (filename, ondata) {
            function handler() {
                if (_this.stream == null) {
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

                _recorder = new MediaRecorder(_this.stream);
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

        function _onNegotiationNeeded(e) {
            // We don't negotiate at this moment, until user called publish manually.
            _logger.log(`onNegotiationNeeded: user=${_userId()}, pipe=${_pid}`);
        }

        function _onTrack(e) {
            var stream = e.streams[0];
            _logger.log(`onTrack: user=${_userId()}, kind=${e.track.kind}, track=${e.track.id}, stream=${stream.id}`);
            _subscribing.push(e.track);
            _audiometer.update(stream);
            _this.stream = stream;
            _this.dispatchEvent(NetStatusEvent.NET_STATUS, {
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
            _logger.log(`onConnectionStateChange: user=${_userId()}, pipe=${_pid}, state=${pc.connectionState}`);
            switch (pc.connectionState) {
                case 'failed':
                case 'closed':
                    _this.close(pc.connectionState);
                    break;
            }
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
            _logger.log(`onIceCandidate: user=${_userId()}, pipe=${_pid}, candidate=${candidate.candidate}, mid=${candidate.sdpMid}, mlineindex=${candidate.sdpMLineIndex}`);

            _patch(candidate).catch((err) => {
                _logger.error(`Failed to send candidate: user=${_userId()}, error=${err}`);
            });
        }

        function _onIceConnectionStateChange(e) {
            var pc = e.target;
            _logger.log(`onIceConnectionStateChange: user=${_userId()}, pipe=${_pid}, state=${pc.iceConnectionState}`);
        }

        _this.volume = function () {
            return _audiometer.volume();
        };

        _this.getStats = async function () {
            return await _pc.getStats().then((report) => {
                report.forEach((item) => {
                    _stats.parse(item);
                });
                return Promise.resolve(_stats.report);
            }).catch((err) => {
                _logger.warn(`Failed to getStats: user=${_userId()}, error=${err}`);
            });
        };

        _this.state = function () {
            return _readyState;
        };

        _this.release = function (reason) {
            _delete();
            _this.close(reason);
        };

        _this.close = function (reason) {
            switch (_readyState) {
                case State.CONNECTED:
                case State.PUBLISHING:
                case State.PLAYING:
                    _readyState = State.CLOSING;

                    var senders = _pc.getSenders();
                    senders.forEach(function (sender) {
                        var track = sender.track;
                        if (track) {
                            _this.dispatchEvent(NetStatusEvent.NET_STATUS, {
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
                            _this.dispatchEvent(NetStatusEvent.NET_STATUS, {
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
                    if (_this.stream) {
                        _this.stream.getTracks().forEach(function (track) {
                            _logger.log(`Stopping track: user=${_userId()}, kind=${track.kind}, id=${track.id}, label=${track.label}`);
                            track.stop();
                        });
                    }
                    _pc.close();
                    _subscribing = [];
                    _audiometer.stop();
                // fallthrough
                case State.INITIALIZED:
                    _this.dispatchEvent(Event.RELEASE, { reason: reason });
                    _this.stream = null;
                    _this.video.srcObject = undefined;
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
