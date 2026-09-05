(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        components = odd.Famicom.UI.components,

        CLASS_INPUT = 'pe-input';

    function Input(name, value, logger) {
        EventDispatcher.call(this, 'Input', { logger: logger }, [Event.CHANGE]);

        var _this = this,
            _name = name,
            _logger = logger,
            _container;

        function _init() {
            _container = utils.createElement('input', CLASS_INPUT + ' ' + name);
            _container.addEventListener('change', _onChange);
            _container.value = value;
        }

        function _onChange(e) {
            _this.dispatchEvent(Event.CHANGE, { name: _name });
        }

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _this.destroy = function () {
            _container.removeEventListener('change', _onChange);
            _container.innerHTML = '';
        };

        _init();
    }

    Input.prototype = Object.create(EventDispatcher.prototype);
    Input.prototype.constructor = Input;
    Input.prototype.kind = 'Input';

    components.Input = Input;
})(odd);

