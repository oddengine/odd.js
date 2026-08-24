(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        AppEvent = events.AppEvent,
        App = odd.App,
        UI = App.UI,
        components = UI.components,

        _default = {
            controls: [],
        };

    function Controlbar(name, config, logger) {
        var _this = this,
            _container,
            _controls,
            _pressed;

        EventDispatcher.call(this, 'AppControlbar', { logger: logger }, AppEvent);

        function _init() {
            _this.config = utils.extendz({}, _default, config || {});
            _controls = {};
            _pressed = {};
            _container = utils.createElement('div', 'app-controlbar ' + name);
            _container.setAttribute('data-domain', name);
            _build();
        }

        function _build() {
            var groups = {};
            for (var i = 0; i < _this.config.controls.length; i++) {
                var config = _this.config.controls[i],
                    groupName = config.group || 'main',
                    group = groups[groupName];
                if (!group) {
                    group = utils.createElement('div', 'app-control-group ' + groupName);
                    groups[groupName] = group;
                    _container.appendChild(group);
                }
                group.appendChild(_control(config));
            }
        }

        function _control(config) {
            var element,
                type = config.type || 'button';
            switch (type) {
                case 'label':
                    element = utils.createElement('span', 'app-control-label');
                    element.textContent = config.label || '';
                    break;
                case 'slider':
                    element = utils.createElement('label', 'app-control-slider');
                    var range = utils.createElement('input');
                    range.type = 'range';
                    range.min = config.min === null || config.min === undefined ? 0 : config.min;
                    range.max = config.max === null || config.max === undefined ? 100 : config.max;
                    range.value = config.value === null || config.value === undefined ? 80 : config.value;
                    range.setAttribute('data-action', config.name);
                    range.addEventListener('input', _onInput);
                    element.title = config.label || config.name;
                    element.appendChild(range);
                    break;
                case 'toggle':
                    element = _button(config);
                    element.classList.add('app-control-toggle');
                    element.setAttribute('role', 'switch');
                    element.setAttribute('aria-checked', !!config.checked);
                    element.setAttribute('data-checked', !!config.checked);
                    break;
                case 'key':
                    element = _button(config);
                    element.classList.add('app-control-key');
                    element.addEventListener('pointerdown', _onPointerDown);
                    element.addEventListener('pointerup', _onPointerUp);
                    element.addEventListener('pointercancel', _onPointerUp);
                    element.addEventListener('pointerleave', _onPointerUp);
                    break;
                default:
                    element = _button(config);
                    break;
            }
            element.classList.add(config.name);
            element.setAttribute('data-name', config.name);
            _controls[config.name] = element;
            return element;
        }

        function _button(config) {
            var element = utils.createElement('button', 'app-control-button');
            element.type = 'button';
            element.title = config.label || config.name;
            element.setAttribute('aria-label', config.label || config.name);
            element.setAttribute('data-action', config.name);
            var icon = utils.createElement('span', 'app-control-icon app-control-icon-' + config.name);
            icon.setAttribute('aria-hidden', 'true');
            element.appendChild(icon);
            if (config.text) {
                var text = utils.createElement('span', 'app-control-text');
                text.textContent = config.text;
                element.appendChild(text);
            }
            element.addEventListener('click', _onClick);
            return element;
        }

        function _onClick(e) {
            var element = e.currentTarget,
                action = element.getAttribute('data-action'),
                checked;
            if (element.classList.contains('app-control-toggle')) {
                checked = element.getAttribute('data-checked') !== 'true';
                _state(element, checked);
            }
            _this.dispatchEvent(AppEvent.ACTION, {
                name: name,
                action: action,
                checked: checked,
                phase: 'click',
            });
        }

        function _onInput(e) {
            _this.dispatchEvent(AppEvent.ACTION, {
                name: name,
                action: e.currentTarget.getAttribute('data-action'),
                value: parseFloat(e.currentTarget.value),
                phase: 'input',
            });
        }

        function _onPointerDown(e) {
            var action = e.currentTarget.getAttribute('data-action');
            if (_pressed[action]) {
                return;
            }
            _pressed[action] = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            _this.dispatchEvent(AppEvent.ACTION, {
                name: name,
                action: action,
                pressed: true,
                phase: 'down',
            });
        }

        function _onPointerUp(e) {
            var action = e.currentTarget.getAttribute('data-action');
            if (!_pressed[action]) {
                return;
            }
            delete _pressed[action];
            if (!e.currentTarget.hasPointerCapture || e.currentTarget.hasPointerCapture(e.pointerId)) {
                try {
                    e.currentTarget.releasePointerCapture(e.pointerId);
                } catch (err) {
                    /* The pointer may already be released by the browser. */
                }
            }
            _this.dispatchEvent(AppEvent.ACTION, {
                name: name,
                action: action,
                pressed: false,
                phase: 'up',
            });
        }

        function _state(element, checked) {
            element.setAttribute('data-checked', !!checked);
            element.setAttribute('aria-checked', !!checked);
        }

        _this.state = function (name, checked) {
            var element = _controls[name];
            if (element && element.classList.contains('app-control-toggle')) {
                _state(element, checked);
            }
        };

        _this.value = function (name, value) {
            var element = _controls[name],
                input = element && element.querySelector('input');
            if (input && value !== undefined) {
                input.value = value;
            }
            return input && parseFloat(input.value);
        };

        _this.element = function () {
            return _container;
        };

        _this.destroy = function () {
            var buttons = _container.querySelectorAll('button'),
                sliders = _container.querySelectorAll('input[type="range"]');
            for (var name in _pressed) {
                if (_pressed.hasOwnProperty(name)) {
                    _this.dispatchEvent(AppEvent.ACTION, {
                        name: _container.getAttribute('data-domain'),
                        action: name,
                        pressed: false,
                        phase: 'up',
                    });
                }
            }
            _pressed = {};
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].removeEventListener('click', _onClick);
                buttons[i].removeEventListener('pointerdown', _onPointerDown);
                buttons[i].removeEventListener('pointerup', _onPointerUp);
                buttons[i].removeEventListener('pointercancel', _onPointerUp);
                buttons[i].removeEventListener('pointerleave', _onPointerUp);
            }
            for (var j = 0; j < sliders.length; j++) {
                sliders[j].removeEventListener('input', _onInput);
            }
        };

        _init();
    }

    Controlbar.prototype = Object.create(EventDispatcher.prototype);
    Controlbar.prototype.constructor = Controlbar;
    Controlbar.prototype.kind = 'Controlbar';
    Controlbar.prototype.CONF = _default;

    components.Controlbar = Controlbar;
})(odd);
