(function (playease) {
    var utils = playease.utils,
        css = utils.css,
        events = playease.events,
        EventDispatcher = events.EventDispatcher,
        UI = playease.UI,

        CLASS_POSTER = 'pe-poster',

        _default = {
            kind: 'Poster',
            file: 'image/poster.png',
            objectfit: 'fill', // 'fill', 'contain', 'cover', 'none', 'scale-down'
            visibility: true,
        };

    function Poster(config) {
        EventDispatcher.call(this, 'Poster');

        var _this = this,
            _container,
            _img;

        function _init() {
            _this.config = config;
            _container = utils.createElement('div', CLASS_POSTER);

            _img = new Image();
            _img.onload = _onLoad;
            _img.onabort = _onError;
            _img.onerror = _onError;
            if (_this.config.objectfit) {
                css.style(_img, {
                    'object-fit': _this.config.objectfit,
                });
            }
            _img.src = _this.config.file;
        }

        function _onLoad(e) {
            _container.appendChild(_img);
        }

        function _onError(e) {
            utils.log('Failed to load poster "' + _img.src + '".');
        }

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _init();
    }

    Poster.prototype = Object.create(EventDispatcher.prototype);
    Poster.prototype.constructor = Poster;
    Poster.prototype.kind = 'Poster';
    Poster.prototype.CONF = _default;

    UI.register(Poster);
})(playease);

