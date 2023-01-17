(function (odd) {
    var utils = odd.utils,
        Kernel = odd.Kernel,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        NetStatusEvent = events.NetStatusEvent,
        Level = events.Level,
        Code = events.Code,
        IM = odd.IM,
        Responder = IM.Responder,
        State = IM.State,
        Type = IM.Message.Type,
        Command = IM.Message.Command,
        RTC = odd.RTC,
        Constraints = RTC.Constraints,
        Mixer = RTC.Mixer,
        Beauty = RTC.Beauty,
        AudioMeter = RTC.AudioMeter,

        _default = {
            profile: '540P_2',
            codecpreferences: [
                'audio/opus',
                'video/VP8',
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
            _stats,
            _properties,
            _handlers,
            _responders,
            _transactionId,
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
            _this.video.setAttribute('controls', '');

            _pid = 0;
            _screenshare = false;
            _withcamera = false;
            _beauty = new Beauty(_logger);
            _subscribing = [];
            _audiometer = new AudioMeter(_logger);
            _stats = new RTC.Stats(_logger);
            _properties = {};
            _handlers = {};
            _responders = {};
            _transactionId = 0;
            _readyState = State.INITIALIZED;

            _handlers[Command.SET_PROPERTY] = _processCommandSetProperty;
            _handlers[Command.SDP] = _processCommandSdp;
            _handlers[Command.CANDIDATE] = _processCommandCandidate;
            _handlers[Command.STATUS] = _processCommandStatus;
        }

        _this.pid = function () {
            return _pid;
        };

        _this.client = function () {
            return _client;
        };

        _this.attach = async function (nc) {
            _client = nc;
            _pc = new RTCPeerConnection(_this.config.rtcconfiguration);
            _pc.addEventListener('negotiationneeded', _onNegotiationNeeded);
            _pc.addEventListener('track', _onTrack);
            _pc.addEventListener('connectionstatechange', _onConnectionStateChange);
            _pc.addEventListener('icecandidate', _onIceCandidate);
            _pc.addEventListener('iceconnectionstatechange', _onIceConnectionStateChange);

            return await _client.create(_this, new Responder(function (m) {
                _pid = m.Arguments.info.id;
                _readyState = State.CONNECTED;
            }, function (m) {
                _this.close(m.Arguments.description);
            }));
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
                    _logger.log(`Got user media: id=${source.id}, constraints=`, constraints);
                } catch (err) {
                    _logger.error(`Failed to get user media: constraints=`, constraints, `, error=${err}`);
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
                _logger.log(`Got user media: id=${stream.id}, constraints=`, constraints);
            } catch (err) {
                _logger.error(`Failed to get user media: constraints=`, constraints, `, error=${err}`);
                return Promise.reject(err);
            }
            return Promise.resolve(stream);
        };

        _this.getDisplayMedia = async function (constraints) {
            var stream;
            try {
                stream = await navigator.mediaDevices.getDisplayMedia(constraints);
                _logger.log(`Got display media: id=${stream.id}, constraints=`, constraints);
            } catch (err) {
                _logger.error(`Failed to get display media: constraints=`, constraints, `, error=${err}`);
                return Promise.reject(err);
            }
            return Promise.resolve(stream);
        };

        _this.addTrack = function (track, stream) {
            track.addEventListener('ended', _onEnded);
            track.addEventListener('mute', _onMute);
            track.addEventListener('unmute', _onUnmute);

            var sender = _pc.addTrack(track, stream);
            _logger.log(`AddTrack: kind=${track.kind}, id=${track.id}, label=${track.label}`);
            if (sender.track.id !== track.id) {
                _logger.warn(`Track id changed: ${sender.track.id} != ${track.id}`);
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
            _logger.log(`Track ended: kind=${track.kind}, id=${track.id}, label=${track.label}`);
        }

        function _onMute(e) {
            var track = e.target;
            _logger.log(`Track muted: kind=${track.kind}, id=${track.id}, label=${track.label}`);
        }

        function _onUnmute(e) {
            var track = e.target;
            _logger.log(`Track unmuted: kind=${track.kind}, id=${track.id}, label=${track.label}`);
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
            return Promise.resolve(stream);
        };

        _this.preview = async function (screenshare, withcamera, option) {
            if (_this.stream == null) {
                try {
                    await _this.createStream(screenshare, withcamera, option);
                } catch (err) {
                    _logger.error(`Failed to create stream on pipe ${_pid}`);
                    return Promise.reject(err);
                }
            }
            _this.stream.getTracks().forEach(function (track) {
                _this.addTrack(track, _this.stream);
            });
            return Promise.resolve();
        };

        _this.publish = async function () {
            try {
                var offer = await _pc.createOffer();
                offer.sdp = _modify(offer.sdp, _this.config.codecpreferences);
                _logger.log(`createOffer success: id=${_pid}, sdp=\n${offer.sdp}`);
            } catch (err) {
                _logger.error(`Failed to createOffer: id=${_pid}`);
                return Promise.reject(err);
            }
            try {
                await _pc.setLocalDescription(offer);
                _logger.log(`setLocalDescription success: id=${_pid}, type=${offer.type}`);
            } catch (err) {
                _logger.error(`Failed to setLocalDescription: id=${_pid}, type=${offer.type}`);
                return Promise.reject(err);
            }
            _readyState = State.PUBLISHING;

            return await _this.call(0, {
                name: Command.SDP,
                type: offer.type,
                sdp: offer.sdp,
            }).then(() => {
                _logger.log(`Send offer success.`);
            }).catch((err) => {
                _logger.error(`Failed to send offer: ${err}`);
            });
        };

        function _modify(sdp, mimetypes) {
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

        _this.beauty = function (enable, constraints) {
            if (enable) {
                _beauty.enable(_this.stream, constraints).then(function () {
                    _this.replaceTrack(_beauty.output(), false).catch(function (err) {
                        _logger.error(`Failed to replace track: ${err}`);
                    });
                });
            } else {
                var input = _beauty.input();
                if (input) {
                    _this.replaceTrack(input, true).catch(function (err) {
                        _logger.error(`Failed to replace track: ${err}`);
                    });
                    _beauty.disable();
                }
            }
        };

        _this.beautyEnabled = function () {
            return _beauty.enabled();
        };

        _this.play = async function (rid, mode) {
            _readyState = State.PLAYING;

            return await _this.call(0, {
                name: Command.PLAY,
                stream: rid,
                mode: mode,
            }).then(() => {
                _logger.log(`Send play success.`);
            }).catch((err) => {
                _logger.error(`Failed to send play: ${err}`);
            });
        };

        _this.stop = function (name) {
            return _this.call(0, {
                name: Command.STOP,
                stream: name,
            });
        };

        _this.sendStatus = async function (transactionId, status) {
            return _this.call(transactionId, {
                name: Command.STATUS,
                level: status.level,
                code: status.code,
                description: status.description,
                info: status.info,
            });
        };

        _this.call = function (transactionId, args, payload, responder) {
            if (responder) {
                transactionId = ++_transactionId;
                _responders[transactionId] = responder;
            }
            return _client.call(_pid, transactionId, args, payload);
        };

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
            _logger.log(`onNegotiationNeeded: id=${_pid}`);
        }

        function _onTrack(e) {
            var stream = e.streams[0];
            _logger.log(`onTrack: kind=${e.track.kind}, track=${e.track.id}, stream=${stream.id}`);
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
            _logger.log(`onConnectionStateChange: id=${_pid}, state=${pc.connectionState}`);
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
            _logger.log(`onIceCandidate: id=${_pid}, candidate=${candidate.candidate}, mid=${candidate.sdpMid}, mlineindex=${candidate.sdpMLineIndex}`);

            _this.call(0, {
                name: Command.CANDIDATE,
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid,
                sdpMLineIndex: candidate.sdpMLineIndex,
            }).catch((err) => {
                _logger.error(`Failed to send candidate: ${err}`);
            });
        }

        function _onIceConnectionStateChange(e) {
            var pc = e.target;
            _logger.log(`onIceConnectionStateChange: id=${_pid}, state=${pc.iceConnectionState}`);
        }

        _this.process = function (p) {
            switch (p.Type) {
                case Type.COMMAND:
                    var m = new IM.CommandMessage(p);
                    m.parse(p.Payload.buffer, p.Payload.byteOffset);
                    return _processCommand(m);

                default:
                    return Promise.reject(`unrecognized message type ${p.Type}`);
            }
        };

        function _processCommand(m) {
            var handler = _handlers[m.Arguments.name];
            if (handler) {
                return handler(m);
            }
            // Should not return error, just ignore.
            _logger.warn(`No handler found: command=${m.Arguments.name}, arguments=`, m.Arguments);
            return Promise.resolve();
        };

        function _processCommandSetProperty(m) {
            var info = m.Arguments.info;
            utils.forEach(info, function (key, value) {
                _this.setProperty(key, value);
            });
            return Promise.resolve();
        }

        async function _processCommandSdp(m) {
            _logger.log(`onSdp: id=${_pid}, type=${m.Arguments.type}, sdp=\n${m.Arguments.sdp}`);
            try {
                await _pc.setRemoteDescription(new RTCSessionDescription({
                    type: m.Arguments.type,
                    sdp: m.Arguments.sdp,
                }));
                _logger.log(`setRemoteDescription success: id=${_pid}, type=${m.Arguments.type}`);
            } catch (err) {
                _logger.error(`Failed to setRemoteDescription: id=${_pid}, type=${m.Arguments.type}`);
                return Promise.reject(err);
            }
            if (m.Arguments.type === 'answer') {
                _pc.getSenders().forEach(function (sender) {
                    var track = sender.track;
                    if (track.kind === 'video') {
                        var bitrate = _this.constraints.video.maxBitrate * 1000;
                        var parameters = sender.getParameters();
                        parameters.encodings.forEach(function (encoding) {
                            encoding.maxBitrate = bitrate;
                        });
                        sender.setParameters(parameters).then(function () {
                            _logger.log(`Set max bitrate: ${bitrate}`);
                        }).catch(function (err) {
                            _logger.warn(`Failed to set max bitrate: ${err}`);
                        });
                    }
                });
                return Promise.resolve();
            }
            try {
                var answer = await _pc.createAnswer();
                answer.sdp = answer.sdp.replace(
                    /a=rtcp-fb:(\d+) transport-cc(\n|\r\n)/g,
                    `a=rtcp-fb:$1 transport-cc$2a=rtcp-fb:$1 rrtr$2`);
                _logger.log(`createAnswer success: id=${_pid}, sdp=\n${answer.sdp}`);
            } catch (err) {
                _logger.error(`Failed to createAnswer: id=${_pid}`);
                return Promise.reject(err);
            }
            try {
                await _pc.setLocalDescription(answer);
                _logger.log(`setLocalDescription success: id=${_pid}, type=${answer.type}`);
            } catch (err) {
                _logger.error(`Failed to setLocalDescription: id=${_pid}, type=${answer.type}`);
                return Promise.reject(err);
            }

            return await _this.call(0, {
                name: Command.SDP,
                type: answer.type,
                sdp: answer.sdp,
            }).then(() => {
                _logger.log(`Send answer success.`);
            }).catch((err) => {
                _logger.error(`Failed to send answer: ${err}`);
            });
        }

        async function _processCommandCandidate(m) {
            try {
                // candidate:foundation icegroupid protocol priority address port typ type [tcptype passive] generation 0 ufrag EkX7 network-id 1
                // candidate:2521313038 1 udp 2122260223 8.129.32.129 35050 typ host generation 0 ufrag EkX7 network-id 1
                // candidate:3637236734 1 tcp 1518280447 8.129.32.129 54853 typ host tcptype passive generation 0 ufrag ENBr network-id 1
                // candidate:1522864285 1 udp 1686052607 8.129.32.129 56851 typ srflx raddr 172.18.211.206 rport 56851 generation 0 ufrag g2Hy network-id 1
                // var arr = m.Arguments.candidate.match(/^candidate:(?<foundation>\d+) (?<icegroupid>\d+) (?<protocol>udp|tcp) (?<priority>\d+) (?<address>[\d\.]+) (?<port>\d+) typ (?<type>[a-z]+)/i);
                // if (arr && arr.groups.type === 'host') {
                // }

                var candidate = new RTCIceCandidate({
                    candidate: m.Arguments.candidate,
                    sdpMid: m.Arguments.sdpMid || '',
                    sdpMLineIndex: m.Arguments.sdpMLineIndex || 0,
                });
                await _pc.addIceCandidate(candidate);
                _logger.log(`addIceCandidate success: id=${_pid}, candidate=${candidate.candidate}, mid=${candidate.sdpMid}, mlineindex=${candidate.sdpMLineIndex}`);
            } catch (err) {
                _logger.error(`Failed to addIceCandidate: id=${_pid}, candidate=${candidate.candidate}, mid=${candidate.sdpMid}, mlineindex=${candidate.sdpMLineIndex}`);
                return Promise.reject(err);
            }
            return Promise.resolve();
        }

        function _processCommandStatus(m) {
            var level = m.Arguments.level;
            var code = m.Arguments.code;
            var description = m.Arguments.description;
            var info = m.Arguments.info;
            _logger.debug(`RTC.NetStream.onStatus: id=${_pid}, level=${level}, code=${code}, description=${description}, info=`, info);

            var responder = _responders[m.TransactionID];
            if (responder != null) {
                var callback = level === Level.ERROR ? responder.status : responder.result;
                if (callback != null) {
                    callback(m);
                }
            }
            delete _responders[m.TransactionID];

            switch (code) {
                case Code.NETSTREAM_UNPUBLISH_SUCCESS:
                case Code.NETSTREAM_PLAY_START:
                    // Ignore these status, because we can not trust them, while they may be lost.
                    // Instead, we'll fire these events based on the local methods and events.
                    return;
                case Code.NETSTREAM_PLAY_STOP:
                    _this.dispatchEvent(NetStatusEvent.NET_STATUS, m.Arguments);
                    for (var i = 0; i < _subscribing.length; i++) {
                        var track = _subscribing[i];
                        if (track.id === info.track) {
                            _subscribing.splice(i, 1);
                            if (_subscribing.length === 0) {
                                _logger.log(`There's no receiver remains: ${_pid}`);
                                _this.dispatchEvent(NetStatusEvent.NET_STATUS, {
                                    level: Level.STATUS,
                                    code: Code.NETSTREAM_PLAY_RESET,
                                    description: 'play reset',
                                });
                            }
                            break;
                        }
                    }
                    return;
            }
            _this.dispatchEvent(NetStatusEvent.NET_STATUS, m.Arguments);
            return Promise.resolve();
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
                _logger.warn(`Failed to getStats: ${err}`);
            });
        };

        _this.state = function () {
            return _readyState;
        };

        _this.release = function (reason) {
            _client.call(0, 0, {
                name: Command.RELEASE,
                id: _pid,
            }).catch((err) => {
                _logger.error(`Failed to send release: ${err}`);
            });
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
                    if (_this.stream) {
                        _this.stream.getTracks().forEach(function (track) {
                            _logger.log(`Stopping track: kind=${track.kind}, id=${track.id}, label=${track.label}`);
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

