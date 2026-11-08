(async function () {
    var checks = 0, requests = [], calls = 0, settings, panel, stream;
    var original = navigator.mediaDevices.getUserMedia;
    function assert(value, message) { if (!value) { throw new Error(message); } checks++; }
    function tick() { return new Promise(function (resolve) { setTimeout(resolve, 10); }); }
    async function idle() { for (var i = 0; i < 100 && save.disabled; i++) { await tick(); } assert(!save.disabled, 'settings operation finishes'); }
    function capture() {
        var canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 90;
        canvas.getContext('2d').fillRect(0, 0, 160, 90);
        return canvas.captureStream(1);
    }
    navigator.mediaDevices.getUserMedia = function () {
        calls++;
        return new Promise(function (resolve, reject) { requests.push({ resolve: resolve, reject: reject }); });
    };
    try {
        settings = new odd.utils.Settings({ module: 'rtc' });
        panel = new odd.utils.SettingsPanel(settings);
        var root = panel.element(); document.querySelector('#host').appendChild(root);
        var stage = root.querySelector('.odd-settings-preview-stage'), video = root.querySelector('video'),
            start = root.querySelector('[aria-label="Preview devices"]'), stop = root.querySelector('[aria-label="Stop preview"]'),
            save = root.querySelector('[aria-label="Save defaults"]'), discard = root.querySelector('[aria-label="Discard changes"]'),
            profile = root.querySelector('[name="profile"]'), baseline = stage.getBoundingClientRect().height;
        assert(calls === 0 && baseline > 0, 'mount reserves preview without acquiring devices');
        assert(stop.disabled && !start.disabled, 'stop is unavailable until preview starts');
        assert(start.parentElement !== save.parentElement && root.querySelector('form').lastElementChild === save.parentElement, 'preview and footer operations are separate');
        assert([start, stop, save, discard].every(function (button) { return !button.textContent && button.querySelector('svg') && button.title; }), 'actions use named icons');
        start.click(); await tick();
        assert(calls === 1 && !stop.disabled && stage.getAttribute('aria-busy') === 'true', 'pending permission can be cancelled');
        stop.click(); await tick(); stream = capture(); requests.shift().resolve(stream); await tick();
        assert(stream.getTracks().every(function (track) { return track.readyState === 'ended'; }) && video.srcObject === null, 'late permission result cannot restart cancelled preview');
        assert(stage.getBoundingClientRect().height === baseline && !stage.querySelector('.odd-settings-preview-placeholder').hidden, 'cancel keeps the reserved stage');
        start.click(); await tick(); stream = capture(); requests.shift().resolve(stream); await idle();
        assert(video.srcObject.getVideoTracks()[0] === stream.getVideoTracks()[0] && !video.hidden && !stop.disabled, 'explicit preview displays local video');
        assert(stage.getBoundingClientRect().height === baseline, 'playing video does not resize the stage');
        assert(!settings.read().effective.beauty.enabled && settings.validate({beauty: {enabled:true, whitening:2, smoothing:0.3}}).errors.beauty, 'beauty is opt-in and validates ranges');
        var enable = root.querySelector('[name=beautyEnabled]'), whitening = root.querySelector('[name=whitening]'), smoothing = root.querySelector('[name=smoothing]');
        assert(whitening.disabled && smoothing.disabled, 'effect controls are disabled until enabled');
        enable.click(); await tick();
        var processed = video.srcObject.getVideoTracks()[0], captureCount = calls;
        assert(processed !== stream.getVideoTracks()[0] && processed.readyState === 'live', 'preview uses a processed video track');
        whitening.value = '60'; whitening.dispatchEvent(new Event('input')); await tick();
        assert(calls === captureCount && video.srcObject.getVideoTracks()[0] === processed, 'strength changes reuse the filter and camera');
        enable.click(); await tick();
        assert(video.srcObject.getVideoTracks()[0] === stream.getVideoTracks()[0] && processed.readyState === 'ended', 'disabling effects restores raw camera and releases output');
        enable.click(); await tick();
        processed = video.srcObject.getVideoTracks()[0];
        stop.click(); await tick();
        assert(stream.getTracks().every(function (track) { return track.readyState === 'ended'; }) && processed.readyState === 'ended' && stop.disabled && video.hidden, 'stop releases capture and restores the placeholder');
        var savedProfile = settings.read().effective.profile;
        profile.value = Array.from(profile.options).find(function (option) { return option.value !== savedProfile; }).value; profile.dispatchEvent(new Event('change'));
        discard.click(); await tick();
        assert(profile.value === savedProfile && settings.read().version === 0, 'discard restores saved defaults without writing');
        enable.click(); whitening.value = '65'; whitening.dispatchEvent(new Event('input'));
        start.click(); await tick(); stream = capture(); requests.shift().resolve(stream); await idle();
        processed = video.srcObject.getVideoTracks()[0];
        save.click(); await idle();
        assert(settings.read().version === 1 && settings.read().effective.beauty.enabled && settings.read().effective.beauty.whitening === 0.65 && processed.readyState === 'ended' && stream.getTracks().every(function (track) { return track.readyState === 'ended'; }), 'save applies next-session defaults and releases preview');
        assert(stage.getBoundingClientRect().height === baseline && video.hidden, 'save retains preview space');
        start.click(); await tick(); requests.shift().reject({ name: 'NotAllowedError' }); await idle();
        assert(!stage.querySelector('.odd-settings-preview-placeholder').hidden && stage.textContent.includes('Preview unavailable') && !start.disabled, 'permission error keeps preview space and supports retry');
        start.click(); await tick(); panel.destroy(); stream = capture(); requests.shift().resolve(stream); await tick();
        assert(stream.getTracks().every(function (track) { return track.readyState === 'ended'; }), 'leaving during permission wait releases late capture');
        window.testResult = { passed: true, checks: checks };
    } catch (error) { window.testResult = { passed: false, checks: checks, error: error.message, stack: error.stack }; }
    finally {
        if (panel) { panel.destroy(); }
        if (settings) { settings.destroy(); }
        if (stream) { stream.getTracks().forEach(function (track) { track.stop(); }); }
        navigator.mediaDevices.getUserMedia = original;
    }
})();
