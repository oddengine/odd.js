var container = document.getElementById('im');
container.innerHTML = '';

var utils = odd.utils,
    events = odd.events,
    Event = events.Event,
    NetStatusEvent = events.NetStatusEvent,
    Code = events.Code;

var users = {};

var ui = odd.im.ui.create({ mode: 'file' });
ui.addEventListener(Event.READY, onReady);
ui.addEventListener(NetStatusEvent.NETSTATUS, onStatus);
ui.addEventListener(Event.CLOSE, onClose);
ui.setup(container, {
    skin: 'classic',
    url: 'wss://' + location.host + '/im',
    // The server authenticates the handshake cookie before upgrading.
    // Configure credentials() when an external one-use ticket is required.
    retry: {
        count: -1,
    },
    plugins: [{
        kind: 'Contacts',
        visibility: true,
    }, {
        kind: 'Conversations',
        visibility: true,
    }, {
        kind: 'Dashboard',
        visibility: true,
    }],
}).then(async () => {
    await ui.join('001').catch((err) => {
        ui.logger.error(`Failed to join: user=${ui.userId()}, room=001, error=${err}`);
    });
    await ui.join('002').catch((err) => {
        ui.logger.error(`Failed to join: user=${ui.userId()}, room=002, error=${err}`);
    });
});


function onReady(e) {
    ui.logger.log(`onReady: user=${ui.userId()}`);
    window.addEventListener('beforeunload', function () {
        ui.leave('001');
        ui.leave('002');
    });
}

function onStatus(e) {
    var level = e.data.level;
    var code = e.data.code;
    var description = e.data.description;
    var info = e.data.info;
    var method = { status: 'log', warning: 'warn', error: 'error' }[level];
    ui.logger[method](`onStatus: user=${ui.userId()}, level=${level}, code=${code}, description=${description}, info=`, info);

    switch (code) {
        case Code.NETGROUP_LOCALCOVERAGE_NOTIFY:
            users = utils.extendz(info.list, users);
            ui.logger.log(`Online: user=${ui.userId()}, count=${Object.keys(users).length}`);
            break;
        case Code.NETGROUP_NEIGHBOR_CONNECT:
            users[info.user.id] = info.user;
            ui.logger.log(`Online: user=${ui.userId()}, count=${Object.keys(users).length}`);
            break;
        case Code.NETGROUP_NEIGHBOR_DISCONNECT:
            delete users[info.user.id];
            ui.logger.log(`Online: user=${ui.userId()}, count=${Object.keys(users).length}`);
            break;
    }
}

function onClose(e) {
    ui.logger.log(`onClose: user=${ui.userId()}, reason=${e.data.reason}`);
}

