var utils = odd.utils,
    Kernel = odd.Kernel,
    events = odd.events,
    Event = events.Event,
    NetStatusEvent = events.NetStatusEvent,
    SaverEvent = events.SaverEvent,
    Level = events.Level,
    Code = events.Code,
    IM = odd.IM,
    Sending = IM && IM.CommandMessage ? IM.CommandMessage.Sending : {},
    Casting = IM && IM.CommandMessage ? IM.CommandMessage.Casting : {},
    RTC = odd.RTC,
    Constraints = RTC.Constraints,

    _self = {},
    _users = {},
    _hasIM = IM && odd.im && IM.CommandMessage,
    _imReady = false,
    _pendingJoin,
    _detected = false,
    _preview,
    _writer;

var im;

function onReady(e) {
    _imReady = true;
    im.logger.log(`onReady: user=${im.client().userId()}`);
    if (_pendingJoin) {
        im.join(_pendingJoin);
        _pendingJoin = undefined;
    }
}

function onJoinClick(e) {
    var room = _value('in_room', '');
    if (_setupIM(room) && _imReady) {
        im.join(room);
    }
}

function onLeaveClick(e) {
    rtc.unpublish();
    rtc.stop();
    if (_imReady) {
        im.leave(_value('in_room', ''));
    }
}

