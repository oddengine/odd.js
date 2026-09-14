(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        Event = events.Event,
        MouseEvent = events.MouseEvent,
        Famicom = odd.Famicom,
        Port = Famicom.Port,
        Key = Famicom.Key,
        components = Famicom.UI.components,
        Panel = components.Panel,

        CLASS_TITLE = 'pe-settings-title',
        CLASS_CONTENT = 'pe-settings-content',

        _default = {
            game: '',
            controllers: 1,
            input: 'keyboard',
            instance: '',
        };

    function Settings(name, value, logger) {
        Panel.call(this, name, 'Settings', logger, [Event.CHANGE, MouseEvent.CLICK]);

        var _this = this,
            _name = name,
            _logger = logger,
            _container,
            _game,
            _controllers,
            _input,
            _instance,
            _ports;

        function _init() {
            _this.config = utils.extendz({}, _default);

            _container = _this.element();

            _buildGame();
            _buildShortcuts();
        }

        function _buildGame() {
            var title = utils.createElement('h3', CLASS_TITLE);
            title.textContent = 'Cloud Game';
            _container.appendChild(title);

            var content = utils.createElement('div', CLASS_CONTENT);
            _container.appendChild(content);

            var label = utils.createElement('label');
            label.textContent = 'Game: ';

            _game = utils.createElement('select');
            _game.name = 'game';
            _game.onchange = _onChange;
            label.appendChild(_game);
            content.appendChild(label);

            label = utils.createElement('label');
            label.textContent = 'Local controllers: ';

            _controllers = utils.createElement('select');
            _controllers.name = 'controllers';
            _controllers.onchange = _onChange;
            for (var count = 1; count <= 4; count++) {
                var option = utils.createElement('option');
                option.value = count;
                option.textContent = count;
                _controllers.appendChild(option);
            }
            label.appendChild(_controllers);
            content.appendChild(label);

            label = utils.createElement('label');
            label.textContent = 'Input: ';

            _input = utils.createElement('select');
            _input.name = 'input';
            _input.onchange = _onChange;
            ['keyboard', 'gamepad'].forEach(function (name) {
                var option = utils.createElement('option');
                option.value = name;
                option.textContent = name === 'keyboard' ? 'Keyboard' : 'Gamepad';
                _input.appendChild(option);
            });
            label.appendChild(_input);
            content.appendChild(label);

            label = utils.createElement('label');
            label.textContent = 'Instance: ';

            _instance = utils.createElement('input');
            _instance.type = 'text';
            _instance.name = 'instance';
            _instance.onchange = _onChange;
            label.appendChild(_instance);
            content.appendChild(label);

            _ports = utils.createElement('p');
            content.appendChild(_ports);

            ['Create', 'Load', 'Join', 'Leave', 'Destroy'].forEach(function (action) {
                var button = utils.createElement('button');
                button.type = 'button';
                button.textContent = action;
                button.onclick = function () {
                    _this.dispatchEvent(MouseEvent.CLICK, { name: action.toLowerCase() });
                };
                content.appendChild(button);
            });
        }

        function _buildShortcuts() {
            var title = utils.createElement('h3', CLASS_TITLE);
            title.textContent = 'Shortcuts';
            _container.appendChild(title);

            var content = utils.createElement('div', CLASS_CONTENT);
            _container.appendChild(content);

            var table = utils.createElement('table', 'shortcuts');
            content.appendChild(table);

            var tr = utils.createElement('tr');
            tr.innerHTML = '<th>Action</th><th>P1</th><th>P2</th>';
            table.appendChild(tr);

            tr = utils.createElement('tr');
            _buildShortcut(tr, 'Up:', 'p1up', 'p2up', Key.UP);
            table.appendChild(tr);

            tr = utils.createElement('tr');
            _buildShortcut(tr, 'Down:', 'p1down', 'p2down', Key.DOWN);
            table.appendChild(tr);

            tr = utils.createElement('tr');
            _buildShortcut(tr, 'Left:', 'p1left', 'p2left', Key.LEFT);
            table.appendChild(tr);

            tr = utils.createElement('tr');
            _buildShortcut(tr, 'Right:', 'p1right', 'p2right', Key.RIGHT);
            table.appendChild(tr);

            tr = utils.createElement('tr');
            _buildShortcut(tr, 'Start:', 'p1start', 'p2start', Key.START);
            table.appendChild(tr);

            tr = utils.createElement('tr');
            _buildShortcut(tr, 'Select:', 'p1select', 'p2select', Key.SELECT);
            table.appendChild(tr);

            tr = utils.createElement('tr');
            _buildShortcut(tr, 'B:', 'p1b', 'p2b', Key.B);
            table.appendChild(tr);

            tr = utils.createElement('tr');
            _buildShortcut(tr, 'A:', 'p1a', 'p2a', Key.A);
            table.appendChild(tr);
        }

        function _buildShortcut(tr, text, name1, name2, key) {
            var label = utils.createElement('td');
            label.textContent = text;
            tr.appendChild(label);

            var input = utils.createElement('input');
            input.onkeydown = function (e) {
                e.preventDefault();
                e.currentTarget.value = e.code;
                _this.config[e.currentTarget.name] = e.code;
                _this.dispatchEvent(Event.CHANGE, {
                    name: 'keyboard',
                    value: { port: e.currentTarget.port, key: e.currentTarget.key, code: e.code },
                });
            };
            input.type = 'text';
            input.readOnly = true;
            input.name = name1;
            input.port = Port.P1;
            input.key = key;
            input.value = _this.config[name1] || '';

            var value = utils.createElement('td');
            value.appendChild(input);
            tr.appendChild(value);

            input = utils.createElement('input');
            input.onkeydown = function (e) {
                e.preventDefault();
                e.currentTarget.value = e.code;
                _this.config[e.currentTarget.name] = e.code;
                _this.dispatchEvent(Event.CHANGE, {
                    name: 'keyboard',
                    value: { port: e.currentTarget.port, key: e.currentTarget.key, code: e.code },
                });
            };
            input.type = 'text';
            input.readOnly = true;
            input.name = name2;
            input.port = Port.P2;
            input.key = key;
            input.value = _this.config[name2] || '';

            value = utils.createElement('td');
            value.appendChild(input);
            tr.appendChild(value);
        }

        function _onChange(e) {
            var input = e.currentTarget;
            _this.config[input.name] = input.name === 'controllers' ? Number(input.value) : input.value;
            _this.dispatchEvent(Event.CHANGE, { name: input.name, value: _this.config[input.name] });
        }

        _this.update = function (data) {
            data = data || {};
            _this.config = utils.extendz(_this.config, data);

            if (data.games) {
                _game.innerHTML = '';
                data.games.forEach(function (name) {
                    var option = utils.createElement('option');
                    option.value = name;
                    option.textContent = name;
                    _game.appendChild(option);
                });
            }

            _game.value = _this.config.game;
            _controllers.value = _this.config.controllers;
            _input.value = _this.config.input;
            _instance.value = _this.config.instance;
            _ports.textContent = 'Ports: ' + (data.ports || []).map(function (port, index) {
                return 'Local P' + (index + 1) + ' → P' + (port + 1);
            }).join(', ');

            if (data.keyboard) {
                var inputs = _container.querySelectorAll('input[readonly]');
                Array.prototype.forEach.call(inputs, function (input) {
                    input.value = '';
                    utils.forEach(data.keyboard, function (code, binding) {
                        if (binding[0] === input.port && binding[1] === input.key) {
                            input.value = code;
                        }
                    });
                });
            }
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

