(function (odd) {
    function SettingsPanel(settings) {
        if (!settings || typeof settings.read !== 'function') { throw { name: 'DataError', message: '需要模块的设置能力。' }; }
        var _this = this, root = document.createElement('section'), state = settings.read(),
            draft = Object.assign({}, state.effective), notice = document.createElement('p'),
            form = document.createElement('form'), video = document.createElement('video'), closed = false, inputs = [];
        root.className = 'odd-settings-panel';
        var title = document.createElement('h2');
        title.textContent = '音视频与布局';
        root.appendChild(title);
        notice.setAttribute('role', 'status');
        notice.textContent = '保存为下次会话的默认值，当前通话保持不变。';
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
        select('profile', '画质上限', state.capabilities.profiles.map(function (name) {
            var value = odd.RTC.Constraints[name].video;
            return [name, value.width + ' × ' + value.height + ' · ' + value.frameRate + ' 帧/秒'];
        }));
        select('camera', '摄像头', [['', '系统默认设备'], ['false', '默认关闭']]);
        select('microphone', '麦克风', [['', '系统默认设备'], ['false', '默认关闭']]);
        var layouts = { right: '右侧', top: '上方', grid: '网格' };
        select('layout', '画面布局', state.capabilities.layouts.map(function (name) { return [name, layouts[name] || name]; }));
        video.muted = true; video.autoplay = true; video.playsInline = true; video.hidden = true;
        form.appendChild(video);
        var actions = document.createElement('div'); actions.className = 'odd-settings-actions'; form.appendChild(actions);
        function button(text, action) {
            var value = document.createElement('button'); value.type = 'button'; value.textContent = text;
            value.onclick = async function () {
                value.disabled = true;
                try { await action(); } catch (error) { if (!closed) { notice.textContent = error.message || '操作未完成。'; } }
                finally { if (!closed) { value.disabled = false; } }
            };
            actions.appendChild(value); inputs.push(value); return value;
        }
        var preview = button('预览设备', async function () {
            var result = await settings.preview(draft);
            if (closed) { result.stop(); return; }
            video.srcObject = result.stream; video.hidden = false; notice.textContent = '正在预览本机设备。';
        });
        preview.disabled = !state.capabilities.preview;
        button('停止预览', function () { settings.cancel(); video.srcObject = null; video.hidden = true; });
        var save = button('保存下次默认', async function () {
            var result = await settings.save(draft, { expectedVersion: state.version, scope: 'next-session' });
            if (closed) { return; }
            state = settings.read(); video.srcObject = null; video.hidden = true;
            notice.textContent = '已保存下次默认，当前会话未改变。' + result.warnings.join(' ');
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
