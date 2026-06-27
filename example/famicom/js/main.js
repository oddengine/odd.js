var events = odd.events,
    Event = events.Event,
    NetStatusEvent = events.NetStatusEvent,
    Famicom = odd.Famicom,
    UI = Famicom.UI;

var ui = odd.famicom.ui.create({ level: 'debug' });
ui.addEventListener(Event.READY, onReady);
ui.addEventListener(Event.ERROR, onError);
ui.addEventListener(NetStatusEvent.NET_STATUS, onStatus);
ui.setup(game, {
    skin: 'classic',
    controls: false,
    url: server.value,
    joystick: {
        center: 0.0,
        direction: 8,
    },
    plugins: [{
        kind: 'Controlbar',
        layout: '[JoyStick:joystick=]|[Button:select=Select][Button:start=Start]|[Button:b=B][Button:a=A]',
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

function onStartClick(e) {
    ui.config.url = server.value;
    ui.load(gameName.value, msid.value);
}
