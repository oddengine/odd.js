(function (odd) {
    function SettingsPanel(settings, config) {
        config = config || {};
        var labels = Object.assign({ title: 'Audio, video and layout', notice: 'Save defaults for the next session; the current call stays unchanged.', profile: 'Quality limit', camera: 'Camera', microphone: 'Microphone', systemDefault: 'System default', off: 'Off by default', layout: 'Layout', right: 'Right', top: 'Top', bottom: 'Bottom', left: 'Left', grid: 'Grid', fps: 'fps', preview: 'Preview devices', previewing: 'Previewing local devices.', stopPreview: 'Stop preview', save: 'Save defaults', saved: 'Defaults saved for the next session.', temporary: 'Preferences are stored in this instance only.', failed: 'The operation did not finish. Check the settings and try again.', ConflictError: 'Settings changed. Reopen this page before saving.' }, config.labels || {});
        if (!settings || typeof settings.read !== 'function') { throw { name: 'DataError', message: 'Module settings are required.' }; }
        var _this = this, root = document.createElement('section'), state = settings.read(),
            draft = Object.assign({}, state.effective), notice = document.createElement('p'),
            form = document.createElement('form'), video = document.createElement('video'), closed = false, inputs = [];
        root.className = 'odd-settings-panel';
        var title = document.createElement('h2');
        title.textContent = labels.title;
        root.appendChild(title);
        notice.setAttribute('role', 'status');
        notice.textContent = labels.notice;
        root.appendChild(notice);
        root.appendChild(form);
        function select(name, title, choices) {
            var label = document.createElement('label'), input = document.createElement('select');
            label.textContent = title;
            choices.forEach(function (choice) {
                var option = document.createElement('option'); option.value = choice[0]; option.textContent = choice[1]; input.appendChild(option);
            });
            input.value = draft[name] === true ? '' : String(draft[name]);
            input.onchange = function () { draft[name] = input.value === 'false' ? false : input.value; };
            label.appendChild(input); form.appendChild(label); inputs.push(input);
        }
        select('profile', labels.profile, state.capabilities.profiles.map(function (name) {
            var value = odd.RTC.Constraints[name].video;
            return [name, value.width + ' × ' + value.height + ' · ' + value.frameRate + ' ' + labels.fps];
        }));
        select('camera', labels.camera, [['', labels.systemDefault], ['false', labels.off]]);
        select('microphone', labels.microphone, [['', labels.systemDefault], ['false', labels.off]]);
        var layouts = { right: labels.right, top: labels.top, bottom: labels.bottom, left: labels.left, grid: labels.grid };
        select('layout', labels.layout, state.capabilities.layouts.map(function (name) { return [name, layouts[name] || name]; }));
        video.muted = true; video.autoplay = true; video.playsInline = true; video.hidden = true;
        form.appendChild(video);
        var actions = document.createElement('div'); actions.className = 'odd-settings-actions'; form.appendChild(actions);
        function button(text, action) {
            var value = document.createElement('button'); value.type = 'button'; value.textContent = text;
            value.onclick = async function () {
                value.disabled = true;
                try { await action(); } catch (error) { if (!closed) { notice.textContent = labels[error.name] || labels.failed; } }
                finally { if (!closed) { value.disabled = false; } }
            };
            actions.appendChild(value); inputs.push(value); return value;
        }
        var preview = button(labels.preview, async function () {
            var result = await settings.preview(draft);
            if (closed) { result.stop(); return; }
            video.srcObject = result.stream; video.hidden = false; notice.textContent = labels.previewing;
        });
        preview.disabled = !state.capabilities.preview;
        button(labels.stopPreview, function () { settings.cancel(); video.srcObject = null; video.hidden = true; });
        var save = button(labels.save, async function () {
            var result = await settings.save(draft, { expectedVersion: state.version, scope: 'next-session' });
            if (closed) { return; }
            state = settings.read(); video.srcObject = null; video.hidden = true;
            notice.textContent = labels.saved + (result.warnings.length ? ' ' + labels.temporary : '');
        });
        form.onsubmit = function (event) { event.preventDefault(); save.click(); };
        _this.element = function () { return root; };
        _this.destroy = function () {
            if (closed) { return; }
            closed = true; settings.cancel(); video.srcObject = null;
            inputs.forEach(function (input) { input.onclick = input.onchange = null; });
            form.onsubmit = null;
        };
    }
    odd.utils.SettingsPanel = SettingsPanel;
})(odd);
