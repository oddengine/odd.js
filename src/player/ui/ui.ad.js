(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Player = odd.Player,
        UI = Player.UI,

        CLASS_AD = 'pe-ad',

        _default = {
            kind: 'AD',
            visibility: true,
        };

    function AD(config, logger) {
        EventDispatcher.call(this, 'AD', { logger: logger });

        var _this = this,
            _container,
            _closed = false;

        function _init() {
            _this.config = config;
            _this.components = {};

            _container = utils.createElement('div', CLASS_AD);
            _container.hidden = true;
        }

        _this.display = function (element) {
            if (_closed) { return; }
            utils.emptyElement(_container);
            if (element && typeof element.nodeType === 'number') {
                _container.appendChild(element);
            }
            _container.hidden = !_container.hasChildNodes();
            _container.style.display = _container.hidden ? 'none' : 'block';
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _this.destroy = function () {
            if (_closed) { return; }
            _closed = true;
            // The host owns the supplied DOM and its resources.
            utils.emptyElement(_container);
            _container.hidden = true;
            _container.style.display = 'none';
            utils.forEach(_this.components, function (_, component) {
                component.removeGlobalListener(_this.forward);
                component.destroy();
            });
            _this.components = {};
        };

        _init();
    }

    AD.prototype = Object.create(EventDispatcher.prototype);
    AD.prototype.constructor = AD;
    AD.prototype.kind = 'AD';
    AD.prototype.CONF = _default;

    UI.register(AD);
})(odd);

