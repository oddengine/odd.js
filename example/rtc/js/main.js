var utils = odd.utils,
    Kernel = odd.Kernel,
    events = odd.events,
    Event = events.Event,
    NetStatusEvent = events.NetStatusEvent,
    Level = events.Level,
    Code = events.Code,
    IM = odd.IM,
    Sending = IM.CommandMessage.Sending,
    Casting = IM.CommandMessage.Casting,
    RTC = odd.RTC,
    Constraints = RTC.Constraints,

    _self = {},
    _detected = false,
    _preview;

var im = odd.im.create();
im.addEventListener(Event.READY, onReady);
im.addEventListener(NetStatusEvent.NET_STATUS, onStatus);
im.addEventListener(Event.CLOSE, onClose);
im.setup({
    maxRetries: -1,
    retryIn: 3000,
    url: 'wss://' + location.host + '/im',
    options: {
        token: 'xxx',
    },
});

function onReady(e) {
    im.logger.log('onReady');
}

function onJoinClick(e) {
    im.join(in_room.value);
}

function onLeaveClick(e) {
    rtc.unpublish();
    rtc.stop();
    im.leave(in_room.value);
}

var rtc = odd.rtc.create(im.client(), { mode: 'feedback', url: 'https://fc.oddcancer.com/rtc/log', interval: 60 });
rtc.addEventListener(NetStatusEvent.NET_STATUS, onStatus);
rtc.addEventListener(Event.CLOSE, onClose);
rtc.setup({
    maxRetries: -1,
    profile: sl_profiles.value || '180P_1',
    retryIn: 2000,
    url: 'wss://' + location.host + '/im',
    codecpreferences: [
        'audio/opus',
        'video/VP8',
    ],
    options: {
        token: 'xxx',
    },
});

(async function () {
    getProfiles();
    await getDevices();
})();

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
            view.removeChild(video);
        });
        _preview = ns;

        var video = ns.video;
        video.muted = true;
        video.srcObject = ns.stream;
        video.play().catch(function (err) {
            console.warn(`${err}`);
        });
        view.appendChild(video);

        if (ch_enablevideo.checked && !Kernel.isAppleWebKit) {
            ns.beauty(true, {
                brightness: rg_brightness.value,
                smoothness: rg_smoothness.value,
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
            view.removeChild(video);
        });

        var video = ns.video;
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
    rtc.play(name).then(function (ns) {
        ns.addEventListener(NetStatusEvent.NET_STATUS, function (e) {
            switch (e.data.code) {
                case Code.NETSTREAM_PLAY_START:
                    var video = e.srcElement.video;
                    video.srcObject = e.data.info.streams[0];
                    video.play().catch(function (err) {
                        console.warn(`${err}`);
                    });
                    view.appendChild(video);
                    break;
            }
        });
        ns.addEventListener(Event.RELEASE, function (e) {
            var video = e.srcElement.video;
            view.removeChild(video);
        });
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
        case Code.NETGROUP_CONNECT_SUCCESS:
            _self = info.user;
            in_nick.value = info.user.nick;
            break;
        case Code.NETGROUP_NEIGHBOR_CONNECT:
            utils.forEach(rtc.publishers, function (_, ns) {
                var stream = ns.getProperty('stream');
                if (stream) {
                    im.send('publishing', Casting.UNI, info.user.id, {
                        stream: stream,
                    });
                }
            });
            break;
        case Code.NETGROUP_SENDTO_NOTIFY:
        case Code.NETGROUP_POSTING_NOTIFY:
            var m = info;
            var args = m.Arguments;
            switch (args.type) {
                case 'publishing':
                    if (args.user.id !== _self.id) {
                        play(args.data.stream);
                    }
                    break;
            }
            break;
        case Code.NETSTREAM_PUBLISH_START:
            var ns = e.srcElement;
            ns.setProperty('stream', info.stream);
            im.send('publishing', Casting.MULTI, in_room.value, {
                stream: info.stream,
            });
            break;
    }
}

function onClose(e) {
    rtc.logger.log(`onClose: ${e.data.reason}`);
}

function onBrightnessChange(e) {
    utils.forEach(rtc.publishers, function (_, ns) {
        if (ns.constraints.video && ns.beautyEnabled()) {
            ns.beauty(true, {
                brightness: rg_brightness.value,
            });
        }
    });
}

function onSmoothnessChange(e) {
    utils.forEach(rtc.publishers, function (_, ns) {
        if (ns.constraints.video && ns.beautyEnabled()) {
            ns.beauty(true, {
                smoothness: rg_smoothness.value,
            });
        }
    });
}

// setInterval(function () {
//     utils.forEach(rtc.subscribers, function (_, ns) {
//         console.log(`subscriber[${ns.id()}].volume = ${ns.volume()}`);
//     });
// }, 1000);
