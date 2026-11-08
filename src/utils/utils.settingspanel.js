(function (odd) {
    var Event = odd.events.Event;

    function SettingsPanel(settings, config) {
        config = config || {};
        var labels = Object.assign({
            title: 'Audio, video and layout', notice: 'Save defaults for the next session; the current call stays unchanged.',
            profile: 'Quality preset', devices: 'Input devices', layoutGroup: 'Video layout', camera: 'Camera', microphone: 'Microphone', systemDefault: 'System default', off: 'Off by default',
            layout: 'Layout', right: 'Right', top: 'Top', bottom: 'Bottom', left: 'Left', grid: 'Grid', fps: 'fps',
            preview: 'Preview devices', previewing: 'Previewing local devices.', stopPreview: 'Stop preview', stopped: 'Device preview stopped.',
            previewTitle: 'Device preview', previewHint: 'Start preview to check your camera and microphone.',
            previewLoading: 'Opening devices…', previewAudio: 'Microphone preview is active', previewFailed: 'Preview unavailable',
            previewControls: 'Preview controls', defaultsControls: 'Save or discard settings',
            beauty: 'Appearance', beautyEnabled: 'Enable video effects', whitening: 'Whitening', smoothing: 'Smoothing',
            beautyHint: 'Adjust the effect in preview. Saved preferences apply to the next session.',
            save: 'Save defaults', saved: 'Defaults saved for the next session.', temporary: 'Preferences are stored in this instance only.',
            local: 'Saved in this browser for this account and product. Device information stays on this device.',
            refreshDevices: 'Refresh devices', devicesUpdated: 'Device list updated. Select a device or use the system default.',
            deviceMissing: 'Saved device (currently unavailable)', unnamedCamera: 'Camera', unnamedMicrophone: 'Microphone',
            devicesUnavailable: 'Device names may require permission. Use preview to grant access, or choose the system default.',
            systemOutput: 'Playback uses the system output device. Change speakers or headphones in your system settings.',
            autoJoin: 'When joining a meeting', joinAudio: 'Turn on microphone when joining', joinVideo: 'Turn on camera when joining',
            encodings: 'Publishing encoding', codec: 'Video codec', currentCodecs: 'Keep configured preferences',
            simulcast: 'Simulcast: publish multiple resolutions', svc: 'AV1 SVC: use dependent layers', scalabilityMode: 'Layer mode',
            currentModes: 'No uniform mode selected', noLayers: 'no dependent layers', unavailable: 'not advertised by this browser',
            encodingNotice: 'Choices apply to the next session. Input preview does not verify encoding; publishing checks the negotiated result.',
            encodingPreset: 'Changing a multi-stream or layer option applies the standard preset, with three streams when Simulcast is enabled. Other edits preserve custom encoding parameters.',
            encodingBandwidth: 'Simulcast increases device work and upload bandwidth. The quality preset applies to the highest stream, not their combined bitrate.',
            encodingUnavailable: 'Encoding capabilities are unavailable. Keep the current settings or disable layered publishing.',
            svcRequiresAV1: 'SVC requires AV1. Select AV1 before enabling it; turn SVC off before choosing another codec.',
            DataError: 'Check the selected settings and encoding combination before saving.',
            reload: 'Discard changes', changed: 'Defaults changed. Your edits are kept; load the latest settings before saving.',
            loaded: 'Latest defaults loaded. The current call is unchanged.', failed: 'The operation did not finish. Please retry.',
            ConflictError: 'Defaults changed. Load the latest settings before saving.',
            QuotaExceededError: 'Local settings storage is full. Keep your draft, then retry or choose temporary defaults in your host.',
            NotAllowedError: 'Device access was denied. Allow access in browser settings and retry.',
            NotFoundError: 'The selected device is unavailable. Connect it or choose another device.',
            NotReadableError: 'The device could not be opened. Close other applications using it and retry.',
            OverconstrainedError: 'The selected device or quality is unavailable. Choose another device or a lower quality.',
            NotSupportedError: 'This browser does not support the operation. Check the selected devices or use another browser.',
            InvalidStateError: 'Settings are busy. Wait for the current operation and retry.',
        }, config.labels || {});
        if (!settings || typeof settings.read !== 'function') { throw { name: 'DataError', message: 'Module settings are required.' }; }
        var _this = this, state = settings.read(), draft = odd.utils.extendz({}, state.effective),
            root = document.createElement('section'), form = document.createElement('form'),
            notice = document.createElement('p'), video = document.createElement('video'),
            inputs = {}, buttons = [], devices = [], dirty = false, closed = false,
            operation = 0, deviceGeneration = 0, busy = false, cancellable = false,
            encodingNotice, encodingCapability, encodingPreset = false, beautyVersion = 0, beautyOutputs = {};
        root.className = 'odd-settings-panel';
        var title = document.createElement('h2'); title.textContent = labels.title; root.appendChild(title);
        var persistence = document.createElement('p');
        persistence.textContent = state.capabilities.persistence === 'host' ? labels.local : labels.temporary;
        root.appendChild(persistence);
        notice.setAttribute('role', 'status'); notice.tabIndex = -1; notice.textContent = labels.notice;
        root.appendChild(notice); root.appendChild(form);

        function icon(path) {
            var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
            svg.setAttribute('aria-hidden', 'true'); svg.setAttribute('focusable', 'false');
            var line = document.createElementNS(svg.namespaceURI, 'path'); line.setAttribute('d', path); svg.appendChild(line); return svg;
        }
        function section(title, className) {
            var group = document.createElement('fieldset'), legend = document.createElement('legend');
            group.className = 'odd-settings-group ' + className; legend.textContent = title;
            group.appendChild(legend); form.appendChild(group); return group;
        }
        var previewBlock = section(labels.previewTitle, 'odd-settings-preview'), previewStage = document.createElement('div'),
            placeholder = document.createElement('div'), previewTitle = document.createElement('strong'), previewHint = document.createElement('p'),
            previewActions = document.createElement('div');
        previewBlock.setAttribute('aria-label', labels.previewTitle);
        previewStage.className = 'odd-settings-preview-stage'; placeholder.className = 'odd-settings-preview-placeholder';
        placeholder.appendChild(icon('M15 10l5-3a1 1 0 0 1 2 1v8a1 1 0 0 1-2 1l-5-3M4 5h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z'));
        placeholder.appendChild(previewTitle); placeholder.appendChild(previewHint);
        video.muted = true; video.autoplay = true; video.playsInline = true; video.hidden = true;
        previewStage.appendChild(video); previewStage.appendChild(placeholder);
        previewActions.className = 'odd-settings-preview-actions'; previewActions.setAttribute('role', 'group'); previewActions.setAttribute('aria-label', labels.previewControls);
        previewBlock.appendChild(previewStage); previewBlock.appendChild(previewActions);
        function renderPreview(mode, message) {
            var visible = mode === 'active' && video.srcObject && video.srcObject.getVideoTracks().some(function (track) { return track.readyState !== 'ended'; });
            video.hidden = !visible; placeholder.hidden = !!visible;
            previewTitle.textContent = mode === 'loading' ? labels.previewLoading : mode === 'active' ? labels.previewAudio : mode === 'error' ? labels.previewFailed : labels.previewTitle;
            previewHint.textContent = message || (mode === 'active' ? labels.previewing : labels.previewHint);
            previewStage.setAttribute('aria-busy', String(mode === 'loading'));
        }
        renderPreview('idle');

        function select(name, title, choices, container) {
            var label = document.createElement('label'), input = document.createElement('select');
            label.textContent = title;
            input.name = name;
            input.onchange = function () {
                draft[name] = input.value === 'false' ? false : input.value;
                dirty = true;
                if (name === 'profile' && encodingPreset) { updateEncodings(); }
            };
            label.appendChild(input); (container || form).appendChild(label); inputs[name] = input;
            options(input, choices, draft[name]);
        }
        function options(input, choices, value) {
            input.textContent = '';
            choices.forEach(function (choice) {
                var option = document.createElement('option'); option.value = choice[0]; option.textContent = choice[1]; input.appendChild(option);
            });
            input.value = value === true ? '' : String(value);
        }
        var deviceGroup = section(labels.devices, 'odd-settings-devices');
        select('profile', labels.profile, state.capabilities.profiles.map(function (name) {
            var value = odd.RTC.Constraints[name].video;
            return [name, value.width + ' × ' + value.height + ' · ' + value.frameRate + ' ' + labels.fps];
        }), deviceGroup);
        inputs.profile.parentElement.className = 'odd-settings-quality';
        select('camera', labels.camera, [], deviceGroup);
        select('microphone', labels.microphone, [], deviceGroup);
        var deviceHints = document.createElement('div'); deviceHints.className = 'odd-settings-device-hints';
        var deviceNotice = document.createElement('p'); deviceNotice.textContent = labels.devicesUnavailable; deviceHints.appendChild(deviceNotice);
        var outputNotice = document.createElement('p'); outputNotice.textContent = labels.systemOutput; deviceHints.appendChild(outputNotice);
        deviceGroup.appendChild(deviceHints);
        if (state.capabilities.beauty) { buildBeauty(); }
        if (state.capabilities.autoJoin) {
            var joinGroup = document.createElement('fieldset'); joinGroup.className = 'odd-settings-group odd-settings-encodings';
            var joinLegend = document.createElement('legend'); joinLegend.textContent = labels.autoJoin; joinGroup.appendChild(joinLegend);
            ['joinAudio', 'joinVideo'].forEach(function (name) {
                var label = document.createElement('label'), input = document.createElement('input');
                label.className = 'odd-settings-toggle'; input.type = 'checkbox'; input.name = name;
                input.checked = draft[name]; input.onchange = function () { draft[name] = input.checked; dirty = true; };
                inputs[name] = input; label.appendChild(input); label.appendChild(document.createTextNode(labels[name])); joinGroup.appendChild(label);
            });
            form.appendChild(joinGroup);
        }
        var layouts = { right: labels.right, top: labels.top, bottom: labels.bottom, left: labels.left, grid: labels.grid };
        var layoutGroup = section(labels.layoutGroup, 'odd-settings-layout-group');
        select('layout', labels.layout, state.capabilities.layouts.map(function (name) { return [name, layouts[name] || name]; }), layoutGroup);
        inputs.layout.parentElement.className = 'odd-settings-layout';
        if (state.capabilities.encodings) { buildEncodings(); }
        var actions = document.createElement('div'); actions.className = 'odd-settings-actions'; form.appendChild(actions);
        actions.setAttribute('role', 'group'); actions.setAttribute('aria-label', labels.defaultsControls);

        function buildBeauty() {
            var group = document.createElement('fieldset'), legend = document.createElement('legend');
            group.className = 'odd-settings-group odd-settings-beauty'; legend.textContent = labels.beauty; group.appendChild(legend);
            var label = document.createElement('label'), toggle = document.createElement('input');
            label.className = 'odd-settings-toggle'; toggle.type = 'checkbox'; toggle.name = 'beautyEnabled';
            inputs.beautyEnabled = toggle; label.appendChild(toggle); label.appendChild(document.createTextNode(labels.beautyEnabled)); group.appendChild(label);
            toggle.onchange = function () { draft.beauty.enabled = toggle.checked; updateBeauty(); };
            ['whitening', 'smoothing'].forEach(function (name) {
                var label = document.createElement('label'), heading = document.createElement('span'), value = document.createElement('output'), input = document.createElement('input');
                heading.textContent = labels[name]; heading.appendChild(value); label.appendChild(heading);
                input.type = 'range'; input.name = name; input.min = '0'; input.max = '100'; input.step = '1';
                input.setAttribute('aria-label', labels[name]);
                input.oninput = function () { draft.beauty[name] = Number(input.value) / 100; updateBeauty(); };
                inputs[name] = input; beautyOutputs[name] = value; label.appendChild(input); group.appendChild(label);
            });
            var hint = document.createElement('p'); hint.textContent = labels.beautyHint; group.appendChild(hint); form.appendChild(group);
        }
        function renderBeauty() {
            if (!inputs.beautyEnabled) { return; }
            inputs.beautyEnabled.checked = draft.beauty.enabled;
            ['whitening', 'smoothing'].forEach(function (name) {
                var value = Math.round(draft.beauty[name] * 100);
                inputs[name].value = String(value); inputs[name].disabled = busy || !draft.beauty.enabled;
                inputs[name].setAttribute('aria-valuetext', value + '%'); beautyOutputs[name].textContent = value + '%';
            });
        }
        function updateBeauty() {
            dirty = true; renderBeauty();
            if (!video.srcObject || typeof settings.previewBeauty !== 'function') { return; }
            var version = ++beautyVersion;
            settings.previewBeauty(draft.beauty).then(function () {
                if (!closed && version === beautyVersion && video.srcObject) { renderPreview('active'); }
            }).catch(function (error) {
                if (!closed && version === beautyVersion) { notice.textContent = labels[error.name] || labels.failed; }
            });
        }

        function buildEncodings() {
            var group = document.createElement('fieldset'); group.className = 'odd-settings-group odd-settings-encodings';
            var legend = document.createElement('legend'); legend.textContent = labels.encodings; group.appendChild(legend);
            form.appendChild(group);
            var label = document.createElement('label'); label.textContent = labels.codec;
            var input = document.createElement('select'); input.name = 'codecpreferences';
            inputs.codecpreferences = input; label.appendChild(input); group.appendChild(label);
            options(input, [['', labels.currentCodecs], ['video/H264', 'H.264'], ['video/H265', 'H.265'], ['video/AV1', 'AV1']], '');
            input.onchange = function () {
                if (input.value) {
                    draft.codecpreferences = draft.codecpreferences.filter(function (codec) { return codec.toLowerCase().indexOf('audio/') === 0; }).concat(input.value);
                } else {
                    draft.codecpreferences = state.effective.codecpreferences.slice(0);
                }
                dirty = true; renderEncodings();
            };
            ['simulcast', 'svc'].forEach(function (name) {
                var label = document.createElement('label'); label.className = 'odd-settings-toggle';
                var toggle = document.createElement('input'); toggle.type = 'checkbox'; toggle.name = name;
                toggle.onchange = updateEncodings; inputs[name] = toggle;
                label.appendChild(toggle); label.appendChild(document.createTextNode(labels[name])); group.appendChild(label);
            });
            var modeLabel = document.createElement('label'); modeLabel.textContent = labels.scalabilityMode;
            var modes = document.createElement('select'); modes.name = 'scalabilityMode'; inputs.scalabilityMode = modes;
            modeLabel.appendChild(modes); group.appendChild(modeLabel);
            options(modes, [['', labels.currentModes]].concat(state.capabilities.encodings.modes.map(function (mode) {
                return [mode, mode + (mode === 'L1T1' ? ' (' + labels.noLayers + ')' : '')];
            })), '');
            modes.options[0].disabled = true;
            modes.onchange = function () { if (modes.value) { updateEncodings(); } };
            encodingCapability = document.createElement('p'); encodingCapability.setAttribute('role', 'status'); group.appendChild(encodingCapability);
            encodingNotice = document.createElement('p'); encodingNotice.textContent = labels.encodingNotice; group.appendChild(encodingNotice);
            var preset = document.createElement('p'); preset.textContent = labels.encodingPreset; group.appendChild(preset);
            var bandwidth = document.createElement('p'); bandwidth.textContent = labels.encodingBandwidth; group.appendChild(bandwidth);
        }

        function updateEncodings() {
            try {
                draft.video = odd.RTC.Encodings.preset(draft.profile, inputs.simulcast.checked, inputs.svc.checked,
                    inputs.scalabilityMode.value || 'L3T3_KEY');
                encodingPreset = true; dirty = true;
            } catch (error) { notice.textContent = labels[error.name] || labels.failed; }
            renderEncodings();
        }

        function renderEncodings() {
            if (!encodingNotice) { return; }
            var capability = state.capabilities.encodings, video = draft.video;
            var selected = draft.codecpreferences.filter(function (codec) { return /^video\/(H264|H265|AV1)$/i.test(codec); });
            inputs.codecpreferences.value = selected.length === 1 ? ['video/H264', 'video/H265', 'video/AV1'].filter(function (codec) {
                return codec.toLowerCase() === selected[0].toLowerCase();
            })[0] : '';
            inputs.simulcast.checked = video.simulcast === undefined ? video.encodings.length > 1 : video.simulcast;
            inputs.svc.checked = video.svc;
            var modes = video.encodings.map(function (encoding) { return encoding.scalabilityMode || ''; });
            inputs.scalabilityMode.value = modes.length && modes.every(function (mode) { return mode === modes[0]; }) ? modes[0] : '';
            var av1 = selected.some(function (codec) { return codec.toLowerCase() === 'video/av1'; });
            var originalCompatible = true;
            try { odd.RTC.Encodings.validate(video, state.effective.codecpreferences); }
            catch (error) { originalCompatible = false; }
            Array.prototype.forEach.call(inputs.codecpreferences.options, function (option) {
                var unavailable = option.value && capability.codecs.indexOf(option.value) < 0;
                option.disabled = option.value ? !!unavailable || video.svc && option.value !== 'video/AV1' : !originalCompatible;
                var title = { '': labels.currentCodecs, 'video/H264': 'H.264', 'video/H265': 'H.265', 'video/AV1': 'AV1' }[option.value];
                option.textContent = title + (unavailable ? ' (' + labels.unavailable + ')' : '');
            });
            inputs.simulcast.disabled = busy || !capability.available && !inputs.simulcast.checked;
            inputs.svc.disabled = busy || !video.svc && (!av1 || capability.codecs.indexOf('video/AV1') < 0);
            inputs.scalabilityMode.disabled = busy || !video.svc;
            var missing = selected.some(function (codec) { return !capability.codecs.some(function (supported) { return codec.toLowerCase() === supported.toLowerCase(); }); });
            encodingCapability.textContent = !capability.available ? labels.encodingUnavailable : missing ? labels.unavailable : labels.svcRequiresAV1;
        }

        function deviceOptions() {
            [['camera', 'videoinput', labels.unnamedCamera], ['microphone', 'audioinput', labels.unnamedMicrophone]].forEach(function (definition) {
                var name = definition[0], list = devices.filter(function (device) { return device.kind === definition[1]; });
                var choices = [['', labels.systemDefault]];
                if (!state.capabilities.autoJoin) { choices.push(['false', labels.off]); }
                list.forEach(function (device, index) { choices.push([device.deviceId, device.label || definition[2] + ' ' + (index + 1)]); });
                if (typeof draft[name] === 'string' && draft[name] && !list.some(function (device) { return device.deviceId === draft[name]; })) {
                    choices.push([draft[name], labels.deviceMissing]);
                }
                options(inputs[name], choices, draft[name]);
            });
        }
        async function refreshDevices() {
            if (typeof settings.devices !== 'function' || !state.capabilities.devices) { return; }
            var current = ++deviceGeneration;
            try {
                var result = await settings.devices();
                if (closed || current !== deviceGeneration) { return; }
                devices = result; deviceOptions();
                deviceNotice.textContent = devices.some(function (device) { return !device.label; }) || !devices.length
                    ? labels.devicesUnavailable : labels.devicesUpdated;
            } catch (error) {
                if (!closed && current === deviceGeneration) { deviceNotice.textContent = labels[error.name] || labels.failed; }
            }
        }
        function setBusy(value, allowCancel) {
            busy = value; cancellable = !!allowCancel;
            Object.keys(inputs).forEach(function (name) { inputs[name].disabled = value; });
            renderEncodings();
            renderBeauty();
            buttons.forEach(function (button) { button.element.disabled = value && (!button.cancel || !cancellable) || button.unavailable || button.cancel && !cancellable && !video.srcObject; });
            form.setAttribute('aria-busy', String(value));
        }
        function button(text, path, action, cancel, unavailable, previewAction, container) {
            var element = document.createElement('button'); element.type = 'button'; element.className = 'odd-settings-action';
            element.title = text; element.setAttribute('aria-label', text); element.appendChild(icon(path));
            element.disabled = !!unavailable;
            element.onclick = async function () {
                if (busy && !(cancel && cancellable) || closed) { return; }
                var current = ++operation, restoreFocus = document.activeElement === element;
                if (!cancel) { setBusy(true, previewAction); }
                try { await action(); }
                catch (error) {
                    if (!closed && current === operation && error.name !== 'AbortError') {
                        notice.textContent = labels[error.name] || labels.failed;
                        if (previewAction) { renderPreview('error', notice.textContent); }
                    }
                } finally {
                    if (!closed && current === operation) {
                        setBusy(false);
                        if (restoreFocus && (document.activeElement === document.body || document.activeElement === element || form.contains(document.activeElement))) {
                            notice.focus();
                        }
                    }
                }
            };
            (container || actions).appendChild(element); buttons.push({ element: element, cancel: !!cancel, unavailable: !!unavailable });
            return element;
        }
        button(labels.refreshDevices, 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M18 18a8 8 0 0 1-13-3', refreshDevices, false, !state.capabilities.devices, false, previewActions);
        button(labels.preview, 'm9 5 11 7-11 7V5Z', async function () {
            video.srcObject = null; renderPreview('loading');
            var result = await settings.preview(draft);
            if (closed) { result.stop(); return; }
            video.srcObject = result.stream; renderPreview('active'); notice.textContent = labels.previewing;
            await refreshDevices();
        }, false, !state.capabilities.preview, true, previewActions);
        button(labels.stopPreview, 'M6 5h12a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z', function () {
            settings.cancel(); video.srcObject = null; renderPreview('idle'); notice.textContent = labels.stopped;
        }, true, false, false, previewActions);
        var save = button(labels.save, 'M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2ZM7 3v6h9V3M7 21v-8h10v8', async function () {
            var result = await settings.save(draft, { expectedVersion: state.version, scope: 'next-session' });
            if (closed) { return; }
            state = settings.read(); dirty = false; encodingPreset = false; draft = odd.utils.extendz({}, state.effective);
            video.srcObject = null; renderPreview('idle'); render();
            notice.textContent = labels.saved + (result.warnings.length ? ' ' + labels.temporary : '');
        });
        save.classList.add('odd-settings-primary');
        button(labels.reload, 'M3 4v6h6M3 10a9 9 0 1 1 2.6 8.4', async function () {
            await settings.load();
            if (closed) { return; }
            state = settings.read(); draft = odd.utils.extendz({}, state.effective); dirty = false; encodingPreset = false;
            settings.cancel(); video.srcObject = null; renderPreview('idle'); render(); notice.textContent = labels.loaded;
        });
        form.onsubmit = function (event) { event.preventDefault(); save.click(); };
        function render() {
            inputs.profile.value = draft.profile; inputs.layout.value = draft.layout; deviceOptions(); renderEncodings(); renderBeauty();
            ['joinAudio', 'joinVideo'].forEach(function (name) { if (inputs[name]) { inputs[name].checked = !!draft[name]; } });
        }
        function changed(event) {
            if (closed) { return; }
            if (event.data.name === 'settings-error') { notice.textContent = labels[event.data.error.name] || labels.failed; return; }
            if (event.data.name !== 'settings') { return; }
            var next = event.data.value;
            if (next.version === state.version) { return; }
            if (dirty || busy) { notice.textContent = labels.changed; return; }
            state = next; draft = odd.utils.extendz({}, state.effective); encodingPreset = false; render(); notice.textContent = labels.loaded;
        }
        function refreshDefaults() {
            if (closed || busy || state.capabilities.persistence !== 'host') { return; }
            settings.load().catch(function () { /* Settings reports the failure through CHANGE. */ });
        }
        function onDeviceChange() { refreshDevices(); }
        if (settings.addEventListener) { settings.addEventListener(Event.CHANGE, changed); }
        window.addEventListener('focus', refreshDefaults);
        if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) { navigator.mediaDevices.addEventListener('devicechange', onDeviceChange); }
        render(); setBusy(false); refreshDevices();
        _this.element = function () { return root; };
        _this.destroy = function () {
            if (closed) { return; }
            closed = true; operation++; deviceGeneration++;
            settings.cancel(); video.srcObject = null;
            if (settings.removeEventListener) { settings.removeEventListener(Event.CHANGE, changed); }
            window.removeEventListener('focus', refreshDefaults);
            if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) { navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange); }
            Object.keys(inputs).forEach(function (name) { inputs[name].onchange = null; inputs[name].oninput = null; });
            buttons.forEach(function (button) { button.element.onclick = null; });
            form.onsubmit = null;
        };
    }
    odd.utils.SettingsPanel = SettingsPanel;
})(odd);
