(function (odd) {
    var RATE = 16000, SECONDS = 60, MAX_BYTES = 44 + RATE * SECONDS * 4;

    // Runs on the audio rendering thread. Never sends individual render quanta
    // to the UI thread, and never captures beyond the sample-count limit.
    function captureProcessor() {
        class VoiceCapture extends AudioWorkletProcessor {
            constructor() {
                super();
                this.left = new Float32Array(4096);
                this.right = new Float32Array(4096);
                this.length = 0;
                this.total = 0;
                this.done = false;
                this.port.onmessage = () => this.flush(true);
            }
            flush(done) {
                if (this.done) { return; }
                const left = this.left.slice(0, this.length), right = this.right.slice(0, this.length);
                this.port.postMessage({ left, right, done }, [left.buffer, right.buffer]);
                this.length = 0;
                this.done = done;
            }
            process(inputs) {
                if (this.done) { return false; }
                const input = inputs[0];
                if (!input || !input[0]) { return true; }
                for (let i = 0; i < input[0].length; i++) {
                    this.left[this.length] = input[0][i];
                    this.right[this.length++] = (input[1] || input[0])[i];
                    this.total++;
                    if (this.total >= sampleRate * 60) { this.flush(true); return false; }
                    if (this.length === 4096) { this.flush(false); }
                }
                return true;
            }
        }
        registerProcessor('odd-voice-capture', VoiceCapture);
    }

    function wav(left, right) {
        if (!left.length || left.length !== right.length || left.length > RATE * SECONDS) { throw new TypeError('语音长度无效。'); }
        var buffer = new ArrayBuffer(44 + left.length * 4), view = new DataView(buffer);
        function text(offset, value) { for (var i = 0; i < value.length; i++) { view.setUint8(offset + i, value.charCodeAt(i)); } }
        text(0, 'RIFF'); view.setUint32(4, buffer.byteLength - 8, true); text(8, 'WAVE');
        text(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
        view.setUint16(22, 2, true); view.setUint32(24, RATE, true); view.setUint32(28, RATE * 4, true);
        view.setUint16(32, 4, true); view.setUint16(34, 16, true); text(36, 'data'); view.setUint32(40, left.length * 4, true);
        for (var j = 0; j < left.length; j++) {
            for (var channel = 0; channel < 2; channel++) {
                var sample = Math.max(-1, Math.min(1, (channel ? right : left)[j] || 0));
                view.setInt16(44 + j * 4 + channel * 2, Math.round(sample * (sample < 0 ? 32768 : 32767)), true);
            }
        }
        return buffer;
    }

    function inspect(buffer) {
        if (!(buffer instanceof ArrayBuffer) || buffer.byteLength < 48 || buffer.byteLength > MAX_BYTES || (buffer.byteLength - 44) % 4) { throw new TypeError('语音文件大小无效。'); }
        var view = new DataView(buffer);
        function text(offset, value) { for (var i = 0; i < value.length; i++) { if (view.getUint8(offset + i) !== value.charCodeAt(i)) { return false; } } return true; }
        if (!text(0, 'RIFF') || !text(8, 'WAVE') || !text(12, 'fmt ') || !text(36, 'data') ||
            view.getUint32(4, true) !== buffer.byteLength - 8 || view.getUint32(16, true) !== 16 || view.getUint16(20, true) !== 1 ||
            view.getUint16(22, true) !== 2 || view.getUint32(24, true) !== RATE || view.getUint32(28, true) !== RATE * 4 ||
            view.getUint16(32, true) !== 4 || view.getUint16(34, true) !== 16 || view.getUint32(40, true) !== buffer.byteLength - 44) { throw new TypeError('语音格式无效，请使用 PCM 语音消息。'); }
        return { durationMs: Math.ceil((buffer.byteLength - 44) / 64), sampleRate: RATE, channels: 2, bits: 16 };
    }

    function VoiceRecorder(config) {
        var _this = this, _config = config || {}, _state = 'idle', _context, _stream, _source, _node,
            _url, _timer, _flushTimer, _chunks = [], _frames = 0, _rate, _resolve, _reject;
        _this.result = new Promise(function (resolve, reject) { _resolve = resolve; _reject = reject; });
        // Owners may attach their UI handler after awaiting start().
        _this.result.catch(function () {});

        function release() {
            clearTimeout(_timer); clearTimeout(_flushTimer);
            if (_stream) { _stream.getTracks().forEach(function (track) { track.onended = null; track.stop(); }); _stream = null; }
            if (_source) { _source.disconnect(); _source = null; }
            if (_node) { _node.port.onmessage = null; _node.port.close(); _node.disconnect(); _node = null; }
            if (_context) { _context.onstatechange = null; _context.close().catch(function () {}); _context = null; }
            if (_url) { URL.revokeObjectURL(_url); _url = null; }
        }
        function fail(reason) {
            if (_state === 'cancelled' || _state === 'done' || _state === 'failed') { return; }
            _state = 'failed'; release(); _chunks = []; _reject(reason);
        }
        async function finish() {
            if (_state !== 'recording' && _state !== 'stopping') { return; }
            _state = 'encoding'; release();
            try {
                if (!_frames) { throw new Error('没有录到声音，请重新录制。'); }
                var length = Math.min(RATE * SECONDS, Math.floor(_frames * RATE / _rate));
                if (!length) { throw new Error('录音过短，请重新录制。'); }
                var offline = new OfflineAudioContext(2, length, RATE), source = offline.createBufferSource(),
                    input = offline.createBuffer(2, _frames, _rate), offset = 0;
                _chunks.forEach(function (chunk) {
                    input.getChannelData(0).set(chunk.left, offset);
                    input.getChannelData(1).set(chunk.right, offset);
                    offset += chunk.left.length;
                });
                _chunks = []; source.buffer = input; source.connect(offline.destination); source.start();
                var rendered = await offline.startRendering();
                if (_state === 'cancelled') { return; }
                var buffer = wav(rendered.getChannelData(0), rendered.getChannelData(1));
                _state = 'done'; _resolve({ blob: new Blob([buffer], { type: 'audio/wav' }), durationMs: inspect(buffer).durationMs });
            } catch (reason) { fail(reason); }
        }
        _this.start = async function () {
            if (_state !== 'idle') { throw new Error('录音已经开始。'); }
            _state = 'opening';
            var stage = 'context';
            try {
                if (!navigator.mediaDevices || !window.AudioWorkletNode || !window.OfflineAudioContext) { throw new Error('当前浏览器不支持录音，请使用新版浏览器并通过 HTTPS 打开。'); }
                // Create/resume in the click gesture, before requesting permission.
                try { _context = new AudioContext({ sampleRate: RATE }); } catch (_) { _context = new AudioContext(); }
                var resumed = _context.resume(); resumed.catch(function () {});
                _rate = _context.sampleRate;
                if (_rate > 96000) { throw new Error('设备采样率过高，请选择其他麦克风。'); }
                stage = 'permission';
                var stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: { ideal: 2 }, sampleRate: { ideal: RATE } }, video: false });
                if (_state !== 'opening') { stream.getTracks().forEach(function (track) { track.stop(); }); return; }
                stage = 'worklet';
                _stream = stream;
                _url = URL.createObjectURL(new Blob(['(' + captureProcessor.toString() + ')();'], { type: 'application/javascript' }));
                await Promise.all([resumed, _context.audioWorklet.addModule(_url)]);
                if (_state !== 'opening') { return; }
                _node = new AudioWorkletNode(_context, 'odd-voice-capture', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
                _node.port.onmessage = function (event) {
                    if (_state !== 'recording' && _state !== 'stopping') { return; }
                    var value = event.data, count = Math.min(value.left.length, _rate * SECONDS - _frames);
                    if (count) { _chunks.push({ left: value.left.subarray(0, count), right: value.right.subarray(0, count) }); _frames += count; }
                    if (_config.onprogress) { _config.onprogress(Math.min(SECONDS, _frames / _rate)); }
                    if (value.done || _frames >= _rate * SECONDS) { finish(); }
                };
                _node.onprocessorerror = function () { fail(new Error('录音中断，请重新录制。')); };
                stage = 'source';
                _source = _context.createMediaStreamSource(_stream);
                _source.connect(_node); _node.connect(_context.destination); // Processor outputs silence; no microphone feedback.
                _stream.getAudioTracks().forEach(function (track) { track.onended = function () { _this.stop(); }; });
                _state = 'recording';
                _context.onstatechange = function () { if (_context && _context.state !== 'running' && _state === 'recording') { _this.stop(); } };
                _timer = setTimeout(function () { _this.stop(); }, SECONDS * 1000);
            } catch (reason) { reason.operation = stage; fail(reason); throw reason; }
        };
        _this.stop = function () {
            if (_state === 'recording') {
                _state = 'stopping'; _node.port.postMessage('stop');
                // A suspended audio context might not deliver another message.
                _flushTimer = setTimeout(finish, 250);
            }
            return _this.result;
        };
        _this.cancel = function () {
            _state = 'cancelled'; release(); _chunks = [];
            _reject(new DOMException('录音已取消', 'AbortError'));
        };
        _this.state = function () { return _state; };
    }
    VoiceRecorder.prototype.kind = 'VoiceRecorder';
    odd.IM.VoiceRecorder = VoiceRecorder;
    odd.IM.Voice = { encode: wav, inspect: inspect, maxBytes: MAX_BYTES };
})(odd);

