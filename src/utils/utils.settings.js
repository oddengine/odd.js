(function (odd) {
    var utils = odd.utils,
        Event = odd.events.Event,
        EventDispatcher = odd.events.EventDispatcher;

    // Defaults belong to this module. Storage and low-frequency invalidation
    // are injected; saving never reconfigures an active media connection.
    function Settings(config) {
        config = config || {};
        EventDispatcher.call(this, 'Settings', {}, [Event.CHANGE]);
        var _this = this, defaults = {
            profile: config.module === 'rtc' ? '720P_2' : '180P_1',
            camera: '', microphone: '', layout: 'right',
        };
        var encodings = odd.RTC && odd.RTC.Encodings;
        if (encodings) {
            defaults.video = { svc: false, encodings: [] };
            var rtcDefaults = config.module === 'rtc' && odd.RTC.UI ? odd.RTC.UI.prototype.CONF : odd.RTC.prototype.CONF;
            defaults.codecpreferences = rtcDefaults.codecpreferences.slice(0);
        }
        Object.keys(defaults).forEach(function (name) {
            if (config.defaults && config.defaults[name] !== undefined) {
                defaults[name] = name === 'video' ? utils.extendz({}, defaults.video, config.defaults.video) : config.defaults[name];
            }
        });
        defaults = utils.extendz({}, defaults);
        var values = utils.extendz({}, defaults), version = 0,
            generation = 0, preview = null, closed = false, saving = false,
            loading = null, refresh = false, unsubscribe, storageError = null;

        _this.describe = function () {
            var profiles = odd.RTC && odd.RTC.Constraints || {};
            return { module: config.module || 'im', profiles: Object.keys(profiles),
                layouts: ['right', 'top', 'bottom', 'left', 'grid'],
                preview: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
                devices: !!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices),
                encodings: encodings ? encodings.describe() : null,
                persistence: config.storage ? 'host' : 'instance', scope: 'next-session' };
        };
        _this.read = function () {
            return { effective: utils.extendz({}, values), defaults: utils.extendz({}, defaults),
                version: version, capabilities: _this.describe(),
                storageError: storageError ? { name: storageError.name, message: storageError.message } : null };
        };
        _this.validate = function (draft) {
            var errors = {}, result = utils.extendz({}, values), description = _this.describe();
            if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
                return { value: result, errors: { form: 'Invalid settings format.' } };
            }
            Object.keys(draft).forEach(function (name) {
                if (Object.keys(defaults).indexOf(name) < 0) { errors[name] = 'Unsupported setting.'; return; }
                var value = draft[name];
                if (name === 'profile' && description.profiles.indexOf(value) < 0 ||
                    name === 'layout' && description.layouts.indexOf(value) < 0 ||
                    (name === 'camera' || name === 'microphone') && !(typeof value === 'boolean' ||
                        typeof value === 'string' && value.length <= 256)) {
                    errors[name] = 'The setting value is unavailable.'; return;
                }
                result[name] = utils.extendz({}, { value: value }).value;
            });
            if (encodings) {
                try { encodings.validate(result.video, result.codecpreferences); }
                catch (error) { errors.video = error.message; }
            }
            return { value: result, errors: errors };
        };
        function _changed(reason) {
            if (!closed) { _this.dispatchEvent(Event.CHANGE, { name: 'settings', reason: reason, value: _this.read() }); }
        }
        function _storageFailed(error) {
            storageError = { name: error.name || 'UnknownError', message: error.message || 'Local settings are unavailable.' };
            if (!closed) { _this.dispatchEvent(Event.CHANGE, { name: 'settings-error', error: storageError }); }
        }
        function _refresh() {
            if (!refresh || closed || saving || loading) { return; }
            refresh = false;
            _this.load().catch(function () { /* load reports its error to the owning view. */ });
        }
        function _onStored(next) {
            if (closed || !Number.isSafeInteger(next) || next <= version || saving && next === version + 1) { return; }
            refresh = true;
            _refresh();
        }

        _this.save = async function (draft, options) {
            if (closed || saving || loading) { throw { name: 'InvalidStateError', message: 'Settings are closed or busy.' }; }
            if (!options || options.scope !== 'next-session' || options.expectedVersion !== version) {
                throw { name: 'ConflictError', message: 'Settings changed. Read the current version before saving.' };
            }
            var checked = _this.validate(draft);
            if (Object.keys(checked.errors).length) { throw { name: 'DataError', message: 'Check the settings values.', fields: checked.errors }; }
            if (!Number.isSafeInteger(version + 1)) { throw { name: 'DataError', message: 'Settings version limit reached.' }; }
            saving = true;
            try {
                if (config.storage) {
                    await config.storage.save(config.key, { value: checked.value, version: version + 1 }, { expectedVersion: version });
                }
                if (closed) { throw { name: 'AbortError', message: 'Settings were closed.' }; }
                values = checked.value;
                version++;
                storageError = null;
                if (config.applyDefaults) { config.applyDefaults(utils.extendz({}, values)); }
                _this.cancel();
                _changed('saved');
                return { version: version, applied: [], deferred: Object.keys(values),
                    warnings: config.storage ? [] : ['Preferences are stored in this instance only.'] };
            } catch (error) {
                if (error.name === 'ConflictError') { refresh = true; }
                if (config.storage) { _storageFailed(error); }
                throw error;
            } finally { saving = false; _refresh(); }
        };
        _this.load = function () {
            if (closed || saving) { return Promise.reject({ name: 'InvalidStateError', message: 'Settings are closed or being saved.' }); }
            if (!config.storage) { return Promise.resolve(_this.read()); }
            if (loading) { return loading; }
            var previous = version;
            loading = Promise.resolve().then(async function () {
                // The public load promise is the freshness barrier. Invalidation
                // received during a read must finish inside this same promise.
                for (var attempt = 0; attempt < 8; attempt++) {
                    refresh = false;
                    var saved = await config.storage.load(config.key);
                    if (closed || version !== previous) { throw { name: 'AbortError', message: 'Settings changed.' }; }
                    var checked = _this.validate(Object.assign({}, defaults, saved ? saved.value : {}));
                    if (saved && (!Number.isSafeInteger(saved.version) || saved.version < 0) || Object.keys(checked.errors).length) {
                        throw { name: 'DataError', message: 'Stored settings are invalid.' };
                    }
                    values = checked.value;
                    version = saved ? saved.version : 0;
                    previous = version;
                    storageError = null;
                    if (config.applyDefaults) { config.applyDefaults(utils.extendz({}, values)); }
                    _changed('loaded');
                    if (!refresh) { return _this.read(); }
                }
                throw { name: 'ConflictError', message: 'Defaults keep changing. Retry after the other window finishes saving.' };
            }).catch(function (error) {
                refresh = false;
                _storageFailed(error);
                throw error;
            }).finally(function () { loading = null; });
            return loading;
        };

        _this.devices = async function () {
            if (closed) { throw { name: 'InvalidStateError', message: 'Settings are closed.' }; }
            if (!_this.describe().devices) { throw { name: 'NotSupportedError', message: 'Device enumeration is unavailable.' }; }
            var devices = await navigator.mediaDevices.enumerateDevices();
            if (closed) { throw { name: 'AbortError', message: 'Settings were closed.' }; }
            var seen = {}, result = [];
            devices.forEach(function (device) {
                if (result.length >= 128 || ['videoinput', 'audioinput'].indexOf(device.kind) < 0 || !device.deviceId) { return; }
                var key = device.kind + ':' + device.deviceId;
                if (seen[key]) { return; }
                seen[key] = true;
                result.push({ kind: device.kind, deviceId: device.deviceId, label: device.label || '' });
            });
            return result;
        };
        _this.preview = async function (draft) {
            if (closed) { throw { name: 'InvalidStateError', message: 'Settings are closed.' }; }
            _this.cancel();
            var checked = _this.validate(draft), current = generation;
            if (Object.keys(checked.errors).length || !_this.describe().preview) {
                throw { name: 'NotSupportedError', message: 'Device preview is unavailable. Check browser permissions.' };
            }
            var value = checked.value, profile = odd.RTC.Constraints[value.profile];
            var video = value.camera === false ? false : utils.extendz({}, profile.video || {});
            var audio = value.microphone === false ? false : utils.extendz({}, profile.audio || {});
            if (!video && !audio) { throw { name: 'NotSupportedError', message: 'Select a camera or microphone to preview.' }; }
            if (video && typeof value.camera === 'string' && value.camera) { video.deviceId = { exact: value.camera }; }
            if (audio && typeof value.microphone === 'string' && value.microphone) { audio.deviceId = { exact: value.microphone }; }
            var stream = await navigator.mediaDevices.getUserMedia({ video: video, audio: audio });
            function stop() { stream.getTracks().forEach(function (track) { track.stop(); }); if (preview === stream) { preview = null; } }
            if (closed || current !== generation) { stop(); throw { name: 'AbortError', message: 'Preview was cancelled.' }; }
            preview = stream;
            return { stream: stream, stop: stop };
        };
        _this.cancel = function () {
            generation++;
            if (preview) { preview.getTracks().forEach(function (track) { track.stop(); }); preview = null; }
        };
        _this.destroy = function () {
            if (closed) { return; }
            closed = true;
            if (unsubscribe) { unsubscribe(); }
            _this.cancel();
            _this.removeEventListener(Event.CHANGE);
        };
        if (config.storage && typeof config.storage.subscribe === 'function') {
            unsubscribe = config.storage.subscribe(config.key, _onStored);
        }
    }
    Settings.prototype = Object.create(EventDispatcher.prototype);
    Settings.prototype.constructor = Settings;
    utils.Settings = Settings;
})(odd);
