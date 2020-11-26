(function (playease) {
    var utils = playease.utils,
        OS = playease.OS,

        _default = {
            filename: 'sample.fragmented.mp4',
            type: 'video/mpeg',
        };

    function FileKeeper(config) {
        var _this = this,
            _array,
            _blob,
            _url,
            _event,
            _link;

        function _init() {
            _this.config = utils.extendz({}, _default, config);
            _array = [];
        }

        _this.append = function (typedArray) {
            _array.push(typedArray);
        };

        _this.save = function (filename) {
            _blob = new Blob(_array, { type: _this.config.type });
            _url = URL.createObjectURL(_blob);

            _event = document.createEvent('MouseEvents');
            _event.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);

            _link = document.createElementNS('http://www.w3.org/1999/xhtml', 'a');
            _link.href = _url;
            _link.download = filename || _this.config.filename;
            _link.dispatchEvent(_event);

            _array = [];

            // Do not clear this up too soon on iOS Safari.
            setTimeout(function () {
                URL.revokeObjectURL(_url);
            }, OS.isIOS ? 1000 : 0);
        };

        _init();
    };

    FileKeeper.prototype.CONF = _default;

    utils.FileKeeper = FileKeeper;
})(playease);

