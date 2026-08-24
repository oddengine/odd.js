(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        App = odd.App,
        UI = App.UI,
        components = UI.components,

        CLASS_TABS = 'app-tabs',
        CLASS_HEAD = 'app-tabs-head',
        CLASS_BODY = 'app-tabs-body',
        CLASS_TAB = 'app-tab',
        CLASS_PAGE = 'app-tab-page';

    function Tabs(name, logger) {
        var _this = this,
            _name = name,
            _container,
            _head,
            _body,
            _items,
            _active;

        EventDispatcher.call(this, 'AppTabs', { logger: logger }, [Event.CHANGE]);

        function _init() {
            _items = [];
            _container = utils.createElement('div', CLASS_TABS + ' ' + name);
            _head = utils.createElement('div', CLASS_HEAD);
            _head.setAttribute('role', 'tablist');
            _body = utils.createElement('div', CLASS_BODY);
            _container.appendChild(_head);
            _container.appendChild(_body);
        }

        _this.set = function (items, active) {
            _this.clear();
            for (var i = 0; i < items.length; i++) {
                _insert(items[i]);
            }
            _this.active(active || (items[0] && items[0].name));
        };

        function _insert(item) {
            var tab = utils.createElement('button', CLASS_TAB + ' ' + item.name),
                page = utils.createElement('section', CLASS_PAGE + ' ' + item.name);
            tab.type = 'button';
            tab.textContent = item.label;
            tab.setAttribute('role', 'tab');
            tab.setAttribute('aria-selected', 'false');
            tab.setAttribute('data-name', item.name);
            page.setAttribute('role', 'tabpanel');
            if (item.content) {
                page.appendChild(item.content);
            }
            tab.addEventListener('click', _onClick);
            _head.appendChild(tab);
            _body.appendChild(page);
            _items.push({ name: item.name, tab: tab, page: page });
        }

        function _onClick(e) {
            _this.active(e.currentTarget.getAttribute('data-name'));
        }

        _this.active = function (name) {
            var previous = _active;
            for (var i = 0; i < _items.length; i++) {
                var item = _items[i],
                    selected = item.name === name;
                item.tab.classList.toggle('active', selected);
                item.page.classList.toggle('active', selected);
                item.tab.setAttribute('aria-selected', selected);
                item.tab.tabIndex = selected ? 0 : -1;
                if (selected) {
                    _active = name;
                }
            }
            if (_active !== previous) {
                _this.dispatchEvent(Event.CHANGE, { name: _name, value: _active, previous: previous });
            }
            return _active;
        };

        _this.clear = function () {
            for (var i = 0; i < _items.length; i++) {
                _items[i].tab.removeEventListener('click', _onClick);
            }
            _items = [];
            _active = undefined;
            utils.emptyElement(_head);
            utils.emptyElement(_body);
        };

        _this.element = function () {
            return _container;
        };

        _this.destroy = function () {
            _this.clear();
        };

        _init();
    }

    Tabs.prototype = Object.create(EventDispatcher.prototype);
    Tabs.prototype.constructor = Tabs;
    Tabs.prototype.kind = 'Tabs';

    components.Tabs = Tabs;
})(odd);
