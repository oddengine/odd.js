(function (odd) {
    var Player = odd.Player,
        Event = odd.events.Event;

    // Consumes the borrowed IM's validated current-state snapshot. It owns only
    // playback selection, never the IM, publisher, credentials or business PK.
    function Program(player, config) {
        var _this = this,
            _latest = null,
            _streams = [],
            _selected = '',
            _identity = '',
            _failed = '',
            _line = 'auto',
            _sourceIdentity = '',
            _sourceProtocol = '',
            _failedLines = new Set(),
            _closed = false,
            _selecting = false;

        var formats = { 'HTTP-FLV': 'FLV', 'HTTP-CMAF': 'FMP4', HLS: 'SRC', 'HLS-2nd': 'SRC', DASH: 'DASH' },
            configured = Array.isArray(config.lines) ? config.lines.slice() : ['HTTP-FLV'];

        _this.lines = function () {
            return configured.filter(function (protocol, index) {
                if (!formats[protocol] || configured.indexOf(protocol) !== index) { return false; }
                return !!odd.Module.get({ type: formats[protocol], vod: false,
                    sources: [{ streamId: '00000000-0000-4000-8000-000000000001', protocol: protocol }] });
            });
        };

        function _protocol() {
            if (_line !== 'auto') { return _line; }
            var lines = _this.lines(), mobile = odd.OS.isIOS || odd.OS.isMobile && odd.Browser.isSafari || odd.OS.isMac && navigator.maxTouchPoints > 1,
                order = mobile ? ['HLS-2nd', 'HLS', 'HTTP-CMAF', 'HTTP-FLV', 'DASH'] : ['HTTP-FLV', 'HTTP-CMAF', 'HLS-2nd', 'HLS', 'DASH'];
            // MPEG-TS omits WHIP's Opus audio. It remains a manual option, but
            // must not silently become the automatic fallback for that source.
            return order.find(function (protocol) {
                return !(_sourceProtocol === 'WHIP' && protocol === 'HLS') && lines.indexOf(protocol) !== -1 && !_failedLines.has(protocol);
            }) || '';
        }

        function _original() {
            var payload = _latest && _latest.payload;
            return _streams.find(function (item) {
                return item.streamId === (_selected && (!payload || payload.mode !== 'pk') ? _selected : payload ? payload.originalStreamId : '');
            }) || _streams.find(function (item) {
                return item.protocol === 'WHIP' && (!payload || item.userId === payload.userId);
            });
        }

        function _choose() {
            if (_closed) { return; }
            var payload = _latest && _latest.payload,
                key = payload && payload.pkId + ':' + payload.streamId,
                mixed = payload && payload.mode === 'pk' && payload.state === 'active' && _failed !== key,
                original = _original(),
                source = mixed ? payload : original,
                sourceIdentity = source ? mixed ? key : [source.streamId, source.instanceId, source.generation.high, source.generation.low].join(':') : '';

            if (sourceIdentity !== _sourceIdentity) { _failedLines.clear(); _sourceIdentity = sourceIdentity; }
            _sourceProtocol = mixed ? '' : source && source.protocol || '';
            var protocol = _protocol(), identity = sourceIdentity && protocol ? sourceIdentity + ':' + protocol : '';

            if (identity && identity !== _identity) {
                _identity = identity;
                _selecting = true;
                try { player.select({ type: formats[protocol], vod: false, sources: [{ streamId: source.streamId, protocol: protocol, label: mixed ? 'PK 画面' : '直播画面' }] }); }
                finally { _selecting = false; }
            } else if (!identity && _identity) {
                // An authoritative snapshot with no original ends playback.
                // A temporarily unknown snapshot never reaches this method.
                _identity = '';
                _selecting = true;
                try { player.select({ type: 'FLV', vod: false, sources: [] }); }
                finally { _selecting = false; }
            }
            if (typeof config.change === 'function') {
                config.change({ program: payload, streamId: source ? source.streamId : '',
                    line: _line, protocol: protocol, mode: mixed ? 'pk' : 'original', fallback: !!(payload && payload.mode === 'pk' && _failed === key) });
            }
        }

        function _onError(e) {
            if (e && e.data && e.data.recoverable === true && (e.data.operation === 'capture' || e.data.operation === 'record')) { return; }
            var payload = _latest && _latest.payload;
            if (_closed || _selecting) { return; }
            if (e.type === Event.ERROR && _line === 'auto' && _identity && e.data &&
                ['NotSupportedError', 'EncodingError', 'NetworkError', 'TimeoutError'].indexOf(e.data.name) !== -1) {
                _failedLines.add(_protocol());
                if (_protocol()) { _choose(); return; }
            }
            if (!payload || payload.mode !== 'pk') { return; }
            var key = payload.pkId + ':' + payload.streamId;
            if (_failed === key || _sourceIdentity !== key) { return; }
            _failed = key;
            _choose();
        }

        _this.apply = function (snapshot) {
            if (_closed || !snapshot || !snapshot.known || !Array.isArray(snapshot.states)) { return; }
            _streams = snapshot.states.filter(function (item) {
                return item.kind === 'channel.publication' && item.payload.appId === config.appId &&
                    item.payload.channelAppId === config.channelAppId && item.payload.state === 'active';
            }).map(function (item) { return item.payload; });
            snapshot.states.forEach(function (item) {
                if (item.kind !== 'channel.program' || item.payload.appId !== config.appId ||
                    item.payload.channelAppId !== config.channelAppId || item.payload.businessId !== config.businessId) { return; }
                if (!_latest || odd.IM.Protocol.compareEventState(item, _latest) > 0) { _latest = item; }
            });
            _choose();
        };

        _this.select = function (streamId) { _selected = streamId; _choose(); };
        _this.line = function (value) {
            if (value === undefined) { return _line; }
            if (value !== 'auto' && _this.lines().indexOf(value) === -1) { throw { name: 'NotSupportedError', message: 'Playback line is not supported on this device.' }; }
            if (value === _line) { return; }
            _line = value; _failedLines.clear(); _choose();
        };
        _this.refresh = function () { _failed = ''; _failedLines.clear(); _identity = ''; _choose(); };
        _this.destroy = function () {
            _closed = true;
            player.removeEventListener(Event.ERROR, _onError);
            player.removeEventListener(Event.ENDED, _onError);
            _latest = null;
            _streams = [];
        };
        player.addEventListener(Event.ERROR, _onError);
        player.addEventListener(Event.ENDED, _onError);
    }

    Player.Program = Program;
})(odd);
