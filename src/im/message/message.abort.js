(function (odd) {
    var IM = odd.IM,
        Message = IM.Message;

    function AbortMessage(m) {
        Message.call(this, m);

        var _this = this;

        function _init() {
            _this.Payload = 0;
        }

        _this.parse = function (buffer, byteOffset) {
            var i = 0;
            var view = new DataView(buffer, byteOffset);
            if (view.byteLength < 1) {
                throw { name: 'DataError', message: `Data not enough while decoding abort message: ${view.byteLength}/1` };
            }

            _this.Payload = view.getUint8(i);
            i++;
            return i;
        };

        _init();
    }

    AbortMessage.prototype = Object.create(Message.prototype);
    AbortMessage.prototype.constructor = AbortMessage;

    IM.AbortMessage = AbortMessage;
})(odd);

