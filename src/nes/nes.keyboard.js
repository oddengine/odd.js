(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,

        A = 0,
        B = 1,
        SELECT = 2,
        START = 3,
        UP = 4,
        DOWN = 5,
        LEFT = 6,
        RIGHT = 7;

    function Keyboard(logger) {
        var _this = this,
            _logger = logger;

        function _init() {
            _this.state1 = new Array(8);
            _this.state2 = new Array(8);
            for (var i = 0; i < _this.state1.length; i++) {
                _this.state1[i] = 0x40;
            }
            for (var i = 0; i < _this.state2.length; i++) {
                _this.state2[i] = 0x40;
            }
        }

        _this.onKeyDown = function (id, key) {
            var state = _this['state' + id];
            if (state) {
                state[key] = 0x41;
            }
        };

        _this.onKeyUp = function (id, key) {
            var state = _this['state' + id];
            if (state) {
                state[key] = 0x40;
            }
        };

        _init();
    }

    Keyboard.A = A;
    Keyboard.B = B;
    Keyboard.SELECT = SELECT;
    Keyboard.START = START;
    Keyboard.UP = UP;
    Keyboard.DOWN = DOWN;
    Keyboard.LEFT = LEFT;
    Keyboard.RIGHT = RIGHT;
    NES.Keyboard = Keyboard;
})(odd);

