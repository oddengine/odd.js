(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        MouseEvent = events.MouseEvent,
        RTC = odd.RTC,
        UI = RTC.UI,
        components = UI.components,

        CLASS_DISPLAY = 'pe-display',

        _regi = /\[([a-z]+)\:([a-z]+)=([^\]]+)?\]/gi,
        _default = {
            kind: 'Display',
            layout: '[Label:reason=]',
            labels: { play: 'Play', waiting: 'Waiting for media…', failed: '' },
            ondoubleclick: 'fullscreen', // theater, fullscreen
            visibility: true,
        };

    function Display(config, logger) {
        EventDispatcher.call(this, 'Display', { logger: logger }, [MouseEvent.CLICK]);

        var _this = this,
            _logger = logger,
            _container,
            _content,
            _status,
            _closed = false;

        function _init() {
            _this.config = utils.extendz({}, _default, config);
            _this.components = {};

            _container = utils.createElement('div', CLASS_DISPLAY);
            _content = utils.createElement('div');
            _content.addEventListener('dblclick', _onDoubleClick);
            _container.appendChild(_content);

            _buildComponents();

            _status = utils.createElement('span', 'pe-display-status');
            _status.setAttribute('role', 'status');
            _status.setAttribute('aria-live', 'polite');
            _content.appendChild(_status);
        }

        function _buildComponents() {
            var arr;
            while ((arr = _regi.exec(_this.config.layout)) !== null) {
                try {
                    _buildComponent(_content, arr[1], arr[2], arr[3]);
                } catch (err) {
                    _logger.error('Failed to build component: type=' + arr[1] + ', name=' + arr[2] + ', error=' + err.message);
                }
            }
        }

        function _buildComponent(container, type, name, value) {
            if (_this.components[name]) {
                _logger.error('Duplicate display component: ' + name);
                return;
            }
            var component = new components[type](name, value, _logger);
            var element = component.element();
            if (name === 'waiting') {
                element.disabled = true;
                element.tabIndex = -1;
                element.setAttribute('aria-hidden', 'true');
            } else if (name === 'play') {
                element.setAttribute('aria-label', value || _this.config.labels.play);
            } else if (name === 'reason') {
                element.setAttribute('role', 'alert');
                element.setAttribute('aria-atomic', 'true');
            }
            component.addGlobalListener(_this.forward);
            container.appendChild(component.element());
            _this.components[name] = component;
        }

        _this.state = function (state) {
            if (_closed) { return; }
            _container.setAttribute('data-state', state);
            _status.textContent = state === Event.WAITING ? _this.config.labels.waiting : '';
            if (state !== Event.ERROR) { _this.explain(); }
        };

        _this.explain = function (err) {
            if (_closed) { return; }
            var reason = _this.components['reason'];
            if (!reason) { return; }
            var text = '';
            if (err) {
                text = _this.config.labels[err.name] || _this.config.labels.failed ||
                    (err.name || 'UnknownError') + ': ' + (err.message || 'An unknown error occurred.');
            }
            // Runtime errors are text, never Label's optional HTML content.
            reason.element().textContent = text;
        };

        function _onDoubleClick(e) {
            if (_closed || e.target.closest('button, a, input, select, textarea, [contenteditable]')) { return; }
            _this.dispatchEvent(MouseEvent.DOUBLECLICK, { name: _this.config.ondoubleclick });
        }

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _this.destroy = function () {
            if (_closed) { return; }
            _closed = true;
            _content.removeEventListener('dblclick', _onDoubleClick);
            _container.removeAttribute('data-state');
            _status.textContent = '';

            utils.forEach(_this.components, function (_, component) {
                component.removeGlobalListener(_this.forward);
                component.destroy();
            });
            _this.components = {};
            utils.emptyElement(_content);
        };

        _init();
    }

    Display.prototype = Object.create(EventDispatcher.prototype);
    Display.prototype.constructor = Display;
    Display.prototype.kind = 'Display';
    Display.prototype.CONF = _default;

    UI.register(Display);
})(odd);

