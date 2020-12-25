player.innerHTML = '';

var utils = playease.utils,
    index = 0;

var ui = playease.ui();
// ui.addGlobalListener(console.log);
ui.addEventListener('ready', onReady);
ui.addEventListener('click', onClick);
// ui.addEventListener('sei', console.log);
ui.addEventListener('screenshot', onScreenshot);
ui.addEventListener('error', console.error);
ui.setup(player, {
    autoplay: false,
    bufferLength: 0.5,       // sec.
    // file: 'http://192.168.100.101/vod/sample.mp4',
    file: 'http://127.0.0.1/vod/sample.flv',
    // file: 'http://127.0.0.1/vod/abc.flv',
    // file: 'http://127.0.0.1/vod/video-only.flv',
    // file: 'http://192.168.100.101/live/_definst_/stream02.flv',
    // file: 'http://192.168.100.101/live/_definst_/stream02/video.m3u8',
    // file: 'http://39.98.40.193/live/_definst_/stream02.flv',
    // file: 'http://120.76.235.109:4025/flv?port=10077&app=live&stream=13800000002_channel_1',
    // file: 'http://120.76.235.109:4025/flv?port=10077&app=live&stream=13751093611_channel_2',
    // file: 'ws://120.79.67.102:4022/ws?port=10077&app=live&stream=64921778277_channel_1',
    lowlatency: true,        // ll-dash, ll-hls, ll-flv/fmp4 (auto reduce latency due to cumulative ack of tcp)
    maxBufferLength: 1.5,    // sec.
    maxRetries: 0,           // maximum number of retries while some types of error occurs. -1 means always
    mode: 'live',            // live, vod
    module: 'FLV',
    objectfit: 'contain',    // fill, contain, cover, none, scale-down
    retrying: 0,             // ms. retrying interval
    loader: {
        name: 'auto',
        mode: 'cors',        // cors, no-cors, same-origin
        credentials: 'omit', // omit, include, same-origin
    },
    service: {
        script: 'js/sw.js',
        scope: 'js/',
        enable: true,
    },
    sources: [{
        file: 'http://39.98.40.193/live/_definst_/stream02/index.m3u8',
        label: 'hls',
    }, {
        file: 'http://39.98.40.193/live/_definst_/stream02.flv',
        label: 'http-flv',
        default: true,
    }],
    plugins: [{
        kind: 'Poster',
        file: 'image/poster.png',
        cors: 'anonymous',    // anonymous, use-credentials
        objectfit: 'contain', // fill, contain, cover, none, scale-down
        visibility: true,
    }, {
        kind: 'Display',
        layout: '[Button:play=][Button:waiting=][Label:error=][Panel:info=][Panel:stats=]',
        ondoubleclick: 'fullscreen',
        visibility: true,
    }, {
        kind: 'Controlbar',
        layout: '[Slider:timebar=Preview]|[Button:play=播放][Button:pause=暂停][Button:reload=重新加载][Button:stop=停止][Label:quote=Live broadcast][Label:time=00:00/00:00]||[Button:report=反馈][Button:capture=截图][Button:download=下载][Button:mute=静音][Button:unmute=取消静音][Slider:volumebar=80][Select:definition=清晰度][Button:danmuoff=关闭弹幕][Button:danmuon=打开弹幕][Button:fullpage=网页全屏][Button:exitfullpage=退出网页全屏][Button:fullscreen=全屏][Button:exitfullscreen=退出全屏]',
        autohide: false,
        visibility: true,
    }],
});

function onReady(e) {
    // ui.record('fragmented.mp4');
}

function onClick(e) {
    switch (e.data.name) {
        case 'report':
            if (playease.LOGGER) {
                utils.logger.save();
            }
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
