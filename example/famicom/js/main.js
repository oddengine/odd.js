var events = odd.events,
    Event = events.Event,
    Famicom = odd.Famicom,
    UI = Famicom.UI,
    ui = odd.famicom.ui.create({ level: 'debug' });

var applicationToken = odd.utils.getCookie('token');
if (applicationToken) {
    token.value = applicationToken;
} else {
    onTokenChange();
}

ui.addEventListener(Event.READY, onReady);
ui.addEventListener(Event.ERROR, onError);
ui.setup(game, {
    skin: 'classic',
    base: server.value,
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
        visibility: true,
    }, {
        kind: 'Display',
        visibility: true,
    }],
}).catch(onError);

function onTokenChange() {
    document.cookie = 'token=' + encodeURIComponent(token.value) + '; path=/; SameSite=Lax' +
        (location.protocol === 'https:' ? '; Secure' : '');
}

function onReady() {
    ui.logger.log('onReady');

    var id = new URL(location.href).searchParams.get('instance');
    syncLocation();
    if (id && !instance.value) {
        instance.value = id;
    }
    server.readOnly = true;
}

function onError(e) {
    var err = e.data || e;
    ui.logger.error(`onError: name=${err.name}, message=${err.message}`);
}

function syncLocation() {
    instance.value = ui.instance() || instance.value;
    player.value = ui.player();

    var url = new URL(location.href);
    url.searchParams.set('instance', instance.value);
    history.replaceState(null, '', url.href);
}

function onInitClick() {
    ui.create(gameName.value).then(function (id) {
        if (!id) {
            return;
        }
        instance.value = id;
        return ui.play(id);
    }).then(function (id) {
        if (!id) {
            return;
        }
        syncLocation();
    }).catch(onError);
}

function onJoinClick() {
    ui.play(instance.value).then(function (id) {
        if (!id) {
            return;
        }
        syncLocation();
    }).catch(onError);
}

function onReconnectClick() {
    ui.play(instance.value, player.value).then(function (id) {
        if (!id) {
            return;
        }
        syncLocation();
    }).catch(onError);
}

function onLeaveClick() {
    ui.stop().then(function (stopped) {
        if (!stopped) {
            return;
        }
        player.value = '';
    }).catch(onError);
}

function onDestroyClick() {
    ui.remove(instance.value).then(function (removed) {
        if (!removed) {
            return;
        }
        instance.value = ui.instance();
        syncLocation();
    }).catch(onError);
}
