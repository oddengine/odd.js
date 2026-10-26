(function (odd) {
    var IM = odd.IM, Protocol = IM.Protocol, Type = Protocol.Type, Opcode = Protocol.Opcode;

    function fail(message) {
        var error = new Error(message);
        error.name = 'DataError';
        throw error;
    }

    function integer(value) {
        return typeof value === 'string' && /^(0|[1-9][0-9]{0,19})$/.test(value) &&
            (value.length < 20 || value <= '18446744073709551615');
    }

    function identifier(value) {
        return typeof value === 'string' && value.length > 0 && value.length <= 128 && !/[\x00-\x1f\x7f]/.test(value);
    }

    function validate(value) {
        if (!value || (value.version !== undefined && value.version !== 1 && value.version !== 2) || !/^[0-9a-f]{12}7[0-9a-f]{3}[89ab][0-9a-f]{15}$/.test(value.callId) ||
            !/^c-[0-9a-f]{64}$/.test(value.conversationId) || !integer(value.revision) || value.revision === '0' ||
            ['inviting', 'connecting', 'active', 'ending', 'ended'].indexOf(value.state) < 0 ||
            ['audio', 'video'].indexOf(value.mode) < 0 || ['user', 'group'].indexOf(value.targetType) < 0 ||
            !identifier(value.targetId) || !identifier(value.callerId) ||
            !integer(value.createdAt) || !integer(value.expiresAt) || !Array.isArray(value.participants) ||
            value.participants.length < 2 || value.participants.length > 16) {
            fail('Invalid authoritative call state.');
        }
        var users = Object.create(null);
        value.participants.forEach(function (member) {
            if (!member || !identifier(member.userId) || users[member.userId] ||
                !integer(member.generation) || member.generation === '0' ||
                ['invited', 'ringing', 'accepted', 'preparing', 'connecting', 'connected', 'recovering', 'ending', 'ended'].indexOf(member.state) < 0 ||
                (member.expiresAt !== undefined && !integer(member.expiresAt)) ||
                (member.deadline !== undefined && !integer(member.deadline)) ||
                (member.candidates !== undefined && (!Array.isArray(member.candidates) || member.candidates.length > 8))) {
                fail('Invalid call participant state.');
            }
            if (member.publications !== undefined) {
                if (value.version !== 2 || !Array.isArray(member.publications) || member.publications.length > 16) {
                    fail('Invalid private publication inventory.');
                }
                var instances = Object.create(null), uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
                member.publications.forEach(function (source) {
                    if (!source || !uuid.test(source.streamId) || !uuid.test(source.instanceId) || instances[source.instanceId] ||
                        !integer(source.generation) || source.generation === '0' || !integer(source.revision) || source.revision === '0' ||
                        ['active', 'stopped', 'unknown'].indexOf(source.state) < 0 || !identifier(source.nodeId) || !uuid.test(source.bootId)) {
                        fail('Invalid private publication fact.');
                    }
                    instances[source.instanceId] = true;
                });
            }
            users[member.userId] = true;
            (member.candidates || []).forEach(function (candidate) {
                if (!candidate || !identifier(candidate.deviceId) || !identifier(candidate.sessionId) ||
                    ['invited', 'ringing', 'ending', 'ended'].indexOf(candidate.state) < 0) {
                    fail('Invalid call endpoint snapshot.');
                }
            });
        });
        if (!users[value.callerId]) {
            fail('The call has no caller participant.');
        }
        return value;
    }

    function result(opcode, fields, request) {
        if (opcode === Opcode.CALL && request && request.some(function (field) { return field.key === 'action' && field.value === 'binding'; })) {
            Protocol.validateFields(fields, [{ key: 'kind', type: Type.STRING }, { key: 'selection', type: Type.STRING },
                { key: 'appId', type: Type.STRING }, { key: 'region', type: Type.STRING }, { key: 'connectBefore', type: Type.UINT64 }]);
            if (fields[0].value !== 'calls-binding') { fail('Invalid private CALL binding response.'); }
            return;
        }
        var rules = [];
        if (opcode === Opcode.CALL) {
            rules = [{ key: 'kind', type: Type.STRING }, { key: 'call', type: Type.BYTES }];
        } else if (opcode === Opcode.RESOLVE) {
            rules = [{ key: 'conversationId', type: Type.STRING }, { key: 'revision', type: Type.UINT64 },
                { key: 'partition', type: Type.UINT16 }, { key: 'partitions', type: Type.UINT16 }];
        } else if (opcode === Opcode.SUBSCRIBE || opcode === Opcode.REFRESH) {
            rules = [{ key: 'subscriptionId', type: Type.STRING }, { key: 'target', type: Type.OBJECT },
                { key: 'cursor', type: Type.UINT64 }, { key: 'authorizationId', type: Type.STRING },
                { key: 'revision', type: Type.UINT64 }, { key: 'generation', type: Type.UINT64 },
                { key: 'expiresAt', type: Type.UINT64 }, { key: 'actions', type: Type.UINT64 },
                { key: 'kind', type: Type.STRING }, { key: 'conversationId', type: Type.STRING },
                { key: 'callVersion', type: Type.UINT16 }, { key: 'ringing', type: Type.UINT32 },
                { key: 'connecting', type: Type.UINT32 }, { key: 'recovery', type: Type.UINT32 },
                { key: 'participants', type: Type.UINT16 }];
        } else if (opcode === Opcode.FETCH || opcode === Opcode.SYNC) {
            rules = [{ key: 'items', type: Type.ARRAY }, { key: 'nextCursor', type: Type.BYTES },
                { key: 'hasMore', type: Type.BOOL }, { key: 'gap', type: Type.BOOL }];
        } else if (opcode !== Opcode.COMMIT && opcode !== Opcode.UNSUBSCRIBE) {
            fail('Unsupported call feed operation.');
        }
        Protocol.validateFields(fields, rules);
        fields.forEach(function (field) {
            if (field.key === 'kind' && field.value !== 'calls') {
                fail('Call response changed its domain.');
            }
        });
    }

    function page(fields) {
        Protocol.validateFields(fields, [{ key: 'kind', type: Type.STRING }, { key: 'conversationId', type: Type.STRING },
            { key: 'items', type: Type.ARRAY }, { key: 'nextCursor', type: Type.BYTES },
            { key: 'hasMore', type: Type.BOOL }, { key: 'gap', type: Type.BOOL }]);
        if (fields[0].value !== 'calls' || !/^u-[0-9a-f]{64}$/.test(fields[1].value) || fields[2].value.length > 8) {
            fail('Invalid call feed page.');
        }
    }

    IM.CallProtocol = { validate: validate, result: result, page: page };
})(odd);

