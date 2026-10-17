(function (odd) {
    var IM = odd.IM, UI = IM.UI, Event = odd.events.Event, IMEvent = odd.events.IMEvent;

    // A call stays visible independently of the selected conversation/tab.
    function CallPanel(im, config) {
        var _this = this, _closed = false, _call = null, _selection = 0,
            _panel = document.createElement('section'), _title = document.createElement('h2'),
            _status = document.createElement('p'), _members = document.createElement('ul'),
            _media = document.createElement('div'), _actions = document.createElement('div'),
            _elements = Object.create(null);
        _panel.className = 'im-call';
        _panel.hidden = true;
        _panel.setAttribute('aria-label', 'Call');
        _status.setAttribute('role', 'status');
        _media.className = 'im-call-media';
        _actions.className = 'im-call-actions';
        [_title, _status, _members, _media, _actions].forEach(function (element) { _panel.appendChild(element); });

        function button(label, action) {
            var element = document.createElement('button');
            element.type = 'button';
            element.textContent = label;
            element.onclick = function () {
                element.disabled = true;
                Promise.resolve().then(action).catch(function (reason) {
                    if (!_closed) { _status.textContent = reason.message; }
                }).then(function () { element.disabled = false; });
            };
            _actions.appendChild(element);
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
            _title.textContent = (call.mode === 'video' ? 'Video call' : 'Voice call') + ' · ' + label(call.callerId);
            var states = { invited: 'Waiting for an answer', ringing: 'Ringing', accepted: 'Waiting for an answer',
                preparing: 'Connecting', connecting: 'Connecting', connected: 'Connected', recovering: 'Reconnecting',
                ending: 'Closing media resources', ended: 'Ended' };
            _status.textContent = ended ? 'Call ended' : closing ? states.ending : incoming ? 'Incoming call' :
                own.deviceId && !selected ? 'Answered on another device' : states[own.state] || states.accepted;
            if (call.reason || own.reason) { _status.textContent += ' · ' + (own.reason || call.reason); }
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
                button('Dismiss', dismiss);
            } else if (incoming && !closing) {
                button('Accept', function () { return im.calls().accept(call.callId); });
                button('Decline here', function () { return im.calls().reject(call.callId, false); });
                button('Decline on all devices', function () { return im.calls().reject(call.callId, true); });
            } else if (selected && !closing) {
                button(call.callerId === endpoint.userId ? 'End call' : 'Leave call', function () {
                    return im.calls().action(call.callId, call.callerId === endpoint.userId ?
                        (call.state === 'inviting' ? 'cancel' : 'end') : 'leave');
                });
            }
            if (closing) { button('Retry pending operation', function () { im.calls().retry(); }); }
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
                _status.textContent = 'Result unknown. Reconnecting will retry the same operation.';
                _panel.hidden = false;
                _actions.textContent = '';
                button('Retry', function () { im.calls().retry(); });
            } else if (value.kind === 'calls-error' || value.kind === 'calls-gap' || value.state === 'rejected' || value.state === 'expired') {
                _status.textContent = value.message;
            }
        }
        function disconnected() {
            if (!_panel.hidden) {
                _status.textContent = 'Connection lost. Waiting for authoritative call state.';
                _actions.textContent = '';
            }
        }
        _this.invite = function (target, mode) {
            var selection = ++_selection;
            if (im.calls().current()) { return Promise.reject(new Error('Finish the current call first.')); }
            _call = null;
            _panel.hidden = false;
            _title.textContent = mode === 'video' ? 'Video call' : 'Voice call';
            _members.textContent = '';
            _media.textContent = '';
            _actions.textContent = '';
            _status.textContent = target.type === 'group' ? 'Choose participants' : 'Calling';
            if (target.type === 'user') { return im.calls().invite(target, { mode: mode }); }
            if (target.type !== 'group' || typeof config.members !== 'function') {
                return Promise.reject(new Error('Choose a contact or configure the group member directory.'));
            }
            return Promise.resolve(config.members(target)).then(function (members) {
                if (_closed || selection !== _selection) { return; }
                if (!Array.isArray(members) || members.length > 1024) { throw new Error('Invalid group member directory.'); }
                var choices = [], seen = Object.create(null);
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
                button('Call selected participants', function () {
                    var invitees = choices.filter(function (input) { return input.checked; }).map(function (input) { return input.value; });
                    return im.calls().invite(target, { mode: mode, invitees: invitees });
                });
                button('Cancel', dismiss);
            });
        };
        _this.element = function () { return _panel; };
        _this.destroy = function () {
            _closed = true;
            im.removeEventListener(IMEvent.NOTIFY, changed);
            im.removeEventListener(Event.CLOSE, disconnected);
            dismiss();
            _panel.remove();
        };
        im.addEventListener(IMEvent.NOTIFY, changed);
        im.addEventListener(Event.CLOSE, disconnected);
    }

    UI.CallPanel = CallPanel;
})(odd);
