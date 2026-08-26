(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        components = odd.IM.UI.components,

        CLASS_MESSAGE = 'im-message';

    function Message(name, data, logger) {
        EventDispatcher.call(this, 'Message', { logger: logger });

        var _this = this,
            _data,
            _container,
            _avatar,
            _from,
            _time,
            _body;

        function _init() {
            _container = utils.createElement('article', CLASS_MESSAGE + (name ? ' ' + name : ''));
            _avatar = new components.Avatar('avatar', undefined, logger);
            var bubble = utils.createElement('div', 'im-message-bubble'),
                meta = utils.createElement('header');
            _from = utils.createElement('strong');
            _time = utils.createElement('time');
            _body = utils.createElement('p');
            meta.appendChild(_from);
            meta.appendChild(_time);
            bubble.appendChild(meta);
            bubble.appendChild(_body);
            _container.appendChild(_avatar.element());
            _container.appendChild(bubble);
            _this.update(data);
        }

        _this.update = function (value) {
            _data = value || {};
            _this.align(_data.align || (_data.mine ? 'right' : 'left'));
            _avatar.update({
                name: _data.from || '?',
                avatar: _data.avatar,
                online: true,
            });
            _avatar.element().hidden = _this.align() === 'right';
            _from.textContent = _data.from || '';
            _time.textContent = _data.time || '';
            _body.textContent = _data.text || '';
            return _data;
        };

        _this.align = function (value) {
            if (value !== undefined) {
                _container.setAttribute('align', value === 'right' ? 'right' : 'left');
            }
            return _container.getAttribute('align');
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
            _container.innerHTML = '';
        };

        _init();
    }

    Message.prototype = Object.create(EventDispatcher.prototype);
    Message.prototype.constructor = Message;
    Message.prototype.kind = 'Message';

    components.Message = Message;
})(odd);

