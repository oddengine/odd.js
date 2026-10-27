(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        MouseEvent = events.MouseEvent,
        Player = odd.Player,
        UI = Player.UI,

        CLASS_CONTEXTMENU = 'pe-contextmenu',
        CLASS_CONTEXTMENU_ITEM = 'pe-contextmenu-item',
        CLASS_CONTEXTMENU_ITEM_ICON = 'pe-contextmenu-item-icon',
        CLASS_CONTEXTMENU_ITEM_TEXT = 'pe-contextmenu-item-text',
        CLASS_CONTEXTMENU_ITEM_SHORTCUT = 'pe-contextmenu-item-shortcut',

        _default = {
            kind: 'ContextMenu',
            title: 'Player menu',
            items: [],
            visibility: true,
        };

    function ContextMenu(config, logger) {
        EventDispatcher.call(this, 'ContextMenu', { logger: logger }, [MouseEvent.CLICK]);

        var _this = this,
            _container,
            _root,
            _returnFocus,
            _closed = false;

        function _init() {
            _this.config = utils.extendz({}, _default, config);
            _this.components = {};
            var items = [{
                name: '',
                type: 'featured', // '', featured, disabled
                icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAMAAAC6V+0/AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAA2UExURebm5ubm5ubm5ubm5ubm5ubm5ubm5kxpcebm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5ubm5rnvS8UAAAASdFJOU/9GGpAEVa0AOw0vovB5tnDaudiwhIIAAACiSURBVBjTXZHbAsQQDERDkQS97P//7GaibLfzgJxgIoiHVHIWvQPysRZylbpg2mhpSwOmgx46kkPf10KMoflewGqLLsNBugXVIDxuZhRuTGrJZmHIXhBuUEIuMC7pJ3I4R9nGyHzCY2eONmWHesMyoQyI3BXncRgZ1M+16zJCSbMRqyT4LriKt2calP9nWkMM7q+GcEo/OFvnGrDIo/Ov7/gCDPoHpWEsixcAAAAASUVORK5CYII=',
                text: 'odd.js/' + odd().version,
                shortcut: '',
                handler: function () { window.open('https://oddengine.com/', '_blank', 'noopener'); },
            }].concat(utils.typeOf(_this.config.items) === 'array' ? _this.config.items : []);
            _this.config.items = [];

            _container = utils.createElement('div', CLASS_CONTEXTMENU);
            _container.setAttribute('role', 'menu');
            _container.setAttribute('aria-label', _this.config.title);
            _container.hidden = true;
            _container.addEventListener('keydown', _onMenuKeyDown);
            _container.addEventListener('focusout', _onFocusOut);

            for (var i = 0; i < items.length; i++) {
                _this.append(items[i]);
            }
        }

        _this.append = function (item) {
            if (_closed || !item) { return; }
            var button = utils.createElement('button', CLASS_CONTEXTMENU_ITEM);
            button.type = 'button';
            button.setAttribute('role', 'menuitem');
            button.tabIndex = -1;
            button.disabled = item.type === 'disabled' || typeof item.handler !== 'function';
            if (item.type === 'featured') { button.classList.add('featured'); }
            button.onclick = function (e) {
                if (_closed || button.disabled) { return; }
                _hide(true);
                item.handler.call(button, e);
            };

            if (item.icon) {
                var icon = utils.createElement('img', CLASS_CONTEXTMENU_ITEM_ICON);
                icon.alt = '';
                icon.onerror = function () { icon.hidden = true; };
                icon.src = item.icon;
                button.appendChild(icon);
            }

            var text = utils.createElement('span', CLASS_CONTEXTMENU_ITEM_TEXT);
            text.textContent = item.text || item.name || _this.config.title;
            button.appendChild(text);

            if (item.shortcut) {
                var shortcut = utils.createElement('span', CLASS_CONTEXTMENU_ITEM_SHORTCUT);
                shortcut.textContent = item.shortcut;
                button.appendChild(shortcut);
            }

            _container.appendChild(button);
            _this.config.items.push(item);
        };

        _this.bind = function (root) {
            if (_closed || _root === root) { return; }
            _unbind();
            _root = root;
            if (!_root) { return; }
            if (!_root.hasAttribute('tabindex')) { _root.tabIndex = -1; }
            _root.addEventListener('contextmenu', _onContextMenu);
            _root.addEventListener('keydown', _onRootKeyDown);
            document.addEventListener('pointerdown', _onPointerDown);
        };

        function _onContextMenu(e) {
            // Editable content keeps its browser menu and clipboard actions.
            if (_editable(e.target)) { return; }
            e.preventDefault();
            e.stopPropagation();
            _show(e.clientX, e.clientY);
        }

        function _editable(target) {
            return target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
        }

        function _onRootKeyDown(e) {
            if ((e.key === 'ContextMenu' || e.key === 'F10' && e.shiftKey) && !_editable(e.target)) {
                e.preventDefault();
                e.stopPropagation();
                var rect = e.target.getBoundingClientRect();
                _show(rect.left, rect.bottom);
            }
        }

        function _show(x, y) {
            if (_closed || !_root) { return; }
            if (_container.hidden) { _returnFocus = _root.contains(document.activeElement) ? document.activeElement : _root; }
            _container.hidden = false;
            _container.style.display = 'block';
            _container.style.maxHeight = _root.clientHeight + 'px';
            var rect = _root.getBoundingClientRect();
            var scaleX = rect.width / _root.offsetWidth || 1;
            var scaleY = rect.height / _root.offsetHeight || 1;
            _container.style.left = Math.max(0, Math.min((x - rect.left) / scaleX, _root.clientWidth - _container.offsetWidth)) + 'px';
            _container.style.top = Math.max(0, Math.min((y - rect.top) / scaleY, _root.clientHeight - _container.offsetHeight)) + 'px';
            _focus(0);
        }

        function _focus(index) {
            var buttons = _container.querySelectorAll('button:not(:disabled)');
            if (!buttons.length) { return; }
            index = (index + buttons.length) % buttons.length;
            for (var i = 0; i < buttons.length; i++) { buttons[i].tabIndex = i === index ? 0 : -1; }
            buttons[index].focus();
        }

        function _onMenuKeyDown(e) {
            var buttons = _container.querySelectorAll('button:not(:disabled)');
            var index = utils.indexOf(buttons, document.activeElement);
            switch (e.key) {
                case 'ArrowDown': _focus(index + 1); break;
                case 'ArrowUp': _focus(index - 1); break;
                case 'Home': _focus(0); break;
                case 'End': _focus(buttons.length - 1); break;
                case 'Escape': _hide(true); break;
                case 'Tab': _hide(true); return;
                default: return;
            }
            e.preventDefault();
            e.stopPropagation();
        }

        function _onFocusOut(e) {
            if (!_container.contains(e.relatedTarget)) { _hide(false); }
        }

        function _onPointerDown(e) {
            if (!_container.contains(e.target)) { _hide(false); }
        }

        function _hide(restore) {
            if (_container.hidden) { return; }
            _container.hidden = true;
            _container.style.display = 'none';
            if (restore && _returnFocus && _returnFocus.isConnected) { _returnFocus.focus(); }
            _returnFocus = null;
        }

        function _unbind() {
            _hide(false);
            if (_root) {
                _root.removeEventListener('contextmenu', _onContextMenu);
                _root.removeEventListener('keydown', _onRootKeyDown);
            }
            document.removeEventListener('pointerdown', _onPointerDown);
            _root = null;
        }

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {
            _hide(true);
        };

        _this.destroy = function () {
            if (_closed) { return; }
            _closed = true;
            _unbind();
            _container.removeEventListener('keydown', _onMenuKeyDown);
            _container.removeEventListener('focusout', _onFocusOut);
            for (var i = 0; i < _container.children.length; i++) {
                var button = _container.children[i];
                button.onclick = null;
                var icon = button.querySelector('img');
                if (icon) { icon.onerror = null; icon.removeAttribute('src'); }
            }
            utils.emptyElement(_container);
            _this.config.items = [];
            _this.components = {};
        };

        _init();
    }

    ContextMenu.prototype = Object.create(EventDispatcher.prototype);
    ContextMenu.prototype.constructor = ContextMenu;
    ContextMenu.prototype.kind = 'ContextMenu';
    ContextMenu.prototype.CONF = _default;

    UI.register(ContextMenu);
})(odd);

