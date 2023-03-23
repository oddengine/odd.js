(function (odd) {
    var utils = odd.utils,
        css = utils.css,
        OS = odd.OS,
        Browser = odd.Browser,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        KeyboardEvent = events.KeyboardEvent,
        NES = odd.NES,
        UI = NES.UI,
        components = UI.components,

        CLASS_CONTROLBAR = 'nes-controlbar',
        CLASS_LEFT = 'nes-left',
        CLASS_CENTER = 'nes-center',
        CLASS_RIGHT = 'nes-right',
        CLASS_TOOLTIP = 'nes-tooltip',

        _regi = /\[([a-z]+)\:([a-z]+)=([^\]]+)?\]/gi,
        _default = {
            kind: 'Controlbar',
            layout: '[JoyStick:joystick=]|[Button:reload=Reload][Button:capture=Capture][Button:mute=Mute][Button:unmute=Unmute]|[Button:select=Select][Button:start=Start][Button:b=B][Button:a=A]',
            visibility: true,
        };

    function Controlbar(config, logger) {
        EventDispatcher.call(this, 'Controlbar', { logger: logger }, KeyboardEvent);

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
            _setupComponents();
        }

        function _buildComponents() {
            var layouts = _this.config.layout.split('|');
            // TODO(spencer@lau): No limitation on chunk number.
            if (layouts.length !== 3) {
                throw { name: 'DataError', message: 'Controlbar should have exactly 3 sections.' };
            }

            var left = utils.createElement('div', CLASS_LEFT);
            var center = utils.createElement('div', CLASS_CENTER);
            var right = utils.createElement('div', CLASS_RIGHT);

            utils.forEach([left, center, right], function (i, container) {
                var arr;
                while ((arr = _regi.exec(layouts[i])) !== null) {
                    _buildComponent(container, arr[1], arr[2], arr[3]);
                }
            });

            _content.appendChild(left);
            _content.appendChild(center);
            _content.appendChild(right);
        }

        function _buildComponent(container, type, name, kind) {
            var component,
                element;

            switch (name) {
                case 'capture':
                    if (OS.isIOS && !Browser.isSafari) {
                        return;
                    }
                    break;
            }

            try {
                component = new components[type](name, kind, _logger);
                if (utils.typeOf(component.addGlobalListener) === 'function') {
                    component.addGlobalListener(_this.forward);
                }
                element = component.element();
                container.appendChild(element);
                _this.components[name] = component;
            } catch (err) {
                _logger.error('Failed to initialize component: type=' + type + ', name=' + name + ', Error=' + err.message);
                return;
            }

            switch (name) {
                case 'joystick':
                    component.config = utils.extendz(component.config, _this.config.joystick);
                case 'select':
                case 'start':
                case 'b':
                case 'a':
                    if (kind !== undefined) {
                        element.innerHTML = kind;
                    }
                    break;
                default:
                    if (kind !== undefined) {
                        var tooltip;
                        if (utils.typeOf(components[kind]) === 'function') {
                            tooltip = new components[kind](name, kind, _logger);
                            element.insertAdjacentElement('afterbegin', tooltip.element());
                        } else {
                            tooltip = utils.createElement('span', CLASS_TOOLTIP);
                            tooltip.innerHTML = kind;
                            element.insertAdjacentElement('afterbegin', tooltip);
                        }
                        component.tooltip = tooltip;
                    }
                    break;
            }
        }

        function _setupComponents() {

        }

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {
            utils.forEach(_this.components, function (name, component) {
                component.resize(width, height);

                switch (name) {
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

        _init();
    }

    Controlbar.prototype = Object.create(EventDispatcher.prototype);
    Controlbar.prototype.constructor = Controlbar;
    Controlbar.prototype.kind = 'Controlbar';
    Controlbar.prototype.CONF = _default;

    UI.register(Controlbar);
})(odd);

