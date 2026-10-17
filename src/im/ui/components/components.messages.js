(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        components = odd.IM.UI.components,

        CLASS_MESSAGES = 'im-conversation-messages';

    function Messages(name, value, logger) {
        EventDispatcher.call(this, 'Messages', { logger: logger });

        var _this = this,
            _items,
            _data,
            _container;

        function _init() {
            _items = [];
            _data = [];
            _container = utils.createElement('div', CLASS_MESSAGES + (name ? ' ' + name : ''));
            if (value && utils.typeOf(value) !== 'string') {
                _this.update(value);
            }
        }

        _this.append = function (value) {
            if (_items.length >= 200) {
                var first = _items.shift();
                first.element().remove();
                first.destroy();
                _data.shift();
            }
            var item = new components.Message(String(_items.length), value, logger);
            _items.push(item);
            _data.push(value);
            _container.appendChild(item.element());
            if (_container.scrollHeight - _container.scrollTop - _container.clientHeight < 160) {
                _container.scrollTop = _container.scrollHeight;
            }
            return item;
        };

        _this.update = function (value, index) {
            if (index !== undefined) {
                var item = _items[index];
                if (item) {
                    _data[index] = value;
                    item.update(value);
                }
                return _data;
            }

            for (var i = 0; i < _items.length; i++) {
                _items[i].destroy();
            }
            _items = [];
            _data = [];
            utils.emptyElement(_container);
            value = (value || []).slice(-200);
            for (var j = 0; j < value.length; j++) {
                _this.append(value[j]);
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
            _items.forEach(function (item) { item.destroy(); });
            _items = [];
            _data = [];
            _container.innerHTML = '';
        };

        _init();
    }

    Messages.prototype = Object.create(EventDispatcher.prototype);
    Messages.prototype.constructor = Messages;
    Messages.prototype.kind = 'Messages';

    components.Messages = Messages;
})(odd);

