(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Player = odd.Player,
        UI = Player.UI,

        CLASS_LOGO = 'pe-logo',

        _default = {
            kind: 'Logo',
            file: 'https://oddengine.com/image/odd-player-logo.png',
            link: 'https://oddengine.com/product/player.html',
            cors: 'anonymous',   // anonymous, use-credentials
            target: '_blank',
            label: 'Visit website',
            alt: '',
            style: 'margin: 3% 5%; width: 36px; height: 36px; top: 0px; right: 0px;',
            visibility: true,
        };

    function Logo(config, logger) {
        EventDispatcher.call(this, 'Logo', { logger: logger });

        var _this = this,
            _logger = logger,
            _container,
            _logo,
            _img,
            _closed = false;

        function _init() {
            _this.config = utils.extendz({}, _default, config);
            _this.components = {};

            _container = utils.createElement('div', CLASS_LOGO);
            _container.style.cssText = _this.config.style;
            _container.hidden = true;
            if (!_this.config.file) { return; }

            var link;
            try { link = new URL(_this.config.link, location.href); } catch (_) { /* An absent link leaves a decorative watermark. */ }
            _logo = utils.createElement(_this.config.link && link && /^https?:$/.test(link.protocol) ? 'a' : 'span');
            if (_logo.tagName === 'A') {
                _logo.href = link.href;
                _logo.target = _this.config.target;
                _logo.rel = 'noopener noreferrer';
                _logo.setAttribute('aria-label', _this.config.label);
            }

            _img = new Image();
            _img.alt = _this.config.alt;
            _img.onload = _onLoad;
            _img.onabort = _onError;
            _img.onerror = _onError;
            _img.crossOrigin = _this.config.cors;
            _img.src = _this.config.file;
        }

        function _onLoad(e) {
            if (_closed) { return; }
            _img.onload = _img.onabort = _img.onerror = null;
            _logo.appendChild(_img);
            _container.appendChild(_logo);
            _container.hidden = false;
        }

        function _onError(e) {
            if (_closed) { return; }
            _img.onload = _img.onabort = _img.onerror = null;
            _logger.log('Logo image is unavailable.');
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
            _container.hidden = true;
            utils.forEach(_this.components, function (_, component) {
                component.removeGlobalListener(_this.forward);
                component.destroy();
            });
            _this.components = {};
        };

        _init();
    }

    Logo.prototype = Object.create(EventDispatcher.prototype);
    Logo.prototype.constructor = Logo;
    Logo.prototype.kind = 'Logo';
    Logo.prototype.CONF = _default;

    UI.register(Logo);
})(odd);

