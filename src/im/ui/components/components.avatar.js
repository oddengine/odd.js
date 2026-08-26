(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        components = odd.IM.UI.components,

        CLASS_AVATAR = 'im-avatar';

    function Avatar(name, data, logger) {
        EventDispatcher.call(this, 'Avatar', { logger: logger });

        var _this = this,
            _data,
            _container;

        function _init() {
            _container = utils.createElement('span', CLASS_AVATAR + (name ? ' ' + name : ''));

            _data = {};
            if (data !== undefined) {
                _this.update(data);
            }
        }

        _this.update = function (value) {
            _data = value || {};
            utils.emptyElement(_container);
            _container.setAttribute('state', _data.online === false ? 'offline' : 'online');

            if (_data.avatar) {
                var image = utils.createElement('img', 'im-avatar-image');
                image.src = _data.avatar;
                image.alt = '';
                _container.appendChild(image);
            } else {
                var text = String(_data.name || _data.id || '?'),
                    parts = text.split(/\s+/),
                    initials = parts[0].charAt(0);
                if (parts.length > 1) {
                    initials += parts[parts.length - 1].charAt(0);
                } else if (/^[\x00-\x7F]+$/.test(text) && text.length > 1) {
                    initials += text.charAt(1);
                }
                _container.textContent = initials.toUpperCase();
            }

            if (_data.online !== false) {
                _container.appendChild(utils.createElement('i'));
            }
            return _data;
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

    Avatar.prototype = Object.create(EventDispatcher.prototype);
    Avatar.prototype.constructor = Avatar;
    Avatar.prototype.kind = 'Avatar';

    components.Avatar = Avatar;
})(odd);

