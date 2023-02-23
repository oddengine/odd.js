# odd.im.js

> [[domain] <https://www.oddcancer.com>](https://www.oddcancer.com/product/im.html)  
> [[source] <https://github.com/oddcancer/odd.js>](https://github.com/oddcancer/odd.js)  
> QQ群：528109813  
> Skype: live:670292548  
> Email: 670292548@qq.com  

## Roadmap

### UI Plugins

- [x] Messages  
- [ ] Contacts  
- [ ] Settings  

### Features

- [x] v2.3.01 - Refactor player, im & rtc into one.  
- [x] v2.3.33 - Resend queued messages after fast reconnecting.  
- [x] v2.4.04 - Refactor im & rtc protocol.  
- [x] v2.4.21 - Reset online user count.  

## Solutions

- [x] [IM](https://www.oddcancer.com/solution/im.html)  

## Example

### Use API directly

```js
var utils = odd.utils,
    events = odd.events,
    NetStatusEvent = events.NetStatusEvent,
    Level = events.Level,
    Code = events.Code;

var api = odd.im();
api.addEventListener(NetStatusEvent.NET_STATUS, onStatus);
api.setup({
    maxRetries: -1,
    url: 'wss://' + location.host + '/im',
    options: {
        token: 'xxx',
    },
}).then(() => {
    api.join('001').catch((err) => {
        api.logger.error(`Failed to join 001: ${err}`);
    });
}).catch((err) => {
    api.logger.error(`Failed to setup: ${err}`);
});

function onStatus(e) {
    var level = e.data.level;
    var code = e.data.code;
    var description = e.data.description;
    var info = e.data.info;
    var method = { status: 'debug', warning: 'warn', error: 'error' }[level] || 'debug';
    api.logger[method](`onStatus: level=${level}, code=${code}, description=${description}, info=`, info);
}
```

### Use the built-in extendible UI framework

```js
var utils = odd.utils,
    events = odd.events,
    NetStatusEvent = events.NetStatusEvent,
    Level = events.Level,
    Code = events.Code;

var ui = odd.im.ui.create({ mode: 'file' });
ui.addEventListener(NetStatusEvent.NET_STATUS, onStatus);
ui.setup(dialog, {
    maxRetries: -1,
    skin: 'classic',
    url: 'wss://' + location.host + '/im',
    options: {
        token: 'xxx',
    },
    plugins: [{
        kind: 'Messages',
        layout: '',
        dialog: {
            title: '[Button:close=][Label:title=][Button:more=]',
            toolbar: '[Select:emojipicker=]',
            label: 'Send',
            maxlength: 500,
        },
        visibility: true,
    }, {
        kind: 'Contacts',
        visibility: true,
    }, {
        kind: 'Settings',
        visibility: true,
    }],
}).then(() => {
    ui.join('001').catch((err) => {
        ui.logger.error(`Failed to join 001: ${err}`);
    });
}).catch((err) => {
    ui.logger.error(`Failed to setup: ${err}`);
});

function onStatus(e) {
    var level = e.data.level;
    var code = e.data.code;
    var description = e.data.description;
    var info = e.data.info;
    var method = { status: 'debug', warning: 'warn', error: 'error' }[level] || 'debug';
    api.logger[method](`onStatus: level=${level}, code=${code}, description=${description}, info=`, info);
}
```

### Add Callback

```js
api.onready = function(e) {
    // do something
};
```

Or:

```js
api.addEventListener('ready', onReady);

function onReady(e) {
    // do something
}
```

## Configuration

### Properties for API

```js
{
    maxRetries: 0, // maximum number of retries while some types of error occurs. -1 means always
    maxRetryInterval: 30000, // ms.
    retryIn: 1000 + Math.random() * 2000, // ms. retrying interval
    url: 'wss://' + location.host + '/im',
    options: {
        token: 'xxx',
    },
}
```

### Extension for UI

```js
{
    skin: 'classic',
    plugins: [{
        kind: 'Messages',
        layout: '',
        dialog: {
            title: '[Button:close=][Label:title=][Button:more=]',
            toolbar: '[Select:emojipicker=]',
            label: 'Send',
            maxlength: 500,
        },
        visibility: true,
    }, {
        kind: 'Contacts',
        visibility: true,
    }, {
        kind: 'Settings',
        visibility: true,
    }],
}
```

### Config of Logger

```js
{
    level: 'log',    // debug, log, warn, error
    mode: 'console', // console, file, feedback
    maxLines: 60,
}
```

## API

### Statics of API

| Method | Arguments | Description |
| :--- | :--- | :--- |
| get | id = 0, nc = undefined, logger = undefined | Gets the API instance by id, create one if it doesn't exist. Logger is the config of Logger. |
| create | nc = undefined, logger = undefined | Creates an API instance with an auto-increased id, or return the one already exist. Logger is the config of Logger. |

### API Instance

| Method | Arguments | Description |
| :--- | :--- | :--- |
| setup | config | Setup the API with the given configuration. |
| client |  | Returns the NetConnection in use. |
| join | rid | Joins the room. |
| leave | rid | Leaves the room. |
| chmod | rid, tid, operator, mask | Manages user permissions. |
| send | type, cast, id, data | Sends typed message to the id. |
| call | transactionId, args, payload, responder | Calls the remote function. |
| state |  | Gets the ready state. |
| close | reason | Closes the connection. |

### Statics of UI

| Method | Arguments | Description |
| :--- | :--- | :--- |
| get | id = 0, logger = undefined | Gets the UI instance by id, create one if it doesn't exist. Logger is the config of Logger. |
| create | logger = undefined | Create an UI instance with an auto-increment id, or return the one already exist. Logger is the config of Logger. |

### API of UI Instance

Note: All of the API methods are also supported by UI.

| Method | Arguments | Description |
| :--- | :--- | :--- |
| setup | container, config | Setup the UI with the given configuration. |
| client |  | Returns the NetConnection in use. |
| resize |  | Resizes the ui container to fit to the parent node. |
| destroy |  | Destroy this instance, removes dom elements. |

### API of NetConnection Instance

| Method | Arguments | Description |
| :--- | :--- | :--- |
| userId |  | Returns the logined user id. |
| setProperty | key, value | Set a property with the key-value pair. |
| getProperty | key | Returns the property value of the key. |
| connect | url, args | Connects to the server. |
| create | ns, responder | Creates a pipe for the NetStream. |
| call | pipe, transactionId, args, payload, responder | Calls the remote function. |
| state |  | Gets the ready state. |
| close | reason | Closes the signaling connection and all NetStreams. |

### API of NetStream Instance

| Method | Arguments | Description |
| :--- | :--- | :--- |
| client |  | Returns the NetConnection it belongs to. |
| attach | nc | Attaches the NetConnection. |
| setProperty | key, value | Set a property with the key-value pair. |
| getProperty | key | Returns the property value of the key. |
| join | rid | Joins the room. |
| leave | rid | Leaves the room. |
| chmod | rid, tid, operator, mask | Manages user permissions. |
| send | type, cast, id, data | Sends typed message to the id. |
| call | transactionId, args, payload, responder | Calls the remote function. |
| state |  | Gets the ready state. |
| release | reason | Sends a release command, and cleans up this NetStream. |
| close | reason | Closes this NetStream. |

## Events

The API supports Event and NetStatusEvent. All of the API events will be forward to UI.

### Event

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| READY |  | The ready event occurs when the SDK is ready. |
| CLOSE | reason | The close event occurs when the connection was closed. |

### NetStatusEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| NET_STATUS | level, code, description, info | The netstatus event occurs when a notification reached. |

### UIEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| RESIZE | width, height | The resize event occurs when the UI is resized. |

### GlobalEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| CHANGE | name, value | The change event occurs when the value of the named target is changed. |

### MouseEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| CLICK | name, value | The click event occurs when the user clicked the named target. |

## License

BSD 3-Clause License ([NOTICE](https://github.com/oddcancer/odd.js/blob/master/NOTICE))
