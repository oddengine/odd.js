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
        CLASS_STATS_OPTION = 'famicom-stats-option',
        CLASS_STATS_LABEL = 'famicom-stats-label',
        CLASS_STATS_PANEL = 'famicom-stats-panel',
        CLASS_STATS_LIVE = 'famicom-stats-live',
        CLASS_STATS_GRID = 'famicom-stats-grid',
        CLASS_STATS_ITEM = 'famicom-stats-item',
        CLASS_STATS_NAME = 'famicom-stats-name',
        CLASS_STATS_VALUE = 'famicom-stats-value',

        _regi = /\[([a-z]+)\:([a-z]+)=([^\]]+)?\]/gi,
        _default = {
            kind: 'Display',
            layout: '[Button:mute=][Button:unmute=][Button:share=Share][Button:fullscreen=][Button:exitfullscreen=]',
            open: false,
            autohide: false,
            timeout: 5000,
            stats: false,
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
            _status,
            _statsToggle,
            _statsPanel,
            _statsValues;

        function _init() {
            _this.config = config;
            _this.components = {};
            _container = utils.createElement('div', CLASS_DISPLAY);
            _container.setAttribute('data-open', 'false');
            _container.setAttribute('data-sharing', 'false');
            _container.setAttribute('data-stats', 'false');

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
            _buildStatsOption();
            _buildShare();

            _status = utils.createElement('div', CLASS_STATUS);
            _status.setAttribute('aria-live', 'polite');
            _panel.appendChild(_status);
            _container.appendChild(_panel);
            _buildStatsPanel();
            _this.stats(_this.config.stats === true);
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

        function _buildStatsOption() {
            var option = utils.createElement('div', CLASS_STATS_OPTION);
            var label = utils.createElement('span', CLASS_STATS_LABEL);
            label.innerHTML = 'Realtime stats';
            option.appendChild(label);

            _statsToggle = _buildComponent(option, 'Button', 'stats', '');
            _statsToggle.element().setAttribute('role', 'switch');
            _statsToggle.element().setAttribute('aria-label', 'Show realtime stats');
            _panel.appendChild(option);
        }

        function _buildStatsPanel() {
            _statsValues = {};
            _statsPanel = utils.createElement('div', CLASS_STATS_PANEL);
            _statsPanel.setAttribute('aria-label', 'Realtime stream statistics');

            var live = utils.createElement('div', CLASS_STATS_LIVE);
            live.innerHTML = 'LIVE <span>LAST 1S</span>';
            _statsPanel.appendChild(live);

            var grid = utils.createElement('div', CLASS_STATS_GRID);
            var metrics = [
                { key: 'fps', label: 'FPS', title: 'Decoded frames per second' },
                { key: 'nack', label: 'NACK', title: 'NACK requests in the last second' },
                { key: 'pli', label: 'PLI', title: 'PLI requests in the last second' },
                { key: 'droppedFrames', label: 'DROP', title: 'Dropped frames in the last second' },
                { key: 'freezes', label: 'FREEZE', title: 'Freezes in the last second' },
            ];
            utils.forEach(metrics, function (i, metric) {
                var item = utils.createElement('div', CLASS_STATS_ITEM);
                item.setAttribute('title', metric.title);
                var value = utils.createElement('span', CLASS_STATS_VALUE);
                value.innerHTML = '--';
                var name = utils.createElement('span', CLASS_STATS_NAME);
                name.innerHTML = metric.label;
                item.appendChild(value);
                item.appendChild(name);
                grid.appendChild(item);
                _statsValues[metric.key] = value;
            });
            _statsPanel.appendChild(grid);
            _container.appendChild(_statsPanel);
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

        _this.stats = function (status) {
            if (status === undefined) {
                return _container.getAttribute('data-stats') === 'true';
            }
            status = !!status;
            _container.setAttribute('data-stats', status);
            _statsToggle.element().setAttribute('aria-checked', status);
            _statsToggle.element().setAttribute('aria-label', status ? 'Hide realtime stats' : 'Show realtime stats');
            return status;
        };

        _this.updateStats = function (stats) {
            if (!stats) {
                return;
            }
            utils.forEach(_statsValues, function (key, element) {
                var value = stats[key];
                element.innerHTML = typeof value === 'number' && isFinite(value) ? value : '--';
            });
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
