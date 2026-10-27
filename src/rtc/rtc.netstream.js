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
            timeout: 5000,
            credentials: null,
            participation: null,
            configuration: {
                iceServers: [{
                    urls: ["stun:stun.l.google.com:19302"],
                }],
            },
            video: {
                svc: false,
                encodings: [],
            },
            codecpreferences: [
                'audio/opus',
                'video/H264',
                'video/H265',
            ],
            service: {
                script: 'js/sw.js',
                scope: 'js/',
                enable: false,
            },
        };

    function NetStream(config, logger, participation) {
        EventDispatcher.call(this, 'NetStream', { logger: logger }, [Event.ERROR, Event.RELEASE], NetStatusEvent);

        var _this = this,
            _logger = logger,
            _video,
            _pc,
            _name,
            _stream,
            _captures = [],
            _captureFailure,
            _videomixer,
            _screensharing = false,
            _withcamera = false,
            _beauty,
            _subscribing = [],
            _audiometer,
            _recorder,
            _location,
            _token,
            _participant,
            _media,
            _connectionId,
            _credentialReject,
            _generation = 0,
            _etag,
            _requests = [],
            _candidates = [],
            _candidateBytes = 0,
            _candidatePending = false,
            _negotiated = false,
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
                case State.CLOSING:
                case State.CLOSED:
                    return Promise.reject({ name: 'AbortError', message: 'RTC stream has been closed.' });
                case State.CONNECTING:
                    return Promise.reject({ name: 'InvalidStateError', message: 'RTC negotiation is already in progress.' });
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
                    source = await _this.getUserMedia(constraints);
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
                                _forgetCapture(element.track);
                                element.track.stop();
                                element.track = track;
                                element.srcObject = source;
                                element.play();
                                found = true;
                            }
                        });
                        if (found === false) {
                            _forgetCapture(track);
                            track.stop();
                        }
                    }
                } else {
                    await _this.replaceTrack(track, true).catch(function (err) {
                        _forgetCapture(track);
                        track.stop();
                        throw err;
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
            if (_readyState === State.PUBLISHING) {
                _setMaxBitrate().catch(function (err) {
                    _logger.warn(`Failed to set max bitrate: id=${_this.config.id}, stream=${_name}, error=${err}`);
                });
            }
        };

        _this.getUserMedia = async function (constraints) {
            if (_readyState === State.CLOSING || _readyState === State.CLOSED) {
                return Promise.reject(_captureFailure || { name: 'AbortError', message: 'RTC stream has been closed.' });
            }

            var stream;
            try {
                stream = await navigator.mediaDevices.getUserMedia(constraints);
                _logger.log(`Got user media: id=${_this.config.id}, stream=${_name}, stream=${stream.id}, constraints=`, constraints);
            } catch (err) {
                _logger.error(`Failed to get user media: id=${_this.config.id}, stream=${_name}, constraints=`, constraints, `, error=${err}`);
                if (_readyState === State.CLOSING || _readyState === State.CLOSED) {
                    return Promise.reject(_captureFailure || { name: 'AbortError', message: 'RTC capture was cancelled.' });
                }
                if (err.name === 'AbortError') {
                    return Promise.reject({ name: err.name, message: err.message, operation: 'capture' });
                }
                return Promise.reject(err);
            }
            if (_readyState === State.CLOSING || _readyState === State.CLOSED) {
                stream.getTracks().forEach(function (track) {
                    track.stop();
                });
                return Promise.reject(_captureFailure || { name: 'AbortError', message: 'RTC capture was cancelled.' });
            }
            _watchCapture(stream, false);
            return Promise.resolve(stream);
        };

        _this.getDisplayMedia = async function (constraints) {
            if (_readyState === State.CLOSING || _readyState === State.CLOSED) {
                return Promise.reject({ name: 'AbortError', message: 'RTC stream has been closed.' });
            }

            // Display capture selects a surface in the browser. Saved input
            // device constraints apply only to camera/microphone capture.
            constraints = utils.extendz({}, constraints);
            if (constraints.audio && typeof constraints.audio === 'object') {
                delete constraints.audio.deviceId;
            }
            if (constraints.video && typeof constraints.video === 'object') {
                delete constraints.video.deviceId;
            }
            var stream;
            try {
                stream = await navigator.mediaDevices.getDisplayMedia(constraints);
                _logger.log(`Got display media: id=${_this.config.id}, stream=${_name}, stream=${stream.id}, constraints=`, constraints);
            } catch (err) {
                _logger.error(`Failed to get display media: id=${_this.config.id}, stream=${_name}, constraints=`, constraints, `, error=${err}`);
                if (_readyState === State.CLOSING || _readyState === State.CLOSED) {
                    return Promise.reject(_captureFailure || { name: 'AbortError', message: 'RTC capture was cancelled.' });
                }
                if (err.name === 'AbortError') {
                    return Promise.reject({ name: err.name, message: err.message, operation: 'capture' });
                }
                return Promise.reject(err);
            }
            if (_readyState === State.CLOSING || _readyState === State.CLOSED) {
                stream.getTracks().forEach(function (track) {
                    track.stop();
                });
                return Promise.reject(_captureFailure || { name: 'AbortError', message: 'RTC capture was cancelled.' });
            }
            _watchCapture(stream, true);
            return Promise.resolve(stream);
        };

        function _watchCapture(stream, screen) {
            stream.getTracks().forEach(function (track) {
                _captures.push({ track: track, screen: screen });
                track.addEventListener('ended', _onCaptureEnded);
            });
            if (stream.getTracks().some(function (track) { return track.readyState === 'ended'; })) {
                _captureFailure = screen ?
                    { name: 'CaptureEndedError', message: 'Screen sharing has ended. Start sharing again to continue.' } :
                    { name: 'NotReadableError', message: 'The capture device became unavailable.' };
                _this.close(_captureFailure.message);
                throw _captureFailure;
            }
        }

        function _forgetCapture(track) {
            track.removeEventListener('ended', _onCaptureEnded);
            _captures = _captures.filter(function (capture) { return capture.track !== track; });
        }

        function _onCaptureEnded(e) {
            if (_readyState === State.CLOSING || _readyState === State.CLOSED) {
                return;
            }
            var capture = _captures.filter(function (item) { return item.track === e.target; })[0];
            if (!capture) {
                return;
            }
            _captureFailure = capture.screen ?
                { name: 'CaptureEndedError', message: 'Screen sharing has ended. Start sharing again to continue.' } :
                { name: 'NotReadableError', message: 'The input device became unavailable. Check it before publishing again.' };

            if (_readyState === State.PUBLISHING) {
                _this.dispatchEvent(NetStatusEvent.NETSTATUS, {
                    level: Level.ERROR,
                    code: Code.NETSTREAM_FAILED,
                    description: _captureFailure.message,
                    info: { operation: 'capture', kind: e.target.kind, error: _captureFailure },
                });
            }
            _this.close(_captureFailure.message);
        }

        _this.addTrack = function (track, stream) {
            var sender;
            var encodings = track.kind === 'video' ? _videoEncodings() : [];
            if (track.kind === 'video' && encodings.length) {
                var transceiver = _pc.addTransceiver(track, {
                    direction: 'sendonly',
                    streams: [stream],
                    sendEncodings: encodings,
                });
                sender = transceiver.sender;
            } else {
                sender = _pc.addTrack(track, stream);
            }
            track.addEventListener('ended', _onEnded);
            track.addEventListener('mute', _onMute);
            track.addEventListener('unmute', _onUnmute);

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
                _forgetCapture(origin);
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

            if (_readyState === State.CLOSING || _readyState === State.CLOSED) {
                stream.getTracks().forEach(function (track) {
                    track.stop();
                });
                throw _captureFailure || { name: 'AbortError', message: 'RTC capture was cancelled.' };
            }

            _name = participation ? _sessionId() : stream.id;
            _screensharing = screensharing;
            _withcamera = withcamera;
            _stream = stream;
            _audiometer.update(stream);
            return Promise.resolve(stream);
        };

        _this.preview = async function (screensharing, withcamera, option) {
            if (_readyState === State.CLOSING || _readyState === State.CLOSED) {
                return Promise.reject({ name: 'AbortError', message: 'RTC stream has been closed.' });
            }

            if (_stream == null) {
                try {
                    await _this.createStream(screensharing, withcamera, option);
                } catch (err) {
                    _logger.error(`Failed to create stream: id=${_this.config.id}, stream=${_name}`);
                    return Promise.reject(err);
                }
            }
            try {
                _stream.getTracks().forEach(function (track) {
                    _this.addTrack(track, _stream);
                });
            } catch (err) {
                _this.close(err.message);
                return Promise.reject(err);
            }
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
            if (_readyState !== State.CONNECTED) {
                return Promise.reject(_captureFailure || { name: 'AbortError', message: 'RTC stream has been closed.' });
            }

            _readyState = State.CONNECTING;

            try {
                var streamId = _this.getProperty('stream');
                if (streamId === undefined || streamId === '') {
                    streamId = _uuid();
                }
                if (typeof streamId !== 'string' ||
                    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(streamId) ||
                    streamId === '00000000-0000-0000-0000-000000000000') {
                    throw { name: 'DataError', message: 'Invalid publication stream ID.' };
                }
                _name = streamId;
                _this.setProperty('stream', streamId);

                await _setCodecPreferences('sender');
                var offer = await _pc.createOffer();
                offer.sdp = offer.sdp.replace(/a=rtcp-fb:\d+ goog-remb(\n|\r\n)/gi, '');
                _logger.log(`createOffer success: id=${_this.config.id}, stream=${_name}, sdp=\n${offer.sdp}`);

                await _pc.setLocalDescription(offer);

                var response = await _post(_this.config.whip, offer.sdp, 'publish');
                var answer = new RTCSessionDescription({ type: 'answer', sdp: response });
                await _pc.setRemoteDescription(answer);
                if (_readyState !== State.CONNECTING) {
                    throw { name: 'AbortError', message: 'RTC negotiation was cancelled.' };
                }
                _negotiated = true;
                _flushCandidates();
            } catch (err) {
                _this.close(err.message);
                _logger.error(`Failed to publish: id=${_this.config.id}, stream=${_name}, error=${err}`);
                return Promise.reject(_captureFailure || err);
            }

            if (_readyState !== State.CONNECTING) {
                return Promise.reject(_captureFailure || { name: 'AbortError', message: 'RTC publishing was cancelled.' });
            }
            try {
                await _setMaxBitrate();
                await _checkVideoEncodings();
            } catch (err) {
                _this.close();
                return Promise.reject(_captureFailure || err);
            }
            if (_readyState !== State.CONNECTING) {
                return Promise.reject(_captureFailure || { name: 'AbortError', message: 'RTC publishing was cancelled.' });
            }
            _readyState = State.PUBLISHING;
            _this.dispatchEvent(NetStatusEvent.NETSTATUS, {
                level: Level.STATUS,
                code: Code.NETSTREAM_PUBLISH_START,
                description: 'publish start',
                info: {
                    stream: _name,
                    id: _this.getProperty('@id'),
                    location: _location,
                },
            });
            return Promise.resolve();
        };

        function _videoEncodings() {
            var video = _this.config.video;
            if (!Array.isArray(video.encodings) ||
                (video.simulcast !== undefined && typeof video.simulcast !== 'boolean') ||
                typeof video.svc !== 'boolean') {
                throw { name: 'TypeError', message: 'Invalid video scalability configuration.' };
            }
            var simulcast = video.simulcast === undefined ? video.encodings.length > 1 : video.simulcast;
            if ((simulcast && (video.encodings.length < 2 || video.encodings.length > 3)) ||
                (!simulcast && video.encodings.length > 1) ||
                (video.svc && video.encodings.length === 0)) {
                throw { name: 'TypeError', message: 'Video encoding count conflicts with simulcast/SVC flags.' };
            }
            if (video.svc && !_this.config.codecpreferences.some(function (codec) {
                return codec.toLowerCase() === 'video/av1';
            })) {
                throw { name: 'NotSupportedError', message: 'SVC requires an explicit video/AV1 codec preference.' };
            }
            var rids = [];
            return video.encodings.map(function (value) {
                var encoding = utils.extendz({}, value);
                if ((simulcast && (!encoding.rid || !/^[a-zA-Z0-9]{1,16}$/.test(encoding.rid))) ||
                    (encoding.rid && rids.indexOf(encoding.rid) !== -1) ||
                    !Number.isFinite(encoding.maxBitrate) || encoding.maxBitrate <= 0) {
                    throw { name: 'TypeError', message: 'Video encodings require unique RIDs for simulcast and positive bitrate limits.' };
                }
                rids.push(encoding.rid);
                if (video.svc) {
                    // AV1 full spatial/temporal modes. Independent S modes,
                    // half-resolution and key-shift variants are not implemented.
                    if (!/^L(?:1T[1-3]|[23]T[1-3](?:_KEY)?)$/.test(encoding.scalabilityMode || '')) {
                        throw { name: 'NotSupportedError', message: 'Unsupported AV1 scalabilityMode.' };
                    }
                } else {
                    if (encoding.scalabilityMode && encoding.scalabilityMode !== 'L1T1') {
                        throw { name: 'TypeError', message: 'A layered scalabilityMode requires video.svc=true.' };
                    }
                    delete encoding.scalabilityMode;
                }
                return encoding;
            });
        }

        function _videoSection(sdp, mid) {
            var sections = sdp.split(/\r?\nm=/);
            return sections.find(function (section, index) {
                return index > 0 && section.indexOf('video ') === 0 &&
                    section.split(/\r?\n/).indexOf('a=mid:' + mid) !== -1;
            });
        }

        async function _checkVideoEncodings() {
            var expected = _videoEncodings();
            var transceivers = _pc.getTransceivers();
            for (var i = 0; i < transceivers.length; i++) {
                var transceiver = transceivers[i];
                var sender = transceiver.sender;
                if (!sender.track || sender.track.kind !== 'video') {
                    continue;
                }
                var section = _videoSection(_pc.remoteDescription.sdp, transceiver.mid);
                if (!section || (/^video 0(?: |$)/.test(section) &&
                    !/(?:^|\r?\n)a=bundle-only(?:\r?\n|$)/.test(section)) ||
                    !/(?:^|\r?\n)a=(?:recvonly|sendrecv)(?:\r?\n|$)/.test(section)) {
                    throw { name: 'NotSupportedError', message: 'The answer did not accept the video sender.' };
                }
                var parameters = sender.getParameters();
                var encodings = parameters.encodings || [];
                if (encodings.length !== Math.max(1, expected.length)) {
                    throw { name: 'NotSupportedError', message: 'The browser changed the requested video encoding count.' };
                }
                var av1 = /(?:^|\r?\n)a=rtpmap:\d+ AV1\/90000(?:\r?\n|$)/i.test(section);
                if (_this.config.video.svc && (!av1 ||
                    !/(?:^|\r?\n)a=extmap:\d+(?:\/(?:recvonly|sendrecv))? https:\/\/aomediacodec.github.io\/av1-rtp-spec\/#dependency-descriptor-rtp-header-extension(?:[ \t]|\r?\n|$)/.test(section))) {
                    throw { name: 'NotSupportedError', message: 'AV1 SVC requires AV1 and receiving dependency descriptors in the answer.' };
                }
                if (expected.length > 1) {
                    var accepted = /(?:^|\r?\n)a=simulcast:recv ([^\r\n]+)/.exec(section);
                    var rids = accepted ? accepted[1].trim().split(';') : [];
                    if (rids.length !== expected.length || expected.some(function (encoding, index) {
                        return rids[index] !== encoding.rid;
                    })) {
                        throw { name: 'NotSupportedError', message: 'The answer omitted, paused or replaced a simulcast encoding.' };
                    }
                }
                for (var j = 0; j < encodings.length; j++) {
                    if (expected[j] && expected[j].rid && expected[j].rid !== encodings[j].rid) {
                        throw { name: 'NotSupportedError', message: 'Negotiated video RID differs from its configuration.' };
                    }
                    if (_this.config.video.svc) {
                        if (encodings[j].scalabilityMode !== expected[j].scalabilityMode) {
                            throw { name: 'NotSupportedError', message: 'The browser did not retain the requested AV1 scalabilityMode.' };
                        }
                    } else if (av1) {
                        encodings[j].scalabilityMode = 'L1T1';
                    }
                }
                if (av1 && !_this.config.video.svc) {
                    await sender.setParameters(parameters);
                    if (sender.getParameters().encodings.some(function (encoding) {
                        return encoding.scalabilityMode !== 'L1T1';
                    })) {
                        throw { name: 'NotSupportedError', message: 'The browser did not retain non-layered AV1 encoding.' };
                    }
                }
                _logger.log('Video encodings negotiated:', sender.getParameters().encodings);
            }
        }

        async function _setCodecPreferences(type) {
            if (type === 'sender') {
                _videoEncodings();
            }
            var factory = type === 'sender' ? RTCRtpSender : RTCRtpReceiver;
            var preferences = _this.config.codecpreferences.map(function (mimeType) {
                return mimeType.toLowerCase();
            });
            var transceivers = _pc.getTransceivers();
            for (var i = 0; i < transceivers.length; i++) {
                var transceiver = transceivers[i];
                var track = transceiver[type].track;
                if (!track) {
                    continue;
                }

                var capabilities = factory.getCapabilities(track.kind);
                var codecs = [];
                preferences.forEach(function (mimeType) {
                    if (type === 'sender' && track.kind === 'video' && _this.config.video.svc && mimeType !== 'video/av1') {
                        return;
                    }
                    if (mimeType !== 'audio/opus' && mimeType !== 'video/h264' && mimeType !== 'video/h265' && mimeType !== 'video/av1') {
                        return;
                    }
                    if (capabilities && capabilities.codecs) {
                        capabilities.codecs.forEach(function (codec) {
                            if (codec.mimeType.toLowerCase() !== mimeType) {
                                return;
                            }
                            if (mimeType === 'video/av1' &&
                                /(?:^|;)\s*profile=(?!0(?:;|$))/i.test(codec.sdpFmtpLine || '')) {
                                return;
                            }
                            if (mimeType === 'video/h264' &&
                                !/(?:^|;)\s*packetization-mode=1(?:;|$)/i.test(codec.sdpFmtpLine || '')) {
                                return;
                            }
                            codecs.push(codec);
                        });
                    }
                });
                if (codecs.length === 0) {
                    return Promise.reject({ name: 'NotSupportedError', message: 'No compatible ' + track.kind + ' codec.' });
                }
                if (track.kind === 'video') {
                    capabilities.codecs.forEach(function (codec) {
                        if (codec.mimeType.toLowerCase() === 'video/rtx') {
                            codecs.push(codec);
                        }
                    });
                }
                transceiver.setCodecPreferences(codecs);
            }
        }

        async function _setMaxBitrate() {
            var senders = _pc ? _pc.getSenders() : [];
            for (var i = 0; i < senders.length; i++) {
                var sender = senders[i];
                if (!sender.track || sender.track.kind !== 'video' ||
                    !_this.constraints.video || !_this.constraints.video.maxBitrate) {
                    continue;
                }

                var bitrate = _this.constraints.video.maxBitrate * 1000;
                var parameters = sender.getParameters();
                var configured = _this.config.video.encodings;
                var maximum = 0;
                configured.forEach(function (encoding) {
                    maximum = Math.max(maximum, encoding.maxBitrate || 0);
                });
                if (!parameters.encodings || parameters.encodings.length === 0) {
                    return Promise.reject({ name: 'InvalidStateError', message: 'Video sender encodings are unavailable.' });
                }
                if (parameters.encodings.length > 1 && maximum === 0) {
                    return Promise.reject({ name: 'TypeError', message: 'Simulcast encodings require explicit bitrate limits.' });
                }
                for (var j = 0; j < parameters.encodings.length; j++) {
                    var encoding = parameters.encodings[j];
                    var option = configured.find(function (item) { return item.rid === encoding.rid; });
                    if (parameters.encodings.length > 1 && !option) {
                        return Promise.reject({ name: 'InvalidModificationError', message: 'Negotiated video RID differs from its configuration.' });
                    }
                    var ratio = option && maximum ? option.maxBitrate / maximum : 1;
                    encoding.maxBitrate = Math.max(1, Math.round(bitrate * ratio));
                }
                await sender.setParameters(parameters);
                _logger.log(`Set max bitrate: id=${_this.config.id}, stream=${_name}, value=${bitrate}`);
            }
        }

        function _setJitterBufferTarget() {
            _pc.getReceivers().forEach(function (receiver) {
                if (receiver.track && receiver.track.kind === 'video') {
                    receiver.jitterBufferTarget = 300;
                }
            });
        }

        function _uuid() {
            if (!window.crypto || !window.crypto.getRandomValues) {
                throw { name: 'NotSupportedError', message: 'RTC identity requires secure randomness.' };
            }
            var bytes = new Uint8Array(16), value = '';
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

        function _sessionId() {
            if (!_connectionId) {
                _connectionId = _uuid();
            }
            return _connectionId;
        }

        async function _postParticipant(sdp, direction, generation, deadline) {
            if (!participation || _participant) {
                throw { name: 'InvalidStateError', message: 'RTC participant must belong to the owning RTC instance.' };
            }
            var ticket = participation.acquire(deadline, function (error) { _this.close(error.message); });
            _credentialReject = ticket.cancel;
            var participant;
            try {
                participant = await ticket.promise;
            } finally {
                if (_credentialReject === ticket.cancel) {
                    _credentialReject = undefined;
                }
            }
            if (_readyState !== State.CONNECTING || generation !== _generation || Date.now() >= deadline) {
                ticket.cancel();
                throw { name: 'AbortError', message: 'RTC participation was cancelled.' };
            }
            _participant = participant;
            var purpose = _screensharing ? 'screen' : _stream && _stream.getVideoTracks().length ? 'camera' : 'audio';
            var media = await participant.route(direction, _name, _sessionId(), deadline, purpose);
            if (_readyState !== State.CONNECTING || generation !== _generation || Date.now() >= deadline) {
                throw { name: 'AbortError', message: 'RTC media routing was cancelled.' };
            }
            _name = media.streamId;
            var url = media.url;
            // The independent proof already owns this exact technical ID. A
            // lost POST response can still trigger a bounded best-effort DELETE.
            _location = url + '/' + media.instanceId;
            _etag = '*';
            var result = await participant.send('POST', url, sdp, 'application/sdp', '', deadline, 1048576);
            var location = result.headers.get('Location'), target = new URL(url);
            if (!location || (result.headers.get('Content-Type') || '').split(';')[0].trim() !== 'application/sdp') {
                throw { name: 'DataError', message: 'Invalid product RTC negotiation response.' };
            }
            var resource = new URL(location, target);
            if (resource.origin !== target.origin || resource.username || resource.password || resource.search || resource.hash ||
                resource.href !== target.href + '/' + media.instanceId) {
                throw { name: 'SecurityError', message: 'Product RTC Location left its assigned endpoint.' };
            }
            _location = resource.href;
            _etag = result.headers.get('ETag');
            if (_readyState !== State.CONNECTING || generation !== _generation) {
                await _delete();
                throw { name: 'AbortError', message: 'RTC negotiation was cancelled.' };
            }
            _this.setProperty('@id', resource.pathname.split('/').pop());
            _this.setProperty('stream', _name);
            return result.body;
        }

        async function _post(url, sdp, direction) {
            if (_readyState !== State.CONNECTING) {
                throw { name: 'AbortError', message: 'RTC negotiation was cancelled.' };
            }
            var generation = ++_generation,
                deadline = Date.now() + _this.config.timeout,
                credentials;
            if (!Number.isSafeInteger(_this.config.timeout) || _this.config.timeout <= 0 || _this.config.timeout > 2147483647 ||
                (_this.config.credentials !== null && typeof _this.config.credentials !== 'function')) {
                throw { name: 'TypeError', message: 'Invalid RTC timeout or credentials configuration.' };
            }
            if (_this.config.participation !== null) {
                return _postParticipant(sdp, direction, generation, deadline);
            }
            var endpoint = new URL(url, document.baseURI);
            if (endpoint.username || endpoint.password || endpoint.hash ||
                (endpoint.protocol !== 'http:' && endpoint.protocol !== 'https:') ||
                (location.protocol === 'https:' && endpoint.protocol !== 'https:')) {
                throw { name: 'SecurityError', message: 'Invalid RTC endpoint.' };
            }

            if (_this.config.credentials) {
                _sessionId();
                var controller = window.AbortController ? new AbortController() : null,
                    context = {
                        protocol: direction === 'publish' ? 'WHIP' : 'WHEP',
                        direction: direction,
                        streamId: _name,
                        connectionId: _connectionId,
                        instanceId: _connectionId,
                        operationId: _connectionId,
                        createdAt: String(Date.now()),
                        deadline: deadline,
                        signal: controller ? controller.signal : undefined,
                        generation: String(generation),
                        audio: direction === 'publish' && _stream.getAudioTracks().length > 0,
                        video: direction === 'publish' && _stream.getVideoTracks().length > 0,
                        purpose: _screensharing ? 'screen' : _stream && _stream.getVideoTracks().length ? 'camera' : 'audio',
                        url: endpoint.href,
                    };
                credentials = await new Promise(function (resolve, reject) {
                    var timer = setTimeout(function () {
                        finish({ name: 'TimeoutError', message: 'RTC credentials timed out.' });
                    }, Math.max(1, deadline - Date.now()));
                    function finish(error, value) {
                        if (_credentialReject !== cancel) {
                            return;
                        }
                        clearTimeout(timer);
                        _credentialReject = undefined;
                        if (error) {
                            if (controller) {
                                controller.abort();
                            }
                            reject(error);
                        } else {
                            resolve(value);
                        }
                    }
                    function cancel() {
                        finish({ name: 'AbortError', message: 'RTC credentials were cancelled.' });
                    }
                    _credentialReject = cancel;
                    Promise.resolve().then(function () {
                        if (_credentialReject !== cancel || _readyState !== State.CONNECTING) {
                            throw { name: 'AbortError', message: 'RTC credentials were cancelled.' };
                        }
                        return _this.config.credentials(context);
                    }).then(function (value) {
                        finish(null, value);
                    }, finish);
                });
                if (_readyState !== State.CONNECTING || generation !== _generation) {
                    throw { name: 'AbortError', message: 'RTC credentials were cancelled.' };
                }
                if (credentials && credentials.product === 'live') {
                    if (credentials.streamId !== _name) {
                        throw { name: 'DataError', message: 'Media routing changed the requested stream.' };
                    }
                    if (!utils.MediaRequest || !window.fetch || !window.AbortController ||
                        !window.ReadableStream || !window.TextDecoder) {
                        throw { name: 'NotSupportedError', message: 'Product live media requires streaming Fetch and cancellation.' };
                    }
                    _media = new utils.MediaRequest(credentials, context);
                    _name = _media.streamId;
                    _this.setProperty('stream', _name);
                    // Pre-bind the exact resource before POST. A lost response
                    // still leaves a bounded cleanup using only its own proof.
                    _location = _media.resource;
                    _etag = '*';
                    var currentMedia = _media, live;
                    _credentialReject = function () { if (controller) { controller.abort(); } };
                    try {
                        try {
                            live = await _requestLive('POST', currentMedia.url, sdp, 'application/sdp', '', deadline, 1048576);
                        } catch (error) {
                            if (!error.credentialExpired || _readyState !== State.CONNECTING || generation !== _generation) { throw error; }
                            await currentMedia.renew(_this.config.credentials);
                            if (_readyState !== State.CONNECTING || generation !== _generation) {
                                throw { name: 'AbortError', message: 'Live media renewal was cancelled.' };
                            }
                            live = await _requestLive('POST', currentMedia.url, sdp, 'application/sdp', '', deadline, 1048576);
                        }
                    } finally {
                        _credentialReject = undefined;
                    }
                    if (_readyState !== State.CONNECTING || generation !== _generation) {
                        throw { name: 'AbortError', message: 'Live media negotiation was cancelled.' };
                    }
                    var assigned = live.headers.get('Location');
                    if (!assigned || new URL(assigned, _media.url).href !== _media.resource ||
                        (live.headers.get('Content-Type') || '').split(';')[0].trim() !== 'application/sdp') {
                        throw { name: 'SecurityError', message: 'Live media response changed its assigned resource.' };
                    }
                    _etag = live.headers.get('ETag');
                    _this.setProperty('@id', _media.instanceId);
                    return live.body;
                }
                if (credentials && credentials.product !== undefined) {
                    throw { name: 'NotSupportedError', message: 'RTC product media requires the participation profile.' };
                }
                if (!credentials || typeof credentials.token !== 'string' || !credentials.token || credentials.token.length > 8192 ||
                    /[\s]/.test(credentials.token) || typeof credentials.url !== 'string' || !credentials.url ||
                    typeof credentials.streamId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(credentials.streamId) ||
                    credentials.streamId === '00000000-0000-0000-0000-000000000000' ||
                    !Number.isSafeInteger(credentials.connectBefore) || credentials.connectBefore <= Date.now() / 1000 ||
                    credentials.streamId !== _name) {
                    throw { name: 'DataError', message: 'Invalid RTC credentials.' };
                }
                var target = new URL(credentials.url, document.baseURI);
                if (target.username || target.password || target.hash ||
                    (target.protocol !== 'http:' && target.protocol !== 'https:') ||
                    ((location.protocol === 'https:' || endpoint.protocol === 'https:') && target.protocol !== 'https:')) {
                    throw { name: 'SecurityError', message: 'Invalid RTC credential endpoint.' };
                }
                endpoint = target;
                _name = credentials.streamId;
                _this.setProperty('stream', _name);
                _token = credentials.token;
                deadline = Math.min(deadline, credentials.connectBefore * 1000);
            } else {
                _token = utils.getCookie('token');
                if (!_token) {
                    throw { name: 'NotAllowedError', message: 'The application token cookie is missing.' };
                }
            }
            if (_readyState !== State.CONNECTING || generation !== _generation || Date.now() >= deadline) {
                throw { name: 'TimeoutError', message: 'RTC negotiation timed out.' };
            }
            url = endpoint.href;
            return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open('POST', url, true);
                xhr.timeout = Math.max(1, deadline - Date.now());
                xhr.setRequestHeader('Content-Type', 'application/sdp');
                xhr.setRequestHeader('Authorization', 'Bearer ' + _token);
                xhr.onreadystatechange = function () {
                    if (xhr.readyState !== 4 || xhr.status === 0) {
                        return;
                    }
                    if (_readyState !== State.CONNECTING || generation !== _generation) {
                        reject({ name: 'AbortError', message: 'RTC negotiation was cancelled.' });
                        return;
                    }
                    if (xhr.status < 200 || xhr.status > 299) {
                        reject({ name: 'NetworkError', message: xhr.status + ' ' + xhr.statusText });
                        return;
                    }

                    var location = xhr.getResponseHeader('Location');
                    if (!location) {
                        reject({ name: 'DataError', message: 'The RTC response has no Location.' });
                        return;
                    }
                    try {
                        var resource = new URL(location, endpoint);
                        if (resource.origin !== endpoint.origin || resource.username || resource.password || resource.hash ||
                            (xhr.responseURL && new URL(xhr.responseURL).origin !== endpoint.origin)) {
                            throw { name: 'SecurityError', message: 'RTC resource changed its origin.' };
                        }
                        _location = resource.href;
                    } catch (err) {
                        reject({ name: 'DataError', message: 'The RTC response has an invalid Location.' });
                        return;
                    }
                    _etag = xhr.getResponseHeader('ETag');
                    _this.setProperty('@id', new URL(_location).pathname.split('/').pop());
                    resolve(xhr.responseText);
                };
                xhr.onerror = function () {
                    reject({ name: 'NetworkError', message: 'Failed to negotiate the RTC stream.' });
                };
                xhr.ontimeout = function () {
                    reject({ name: 'TimeoutError', message: 'RTC negotiation timed out.' });
                };
                xhr.onabort = function () {
                    reject({ name: 'AbortError', message: 'RTC negotiation was cancelled.' });
                };
                xhr.onloadend = function () {
                    var index = utils.indexOf(_requests, xhr);
                    if (index !== -1) {
                        _requests.splice(index, 1);
                    }
                };
                _requests.push(xhr);
                xhr.send(sdp);
            });
        }

        async function _requestLive(method, url, body, type, etag, deadline, limit) {
            var media = _media;
            if (!media || url !== (method === 'POST' ? media.url : media.resource) ||
                _requests.length >= (method === 'DELETE' ? 33 : 32) ||
                (body !== undefined && (typeof body !== 'string' || body.length > 1048576))) {
                throw { name: 'InvalidAccessError', message: 'Invalid live media request.' };
            }
            deadline = Math.min(deadline, Date.now() + _this.config.timeout);
            if (method === 'POST') {
                deadline = Math.min(deadline, media.connectBefore * 1000);
            }
            if (deadline <= Date.now()) {
                throw { name: 'TimeoutError', message: 'Live media request timed out.' };
            }
            var controller = new AbortController(), headers = media.headers(method), reader,
                timer = setTimeout(function () { controller.abort(); }, Math.max(1, deadline - Date.now()));
            if (type) {
                headers['Content-Type'] = type;
            }
            if (etag) {
                headers['If-Match'] = etag;
            }
            _requests.push(controller);
            try {
                var response = await fetch(url, {
                    method: method, headers: headers, body: body, signal: controller.signal,
                    credentials: 'omit', cache: 'no-store', redirect: 'error', mode: 'cors',
                });
                if (!response.ok || response.url !== url || response.redirected) {
                    throw { name: 'NetworkError', message: 'Live media request failed: status=' + response.status + '.',
                        credentialExpired: method === 'POST' && response.url === url && !response.redirected && utils.MediaRequest.expired(response) };
                }
                var decoder = new TextDecoder('utf-8', { fatal: true }), text = '', size = 0;
                if (response.body) {
                    reader = response.body.getReader();
                    while (true) {
                        var part = await reader.read();
                        if (part.done) {
                            break;
                        }
                        size += part.value.byteLength;
                        if (size > limit) {
                            throw { name: 'QuotaExceededError', message: 'Live media response exceeds its byte limit.' };
                        }
                        text += decoder.decode(part.value, { stream: true });
                    }
                }
                if (controller.signal.aborted || Date.now() >= deadline) {
                    throw { name: 'TimeoutError', message: 'Live media request did not finish before its deadline.' };
                }
                return { headers: response.headers, body: text + decoder.decode() };
            } finally {
                clearTimeout(timer);
                controller.abort();
                if (reader) {
                    reader.releaseLock();
                }
                var index = utils.indexOf(_requests, controller);
                if (index !== -1) {
                    _requests.splice(index, 1);
                }
            }
        }

        async function _patch(candidate) {
            if (_this.config.trickle !== true || !_location) {
                return;
            }
            if (_participant) {
                var result = await _participant.send('PATCH', _location,
                    candidate.candidate ? 'a=' + candidate.candidate + '\r\n' : 'a=end-of-candidates\r\n',
                    'application/trickle-ice-sdpfrag', _etag, Date.now() + _this.config.timeout, 4096);
                _etag = result.headers.get('ETag') || _etag;
                return;
            }
            if (_media) {
                var live = await _requestLive('PATCH', _location,
                    candidate.candidate ? 'a=' + candidate.candidate + '\r\n' : 'a=end-of-candidates\r\n',
                    'application/trickle-ice-sdpfrag', _etag, Date.now() + _this.config.timeout, 4096);
                _etag = live.headers.get('ETag') || _etag;
                return;
            }
            return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open('PATCH', _location, true);
                xhr.timeout = _this.config.timeout;
                xhr.setRequestHeader('Content-Type', 'application/trickle-ice-sdpfrag');
                xhr.setRequestHeader('Authorization', 'Bearer ' + _token);
                if (_etag) {
                    xhr.setRequestHeader('If-Match', _etag);
                }
                xhr.onreadystatechange = function () {
                    if (xhr.readyState !== 4 || xhr.status === 0) {
                        return;
                    }
                    if (xhr.status < 200 || xhr.status > 299) {
                        reject({ name: 'NetworkError', message: xhr.status + ' ' + xhr.statusText });
                        return;
                    }
                    _etag = xhr.getResponseHeader('ETag') || _etag;
                    resolve();
                };
                xhr.onerror = function () {
                    reject({ name: 'NetworkError', message: 'Failed to update the RTC candidate.' });
                };
                xhr.ontimeout = function () {
                    reject({ name: 'TimeoutError', message: 'RTC candidate update timed out.' });
                };
                xhr.onabort = function () {
                    reject({ name: 'AbortError', message: 'RTC candidate update was cancelled.' });
                };
                xhr.onloadend = function () {
                    var index = utils.indexOf(_requests, xhr);
                    if (index !== -1) {
                        _requests.splice(index, 1);
                    }
                };
                _requests.push(xhr);
                xhr.send(candidate.candidate ? 'a=' + candidate.candidate + '\r\n' : 'a=end-of-candidates\r\n');
            });
        }

        async function _delete() {
            if (!_location) {
                return;
            }
            var location = _location;
            _location = null;
            if (_participant) {
                await _participant.send('DELETE', location, undefined, '', _etag, Date.now() + _this.config.timeout, 4096);
                return;
            }
            if (_media) {
                await _requestLive('DELETE', location, undefined, '', _etag, Date.now() + _this.config.timeout, 4096);
                return;
            }

            return new Promise(function (resolve, reject) {
                var xhr = new XMLHttpRequest();
                xhr.open('DELETE', location, true);
                xhr.timeout = _this.config.timeout;
                xhr.setRequestHeader('Authorization', 'Bearer ' + _token);
                if (_etag) {
                    xhr.setRequestHeader('If-Match', _etag);
                }
                xhr.onreadystatechange = function () {
                    if (xhr.readyState !== 4 || xhr.status === 0) {
                        return;
                    }
                    if (xhr.status < 200 || xhr.status > 299) {
                        reject({ name: 'NetworkError', message: xhr.status + ' ' + xhr.statusText });
                        return;
                    }
                    resolve();
                };
                xhr.onerror = function () {
                    reject({ name: 'NetworkError', message: 'Failed to release the RTC stream.' });
                };
                xhr.ontimeout = function () {
                    reject({ name: 'TimeoutError', message: 'RTC stream release timed out.' });
                };
                xhr.send();
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
            if (_readyState !== State.CONNECTED) {
                return Promise.reject({ name: 'AbortError', message: 'RTC stream has been closed.' });
            }

            _readyState = State.CONNECTING;

            _name = name;

            _pc.addTransceiver('audio', { direction: 'recvonly' });
            _pc.addTransceiver('video', { direction: 'recvonly' });
            try {
                await _setCodecPreferences('receiver');
                var offer = await _pc.createOffer();
                offer.sdp = offer.sdp.replace(/a=rtcp-fb:\d+ goog-remb(\n|\r\n)/gi, '');
                _logger.log(`createOffer success: id=${_this.config.id}, stream=${_name}, sdp=\n${offer.sdp}`);

                await _pc.setLocalDescription(offer);

                var response = await _post(`${_this.config.whep}/${encodeURIComponent(_name)}`, offer.sdp, 'play');
                var answer = new RTCSessionDescription({ type: 'answer', sdp: response });
                await _pc.setRemoteDescription(answer);
                if (_readyState !== State.CONNECTING) {
                    throw { name: 'AbortError', message: 'RTC negotiation was cancelled.' };
                }
                _negotiated = true;
                _flushCandidates();
            } catch (err) {
                _this.close(err.message);
                _logger.error(`Failed to play: id=${_this.config.id}, stream=${_name}, error=${err}`);
                return Promise.reject(err);
            }

            if (_readyState !== State.CONNECTING) {
                return Promise.reject({ name: 'AbortError', message: 'RTC playback was cancelled.' });
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
            if (_this.config.trickle !== true || _readyState === State.CLOSING || _readyState === State.CLOSED) {
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
            _logger.log(`onIceCandidate: id=${_this.config.id}, stream=${_name}, candidate=${candidate.candidate}, mid=${candidate.sdpMid}, mlineindex=${candidate.sdpMLineIndex}`);

            // ICE can arrive while credentials or POST are still pending.
            // Preserve it until the resource exists, with bounded memory.
            if (_candidates.length >= 64 || candidate.candidate.length > 4096 ||
                _candidateBytes + candidate.candidate.length > 65536) {
                _this.close('ICE candidate queue exceeded its limit.');
                return;
            }
            _candidates.push(candidate);
            _candidateBytes += candidate.candidate.length;
            _flushCandidates();
        }

        async function _flushCandidates() {
            if (!_negotiated || !_location || _candidatePending) {
                return;
            }
            _candidatePending = true;
            try {
                // Serialize PATCH so each request consumes the latest ETag.
                while (_negotiated && _location && _candidates.length) {
                    var candidate = _candidates.shift();
                    _candidateBytes -= candidate.candidate.length;
                    await _patch(candidate);
                }
            } catch (err) {
                if (_readyState !== State.CLOSING && _readyState !== State.CLOSED) {
                    _logger.error('Failed to send ICE candidate: ' + err.name + '.');
                    _this.close('ICE candidate update failed.');
                }
            } finally {
                _candidatePending = false;
            }
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

        _this.measureAudio = function () {
            return _audiometer.measure();
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
                case State.INITIALIZED:
                case State.CONNECTING:
                case State.CONNECTED:
                case State.PUBLISHING:
                case State.PLAYING:
                    _readyState = State.CLOSING;
                    _captures.forEach(function (capture) {
                        capture.track.removeEventListener('ended', _onCaptureEnded);
                        capture.track.stop();
                    });
                    _captures = [];
                    _generation++;
                    _negotiated = false;
                    _candidates = [];
                    _candidateBytes = 0;
                    if (_credentialReject) {
                        _credentialReject();
                    }

                    var requests = _requests.slice(0);
                    for (var i = 0; i < requests.length; i++) {
                        requests[i].abort();
                    }
                    _requests = [];
                    var participant = _participant;
                    if (participant) {
                        participant.abort();
                    }
                    _delete().catch(function (err) {
                        _logger.warn('Failed to release RTC resource: ' + err.message);
                    }).finally(function () {
                        if (participant) {
                            participant.release();
                        }
                        if (_participant === participant) {
                            _participant = undefined;
                        }
                        _media = undefined;
                    });

                    var senders = _pc ? _pc.getSenders() : [];
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
                    var receivers = _pc ? _pc.getReceivers() : [];
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
                        _videomixer.forEach(function (element) {
                            if (element.srcObject) {
                                element.srcObject.getTracks().forEach(function (track) {
                                    track.stop();
                                });
                            }
                        });
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

                    _this.dispatchEvent(Event.RELEASE, { reason: reason });
                    _readyState = State.CLOSED;
                    _stream = null;
                    _video.srcObject = null;
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

