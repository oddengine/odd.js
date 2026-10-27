(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        RTC = odd.RTC,
        UI = RTC.UI,
        components = UI.components,

        CLASS_DASHBOARD = 'pe-dashboard',

        _regi = /\[([a-z]+)\:([a-z]+)=([^\]]*)\]/gi,
        _default = {
            kind: 'Dashboard',
            layout: '[Settings:settings=]',
            labels: { close: 'Close panel', empty: 'No media information yet.', info: 'Media information', stats: 'Media statistics', settings: 'Settings' },
            visibility: true,
        };

    function Dashboard(config, logger) {
        EventDispatcher.call(this, 'Dashboard', { logger: logger }, Event);

        var _this = this,
            _logger = logger,
            _container,
            _panels = {},
            _active,
            _returnFocus,
            _switching = false,
            _closed = false;

        function _init() {
            _this.config = utils.extendz({}, _default, config);
            _this.components = {};

            _container = utils.createElement('div', CLASS_DASHBOARD);
            _buildComponents();
        }

        function _buildComponents() {
            var arr;
            while ((arr = _regi.exec(_this.config.layout)) !== null) {
                try {
                    _buildComponent(arr[1], arr[2], arr[3]);
                } catch (err) {
                    _logger.error('Failed to build component: type=' + arr[1] + ', name=' + arr[2] + ', error=' + err.message);
                }
            }
        }

        function _buildComponent(type, name, value) {
            if (_this.components[name]) {
                _logger.error('Duplicate dashboard component: ' + name);
                return;
            }
            var component = new components[type](name, value, _logger);
            component.addGlobalListener(_onComponentEvent);
            _this.components[name] = component;

            var shell = utils.createElement('section', 'pe-dashboard-sheet');
            shell.hidden = true;
            shell.setAttribute('aria-label', _this.config.labels[name] || name);
            shell.addEventListener('keydown', _onKeyDown);

            var close = utils.createElement('button', 'pe-dashboard-close');
            close.type = 'button';
            close.textContent = _this.config.labels.close;
            close.onclick = function () { _this.hide(name); };
            shell.appendChild(close);

            var title = utils.createElement('h3');
            title.textContent = _this.config.labels[name] || name;
            shell.appendChild(title);

            var empty = utils.createElement('p', 'pe-dashboard-empty');
            empty.textContent = _this.config.labels.empty;
            empty.hidden = type !== 'Panel';
            shell.appendChild(empty);
            shell.appendChild(component.element());
            _container.appendChild(shell);
            _panels[name] = { shell: shell, close: close, empty: empty, type: type };
        }

        function _onComponentEvent(e) {
            if (_closed) { return; }
            if (e.type === Event.VISIBILITYCHANGE) {
                var panel = _panels[e.data.name];
                if (panel) {
                    var focused = panel.shell.contains(document.activeElement);
                    panel.shell.hidden = e.data.state !== 'visible';
                    if (panel.shell.hidden && _active === e.data.name) {
                        _active = null;
                        if (!_switching && focused) { _restoreFocus(); }
                    }
                }
            }
            _this.forward(e);
        }

        function _restoreFocus() {
            var target = _returnFocus;
            _returnFocus = null;
            if (!target || !target.isConnected || target.closest('[inert]') || !target.getClientRects().length || getComputedStyle(target).visibility === 'hidden') {
                target = _container.parentNode;
            }
            if (target && target.isConnected) {
                if (!target.hasAttribute('tabindex')) { target.tabIndex = -1; }
                target.focus();
            }
        }

        function _onKeyDown(e) {
            if (e.key === 'Escape' && _active) {
                e.preventDefault();
                e.stopPropagation();
                _this.hide(_active);
            }
        }

        _this.update = function (name, data) {
            if (_closed) { return; }
            var component = _this.components[name];
            if (!component) { return; }
            component.update(data);
            var panel = _panels[name];
            if (panel.type === 'Panel') {
                var element = component.element();
                panel.empty.hidden = !!(element.textContent.trim() || element.children.length);
            }
        };

        _this.clear = function (name) {
            if (_closed) { return; }
            var component = _this.components[name];
            if (component && typeof component.clear === 'function') {
                component.clear();
                _panels[name].empty.hidden = _panels[name].type !== 'Panel';
            }
        };

        _this.show = function (name) {
            if (_closed || !_this.components[name]) { return; }
            if (!_active) { _returnFocus = document.activeElement; }
            _switching = true;
            utils.forEach(_this.components, function (key, component) {
                if (key !== name) { component.hide(); }
            });
            _switching = false;
            _active = name;
            _this.components[name].show();
            _panels[name].close.focus();
        };

        _this.hide = function (name) {
            if (!_closed && _this.components[name]) { _this.components[name].hide(); }
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {
            utils.forEach(_this.components, function (_, component) {
                component.resize(width, height);
            });
        };

        _this.destroy = function () {
            if (_closed) { return; }
            _closed = true;
            utils.forEach(_panels, function (_, panel) {
                panel.close.onclick = null;
                panel.shell.removeEventListener('keydown', _onKeyDown);
            });
            _panels = {};
            _returnFocus = null;
            _active = null;
            utils.forEach(_this.components, function (_, component) {
                component.removeGlobalListener(_onComponentEvent);
                component.destroy();
            });
            _this.components = {};
            _container.innerHTML = '';
        };

        _init();
    }

    Dashboard.prototype = Object.create(EventDispatcher.prototype);
    Dashboard.prototype.constructor = Dashboard;
    Dashboard.prototype.kind = 'Dashboard';
    Dashboard.prototype.CONF = _default;

    UI.register(Dashboard);
})(odd);

