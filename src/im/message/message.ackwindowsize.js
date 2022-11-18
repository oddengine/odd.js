(function (odd) {
    var IM = odd.IM,
        Message = IM.Message;

    function AckWindowSizeMessage(m) {
        Message.call(this, m);

        var _this = this;

        function _init() {
            _this.Payload = 0;
        }

        _this.parse = function (buffer, byteOffset) {
            var i = 0;
            var view = new DataView(buffer, byteOffset);
            if (view.byteLength < 4) {
                throw { name: 'DataError', message: `Data not enough while decoding ack window size message: ${view.byteLength}/4` };
            }

            _this.Payload = view.getUint32(i);
            i += 4;
            return i;
        };

        _init();
    }

    AckWindowSizeMessage.prototype = Object.create(Message.prototype);
    AckWindowSizeMessage.prototype.constructor = AckWindowSizeMessage;

    IM.AckWindowSizeMessage = AckWindowSizeMessage;
})(odd);

