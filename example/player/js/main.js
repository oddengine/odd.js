player.innerHTML = '';

var utils = odd.utils,
    events = odd.events,
    Event = events.Event,
    IMEvent = events.IMEvent,

    _api = document.querySelector('meta[name="odd-api"]').content.replace(/\/$/, ''),
    _query = new URLSearchParams(location.search),
    _stream = _query.get('stream'),
    _room = _query.get('room'),
    _account = new AccountClient(_api),
    _session,
    _renewal,
    index = 0;

var im = odd.im.create();
im.addEventListener(Event.READY, onReady);
im.addEventListener(Event.CLOSE, onClose);
im.addEventListener(IMEvent.NOTIFY, function (e) {
    // Only server notifications describe publication state; chat text cannot change the source.
    im.logger.log('Room event:', e.data);
});

var ui = odd.player.ui.create({ mode: 'file' });
// ui.addGlobalListener(console.log);
// ui.addEventListener('ready', onReady);
ui.addEventListener('click', onClick);
// ui.addEventListener('sei', console.log);
ui.addEventListener('screenshot', onScreenshot);
ui.setup(player, {
    autoplay: false,
    credentials: _stream ? _credentials : null,
    timeout: 5000,
    client: im,
    live: {
        bufferLength: 0.5,
        maxBufferLength: 3,
    },
    loader: {
        name: 'auto',
        mode: 'cors',        // cors, no-cors, same-origin
        credentials: 'omit', // omit, include, same-origin
    },
    service: {
        script: 'js/sw.js',
        scope: 'js/',
        enable: false,
    },
    playlist: [_program()],
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
        layout: '[Toggle:playing=off off=播放;on=暂停][Button:reload=重新加载][Button:stop=停止][Label:quote=Live broadcast][Label:time=00:00/00:00]||[Button:report=反馈][Button:capture=截图][Button:download=下载][Toggle:calling=off off=呼叫;on=挂断][Toggle:muted=off off=静音;on=取消静音][Slider:volume=80][Select:definition=清晰度][Toggle:comments=on off=开启弹幕;on=关闭弹幕][Toggle:theater=off off=进入剧院模式;on=退出剧院模式][Toggle:fullscreen=off off=进入全屏;on=退出全屏][Toggle:layout=right right=参会者在右侧;top=参会者在顶部;grid=网格]',
        autohide: false,
        visibility: true,
    }],
});

function _program(file) {
    var cmaf = _query.get('format') === 'cmaf';
    file = file || location.origin + '/live/' + (_stream || '_definst_/abc') + (cmaf ? '.mp4' : '.flv');
    var endpoint = new URL(file, document.baseURI);
    return {
        type: /\.mp4$/.test(endpoint.pathname) ? 'FMP4' : 'FLV',
        vod: false,
        sources: [{
            url: endpoint.href,
            streamId: _stream || undefined,
            label: /\.mp4$/.test(endpoint.pathname) ? 'HTTP-CMAF' : 'HTTP-FLV',
        }],
    };
}

url.value = _program().sources[0].url;
window.addEventListener('beforeunload', function () {
    clearTimeout(_renewal);
    ui.stop();
    im.close();
});

if (_stream && _room) {
    (async function () {
        _session = await _request('/session');
        await _request('/rooms/' + encodeURIComponent(_room) + '/members/me', 'PUT');
        await im.setup({
            url: _session.im.url,
            credentials: function (context) {
                return _request('/session/im-ticket', 'POST', {
                    audience: _session.im.audience,
                    roomId: _room,
                    connectionId: context.connectionId,
                    generation: context.generation,
                });
            },
        });
    })().catch(function (err) { im.logger.error(err.message); });
}

function onReady(e) {
    im.subscribe({ type: 'room', id: _room }).catch(function (err) { im.logger.error(err.message); });
    _scheduleRenewal();
}

function onClose(e) {
    clearTimeout(_renewal);
    im.logger.log('IM closed:', e.data.reason);
}

function _scheduleRenewal() {
    clearTimeout(_renewal);
    _renewal = setTimeout(async function () {
        try {
            var result = await _request('/session/reauth-token', 'POST', { audience: _session.im.audience });
            await im.reauth(result.token);
            _scheduleRenewal();
        } catch (err) {
            im.logger.error(err.message);
            im.close();
        }
    }, Math.max(1000, _session.im.leaseMilliseconds - _session.im.renewBeforeMilliseconds));
}

async function _credentials(context) {
    var account = await _request('/session');
    if (!account.im || !account.im.media) {
        throw new Error('Sign in to an account with media signing enabled.');
    }
    return _request('/streams/' + encodeURIComponent(context.streamId) + '/credentials', 'POST', {
        protocol: context.protocol,
        direction: context.direction,
        connectionId: context.connectionId,
        generation: context.generation,
    });
}

async function _request(path, method, body) {
    var controller = new AbortController(),
        timer = setTimeout(function () { controller.abort(); }, 5000);
    try {
        return await _account.request(path, method, body, controller.signal);
    } finally {
        clearTimeout(timer);
    }
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
    ui.play(_program(url.value));
}

