(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        components = odd.IM.UI.components,

        CLASS_SETTINGS = 'im-settings';

    function Settings(name, config, logger) {
        EventDispatcher.call(this, 'Settings', { logger: logger }, Event);

        var _this = this,
            _config,
            _container;

        function _init() {
            _config = config || {};
            _container = utils.createElement('section', CLASS_SETTINGS + (name ? ' ' + name : ''));
            _container.setAttribute('state', 'off');
            _this.update(_config);
        }

        _this.update = function (value) {
            _config = value || {};
            utils.emptyElement(_container);
            utils.forEach(_config.items || [], function (_, item) {
                var label = utils.createElement('label'),
                    title = utils.createElement('span'),
                    input = utils.createElement('input');
                title.textContent = item.label || item.name || '';
                input.type = item.type || 'checkbox';
                input.name = item.name || '';
                input.checked = !!item.value;
                input.addEventListener('change', _onChange);
                label.appendChild(title);
                label.appendChild(input);
                _container.appendChild(label);
            });
            return _config;
        };

        function _onChange(e) {
            _this.dispatchEvent(Event.CHANGE, {
                name: e.currentTarget.name,
                value: e.currentTarget.type === 'checkbox' ? e.currentTarget.checked : e.currentTarget.value,
            });
        }

        _this.state = function (value) {
            if (value !== undefined) {
                _container.setAttribute('state', value);
            }
            return _container.getAttribute('state');
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function () {
        };

        _this.destroy = function () {
            var inputs = _container.querySelectorAll('input');
            for (var i = 0; i < inputs.length; i++) {
                inputs[i].removeEventListener('change', _onChange);
            }
            _container.innerHTML = '';
        };

        _init();
    }

    Settings.prototype = Object.create(EventDispatcher.prototype);
    Settings.prototype.constructor = Settings;
    Settings.prototype.kind = 'Settings';

    components.Settings = Settings;
})(odd);

