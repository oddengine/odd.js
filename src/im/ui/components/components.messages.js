(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        components = odd.IM.UI.components,

        CLASS_MESSAGES = 'im-conversation-messages';

    function Messages(name, data, logger) {
        EventDispatcher.call(this, 'Messages', { logger: logger });

        var _this = this,
            _items,
            _data,
            _container;

        function _init() {
            _items = [];
            _data = [];
            _container = utils.createElement('div', CLASS_MESSAGES + (name ? ' ' + name : ''));
            if (data && utils.typeOf(data) !== 'string') {
                _this.update(data);
            }
        }

        _this.append = function (value) {
            var item = new components.Message(String(_items.length), value, logger);
            _items.push(item);
            _data.push(value);
            _container.appendChild(item.element());
            _container.scrollTop = _container.scrollHeight;
            return item;
        };

        _this.update = function (value) {
            for (var i = 0; i < _items.length; i++) {
                _items[i].destroy();
            }
            _items = [];
            _data = [];
            utils.emptyElement(_container);
            value = value || [];
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
            _container.innerHTML = '';
        };

        _init();
    }

    Messages.prototype = Object.create(EventDispatcher.prototype);
    Messages.prototype.constructor = Messages;
    Messages.prototype.kind = 'Messages';

    components.Messages = Messages;
})(odd);

