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
            beauty: { enabled: false, whitening: 0, smoothing: 0 },
        };

    function Settings(name, value, logger, labels) {
        Panel.call(this, name, 'Settings', logger, [Event.CHANGE]);

        var _this = this,
            _labels = utils.extendz({ video: 'Video', audio: 'Audio', profile: 'Profile', camera: 'Camera', microphone: 'Microphone', preview: 'Preview', save: 'Save', systemDefault: 'System default', joinAudio: 'Turn on microphone when joining', joinVideo: 'Turn on camera when joining', beauty: 'Appearance', beautyEnabled: 'Enable video effects', whitening: 'Whitening', smoothing: 'Smoothing', stopPreview: 'Stop preview', previewHint: 'Preview stays on this device', notice: 'Save defaults for the next session.', error: 'Could not apply these settings. Check the selected devices and try again.' }, labels),
            _container,
            _profile,
            _camera,
            _microphone,
            _joinAudio,
            _joinVideo,
            _video,
            _previewButton,
            _previewHint,
            _beauty = {},
            _notice;

        function _init() {
            _this.config = utils.extendz({}, _default);

            _container = _this.element();

            _buildVideo();
            _buildAudio();
            _buildBeauty();
            _notice = utils.createElement('p', 'pe-settings-notice');
            _notice.setAttribute('role', 'status');
            _notice.textContent = _labels.notice;
            _container.appendChild(_notice);
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
            _previewHint = utils.createElement('p', 'pe-settings-preview-hint');
            _previewHint.textContent = _labels.previewHint;
            content.appendChild(_previewHint);
            _previewButton = utils.createElement('button', 'pe-settings-preview-action');
            _previewButton.type = 'button'; _previewButton.name = 'preview';
            _previewButton.textContent = _labels.preview;
            _previewButton.onclick = _onClick;
            content.appendChild(_previewButton);

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

        function _buildBeauty() {
            var title = utils.createElement('h3', CLASS_TITLE);
            title.textContent = _labels.beauty;
            _container.appendChild(title);
            var content = utils.createElement('div', CLASS_CONTENT + ' pe-settings-beauty');
            _container.appendChild(content);
            ['enabled', 'whitening', 'smoothing'].forEach(function (name) {
                var label = utils.createElement('label', name === 'enabled' ? 'pe-settings-toggle' : 'pe-settings-strength');
                var input = utils.createElement('input');
                input.type = name === 'enabled' ? 'checkbox' : 'range';
                input.name = name;
                if (name !== 'enabled') { input.min = 0; input.max = 100; input.step = 1; }
                var caption = utils.createElement('span');
                caption.textContent = _labels[name === 'enabled' ? 'beautyEnabled' : name];
                label.appendChild(caption); label.appendChild(input);
                var output = utils.createElement('output');
                output.hidden = name === 'enabled'; label.appendChild(output);
                input.oninput = function () {
                    _this.config.beauty[name] = name === 'enabled' ? input.checked : Number(input.value) / 100;
                    _updateBeauty();
                    _this.dispatchEvent(Event.CHANGE, { name: 'beauty', value: utils.extendz({}, _this.config.beauty) });
                };
                _beauty[name] = { input: input, output: output };
                content.appendChild(label);
            });
        }

        function _updateBeauty() {
            Object.keys(_beauty).forEach(function (name) {
                var item = _beauty[name];
                if (name === 'enabled') { item.input.checked = _this.config.beauty.enabled; }
                else {
                    item.input.value = Math.round(_this.config.beauty[name] * 100);
                    item.output.textContent = item.input.value;
                    item.input.disabled = !_this.config.beauty.enabled;
                }
            });
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
                beauty: utils.extendz({}, data.beauty),
            };
            _updateBeauty();
            _notice.textContent = _labels.notice;
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
            _previewHint.hidden = !!element;
            _previewButton.name = element ? 'stop-preview' : 'preview';
            _previewButton.textContent = element ? _labels.stopPreview : _labels.preview;
        };

        _this.busy = function (value) {
            _container.setAttribute('aria-busy', String(!!value));
            Array.from(_container.querySelectorAll('input, select, button')).forEach(function (input) { input.disabled = !!value; });
            if (!value) { _updateBeauty(); }
        };
        _this.feedback = function (message) { _notice.textContent = message ? _labels.error : _labels.notice; };

        _this.destroy = function () {
            _profile.onchange = null;
            _camera.onchange = null;
            _microphone.onchange = null;
            _joinAudio.onchange = null;
            _joinVideo.onchange = null;
            _video.srcObject = null;
            Object.keys(_beauty).forEach(function (name) { _beauty[name].input.oninput = null; });

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

