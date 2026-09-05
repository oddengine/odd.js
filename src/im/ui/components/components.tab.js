(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        components = odd.IM.UI.components,

        CLASS_TAB = 'im-tab',
        CLASS_TAB_HEAD = 'im-tab-head',
        CLASS_TAB_BODY = 'im-tab-body',
        CLASS_TAB_ITEM = 'im-tab-item',
        CLASS_TAB_PAGE = 'im-tab-page';

    function Tab(name, value, logger) {
        EventDispatcher.call(this, 'Tab', { logger: logger }, [Event.CHANGE]);

        var _this = this,
            _name,
            _container,
            _head,
            _body,
            _active;

        function _init() {
            _name = name;
            _container = utils.createElement('div', CLASS_TAB + ' ' + name);
            _head = utils.createElement('div', CLASS_TAB_HEAD);
            _body = utils.createElement('div', CLASS_TAB_BODY);
            _container.appendChild(_head);
            _container.appendChild(_body);
        }

        _this.insert = function (name, content, option) {
            option = utils.extendz({ index: NaN, active: 'auto' }, option);
            if (isNaN(option.index)) {
                option.index = _head.children.length;
            }
            if (option.active === 'auto' && _head.children.length === 0) {
                option.active = true;
            }

            var item = utils.createElement('button', CLASS_TAB_ITEM + ' ' + name);
            var page = utils.createElement('div', CLASS_TAB_PAGE + ' ' + name);
            item.type = 'button';
            item.setAttribute('name', name);
            item.setAttribute('state', 'off');
            page.setAttribute('name', name);
            page.setAttribute('state', 'off');
            item.addEventListener('click', _onClick);
            page.appendChild(content);

            if (option.index === 0) {
                _head.insertAdjacentElement('afterbegin', item);
                _body.insertAdjacentElement('afterbegin', page);
            } else {
                _head.children[option.index - 1].insertAdjacentElement('afterend', item);
                _body.children[option.index - 1].insertAdjacentElement('afterend', page);
            }
            if (option.active === true) {
                _this.active(option.index);
            }
            return option.index;
        };

        function _onClick(e) {
            var index = utils.indexOf(_head.children, e.currentTarget);
            _this.active(index);
        }

        _this.index = function (value) {
            if (utils.typeOf(value) === 'number') {
                return value;
            }
            for (var i = 0; i < _head.children.length; i++) {
                if (_head.children[i].getAttribute('name') === value) {
                    return i;
                }
            }
            return -1;
        };

        _this.active = function (value) {
            var index = _this.index(value),
                origin;

            if (index < 0 || index >= _head.children.length) {
                return _active ? _active.getAttribute('name') : '';
            }

            if (_active) {
                origin = utils.indexOf(_head.children, _active);
                _head.children[origin].setAttribute('state', 'off');
                _body.children[origin].setAttribute('state', 'off');
            }
            _head.children[index].setAttribute('state', 'on');
            _body.children[index].setAttribute('state', 'on');
            _active = _head.children[index];
            if (index !== origin) {
                _this.dispatchEvent(Event.CHANGE, {
                    name: _name,
                    value: _active.getAttribute('name'),
                });
            }
            return _active.getAttribute('name');
        };

        _this.name = function (index) {
            index = index === undefined ? _this.index(_active && _active.getAttribute('name')) : _this.index(index);
            return index >= 0 && index < _head.children.length ? _head.children[index].getAttribute('name') : '';
        };

        _this.page = function (value) {
            var index = _this.index(value);
            return index >= 0 && index < _body.children.length ? _body.children[index] : null;
        };

        _this.length = function () {
            return _head.children.length;
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _this.destroy = function () {
            for (var i = 0; i < _head.children.length; i++) {
                _head.children[i].removeEventListener('click', _onClick);
            }
            _container.innerHTML = '';
        };

        _init();
    }

    Tab.prototype = Object.create(EventDispatcher.prototype);
    Tab.prototype.constructor = Tab;
    Tab.prototype.kind = 'Tab';

    components.Tab = Tab;
})(odd);

