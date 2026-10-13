(function (odd) {
    var IM = odd.IM,

        Opcode = {
            STATUS: 0x01,
            NOTIFY: 0x02,
            AUTHENTICATE: 0x03,
            REFRESH: 0x04,
            SUBSCRIBE: 0x10,
            UNSUBSCRIBE: 0x11,
            PUBLISH: 0x20,
            COMMIT: 0x21,
            READ: 0x22,
            INSPECT: 0x23,
            FETCH: 0x24,
            SYNC: 0x30,
            RESOLVE: 0x40,
            LIST: 0x41,
            PRESENCE: 0x50,
            CALL: 0x60,
            BIND: 0x80,
            UNBIND: 0x81,
            INTEREST: 0x82,
            FORWARD: 0x83,
            APPLY: 0x84,
            SNAPSHOT: 0x85,
        },

        Type = {
            NULL: 0x00,
            BOOL: 0x01,
            UINT8: 0x02,
            UINT16: 0x03,
            UINT32: 0x04,
            UINT64: 0x05,
            INT64: 0x06,
            FLOAT64: 0x07,
            STRING: 0x08,
            BYTES: 0x09,
            OBJECT: 0x0A,
            ARRAY: 0x0B
        },

        Status = {
            OK: 0x00,
            INVALID: 0x01,
            UNSUPPORTED: 0x02,
            UNAUTHENTICATED: 0x10,
            FORBIDDEN: 0x11,
            EXPIRED: 0x12,
            NOT_FOUND: 0x20,
            CLOSED: 0x21,
            NOT_READY: 0x22,
            CONFLICT: 0x23,
            TOO_LARGE: 0x30,
            EXHAUSTED: 0x31,
            RATE_LIMITED: 0x32,
            UNAVAILABLE: 0x40,
            TIMEOUT: 0x41,
            UNKNOWN: 0x42,
            GONE: 0x43,
            INTERNAL: 0xF0,
        },

        Event = {
            STREAM_PUBLISH_START: 0x1001,
            STREAM_PUBLISH_STOP: 0x1002,
            STREAM_PUBLISH_FAILED: 0x1003,
            STREAM_PLAY_START: 0x1101,
            STREAM_PLAY_STOP: 0x1102,
            STREAM_PLAY_FAILED: 0x1103,
            IM_CONNECT_SUCCESS: 0x2001,
            IM_CONNECT_FAILED: 0x2002,
            IM_CONNECT_CLOSED: 0x2003,
            IM_AUTHENTICATE_EXPIRING: 0x2101,
            IM_AUTHENTICATE_REVOKED: 0x2102,
            IM_PERMISSION_CHANGE: 0x2201,
            IM_SUBSCRIBE_SUCCESS: 0x2301,
            IM_SUBSCRIBE_FAILED: 0x2302,
            IM_SUBSCRIBE_STOP: 0x2303,
            IM_PUBLISH_SUCCESS: 0x2401,
            IM_PUBLISH_FAILED: 0x2402,
            IM_MESSAGE_RECEIVE: 0x2501,
            IM_DELIVERY_CHANGE: 0x2601,
            IM_SYNC_REQUIRED: 0x2701,
            IM_CONVERSATION_CHANGE: 0x2801,
            IM_PRESENCE_CHANGE: 0x2901,
            IM_CALL_CHANGE: 0x2A01,
        };

    function Protocol(opcode, sequenceNumber, messaging) {
        var _this = this;

        function _init() {
            _this.opcode = opcode;
            _this.sequenceNumber = sequenceNumber || 0;
            _this.messaging = messaging === true;
            _this.fields = [];
        }

        _init();
    }

    Protocol.prototype.kind = 'Protocol';
    Protocol.VERSION = 3;
    Protocol.HEADER_SIZE = 5;
    Protocol.MAX_PACKET_SIZE = 65536;
    Protocol.MAX_PEER_PACKET_SIZE = 131072;
    Protocol.MAX_FIELDS = 256;
    Protocol.MAX_DEPTH = 8;
    Protocol.Type = Type;
    Protocol.Opcode = Opcode;
    Protocol.Status = Status;
    Protocol.Event = Event;
    Protocol.Action = {
        MESSAGE_SUBSCRIBE: 1,
        MESSAGE_PUBLISH: 2,
        PRESENCE_READ: 4,
        MEDIA_PLAY: 8,
        MEDIA_PUBLISH_AUDIO: 16,
        MEDIA_PUBLISH_VIDEO: 32,
        MEDIA_PUBLISH_SCREEN: 64,
        CALL: 128,
        MESSAGE_COMMIT: 256,
        MESSAGE_READ: 512,
    };
    Protocol.CallReason = {
        NONE: 0,
        DECLINED: 1,
        BUSY: 2,
        EXPIRED: 3,
        CANCELLED: 4,
        ANSWERED_ELSEWHERE: 5,
        HANGUP: 6,
        MEDIA_FAILED: 7,
        PEER_LOST: 8,
    };
    IM.Protocol = Protocol;
})(odd);

