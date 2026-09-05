(function (odd) {
    var utils = odd.utils,
        OS = odd.OS,
        Browser = odd.Browser,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        MouseEvent = events.MouseEvent,
        TouchEvent = events.TouchEvent,
        Famicom = odd.Famicom,
        UI = Famicom.UI,
        components = UI.components,

        CLASS_CONTROLBAR = 'pe-controlbar',
        CLASS_TOOLTIP = 'pe-tooltip',

        _regi = /\[([a-z]+)\:([a-z]+)=([^\]]+)?\]/gi,
        _default = {
            kind: 'Controlbar',
            layout: '[Label:player=P1]' +
                    '[Label:rtt=0(ms)]' +
                    '|' +
                    '[Label:left=Left(A)]' +
                    '[Label:up=Up(W)]' +
                    '[Label:down=Down(S)]' +
                    '[Label:right=Right(D)]' +
                    '|' +
                    '[Label:select=Select(G)]' +
                    '[Label:start=Start(H)]' +
                    '[Label:b=B(J)]' +
                    '[Label:a=A(K)]' +
                    '|' +
                    '[Button:capture=Capture]' +
                    '[Toggle:muted=off off=Mute;on=Unmute]' +
                    '[Toggle:layout=right right=Right;top=Top;grid=Grid]' +
                    '[Toggle:theater=off off=Enter Theater Mode;on=Exit Theater Mode]' +
                    '[Toggle:fullscreen=off off=Enter Fullscreen;on=Exit Fullscreen]',
            visibility: true,
        };

    function Controlbar(config, logger) {
        EventDispatcher.call(this, 'Controlbar', { logger: logger }, MouseEvent, TouchEvent);

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
            if (layouts.length !== 4) {
                throw { name: 'DataError', message: 'Controlbar should have exactly 4 sections.' };
            }

            var sections = ['left', 'center', 'center', 'right'];
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
            switch (name) {
                case 'capture':
                    if (OS.isIOS && !Browser.isSafari) {
                        return;
                    }
                    break;
                case 'muted':
                case 'volume':
                    if (OS.isMobile) {
                        return;
                    }
                    break;
            }

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

