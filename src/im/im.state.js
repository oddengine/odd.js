(function (odd) {
    var IM = odd.IM,

        State = {
            INITIALIZED: 'initialized',
            CONNECTING: 'connecting',
            CONNECTED: 'connected',
            PUBLISHING: 'publishing',
            PLAYING: 'playing',
            CLOSING: 'closing',
            CLOSED: 'closed',
        };

    IM.State = State;
})(odd);

