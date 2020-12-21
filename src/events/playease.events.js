(function (playease) {
    var events = {},

        Event = {
            BIND: 'bind',
            READY: 'ready',
            PLAY: 'play',
            WAITING: 'waiting',
            DURATIONCHANGE: 'durationchange', // duration
            LOADEDMETADATA: 'loadedmetadata', // metadata
            LOADEDDATA: 'loadeddata',
            CANPLAY: 'canplay',
            PLAYING: 'playing',
            CANPLAYTHROUGH: 'canplaythrough',
            PAUSE: 'pause',                   // timestamp
            SEEKING: 'seeking',               // timestamp
            SEEKED: 'seeked',                 // timestamp
            SWITCHING: 'switching',           // index
            SWITCHED: 'switched',             // index
            RATECHANGE: 'ratechange',         // rate
            TIMEUPDATE: 'timeupdate',         // timestamp, buffered
            VOLUMECHANGE: 'volumechange',     // volume
            ENDED: 'ended',
            ERROR: 'error',                   // name, message
        },

        IOEvent = {
            LOADSTART: 'loadstart',
            PROGRESS: 'progress',   // loaded, total, buffer
            SUSPEND: 'suspend',
            STALLED: 'stalled',
            ABORT: 'abort',
            TIMEOUT: 'timeout',
            LOAD: 'load',
            LOADEND: 'loadend',
        },

        MediaEvent = {
            PACKET: 'packet',                           // packet
            INFOCHANGE: 'infochange',                   // info
            STATSUPDATE: 'statsupdate',                 // stats
            AAC_SPECIFIC_CONFIG: 'aac-specific-config', // packet
            AAC_SAMPLE: 'aac-sample',                   // packet
            AVC_CONFIG_RECORD: 'avc-config-record',     // packet
            AVC_SAMPLE: 'avc-sample',                   // packet
            END_OF_STREAM: 'end-of-stream',             // packet
            SCREENSHOT: 'screenshot',                   // image
        },

        MediaStreamTrackEvent = {
            ADDTRACK: 'addtrack',       // track
            REMOVETRACK: 'removetrack', // track
        },

        SaverEvent = {
            RIGISTER: 'register',
            UNRIGISTER: 'unregister',
            WRITERSTART: 'writerstart', // writer
            WRITEREND: 'writerend',     // writer
        },

        UIEvent = {
            SHOOTING: 'shooting',     // text, data
            FULLPAGE: 'fullpage',     // status
            FULLSCREEN: 'fullscreen', // status
            RESIZE: 'resize',         // width, height
        },

        GlobalEvent = {
            CHANGE: 'change',                     // name, value
            VISIBILITYCHANGE: 'visibilitychange', // name, state=visible;hidden
        },

        // alt, control, shift, command
        MouseEvent = {
            CLICK: 'click',              // name
            DOUBLE_CLICK: 'doubleclick', // name
            MOUSE_MOVE: 'mousemove',     // name, value
        },

        KeyboardEvent = {
            KEY_DOWN: 'keydown', // code, alt, control, shift, command
            KEY_UP: 'keyup',     // code, alt, control, shift, command
        },

        TimerEvent = {
            TIMER: 'timer',
            COMPLETE: 'complete',
        };

    events.Event = Event;
    events.IOEvent = IOEvent;
    events.MediaEvent = MediaEvent;
    events.MediaStreamTrackEvent = MediaStreamTrackEvent;
    events.SaverEvent = SaverEvent;
    events.UIEvent = UIEvent;
    events.GlobalEvent = GlobalEvent;
    events.MouseEvent = MouseEvent;
    events.KeyboardEvent = KeyboardEvent;
    events.TimerEvent = TimerEvent;
    playease.events = events;
})(playease);

