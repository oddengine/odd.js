(function (odd) {
    var utils = odd.utils,
        css = utils.css,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        MouseEvent = events.MouseEvent,
        TimerEvent = events.TimerEvent,
        Player = odd.Player,
        UI = Player.UI,
        components = UI.components,

        CLASS_DISPLAY = 'pe-display',
        CLASS_TOOLTIP = 'pe-tooltip',

        _regi = /\[([a-z]+)\:([a-z]+)=([^\]]+)?\]/gi,
        _default = {
            kind: 'Display',
            layout: '[Button:play=][Button:waiting=][Label:reason=]',
            ondoubleclick: 'fullscreen', // theater, fullscreen
            visibility: true,
        };

    function Display(config, logger) {
        EventDispatcher.call(this, 'Display', { logger: logger }, [MouseEvent.CLICK]);

        var _this = this,
            _logger = logger,
            _container,
            _content,
            _timer,
            _timestamp = 0;

        function _init() {
            _this.config = config;
            _this.components = {};

            _container = utils.createElement('div', CLASS_DISPLAY);
            _content = utils.createElement('div');
            _content.addEventListener('click', _onClick);
            _container.appendChild(_content);

            _buildComponents();

            _timer = new utils.Timer(80, 0, _logger);
            _timer.addEventListener(TimerEvent.TIMER, _onTimer);
        }

        function _buildComponents() {
            var arr;
            while ((arr = _regi.exec(_this.config.layout)) !== null) {
                try {
                    _buildComponent(_content, arr[1], arr[2], arr[3]);
                } catch (err) {
                    _logger.error('Failed to build component: type=' + arr[1] + ', name=' + arr[2] + ', Error=' + err.message);
                }
            }
        }

        function _buildComponent(container, type, name, value) {
            var component = new components[type](name, value, _logger);
            if (utils.typeOf(component.addGlobalListener) === 'function') {
                component.addGlobalListener(_this.forward);
            }
            var element = component.element();
            if (value !== undefined) {
                var tooltip;
                if (utils.typeOf(components[value]) === 'function') {
                    tooltip = new components[value](name, value, _logger);
                    element.insertAdjacentElement('afterbegin', tooltip.element());
                } else {
                    tooltip = utils.createElement('span', CLASS_TOOLTIP);
                    tooltip.innerHTML = value;
                    element.insertAdjacentElement('afterbegin', tooltip);
                }
                component.tooltip = tooltip;
            }
            container.appendChild(element);
            _this.components[name] = component;
        }

        _this.state = function (state) {
            switch (state) {
                case Event.WAITING:
                    _timer.start();
                    break;
                default:
                    _timer.stop();
                    break;
            }
            if (state !== Event.ERROR) {
                _this.explain();
            }
        };

        _this.explain = function (err) {
            var reason = _this.components['reason'];
            if (reason) {
                if (!err) {
                    reason.set('');
                    return;
                }

                err.name = err.name || 'UnknownError';
                err.message = err.message || 'An unknown error occurred.';
                reason.set(err.name + ': ' + err.message);
            }
        };

        function _onTimer(e) {
            var angle = _timer.currentCount() * 30 % 360;
            var icon = _this.components['waiting'];
            if (icon) {
                css.style(icon.element(), {
                    filter: 'progid:DXImageTransform.Microsoft.BasicImage(rotation=' + angle * Math.PI / 180 + ')',
                    'transform': 'rotate(' + angle + 'deg)',
                    '-o-transform': 'rotate(' + angle + 'deg)',
                    '-ms-transform': 'rotate(' + angle + 'deg)',
                    '-moz-transform': 'rotate(' + angle + 'deg)',
                    '-webkit-transform': 'rotate(' + angle + 'deg)'
                });
            }
        }

        function _onClick(e) {
            var time = new Date().getTime();
            if (time <= _timestamp + 700) {
                _timestamp = 0; // Avoid triple click
                _this.dispatchEvent(MouseEvent.DOUBLECLICK, { name: _this.config.ondoubleclick });
                return;
            }
            _timestamp = time;
        }

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _this.destroy = function () {
            utils.forEach(_this.components, function (_, component) {
                component.removeGlobalListener(_this.forward);
                component.destroy();
            });
            _this.components = {};
        };

        _init();
    }

    Display.prototype = Object.create(EventDispatcher.prototype);
    Display.prototype.constructor = Display;
    Display.prototype.kind = 'Display';
    Display.prototype.CONF = _default;

    UI.register(Display);
})(odd);

