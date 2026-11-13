(function (odd) {
    var Famicom = odd.Famicom,
        Key = Famicom.Key;

    // One controller surface combines independent pointers, keyboard and a
    // physical gamepad. The host owns placement; only the SDK emits game input.
    function Input(api, container) {
        var _this = this,
            _root = document.createElement('div'),
            _pointers = new Map(),
            _keyboard = new Map(),
            _mask = 0,
            _port = -1,
            _enabled = true,
            _frame = 0,
            _pad = 0,
            _neutral = true,
            _closed = false,
            _bindings = {
                ArrowUp: Key.UP,
                ArrowDown: Key.DOWN,
                ArrowLeft: Key.LEFT,
                ArrowRight: Key.RIGHT,
                KeyW: Key.UP,
                KeyS: Key.DOWN,
                KeyA: Key.LEFT,
                KeyD: Key.RIGHT,
                KeyZ: Key.B,
                KeyX: Key.A,
                Enter: Key.START,
                ShiftRight: Key.SELECT,
            };

        _root.className = 'odd-famicom-pad';
        _root.setAttribute('aria-label', '游戏手柄');
        container.appendChild(_root);
        var direction = document.createElement('div');
        direction.className = 'game-dpad';
        direction.setAttribute('role', 'group');
        direction.setAttribute('aria-label', '方向键');
        _root.appendChild(direction);
        var arrows = [
            ['上', Key.UP, 'up'],
            ['下', Key.DOWN, 'down'],
            ['左', Key.LEFT, 'left'],
            ['右', Key.RIGHT, 'right'],
        ];
        arrows.forEach(function (item) {
            var button = _button(item[0], item[1], 'direction-' + item[2]);
            button.innerHTML =
                '<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="m6 14 6-6 6 6" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
            direction.appendChild(button);
        });
        var actions = document.createElement('div');
        actions.className = 'game-actions';
        _root.appendChild(actions);
        actions.appendChild(_button('B', Key.B, 'game-key-b'));
        actions.appendChild(_button('A', Key.A, 'game-key-a'));
        var system = document.createElement('div');
        system.className = 'game-system';
        _root.appendChild(system);
        system.appendChild(_button('SELECT', Key.SELECT, 'game-key-select'));
        system.appendChild(_button('START', Key.START, 'game-key-start'));

        function _button(label, key, className) {
            var button = document.createElement('button');
            button.type = 'button';
            button.textContent = label;
            button.className = className;
            button.dataset.key = String(key);
            button.setAttribute('aria-label', label);
            button.addEventListener('blur', _clear);
            button.addEventListener('contextmenu', function (event) {
                event.preventDefault();
            });
            button.addEventListener('pointerdown', function (event) {
                if (button.parentNode === direction) {
                    return;
                }
                if (!_enabled || event.button > 0) {
                    return;
                }
                event.preventDefault();
                button.setPointerCapture(event.pointerId);
                _pointers.set(event.pointerId, key);
                button.classList.add('pressed');
                _apply();
            });
            function release(event) {
                _pointers.delete(event.pointerId);
                if (!Array.from(_pointers.values()).includes(key)) {
                    button.classList.remove('pressed');
                }
                _apply();
            }
            button.addEventListener('pointerup', release);
            button.addEventListener('pointercancel', release);
            button.addEventListener('lostpointercapture', release);
            return button;
        }
        // The whole D-pad supports sliding between directions and diagonals;
        // pointers on A/B remain independent of its active touch identifier.
        function _direction(event) {
            if (!_pointers.has(event.pointerId)) {
                return;
            }
            var bounds = direction.getBoundingClientRect(),
                x = (event.clientX - bounds.left) / bounds.width - 0.5,
                y = (event.clientY - bounds.top) / bounds.height - 0.5,
                mask = 0;
            if (Math.hypot(x, y) > 0.13) {
                if (x < -0.16) {
                    mask |= Key.LEFT;
                } else if (x > 0.16) {
                    mask |= Key.RIGHT;
                }
                if (y < -0.16) {
                    mask |= Key.UP;
                } else if (y > 0.16) {
                    mask |= Key.DOWN;
                }
            }
            _pointers.set(event.pointerId, mask);
            _apply();
        }
        direction.addEventListener('pointerdown', function (event) {
            if (!_enabled || event.button > 0) {
                return;
            }
            event.preventDefault();
            direction.setPointerCapture(event.pointerId);
            _pointers.set(event.pointerId, 0);
            _direction(event);
        });
        direction.addEventListener('pointermove', _direction);
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(
            function (type) {
                direction.addEventListener(type, function (event) {
                    _pointers.delete(event.pointerId);
                    _apply();
                });
            },
        );
        function _apply() {
            var next = _pad,
                port = api.ports()[0];
            _pointers.forEach(function (key) {
                next |= key;
            });
            _keyboard.forEach(function (key) {
                next |= key;
            });
            if (!_enabled || port === undefined) {
                next = 0;
            }
            if (_port !== port) {
                if (_port >= 0) {
                    api.keyUp(_port, 255);
                }
                _mask = 0;
                _port = port;
            }
            if (port !== undefined && next !== _mask) {
                api.keyUp(port, _mask & ~next);
                api.keyDown(port, next & ~_mask);
            }
            _mask = next;
            _root.querySelectorAll('button').forEach(function (button) {
                button.classList.toggle(
                    'pressed',
                    !!(next & Number(button.dataset.key)),
                );
            });
        }
        function _key(event) {
            // Release the original key even if focus moved while it was held.
            if (event.type === 'keyup' && _keyboard.has(event.code)) {
                event.preventDefault();
                _keyboard.delete(event.code);
                _apply();
                return;
            }
            var target = event.target.closest?.(
                    'button,a[href],input,textarea,select,[contenteditable="true"],[role="button"],[role="link"]',
                ),
                button =
                    target &&
                    _root.contains(target) &&
                    target.matches('button[data-key]')
                        ? target
                        : null,
                key =
                    button && (event.code === 'Enter' || event.code === 'Space')
                        ? Number(button.dataset.key)
                        : _bindings[event.code];
            if (
                !_enabled ||
                !key ||
                event.ctrlKey ||
                event.metaKey ||
                event.altKey ||
                (target && !button)
            ) {
                return;
            }
            event.preventDefault();
            if (event.type === 'keydown') {
                if (event.repeat && !_keyboard.has(event.code)) return;
                _keyboard.set(event.code, key);
            }
            _apply();
        }
        function _clear() {
            _pointers.clear();
            _keyboard.clear();
            _pad = 0;
            _neutral = false;
            _apply();
            api.clearInput();
            _root.querySelectorAll('.pressed').forEach(function (button) {
                button.classList.remove('pressed');
            });
        }
        function _visibility() {
            if (document.hidden) {
                _clear();
            }
        }
        function _poll() {
            if (_closed) {
                return;
            }
            _pad = 0;
            var gamepad =
                _enabled && !document.hidden && navigator.getGamepads
                    ? Array.from(navigator.getGamepads()).find(Boolean)
                    : null;
            if (gamepad) {
                var pressed = function (index) {
                    return (
                        gamepad.buttons[index] && gamepad.buttons[index].pressed
                    );
                };
                if (gamepad.axes[0] < -0.4 || pressed(14)) {
                    _pad |= Key.LEFT;
                }
                if (gamepad.axes[0] > 0.4 || pressed(15)) {
                    _pad |= Key.RIGHT;
                }
                if (gamepad.axes[1] < -0.4 || pressed(12)) {
                    _pad |= Key.UP;
                }
                if (gamepad.axes[1] > 0.4 || pressed(13)) {
                    _pad |= Key.DOWN;
                }
                if (pressed(0)) {
                    _pad |= Key.A;
                }
                if (pressed(1)) {
                    _pad |= Key.B;
                }
                if (pressed(8)) {
                    _pad |= Key.SELECT;
                }
                if (pressed(9)) {
                    _pad |= Key.START;
                }
            }
            if (!_neutral) {
                if (_pad === 0 && _enabled) {
                    _neutral = true;
                }
                _pad = 0;
            }
            _apply();
            _frame = requestAnimationFrame(_poll);
        }
        _this.enabled = function (value) {
            if (value === undefined) {
                return _enabled;
            }
            _enabled = !!value;
            _clear();
            _root.querySelectorAll('button').forEach(function (button) {
                button.disabled = !_enabled;
            });
        };
        _this.clear = _clear;
        _this.element = function () {
            return _root;
        };
        _this.destroy = function () {
            if (_closed) {
                return;
            }
            _closed = true;
            _clear();
            cancelAnimationFrame(_frame);
            window.removeEventListener('keydown', _key);
            window.removeEventListener('keyup', _key);
            window.removeEventListener('blur', _clear);
            window.removeEventListener('orientationchange', _clear);
            document.removeEventListener('visibilitychange', _visibility);
            _root.remove();
        };
        window.addEventListener('keydown', _key);
        window.addEventListener('keyup', _key);
        window.addEventListener('blur', _clear);
        window.addEventListener('orientationchange', _clear);
        document.addEventListener('visibilitychange', _visibility);
        _poll();
    }
    Famicom.Input = Input;
})(odd);
