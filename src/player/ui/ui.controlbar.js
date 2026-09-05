(function (odd) {
    var utils = odd.utils,
        css = utils.css,
        OS = odd.OS,
        Browser = odd.Browser,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        MouseEvent = events.MouseEvent,
        Player = odd.Player,
        UI = Player.UI,
        components = UI.components,

        CLASS_CONTROLBAR = 'pe-controlbar',
        CLASS_TOOLTIP = 'pe-tooltip',

        _regi = /\[([a-z]+)\:([a-z-]+)=([^\]]*)\]/gi,
        _default = {
            kind: 'Controlbar',
            layout: '[Toggle:playing=off off=Play;on=Pause]' +
                    '[Button:reload=Reload]' +
                    '[Button:stop=Stop]' +
                    '[Label:quote=Live broadcast]' +
                    '[Label:time=00:00/00:00]' +
                    '||' +
                    '[Button:report=Report]' +
                    '[Button:capture=Capture]' +
                    '[Button:download=Download]' +
                    '[Toggle:calling=off off=Call;on=Hang Up]' +
                    '[Toggle:muted=off off=Mute;on=Unmute]' +
                    '[Slider:volume=80]' +
                    '[Select:definition=Definition]' +
                    '[Toggle:comments=on off=Comments Off;on=Comments On]' +
                    '[Toggle:layout=right right=Right;top=Top;grid=Grid]' +
                    '[Button:settings=Settings]' +
                    '[Toggle:theater=off off=Enter Theater Mode;on=Exit Theater Mode]' +
                    '[Toggle:fullscreen=off off=Enter Fullscreen;on=Exit Fullscreen]',
            autohide: true,
            visibility: true,
        };

    function Controlbar(config, logger) {
        EventDispatcher.call(this, 'Controlbar', { logger: logger }, [Event.CHANGE, MouseEvent.CLICK, MouseEvent.MOUSEMOVE]);

        var _this = this,
            _logger = logger,
            _container,
            _content,
            _timebar;

        function _init() {
            _this.config = config;
            _this.components = {};

            _container = utils.createElement('div', CLASS_CONTROLBAR);

            _content = utils.createElement('div');
            _container.appendChild(_content);

            _buildComponents();
        }

        function _buildComponents() {
            _timebar = new components.Slider('timebar', undefined, _logger);
            _timebar.addGlobalListener(_this.forward);
            _container.appendChild(_timebar);
            _this.components['timebar'] = _timebar;

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
                case 'download':
                    if (!window.TransformStream) {
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
            utils.forEach(_this.components, function (name, component) {
                component.resize(width, height);

                switch (name) {
                    case 'timebar':
                        break;
                    default:
                        if (component.tooltip === undefined) {
                            break;
                        }

                        var element = component.element();
                        var tooltip = component.tooltip;
                        var offset = (element.clientWidth - tooltip.clientWidth) / 2;

                        var left = offset + element.offsetLeft;
                        if (left < 1 && element.offsetParent === _content) {
                            css.style(tooltip, {
                                'left': 1 - element.offsetLeft + 'px',
                                'right': 'auto',
                            });
                            break;
                        }

                        // Skips element whose display == none
                        if (element.offsetParent === null) {
                            break;
                        }

                        var right = element.offsetParent.offsetLeft + left + tooltip.clientWidth;
                        if (right > _content.clientWidth - 1) {
                            css.style(tooltip, {
                                'left': 'auto',
                                'right': element.offsetParent.offsetLeft + element.offsetLeft + element.clientWidth + 1 - _content.clientWidth + 'px',
                            });
                        } else {
                            css.style(tooltip, {
                                'left': offset + 'px',
                                'right': 'auto',
                            });
                        }
                        break;
                }
            });
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

