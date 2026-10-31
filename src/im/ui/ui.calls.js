(function (odd) {
    var IM = odd.IM, UI = IM.UI, Event = odd.events.Event, IMEvent = odd.events.IMEvent;

    // A call stays visible independently of the selected conversation/tab.
    function CallPanel(im, config) {
        config = config || {};
        var labels = odd.utils.extendz({
            call: 'Call', video: 'Video call', voice: 'Voice call', waiting: 'Waiting for an answer',
            ringing: 'Ringing', connecting: 'Connecting', connected: 'Connected', recovering: 'Reconnecting',
            closing: 'Closing media resources', ended: 'Ended', callEnded: 'Call ended', incoming: 'Incoming call',
            answeredElsewhere: 'Answered on another device', dismiss: 'Dismiss', accept: 'Accept',
            declineHere: 'Decline here', declineAll: 'Decline on all devices', end: 'End call', leave: 'Leave call',
            retryPending: 'Retry pending operation', unknown: 'Result unknown. Reconnecting will retry the same operation.',
            retry: 'Retry', disconnected: 'Connection lost. Waiting for authoritative call state.',
            choose: 'Choose participants', calling: 'Calling', callSelected: 'Call selected participants', cancel: 'Cancel',
            moreMembers: 'Load more members', memberLimit: 'Member selection limit reached',
            minimize: 'Minimize call',
            chooseLimit: 'Choose between 1 and {max} participants',
            retryMembers: 'Reload members',
        }, config.labels || {});
        var _this = this, _closed = false, _call = null, _selection = 0,
            _panel = document.createElement('section'), _title = document.createElement('h2'),
            _status = document.createElement('p'), _members = document.createElement('ul'),
            _media = document.createElement('div'), _actions = document.createElement('div'),
            _elements = Object.create(null);
        _panel.className = 'im-call';
        _panel.hidden = true;
        _panel.setAttribute('aria-label', labels.call);
        _status.setAttribute('role', 'status');
        _media.className = 'im-call-media';
        _actions.className = 'im-call-actions';
        [_title, _status, _members, _media, _actions].forEach(function (element) { _panel.appendChild(element); });
        if (typeof config.onMinimize === 'function') {
            var minimize = document.createElement('button');
            minimize.type = 'button'; minimize.className = 'im-call-minimize'; minimize.textContent = labels.minimize;
            minimize.onclick = function () { if (!_closed) { config.onMinimize(); } };
            _panel.insertBefore(minimize, _title);
        }

        function button(label, action) {
            var element = document.createElement('button');
            element.type = 'button';
            element.textContent = label;
            element.onclick = function () {
                element.disabled = true;
                Promise.resolve().then(action).catch(function (reason) {
                    if (!_closed) { _status.textContent = typeof config.failureMessage === 'function' ? config.failureMessage(reason) : reason.message; }
                }).then(function () { element.disabled = false; });
            };
            _actions.appendChild(element);
            return element;
        }
        function dismiss() {
            ++_selection;
            _call = null;
            _panel.hidden = true;
            _elements = Object.create(null);
            _media.textContent = '';
        }
        function label(user) {
            return typeof config.name === 'function' ? config.name(user) || user : user;
        }
        function render(call) {
            var endpoint = im.calls().endpoint(), own = call.participants.filter(function (value) { return value.userId === endpoint.userId; })[0];
            if (!own) { return; }
            var selected = own.deviceId === endpoint.deviceId && own.sessionId === endpoint.sessionId,
                candidate = (own.candidates || []).some(function (value) {
                    return value.deviceId === endpoint.deviceId && value.sessionId === endpoint.sessionId && value.state !== 'ended';
                }), ended = call.state === 'ended', closing = call.state === 'ending' || own.state === 'ending',
                incoming = !own.deviceId && candidate && (own.state === 'invited' || own.state === 'ringing');
            if ((!selected && !incoming || ended) && (!_call || _call.callId !== call.callId)) { return; }
            if (_call && _call.callId !== call.callId && _call.state !== 'ended') { return; }
            _call = call;
            _panel.hidden = false;
            _title.textContent = (call.mode === 'video' ? labels.video : labels.voice) + ' · ' + label(call.callerId);
            var states = { invited: labels.waiting, ringing: labels.ringing, accepted: labels.waiting,
                preparing: labels.connecting, connecting: labels.connecting, connected: labels.connected, recovering: labels.recovering,
                ending: labels.closing, ended: labels.ended };
            _status.textContent = ended ? labels.callEnded : closing ? states.ending : incoming ? labels.incoming :
                own.deviceId && !selected ? labels.answeredElsewhere : states[own.state] || states.accepted;
            if (call.reason || own.reason) { var reason = own.reason || call.reason; _status.textContent += ' · ' + (config.reasons && (config.reasons[reason] || config.reasons.unknown) || reason); }
            _members.textContent = '';
            call.participants.forEach(function (value) {
                var row = document.createElement('li');
                row.textContent = label(value.userId) + ' · ' + (states[value.state] || value.state);
                _members.appendChild(row);
                if (value.state === 'ended' || value.state === 'ending' || value.state === 'recovering') {
                    if (_elements[value.userId]) { _elements[value.userId].remove(); delete _elements[value.userId]; }
                }
            });
            _actions.textContent = '';
            if (ended || own.state === 'ended' || (!incoming && own.deviceId && !selected)) {
                button(labels.dismiss, dismiss);
            } else if (incoming && !closing) {
                button(labels.accept, function () { return im.calls().accept(call.callId); });
                button(labels.declineHere, function () { return im.calls().reject(call.callId, false); });
                button(labels.declineAll, function () { return im.calls().reject(call.callId, true); });
            } else if (selected && !closing) {
                button(call.callerId === endpoint.userId ? labels.end : labels.leave, function () {
                    return im.calls().action(call.callId, call.callerId === endpoint.userId ?
                        (call.state === 'inviting' ? 'cancel' : 'end') : 'leave');
                });
            }
            if (closing) { button(labels.retryPending, function () { im.calls().retry(); }); }
        }
        function changed(event) {
            var value = event.data.payload;
            if (_closed || event.data.event !== IM.Protocol.Event.IM_CALL_CHANGE || !value) { return; }
            if (value.kind === 'calls') {
                render(value.call);
            } else if (value.kind === 'calls-media' && _call && value.callId === _call.callId) {
                if (value.closed) {
                    _media.textContent = '';
                    _elements = Object.create(null);
                } else if (value.element) {
                    var previous = _elements[value.userId];
                    if (previous && previous !== value.element) { previous.remove(); }
                    _elements[value.userId] = value.element;
                    value.element.controls = true;
                    value.element.muted = !!value.local;
                    value.element.setAttribute('playsinline', '');
                    value.element.setAttribute('aria-label', label(value.userId));
                    _media.appendChild(value.element);
                }
            } else if (value.kind === 'call-operation' && value.state === 'unknown') {
                _status.textContent = labels.unknown;
                _panel.hidden = false;
                _actions.textContent = '';
                button(labels.retry, function () { im.calls().retry(); });
            } else if (value.kind === 'calls-error' || value.kind === 'calls-gap' || value.state === 'rejected' || value.state === 'expired') {
                _status.textContent = typeof config.failureMessage === 'function' ? config.failureMessage(value) : value.message;
            }
        }
        function disconnected() {
            if (!_panel.hidden) {
                _status.textContent = labels.disconnected;
                _actions.textContent = '';
            }
        }
        _this.invite = function (target, mode) {
            var selection = ++_selection;
            if (im.calls().current()) { return Promise.reject(new Error('Finish the current call first.')); }
            _call = null;
            _panel.hidden = false;
            _title.textContent = mode === 'video' ? labels.video : labels.voice;
            _members.textContent = '';
            _media.textContent = '';
            _actions.textContent = '';
            _status.textContent = target.type === 'group' ? labels.choose : labels.calling;
            if (target.type === 'user') { return im.calls().invite(target, { mode: mode }).catch(function (reason) {
                if (!_closed && selection === _selection) {
                    _status.textContent = typeof config.failureMessage === 'function' ? config.failureMessage(reason) : reason.message;
                    if (!im.calls().busy || !im.calls().busy()) { button(labels.cancel, dismiss); }
                }
                throw reason;
            }); }
            if (target.type !== 'group' || typeof config.members !== 'function') {
                return Promise.reject(new Error('Choose a contact or configure the group member directory.'));
            }
            var choices = [], seen = Object.create(null), cursor = null, more;
            function loadMembers() { return Promise.resolve(config.members(target, cursor)).then(function (page) {
                if (_closed || selection !== _selection) { return; }
                var members = Array.isArray(page) ? page : page && page.items;
                if (!Array.isArray(members) || members.length > 1024 || choices.length + members.length > 1024) { throw new Error('Invalid group member directory.'); }
                members.forEach(function (member) {
                    if (!member.id || member.id === im.userId() || seen[member.id]) { return; }
                    seen[member.id] = true;
                    var row = document.createElement('li'), label = document.createElement('label'), input = document.createElement('input');
                    input.type = 'checkbox';
                    input.value = member.id;
                    choices.push(input);
                    label.appendChild(input);
                    label.appendChild(document.createTextNode(member.name || member.id));
                    row.appendChild(label);
                    _members.appendChild(row);
                });
                cursor = !Array.isArray(page) && page.nextCursor || null;
                if (more) { more.hidden = !cursor; more.disabled = choices.length >= 1024; if (more.disabled) { more.textContent = labels.memberLimit; } }
            }); }
            function controls() {
                if (_closed || selection !== _selection) { return; }
                _status.textContent = labels.choose;
                _actions.textContent = '';
                button(labels.callSelected, function () {
                    var invitees = choices.filter(function (input) { return input.checked; }).map(function (input) { return input.value; });
                    var maximum = im.calls().capabilities ? im.calls().capabilities().participants - 1 : 15;
                    if (!invitees.length || invitees.length > maximum) { _status.textContent = labels.chooseLimit.replace('{max}', maximum); return; }
                    return im.calls().invite(target, { mode: mode, invitees: invitees });
                });
                more = button(labels.moreMembers, loadMembers); more.hidden = !cursor;
                button(labels.cancel, dismiss);
            }
            return loadMembers().then(controls).catch(function (reason) {
                if (_closed || selection !== _selection) { return; }
                _status.textContent = typeof config.failureMessage === 'function' ? config.failureMessage(reason) : reason.message;
                _actions.textContent = '';
                button(labels.retryMembers, function () { return loadMembers().then(controls); });
                button(labels.cancel, dismiss);
            });
        };
        _this.element = function () { return _panel; };
        _this.refresh = function () { if (_call && !_closed) { render(_call); } };
        _this.destroy = function () {
            _closed = true;
            im.removeEventListener(IMEvent.NOTIFY, changed);
            im.removeEventListener(Event.CLOSE, disconnected);
            dismiss();
            _panel.remove();
        };
        im.addEventListener(IMEvent.NOTIFY, changed);
        im.addEventListener(Event.CLOSE, disconnected);
        var current = im.calls().current();
        if (current) { render(current); }
    }

    UI.CallPanel = CallPanel;
})(odd);
