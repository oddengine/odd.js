(function (odd) {
    var components = odd.IM.UI.components, utils = odd.utils, _active = null;

    function VoiceMessage() {
        var _this = this, _data = {}, _closed = false, _controller, _url,
            _element = utils.createElement('div', 'im-message-voice'),
            _button = utils.createElement('button', 'im-voice-play'),
            _progress = utils.createElement('progress'),
            _notice = utils.createElement('small'), _audio = new Audio();
        _button.type = 'button'; _notice.setAttribute('role', 'status');
        _progress.max = 1; _progress.value = 0; _progress.setAttribute('aria-label', '语音播放进度');
        _element.appendChild(_button); _element.appendChild(_progress); _element.appendChild(_notice);

        function label() {
            _button.textContent = (_audio.paused ? '播放语音 · ' : '暂停 · ') + Math.ceil((_data.durationMs || 0) / 1000) + ' 秒';
            var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '18'); svg.setAttribute('height', '18'); svg.setAttribute('aria-hidden', 'true');
            svg.innerHTML = _audio.paused ? '<path fill="currentColor" d="M7 4v16l14-8Z"/>' : '<path fill="currentColor" d="M6 4h4v16H6zM14 4h4v16h-4z"/>';
            _button.prepend(svg);
            _button.setAttribute('aria-label', _button.textContent);
        }
        function stop() {
            if (_controller) { _controller.abort(); _controller = null; }
            _audio.pause(); _audio.removeAttribute('src'); _audio.load();
            if (_url) { URL.revokeObjectURL(_url); _url = null; }
            _progress.value = 0; _button.disabled = !_data.loadVoice;
            if (_active === _this) { _active = null; }
            label();
        }
        _button.onclick = async function () {
            if (!_audio.paused) { _audio.pause(); label(); return; }
            _notice.textContent = '';
            if (_active && _active !== _this) { _active.stop(); }
            _active = _this;
            var controller = _controller = new AbortController();
            try {
                if (!_url) {
                    _button.disabled = true; _button.textContent = '正在加载语音…';
                    var blob = await _data.loadVoice(controller.signal);
                    if (_closed || controller.signal.aborted) { return; }
                    if (!(blob instanceof Blob) || blob.size > odd.IM.Voice.maxBytes) { throw new Error('语音文件无效。'); }
                    var info = odd.IM.Voice.inspect(await blob.arrayBuffer());
                    if (_closed || controller.signal.aborted) { return; }
                    if (info.durationMs !== _data.durationMs) { throw new Error('语音时长与消息不一致。'); }
                    _url = URL.createObjectURL(blob); _audio.src = _url;
                }
                await _audio.play();
            } catch (reason) {
                if (_closed || controller.signal.aborted) { return; }
                if (reason.name === 'NotAllowedError') { _notice.textContent = '已就绪，请再点一次播放。'; }
                else { stop(); _notice.textContent = /[\u4e00-\u9fff]/.test(reason.message || '') ? reason.message : '语音暂不可播放，请重试。'; }
            } finally {
                if (!_closed && !controller.signal.aborted) { _button.disabled = !_data.loadVoice; label(); }
            }
        };
        _audio.ontimeupdate = function () { _progress.value = _audio.duration ? _audio.currentTime / _audio.duration : 0; };
        _audio.onplay = label; _audio.onpause = label; _audio.onended = stop;
        _audio.onerror = function () { if (_url) { stop(); _notice.textContent = '语音暂不可播放，请重试。'; } };
        _this.update = function (value) {
            if (_data.id !== value.id) { stop(); _notice.textContent = ''; }
            _data = value;
            _button.disabled = !value.loadVoice || !!(_controller && !_url && _active === _this);
            if (!_button.disabled || !value.loadVoice) { label(); }
        };
        _this.element = function () { return _element; };
        _this.stop = stop;
        _this.destroy = function () { _closed = true; stop(); _button.onclick = null; _audio.onplay = _audio.onpause = _audio.onended = _audio.onerror = _audio.ontimeupdate = null; };
    }
    components.VoiceMessage = VoiceMessage;
})(odd);

