emulator.innerHTML = '';

var utils = odd.utils,
    events = odd.events,
    Event = events.Event,
    NES = odd.NES,
    UI = NES.UI,
    components = UI.components,
    JoyStick = components.JoyStick;

var ui = odd.nes.ui.create({ mode: 'file' });
ui.addEventListener(Event.READY, onReady);
ui.addEventListener(Event.ERROR, onError);
ui.setup(emulator, {
    emulateSound: false,
    frameRate: 60,
    sampleRate: 44100,
    skin: 'classic',
    joystick: {
        center: 0.0,
        direction: 8,
    },
    plugins: [{
        kind: 'Controlbar',
        layout: '[JoyStick:joystick=]|[Button:mute=Mute][Button:unmute=Unmute]|[Button:select=Select][Button:start=Start][Button:b=B][Button:a=A]',
        visibility: true,
    }],
});

function onReady(e) {
    ui.logger.log('onReady');
}

function onError(e) {
    ui.logger.log(`onError: name=${e.data.name}, message=${e.data.message}`);
}

function onLoadClick(e) {
    ui.load(url.value);
}

onLoadClick();
