(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        Event = events.Event,
        Constraints = odd.RTC.Constraints,
        components = odd.RTC.UI.components,
        Panel = components.Panel,

        CLASS_TITLE = 'pe-settings-title',
        CLASS_CONTENT = 'pe-settings-content',
        CLASS_FOOTER = 'pe-settings-footer',
        CLASS_PREVIEW = 'pe-settings-preview',

        _default = {
            profile: '720P_2',
            camera: '',
            microphone: '',
            joinAudio: false,
            joinVideo: false,
        };

    function Settings(name, value, logger, labels) {
        Panel.call(this, name, 'Settings', logger, [Event.CHANGE]);

        var _this = this,
            _labels = utils.extendz({ video: 'Video', audio: 'Audio', profile: 'Profile', camera: 'Camera', microphone: 'Microphone', preview: 'Preview', save: 'Save', systemDefault: 'System default', joinAudio: 'Turn on microphone when joining', joinVideo: 'Turn on camera when joining' }, labels),
            _container,
            _profile,
            _camera,
            _microphone,
            _joinAudio,
            _joinVideo,
            _video;

        function _init() {
            _this.config = utils.extendz({}, _default);

            _container = _this.element();

            _buildVideo();
            _buildAudio();
            _container.appendChild(_container.querySelector('footer'));
            _this.update(_this.config);
        }

        function _buildVideo() {
            var title = utils.createElement('h3', CLASS_TITLE);
            title.textContent = _labels.video;
            _container.appendChild(title);

            var content = utils.createElement('div', CLASS_CONTENT);
            _container.appendChild(content);

            _video = utils.createElement('video', CLASS_PREVIEW);
            _video.setAttribute('playsinline', '');
            _video.setAttribute('autoplay', '');
            _video.muted = true;
            content.appendChild(_video);

            var label = utils.createElement('label');
            label.textContent = _labels.profile;
            content.appendChild(label);

            _profile = utils.createElement('select');
            _profile.name = 'profile';
            _profile.onchange = _onChange;
            label.appendChild(_profile);
            utils.forEach(Constraints, function (name) {
                var option = utils.createElement('option');
                option.value = name;
                option.textContent = name;
                _profile.appendChild(option);
            });

            label = utils.createElement('label');
            label.textContent = _labels.camera;
            content.appendChild(label);

            _camera = utils.createElement('select');
            _camera.name = 'camera';
            _camera.onchange = _onChange;
            label.appendChild(_camera);
            _joinVideo = _joinChoice(content, 'joinVideo');

            var footer = utils.createElement('footer', CLASS_FOOTER);
            _container.appendChild(footer);

            var button = utils.createElement('button');
            button.type = 'button';
            button.name = 'preview';
            button.textContent = _labels.preview;
            button.onclick = _onClick;
            footer.appendChild(button);

            button = utils.createElement('button');
            button.type = 'button';
            button.name = 'save';
            button.textContent = _labels.save;
            button.onclick = _onClick;
            footer.appendChild(button);
        }

        function _buildAudio() {
            var title = utils.createElement('h3', CLASS_TITLE);
            title.textContent = _labels.audio;
            _container.appendChild(title);

            var content = utils.createElement('div', CLASS_CONTENT);
            _container.appendChild(content);

            var label = utils.createElement('label');
            label.textContent = _labels.microphone;
            content.appendChild(label);

            _microphone = utils.createElement('select');
            _microphone.name = 'microphone';
            _microphone.onchange = _onChange;
            label.appendChild(_microphone);
            _joinAudio = _joinChoice(content, 'joinAudio');
        }

        function _joinChoice(content, name) {
            var label = utils.createElement('label', 'pe-settings-toggle'), input = utils.createElement('input');
            input.type = 'checkbox'; input.name = name; input.onchange = _onChange;
            label.appendChild(input); label.appendChild(document.createTextNode(_labels[name])); content.appendChild(label);
            return input;
        }

        function _onChange(e) {
            var input = e.currentTarget,
                value = input.type === 'checkbox' ? input.checked : input.value;
            _this.config[input.name] = value;
            _this.dispatchEvent(Event.CHANGE, { name: input.name, value: value });
        }

        function _onClick(e) {
            _this.dispatchEvent(Event.CHANGE, { name: e.currentTarget.name, value: utils.extendz({}, _this.config) });
        }

        _this.update = function (data) {
            data = utils.extendz({}, _default, data);
            _this.config = {
                profile: data.profile,
                camera: data.camera,
                microphone: data.microphone,
                joinAudio: !!data.joinAudio,
                joinVideo: !!data.joinVideo,
            };
            _joinAudio.checked = _this.config.joinAudio;
            _joinVideo.checked = _this.config.joinVideo;
            _joinAudio.parentNode.hidden = !data.joinPreferences;
            _joinVideo.parentNode.hidden = !data.joinPreferences;

            _profile.value = _this.config.profile;

            if (data.cameras) {
                _updateDevices(_camera, data.cameras, _this.config.camera);
            } else {
                _camera.value = _this.config.camera;
            }
            if (data.microphones) {
                _updateDevices(_microphone, data.microphones, _this.config.microphone);
            } else {
                _microphone.value = _this.config.microphone;
            }
            return _this.config;
        };

        function _updateDevices(input, devices, value) {
            utils.emptyElement(input);
            var defaultOption = utils.createElement('option');
            defaultOption.value = ''; defaultOption.textContent = _labels.systemDefault; input.appendChild(defaultOption);
            utils.forEach(devices, function (_, device) {
                var option = utils.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || device.deviceId;
                input.appendChild(option);
            });
            input.value = value;
        }

        _this.preview = function (element) {
            _video.srcObject = element ? element.srcObject : null;
        };

        _this.destroy = function () {
            _profile.onchange = null;
            _camera.onchange = null;
            _microphone.onchange = null;
            _joinAudio.onchange = null;
            _joinVideo.onchange = null;
            _video.srcObject = null;

            utils.forEach(_container.getElementsByTagName('button'), function (_, button) {
                button.onclick = null;
            });

            _container.innerHTML = '';
        };

        _init();
    }

    Settings.prototype = Object.create(Panel.prototype);
    Settings.prototype.constructor = Settings;
    Settings.prototype.kind = 'Settings';

    components.Settings = Settings;
})(odd);

