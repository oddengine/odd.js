var utils = odd.utils,
    Kernel = odd.Kernel,
    events = odd.events,
    Event = events.Event,
    NetStatusEvent = events.NetStatusEvent,
    SaverEvent = events.SaverEvent,
    Level = events.Level,
    Code = events.Code,
    IM = odd.IM,
    RTC = odd.RTC,
    Constraints = RTC.Constraints,

    _hasIM = !!(IM && odd.im && IM.Protocol),
    _joinedRoom,
    _requestedRoom,
    _roomGeneration = 0,
    _imReady = false,
    _pendingJoin,
    _detected = false,
    _preview,
    _writer;

var im;

function onReady(e) {
    _imReady = true;
    im.logger.log(`onReady: user=${im.userId()}`);
    if (_pendingJoin) {
        _joinRoom(_pendingJoin);
        _pendingJoin = undefined;
    }
}

function onJoinClick(e) {
    var room = _value('in_room', '');
    if (_setupIM(room) && _imReady) {
        _joinRoom(room);
    }
}

function onLeaveClick(e) {
    rtc.stop();
    _roomGeneration++;
    _pendingJoin = undefined;
    var room = _requestedRoom || _joinedRoom;
    _requestedRoom = _joinedRoom = undefined;
    if (_imReady && room) { im.leave(room).catch(_imError); }
}

var rtc = odd.rtc.create({ mode: 'feedback', url: 'https://fc.oddengine.com/rtc/log', interval: 60 });
rtc.addEventListener(NetStatusEvent.NETSTATUS, onStatus);
rtc.addEventListener(Event.CLOSE, onClose);
rtc.setup({
    profile: sl_profiles.value || '180P_1',
    whip: location.protocol + '//' + location.host + '/whip/live',
    whep: location.protocol + '//' + location.host + '/whep/live',
    codecpreferences: [
        'audio/opus',
        'video/H264',
        'video/rtx',
    ],
});

(async function () {
    window.addEventListener('beforeunload', onLeaveClick);
    getProfiles();
    await getDevices();
})();

