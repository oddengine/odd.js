(function (odd) {
    var utils = odd.utils,
        css = utils.css,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        UI = odd.Player.UI,

        CLASS_POSTER = 'pe-poster',

        _default = {
            kind: 'Poster',
            file: 'image/poster.png',
            cors: 'anonymous',   // anonymous, use-credentials
            objectfit: 'fill',   // fill, contain, cover, none, scale-down
            visibility: true,
        };

    function Poster(config, logger) {
        EventDispatcher.call(this, 'Poster', { logger: logger });

        var _this = this,
            _logger = logger,
            _container,
            _img,
            _closed = false;

        function _init() {
            _this.config = utils.extendz({}, _default, config);
            _this.components = {};

            _container = utils.createElement('div', CLASS_POSTER);
            _container.setAttribute('aria-hidden', 'true');
            _container.setAttribute('data-state', _this.config.file ? 'loading' : 'empty');
            if (!_this.config.file) { return; }

            _img = new Image();
            _img.alt = '';
            _img.onload = _onLoad;
            _img.onabort = _onError;
            _img.onerror = _onError;
            if (_this.config.objectfit) {
                css.style(_img, {
                    'object-fit': _this.config.objectfit,
                });
            }
            _img.crossOrigin = _this.config.cors;
            _img.src = _this.config.file;
        }

        function _onLoad(e) {
            if (_closed) { return; }
            _img.onload = _img.onabort = _img.onerror = null;
            _container.setAttribute('data-state', 'ready');
            _container.appendChild(_img);
        }

        function _onError(e) {
            if (_closed) { return; }
            _img.onload = _img.onabort = _img.onerror = null;
            _container.setAttribute('data-state', 'unavailable');
            _logger.log('Poster image is unavailable.');
        }

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _this.destroy = function () {
            if (_closed) { return; }
            _closed = true;
            if (_img) {
                _img.onload = _img.onabort = _img.onerror = null;
                _img.removeAttribute('src');
            }
            utils.emptyElement(_container);
            utils.forEach(_this.components, function (_, component) {
                component.removeGlobalListener(_this.forward);
                component.destroy();
            });
            _this.components = {};
        };

        _init();
    }

    Poster.prototype = Object.create(EventDispatcher.prototype);
    Poster.prototype.constructor = Poster;
    Poster.prototype.kind = 'Poster';
    Poster.prototype.CONF = _default;

    UI.register(Poster);
})(odd);

