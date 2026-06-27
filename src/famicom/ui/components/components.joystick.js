(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        TouchEvent = events.TouchEvent,
        Famicom = odd.Famicom,
        UI = Famicom.UI,
        components = UI.components,

        CLASS_JOYSTICK = 'famicom-joystick',

        _default = {
            center: 0.0,
            direction: 8,
        };

    function JoyStick(name, kind, logger) {
        EventDispatcher.call(this, 'JoyStick', { logger: logger }, TouchEvent);

        var _this = this,
            _name = name,
            _container;

        function _init() {
            _this.config = utils.extendz({}, _default);
            _container = utils.createElement('div', CLASS_JOYSTICK + ' ' + name);
            _container.addEventListener('touchstart', _onTouchStart);
            _container.addEventListener('touchmove', _onTouchMove);
            _container.addEventListener('touchend', _onTouchEnd);
            _container.addEventListener('touchcancel', _onTouchCancel);
        }

        function _onTouchStart(e) {
            _this.dispatchEvent(TouchEvent.TOUCH_START, { name: _name, touches: e.touches });
            e.preventDefault();
        }

        function _onTouchMove(e) {
            _this.dispatchEvent(TouchEvent.TOUCH_MOVE, { name: _name, touches: e.touches });
            e.preventDefault();
        }

        function _onTouchEnd(e) {
            _this.dispatchEvent(TouchEvent.TOUCH_END, { name: _name });
            e.preventDefault();
        }

        function _onTouchCancel(e) {
            _this.dispatchEvent(TouchEvent.TOUCH_CANCEL, { name: _name });
            e.preventDefault();
        }

        _this.getDirection = function (clientX, clientY) {
            var n = 0;
            var x = clientX - _container.clientWidth / 2;
            var y = _container.clientHeight / 2 - clientY;
            var r = (_container.clientWidth + _container.clientHeight) / 4;
            var d = Math.sqrt(Math.pow(x, 2) + Math.pow(y, 2));
            if (d < r * _this.config.center) {
                return n;
            }

            var a = Math.atan(y / x);
            a = (x >= 0 ? 0 : Math.PI) + Math.PI / 2 - a;
            switch (_this.config.direction) {
                case 4:
                    a = (a + Math.PI / 4) % (2 * Math.PI);
                    n = Math.ceil(a * 2 / Math.PI);
                    break;
                case 8:
                    a = (a + Math.PI / 8) % (2 * Math.PI);
                    n = Math.ceil(a * 4 / Math.PI);
                    break;
            }
            return n;
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _init();
    }

    JoyStick.prototype = Object.create(EventDispatcher.prototype);
    JoyStick.prototype.constructor = JoyStick;
    JoyStick.prototype.kind = 'JoyStick';
    JoyStick.prototype.CONF = _default;

    components.JoyStick = JoyStick;
})(odd);
