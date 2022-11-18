(function (odd) {
    var utils = odd.utils,
        crypt = utils.crypt,
        IM = odd.IM,
        Message = IM.Message,

        Operator = {
            ADD: '+',
            SUB: '-',
            SET: '=',
        },
        Mask = {
            R: 0x000000FF,
            W: 0x0000FF00,
            X: 0x00FF0000,
        },
        Sending = {
            TEXT: 'text',
            FILE: 'file',
        },
        Casting = {
            UNI: 'uni',
            MULTI: 'multi',
        };

    function CommandMessage(m) {
        Message.call(this, m);

        var _this = this;

        function _init() {
            _this.Timestamp = 0;
            _this.TransactionID = 0;
            _this.Offset = 0;
            _this.Arguments = {};
            _this.Payload = null;
        }

        _this.parse = function (buffer, byteOffset) {
            var i = 0;
            var view = new DataView(buffer, byteOffset);
            if (view.byteLength < 7) {
                throw { name: 'DataError', message: `Data not enough while decoding command message: ${view.byteLength}/7` };
            }

            _this.Timestamp = view.getUint32(i);
            i += 4;

            _this.TransactionID = view.getUint16(i);
            i += 2;

            _this.Offset = view.getUint16(i);
            i += 2;

            if (_this.Offset > 0) {
                var byte = new Uint8Array(buffer, byteOffset + i, _this.Offset);
                var text = crypt.UTF8ByteArrayToString(byte);
                _this.Arguments = JSON.parse(text);
                i += _this.Offset;
            }
            _this.Payload = new Uint8Array(buffer, byteOffset + i);
            return view.byteLength;
        };

        _init();
    }

    CommandMessage.prototype = Object.create(Message.prototype);
    CommandMessage.prototype.constructor = CommandMessage;

    CommandMessage.Operator = Operator;
    CommandMessage.Mask = Mask;
    CommandMessage.Sending = Sending;
    CommandMessage.Casting = Casting;
    IM.CommandMessage = CommandMessage;
})(odd);

