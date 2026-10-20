(function (odd) {
    var utils = odd.utils;

    // A module owns defaults. Saving never opens devices, ends calls or
    // reconfigures an existing publisher. Persistence is an injected CAS store.
    function Settings(config) {
        config = config || {};
        var _this = this, defaults = {
            profile: config.module === 'rtc' ? '720P_2' : '180P_1',
            camera: '', microphone: '', layout: 'right',
        };
        Object.keys(defaults).forEach(function (name) {
            if (config.defaults && config.defaults[name] !== undefined) { defaults[name] = config.defaults[name]; }
        });
        var values = utils.extendz({}, defaults),
            version = 0, generation = 0, preview = null, closed = false, saving = false;

        _this.describe = function () {
            var profiles = odd.RTC && odd.RTC.Constraints || {};
            return { module: config.module || 'im', profiles: Object.keys(profiles),
                layouts: ['right', 'top', 'grid'],
                preview: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
                persistence: config.storage ? 'host' : 'instance', scope: 'next-session' };
        };
        _this.read = function () {
            return { effective: utils.extendz({}, values), defaults: utils.extendz({}, defaults),
                version: version, capabilities: _this.describe() };
        };
        _this.validate = function (draft) {
            var errors = {}, result = utils.extendz({}, values), description = _this.describe();
            if (!draft || typeof draft !== 'object') { return { value: result, errors: { form: '设置格式不正确。' } }; }
            Object.keys(draft).forEach(function (name) {
                if (Object.keys(defaults).indexOf(name) < 0) { errors[name] = '不支持此设置。'; return; }
                var value = draft[name];
                if (name === 'profile' && description.profiles.indexOf(value) < 0 ||
                    name === 'layout' && description.layouts.indexOf(value) < 0 ||
                    (name === 'camera' || name === 'microphone') && !(typeof value === 'boolean' ||
                        typeof value === 'string' && value.length <= 256)) {
                    errors[name] = '设置值不可用。'; return;
                }
                result[name] = value;
            });
            return { value: result, errors: errors };
        };
        _this.save = async function (draft, options) {
            if (closed || saving) { throw { name: 'InvalidStateError', message: '设置已关闭或正在保存。' }; }
            if (!options || options.scope !== 'next-session' || options.expectedVersion !== version) {
                throw { name: 'ConflictError', message: '设置已变化，请重新读取后保存。' };
            }
            var checked = _this.validate(draft), current = generation;
            if (Object.keys(checked.errors).length) { throw { name: 'DataError', message: '请检查设置选项。', fields: checked.errors }; }
            saving = true;
            try {
                if (config.storage) {
                    // Host save must atomically compare expectedVersion. A failed
                    // write is never presented as a successful local save.
                    await config.storage.save(config.key, { value: checked.value, version: version + 1 }, { expectedVersion: version });
                }
                if (closed || current !== generation) { throw { name: 'AbortError', message: '设置窗口已关闭。' }; }
                values = checked.value;
                version++;
                if (config.applyDefaults) { config.applyDefaults(utils.extendz({}, values)); }
                _this.cancel();
                return { version: version, applied: [], deferred: Object.keys(values),
                    warnings: config.storage ? [] : ['当前偏好仅保留在本次实例中。'] };
            } finally { saving = false; }
        };
        _this.load = async function () {
            if (!config.storage) { return _this.read(); }
            var current = generation, previous = version, saved = await config.storage.load(config.key);
            if (closed || generation !== current || version !== previous || saving) { throw { name: 'AbortError', message: '设置已变化。' }; }
            if (saved) {
                var checked = _this.validate(saved.value);
                if (!Number.isSafeInteger(saved.version) || saved.version < 0 || Object.keys(checked.errors).length) {
                    throw { name: 'DataError', message: '保存的设置不可用。' };
                }
                values = checked.value; version = saved.version;
                if (config.applyDefaults) { config.applyDefaults(utils.extendz({}, values)); }
            }
            return _this.read();
        };
        _this.preview = async function (draft) {
            if (closed) { throw { name: 'InvalidStateError', message: '设置已关闭。' }; }
            _this.cancel();
            var checked = _this.validate(draft), current = generation;
            if (Object.keys(checked.errors).length || !_this.describe().preview) {
                throw { name: 'NotSupportedError', message: '设备预览不可用，请检查浏览器权限。' };
            }
            var value = checked.value, profile = odd.RTC.Constraints[value.profile];
            var video = value.camera === false ? false : utils.extendz({}, profile.video || {});
            var audio = value.microphone === false ? false : utils.extendz({}, profile.audio || {});
            if (video && typeof value.camera === 'string' && value.camera) { video.deviceId = { exact: value.camera }; }
            if (audio && typeof value.microphone === 'string' && value.microphone) { audio.deviceId = { exact: value.microphone }; }
            var stream = await navigator.mediaDevices.getUserMedia({ video: video, audio: audio });
            function stop() { stream.getTracks().forEach(function (track) { track.stop(); }); if (preview === stream) { preview = null; } }
            if (closed || current !== generation) { stop(); throw { name: 'AbortError', message: '预览已取消。' }; }
            preview = stream;
            return { stream: stream, stop: stop };
        };
        _this.cancel = function () {
            generation++;
            if (preview) { preview.getTracks().forEach(function (track) { track.stop(); }); preview = null; }
        };
        _this.destroy = function () { if (!closed) { closed = true; _this.cancel(); } };
    }
    utils.Settings = Settings;
})(odd);
