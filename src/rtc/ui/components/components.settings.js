(function (odd) {
    var utils = odd.utils,
        Event = odd.events.Event,
        RTC = odd.RTC,
        Constraints = RTC.Constraints,
        components = RTC.UI.components,
        Panel = components.Panel,
        _default = {
            profile: '720P_2', camera: '', microphone: '', joinAudio: false, joinVideo: false,
            beauty: { enabled: false, whitening: 0, smoothing: 0 },
            video: { svc: false, encodings: [] }, codecpreferences: ['audio/opus', 'video/H264'],
        };

    function Settings(name, value, logger, labels) {
        Panel.call(this, name, 'Settings', logger, [Event.CHANGE]);

        var _this = this,
            _labels = utils.extendz({ devices: 'Devices', profile: 'Quality', camera: 'Camera', microphone: 'Microphone',
                systemDefault: 'System default', deviceMissing: 'Saved device (unavailable)', fps: 'fps',
                beauty: 'Appearance', beautyEnabled: 'Enable video effects', whitening: 'Whitening', smoothing: 'Smoothing',
                encodings: 'Publishing encoding', codec: 'Video codec', currentCodecs: 'Keep codec preferences',
                simulcast: 'Simulcast', svc: 'AV1 SVC', scalabilityMode: 'Layer mode', currentModes: 'Keep layer modes',
                autoJoin: 'Join preferences', joinAudio: 'Turn on microphone when joining', joinVideo: 'Turn on camera when joining',
                save: 'Save settings', discard: 'Discard changes', unavailable: 'Unavailable',
                encodingNotice: 'Encoding changes apply to the next publication.',
                error: 'Could not apply these settings. Check the selected devices and try again.' }, labels),
            _container, _sections, _inputs = {}, _beauty = {}, _join, _notice, _busy = false,
            _capability, _originalCodecs, _encodingPreset = false;

        function _init() {
            _container = _this.element();
            _this.config = utils.extendz({}, _default);
            _capability = RTC.Encodings.describe();
            _sections = utils.createElement('div', 'pe-settings-sections');
            _container.appendChild(_sections);
            _buildDevices();
            _buildBeauty();
            _buildEncodings();
            _buildJoin();
            _notice = utils.createElement('p', 'pe-settings-notice');
            _notice.setAttribute('role', 'status');
            _notice.hidden = true;
            _container.appendChild(_notice);
            _buildFooter();
            _this.update(_this.config);
        }

        function _buildGroup(name) {
            var group = utils.createElement('section', 'pe-settings-group pe-settings-' + name);
            var title = utils.createElement('h3', 'pe-settings-title');
            title.textContent = _labels[name];
            group.appendChild(title);
            var content = utils.createElement('div', 'pe-settings-content');
            group.appendChild(content);
            _sections.appendChild(group);
            return content;
        }

        function _buildSelect(content, name, caption) {
            var label = utils.createElement('label', 'pe-settings-row');
            var text = utils.createElement('span');
            text.textContent = caption || _labels[name];
            label.appendChild(text);
            var input = utils.createElement('select');
            input.name = name;
            label.appendChild(input);
            content.appendChild(label);
            _inputs[name] = input;
            return input;
        }

        function _buildSwitch(content, name) {
            var label = utils.createElement('label', 'pe-settings-toggle');
            var text = utils.createElement('span');
            text.textContent = _labels[name];
            label.appendChild(text);
            var input = utils.createElement('input');
            input.type = 'checkbox'; input.name = name; input.setAttribute('role', 'switch');
            label.appendChild(input);
            content.appendChild(label);
            _inputs[name] = input;
            return input;
        }

        function _buildDevices() {
            var content = _buildGroup('devices');
            var profile = _buildSelect(content, 'profile');
            Object.keys(Constraints).forEach(function (name) {
                var video = Constraints[name].video, option = utils.createElement('option');
                option.value = name;
                option.textContent = video.width + ' × ' + video.height + ' · ' + video.frameRate + ' ' + _labels.fps;
                profile.appendChild(option);
            });
            _buildSelect(content, 'camera');
            _buildSelect(content, 'microphone');
            ['profile', 'camera', 'microphone'].forEach(function (name) {
                _inputs[name].onchange = function () {
                    _this.config[name] = _inputs[name].value;
                    if (name === 'profile' && _encodingPreset) { _updateEncodings(); }
                    _this.dispatchEvent(Event.CHANGE, { name: 'settings-preview', value: utils.extendz({}, _this.config) });
                };
            });
        }

        function _buildBeauty() {
            var content = _buildGroup('beauty');
            var enabled = _buildSwitch(content, 'beautyEnabled');
            enabled.onchange = function () {
                _this.config.beauty.enabled = enabled.checked;
                _updateBeauty();
                _this.dispatchEvent(Event.CHANGE, { name: 'settings-preview', value: utils.extendz({}, _this.config) });
            };
            ['whitening', 'smoothing'].forEach(function (name) {
                var label = utils.createElement('label', 'pe-settings-strength');
                var text = utils.createElement('span'); text.textContent = _labels[name]; label.appendChild(text);
                var input = utils.createElement('input');
                input.type = 'range'; input.name = name; input.min = 0; input.max = 100; input.step = 1;
                var output = utils.createElement('output');
                label.appendChild(input); label.appendChild(output); content.appendChild(label);
                _beauty[name] = { input: input, output: output };
                input.oninput = function () {
                    _this.config.beauty[name] = Number(input.value) / 100;
                    output.textContent = input.value;
                    _this.dispatchEvent(Event.CHANGE, { name: 'settings-preview', value: utils.extendz({}, _this.config) });
                };
            });
        }

        function _updateBeauty() {
            _inputs.beautyEnabled.checked = _this.config.beauty.enabled;
            Object.keys(_beauty).forEach(function (name) {
                var item = _beauty[name];
                item.input.value = Math.round(_this.config.beauty[name] * 100);
                item.output.textContent = item.input.value;
                item.input.disabled = _busy || !_this.config.beauty.enabled;
            });
        }

        function _buildEncodings() {
            var content = _buildGroup('encodings');
            var codecs = _buildSelect(content, 'codecpreferences', _labels.codec);
            [['', _labels.currentCodecs], ['video/H264', 'H.264'], ['video/H265', 'H.265'], ['video/AV1', 'AV1']].forEach(function (entry) {
                var option = utils.createElement('option'); option.value = entry[0]; option.textContent = entry[1]; codecs.appendChild(option);
            });
            codecs.onchange = function () {
                _this.config.codecpreferences = codecs.value
                    ? _this.config.codecpreferences.filter(function (codec) { return /^audio\//i.test(codec); }).concat(codecs.value)
                    : _originalCodecs.slice();
                _renderEncodings();
            };
            var switches = utils.createElement('div', 'pe-settings-encoding-switches');
            content.appendChild(switches);
            _buildSwitch(switches, 'simulcast').onchange = _updateEncodings;
            _buildSwitch(switches, 'svc').onchange = _updateEncodings;
            var modes = _buildSelect(content, 'scalabilityMode');
            [''].concat(_capability.modes).forEach(function (mode) {
                var option = utils.createElement('option'); option.value = mode;
                option.textContent = mode || _labels.currentModes; option.disabled = !mode; modes.appendChild(option);
            });
            modes.onchange = _updateEncodings;
            content.title = _labels.encodingNotice;
        }

        function _updateEncodings() {
            try {
                _this.config.video = RTC.Encodings.preset(_this.config.profile, _inputs.simulcast.checked,
                    _inputs.svc.checked, _inputs.scalabilityMode.value || 'L3T3_KEY');
                _encodingPreset = true;
                _this.feedback('');
            } catch (error) { _this.feedback(_labels[error.name] || _labels.error); }
            _renderEncodings();
        }

        function _renderEncodings() {
            var video = _this.config.video;
            var selected = _this.config.codecpreferences.filter(function (codec) { return /^video\//i.test(codec); });
            _inputs.codecpreferences.value = selected.length === 1
                ? ['video/H264', 'video/H265', 'video/AV1'].find(function (codec) { return codec.toLowerCase() === selected[0].toLowerCase(); }) || '' : '';
            _inputs.simulcast.checked = video.simulcast === undefined ? video.encodings.length > 1 : video.simulcast;
            _inputs.svc.checked = video.svc;
            var modes = video.encodings.map(function (encoding) { return encoding.scalabilityMode || 'L1T1'; });
            _inputs.scalabilityMode.value = !video.svc ? 'L1T1' : modes.length && modes.every(function (mode) { return mode === modes[0]; }) ? modes[0] : '';
            var av1 = selected.some(function (codec) { return codec.toLowerCase() === 'video/av1'; });
            Array.from(_inputs.codecpreferences.options).forEach(function (option) {
                option.disabled = _busy || !!option.value && (!_capability.codecs.includes(option.value) || video.svc && option.value !== 'video/AV1');
            });
            _inputs.simulcast.disabled = _busy || !_capability.available && !_inputs.simulcast.checked;
            _inputs.svc.disabled = _busy || !video.svc && (!av1 || !_capability.codecs.includes('video/AV1'));
            _inputs.scalabilityMode.disabled = _busy || !video.svc;
        }

        function _buildJoin() {
            _join = utils.createElement('div', 'pe-settings-join');
            ['joinAudio', 'joinVideo'].forEach(function (name) {
                _buildSwitch(_join, name).onchange = function () { _this.config[name] = _inputs[name].checked; };
            });
            _container.appendChild(_join);
        }

        function _buildFooter() {
            var footer = utils.createElement('footer', 'pe-settings-footer');
            ['discard', 'save'].forEach(function (name) {
                var button = utils.createElement('button'); button.type = 'button'; button.name = name;
                button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
                    (name === 'save' ? '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8V3"/>' : '<path d="m9 14-5-5 5-5M4 9h10a6 6 0 0 1 0 12h-3"/>') + '</svg>';
                button.appendChild(document.createTextNode(_labels[name]));
                button.onclick = function () {
                    try {
                        if (name === 'save') { RTC.Encodings.validate(_this.config.video, _this.config.codecpreferences); }
                        _this.dispatchEvent(Event.CHANGE, { name: name, value: utils.extendz({}, _this.config) });
                    } catch (error) { _this.feedback(_labels[error.name] || _labels.error); }
                };
                footer.appendChild(button);
            });
            _container.appendChild(footer);
        }

        _this.update = function (data) {
            var supplied = {};
            Object.keys(data || {}).forEach(function (name) {
                if (data[name] !== undefined) { supplied[name] = data[name]; }
            });
            data = utils.extendz({}, _default, supplied);
            _this.config = utils.extendz({}, _default);
            Object.keys(_default).forEach(function (name) { _this.config[name] = utils.extendz({}, { value: data[name] }).value; });
            _originalCodecs = _this.config.codecpreferences.slice();
            _encodingPreset = false;
            _inputs.profile.value = data.profile;
            ['camera', 'microphone'].forEach(function (name) {
                var input = _inputs[name], devices = data[name === 'camera' ? 'cameras' : 'microphones'];
                if (devices) {
                    utils.emptyElement(input);
                    var option = utils.createElement('option'); option.value = ''; option.textContent = _labels.systemDefault; input.appendChild(option);
                    devices.forEach(function (device) {
                        option = utils.createElement('option'); option.value = device.deviceId;
                        option.textContent = device.label || device.deviceId; input.appendChild(option);
                    });
                    if (data[name] && !devices.some(function (device) { return device.deviceId === data[name]; })) {
                        option = utils.createElement('option'); option.value = data[name]; option.textContent = _labels.deviceMissing; input.appendChild(option);
                    }
                }
                input.value = data[name] || '';
            });
            _join.hidden = !data.joinPreferences;
            _inputs.joinAudio.checked = !!data.joinAudio;
            _inputs.joinVideo.checked = !!data.joinVideo;
            _updateBeauty(); _renderEncodings(); _this.feedback('');
            return _this.config;
        };

        _this.busy = function (value) {
            _busy = !!value;
            _container.setAttribute('aria-busy', String(_busy));
            Array.from(_container.querySelectorAll('input, select, button')).forEach(function (input) { input.disabled = _busy; });
            if (!_busy) { _updateBeauty(); _renderEncodings(); }
        };

        _this.feedback = function (message) {
            _notice.textContent = message || '';
            _notice.hidden = !message;
        };

        _this.destroy = function () {
            Array.from(_container.querySelectorAll('input, select, button')).forEach(function (input) {
                input.onchange = null; input.oninput = null; input.onclick = null;
            });
            utils.emptyElement(_container);
        };

        _init();
    }

    Settings.prototype = Object.create(Panel.prototype);
    Settings.prototype.constructor = Settings;
    Settings.prototype.kind = 'Settings';
    components.Settings = Settings;
})(odd);

