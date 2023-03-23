(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        MouseEvent = events.MouseEvent,
        NES = odd.NES,
        UI = NES.UI,
        components = UI.components,

        CLASS_BUTTON = 'nes-button';

    function Button(name, kind, logger) {
        EventDispatcher.call(this, 'Button', { logger: logger }, MouseEvent);

        var _this = this,
            _name = name,
            _logger = logger,
            _container;

        function _init() {
            _container = utils.createElement('span', CLASS_BUTTON + ' ' + name);
            _container.addEventListener('mousedown', _onMouseDown);
            _container.addEventListener('mouseup', _onMouseUp);
            _container.addEventListener('click', _onClick);
            _container.addEventListener('touchstart', _onMouseDown);
            _container.addEventListener('touchend', _onMouseUp);
            _container.addEventListener('touchcancel', _onMouseUp);
        }

        function _onMouseDown(e) {
            _this.dispatchEvent(MouseEvent.MOUSE_DOWN, { name: _name });
        }

        function _onMouseUp(e) {
            _this.dispatchEvent(MouseEvent.MOUSE_UP, { name: _name });
        }

        function _onClick(e) {
            _this.dispatchEvent(MouseEvent.CLICK, { name: _name });
        }

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _init();
    }

    Button.prototype = Object.create(EventDispatcher.prototype);
    Button.prototype.constructor = Button;
    Button.prototype.kind = 'Button';

    components.Button = Button;
})(odd);

