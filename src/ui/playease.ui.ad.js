(function (playease) {
    var utils = playease.utils,
        events = playease.events,
        EventDispatcher = events.EventDispatcher,
        UI = playease.UI,

        CLASS_AD = 'pe-ad',

        _default = {
            kind: 'AD',
            visibility: true,
        };

    function AD(config) {
        EventDispatcher.call(this, 'AD');

        var _this = this,
            _container;

        function _init() {
            _this.config = config;
            _container = utils.createElement('div', CLASS_AD);
        }

        _this.display = function (element) {
            _container.innerHTML = '';
            _container.appendChild(element);
        };

        _this.remove = function () {
            _container.innerHTML = '';
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _init();
    }

    AD.prototype = Object.create(EventDispatcher.prototype);
    AD.prototype.constructor = AD;
    AD.prototype.kind = 'AD';
    AD.prototype.CONF = _default;

    UI.register(AD);
})(playease);

