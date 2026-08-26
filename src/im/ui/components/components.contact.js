(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        MouseEvent = events.MouseEvent,
        components = odd.IM.UI.components,

        CLASS_CONTACT = 'im-contact';

    function Contact(name, data, logger) {
        EventDispatcher.call(this, 'Contact', { logger: logger }, MouseEvent);

        var _this = this,
            _data,
            _container,
            _avatar,
            _name,
            _time,
            _status,
            _badge;

        function _init() {
            _container = utils.createElement('button', CLASS_CONTACT + (name ? ' ' + name : ''));
            _container.type = 'button';
            _container.setAttribute('state', 'off');
            _container.addEventListener('click', _onClick);

            _avatar = new components.Avatar('avatar', undefined, logger);
            _container.appendChild(_avatar.element());

            var copy = utils.createElement('span', 'im-contact-copy'),
                line = utils.createElement('span', 'im-contact-line');
            _name = utils.createElement('strong');
            _time = utils.createElement('time');
            _status = utils.createElement('small');
            _badge = utils.createElement('i', 'im-contact-unread');
            line.appendChild(_name);
            line.appendChild(_time);
            copy.appendChild(line);
            copy.appendChild(_status);
            _container.appendChild(copy);
            _container.appendChild(_badge);

            _this.update(data);
        }

        function _onClick() {
            _this.dispatchEvent(MouseEvent.CLICK, {
                name: 'contact',
                id: _data.id,
                contact: _data,
            });
        }

        _this.update = function (value) {
            _data = value || {};
            _container.setAttribute('data-id', _data.id || '');
            _container.setAttribute('type', _data.type || 'contact');
            _container.setAttribute('data-search', ((_data.name || '') + ' ' + (_data.status || '')).toLowerCase());
            _avatar.update(_data);
            _name.textContent = _data.name || _data.id || '';
            _time.textContent = _data.time || '';
            _status.textContent = _data.status || (_data.online === false ? '离线' : '在线');
            _badge.textContent = _data.unread || '';
            _badge.hidden = !_data.unread;
            return _data;
        };

        _this.data = function () {
            return _data;
        };

        _this.state = function (value) {
            if (value !== undefined) {
                _container.setAttribute('state', value);
            }
            return _container.getAttribute('state');
        };

        _this.visibility = function (value) {
            if (value !== undefined) {
                _container.hidden = !value;
            }
            return !_container.hidden;
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function () {
        };

        _this.destroy = function () {
            _container.removeEventListener('click', _onClick);
            _container.innerHTML = '';
        };

        _init();
    }

    Contact.prototype = Object.create(EventDispatcher.prototype);
    Contact.prototype.constructor = Contact;
    Contact.prototype.kind = 'Contact';

    components.Contact = Contact;
})(odd);

