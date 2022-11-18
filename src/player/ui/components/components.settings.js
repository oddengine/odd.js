(function (odd) {
    var utils = odd.utils,
        css = utils.css,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        GlobalEvent = events.GlobalEvent,
        Player = odd.Player,
        UI = Player.UI,
        components = UI.components,
        Panel = components.Panel,

        CLASS_SETTINGS = 'pe-settings';

    function Settings(name, kind, logger) {
        Panel.call(this, name, 'Settings', logger, [GlobalEvent.CHANGE]);

        var _this = this,
            _name,
            _logger = logger,
            _profile,
            _camera,
            _microphone,
            _video,
            _audio,
            _brightness,
            _smoothness;

        function _init() {
            _name = name;
        }

        _this.resize = function (width, height) {

        };

        _init();
    }

    Settings.prototype = Object.create(EventDispatcher.prototype);
    Settings.prototype.constructor = Settings;
    Settings.prototype.kind = 'Panel';

    components.Settings = Settings;
})(odd);

