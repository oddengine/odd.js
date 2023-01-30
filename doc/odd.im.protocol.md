# Odd IM Protocol

## Packet Header

### Fixed Header Fields

```code
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|0 1 2 3 4 5 6 7|8 9 0 1 2 3 4 5|6 7 8 9 0 1 2 3|4 5 6 7 8 9 0 1|
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|F| RSV |   T   |        Sequence Number        |    Pipe ID    |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|    Pipe ID    |
+-+-+-+-+-+-+-+-+
```

### Header Extension

#### Abort Message (0x1)

```code
+-+-+-+-+-+-+-+-+
|0 1 2 3 4 5 6 7|
+-+-+-+-+-+-+-+-+
|       T       |
+-+-+-+-+-+-+-+-+
```

#### ACK Window Size (0x2)

```code
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|0 1 2 3 4 5 6 7|8 9 0 1 2 3 4 5|6 7 8 9 0 1 2 3|4 5 6 7 8 9 0 1|
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                        ACK Window Size                        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

#### ACK (0x3)

```code
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|0 1 2 3 4 5 6 7|8 9 0 1 2 3 4 5|6 7 8 9 0 1 2 3|4 5 6 7 8 9 0 1|
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                              ACK                              |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

#### Command Message (0x4)

```code
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|0 1 2 3 4 5 6 7|8 9 0 1 2 3 4 5|6 7 8 9 0 1 2 3|4 5 6 7 8 9 0 1|
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                           Timestamp                           |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|        Transaction ID         |            Offset             |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                 Arguments ...                 |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
```

## Command Message Arguments

### CONNECT

```json
{
    "name": "connect",
    "device": "",
    "os": "Mac/10.15.6",
    "kernel": "AppleWebKit/605.1.15",
    "browser": "Safari/14.0.3",
    "client": "odd.js/2.4.25",
    "uuid": "",
    "parameters": {
        "token": ""
    }
}
```

### CREATE

```json
{
    "name": "create",
    "kind": "", // messaging, signaling
    "parameters": {

    }
}
```

### SET_PROPERTY

```json
{
    "name": "setProperty",
    "info": {
        "temporary": true,
        "private": false
    }
}
```

### GET_PROPERTY

```json
{
    "name": "getProperty",
    "keys": ["temporary"]
}
```

### STATUS

```json
{
    "name": "status",
    "level": "status", // status, warning, error
    "code": "Connection.Connect.Success",
    "description": "connect success",
    "info": {
        "uuid": "", // UUID of NetConnection, used for fast reconnecting.
        "user": {
            "id": "10000",
            "nick": "Spencer",
            "avatar": ""
        }
    }
}
```

### RELEASE

```json
{
    "name": "release",
    "id": 1,
    "reason": ""
}
```

### JOIN

```json
{
    "name": "join",
    "rid": "001"
}
```

### LEAVE

```json
{
    "name": "leave",
    "rid": "001",
    "reason": ""
}
```

### CHMOD

```json
{
    "name": "chmod",
    "rid": "",
    "tid": "",
    "operator": "", // +, -, =
    "mask": "" // x, w, r
}
```

### SEND

```json
{
    "name": "send",
    "type": "text", // text, file, etc.
    "cast": "uni", // uni, multi
    "id": "10001",
    "data": "hello",
    "user": {
        "id": "10000",
        "nick": "Spencer",
        "avatar": ""
    },
    "room": {
        "id": "001"
    }
}
```

### PLAY

```json
{
    "name": "play",
    "stream": "abc@192.168.1.1/im",
    "mode": "all" // all, audio, video
}
```

### STOP

```json
{
    "name": "stop",
    "stream": "abc@192.168.1.1/im"
}
```

### SDP

```json
{
    "name": "sdp",
    "type": "offer", // offer, answer
    "sdp": ""
}
```

### CANDIDATE

```json
{
    "name": "candidate",
    "candidate": "",
    "sdpMid": "",
    "sdpMLineIndex": 0
}
```
