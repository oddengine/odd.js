(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        MouseEvent = events.MouseEvent,
        components = odd.Player.UI.components;

    function Select(name, value, logger) {
        EventDispatcher.call(this, 'Select', { logger: logger }, [Event.CHANGE, MouseEvent.CLICK]);
        var _this = this, _container, _label, _menu, _items = [], _index = NaN;

        function _init() {
            _container = utils.createElement('div', 'pe-select ' + name);
            _label = utils.createElement('button', 'pe-select-label');
            _label.type = 'button'; _label.disabled = true; _label.setAttribute('aria-label', value || name);
            _label.addEventListener('click', _onClick);
            _container.appendChild(_label);
            _menu = new utils.ControlMenu(_label, function (index) {
                _this.select(index);
                _this.dispatchEvent(MouseEvent.CLICK, { name: name, visibility: 'hidden' });
            });
        }
        function _onClick() {
            _menu.toggle();
            _this.dispatchEvent(MouseEvent.CLICK, { name: name, visibility: _menu.visible() ? 'visible' : 'hidden' });
        }
        _this.append = function (label, value) {
            _items.push({ label: String(label), value: value === undefined ? _items.length : value });
            _menu.append(String(label)); _label.disabled = false;
            if (isNaN(_index)) { _this.select(0); }
        };
        _this.remove = function (index) {
            if (index < 0 || index >= _items.length) { return; }
            _items.splice(index, 1); _menu.remove(index); _label.disabled = !_items.length;
            if (_index === index) { _index = NaN; _label.textContent = ''; if (_items.length) { _this.select(0); } }
            else if (_index > index) { _index--; _menu.selected(_index); }
        };
        _this.clear = function () { _items = []; _index = NaN; _label.textContent = ''; _label.disabled = true; _menu.clear(); };
        _this.select = function (index) {
            if (_index === index || index < 0 || index >= _items.length) { return; }
            _index = index;
            var item = _items[index];
            _label.textContent = item.label;
            _label.setAttribute('aria-label', (value || name) + ': ' + item.label);
            _menu.selected(index);
            _this.dispatchEvent(Event.CHANGE, { name: name, value: item.value });
        };
        _this.value = function (value) {
            if (value !== undefined) {
                for (var i = 0; i < _items.length; i++) { if (_items[i].value === value) { _this.select(i); break; } }
            }
            return isNaN(_index) ? undefined : _items[_index].value;
        };
        _this.index = function () { return _index; };
        _this.element = function () { return _container; };
        _this.resize = function () {};
        _this.destroy = function () { _menu.destroy(); _label.removeEventListener('click', _onClick); _container.innerHTML = ''; };
        _init();
    }
    Select.prototype = Object.create(EventDispatcher.prototype);
    Select.prototype.constructor = Select;
    Select.prototype.kind = 'Select';
    components.Select = Select;
})(odd);
