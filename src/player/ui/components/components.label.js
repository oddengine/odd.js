(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        components = odd.Player.UI.components,

        CLASS_TOOLTIP = 'pe-tooltip',
        CLASS_LABEL = 'pe-label';

    function Label(name, value, logger) {
        EventDispatcher.call(this, 'Label', { logger: logger });

        var _this = this,
            _name = name,
            _logger = logger,
            _container,
            _tooltip;

        function _init() {
            _container = utils.createElement('span', CLASS_LABEL + ' ' + name);
            _container.innerHTML = value || '';

            if (value !== undefined) {
                _tooltip = utils.createElement('span', CLASS_TOOLTIP);
                _tooltip.innerHTML = value;
                _container.appendChild(_tooltip);
            }
        }

        _this.set = function (text) {
            _container.innerHTML = text || '';
        };

        _this.get = function () {
            return _container.innerHTML;
        };

        _this.element = function () {
            return _container;
        };

        _this.tooltip = function () {
            return _tooltip;
        };

        _this.resize = function (width, height) {

        };

        _this.destroy = function () {
            _container.innerHTML = '';
        };

        _init();
    }

    Label.prototype = Object.create(EventDispatcher.prototype);
    Label.prototype.constructor = Label;
    Label.prototype.kind = 'Label';

    components.Label = Label;
})(odd);

