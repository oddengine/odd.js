(function (odd) {
    var Event = odd.events.Event;

    function SettingsPanel(settings, config) {
        config = config || {};
        var labels = Object.assign({
            title: 'Audio, video and layout', notice: 'Save defaults for the next session; the current call stays unchanged.',
            profile: 'Quality limit', camera: 'Camera', microphone: 'Microphone', systemDefault: 'System default', off: 'Off by default',
            layout: 'Layout', right: 'Right', top: 'Top', bottom: 'Bottom', left: 'Left', grid: 'Grid', fps: 'fps',
            preview: 'Preview devices', previewing: 'Previewing local devices.', stopPreview: 'Stop preview', stopped: 'Device preview stopped.',
            save: 'Save defaults', saved: 'Defaults saved for the next session.', temporary: 'Preferences are stored in this instance only.',
            local: 'Saved in this browser for this account and product. Device information stays on this device.',
            refreshDevices: 'Refresh devices', devicesUpdated: 'Device list updated. Select a device or use the system default.',
            deviceMissing: 'Saved device (currently unavailable)', unnamedCamera: 'Camera', unnamedMicrophone: 'Microphone',
            devicesUnavailable: 'Device names may require permission. Use preview to grant access, or choose the system default.',
            systemOutput: 'Playback uses the system output device. Change speakers or headphones in your system settings.',
            reload: 'Load latest settings and discard edits', changed: 'Defaults changed. Your edits are kept; load the latest settings before saving.',
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
        var _this = this, state = settings.read(), draft = Object.assign({}, state.effective),
            root = document.createElement('section'), form = document.createElement('form'),
            notice = document.createElement('p'), video = document.createElement('video'),
            inputs = {}, buttons = [], devices = [], dirty = false, closed = false,
            operation = 0, deviceGeneration = 0, busy = false, cancellable = false;
        root.className = 'odd-settings-panel';
        var title = document.createElement('h2'); title.textContent = labels.title; root.appendChild(title);
        var persistence = document.createElement('p');
        persistence.textContent = state.capabilities.persistence === 'host' ? labels.local : labels.temporary;
        root.appendChild(persistence);
        notice.setAttribute('role', 'status'); notice.tabIndex = -1; notice.textContent = labels.notice;
        root.appendChild(notice); root.appendChild(form);

        function select(name, title, choices) {
            var label = document.createElement('label'), input = document.createElement('select');
            label.textContent = title;
            input.name = name;
            input.onchange = function () {
                draft[name] = input.value === 'false' ? false : input.value;
                dirty = true;
            };
            label.appendChild(input); form.appendChild(label); inputs[name] = input;
            options(input, choices, draft[name]);
        }
        function options(input, choices, value) {
            input.textContent = '';
            choices.forEach(function (choice) {
                var option = document.createElement('option'); option.value = choice[0]; option.textContent = choice[1]; input.appendChild(option);
            });
            input.value = value === true ? '' : String(value);
        }
        select('profile', labels.profile, state.capabilities.profiles.map(function (name) {
            var value = odd.RTC.Constraints[name].video;
            return [name, value.width + ' × ' + value.height + ' · ' + value.frameRate + ' ' + labels.fps];
        }));
        select('camera', labels.camera, []);
        select('microphone', labels.microphone, []);
        var layouts = { right: labels.right, top: labels.top, bottom: labels.bottom, left: labels.left, grid: labels.grid };
        select('layout', labels.layout, state.capabilities.layouts.map(function (name) { return [name, layouts[name] || name]; }));
        var deviceNotice = document.createElement('p'); deviceNotice.textContent = labels.devicesUnavailable; form.appendChild(deviceNotice);
        var outputNotice = document.createElement('p'); outputNotice.textContent = labels.systemOutput; form.appendChild(outputNotice);
        video.muted = true; video.autoplay = true; video.playsInline = true; video.hidden = true;
        form.appendChild(video);
        var actions = document.createElement('div'); actions.className = 'odd-settings-actions'; form.appendChild(actions);

        function deviceOptions() {
            [['camera', 'videoinput', labels.unnamedCamera], ['microphone', 'audioinput', labels.unnamedMicrophone]].forEach(function (definition) {
                var name = definition[0], list = devices.filter(function (device) { return device.kind === definition[1]; });
                var choices = [['', labels.systemDefault], ['false', labels.off]];
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
            buttons.forEach(function (button) { button.element.disabled = value && (!button.cancel || !cancellable) || button.unavailable; });
            form.setAttribute('aria-busy', String(value));
        }
        function button(text, action, cancel, unavailable, previewAction) {
            var element = document.createElement('button'); element.type = 'button'; element.textContent = text;
            element.disabled = !!unavailable;
            element.onclick = async function () {
                if (busy && !(cancel && cancellable) || closed) { return; }
                var current = ++operation, restoreFocus = document.activeElement === element;
                if (!cancel) { setBusy(true, previewAction); }
                try { await action(); }
                catch (error) {
                    if (!closed && current === operation && error.name !== 'AbortError') { notice.textContent = labels[error.name] || labels.failed; }
                } finally {
                    if (!closed && current === operation) {
                        setBusy(false);
                        if (restoreFocus && (document.activeElement === document.body || document.activeElement === element || form.contains(document.activeElement))) {
                            notice.focus();
                        }
                    }
                }
            };
            actions.appendChild(element); buttons.push({ element: element, cancel: !!cancel, unavailable: !!unavailable });
            return element;
        }
        button(labels.refreshDevices, refreshDevices, false, !state.capabilities.devices);
        button(labels.preview, async function () {
            var result = await settings.preview(draft);
            if (closed) { result.stop(); return; }
            video.srcObject = result.stream; video.hidden = false; notice.textContent = labels.previewing;
            await refreshDevices();
        }, false, !state.capabilities.preview, true);
        button(labels.stopPreview, function () {
            settings.cancel(); video.srcObject = null; video.hidden = true; notice.textContent = labels.stopped;
        }, true);
        var save = button(labels.save, async function () {
            var result = await settings.save(draft, { expectedVersion: state.version, scope: 'next-session' });
            if (closed) { return; }
            state = settings.read(); dirty = false; draft = Object.assign({}, state.effective);
            video.srcObject = null; video.hidden = true; render();
            notice.textContent = labels.saved + (result.warnings.length ? ' ' + labels.temporary : '');
        });
        button(labels.reload, async function () {
            await settings.load();
            if (closed) { return; }
            state = settings.read(); draft = Object.assign({}, state.effective); dirty = false;
            settings.cancel(); video.srcObject = null; video.hidden = true; render(); notice.textContent = labels.loaded;
        });
        form.onsubmit = function (event) { event.preventDefault(); save.click(); };
        function render() {
            inputs.profile.value = draft.profile; inputs.layout.value = draft.layout; deviceOptions();
        }
        function changed(event) {
            if (closed) { return; }
            if (event.data.name === 'settings-error') { notice.textContent = labels[event.data.error.name] || labels.failed; return; }
            if (event.data.name !== 'settings') { return; }
            var next = event.data.value;
            if (next.version === state.version) { return; }
            if (dirty || busy) { notice.textContent = labels.changed; return; }
            state = next; draft = Object.assign({}, state.effective); render(); notice.textContent = labels.loaded;
        }
        function refreshDefaults() {
            if (closed || busy || state.capabilities.persistence !== 'host') { return; }
            settings.load().catch(function () { /* Settings reports the failure through CHANGE. */ });
        }
        function onDeviceChange() { refreshDevices(); }
        if (settings.addEventListener) { settings.addEventListener(Event.CHANGE, changed); }
        window.addEventListener('focus', refreshDefaults);
        if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) { navigator.mediaDevices.addEventListener('devicechange', onDeviceChange); }
        render(); refreshDevices();
        _this.element = function () { return root; };
        _this.destroy = function () {
            if (closed) { return; }
            closed = true; operation++; deviceGeneration++;
            settings.cancel(); video.srcObject = null;
            if (settings.removeEventListener) { settings.removeEventListener(Event.CHANGE, changed); }
            window.removeEventListener('focus', refreshDefaults);
            if (navigator.mediaDevices && navigator.mediaDevices.removeEventListener) { navigator.mediaDevices.removeEventListener('devicechange', onDeviceChange); }
            Object.keys(inputs).forEach(function (name) { inputs[name].onchange = null; });
            buttons.forEach(function (button) { button.element.onclick = null; });
            form.onsubmit = null;
        };
    }
    odd.utils.SettingsPanel = SettingsPanel;
})(odd);
