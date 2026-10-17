(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        components = odd.IM.UI.components,

        State = {
            SENDING: 'sending',
            SENT: 'sent',
            FAILED: 'failed',
            UNKNOWN: 'unknown',
            ACCEPTED: 'accepted',
            DELIVERED: 'delivered',
            SETTLED: 'settled',
            SAVED: 'saved',
            READ: 'read',
        },

        CLASS_MESSAGE = 'im-message';

    function Message(name, data, logger) {
        EventDispatcher.call(this, 'Message', { logger: logger });

        var _this = this,
            _data,
            _container,
            _avatar,
            _indicator,
            _from,
            _time,
            _body,
            _status,
            _retry;

        function _init() {
            _container = utils.createElement('article', CLASS_MESSAGE + (name ? ' ' + name : ''));
            _avatar = new components.Avatar('avatar', undefined, logger);
            _indicator = utils.createElement('span', 'im-message-state');
            _indicator.setAttribute('role', 'img');

            var bubble = utils.createElement('div', 'im-message-bubble'),
                meta = utils.createElement('header');
            _from = utils.createElement('strong');
            _time = utils.createElement('time');
            _body = utils.createElement('p');
            _status = utils.createElement('small', 'im-message-status');
            _status.setAttribute('role', 'status');
            _retry = utils.createElement('button', 'im-message-retry');
            _retry.type = 'button';
            _retry.textContent = 'Retry original operation';
            _retry.onclick = function () { if (_data.retry) { _data.retry(); } };
            meta.appendChild(_from);
            meta.appendChild(_time);
            bubble.appendChild(meta);
            bubble.appendChild(_body);
            bubble.appendChild(_status);
            bubble.appendChild(_retry);
            _container.appendChild(_avatar.element());
            _container.appendChild(_indicator);
            _container.appendChild(bubble);
            _this.update(data);
        }

        _this.update = function (value) {
            _data = value || {};
            _this.align(_data.align || (_data.mine ? 'right' : 'left'));
            _avatar.update({
                name: _data.from || '?',
                avatar: _data.avatar,
                online: _data.online,
            });
            _avatar.element().hidden = _this.align() === 'right';
            _from.textContent = _data.from || '';
            _time.textContent = _data.time || '';
            _body.textContent = _data.text || '';
            _this.state(_data.state || State.SENT);
            _retry.hidden = !_data.retry || (_data.state !== State.UNKNOWN && _data.state !== 'gift-pending');
            return _data;
        };

        _this.align = function (value) {
            if (value !== undefined) {
                _container.setAttribute('align', value === 'right' ? 'right' : 'left');
            }
            return _container.getAttribute('align');
        };

        _this.state = function (value) {
            if (value !== undefined) {
                _data.state = value;
                _container.setAttribute('state', value);
                _container.setAttribute('aria-busy', value === State.SENDING);
                _indicator.setAttribute('aria-label', value);
                _indicator.hidden = value !== State.SENDING && value !== State.FAILED;
                var labels = { sending: 'Sending', sent: '', failed: 'Not sent', unknown: 'Result unknown',
                    accepted: 'Accepted by server', delivered: 'Delivery complete', settled: 'Delivery responsibility completed',
                    saved: 'Saved on this device', read: 'Read by this account', expired: 'Expired; prior result may be unavailable',
                    revoked: 'Permission withdrawn', rejected: 'Rejected', 'gift-pending': 'Gift transaction confirmed; delivery pending' };
                _status.textContent = _data.reliable ? labels[value] || value : '';
                _status.hidden = !_status.textContent;
            }
            return _container.getAttribute('state');
        };

        _this.data = function () {
            return _data;
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function () {

        };

        _this.destroy = function () {
            _retry.onclick = null;
            _avatar.destroy();
            _container.innerHTML = '';
        };

        _init();
    }

    Message.prototype = Object.create(EventDispatcher.prototype);
    Message.prototype.constructor = Message;
    Message.prototype.kind = 'Message';

    Message.State = State;

    components.Message = Message;
})(odd);

