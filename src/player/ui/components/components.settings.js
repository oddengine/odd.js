(function (odd) {
    var utils = odd.utils,
        css = utils.css,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        components = odd.Player.UI.components,
        Panel = components.Panel,

        CLASS_SETTINGS = 'pe-settings';

    function Settings(name, value, logger) {
        Panel.call(this, name, 'Settings', logger, [Event.CHANGE]);

        var _this = this,
            _name = name,
            _logger = logger,
            _microphone,
            _camera,
            _profile,
            _brightness,
            _smoothness,
            _video;

        function _init() {
            _name = name;
        }

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _this.destroy = function () {
            _container.innerHTML = '';
        };

        _init();
    }

    Settings.prototype = Object.create(EventDispatcher.prototype);
    Settings.prototype.constructor = Settings;
    Settings.prototype.kind = 'Settings';

    components.Settings = Settings;
})(odd);

