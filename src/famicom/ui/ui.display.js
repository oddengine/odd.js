(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        MouseEvent = events.MouseEvent,
        Famicom = odd.Famicom,
        UI = Famicom.UI,
        components = UI.components,

        CLASS_DISPLAY = 'famicom-display',
        CLASS_TOGGLE = 'famicom-display-toggle',
        CLASS_PANEL = 'famicom-display-panel',
        CLASS_HEADER = 'famicom-display-header',
        CLASS_TITLE = 'famicom-display-title',
        CLASS_CENTER = 'famicom-center',
        CLASS_SHARE = 'famicom-share',
        CLASS_SHARE_TITLE = 'famicom-share-title',
        CLASS_SHARE_PLAYERS = 'famicom-share-players',
        CLASS_STATUS = 'famicom-display-status',

        _regi = /\[([a-z]+)\:([a-z]+)=([^\]]+)?\]/gi,
        _default = {
            kind: 'Display',
            layout: '[Button:mute=][Button:unmute=][Button:share=Share][Button:fullscreen=][Button:exitfullscreen=]',
            open: false,
            autohide: false,
            timeout: 5000,
            visibility: true,
        };

    function Display(config, logger) {
        EventDispatcher.call(this, 'Display', { logger: logger }, MouseEvent);

        var _this = this,
            _logger = logger,
            _container,
            _toggle,
            _panel,
            _share,
            _status;

        function _init() {
            _this.config = config;
            _this.components = {};
            _container = utils.createElement('div', CLASS_DISPLAY);
            _container.setAttribute('data-open', 'false');
            _container.setAttribute('data-sharing', 'false');

            _toggle = _buildComponent(_container, 'Button', 'display', '');
            _toggle.element().className += ' ' + CLASS_TOGGLE;
            _toggle.element().setAttribute('title', 'Game menu');
            _toggle.element().setAttribute('aria-label', 'Open game menu');
            _toggle.element().setAttribute('aria-expanded', 'false');

            _panel = utils.createElement('div', CLASS_PANEL);
            _panel.setAttribute('role', 'dialog');
            _panel.setAttribute('aria-label', 'Game menu');
            _buildHeader();
            _buildActions();
            _buildShare();

            _status = utils.createElement('div', CLASS_STATUS);
            _status.setAttribute('aria-live', 'polite');
            _panel.appendChild(_status);
            _container.appendChild(_panel);
            _this.open(_this.config.open === true);
        }

        function _buildHeader() {
            var header = utils.createElement('div', CLASS_HEADER);
            var title = utils.createElement('span', CLASS_TITLE);
            title.innerHTML = 'Game menu';
            header.appendChild(title);

            var close = _buildComponent(header, 'Button', 'closedisplay', '');
            close.element().setAttribute('title', 'Close');
            close.element().setAttribute('aria-label', 'Close game menu');
            _panel.appendChild(header);
        }

        function _buildActions() {
            var center = utils.createElement('div', CLASS_CENTER);
            var arr;
            _regi.lastIndex = 0;
            while ((arr = _regi.exec(_this.config.layout)) !== null) {
                _buildComponent(center, arr[1], arr[2], arr[3]);
            }
            _panel.appendChild(center);
        }

        function _buildShare() {
            _share = utils.createElement('div', CLASS_SHARE);
            var title = utils.createElement('span', CLASS_SHARE_TITLE);
            title.innerHTML = 'Share a player seat';
            _share.appendChild(title);

            var players = utils.createElement('div', CLASS_SHARE_PLAYERS);
            _buildComponent(players, 'Button', 'share2', 'P2');
            _buildComponent(players, 'Button', 'share3', 'P3');
            _buildComponent(players, 'Button', 'share4', 'P4');
            _share.appendChild(players);
            _panel.appendChild(_share);
        }

        function _buildComponent(container, type, name, kind) {
            var component = new components[type](name, kind, _logger);
            if (utils.typeOf(component.addGlobalListener) === 'function') {
                component.addGlobalListener(_this.forward);
            }
            var element = component.element();
            container.appendChild(element);
            _this.components[name] = component;
            if (kind !== undefined) {
                element.innerHTML = kind;
            }
            return component;
        }

        _this.open = function (status) {
            if (status === undefined) {
                return _container.getAttribute('data-open') === 'true';
            }
            status = !!status;
            _container.setAttribute('data-open', status);
            _toggle.element().setAttribute('aria-expanded', status);
            _toggle.element().setAttribute('aria-label', status ? 'Close game menu' : 'Open game menu');
            if (!status) {
                _this.sharing(false);
            }
            return status;
        };

        _this.sharing = function (status) {
            if (status === undefined) {
                return _container.getAttribute('data-sharing') === 'true';
            }
            _container.setAttribute('data-sharing', !!status);
            return !!status;
        };

        _this.message = function (message) {
            _status.innerHTML = message || '';
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _init();
    }

    Display.prototype = Object.create(EventDispatcher.prototype);
    Display.prototype.constructor = Display;
    Display.prototype.kind = 'Display';
    Display.prototype.CONF = _default;

    UI.register(Display);
})(odd);
