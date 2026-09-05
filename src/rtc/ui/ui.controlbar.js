(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        MouseEvent = events.MouseEvent,
        RTC = odd.RTC,
        UI = RTC.UI,
        components = UI.components,

        CLASS_CONTROLBAR = 'pe-controlbar',
        CLASS_TOOLTIP = 'pe-tooltip',

        _regi = /\[([a-z]+)\:([a-z-]+)=([^\]]*)\]/gi,
        _default = {
            kind: 'Controlbar',
            layout: '[Toggle:microphone=on off=Microphone Off;on=Microphone On]' +
                    '[Toggle:camera=on off=Camera Off;on=Camera On]' +
                    '[Toggle:sharing=off off=Share Screen;on=Stop Sharing]' +
                    '|' +
                    '[Toggle:calling=off off=Call;on=Hang Up]' +
                    '|' +
                    '[Toggle:layout=right right=Right;top=Top;grid=Grid]' +
                    '[Button:settings=Settings]' +
                    '[Toggle:theater=off off=Enter Theater Mode;on=Exit Theater Mode]' +
                    '[Toggle:fullscreen=off off=Enter Fullscreen;on=Exit Fullscreen]',
            autohide: true,
            visibility: true,
        };

    function Controlbar(config, logger) {
        EventDispatcher.call(this, 'Controlbar', { logger: logger }, MouseEvent);

        var _this = this,
            _logger = logger,
            _container,
            _content;

        function _init() {
            _this.config = config;
            _this.components = {};

            _container = utils.createElement('div', CLASS_CONTROLBAR);

            _content = utils.createElement('div');
            _container.appendChild(_content);

            _buildComponents();
        }

        function _buildComponents() {
            var layouts = _this.config.layout.split('|');
            if (layouts.length !== 3) {
                throw { name: 'DataError', message: 'Controlbar should have exactly 3 sections.' };
            }

            var sections = ['left', 'center', 'right'];
            for (var i = 0; i < layouts.length; i++) {
                var section = utils.createElement('div', 'pe-' + sections[i]);
                var arr;
                while ((arr = _regi.exec(layouts[i])) !== null) {
                    _buildComponent(section, arr[1], arr[2], arr[3]);
                }
                _content.appendChild(section);
            }
        }

        function _buildComponent(container, type, name, value) {
            var component = new components[type](name, value, _logger);
            component.addGlobalListener(_this.forward);
            container.appendChild(component.element());
            _this.components[name] = component;
        }

        _this.state = function (name, value) {
            var component = _this.components[name];
            if (component && component.kind === 'Toggle') {
                component.switch(value);
            }
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _this.destroy = function () {
            utils.forEach(_this.components, function (_, component) {
                component.removeGlobalListener(_this.forward);
                component.destroy();
            });
            _this.components = {};
        };

        _init();
    }

    Controlbar.prototype = Object.create(EventDispatcher.prototype);
    Controlbar.prototype.constructor = Controlbar;
    Controlbar.prototype.kind = 'Controlbar';
    Controlbar.prototype.CONF = _default;

    UI.register(Controlbar);
})(odd);

