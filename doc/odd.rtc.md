# odd.rtc.js

> [[domain] https://www.oddcancer.com](https://www.oddcancer.com/product/rtc.html)  
> [[source] https://github.com/oddcancer/odd.js](https://github.com/oddcancer/odd.js)  
> QQ群：528109813  
> Skype: live:670292548  
> Email: 670292548@qq.com  

## Roadmap

### Features

- [x] v2.3.01 - Refactor im & rtc into one.  
- [x] v2.3.09 - Compatiable with iOS.  
- [x] v2.3.20 - Configurable codec preferences.  
- [x] v2.3.30 - Fast reconnect.  
- [x] v2.3.36 - Be able to publish multi streams.  
- [x] v2.3.37 - Be able to change camera while publishing.  
- [x] v2.3.38 - Be able to change track constraints.  
- [x] v2.3.41 - Add AudioMeter.  
- [x] v2.3.43 - Add Beauty of brightness and smoothness.  
- [ ] Be able to change microphone while publishing.  
- [x] v2.4.04 - Refactor im & rtc protocol.  

## Solutions

- [x] [WebRTC Conference](https://www.oddcancer.com/solution/rtc/index.html).  

## Configuration

### Properties for API

```js
{
    maxRetries: 0, // maximum number of retries while some types of error occurs. -1 means always
    maxRetryInterval: 30000, // ms.
    profile: '540P_2',
    retryIn: 1000 + Math.random() * 2000, // ms. retrying interval
    url: 'wss://' + location.host + '/rtc/sig',
    options: {
        token: '',
    },
    codecpreferences: [],
    rtcconfiguration: {},
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
| getDevices | logger | Enumerates all devices. |
| getCameras | logger | Enumerates video input devices. |
| getMicrophones | logger | Enumerates audio input devices. |
| getPlaybackDevices | logger | Enumerates audio output devices. |
| getSupportedCodecs | logger | Enumerates supported codecs. |

### API Instance

| Method | Arguments | Description |
| :--- | :--- | :--- |
| setup | config | Setup the SDK with the given configuration. |
| client |  | Returns the NetConnection in use. |
| preview | constraints, screenshare, withcamera, option | Previews the stream with the constraints. |
| publish | constraints, screenshare, withcamera, option | Publishes a stream with the constraints. |
| unpublish |  | Unpublishes all streams. |
| play | name | Plays the specified stream. |
| stop | name | Stop playing the specified stream. |
| destroy | Closes the connection. |

### API of NetStream Instance

| Method | Arguments | Description |
| :--- | :--- | :--- |
| client |  | Returns the NetConnection it belongs to. |
| attach | nc | Attaches the NetConnection. |
| setProperty | key, value | Set a property with the key-value pair. |
| getProperty | key | Returns the property value of the key. |
| applyConstraints | constraints | Applies the constraints for publishing. |
| setCamera | deviceId | Sets or changes the camera device id. |
| setMicrophone | deviceId | Sets or changes the microphone device id. |
| setProfile | profile | Sets or changes the built-in profile. |
| setResolution | width, height | Sets or changes the resolution. |
| setFramerate | fps | Sets or changes the framerate. |
| setBitrate | bitrate | Sets or changes the video bitrate. |
| getUserMedia | constraints | Creates a user MediaStream with the given constraints. |
| getDisplayMedia | constraints | Creates a display MediaStream with the given constraints. |
| addTrack | track, stream | Adds the given track for publishing. |
| replaceTrack | track, stopprevious | Replaces with the given track. |
| removeTrack | sender | Removes the track associated with the given sender. |
| createStream | screenshare, withcamera, option | Creates a MediaStream with the given arguments. |
| preview | screenshare, withcamera, option | Previews the MediaStream with the given arguments. |
| publish |  | Publishes the associated stream. |
| beauty | enable, constraints | Enable/disable beauty plugin. |
| beautyEnabled |  | Returns whether or not the beauty plugin is enabled. |
| play | name, mode | Plays the remote stream of the given name. |
| stop | name | Stops playing the named stream. |
| call | transactionId, args, payload, responder | Calls the remote function. |
| getTransceivers |  | Gets the current transceiver list. |
| getSenders |  | Gets the current sender list. |
| getReceivers |  | Gets the current receiver list. |
| volume |  | Gets the current volume of playing stream. |
| getStats |  | Gets the current stats. |
| state |  | Gets the ready state. |
| release | reason | Sends a release command, and cleans up this NetStream. |
| close | reason | Closes this NetStream. |

## Events

The API supports Event and NetStatusEvent.

### Event

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| READY |  | The ready event occurs when the SDK is ready. |
| CLOSE | reason | The close event occurs when the signaling connection was closed. |

### NetStatusEvent

| Type | Properties | Meaning |
| :--- | :--- | :--- |
| NET_STATUS | level, code, description, info | The netstatus event occurs when a notification reached. |

## License

BSD 3-Clause License ([NOTICE](https://github.com/oddcancer/odd.js/blob/master/NOTICE))
