(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        MouseEvent = events.MouseEvent,
        components = odd.Player.UI.components,

        CLASS_TOOLTIP = 'pe-tooltip',
        CLASS_TOGGLE = 'pe-toggle',
        
        _regi = /^([a-z\d\-]+)(?:\s+(.*))?$/gi,
        _kvgi = /([a-z\d\-]+)=([^;]*)/gi;

    function Toggle(name, value, logger) {
        EventDispatcher.call(this, 'Toggle', { logger: logger }, MouseEvent);

        var _this = this,
            _name = name,
            _logger = logger,
            _container,
            _tooltip,
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

            _container = utils.createElement('button', CLASS_TOGGLE + ' ' + name);
            _container.type = 'button';
            _container.addEventListener('click', _onClick);

            _tooltip = utils.createElement('span', CLASS_TOOLTIP);
            _container.appendChild(_tooltip);

            _this.switch(_index);
        }

        function _onClick() {
            var state = _this.switch();
            _this.dispatchEvent(MouseEvent.CLICK, { name: _name, state: state.key });
        }

        _this.switch = function (to) {
            switch (utils.typeOf(to)) {
                case 'number':
                    if (to >= 0 && to < _states.length) {
                        _index = to;
                        _tooltip.innerHTML = _states[_index].value;
                        return _states[_index];
                    }
                    break;
                case 'string':
                    for (var i = 0; i < _states.length; i++) {
                        if (_states[i].key === to) {
                            _index = i;
                            _tooltip.innerHTML = _states[_index].value;
                            return _states[_index];
                        }
                    }
                    break;
            }
            if (++_index >= _states.length) {
                _index = 0;
            }
            _tooltip.innerHTML = _states[_index].value;
            return _states[_index];
        };

        _this.state = function () {
            return _states[_index].key;
        }

        _this.element = function () {
            return _container;
        };

        _this.resize = function () {

        };

        _this.destroy = function () {
            _container.removeEventListener('click', _onClick);
        };

        _init();
    }

    Toggle.prototype = Object.create(EventDispatcher.prototype);
    Toggle.prototype.constructor = Toggle;
    Toggle.prototype.kind = 'Toggle';

    components.Toggle = Toggle;
})(odd);

