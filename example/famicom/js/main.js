var events = odd.events,
    Event = events.Event,
    Famicom = odd.Famicom,
    UI = Famicom.UI,
    ui = odd.famicom.ui.create({ level: 'debug' });

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

function onReady() {
    ui.logger.log('onReady');
    syncLocation();
}

function onError(e) {
    var err = e.data || e;
    ui.logger.error(`onError: name=${err.name}, message=${err.message}`);
}

function syncLocation() {
    var current = new URL(ui.location());
    instance.value = current.searchParams.get('instance') || '';
    player.value = current.searchParams.get('player') || '';
    var ports = ui.ports();
    controllers.value = ports.length || controllers.value;
    history.replaceState(null, '', current.href);
}

function onInitClick() {
    ui.config.base = server.value;
    ui.load(gameName.value, Number(controllers.value)).then(syncLocation).catch(onError);
}

function onJoinClick() {
    var url = `${server.value}/play?game=${gameName.value}&instance=${instance.value}&controllers=${controllers.value}`;
    ui.play(url).then(syncLocation).catch(onError);
}

function onReconnectClick() {
    var url = `${server.value}/play?game=${gameName.value}&instance=${instance.value}&player=${player.value}`;
    ui.play(url).then(syncLocation).catch(onError);
}

function onLeaveClick() {
    ui.stop().then(function () {
        player.value = '';
    }).catch(onError);
}

function onDestroyClick() {
    ui.destroy('example').catch(onError);
}