var rtc = odd.rtc.create({ mode: 'feedback', url: 'https://fc.oddengine.com/rtc/log', interval: 60 });
rtc.addEventListener(NetStatusEvent.NET_STATUS, onStatus);
rtc.addEventListener(Event.CLOSE, onClose);
rtc.setup({
    profile: sl_profiles.value || '180P_1',
    whip: location.protocol + '//' + location.host + '/whip/live',
    whep: location.protocol + '//' + location.host + '/whep/live',
    codecpreferences: [
        'audio/opus',
        'video/H264',
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
        _pendingJoin = room;
        return true;
    }

    _pendingJoin = room;
    im = odd.im.create();
    im.addEventListener(Event.READY, onReady);
    im.addEventListener(NetStatusEvent.NET_STATUS, onStatus);
    im.addEventListener(Event.CLOSE, onClose);
    im.setup({
        maxRetries: 0,
        url: 'ws://' + location.host + '/im',
        parameters: {
            token: '',
        },
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
    var screenshare = sl_mode.value > 0;
    var withcamera = sl_mode.value == 2;

    rtc.preview(constraints, screenshare, withcamera).then(function (ns) {
        ns.addEventListener(Event.RELEASE, function (e) {
            var video = e.srcElement.video;
            try {
                view.removeChild(video);
            } catch (err) {
                console.warn(`${err}`);
            }
            _preview = undefined;
        });
        _preview = ns;

        var video = ns.video;
        video.setAttribute('controls', '');
        video.classList[_checked('ch_enablemirror', false) ? 'add' : 'remove']('mirror');
        video.muted = true;
        video.srcObject = ns.stream;
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
        _preview.release('stop previewing');
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
    var screenshare = sl_mode.value > 0;
    var withcamera = sl_mode.value == 2;

    if (_preview) {
        return _preview.publish(screenshare, withcamera).then(function () {
            _preview = undefined;
        }).catch(function (err) {
            console.warn(`${err}`);
        });
    }

    rtc.publish(constraints, screenshare, withcamera).then(function (ns) {
        ns.addEventListener(Event.RELEASE, function (e) {
            var video = e.srcElement.video;
            try {
                view.removeChild(video);
            } catch (err) {
                console.warn(`${err}`);
            }
        });

        var video = ns.video;
        video.setAttribute('controls', '');
        video.classList[_checked('ch_enablemirror', false) ? 'add' : 'remove']('mirror');
        video.muted = true;
        video.srcObject = ns.stream;
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
    utils.forEach(rtc.publishers, function (_, ns) {
        ns.getSenders().forEach((sender) => {
            var track = sender.track;
            if (track && track.kind === 'audio') {
                track.enabled = ch_enableaudio.checked;
            }
        });
    });
}

function onVideoEnableChange(e) {
    utils.forEach(rtc.publishers, function (_, ns) {
        ns.getSenders().forEach((sender) => {
            var track = sender.track;
            if (track && track.kind === 'video') {
                track.enabled = ch_enablevideo.checked;
            }
        });
    });
}

function onMirrorEnableChange(e) {
    utils.forEach(rtc.publishers, function (_, ns) {
        var video = ns.video;
        video.classList[_checked('ch_enablemirror', false) ? 'add' : 'remove']('mirror');
    });
}

function onChangeProfileClick(e) {
    utils.forEach(rtc.publishers, function (_, ns) {
        ns.setProfile(sl_profiles.value);
    });
}

function onChangeCameraClick(e) {
    utils.forEach(rtc.publishers, function (_, ns) {
        ns.setCamera(sl_cameras.value);
    });
}

function onChangeMicrophoneClick(e) {
    utils.forEach(rtc.publishers, function (_, ns) {
        ns.setMicrophone(sl_microphones.value);
    });
}

function onUnpublishClick(e) {
    rtc.unpublish();
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
        ns.addEventListener(NetStatusEvent.NET_STATUS, function (e) {
            switch (e.data.code) {
                case Code.NETSTREAM_PLAY_START:
                    _attachVideo(e.srcElement, e.data.info.streams[0]);
                    break;
            }
        });
        ns.addEventListener(Event.RELEASE, function (e) {
            _detachVideo(e.srcElement.video);
        });
        if (ns.stream) {
            _attachVideo(ns, ns.stream);
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

    switch (code) {
        case Code.NETSTREAM_PUBLISH_START:
            _setValue('in_data', info.stream);
            if (_imReady === false) {
                break;
            }
            im.send(Sending.STREAMING, Casting.MULTI, _value('in_room', ''), {
                stream: info.stream,
            });
            break;
        case Code.NETGROUP_CONNECT_SUCCESS:
            if (_imReady === false) {
                break;
            }
            _self = info.user;
            _setValue('in_nick', info.user.nick);
            utils.forEach(rtc.publishers, function (_, ns) {
                var stream = ns.getProperty('@id') || ns.getProperty('stream');
                if (stream) {
                    im.send(Sending.STREAMING, Casting.MULTI, info.room.id, {
                        stream: stream,
                    });
                }
            });
            break;
        case Code.NETGROUP_LOCALCOVERAGE_NOTIFY:
            if (_imReady === false) {
                break;
            }
            _users = utils.extendz(info.list, _users);
            _setValue('in_online', Object.keys(_users).length);
            break;
        case Code.NETGROUP_NEIGHBOR_CONNECT:
            if (_imReady === false) {
                break;
            }
            _users[info.user.id] = info.user;
            _setValue('in_online', Object.keys(_users).length);

            utils.forEach(rtc.publishers, function (_, ns) {
                var stream = ns.getProperty('@id') || ns.getProperty('stream');
                if (stream) {
                    im.send(Sending.STREAMING, Casting.UNI, info.user.id, {
                        stream: stream,
                    });
                }
            });
            break;
        case Code.NETGROUP_NEIGHBOR_DISCONNECT:
            if (_imReady === false) {
                break;
            }
            delete _users[info.user.id];
            _setValue('in_online', Object.keys(_users).length);
            break;
        case Code.NETGROUP_SENDTO_NOTIFY:
        case Code.NETGROUP_POSTING_NOTIFY:
            if (_imReady === false) {
                break;
            }
            var m = info;
            var args = m.Arguments;
            switch (args.type) {
                case Sending.STREAMING:
                    if (args.user.id !== _self.id) {
                        play(args.data.stream);
                    }
                    break;
            }
            break;
        case Code.NETGROUP_CONNECT_CLOSED:
        case Code.NETCONNECTION_CONNECT_CLOSED:
            _imReady = false;
            _users = {};
            _setValue('in_online', 0);
            break;
    }
}

function onClose(e) {
    _imReady = false;
    rtc.logger.log(`onClose: reason=${e.data.reason}`);
}

async function onRecordClick(e) {
    for (var i in rtc.publishers) {
        var ns = rtc.publishers[i];
        _writer = await ns.record('vod.webm', onDataAvailable);
        _writer.addEventListener(SaverEvent.WRITEREND, onWriterEnd);
        break;
    }
}

function onStopRecordClick(e) {
    _writer.abort();
}

function onDataAvailable(chunk) {
    if (_imReady) {
        im.send(Sending.FILE, '', undefined, { name: _writer.filename }, chunk);
    }
}

function onWriterEnd(e) {
    if (_imReady) {
        im.send(Sending.FILE, '', undefined, { name: _writer.filename, event: 'end' });
    }
}

function onBrightnessChange(e) {
    utils.forEach(rtc.publishers, function (_, ns) {
        if (ns.constraints.video && ns.beautyEnabled()) {
            ns.beauty(true, {
                brightness: _value('rg_brightness', 0.5),
            });
        }
    });
}

function onSmoothnessChange(e) {
    utils.forEach(rtc.publishers, function (_, ns) {
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
    var video = ns.video;
    video.setAttribute('controls', '');
    video.srcObject = stream;
    video.play().catch(function (err) {
        console.warn(`${err}`);
    });
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
//     utils.forEach(rtc.subscribers, function (_, ns) {
//         console.log(`subscriber[${ns.id()}].volume = ${ns.volume()}`);
//     });
// }, 1000);
