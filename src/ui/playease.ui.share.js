(function (playease) {
    var utils = playease.utils,
        events = playease.events,
        EventDispatcher = events.EventDispatcher,
        UI = playease.UI,

        CLASS_SHARE = 'pe-share',

        _default = {
            kind: 'Share',
            visibility: true,
        };

    function Share(config) {
        EventDispatcher.call(this, 'Share');

        var _this = this,
            _container;

        function _init() {
            _this.config = config;
            _container = utils.createElement('div', CLASS_SHARE);
        }

        _this.display = function (element) {
            _container.innerHTML = '';
            _container.appendChild(element);
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _init();
    }

    Share.prototype = Object.create(EventDispatcher.prototype);
    Share.prototype.constructor = Share;
    Share.prototype.kind = 'Share';
    Share.prototype.CONF = _default;

    UI.register(Share);
})(playease);

