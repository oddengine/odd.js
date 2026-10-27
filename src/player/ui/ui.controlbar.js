(function (odd) {
    var utils = odd.utils,
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
                    '[Toggle:layout=right right=Right;top=Top;bottom=Bottom;left=Left;grid=Grid]' +
                    '[Button:settings=Settings]' +
                    '[Toggle:theater=off off=Enter Theater Mode;on=Exit Theater Mode]' +
                    '[Toggle:fullscreen=off off=Enter Fullscreen;on=Exit Fullscreen]',
            labels: { more: 'More controls', close: 'Close controls', controls: 'Media controls', layout: 'Layout', show: 'Show controls', volume: 'Volume', timebar: 'Playback position' },
            autohide: true,
            visibility: true,
        };

    function Controlbar(config, logger) {
        EventDispatcher.call(this, 'Controlbar', { logger: logger }, [Event.CHANGE, MouseEvent.CLICK, MouseEvent.MOUSEMOVE]);

        var _this = this,
            _logger = logger,
            _container,
            _content,
            _timebar,
            _presentation,
            _entries = [];

        function _init() {
            _this.config = utils.extendz({}, _default, config);
            _this.components = {};

            _container = utils.createElement('div', CLASS_CONTROLBAR);

            _content = utils.createElement('div');
            _container.appendChild(_content);

            _buildComponents();
            _presentation = new utils.MediaControls(_container, _content, _entries, { module: 'player', labels: _this.config.labels });
        }

        function _buildComponents() {
            _timebar = new components.Slider('timebar', undefined, _logger);
            _timebar.addGlobalListener(_this.forward);
            _container.appendChild(_timebar.element());
            _this.components['timebar'] = _timebar;
            _timebar.element().setAttribute('aria-label', _this.config.labels.timebar);

            var layouts = _this.config.layout.split('|');
            if (layouts.length !== 3) {
                throw { name: 'DataError', message: 'Controlbar should have exactly 3 sections.' };
            }

            var sections = ['left', 'center', 'right'];
            for (var i = 0; i < layouts.length; i++) {
                var section = utils.createElement('div', 'pe-' + sections[i]);
                var arr;
                _regi.lastIndex = 0;
                while ((arr = _regi.exec(layouts[i])) !== null) {
                    _buildComponent(section, arr[1], arr[2], arr[3]);
                }
                _content.appendChild(section);
            }
        }

        function _buildComponent(container, type, name, value) {
            switch (name) {
                case 'muted':
                case 'volume':
                    if (OS.isMobile) {
                        return;
                    }
                    break;
            }

            if (typeof components[type] !== 'function' || _this.components[name]) {
                throw { name: 'DataError', message: 'Unknown or duplicate control: ' + name + '.' };
            }
            var component = new components[type](name, value, _logger);
            if (typeof component.label === 'function' && _this.config.labels[name]) { component.label(_this.config.labels[name]); }
            component.addGlobalListener(_this.forward);
            container.appendChild(component.element());
            _this.components[name] = component;
            if (component.kind === 'Slider' && _this.config.labels[name]) {
                component.element().setAttribute('aria-label', _this.config.labels[name]);
            }
            _entries.push({ name: name, component: component, element: component.element() });
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

        _this.bind = function (wrapper, activity) { _presentation.bind(wrapper, activity); };
        _this.visible = function (visible) { return _presentation.visible(visible); };
        _this.active = function () { return _presentation.active(); };
        _this.presentResult = function (target) { _presentation.presentResult(target); };
        _this.focus = function (name) { _presentation.focus(name); };

        _this.resize = function (width, height) {
            utils.forEach(_this.components, function (_, component) { component.resize(width, height); });
            _presentation.resize();
        };

        _this.destroy = function () {
            if (_presentation) { _presentation.destroy(); }
            utils.forEach(_this.components, function (_, component) {
                component.removeGlobalListener(_this.forward);
                component.destroy();
            });
            _this.components = {};
        };

        try {
            _init();
        } catch (error) {
            _this.destroy();
            throw error;
        }
    }

    Controlbar.prototype = Object.create(EventDispatcher.prototype);
    Controlbar.prototype.constructor = Controlbar;
    Controlbar.prototype.kind = 'Controlbar';
    Controlbar.prototype.CONF = _default;

    UI.register(Controlbar);
})(odd);