function _setupIM(room) {
    if (_hasIM === false) {
        rtc.logger.warn('IM is not available.');
        return false;
    }
    if (im) {
        if (!_imReady) { _pendingJoin = room; }
        return true;
    }

    _pendingJoin = room;
    im = odd.im.create();
    im.addEventListener(Event.READY, onReady);
    im.addEventListener(IM.Event.MESSAGE, onMessage);
    im.addEventListener(IM.Event.NOTIFY, onNotify);
    im.addEventListener(Event.CLOSE, onClose);
    im.setup({
        retry: { count: 0 },
        url: (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/im',
    }).catch((err) => {
        _imReady = false;
        _pendingJoin = undefined;
        im = undefined;
        rtc.logger.warn(`Failed to setup IM, fallback to WHIP/WHEP only: error=${err}`);
    });
    return true;
}

function getProfiles() {
    var labels = ['1080P_1', '720P_1', '540P_1', '360P_1', '180P_1'];
    for (var i = 0; i < labels.length; i++) {
        var label = labels[i];
        var option = utils.createElement('option');
        option.selected = i === 4 ? 'selected' : undefined;
        option.value = label;
        option.innerHTML = label;
        sl_profiles.appendChild(option);
    }
}

async function getDevices() {
    if (_detected === false) {
        try {
            var cameras = await RTC.getCameras(rtc.logger);
            for (var i = 0; i < cameras.length; i++) {
                var device = cameras[i];
                var option = utils.createElement('option');
                option.value = device.deviceId;
                option.innerHTML = device.label;
                sl_cameras.appendChild(option);
            }
            var microphones = await RTC.getMicrophones(rtc.logger);
            for (var i = 0; i < microphones.length; i++) {
                var device = microphones[i];
                var option = utils.createElement('option');
                option.value = device.deviceId;
                option.innerHTML = device.label;
                sl_microphones.appendChild(option);
            }
            _detected = true;
        } catch (err) {
            console.warn(`Failed to get devices: ${err}`);
        }
    }
}

function onPreviewClick(e) {
    if (_preview) {
        console.warn(`Already previewing.`);
        return;
    }

    var constraints = utils.extendz({}, Constraints[sl_profiles.value || '180P_1'], {
        video: { deviceId: sl_cameras.value },
        audio: { deviceId: sl_microphones.value },
    });
    if (ch_enablevideo.checked === false) {
        utils.extendz(constraints, { video: false });
    }
    if (ch_enableaudio.checked === false) {
        utils.extendz(constraints, { audio: false });
    }
    var screensharing = sl_mode.value > 0;
    var withcamera = sl_mode.value == 2;

    rtc.preview(constraints, screensharing, withcamera).then(function (ns) {
        ns.addEventListener(Event.RELEASE, function (e) {
            var video = e.srcElement.element();
            try {
                view.removeChild(video);
            } catch (err) {
                console.warn(`${err}`);
            }
            _preview = undefined;
        });
        _preview = ns;

        var video = ns.element();
        video.setAttribute('controls', '');
        video.classList[_checked('ch_enablemirror', false) ? 'add' : 'remove']('mirror');
        video.muted = true;
        video.srcObject = ns.stream();
        video.play().catch(function (err) {
            console.warn(`${err}`);
        });
        view.appendChild(video);

        if (_checked('ch_enablevideo', true) && !Kernel.isAppleWebKit) {
            ns.beauty(true, {
                brightness: _value('rg_brightness', 0.5),
                smoothness: _value('rg_smoothness', 1.0),
            });
        }
    }).catch(function (err) {
        console.warn(`${err}`);
    });
}

function onStopPreviewClick(e) {
    if (_preview) {
        _preview.close('stop previewing');
        _preview = undefined;
    }
}

function onPublishClick(e) {
    var constraints = utils.extendz({}, Constraints[sl_profiles.value || '180P_1'], {
        video: { deviceId: sl_cameras.value },
        audio: { deviceId: sl_microphones.value },
    });
    if (ch_enablevideo.checked === false) {
        utils.extendz(constraints, { video: false });
    }
    if (ch_enableaudio.checked === false) {
        utils.extendz(constraints, { audio: false });
    }
    var screensharing = sl_mode.value > 0;
    var withcamera = sl_mode.value == 2;

    if (_preview) {
        return _preview.publish().then(function () {
            _preview = undefined;
        }).catch(function (err) {
            console.warn(`${err}`);
        });
    }

    rtc.publish(constraints, screensharing, withcamera).then(function (ns) {
        ns.addEventListener(Event.RELEASE, function (e) {
            var video = e.srcElement.element();
            try {
                view.removeChild(video);
            } catch (err) {
                console.warn(`${err}`);
            }
        });

        var video = ns.element();
        video.setAttribute('controls', '');
        video.classList[_checked('ch_enablemirror', false) ? 'add' : 'remove']('mirror');
        video.muted = true;
        video.srcObject = ns.stream();
        video.play().catch(function (err) {
            console.warn(`${err}`);
        });
        view.appendChild(video);

        // if (ch_enablevideo.checked && !Kernel.isAppleWebKit) {
        //     ns.beauty(true, {
        //         brightness: rg_brightness.value,
        //         smoothness: rg_smoothness.value,
        //     });
        // }
    }).catch(function (err) {
        console.warn(`${err}`);
    });
}

function onAudioEnableChange(e) {
    utils.forEach(rtc.publishing, function (_, ns) {
        ns.getSenders().forEach((sender) => {
            var track = sender.track;
            if (track && track.kind === 'audio') {
                track.enabled = ch_enableaudio.checked;
            }
        });
    });
}

function onVideoEnableChange(e) {
    utils.forEach(rtc.publishing, function (_, ns) {
        ns.getSenders().forEach((sender) => {
            var track = sender.track;
            if (track && track.kind === 'video') {
                track.enabled = ch_enablevideo.checked;
            }
        });
    });
}

function onMirrorEnableChange(e) {
    utils.forEach(rtc.publishing, function (_, ns) {
        var video = ns.element();
        video.classList[_checked('ch_enablemirror', false) ? 'add' : 'remove']('mirror');
    });
}

function onChangeProfileClick(e) {
    utils.forEach(rtc.publishing, function (_, ns) {
        ns.setProfile(sl_profiles.value);
    });
}

function onChangeCameraClick(e) {
    utils.forEach(rtc.publishing, function (_, ns) {
        ns.setCamera(sl_cameras.value);
    });
}

function onChangeMicrophoneClick(e) {
    utils.forEach(rtc.publishing, function (_, ns) {
        ns.setMicrophone(sl_microphones.value);
    });
}

function onUnpublishClick(e) {
    utils.forEach(rtc.publishing, function (name) {
        rtc.stop(name);
    });
}

function onPlayClick(e) {
    play(in_data.value);
}

function play(name) {
    if (name === '') {
        rtc.logger.warn('Stream id is empty.');
        return;
    }
    rtc.play(name).then(function (ns) {
        ns.addEventListener(NetStatusEvent.NETSTATUS, function (e) {
            switch (e.data.code) {
                case Code.NETSTREAM_PLAY_START:
                    _attachVideo(e.srcElement, e.data.info.streams[0]);
                    break;
            }
        });
        ns.addEventListener(Event.RELEASE, function (e) {
            _detachVideo(e.srcElement.element());
        });
        if (ns.stream()) {
            _attachVideo(ns, ns.stream());
        }
    }).catch(function (err) {
        console.warn(`${err}`);
    });
}

function onStopClick(e) {
    rtc.stop(in_data.value);
}

function onStatus(e) {
    var level = e.data.level;
    var code = e.data.code;
    var description = e.data.description;
    var info = e.data.info;
    var method = { status: 'log', warning: 'warn', error: 'error' }[level];
    rtc.logger[method](`onStatus: level=${level}, code=${code}, description=${description}, info=`, info);

    if (code === Code.NETSTREAM_PUBLISH_START) {
        _setValue('in_data', info.stream);
        _announce(info.stream);
    }
}

function _imError(err) {
    rtc.logger.warn(`IM request failed: ${err}`);
}

function _joinRoom(room) {
    var generation = ++_roomGeneration, previous = _requestedRoom || _joinedRoom;
    _requestedRoom = room;
    _joinedRoom = undefined;
    if (previous && previous !== room) { im.leave(previous).catch(_imError); }
    im.join(room).then(function () {
        if (generation !== _roomGeneration || !_imReady) { return; }
        _joinedRoom = room;
        _setValue('in_nick', im.userId());
        // Relay JOIN has no member snapshot; do not display a fabricated count.
        _setValue('in_online', '—');
        utils.forEach(rtc.publishing, function (_, ns) {
            _announce(ns.getProperty('@id') || ns.getProperty('stream'));
        });
    }).catch(_imError);
}

function _announce(stream) {
    if (!_imReady || !_joinedRoom || typeof stream !== 'string' ||
        !/^[A-Za-z0-9_-]{1,128}$/.test(stream)) {
        return;
    }
    // Example application metadata inside the binary OBJECT extension.
    im.send({ type: 'room', id: _joinedRoom }, stream, { ext: [
        { key: 'application', type: IM.Protocol.Type.STRING, value: 'odd.example.rtc.stream.v1' }
    ] }).catch(_imError);
}

function onMessage(e) {
    var data = e.data;
    if (!_imReady || data.messaging || data.target.type !== 'room' || data.target.id !== _joinedRoom ||
        data.sender.id === im.userId() || !data.ext || data.ext.application !== 'odd.example.rtc.stream.v1' ||
        typeof data.content !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(data.content)) {
        return;
    }
    play(data.content);
}

function onNotify(e) {
    if (e.data.event === IM.Protocol.Event.ROOM_REVOKED && e.data.payload.roomId === _joinedRoom) {
        _joinedRoom = undefined;
        _setValue('in_online', '—');
    }
}

function onClose(e) {
    if (e.srcElement === im) {
        _roomGeneration++;
        _imReady = false;
        _requestedRoom = _joinedRoom = undefined;
        _setValue('in_online', '—');
        im = undefined;
    }
    rtc.logger.log(`onClose: reason=${e.data.reason}`);
}

async function onRecordClick(e) {
    for (var i in rtc.publishing) {
        var ns = rtc.publishing[i];
        // Save locally; live IM forwarding cannot reliably carry a recording.
        _writer = await ns.record('vod.webm');
        _writer.addEventListener(SaverEvent.WRITEREND, onWriterEnd);
        break;
    }
}

function onStopRecordClick(e) {
    if (_writer) { _writer.close(); }
}

function onWriterEnd(e) {
    if (_writer === e.srcElement) { _writer = undefined; }
}

function onBrightnessChange(e) {
    utils.forEach(rtc.publishing, function (_, ns) {
        if (ns.constraints.video && ns.beautyEnabled()) {
            ns.beauty(true, {
                brightness: _value('rg_brightness', 0.5),
            });
        }
    });
}

function onSmoothnessChange(e) {
    utils.forEach(rtc.publishing, function (_, ns) {
        if (ns.constraints.video && ns.beautyEnabled()) {
            ns.beauty(true, {
                smoothness: _value('rg_smoothness', 1.0),
            });
        }
    });
}

function _el(id) {
    return document.getElementById(id);
}

function _value(id, value) {
    var element = _el(id);
    return element ? element.value : value;
}

function _checked(id, value) {
    var element = _el(id);
    return element ? element.checked : value;
}

function _setValue(id, value) {
    var element = _el(id);
    if (element) {
        element.value = value;
    }
}

function _attachVideo(ns, stream) {
    var video = ns.element();
    video.setAttribute('controls', '');
    video.srcObject = stream;

    video.play().catch(function (err) {
        switch (err.name) {
            case 'AbortError':
                rtc.logger.debug(err.name + ': ' + err.message);
                break;
            case 'NotAllowedError':
                if (video.muted == false) {
                    video.muted = true;
                    video.play().catch(function (err) {
                        rtc.logger.warn(`${err}`);
                    });
                    break;
                }
            default:
                rtc.logger.error('Unexpected error occured, ' + err.name + ': ' + err.message);
                break;
        }
    });
    video.controls = false;

    if (video.parentNode !== view) {
        view.appendChild(video);
    }
}

function _detachVideo(video) {
    if (video && video.parentNode) {
        video.parentNode.removeChild(video);
    }
}

// setInterval(function () {
//     utils.forEach(rtc.subscribing, function (_, ns) {
//         console.log(`subscriber[${ns.id()}].volume = ${ns.volume()}`);
//     });
// }, 1000);

