(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        Event = events.Event,
        components = odd.IM.UI.components,
        Panel = components.Panel,

        CLASS_TITLE = 'im-settings-title',
        CLASS_CONTENT = 'im-settings-content',

        _default = {
            profile: '180P_1',
            camera: true,
            microphone: true,
        };

    function Settings(name, value, logger) {
        Panel.call(this, name, 'Settings', logger, [Event.CHANGE]);

        var _this = this,
            _container,
            _profile,
            _camera,
            _microphone;

        function _init() {
            _this.config = utils.extendz({}, _default);

            _container = _this.element();

            _buildCalls();
            _this.update(_this.config);
        }

        function _buildCalls() {
            var title = utils.createElement('h3', CLASS_TITLE);
            title.textContent = 'Calls';
            _container.appendChild(title);

            var content = utils.createElement('div', CLASS_CONTENT);
            _container.appendChild(content);

            var label = utils.createElement('label');
            label.textContent = 'Profile:';
            content.appendChild(label);

            _profile = utils.createElement('select');
            _profile.name = 'profile';
            _profile.onchange = _onChange;
            label.appendChild(_profile);
            utils.forEach(odd.RTC ? odd.RTC.Constraints : { '180P_1': {} }, function (name) {
                var option = utils.createElement('option');
                option.value = name;
                option.textContent = name;
                _profile.appendChild(option);
            });

            label = utils.createElement('label');
            label.textContent = 'Camera:';
            content.appendChild(label);

            _camera = utils.createElement('input');
            _camera.type = 'checkbox';
            _camera.name = 'camera';
            _camera.onchange = _onChange;
            label.appendChild(_camera);

            label = utils.createElement('label');
            label.textContent = 'Microphone:';
            content.appendChild(label);

            _microphone = utils.createElement('input');
            _microphone.type = 'checkbox';
            _microphone.name = 'microphone';
            _microphone.onchange = _onChange;
            label.appendChild(_microphone);
        }

        function _onChange(e) {
            var input = e.currentTarget,
                value = input.type === 'checkbox' ? input.checked : input.value;
            _this.config[input.name] = value;
            _this.dispatchEvent(Event.CHANGE, { name: input.name, value: value });
        }

        _this.update = function (data) {
            data = utils.extendz({}, _default, data);
            _this.config = {
                profile: data.profile,
                camera: data.camera,
                microphone: data.microphone,
            };

            _profile.value = _this.config.profile;
            _camera.checked = _this.config.camera;
            _microphone.checked = _this.config.microphone;
            return _this.config;
        };

        _this.destroy = function () {
            _profile.onchange = null;
            _camera.onchange = null;
            _microphone.onchange = null;

            _container.innerHTML = '';
        };

        _init();
    }

    Settings.prototype = Object.create(Panel.prototype);
    Settings.prototype.constructor = Settings;
    Settings.prototype.kind = 'Settings';

    components.Settings = Settings;
})(odd);

