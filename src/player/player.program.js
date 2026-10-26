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
            _closed = false,
            _selecting = false;

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
                identity = source ? mixed ? key : [source.streamId, source.instanceId, source.generation.high, source.generation.low].join(':') : '';

            if (identity && identity !== _identity) {
                _identity = identity;
                _selecting = true;
                try { player.select({ type: 'FLV', vod: false, sources: [{ streamId: source.streamId, label: mixed ? 'PK 画面' : '直播画面' }] }); }
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
                    mode: mixed ? 'pk' : 'original', fallback: !!(payload && payload.mode === 'pk' && _failed === key) });
            }
        }

        function _onError() {
            var payload = _latest && _latest.payload;
            if (_closed || _selecting || !payload || payload.mode !== 'pk') { return; }
            var key = payload.pkId + ':' + payload.streamId;
            if (_failed === key || _identity !== key) { return; }
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
        _this.refresh = function () { _failed = ''; _choose(); };
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
