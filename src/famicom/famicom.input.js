(function (odd) {
    var Famicom = odd.Famicom,
        Key = Famicom.Key;

    // One controller surface combines independent pointers, keyboard and a
    // physical gamepad. The host owns placement; only the SDK emits game input.
    function Input(api, container) {
        var _this = this,
            _root = document.createElement('div'),
            _pointers = new Map(),
            _stickPointer = null,
            _keyboard = new Map(),
            _mask = 0,
            _port = -1,
            _enabled = true,
            _frame = 0,
            _pad = 0,
            _neutral = true,
            _closed = false,
            _bindings = Object.assign({}, Input.Keyboard);

        _root.className = 'odd-famicom-pad';
        _root.setAttribute('aria-label', '游戏手柄');
        container.appendChild(_root);
        var direction = document.createElement('div');
        direction.className = 'game-dpad';
        direction.setAttribute('role', 'group');
        direction.setAttribute('aria-label', '方向摇杆');
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
        var thumb = document.createElement('span');
        thumb.className = 'game-stick-thumb';
        thumb.setAttribute('aria-hidden', 'true');
        direction.appendChild(thumb);
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
        // Only the control surface consumes gestures. Page/chat zoom remains
        // available; non-passive touch handlers also suppress Safari double taps.
        function _gesture(event) {
            if (_enabled && event.cancelable) event.preventDefault();
        }
        ['touchstart', 'touchmove', 'touchend', 'gesturestart', 'dblclick'].forEach(
            function (type) { _root.addEventListener(type, _gesture, { passive: false }); },
        );
        // One captured pointer drives a circular, eight-way stick. A/B and
        // keyboard input remain independent; crossing the edge never drops it.
        function _direction(event) {
            if (event.pointerId !== _stickPointer) {
                return;
            }
            event.preventDefault();
            var bounds = direction.getBoundingClientRect(),
                x = event.clientX - bounds.left - bounds.width / 2,
                y = event.clientY - bounds.top - bounds.height / 2,
                radius = Math.min(bounds.width, bounds.height) * 0.28,
                distance = Math.hypot(x, y),
                travel = distance ? Math.min(1, radius / distance) : 0,
                mask = 0;
            if (distance > Math.max(6, radius * 0.18)) {
                var sector = (Math.round(Math.atan2(y, x) / (Math.PI / 4)) + 8) % 8;
                mask = [Key.RIGHT, Key.RIGHT | Key.DOWN, Key.DOWN,
                    Key.DOWN | Key.LEFT, Key.LEFT, Key.LEFT | Key.UP,
                    Key.UP, Key.UP | Key.RIGHT][sector];
            }
            thumb.style.transform = 'translate(' + x * travel + 'px,' + y * travel + 'px)';
            _pointers.set(event.pointerId, mask);
            _apply();
        }
        direction.addEventListener('pointerdown', function (event) {
            if (!_enabled || event.button > 0 || _stickPointer !== null) {
                return;
            }
            event.preventDefault();
            direction.setPointerCapture(event.pointerId);
            _stickPointer = event.pointerId;
            direction.classList.add('is-dragging');
            _pointers.set(event.pointerId, 0);
            _direction(event);
        });
        direction.addEventListener('pointermove', _direction);
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(
            function (type) {
                direction.addEventListener(type, function (event) {
                    if (event.pointerId !== _stickPointer) return;
                    _pointers.delete(event.pointerId);
                    _resetStick();
                    _apply();
                });
            },
        );
        function _resetStick() {
            var pointer = _stickPointer;
            _stickPointer = null;
            direction.classList.remove('is-dragging');
            thumb.style.transform = '';
            if (pointer !== null && direction.hasPointerCapture(pointer)) {
                direction.releasePointerCapture(pointer);
            }
        }
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
            _resetStick();
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
        _this.keyboard = function (value) {
            if (value === undefined) {
                return Object.assign({}, _bindings);
            }
            if (!Input.isKeyboard(value)) {
                return false;
            }
            // A held key belongs to the old mapping and must never carry over.
            _clear();
            _bindings = Object.assign({}, value);
            return true;
        };
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
    Input.Keyboard = Object.freeze({
        ArrowUp: Key.UP, ArrowDown: Key.DOWN,
        ArrowLeft: Key.LEFT, ArrowRight: Key.RIGHT,
        KeyW: Key.UP, KeyS: Key.DOWN, KeyA: Key.LEFT, KeyD: Key.RIGHT,
        KeyG: Key.SELECT, KeyH: Key.START, KeyJ: Key.B, KeyK: Key.A,
    });
    Input.isKeyboard = function (value) {
        return value !== null && typeof value === 'object' &&
            !Array.isArray(value) && Object.keys(value).length <= 32 &&
            Object.entries(value).every(function (entry) {
                return /^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Arrow(Up|Down|Left|Right)|Enter|NumpadEnter|Space|Shift(Left|Right))$/.test(entry[0]) &&
                    Object.values(Key).includes(entry[1]);
            });
    };
    Famicom.Input = Input;
})(odd);
