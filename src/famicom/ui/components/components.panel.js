(function (odd) {
    var utils = odd.utils,
        css = utils.css,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        components = odd.Famicom.UI.components,

        CLASS_PANEL = 'pe-panel';

    function Panel(name, value, logger) {
        var args = Array.prototype.slice.call(arguments, 3);
        EventDispatcher.apply(this, [value || 'Panel', { logger: logger }].concat(args).concat([[Event.VISIBILITYCHANGE]]));

        var _this = this,
            _name = name,
            _logger = logger,
            _container,
            _data;

        function _init() {
            _data = {};

            _container = utils.createElement('div', CLASS_PANEL + (name ? ' ' + name : ''));

            css.style(_container, { display: 'none' });
        }

        _this.update = function (data) {
            switch (utils.typeOf(data)) {
                case 'object':
                    _data = utils.extendz(_data, data);
                    var text = '';
                    utils.forEach(_data, function (key, item) {
                        text += (text ? '\n' : '') + key + ': ' + item;
                    });
                    _container.textContent = text;
                    break;
                case 'string':
                    _container.textContent = data;
                    break;
                default:
                    utils.emptyElement(_container);
                    if (data) {
                        _container.appendChild(data);
                    }
                    break;
            }
            return _data;
        };

        _this.clear = function () {
            _data = {};
            _container.textContent = '';
        };

        _this.show = function () {
            css.style(_container, { display: 'block' });
            _this.dispatchEvent(Event.VISIBILITYCHANGE, { name: name, state: 'visible' });
        };

        _this.hide = function () {
            css.style(_container, { display: 'none' });
            _this.dispatchEvent(Event.VISIBILITYCHANGE, { name: name, state: 'hidden' });
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function () {
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

