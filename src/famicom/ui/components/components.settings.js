(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        Event = events.Event,
        Famicom = odd.Famicom,
        Port = Famicom.Port,
        Key = Famicom.Key,
        components = Famicom.UI.components,
        Panel = components.Panel,

        CLASS_TITLE = 'pe-settings-title',
        CLASS_CONTENT = 'pe-settings-content',

        _default = {
            'p1up': 'KeyW',
            'p1down': 'KeyS',
            'p1left': 'KeyA',
            'p1right': 'KeyD',
            'p1start': 'KeyH',
            'p1select': 'KeyG',
            'p1b': 'KeyJ',
            'p1a': 'KeyK',
            'p2up': 'ArrowUp',
            'p2down': 'ArrowDown',
            'p2left': 'ArrowLeft',
            'p2right': 'ArrowRight',
            'p2start': 'Numpad3',
            'p2select': 'Numpad2',
            'p2b': 'Numpad0',
            'p2a': 'NumpadDecimal',
        };

    function Settings(name, value, logger) {
        Panel.call(this, name, 'Settings', logger, [Event.CHANGE]);

        var _this = this,
            _name = name,
            _logger = logger,
            _container;

        function _init() {
            _this.config = utils.extendz({}, _default);

            _container = _this.element();

            _buildShortcuts();
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
            _buildShortcut(tr, 'P1 Up:', 'p1up', 'p2up', Key.UP);
            table.appendChild(tr);

            tr = utils.createElement('tr');
            _buildShortcut(tr, 'P1 Down:', 'p1down', 'p2down', Key.DOWN);
            table.appendChild(tr);

            tr = utils.createElement('tr');
            _buildShortcut(tr, 'P1 Left:', 'p1left', 'p2left', Key.LEFT);
            table.appendChild(tr);

            tr = utils.createElement('tr');
            _buildShortcut(tr, 'P1 Right:', 'p1right', 'p2right', Key.RIGHT);
            table.appendChild(tr);

            tr = utils.createElement('tr');
            _buildShortcut(tr, 'P1 Start:', 'p1start', 'p2start', Key.START);
            table.appendChild(tr);

            tr = utils.createElement('tr');
            _buildShortcut(tr, 'P1 Select:', 'p1select', 'p2select', Key.SELECT);
            table.appendChild(tr);

            tr = utils.createElement('tr');
            _buildShortcut(tr, 'P1 B:', 'p1b', 'p2b', Key.B);
            table.appendChild(tr);

            tr = utils.createElement('tr');
            _buildShortcut(tr, 'P1 A:', 'p1a', 'p2a', Key.A);
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
                _this.dispatchEvent(Event.CHANGE, { name: _name, value: e.currentTarget });
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
                _this.dispatchEvent(Event.CHANGE, { name: _name, value: e.currentTarget });
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

        _init();
    }

    Settings.prototype = Object.create(Panel.prototype);
    Settings.prototype.constructor = Settings;
    Settings.prototype.kind = 'Settings';

    components.Settings = Settings;
})(odd);

