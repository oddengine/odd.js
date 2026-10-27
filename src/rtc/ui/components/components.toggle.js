(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        MouseEvent = events.MouseEvent,
        components = odd.RTC.UI.components,

        CLASS_TOOLTIP = 'pe-tooltip',
        CLASS_TOGGLE = 'pe-toggle',
        
        _regi = /^([a-z\d\-]+)(?:\s+(.*))?$/i,
        _kvgi = /([a-z\d\-]+)=([^;]*)/gi;

    function Toggle(name, value, logger) {
        EventDispatcher.call(this, 'Toggle', { logger: logger }, MouseEvent);

        var _this = this,
            _name = name,
            _logger = logger,
            _container,
            _tooltip,
            _menu,
            _label = 'Layout',
            _index = 0,
            _states = [];

        function _init() {
            var arr = _regi.exec(value);
            if (arr) {
                var match;
                while ((match = _kvgi.exec(arr[2])) !== null) {
                    _states.push({ key: match[1], value: match[2] });
                }
                for (var i = 0; i < _states.length; i++) {
                    if (_states[i].key === arr[1]) {
                        _index = i;
                        break;
                    }
                }
            }

            if (!_states.length) { throw { name: 'DataError', message: 'Toggle requires at least one state.' }; }

            _container = utils.createElement('button', CLASS_TOGGLE + ' ' + name);
            _container.type = 'button';
            _container.addEventListener('click', _onClick);

            _tooltip = utils.createElement('span', CLASS_TOOLTIP);
            _container.appendChild(_tooltip);

            _this.switch(_index);
            if (_name === 'layout') {
                _menu = new utils.ControlMenu(_container, function (index) {
                    var state = _this.switch(index);
                    _this.dispatchEvent(MouseEvent.CLICK, { name: _name, state: state.key });
                });
                _states.forEach(function (state) { _menu.append(state.value); });
                _menu.selected(_index);
            }
        }

        function _onClick() {
            if (_menu) { _menu.toggle(); return; }
            var state = _this.switch();
            _this.dispatchEvent(MouseEvent.CLICK, { name: _name, state: state.key });
        }

        _this.switch = function (to) {
            var index = _index;
            if (typeof to === 'number') {
                if (to < 0 || to >= _states.length) { return _states[_index]; }
                index = to;
            } else if (typeof to === 'string') {
                index = _states.findIndex(function (state) { return state.key === to; });
                if (index < 0) { return _states[_index]; }
            } else { index = (_index + 1) % _states.length; }
            _index = index;
            var state = _states[_index];
            _container.setAttribute('state', state.key);
            _container.setAttribute('aria-label', _name === 'layout' ? _label + ': ' + state.value : state.value);
            _tooltip.textContent = state.value;
            if (_menu) { _menu.selected(_index); }
            return state;
        };

        _this.label = function (label) { _label = label; _this.switch(_index); };

        _this.state = function () {
            return _states[_index].key;
        };

        _this.element = function () {
            return _container;
        };

        _this.tooltip = function () {
            return _tooltip;
        };

        _this.resize = function () {

        };

        _this.destroy = function () {
            if (_menu) { _menu.destroy(); }
            _container.removeEventListener('click', _onClick);
            _container.innerHTML = '';
        };

        _init();
    }

    Toggle.prototype = Object.create(EventDispatcher.prototype);
    Toggle.prototype.constructor = Toggle;
    Toggle.prototype.kind = 'Toggle';

    components.Toggle = Toggle;
})(odd);

