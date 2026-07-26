var events = odd.events,
    Event = events.Event,
    NetStatusEvent = events.NetStatusEvent,
    Famicom = odd.Famicom,
    UI = Famicom.UI;

var ui = odd.famicom.ui.create({ level: 'debug' });
var params = new URLSearchParams(location.search);

ui.addEventListener(Event.READY, onReady);
ui.addEventListener(Event.ERROR, onError);
ui.addEventListener(NetStatusEvent.NET_STATUS, onStatus);
ui.setup(game, {
    skin: 'classic',
    controls: false,
    url: server.value,
    instance: params.get('instance') || '',
    playerSlot: params.get('slot') || '0',
    loader: {
        mode: 'cors',
        credentials: 'omit',
    },
    joystick: {
        center: 0.0,
        direction: 8,
    },
    plugins: [{
        kind: 'Controlbar',
        layout: '[Button:select=Select][Button:start=Start][JoyStick:joystick=]||[Button:b=B][Button:a=A]',
        visibility: true,
    }, {
        kind: 'Display',
        layout: '[Button:mute=][Button:unmute=][Button:share=Share][Button:fullscreen=][Button:exitfullscreen=]',
        open: false,
        autohide: false,
        visibility: true,
    }],
});

function onReady(e) {
    ui.logger.log('onReady');
}

function onError(e) {
    ui.logger.error(`onError: name=${e.data.name}, message=${e.data.message}`);
}

function onStatus(e) {
    ui.logger.log(`onStatus: code=${e.data.code}, description=${e.data.description}`);
}

function syncInstance() {
    instance.value = ui.config.instance || '';
    var url = new URL(window.location.href);
    if (ui.config.instance) {
        url.searchParams.set('instance', ui.config.instance);
    } else {
        url.searchParams.delete('instance');
    }
    url.searchParams.delete('player');
    url.searchParams.set('slot', ui.config.playerSlot || '0');
    history.replaceState(null, '', url.toString());
    syncPlayer();
}

function syncPlayer() {
    var player = ui.config.playerSlot || '0';
    for (var i = 0; i < 4; i++) {
        var item = document.getElementById('player' + i);
        item.setAttribute('data-active', String(i) === player);
    }
}

function onPlayerClick(index) {
    ui.selectPlayer(index);
    syncInstance();
}

function onInitClick(e) {
    ui.config.url = server.value;
    ui.init(gameName.value).then(syncInstance).catch(onActionError);
}

function onJoinClick(e) {
    ui.config.url = server.value;
    ui.join(instance.value).then(syncInstance).catch(onActionError);
}

function onLeaveClick(e) {
    ui.leave().then(syncInstance).catch(onActionError);
}

function onDestroyClick(e) {
    ui.destroyGame().then(syncInstance).catch(onActionError);
}

instance.value = ui.config.instance || '';
syncPlayer();

function onActionError(err) {
    ui.logger.error(`Action failed: name=${err.name || 'Error'}, message=${err.message || err}`);
}
