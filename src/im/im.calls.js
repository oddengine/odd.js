(function (odd) {
    var IM = odd.IM, Protocol = IM.Protocol, Type = Protocol.Type, Opcode = Protocol.Opcode;

    function error(name, message) {
        var value = new Error(message);
        value.name = name;
        return value;
    }

    function field(key, type, value) { return { key: key, type: type, value: value }; }
    function target(value) { return [field('type', Type.STRING, value.type), field('id', Type.STRING, value.id)]; }
    function hex(bytes) { return Array.prototype.map.call(bytes, function (value) { return ('0' + value.toString(16)).slice(-2); }).join(''); }
    function bytes(id) {
        if (typeof id !== 'string' || !/^[0-9a-f]{32}$/.test(id)) {
            throw error('DataError', 'Invalid call identity.');
        }
        return new Uint8Array(id.match(/../g).map(function (part) { return parseInt(part, 16); }));
    }
    function words(value) {
        var text = String(value), high = 0, low = 0;
        if (!/^(0|[1-9][0-9]{0,19})$/.test(text) || (text.length === 20 && text > '18446744073709551615')) {
            throw error('DataError', 'Invalid call revision.');
        }
        for (var i = 0; i < text.length; i++) {
            low = low * 10 + Number(text[i]);
            high = high * 10 + Math.floor(low / 4294967296);
            low %= 4294967296;
        }
        return { high: high, low: low };
    }
    function base64(value) {
        var text = '';
        for (var i = 0; i < value.length; i++) { text += String.fromCharCode(value[i]); }
        return btoa(text);
    }
    function copy(value) { return value ? JSON.parse(JSON.stringify(value)) : value; }
    function terminal(value) { return value.state === 'ending' || value.state === 'ended'; }
    function parse(value) {
        if (!value || value.length > 32768) { throw error('DataError', 'Invalid call state size.'); }
        return IM.CallProtocol.validate(JSON.parse(Protocol.readText(value)));
    }

    // A connection-scoped composition of the existing request table, account
    // storage and RTC. Only pending operations and real deadlines are retried.
    function Calls(im, identity, storage, request, session, config, changed, failed) {
        var _this = this, _closed = false, _started = false, _states = Object.create(null),
            _resolved = Object.create(null), _pending = Object.create(null), _automatic = Object.create(null), _stopping = Object.create(null),
            _current = '', _inviting = false, _retryOffset = 0, _receiving = Promise.resolve(), _receives = 0, _negotiated = null,
            _session = base64(session.sessionId), _media;

        function active() {
            if (_closed) { throw error('AbortError', 'Calls belongs to a closed IM connection.'); }
        }
        function member(call) {
            return call.participants.filter(function (value) { return value.userId === identity.userId; })[0];
        }
        function destination(call) {
            return { type: call.targetType, id: call.targetType === 'user' && call.callerId !== identity.userId ? call.callerId : call.targetId };
        }
        function notify(value) {
            if (!_closed) { changed(value); }
        }
        function report(reason) {
            if (!_closed) { notify({ kind: 'calls-error', name: reason.name || 'OperationError', message: reason.message || String(reason) }); }
        }
        function resolve(value) {
            active();
            Protocol.validateTarget(target(value));
            if (value.type !== 'user' && value.type !== 'group') { return Promise.reject(error('TypeError', 'Calls targets a user or fixed group.')); }
            var key = value.type + ':' + value.id;
            if (!_resolved[key]) {
                if (Object.keys(_resolved).length >= 1024) { return Promise.reject(error('QuotaExceededError', 'Too many call destinations.')); }
                _resolved[key] = request(Opcode.RESOLVE, [field('kind', Type.STRING, 'calls'), field('target', Type.OBJECT, target(value))]).then(function (info) {
                    active();
                    Protocol.validateMessagePartition(Protocol.messageId(info.partition, info.partitions), info.partition, info.partitions);
                    return info;
                }, function (reason) { delete _resolved[key]; throw reason; });
            }
            return _resolved[key];
        }
        function apply(call) {
            active();
            var previous = _states[call.callId];
            if (previous && (previous.revision.length > call.revision.length ||
                (previous.revision.length === call.revision.length && previous.revision > call.revision))) { return; }
            if (!previous && Object.keys(_states).length >= 1024) {
                var evict = Object.keys(_states).filter(function (id) { return _states[id].state === 'ended'; })[0];
                if (!evict) { throw error('QuotaExceededError', 'Call history is full.'); }
                delete _states[evict];
                delete _stopping[evict];
            }
            _states[call.callId] = call;
            if (!_started) { return; }
            notify({ kind: 'calls', call: copy(call) });
            var own = member(call);
            if (!own) { throw error('NotAllowedError', 'The call does not include this account.'); }
            if (terminal(call) || terminal(own)) {
                delete _stopping[call.callId];
                _media.stop(call.callId);
                if (_current === call.callId) { _current = ''; }
                Object.keys(_automatic).forEach(function (key) { if (key.indexOf(call.callId + ':') === 0) { delete _automatic[key]; } });
                return;
            }
            // A locally accepted hangup must not be undone by an older feed
            // while its reliable operation or DELETE is still in flight.
            if (_stopping[call.callId] === own.generation) { return; }
            delete _stopping[call.callId];
            if (own.deviceId === identity.deviceId) {
                _current = call.callId;
                if (own.sessionId !== _session || own.state === 'recovering') {
                    auto(call, 'resume', own.generation + ':' + (own.sessionId || ''));
                    return;
                }
                _media.update(call, own);
                return;
            }
            var candidate = (own.candidates || []).filter(function (endpoint) {
                return endpoint.deviceId === identity.deviceId && endpoint.sessionId === _session && !terminal(endpoint);
            })[0];
            if (!candidate) {
                var original = (own.candidates || []).some(function (endpoint) { return endpoint.deviceId === identity.deviceId && !terminal(endpoint); });
                var declined = (own.candidates || []).some(function (endpoint) { return endpoint.deviceId === identity.deviceId && terminal(endpoint); });
                var canEnroll = call.version === 2 && !declined && ['invited', 'ringing'].indexOf(own.state) >= 0;
                if ((original || canEnroll) && !own.deviceId && Number(call.expiresAt) > Date.now()) { auto(call, 'resume', 'offer'); }
                return;
            }
            if (_current && _current !== call.callId) {
                auto(call, 'busy', 'offer');
            } else {
                _current = call.callId;
                if (candidate.state === 'invited') { auto(call, 'ringing', 'offer'); }
            }
        }
        function auto(call, action, generation) {
            var key = call.callId + ':' + action + ':' + generation;
            if (_automatic[key]) { return; }
            _automatic[key] = true;
            _this.action(call.callId, action).catch(function (reason) {
                if (reason.code === Protocol.Status.CONFLICT) {
                    delete _automatic[key];
                    _this.inspect(call.callId).catch(report);
                } else { report(reason); }
            });
        }
        function remember(call) {
            return storage.receiveCalls([call], null).then(function () { active(); apply(call); return call; });
        }
        function transmit(record) {
            active();
            if (record.sending) { return record.sending; }
            var packet = Protocol.decode(record.packet), operation = packet.fields[2].value[2].value;
            record.sending = request(Opcode.CALL, packet.fields).then(function (info) {
                active();
                var call = parse(info.call);
                if (call.callId !== hex(packet.fields[2].value[1].value)) { throw error('DataError', 'Call response changed its identity.'); }
                return remember(call).then(function () { return storage.settleCall(operation); }).then(function () {
                    delete _pending[record.id];
                    notify({ kind: 'call-operation', operationId: record.id, callId: call.callId, state: 'applied' });
                    return call;
                });
            }).catch(function (reason) {
                active();
                record.retry = Date.now() + 2000;
                var definitive = [Protocol.Status.INVALID, Protocol.Status.CONFLICT, Protocol.Status.EXPIRED,
                    Protocol.Status.GONE, Protocol.Status.FORBIDDEN].indexOf(reason.code) >= 0;
                if (record.unknown && reason.code === Protocol.Status.FORBIDDEN) { definitive = false; }
                if (!definitive) {
                    record.unknown = true;
                    notify({ kind: 'call-operation', operationId: record.id, callId: hex(packet.fields[2].value[1].value), state: 'unknown' });
                    throw reason;
                }
                return storage.settleCall(operation).then(function () {
                    delete _pending[record.id];
                    var id = hex(packet.fields[2].value[1].value);
                    if (!_states[id] && _current === id) { _current = ''; }
                    notify({ kind: 'call-operation', operationId: record.id, callId: id, state: record.unknown && reason.code === Protocol.Status.EXPIRED ? 'expired' : 'rejected', message: reason.message });
                    throw reason;
                });
            });
            var pending = record.sending;
            pending.then(function () { record.sending = null; }, function () { record.sending = null; });
            return pending;
        }
        function submit(action, destination, id, revision, data, resolution) {
            active();
            var operation = action === 'invite' ? id : Protocol.messageId(resolution.partition, resolution.partitions), created = 0;
            for (var i = 0; i < 6; i++) { created = created * 256 + operation[i]; }
            var body = [field('version', Type.UINT16, _negotiated.callVersion), field('callId', Type.BYTES, id),
                field('operationId', Type.BYTES, operation), field('createdAt', Type.UINT64, words(created)),
                field('expiresAt', Type.UINT64, words(created + 600000)), field('expectedRevision', Type.UINT64, words(revision)),
                field('data', Type.OBJECT, data)];
            var packet = Protocol.encode({ messaging: true, opcode: Opcode.CALL, sequenceNumber: 1,
                fields: [field('action', Type.STRING, action), field('target', Type.OBJECT, target(destination)), field('body', Type.OBJECT, body)] });
            return storage.enqueueCall(operation, packet).then(function (record) {
                active();
                _pending[record.id] = record;
                return transmit(record);
            });
        }

        async function binding(id, generation, context, region) {
            active();
            var current = _states[id], own = current && member(current);
            function selected() {
                var latest = _states[id], actor = latest && member(latest);
                return !_closed && latest && !terminal(latest) && actor && !terminal(actor) && actor.prepared === true &&
                    _stopping[id] !== generation &&
                    actor.generation === generation && actor.deviceId === identity.deviceId && actor.sessionId === _session;
            }
            if (!_negotiated || _negotiated.callVersion !== 2 || !selected() || !context.operationId) {
                throw error('NotAllowedError', 'Private CALL binding requires the selected IM session.');
            }
            var fields = [field('action', Type.STRING, 'binding'), field('target', Type.OBJECT, target(destination(current))),
                field('body', Type.OBJECT, [field('version', Type.UINT16, 2), field('callId', Type.BYTES, bytes(id)),
                    field('memberGeneration', Type.UINT64, words(generation)), field('requestId', Type.STRING, context.operationId),
                    field('region', Type.STRING, region)])];
            var value;
            for (var attempt = 0; attempt < 3; attempt++) {
                if (!selected() || context.signal && context.signal.aborted ||
                    Date.now() >= Math.min(context.deadline, Number(own.deadline))) {
                    throw error('AbortError', 'Private CALL binding was cancelled.');
                }
                try {
                    value = await request(Opcode.CALL, fields);
                    break;
                } catch (reason) {
                    var transient = reason.name === 'TimeoutError' || [Protocol.Status.NOT_READY,
                        Protocol.Status.UNAVAILABLE, Protocol.Status.TIMEOUT, Protocol.Status.UNKNOWN].indexOf(reason.code) >= 0;
                    if (!transient || attempt === 2) { throw reason; }
                    // Reuse the exact private request, never enqueue a durable
                    // operation or extend the original participation deadline.
                    await new Promise(function (resolve) { setTimeout(resolve, 250 * (attempt + 1)); });
                }
            }
            var until = Number(value.connectBefore);
            if (!selected() || context.signal && context.signal.aborted || Date.now() >= context.deadline) {
                throw error('AbortError', 'Private CALL binding completed too late.');
            }
            if (value.kind !== 'calls-binding' || value.region !== region || value.appId !== current.rtcAppId ||
                typeof value.selection !== 'string' || !value.selection || value.selection.length > 8192 ||
                /[^\x21-\x7e]/.test(value.selection) || !Number.isSafeInteger(until) || until <= Date.now() || until > Number(own.deadline)) {
                throw error('DataError', 'Invalid private CALL selection.');
            }
            // This response deliberately bypasses remember(), pending operations,
            // notifications and storage adapters. Only this RTC attempt owns it.
            return { selection: value.selection, appId: value.appId, connectBefore: until };
        }

        _media = new IM.CallMedia(config.rtc || {}, im.logger, binding, notify, function (id, reason) {
            var call = _states[id], own = call && member(call);
            if (call && own && !terminal(call) && !terminal(own)) {
                _media.stop(id);
                auto(call, 'media-failed', own.generation);
                report(reason);
            }
        });
        _this.open = function () {
            ['enqueueCall', 'pendingCalls', 'settleCall', 'receiveCalls', 'calls', 'position'].forEach(function (name) {
                if (typeof storage[name] !== 'function') { throw error('NotSupportedError', 'The storage adapter needs CALL support: ' + name); }
            });
            return request(Opcode.SUBSCRIBE, [field('kind', Type.STRING, 'calls')]).then(function (info) {
                active();
                if ([1, 2].indexOf(info.callVersion) < 0 || info.participants < 2 || info.participants > 16) { throw error('NotSupportedError', 'Unsupported call capability.'); }
                _negotiated = info;
                return storage.calls();
            }).then(function (states) {
                active();
                states.forEach(function (call) { _states[call.callId] = IM.CallProtocol.validate(call); });
                return storage.pendingCalls();
            }).then(function (records) {
                active();
                records.forEach(function (record) {
                    var packet = Protocol.decode(record.packet);
                    if (packet.opcode !== Opcode.CALL || !packet.messaging || packet.fields.length !== 3) { throw error('DataError', 'Invalid pending CALL record.'); }
                    record.unknown = true;
                    _pending[record.id] = record;
                    if (packet.fields[0].value === 'invite') { _current = hex(packet.fields[2].value[1].value); }
                });
            });
        };
        _this.start = function () {
            active();
            _started = true;
            return _this.sync().then(function () { _this.maintain(); });
        };
        _this.maintain = function () {
            if (_closed || !_started) { return; }
            var keys = Object.keys(_pending), selected = [];
            for (var i = 0; i < Math.min(8, keys.length); i++) { selected.push(keys[(_retryOffset + i) % keys.length]); }
            _retryOffset = keys.length ? (_retryOffset + 8) % keys.length : 0;
            selected.forEach(function (id) {
                var record = _pending[id];
                if (!record.sending && (!record.retry || record.retry <= Date.now())) { transmit(record).catch(report); }
            });
        };
        _this.invite = function (destination, options) {
            options = options || {};
            if (_current || _inviting || !_negotiated || !_started) { return Promise.reject(error('InvalidStateError', 'This device already has a call.')); }
            _inviting = true;
            return Promise.resolve().then(function () { return resolve(destination); }).then(function (resolution) {
                var mode = options.mode || 'audio', invitees = options.invitees || [];
                if (['audio', 'video'].indexOf(mode) < 0 || !Array.isArray(invitees) ||
                    (destination.type === 'group' && (!invitees.length || invitees.length >= _negotiated.participants)) ||
                    (destination.type === 'user' && invitees.length)) { throw error('TypeError', 'Invalid call mode or explicit invitees.'); }
                var id = Protocol.messageId(resolution.partition, resolution.partitions);
                _current = hex(id);
                var data = [field('mode', Type.STRING, mode)];
                if (destination.type === 'group') {
                    data.push(field('invitees', Type.ARRAY, invitees.map(function (user) { return { type: Type.STRING, value: user }; })));
                }
                return submit('invite', destination, id, '0', data, resolution);
            }).then(function (call) { _inviting = false; return call; }, function (reason) {
                _inviting = false;
                if (_current && !_states[_current] && !_pending[_current]) { _current = ''; }
                throw reason;
            });
        };
        _this.action = function (id, action, options) {
            return Promise.resolve().then(function () {
                active();
                var call = _states[id];
                if (!call || ['ringing', 'accept', 'reject', 'busy', 'cancel', 'leave', 'end', 'resume', 'media-failed'].indexOf(action) < 0) {
                    throw error('InvalidStateError', 'Unknown call or action.');
                }
                var recipient = destination(call), data = [];
                if (action === 'reject') { data.push(field('allDevices', Type.BOOL, !!(options && options.allDevices))); }
                if (['cancel', 'leave', 'end', 'media-failed'].indexOf(action) >= 0) {
                    _stopping[id] = member(call).generation;
                    _media.stop(id);
                }
                return resolve(recipient).then(function (resolution) { return submit(action, recipient, bytes(id), call.revision, data, resolution); });
            });
        };
        _this.accept = function (id) { return _this.action(id, 'accept'); };
        _this.reject = function (id, allDevices) { return _this.action(id, 'reject', { allDevices: allDevices }); };
        _this.leave = function (id) { return _this.action(id, 'leave'); };
        _this.end = function (id) { return _this.action(id, 'end'); };
        _this.cancel = function (id) { return _this.action(id, 'cancel'); };
        _this.inspect = function (id) {
            var call = _states[id];
            if (!call) { return Promise.reject(error('NotFoundError', 'Unknown call.')); }
            return request(Opcode.CALL, [field('action', Type.STRING, 'inspect'), field('target', Type.OBJECT, target(destination(call))),
                field('body', Type.OBJECT, [field('version', Type.UINT16, _negotiated.callVersion), field('callId', Type.BYTES, bytes(id))])]).then(function (info) {
                return remember(parse(info.call));
            });
        };
        _this.receive = function (page) {
            if (_receives >= 4) { return Promise.reject(error('QuotaExceededError', 'Call storage is backpressured.')); }
            ++_receives;
            var operation = _receiving.then(function () {
                active();
                if (!Array.isArray(page.items) || page.items.length > 8 || typeof page.gap !== 'boolean') { throw error('DataError', 'Invalid call feed page.'); }
                var values = page.items.map(function (item) {
                    if (item.type !== Type.BYTES) { throw error('DataError', 'Expected a call state envelope.'); }
                    return parse(item.value);
                });
                return storage.receiveCalls(values, page.nextCursor).then(function () {
                    active();
                    values.forEach(apply);
                    if (page.gap) { notify({ kind: 'calls-gap', message: 'Call history was compacted; current states were restored.' }); }
                    return request(Opcode.COMMIT, [field('kind', Type.STRING, 'calls'), field('cursor', Type.BYTES, page.nextCursor)]);
                });
            });
            _receiving = operation.then(function () { --_receives; }, function () { --_receives; });
            return operation;
        };
        _this.sync = function () {
            function page(cursor) {
                active();
                return request(Opcode.SYNC, [field('kind', Type.STRING, 'calls'), field('cursor', Type.BYTES, cursor), field('limit', Type.UINT16, 8)]).then(function (value) {
                    return _this.receive(value).then(function () { return value.hasMore ? page(value.nextCursor) : undefined; });
                });
            }
            return page(new Uint8Array(0));
        };
        _this.state = function (id) { return copy(_states[id] || null); };
        _this.endpoint = function () { return { userId: identity.userId, deviceId: identity.deviceId, sessionId: _session }; };
        _this.retry = function () {
            Object.keys(_pending).forEach(function (id) { _pending[id].retry = 0; });
            _this.maintain();
        };
        _this.current = function () { return _current ? copy(_states[_current] || null) : null; };
        _this.busy = function () { return !!(_current || _inviting || Object.keys(_pending).length); };
        _this.capabilities = function () { return { participants: _negotiated ? _negotiated.participants : 2 }; };
        _this.close = function () {
            _closed = true;
            _media.close();
            // Durable unresolved operations remain in the account database.
            _pending = Object.create(null);
        };
    }

    Calls.validate = function (value) { return IM.CallProtocol.validate(value); };
    IM.Calls = Calls;
})(odd);

