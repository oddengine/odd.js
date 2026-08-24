(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        MouseEvent = events.MouseEvent,
        components = odd.Famicom.UI.components,

        CLASS_TOOLTIP = 'pe-tooltip',
        CLASS_BUTTON = 'pe-button';

    function Button(name, value, logger) {
        EventDispatcher.call(this, 'Button', { logger: logger }, [MouseEvent.CLICK]);

        var _this = this,
            _name = name,
            _logger = logger,
            _container,
            _tooltip;

        function _init() {
            _container = utils.createElement('span', CLASS_BUTTON + ' ' + name);
            _container.addEventListener('click', _onClick);

            _tooltip = utils.createElement('span', CLASS_TOOLTIP);
            _container.appendChild(_tooltip);
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

