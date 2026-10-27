(function (odd) {
    var IM = odd.IM, Event = odd.events.Event, NetStatusEvent = odd.events.NetStatusEvent;

    // Each selected call owns its RTC instance. No operation can close an
    // application's existing live, conference or game RTC instance.
    function CallMedia(config, logger, binding, changed, failed) {
        var _this = this, _visits = Object.create(null), _closed = false;

        function stop(id) {
            var visit = _visits[id];
            if (visit) {
                delete _visits[id];
                visit.closed = true;
                visit.rtc.destroy('call-ended');
                changed({ kind: 'calls-media', callId: id, closed: true });
            }
        }

        function productSettings(call, member, visit) {
            var options = config.participation, routing = options.routing, pinned, selection, bound, operation;
            if (typeof routing.resolve !== 'function' || typeof routing.connection !== 'function' || typeof routing.media !== 'function') {
                throw new TypeError('Private CALL media requires the shared regional Routing instance.');
            }
            return odd.utils.extendz({}, config, { credentials: null, participation: Object.assign({}, options, {
                credentials: async function (context) {
                    if (visit.closed || operation && operation !== context.operationId) { throw new Error('CALL participation attempt changed.'); }
                    operation = context.operationId;
                    if (!pinned) { pinned = await routing.resolve(context); }
                    if (!selection) { selection = await binding(call.callId, member.generation, context, pinned.region); }
                    var credentials = await options.credentials(Object.assign({}, context, {
                        callId: call.callId, memberGeneration: member.generation, appId: call.rtcAppId,
                    }));
                    if (visit.closed || !credentials || credentials.appId !== call.rtcAppId || credentials.userId !== member.userId ||
                        credentials.product !== 'rtc') { throw new Error('CALL media credentials changed their identity.'); }
                    if (bound) {
                        if (context.url && context.url !== bound.url) { throw new Error('CALL renewal moved its participant.'); }
                        return Object.assign({}, credentials, { url: bound.url, callBinding: bound.callBinding });
                    }
                    var selected = Object.assign({}, context, { kind: 'rtc', routing: pinned,
                        callSelection: selection.selection, deadline: Math.min(context.deadline, selection.connectBefore) });
                    bound = await routing.connection(selected, credentials);
                    if (visit.closed) { throw new Error('CALL routing completed after closure.'); }
                    return bound;
                },
                route: function (context) {
                    if (visit.closed || !bound) { return Promise.reject(new Error('CALL participation is unavailable.')); }
                    return routing.media(Object.assign({}, context, { routing: pinned, callBinding: bound.callBinding }), context);
                },
            }) });
        }

        _this.update = function (call, member) {
            if (_closed) {
                return;
            }
            if (!member || call.state === 'ending' || call.state === 'ended' ||
                member.state === 'ending' || member.state === 'ended' || member.state === 'recovering') {
                stop(call.callId);
                return;
            }
            var product = call.version === 2;
            if (product ? !member.prepared || !call.rtcAppId : !member.resourceId || !call.roomId) {
                return;
            }
            var visit = _visits[call.callId];
            if (visit && visit.generation !== member.generation) {
                stop(call.callId);
                visit = null;
            }
            if (!visit) {
                if (!odd.RTC || (product ? !config.participation || typeof config.participation.credentials !== 'function' ||
                    !config.participation.routing : typeof config.credentials !== 'function' || config.participation)) {
                    failed(call.callId, new Error('Configure RTC media credentials before accepting calls.'));
                    return;
                }
                visit = { rtc: odd.RTC.create(logger), generation: member.generation, closed: false, playing: Object.create(null), ready: false };
                _visits[call.callId] = visit;
                var settings = odd.utils.extendz({}, config, { credentials: function (context) {
                    if (visit.closed) {
                        return Promise.reject(new Error('Call media was closed.'));
                    }
                    var request = odd.utils.extendz({}, context, {
                        streamId: context.direction === 'publish' ? member.resourceId : context.streamId,
                        callId: call.callId, roomId: call.roomId, grantId: member.grantId,
                    });
                    return config.credentials(request);
                } });
                if (product) {
                    try {
                        settings = productSettings(call, member, visit);
                    } catch (error) {
                        stop(call.callId);
                        failed(call.callId, error);
                        return;
                    }
                }
                visit.rtc.addEventListener(Event.ERROR, function (event) {
                    if (!visit.closed) {
                        failed(call.callId, event.data);
                    }
                });
                visit.rtc.addEventListener(NetStatusEvent.NETSTATUS, function (event) {
                    var code = event.data && event.data.code;
                    if (!visit.closed && event.data.info && event.data.info.operation === 'capture') {
                        failed(call.callId, event.data.info.error);
                        return;
                    }
                    var stream = event.srcElement, name = stream && stream.name ? stream.name() : '';
                    if (name && !visit.rtc.publishing[name] && !visit.playing[name]) { return; }
                    if (!visit.closed && /Failed|Rejected|Unpublish\.Success/.test(String(code))) {
                        failed(call.callId, new Error(event.data.description || 'Call media ended.'));
                    }
                });
                visit.rtc.setup(settings).then(function () {
                    if (visit.closed) {
                        return;
                    }
                    var constraints = odd.utils.extendz({}, odd.RTC.Constraints[settings.profile]);
                    if (call.mode === 'audio' || settings.camera === false) {
                        constraints.video = false;
                    } else if (typeof settings.camera === 'string' && settings.camera) {
                        constraints.video = odd.utils.extendz({}, constraints.video, { deviceId: { exact: settings.camera } });
                    }
                    if (settings.microphone === false) {
                        constraints.audio = false;
                    } else if (typeof settings.microphone === 'string' && settings.microphone) {
                        constraints.audio = odd.utils.extendz({}, constraints.audio, { deviceId: { exact: settings.microphone } });
                    }
                    return visit.rtc.publish(constraints, false, false);
                }).then(function (stream) {
                    if (visit.closed || !stream) {
                        return;
                    }
                    visit.ready = true;
                    changed({ kind: 'calls-media', callId: call.callId, userId: member.userId, local: true, element: stream.element() });
                    _this.update(visit.state || call, member);
                }).catch(function (error) {
                    if (!visit.closed) {
                        failed(call.callId, error);
                    }
                });
            }
            visit.state = call;
            if (!visit.ready) {
                return;
            }
            var wanted = Object.create(null);
            call.participants.forEach(function (remote) {
                if (remote.userId === member.userId || remote.state !== 'connected') { return; }
                var sources = product ? (remote.publications || []).filter(function (source) { return source.state === 'active'; }) :
                    remote.resourceId ? [{ streamId: remote.resourceId }] : [];
                sources.forEach(function (source) {
                    var streamId = source.streamId;
                    wanted[streamId] = true;
                    if (visit.playing[streamId]) {
                        return;
                    }
                    visit.playing[streamId] = true;
                    visit.rtc.play(streamId).then(function (stream) {
                        if (!visit.closed && visit.playing[streamId]) {
                            changed({ kind: 'calls-media', callId: call.callId, userId: remote.userId, local: false, element: stream.element() });
                        }
                    }).catch(function (error) {
                        if (!visit.closed) {
                            failed(call.callId, error);
                        }
                    });
                });
            });
            Object.keys(visit.playing).forEach(function (resource) {
                if (!wanted[resource]) {
                    delete visit.playing[resource];
                    visit.rtc.stop(resource);
                }
            });
        };

        _this.stop = stop;
        _this.close = function () {
            _closed = true;
            Object.keys(_visits).forEach(stop);
        };
    }

    IM.CallMedia = CallMedia;
})(odd);

