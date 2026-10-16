(function (odd) {
    var IM = odd.IM, Protocol = IM.Protocol, Type = Protocol.Type;

    function _object(fields) {
        var result = Object.create(null);
        fields.forEach(function (field) {
            result[field.key] = field.type === Type.OBJECT ? _object(field.value) : field.value;
        });
        return result;
    }

    function _time(value) {
        if (!value || value.high > 2097151) {
            throw { name: 'DataError', message: 'Invalid speaker observation time.' };
        }
        return value.high * 4294967296 + value.low;
    }

    function _id(value) {
        return typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value);
    }

    function _decimal(value) {
        var high = value.high, low = value.low, digits = '';
        do {
            var rest = (high % 10) * 4294967296 + low;
            high = Math.floor(high / 10);
            low = Math.floor(rest / 10);
            digits = (rest % 10) + digits;
        } while (high || low);
        return digits;
    }

    // One optional, ephemeral observer per existing room visit. The reliable
    // projection remains the only source of identity and presentation roles.
    function Speakers(room, basis, changed, refresh) {
        var _this = this, _closed = false, _clock = null, _latest = null, _sequence = null,
            _epoch = '', _subscription = '', _signature = '', _refreshing = false,
            _retryAt = 0, _receivedAt = performance.now(), _wall = Date.now(), _steady = performance.now(),
            _hidden = typeof document !== 'undefined' && document.hidden;

        function visibility() {
            _clock = _latest = null;
            _hidden = document.hidden;
            emit();
        }
        if (typeof document !== 'undefined') {
            document.addEventListener('visibilitychange', visibility);
        }

        _this.negotiate = function (info, started) {
            if (_closed) { return; }
            var now = performance.now(), roundtrip = now - started;
            if (info.speakersVersion !== 1 || !_id(info.speakersEpoch) || !_id(info.subscriptionId) ||
                !info.target || info.target.type !== 'room' || info.target.id !== room ||
                roundtrip < 0 || roundtrip > 1000) {
                _clock = _latest = null;
                return;
            }
            var server = _time(info.serverTime);
            if (_epoch !== info.speakersEpoch || _subscription !== info.subscriptionId) {
                _latest = _sequence = null;
            }
            _epoch = info.speakersEpoch;
            _subscription = info.subscriptionId;
            _clock = { server: server, sent: started, received: now };
            _wall = Date.now();
            _steady = now;
            _receivedAt = now;
        };

        function clock() {
            var now = performance.now(), wall = Date.now(), hidden = typeof document !== 'undefined' && document.hidden;
            if (hidden || hidden !== _hidden || Math.abs((wall - _wall) - (now - _steady)) > 500) {
                _clock = _latest = null;
            }
            _hidden = hidden;
            _wall = wall;
            _steady = now;
            return _clock ? { lower: _clock.server + now - _clock.received,
                upper: _clock.server + now - _clock.sent } : null;
        }

        _this.receive = function (fields) {
            if (_closed) { return; }
            Protocol.validateFields(fields, [
                { key: 'subscriptionId', type: Type.STRING }, { key: 'target', type: Type.OBJECT },
                { key: 'roomGeneration', type: Type.UINT64 }, { key: 'basisHead', type: Type.UINT64 },
                { key: 'epoch', type: Type.STRING }, { key: 'sequence', type: Type.UINT64 },
                { key: 'sampledAt', type: Type.UINT64 }, { key: 'validUntil', type: Type.UINT64 },
                { key: 'complete', type: Type.BOOL }, { key: 'items', type: Type.ARRAY },
            ]);
            Protocol.validateTarget(fields[1].value);
            var data = _object(fields), time = clock();
            if (!time || data.target.type !== 'room' || data.target.id !== room ||
                data.subscriptionId !== _subscription || data.epoch !== _epoch ||
                (!data.sequence.high && !data.sequence.low) ||
                (_sequence && Protocol.compare64(data.sequence, _sequence) <= 0)) {
                return;
            }
            var sampled = _time(data.sampledAt), until = _time(data.validUntil);
            if (sampled > time.upper + 500 || until <= time.upper || until < sampled || until - sampled > 10000 ||
                !Array.isArray(data.items) || data.items.length > 11) {
                return;
            }
            var seen = Object.create(null);
            data.items = data.items.map(function (entry) {
                if (entry.type !== Type.OBJECT) {
                    throw { name: 'DataError', message: 'Invalid speaker item.' };
                }
                Protocol.validateFields(entry.value, [
                    { key: 'resourceId', type: Type.STRING }, { key: 'publisherGeneration', type: Type.UINT64 },
                    { key: 'active', type: Type.BOOL }, { key: 'sampleUntil', type: Type.UINT64 },
                ]);
                var item = _object(entry.value), expires = _time(item.sampleUntil);
                if (!_id(item.resourceId) || seen[item.resourceId] || (!item.publisherGeneration.high && !item.publisherGeneration.low) ||
                    expires > sampled + 5500) {
                    throw { name: 'DataError', message: 'Invalid speaker identity or sample deadline.' };
                }
                seen[item.resourceId] = true;
                return item;
            });
            _latest = data;
            _sequence = data.sequence;
            _receivedAt = performance.now();
            emit();
        };

        _this.view = function () {
            var current = !_closed && basis(), time = clock(), data = _latest,
                view = { observedAt: performance.now(), roomId: room, known: false, complete: false, validUntil: '0', priority: [], items: [] };
            if (!current || !current.info.snapshotReady) { return view; }
            var projection = current.projection, state = projection['room.state:' + room];
            if (!state || state.payload.state !== 'active') { return view; }
            var fresh = time && data && _time(data.validUntil) > time.upper &&
                Protocol.compare64(data.roomGeneration, state.payload.roomGeneration) === 0 &&
                Protocol.compare64(data.basisHead, current.info.head) <= 0;
            var ranks = Object.create(null), people = Object.create(null), members = Object.create(null);
            if (fresh) {
                data.items.forEach(function (item, index) {
                    if (_time(item.sampleUntil) > time.upper) {
                        ranks[item.resourceId] = { item: item, index: index };
                    }
                });
            }
            Object.keys(projection).forEach(function (key) {
                var event = projection[key], payload = event.payload;
                if (event.kind === 'stage.member' && payload.state === 'in-use' &&
                    (!_time(payload.expiresAt) || _time(payload.expiresAt) > (time ? time.upper : Date.now()))) {
                    members[payload.userId] = Object.assign({ grantId: event.entityId }, payload);
                }
            });
            view.priority = [{ userId: state.payload.ownerId, presentation: 'owner', grantId: '', slot: 0 }];
            Object.keys(members).forEach(function (user) {
                var member = members[user];
                if (user !== state.payload.ownerId && member.presentation) {
                    view.priority.push({ userId: user, presentation: member.presentation, grantId: member.grantId, slot: member.slot });
                }
            });
            view.priority.sort(function (a, b) {
                var roles = ['owner', 'host', 'anchor', 'presenter'];
                return roles.indexOf(a.presentation) - roles.indexOf(b.presentation) || a.slot - b.slot || a.userId.localeCompare(b.userId);
            });
            Object.keys(projection).forEach(function (key) {
                var event = projection[key], payload = event.payload;
                if (event.kind !== 'media.resource' || payload.state !== 'enabled' || payload.purpose === 'screen') { return; }
                var publication = projection['media.publication:' + event.entityId];
                if (!publication || publication.payload.state !== 'active' ||
                    Protocol.compare64(publication.payload.publisherGeneration, payload.resourceGeneration) !== 0) { return; }
                var member = members[payload.ownerId], presentation = payload.ownerId === state.payload.ownerId ? 'owner' :
                    member && member.presentation || '',
                    priority = ['owner', 'host', 'anchor', 'presenter', ''].indexOf(presentation), rank = ranks[event.entityId];
                if (rank && Protocol.compare64(rank.item.publisherGeneration, payload.resourceGeneration) !== 0) { rank = null; }
                var item = { resourceId: event.entityId, publisherGeneration: _decimal(payload.resourceGeneration),
                    userId: payload.ownerId, presentation: presentation, slot: member ? member.slot : 17,
                    measured: !!rank, active: !!rank && rank.item.active, priority: priority,
                    rank: rank ? rank.index : 1000,
                    validFor: rank ? Math.max(0, Math.min(_time(data.validUntil), _time(rank.item.sampleUntil)) - time.upper) : 0 };
                var previous = people[item.userId];
                if (!previous || item.rank < previous.rank || (item.rank === previous.rank && item.resourceId < previous.resourceId)) {
                    people[item.userId] = item;
                }
            });
            view.items = Object.keys(people).map(function (user) { return people[user]; }).sort(function (a, b) {
                return a.priority - b.priority || (a.priority === 4 ? a.rank - b.rank : 0) ||
                    a.slot - b.slot || a.userId.localeCompare(b.userId);
            }).map(function (item) {
                delete item.priority;
                delete item.rank;
                return item;
            });
            view.known = !!fresh;
            view.complete = !!fresh && data.complete && view.items.every(function (item) { return item.measured; });
            view.epoch = _epoch;
            view.sequence = fresh ? _decimal(data.sequence) : '0';
            view.validUntil = fresh ? _decimal(data.validUntil) : '0';
            view.validFor = fresh ? Math.max(0, _time(data.validUntil) - time.upper) : 0;
            return view;
        };

        function emit() {
            var view = _this.view(), signature = JSON.stringify({ known: view.known, complete: view.complete,
                epoch: view.epoch, sequence: view.sequence, priority: view.priority, items: view.items.map(function (item) {
                    var copy = Object.assign({}, item);
                    delete copy.validFor;
                    return copy;
                }) });
            if (signature !== _signature) {
                _signature = signature;
                if (changed) { changed(view); }
            }
        }

        _this.maintain = function () {
            if (_closed) { return; }
            emit();
            var now = performance.now();
            if (!_hidden && !_refreshing && now >= _retryAt && (!_clock || now - _receivedAt >= 5000)) {
                _refreshing = true;
                _retryAt = now + 10000;
                Promise.resolve().then(refresh).then(function () { _refreshing = false; }, function () {
                    _refreshing = false;
                    _clock = _latest = null;
                });
            }
        };

        _this.close = function () {
            _closed = true;
            if (typeof document !== 'undefined') { document.removeEventListener('visibilitychange', visibility); }
            _latest = _clock = null;
            emit();
        };
    }

    IM.Speakers = Speakers;
})(odd);

