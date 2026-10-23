(function (odd) {
    var IM = odd.IM, Event = odd.events.Event, NetStatusEvent = odd.events.NetStatusEvent;

    // Each selected call owns its RTC instance. No operation can close an
    // application's existing live, conference or game RTC instance.
    function CallMedia(config, logger, changed, failed) {
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

        _this.update = function (call, member) {
            if (_closed) {
                return;
            }
            if (!member || call.state === 'ending' || call.state === 'ended' ||
                member.state === 'ending' || member.state === 'ended' || member.state === 'recovering') {
                stop(call.callId);
                return;
            }
            if (!member.resourceId || !call.roomId) {
                return;
            }
            var visit = _visits[call.callId];
            if (visit && visit.generation !== member.generation) {
                stop(call.callId);
                visit = null;
            }
            if (!visit) {
                if (config.participation) {
                    failed(call.callId, new Error('Product call media requires publication binding support.'));
                    return;
                }
                if (!odd.RTC || typeof config.credentials !== 'function') {
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
                visit.rtc.addEventListener(Event.ERROR, function (event) {
                    if (!visit.closed) {
                        failed(call.callId, event.data);
                    }
                });
                visit.rtc.addEventListener(NetStatusEvent.NETSTATUS, function (event) {
                    var code = event.data && event.data.code;
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
                    return visit.rtc.publish(call.mode === 'audio' ? { video: false } : {}, false, false);
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
                if (remote.userId === member.userId || remote.state !== 'connected' || !remote.resourceId) {
                    return;
                }
                wanted[remote.resourceId] = true;
                if (visit.playing[remote.resourceId]) {
                    return;
                }
                visit.playing[remote.resourceId] = true;
                visit.rtc.play(remote.resourceId).then(function (stream) {
                    if (!visit.closed && visit.playing[remote.resourceId]) {
                        changed({ kind: 'calls-media', callId: call.callId, userId: remote.userId, local: false, element: stream.element() });
                    }
                }).catch(function (error) {
                    if (!visit.closed) {
                        failed(call.callId, error);
                    }
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
