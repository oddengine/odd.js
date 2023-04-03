player.innerHTML = '';

var utils = odd.utils,
    events = odd.events,
    Event = events.Event,
    NetStatusEvent = events.NetStatusEvent,
    Level = events.Level,
    Code = events.Code,
    IM = odd.IM,
    Sending = IM.CommandMessage.Sending,
    Casting = IM.CommandMessage.Casting,

    index = 0;

var im = odd.im.create();
im.addEventListener(Event.READY, onReady);
im.addEventListener(NetStatusEvent.NET_STATUS, onStatus);
im.addEventListener(Event.CLOSE, onClose);
im.setup({
    maxRetries: 0,
    url: 'wss://' + location.host + '/im',
    parameters: {
        token: '',
    },
}).then(() => {
    im.join('001').catch((err) => {
        im.logger.error(`Failed to join 001: ${err}`);
    });
});

var ui = odd.player.ui.create({ mode: 'file' });
// ui.addGlobalListener(console.log);
// ui.addEventListener('ready', onReady);
ui.addEventListener('click', onClick);
// ui.addEventListener('sei', console.log);
ui.addEventListener('screenshot', onScreenshot);
ui.setup(player, {
    autoplay: false,
    bufferLength: 0.5,       // sec.
    client: im.client(),
    // file: 'http://127.0.0.1/vod/sample.mp4',
    // file: 'http://127.0.0.1/vod/sample.flv',
    // file: 'ws://192.168.0.117/live/_definst_/abc.flv',
    // file: 'http://192.168.0.117/live/_definst_/abc/index.m3u8',
    // file: 'http://stream.xthktech.cn:8081/live/_definst_/abc.flv',
    // file: 'https://oddengine.com/live/_definst_/abc.flv',
    lowlatency: true,        // ll-dash, ll-hls, ll-flv/fmp4 (auto reduce latency due to cumulative ack of tcp)
    maxBufferLength: 1.5,    // sec.
    maxRetries: 0,           // maximum number of retries while some types of error occurs. -1 means always
    mode: 'auto',            // auto, live, vod
    module: 'FLV',           // SRC, FLV, FMP4, DASH*, HLS*, RTC
    objectfit: 'contain',    // fill, contain, cover, none, scale-down
    retrying: 0,             // ms. retrying interval
    loader: {
        name: 'auto',
        mode: 'cors',        // cors, no-cors, same-origin
        credentials: 'omit', // omit, include, same-origin
    },
    rtc: {
        codecpreferences: [
            'audio/opus',
            'video/VP8',
        ],
    },
    service: {
        script: 'js/sw.js',
        scope: 'js/',
        enable: true,
    },
    sources: [{
        file: 'https://oddengine.com/live/_definst_/abc.flv',
        module: 'FLV',
        label: 'http-flv',
        default: true,
    }, {
        file: 'wss://oddengine.com/live/_definst_/abc',
        module: 'FMP4',
        label: 'ws-fmp4',
    }, {
        file: 'rtc://oddengine.com/im?name=abc',
        module: 'RTC',
        label: 'rtc',
    }, {
        file: 'https://oddengine.com/live/_definst_/abc/index.m3u8',
        module: 'SRC',
        label: 'hls',
    }],
    plugins: [{
        kind: 'Poster',
        file: 'image/solution-vod-poster.png',
        cors: 'anonymous',    // anonymous, use-credentials
        objectfit: 'contain', // fill, contain, cover, none, scale-down
        visibility: true,
    }, {
        kind: 'Chat',
        visibility: true,
    }, {
        kind: 'Display',
        layout: '[Button:play=][Button:waiting=][Label:error=][Panel:info=][Panel:stats=][Settings:settings=]',
        ondoubleclick: 'fullscreen',
        visibility: true,
    }, {
        kind: 'Controlbar',
        layout: '[Slider:timebar=Preview]|[Button:play=播放][Button:pause=暂停][Button:reload=重新加载][Button:stop=停止][Label:quote=Live broadcast][Label:time=00:00/00:00]||[Button:report=反馈][Button:capture=截图][Button:download=下载][Button:dial=连麦][Button:hangup=断开连麦][Button:mute=静音][Button:unmute=取消静音][Slider:volumebar=80][Select:definition=清晰度][Button:danmuoff=关闭弹幕][Button:danmuon=打开弹幕][Button:fullpage=网页全屏][Button:exitfullpage=退出网页全屏][Button:fullscreen=全屏][Button:exitfullscreen=退出全屏]',
        autohide: false,
        visibility: true,
    }],
});

function onReady(e) {
    im.logger.log('onReady');
    window.addEventListener('beforeunload', function (e) {
        ui.stop();
        im.leave('001');
    });
    // ui.record('fragmented.mp4').then((writer) => {
    //     setTimeout(function () {
    //         writer.close();
    //     }, 10 * 000);
    // });
}

function onStatus(e) {
    var level = e.data.level;
    var code = e.data.code;
    var description = e.data.description;
    var info = e.data.info;
    var method = { status: 'log', warning: 'warn', error: 'error' }[level];
    im.logger[method](`onStatus: level=${level}, code=${code}, description=${description}, info=`, info);

    switch (code) {
        case Code.NETGROUP_SENDTO_NOTIFY:
        case Code.NETGROUP_POSTING_NOTIFY:
            var m = info;
            var args = m.Arguments;
            switch (args.type) {
                case Sending.STREAMING:
                    for (var i = 0; i < ui.config.sources.length; i++) {
                        var item = ui.config.sources[i];
                        if (item.file.match(/^rtc:\/\//)) {
                            item.file = item.file.split('?')[0] + `?name=${args.data.stream}`;
                            break;
                        }
                    }
                    break;
            }
            break;
    }
}

function onClose(e) {
    im.logger.log(`onClose: ${e.data.reason}`);
}

function onClick(e) {
    switch (e.data.name) {
        case 'report':
            ui.logger.flush();
            break;
    }
}

function onScreenshot(e) {
    var arr = e.data.image.split(',');
    var ret = arr[0].match(/^data:(image\/(.+));base64$/);
    if (ret === null) {
        console.error('The string did not match the expected pattern.');
        return;
    }

    var link = document.createElement('a');
    link.href = e.data.image;
    link.download = 'screenshot-' + utils.padStart(index++, 3, '0') + '.' + ret[2];
    link.click();
}

function onPlayClick() {
    ui.play(url.value);
}
