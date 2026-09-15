(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        Event = events.Event,
        MouseEvent = events.MouseEvent,
        Key = odd.Famicom.Key,
        components = odd.Famicom.UI.components,
        Panel = components.Panel,
        CLASS_TITLE = 'pe-settings-title',
        CLASS_CONTENT = 'pe-settings-content';

    function Settings(name, value, logger) {
        Panel.call(this, name, 'Settings', logger, [Event.CHANGE, MouseEvent.CLICK]);

        var _this = this,
            _container = _this.element(),
            _game,
            _input,
            _instance,
            _summary,
            _rows,
            _message,
            _add,
            _sync,
            _actions = [];

        _this.config = { game: '', input: 'keyboard', instance: '', slots: { ports: [] },
            bindings: [], devices: [], profiles: [], touch: null, pending: '', message: '' };

        function _init() {
            var title = utils.createElement('h3', CLASS_TITLE);
            title.textContent = 'Cloud Game';
            _container.appendChild(title);
            var content = utils.createElement('div', CLASS_CONTENT);
            _container.appendChild(content);

            var label = utils.createElement('label');
            label.textContent = 'Game to create: ';
            _game = utils.createElement('select');
            _game.name = 'game';
            _game.onchange = _onChange;
            label.appendChild(_game);
            content.appendChild(label);

            label = utils.createElement('label');
            label.textContent = 'Instance to join: ';
            _instance = utils.createElement('input');
            _instance.name = 'instance';
            _instance.onchange = _onChange;
            label.appendChild(_instance);
            content.appendChild(label);
            ['Create', 'Join', 'Leave', 'Destroy'].forEach(function (action) {
                var button = utils.createElement('button');
                button.type = 'button';
                button.textContent = action;
                button.onclick = function () {
                    _this.dispatchEvent(MouseEvent.CLICK, { name: action.toLowerCase(), game: _game.value });
                };
                content.appendChild(button);
                _actions.push(button);
            });

            title = utils.createElement('h3', CLASS_TITLE);
            title.textContent = 'Controllers';
            _container.appendChild(title);
            content = utils.createElement('div', CLASS_CONTENT);
            _container.appendChild(content);
            label = utils.createElement('label');
            label.textContent = 'Input mode: ';
            _input = utils.createElement('select');
            _input.name = 'input';
            _input.onchange = _onChange;
            ['keyboard', 'gamepad'].forEach(function (mode) {
                var option = utils.createElement('option');
                option.value = mode;
                option.textContent = mode === 'keyboard' ? 'Keyboard' : 'Gamepad';
                _input.appendChild(option);
            });
            label.appendChild(_input);
            content.appendChild(label);
            _summary = utils.createElement('p');
            content.appendChild(_summary);
            _rows = utils.createElement('div');
            content.appendChild(_rows);
            _add = utils.createElement('button');
            _add.type = 'button';
            _add.textContent = 'Add controller';
            _add.onclick = function () { _this.dispatchEvent(MouseEvent.CLICK, { name: 'allocate' }); };
            content.appendChild(_add);
            _sync = utils.createElement('button');
            _sync.type = 'button';
            _sync.textContent = 'Refresh slots';
            _sync.onclick = function () { _this.dispatchEvent(MouseEvent.CLICK, { name: 'sync' }); };
            content.appendChild(_sync);
            _message = utils.createElement('p');
            _message.setAttribute('role', 'status');
            _message.setAttribute('aria-live', 'polite');
            content.appendChild(_message);
            var close = utils.createElement('button');
            close.type = 'button';
            close.textContent = 'Done';
            close.onclick = _this.hide;
            content.appendChild(close);
        }

        function _onChange(e) {
            var input = e.currentTarget;
            _this.config[input.name] = input.value;
            _this.dispatchEvent(Event.CHANGE, { name: input.name, value: input.value });
        }

        function _buildSlot(binding) {
            var port = binding.port;
            var row = utils.createElement('fieldset', 'pe-controller-slot');
            var legend = utils.createElement('legend');
            legend.textContent = 'Player ' + (port + 1);
            row.appendChild(legend);
            var label = utils.createElement('label');
            label.textContent = _this.config.input === 'keyboard' ? 'Keyboard layout: ' : 'Device: ';
            var select = utils.createElement('select');
            label.appendChild(select);
            row.appendChild(label);
            if (_this.config.input === 'keyboard') {
                _this.config.profiles.concat(['custom']).forEach(function (profile) {
                    var option = utils.createElement('option');
                    option.value = profile;
                    option.textContent = profile === 'custom' ? 'Custom keys' : profile;
                    select.appendChild(option);
                });
                select.value = binding.profile;
                select.onchange = function () {
                    _this.dispatchEvent(Event.CHANGE, { name: 'binding', value: {
                        port: port, source: { type: 'keyboard', profile: select.value },
                    } });
                };
                var table = utils.createElement('table', 'shortcuts');
                ['UP', 'DOWN', 'LEFT', 'RIGHT', 'START', 'SELECT', 'B', 'A'].forEach(function (name) {
                    var tr = utils.createElement('tr');
                    var caption = utils.createElement('th');
                    caption.textContent = name;
                    tr.appendChild(caption);
                    var td = utils.createElement('td');
                    var input = utils.createElement('input');
                    input.type = 'text';
                    input.readOnly = true;
                    input.setAttribute('aria-label', 'Player ' + (port + 1) + ' ' + name);
                    input.placeholder = 'Press a key';
                    input.value = Object.keys(binding.keyboard).filter(function (code) {
                        return binding.keyboard[code] === Key[name];
                    }).join(' / ');
                    input.onkeydown = function (e) {
                        if (e.code === 'Tab') return;
                        e.preventDefault();
                        e.stopPropagation();
                        if (e.repeat) return;
                        _this.dispatchEvent(Event.CHANGE, { name: 'keyboard', value: {
                            port: port, key: Key[name], code: e.code === 'Backspace' || e.code === 'Delete' ? '' : e.code,
                        } });
                    };
                    td.appendChild(input);
                    tr.appendChild(td);
                    table.appendChild(tr);
                });
                row.appendChild(table);
            } else {
                var option = utils.createElement('option');
                option.value = '';
                option.textContent = binding.gamepad && !binding.gamepad.connected ? 'Disconnected — select a device' : 'Select a gamepad';
                select.appendChild(option);
                _this.config.devices.forEach(function (device) {
                    var option = utils.createElement('option');
                    option.value = device.index;
                    option.textContent = 'Gamepad ' + (device.index + 1) + ' — ' + device.id;
                    option.disabled = _this.config.bindings.some(function (other) {
                        return other.port !== port && other.gamepad && other.gamepad.connected && other.gamepad.index === device.index;
                    });
                    select.appendChild(option);
                });
                select.value = binding.gamepad && binding.gamepad.connected ? String(binding.gamepad.index) : '';
                select.onchange = function () {
                    _this.dispatchEvent(Event.CHANGE, { name: 'binding', value: {
                        port: port, source: { type: 'gamepad', index: select.value === '' ? null : Number(select.value) },
                    } });
                };
                if (!_this.config.devices.length) {
                    var hint = utils.createElement('p');
                    hint.textContent = 'Connect a gamepad and press a button to detect it.';
                    row.appendChild(hint);
                }
            }
            var touch = utils.createElement('button');
            touch.type = 'button';
            touch.textContent = _this.config.touch === port ? 'Touch control selected' : 'Use touch control here';
            touch.onclick = function () { _this.dispatchEvent(Event.CHANGE, { name: 'touch', value: port }); };
            row.appendChild(touch);
            var remove = utils.createElement('button');
            remove.type = 'button';
            remove.textContent = 'Remove controller';
            remove.disabled = _this.config.slots.ports.length <= 1 || _this.config.slots.revision === undefined;
            remove.title = _this.config.slots.ports.length <= 1 ? 'Leave the game to release the last controller.' : '';
            remove.onclick = function () { _this.dispatchEvent(MouseEvent.CLICK, { name: 'release', port: port }); };
            row.appendChild(remove);
            row.disabled = !!_this.config.pending;
            _rows.appendChild(row);
        }

        _this.update = function (data) {
            data = data || {};
            // Runtime assignments are complete snapshots, including absent revision/state fields.
            _this.config = Object.assign({}, _this.config, data);
            if (data.games) {
                _game.innerHTML = '';
                var placeholder = utils.createElement('option');
                placeholder.value = '';
                placeholder.textContent = 'Select a game';
                _game.appendChild(placeholder);
                data.games.forEach(function (name) {
                    var option = utils.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    _game.appendChild(option);
                });
            }
            _game.value = _this.config.game;
            _input.value = _this.config.input;
            _instance.value = _this.config.instance;
            var slots = _this.config.slots;
            _summary.textContent = slots.ports.length ? slots.ports.length + ' controller slot(s) assigned' : 'Join a game to configure controllers.';
            _rows.innerHTML = '';
            slots.ports.forEach(function (port) {
                var binding = _this.config.bindings.find(function (binding) { return binding.port === port; });
                if (binding) _buildSlot(binding);
            });
            var pending = _this.config.pending;
            _add.disabled = !!pending || !slots.canAllocate || slots.revision === undefined || slots.disconnected;
            _sync.disabled = !!pending || !slots.ports.length || slots.disconnected;
            _input.disabled = !!pending;
            _game.disabled = !!pending;
            _instance.disabled = !!pending;
            _actions.forEach(function (button) { button.disabled = !!pending; });
            _add.textContent = pending === 'allocate' ? 'Requesting controller…' : 'Add controller';
            _message.textContent = pending ? 'Processing ' + pending + '…' : _this.config.message;
            return _this.config;
        };

        _this.destroy = function () {
            var inputs = _container.querySelectorAll('input, select, button');
            Array.prototype.forEach.call(inputs, function (input) {
                input.onchange = null;
                input.onkeydown = null;
                input.onclick = null;
            });
            _container.innerHTML = '';
        };

        _init();
    }

    Settings.prototype = Object.create(Panel.prototype);
    Settings.prototype.constructor = Settings;
    Settings.prototype.kind = 'Settings';
    components.Settings = Settings;
})(odd);

