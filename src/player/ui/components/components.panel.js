(function (odd) {
    var utils = odd.utils,
        css = utils.css,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        components = odd.Player.UI.components,

        CLASS_TOOLTIP = 'pe-tooltip',
        CLASS_PANEL = 'pe-panel';

    function Panel(name, value, logger) {
        var args = Array.prototype.slice.call(arguments, 3);
        EventDispatcher.apply(this, [value || 'Panel', { logger: logger }].concat(args).concat([[Event.VISIBILITYCHANGE]]));

        var _this = this,
            _name = name,
            _logger = logger,
            _container,
            _tooltip,
            _content,
            _data = {};

        function _init() {
            _container = utils.createElement('div', CLASS_PANEL + ' ' + _name);

            _tooltip = utils.createElement('span', CLASS_TOOLTIP);
            _container.appendChild(_tooltip);

            _content = utils.createElement('div');
            _container.appendChild(_content);
        }

        _this.update = function (data) {
            switch (utils.typeOf(data)) {
                case 'object':
                    _data = utils.extendz(_data, data);

                    var text = '';
                    utils.forEach(_data, function (key, value) {
                        text += (text ? '\n' : '') + key + ': ' + value;
                    });
                    _content.innerHTML = text;
                    break;
                case 'string':
                    _content.innerHTML = text;
                    break;
                default:
                    _content.innerHTML = '';
                    _content.appendChild(data);
                    break;
            }
        };

        _this.clear = function () {
            _content.innerHTML = '';
            _data = {};
        };

        _this.show = function () {
            css.style(_container, {
                display: 'inline-block',
            });
            _this.dispatchEvent(Event.VISIBILITYCHANGE, { name: _name, state: 'visible' });
        };

        _this.hide = function () {
            css.style(_container, {
                display: 'none',
            });
            _this.dispatchEvent(Event.VISIBILITYCHANGE, { name: _name, state: 'hidden' });
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _this.destroy = function () {
            _container.innerHTML = '';
        };

        _init();
    }

    Panel.prototype = Object.create(EventDispatcher.prototype);
    Panel.prototype.constructor = Panel;
    Panel.prototype.kind = 'Panel';

    components.Panel = Panel;
})(odd);

