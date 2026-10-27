(function (odd) {
    var utils = odd.utils, _id = 0, _owners = new WeakMap();

    // A local choice panel shared by layout and source selectors. Its owner
    // keeps the selected value; this object only owns focus and visibility.
    function ControlMenu(anchor, select) {
        var _this = this, _panel = utils.createElement('div', 'pe-control-menu'),
            _items = [], _parent, _closed = false;
        _panel.id = 'pe-choice-' + (++_id);
        _panel.hidden = true;
        _panel.setAttribute('role', 'menu');
        _panel.setAttribute('aria-label', anchor.getAttribute('aria-label') || 'Choices');
        anchor.setAttribute('aria-haspopup', 'menu');
        anchor.setAttribute('aria-expanded', 'false');
        anchor.setAttribute('aria-controls', _panel.id);
        _panel.addEventListener('keydown', _onKeyDown);
        _panel.addEventListener('focusout', _onFocusOut);
        document.addEventListener('pointerdown', _onOutside);

        _this.append = function (label) {
            var item = utils.createElement('button', 'pe-select-option');
            item.type = 'button'; item.textContent = label; item.tabIndex = -1;
            item.setAttribute('role', 'menuitemradio');
            item.setAttribute('aria-checked', 'false');
            item.addEventListener('click', _onSelect);
            _panel.appendChild(item); _items.push(item);
        };
        _this.remove = function (index) {
            var item = _items[index];
            if (!item) { return; }
            item.removeEventListener('click', _onSelect); item.remove(); _items.splice(index, 1);
        };
        _this.clear = function () { while (_items.length) { _this.remove(0); } _this.close(false); };
        _this.selected = function (index) {
            _items.forEach(function (item, i) { item.setAttribute('aria-checked', String(i === index)); item.tabIndex = i === index ? 0 : -1; });
        };
        _this.open = function () {
            if (_closed || !_items.length || anchor.disabled) { return; }
            _parent = anchor.closest('.pe-controlbar') || anchor.parentNode;
            if (!_parent) { return; }
            var previous = _owners.get(_parent);
            if (previous && previous !== _this) { previous.close(false); }
            _owners.set(_parent, _this);
            if (_panel.parentNode !== _parent) { _parent.appendChild(_panel); }
            _panel.setAttribute('aria-label', anchor.getAttribute('aria-label') || 'Choices');
            _panel.hidden = false; anchor.setAttribute('aria-expanded', 'true');
            (_items.find(function (item) { return item.getAttribute('aria-checked') === 'true'; }) || _items[0]).focus();
        };
        _this.close = function (restore) {
            var open = !_panel.hidden;
            _panel.hidden = true; anchor.setAttribute('aria-expanded', 'false');
            if (_parent && _owners.get(_parent) === _this) { _owners.delete(_parent); }
            if (open && restore !== false && anchor.isConnected) { anchor.focus(); }
        };
        _this.toggle = function () { if (_panel.hidden) { _this.open(); } else { _this.close(); } };
        _this.visible = function () { return !_panel.hidden; };
        function _onSelect(event) {
            event.stopPropagation();
            var index = _items.indexOf(event.currentTarget);
            try { select(index); } finally { _this.close(); }
        }
        function _onKeyDown(event) {
            var index = _items.indexOf(document.activeElement), next = index;
            if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); _this.close(); return; }
            if (event.key === 'ArrowDown') { next = (index + 1) % _items.length; }
            else if (event.key === 'ArrowUp') { next = (index + _items.length - 1) % _items.length; }
            else if (event.key === 'Home') { next = 0; }
            else if (event.key === 'End') { next = _items.length - 1; }
            else { return; }
            event.preventDefault(); event.stopPropagation(); _items[next].focus();
        }
        function _onFocusOut(event) { if (!_panel.contains(event.relatedTarget) && event.relatedTarget !== anchor) { _this.close(false); } }
        function _onOutside(event) { if (!_panel.hidden && !_panel.contains(event.target) && !anchor.contains(event.target)) { _this.close(false); } }
        _this.destroy = function () {
            if (_closed) { return; }
            _closed = true; _this.clear();
            _panel.removeEventListener('keydown', _onKeyDown);
            _panel.removeEventListener('focusout', _onFocusOut);
            document.removeEventListener('pointerdown', _onOutside);
            _panel.remove();
        };
    }
    utils.ControlMenu = ControlMenu;
})(odd);
