(function (odd) {
    var IM = odd.IM, Protocol = IM.Protocol, Type = Protocol.Type, Opcode = Protocol.Opcode;
    function error(name, message) { var value = new Error(message); value.name = name; return value; }
    function field(key, type, value) { return { key: key, type: type, value: value }; }
    function object(fields) { var value = {}; fields.forEach(function (item) { value[item.key] = item.value; }); return value; }
    function next(value) { return value.low === 4294967295 ? { high: value.high + 1, low: 0 } : { high: value.high, low: value.low + 1 }; }
    function word(bytes, offset) {
        var view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        return { high: view.getUint32(offset), low: view.getUint32(offset + 4) };
    }

    // Only an explicit renderer/user action submits display evidence. This
    // object owns no timer, socket, automatic read marker or persistent token.
    function History(identity, storage, request, authorize, decodePage, active, serialize, versions) {
        var _this = this, proofs = [], pending = Object.create(null), closed = false;
        _this.capabilities = function () {
            return { history: versions.historyVersion === 1, publicRead: versions.publicReadVersion === 1 };
        };
        function available(publicRead) {
            active();
            if (closed) { throw error('AbortError', 'History belongs to a closed session.'); }
            if (versions.historyVersion !== 1 || (publicRead && versions.publicReadVersion !== 1)) {
                throw error('NotSupportedError', 'This server has not enabled cloud history or public reading.');
            }
        }
        function permission(conversation, reading) {
            available(reading);
            return authorize({ type: 'conversation', id: conversation },
                Protocol.Action.MESSAGE_SUBSCRIBE | (reading ? Protocol.Action.MESSAGE_READ : 0), false);
        }
        _this.history = function (conversation, cursor, limit) {
            limit = limit === undefined ? 32 : limit;
            return Promise.resolve().then(function () {
                available(false);
                if (!Number.isInteger(limit) || limit < 1 || limit > 64 || typeof storage.receiveHistory !== 'function') {
                    throw error('NotSupportedError', 'Cloud history requires a durable history adapter and a page limit of 1 to 64.');
                }
                return serialize(conversation, function () {
                    return permission(conversation, false).then(function () {
                        return request(Opcode.HISTORY, [field('conversationId', Type.STRING, conversation),
                            field('cursor', Type.BYTES, cursor || new Uint8Array(0)), field('limit', Type.UINT16, limit)]);
                    }).then(function (page) {
                        available(false);
                        var decoded = decodePage(conversation, page), proof = page.historyProof;
                        var records = decoded.records.filter(function (record) { return record.kind === 'message'; });
                        if (!(proof instanceof Uint8Array) || proof.length > 512 || (records.length ? proof.length < 80 : proof.length !== 0)) {
                            throw error('DataError', 'Invalid history evidence boundary.');
                        }
                        if (records.length) {
                            if (proof[0] !== 1 || proof[1] !== 6) { throw error('DataError', 'Unexpected history proof kind.'); }
                            var previous = word(proof, 14), last = word(proof, 22);
                            records.forEach(function (record) {
                                if (Protocol.compare64(record.messageSequence, next(previous)) !== 0) {
                                    throw error('DataError', 'History proof must cover a continuous body page.');
                                }
                                previous = record.messageSequence;
                            });
                            if (Protocol.compare64(previous, last) !== 0) { throw error('DataError', 'History proof does not end at the returned page.'); }
                        }
                        return storage.receiveHistory(conversation, decoded.records).then(function () {
                            available(false);
                            if (records.length) {
                                proofs.push({ conversation: conversation, epoch: word(proof, 6), first: records[0].messageSequence,
                                    last: records[records.length - 1].messageSequence, proof: new Uint8Array(proof),
                                    expires: word(proof, 38).high * 4294967296 + word(proof, 38).low });
                                proofs = proofs.filter(function (item) { return item.expires > Date.now(); }).slice(-64);
                            }
                            page.records = decoded.records;
                            return page;
                        });
                    });
                });
            });
        };

        _this.receipts = function (conversation, mode, options) {
            options = options || {};
            return Promise.resolve().then(function () {
                available(mode !== 'policy');
                var sequences = options.sequences || [], limit = options.limit === undefined ? 32 : options.limit;
                if (['policy', 'summary', 'detail'].indexOf(mode) < 0 || !Number.isInteger(limit) || limit < 1 || limit > 100 ||
                    !Array.isArray(sequences) || sequences.length > 50 ||
                    (mode === 'policy' && (sequences.length || options.category || options.cursor)) ||
                    (mode === 'summary' && (!sequences.length || options.category || options.cursor)) ||
                    (mode === 'detail' && (sequences.length !== 1 || ['read', 'unknown', 'released'].indexOf(options.category) < 0))) {
                    throw error('TypeError', 'Invalid public receipt query.');
                }
                return permission(conversation, false).then(function () {
                    return request(Opcode.RECEIPTS, [field('conversationId', Type.STRING, conversation), field('mode', Type.STRING, mode),
                        field('sequences', Type.ARRAY, sequences.map(function (value) { return { type: Type.UINT64, value: value }; })),
                        field('category', Type.STRING, options.category || ''), field('cursor', Type.BYTES, options.cursor || new Uint8Array(0)),
                        field('limit', Type.UINT16, limit)]);
                }).then(function (result) {
                    available(false);
                    if (mode === 'policy') {
                        if (result.historyDays < 1 || result.historyDays > 90 || (!result.memberEpoch.high && !result.memberEpoch.low)) {
                            throw error('DataError', 'Invalid history policy.');
                        }
                        var operation = pending[conversation];
                        if (operation && (Protocol.compare64(operation.epoch, result.memberEpoch) !== 0 ||
                            Protocol.compare64(operation.revision, result.policyRevision) !== 0)) { delete pending[conversation]; }
                        return result;
                    }
                    if (!Array.isArray(result.items) || result.items.length > (mode === 'summary' ? 50 : limit)) {
                        throw error('DataError', 'Receipt query exceeds its page budget.');
                    }
                    result.records = result.items.map(function (item) {
                        if (item.type !== Type.OBJECT) { throw error('DataError', 'Invalid receipt record.'); }
                        Protocol.validateFields(item.value, mode === 'summary' ? [
                            { key: 'sequence', type: Type.UINT64 }, { key: 'counts', type: Type.BYTES }, { key: 'state', type: Type.STRING },
                        ] : [{ key: 'userId', type: Type.STRING }, { key: 'memberEpoch', type: Type.UINT64 }]);
                        var value = object(item.value);
                        if (mode === 'summary') {
                            if (!(value.counts instanceof Uint8Array) || value.counts.length !== 6) { throw error('DataError', 'Invalid reading counts.'); }
                            var counts = new DataView(value.counts.buffer, value.counts.byteOffset, 6);
                            value.read = counts.getUint16(0); value.unknown = counts.getUint16(2); value.released = counts.getUint16(4);
                        }
                        if (mode === 'summary' && (['retained', 'expired'].indexOf(value.state) < 0 ||
                            !sequences.some(function (sequence) { return Protocol.compare64(sequence, value.sequence) === 0; }))) {
                            throw error('DataError', 'Receipt query returned an unrelated sequence.');
                        }
                        return value;
                    });
                    return result;
                });
            });
        };

        function operation(conversation, mode, policy, ranges, proof, id) {
            if (!id) { id = new Uint8Array(16); crypto.getRandomValues(id); }
            return [field('conversationId', Type.STRING, conversation), field('mode', Type.STRING, mode),
                field('memberEpoch', Type.UINT64, policy.memberEpoch), field('policyRevision', Type.UINT64, policy.policyRevision),
                field('operationId', Type.BYTES, id), field('ranges', Type.ARRAY, ranges.map(function (range) {
                    return { type: Type.OBJECT, value: [field('first', Type.UINT64, range.first), field('last', Type.UINT64, range.last)] };
                })), field('historyProof', Type.BYTES, proof || new Uint8Array(0))];
        }
        _this.receipt = function (conversation, mode, options) {
            options = options || {};
            return Promise.resolve().then(function () {
                available(true);
                if (['read', 'enable', 'disable'].indexOf(mode) < 0) { throw error('TypeError', 'Unknown public reading action.'); }
                return serialize(conversation, function () {
                    return permission(conversation, true).then(function () {
                        // The latest policy is authoritative after a lost reply.
                        // Retrying unchanged consent reuses the exact old CAS.
                        return _this.receipts(conversation, 'policy');
                    }).then(function (policy) {
                        available(true);
                        if (mode !== 'disable' && !policy.publicReceipts) { throw error('NotSupportedError', 'Public reading is disabled in this conversation.'); }
                        if (mode !== 'read') {
                            var previous = pending[conversation];
                            if (previous && previous.mode !== mode) {
                                throw error('ConflictError', 'An earlier privacy change is unconfirmed; refresh its policy before another change.');
                            }
                            if (!previous) {
                                if (Object.keys(pending).length >= 64) { throw error('QuotaExceededError', 'Too many unconfirmed privacy changes.'); }
                                previous = { mode: mode, epoch: policy.memberEpoch, revision: policy.policyRevision,
                                    fields: operation(conversation, mode, policy, [], null, options.operationId) };
                                pending[conversation] = previous;
                            }
                            return request(Opcode.RECEIPT, previous.fields).then(function (result) {
                                available(true);
                                if (pending[conversation] === previous) { delete pending[conversation]; }
                                return result;
                            });
                        }
                        if (!policy.enabled || typeof storage.display !== 'function') {
                            throw error('NotAllowedError', 'Enable public reading before explicitly marking saved visible messages.');
                        }
                        return storage.display(conversation, policy.memberEpoch, options.messageIds).then(function (sequences) {
                            available(true);
                            // Split at holes and proof boundaries. Each proof
                            // remains in memory and is never stored as a token.
                            var groups = [];
                            sequences = sequences.filter(function (sequence) { return Protocol.compare64(sequence, policy.visibleFrom) >= 0; });
                            if (!sequences.length) { throw error('NotAllowedError', 'No displayed messages belong to the current member period.'); }
                            sequences.forEach(function (sequence) {
                                var proof = proofs.slice().reverse().filter(function (item) {
                                    return item.conversation === conversation && item.expires > Date.now() &&
                                        Protocol.compare64(item.epoch, policy.memberEpoch) === 0 &&
                                        Protocol.compare64(item.first, sequence) <= 0 && Protocol.compare64(sequence, item.last) <= 0;
                                })[0];
                                var group = groups[groups.length - 1], range = group && group.ranges[group.ranges.length - 1];
                                if (!group || group.proof !== proof || group.ranges.length >= 8) {
                                    group = { proof: proof, ranges: [] }; groups.push(group); range = null;
                                }
                                if (range && Protocol.compare64(next(range.last), sequence) === 0) { range.last = sequence; }
                                else { group.ranges.push({ first: sequence, last: sequence }); }
                            });
                            var chain = Promise.resolve(), results = [];
                            groups.forEach(function (group) {
                                chain = chain.then(function () {
                                    available(true);
                                    return request(Opcode.RECEIPT, operation(conversation, 'read', policy, group.ranges, group.proof && group.proof.proof));
                                }).then(function (result) { available(true); results.push(result); });
                            });
                            return chain.then(function () { return { pages: results }; });
                        });
                    });
                });
            });
        };
        _this.close = function () { closed = true; proofs = []; pending = Object.create(null); };
    }
    IM.History = History;
})(odd);
