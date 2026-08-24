(function (odd) {
    var utils = odd.utils,

        re = /^(([a-z\d]+\:)?(?:(?:\/\/)?(?:([a-z\d]+)\:([a-z\d]*)@)?(([-_a-z\d\.]+)(?:\:(\d+))?))?)((?:\/)?[-_=/a-z\d\.\*]*)(?:(\?[^#\s]*))?(?:(#[^\s]*))?$/i;

    function URL(url) {
        var _this = this;

        function _init() {
            _this.href = '';
            _this.origin = '';
            _this.protocol = '';
            _this.username = '';
            _this.password = '';
            _this.host = '';
            _this.hostname = '';
            _this.port = '';
            _this.path = '';
            _this.filename = '';
            _this.filetype = '';
            _this.search = '';
            _this.hash = '';

            if (url) {
                _this.parse(url);
            }
        }

        _this.parse = function (url) {
            if (/^([a-z]+)\:\/\//i.test(url) === false) {
                url = window.location.origin + url;
            }

            var arr = url.match(re);
            if (arr === null) {
                throw { name: 'SyntaxError', message: 'The string did not match the expected pattern, url=' + url + '.' };
            }
            _this.href = url;
            _this.origin = arr[1];
            _this.protocol = arr[2];
            _this.username = arr[3];
            _this.password = arr[4];
            _this.host = arr[5];
            _this.hostname = arr[6];
            _this.port = arr[7] || '';
            _this.path = arr[8] || '';
            _this.search = arr[9];
            _this.hash = arr[10];

            var tmp = _this.path.match(/\/(.+?)(\.[a-z\d]+)?$/i);
            if (tmp) {
                _this.filename = tmp[1];
                _this.filetype = tmp[2];
            }
        };

        _init();
    }

    utils.URL = URL;
})(odd);

