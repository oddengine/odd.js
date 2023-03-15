(function (odd) {
    var IM = odd.IM,

        Type = {
            ABORT: 0x1,
            ACK_WINDOW_SIZE: 0x2,
            ACK: 0x3,
            COMMAND: 0x4,
        },
        Command = {
            CONNECT: 'connect',
            CREATE: 'create',
            JOIN: 'join',
            LEAVE: 'leave',
            CHMOD: 'chmod',
            INVOKE: 'invoke',
            QUIT: 'quit',
            SEND: 'send',
            PLAY: 'play',
            STOP: 'stop',
            SDP: 'sdp',
            CANDIDATE: 'candidate',
            SET_PROPERTY: 'setProperty',
            GET_PROPERTY: 'getProperty',
            STATUS: 'status',
            RELEASE: 'release',
        },
        Reason = {
            NONE: '',
            TIMEOUT: 'timeout',
            UNAUTHORIZED: 'unauthorized',
            EOF: 'eof',
            ERROR: 'error',
        };

    function Message(m) {
        var _this = this;

        function _init() {
            _this.FIN = m ? m.FIN : 0;
            _this.RSV = m ? m.RSV : 0;
            _this.Type = m ? m.Type : 0;
            _this.SequenceNumber = m ? m.SequenceNumber : 0;
            _this.PipeID = m ? m.PipeID : 0;
            _this.Payload = null;
        }

        _this.parse = function (buffer, byteOffset) {
            if (buffer.byteLength < 5) {
                throw { name: 'DataError', message: `Data not enough while decoding im message: ${buffer.byteLength}/5` };
            }

            var i = 0;
            var view = new DataView(buffer, byteOffset);

            var byte = view.getUint8(i);
            _this.FIN = (byte & 0x80) >> 7;
            _this.RSV = (byte & 0x70) >> 4;
            _this.Type = byte & 0x0F;
            i++;

            _this.SequenceNumber = view.getUint16(i);
            i += 2;

            _this.PipeID = view.getUint16(i);
            i += 2;

            _this.Payload = new Uint8Array(buffer, byteOffset + i);
            i += _this.Payload.byteLength;
            return i;
        };

        _init();
    }

    Message.Type = Type;
    Message.Command = Command;
    Message.Reason = Reason;
    IM.Message = Message;
})(odd);

