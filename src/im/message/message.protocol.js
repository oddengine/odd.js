(function (odd) {
    var IM = odd.IM,

        Opcode = {
            STATUS: 0x01,
            NOTIFY: 0x02,
            REAUTH: 0x03,
            CAPS: 0x04,
            PERMISSION_REFRESH: 0x05,
            ROOM_JOIN: 0x10,
            ROOM_LEAVE: 0x11,
            CONVERSATION_WATCH: 0x12,
            CONVERSATION_UNWATCH: 0x13,
            ROOM_MESSAGE: 0x20,
            GROUP_MESSAGE: 0x21,
            USER_MESSAGE: 0x22,
            ENDPOINT_MESSAGE: 0x23,
            RECEIVED: 0x24,
            READ: 0x25,
            STATUS_GET: 0x26,
            MESSAGE_GET: 0x27,
            SYNC: 0x30,
            SYNC_COMMIT: 0x31,
            HISTORY: 0x32,
            CONVERSATION_RESOLVE: 0x40,
            CONVERSATION_LIST: 0x41,
            ONLINE_QUERY: 0x50,
            ONLINE_WATCH: 0x51,
            ONLINE_UNWATCH: 0x52,
            CALL_INVITE: 0x60,
            CALL_RINGING: 0x61,
            CALL_ACCEPT: 0x62,
            CALL_REJECT: 0x63,
            CALL_SELECT: 0x64,
            CALL_CANCEL: 0x65,
            CALL_END: 0x66,
            LIKE: 0x70,
            REACTION: 0x71,
            ROOM_EFFECT: 0x72,
            GIFT_CONFIRMED: 0x78,
            GIFT_COMBO_UPDATE: 0x79,
            GIFT_COMBO_END: 0x7A,
            INTEREST: 0x80,
            PUBLISH: 0x81,
            FORWARD: 0x82,
            REVOKE: 0x83,
            SNAPSHOT_BEGIN: 0x84,
            SNAPSHOT_BATCH: 0x85,
            SNAPSHOT_END: 0x86
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
            BAD_REQUEST: 0x01,
            INVALID_FIELD: 0x02,
            REQUIRED_FIELD_MISSING: 0x03,
            KEY_ORDER_INVALID: 0x04,
            VERSION_UNSUPPORTED: 0x05,
            MODE_UNSUPPORTED: 0x06,
            OPCODE_UNSUPPORTED: 0x07,
            VALUE_TYPE_UNSUPPORTED: 0x08,
            DUPLICATE_KEY: 0x09,
            UNSUPPORTED: 0x0F,
            UNAUTHENTICATED: 0x10,
            FORBIDDEN: 0x11,
            AUTH_EXPIRED: 0x12,
            NOT_FOUND: 0x20,
            CONTEXT_CLOSED: 0x21,
            NOT_SUBSCRIBED: 0x22,
            SUBSCRIPTION_EXPIRED: 0x23,
            INVALID_STATE: 0x24,
            CONFLICT: 0x25,
            VERSION_CONFLICT: 0x26,
            PAYLOAD_TOO_LARGE: 0x30,
            RESOURCE_EXHAUSTED: 0x31,
            RATE_LIMITED: 0x32,
            NO_ONLINE_TARGET: 0x40,
            TARGET_UNAVAILABLE: 0x41,
            MESSAGE_EXPIRED: 0x42,
            STORAGE_UNAVAILABLE: 0x50,
            STORAGE_FAILED: 0x51,
            RESULT_UNKNOWN: 0x52,
            IDEMPOTENCY_CONFLICT: 0x53,
            CURSOR_INVALID: 0x60,
            CURSOR_EXPIRED: 0x61,
            HISTORY_UNAVAILABLE: 0x62,
            INTERACTION_UNSUPPORTED: 0x80,
            GIFT_PROOF_INVALID: 0x81,
            GIFT_CONTEXT_MISMATCH: 0x82,
            EVENT_CONFLICT: 0x83,
            ROUTE_EPOCH_STALE: 0x90,
            PEER_NOT_ALLOWED: 0x91,
            HOP_LIMIT_EXCEEDED: 0x92,
            ROUTE_UNAVAILABLE: 0x93,
            DEPENDENCY_UNAVAILABLE: 0xA0,
            AUTHORITY_RESPONSE_INVALID: 0xA1,
            INTERNAL_ERROR: 0xF0,
            DEADLINE_EXCEEDED: 0xF1
        },

        Event = {
            SESSION_READY: 0x0001,
            AUTH_EXPIRING: 0x0002,
            SESSION_REVOKED: 0x0003,
            PERMISSIONS_CHANGED: 0x0004,
            ROOM_REVOKED: 0x0101,
            ACCESS_REVOKED: 0x0102,
            ROOM_MESSAGE: 0x0201,
            GROUP_MESSAGE: 0x0202,
            USER_MESSAGE: 0x0203,
            ENDPOINT_MESSAGE: 0x0204,
            STATUS_CHANGED: 0x0205,
            SYNC_REQUIRED: 0x0301,
            CONVERSATION_CHANGED: 0x0401,
            ONLINE_CHANGED: 0x0501,
            CALL_INVITE: 0x0601,
            CALL_RINGING: 0x0602,
            CALL_ACCEPT: 0x0603,
            CALL_REJECT: 0x0604,
            CALL_SELECT: 0x0605,
            CALL_CANCEL: 0x0606,
            CALL_END: 0x0607,
            LIKE: 0x0701,
            REACTION: 0x0702,
            ROOM_EFFECT: 0x0703,
            GIFT_CONFIRMED: 0x0801,
            GIFT_COMBO_UPDATE: 0x0802,
            GIFT_COMBO_END: 0x0803
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
    Protocol.VERSION = 2;
    Protocol.HEADER_SIZE = 5;
    Protocol.MAX_PACKET_SIZE = 65536;
    Protocol.MAX_PEER_PACKET_SIZE = 131072;
    Protocol.MAX_FIELDS = 256;
    Protocol.MAX_DEPTH = 8;
    Protocol.Type = Type;
    Protocol.Opcode = Opcode;
    Protocol.Status = Status;
    Protocol.Event = Event;
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

