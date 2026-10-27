(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        MouseEvent = events.MouseEvent,
        Player = odd.Player,
        UI = Player.UI,

        CLASS_PLAYLIST = 'pe-playlist',

        _default = {
            kind: 'Playlist',
            title: 'Playlist',
            empty: 'No items in this playlist.',
            untitled: 'Untitled media',
            unavailable: 'Unavailable',
            items: [],
            visibility: true,
        };

    function Playlist(config, logger) {
        EventDispatcher.call(this, 'Playlist', { logger: logger }, [Event.CHANGE, MouseEvent.CLICK]);

        var _this = this,
            _container,
            _list,
            _empty,
            _index = NaN,
            _closed = false;

        function _init() {
            _this.config = utils.extendz({}, _default, config);
            // Own the list, while preserving each program's identity.
            var items = config && utils.typeOf(config.items) === 'array' ? config.items.slice() : [];
            _this.config.items = [];
            _this.components = {};

            _container = utils.createElement('section', CLASS_PLAYLIST);
            _container.setAttribute('aria-label', _this.config.title);
            _container.tabIndex = -1;

            var details = utils.createElement('details');
            details.open = true;
            _container.appendChild(details);
            var title = utils.createElement('summary');
            title.textContent = _this.config.title;
            details.appendChild(title);

            _empty = utils.createElement('p');
            _empty.textContent = _this.config.empty;
            _empty.setAttribute('role', 'status');
            details.appendChild(_empty);

            _list = utils.createElement('div');
            _list.setAttribute('role', 'list');
            details.appendChild(_list);

            for (var i = 0; i < items.length; i++) { _this.append(items[i]); }
            _updateEmpty();
        }

        function _buildItem(item) {
            var row = utils.createElement('div');
            row.setAttribute('role', 'listitem');
            var option = utils.createElement('button');
            option.addEventListener('click', _onItemClick);
            option.type = 'button';
            option.disabled = item.disabled === true || item.type === 'disabled';
            row.appendChild(option);

            if (item.snapshot) {
                var snapshot = utils.createElement('img');
                snapshot.alt = '';
                snapshot.loading = 'lazy';
                snapshot.onerror = function () { snapshot.hidden = true; };
                snapshot.src = item.snapshot;
                option.appendChild(snapshot);
            }

            var title = utils.createElement('strong');
            title.textContent = item.title || _this.config.untitled;
            option.appendChild(title);

            var description = utils.createElement('small');
            description.textContent = option.disabled ? _this.config.unavailable : item.description || '';
            option.appendChild(description);

            _list.appendChild(row);
        }

        function _onItemClick(e) {
            var index = utils.indexOf(_list.children, e.currentTarget.parentNode);
            _this.select(index);
        }

        _this.append = function (item) {
            if (_closed || !item) { return; }
            _this.config.items.push(item);
            _buildItem(item);
            _updateEmpty();
        };

        _this.remove = function (index) {
            if (_closed || !Number.isInteger(index) || index < 0 || index >= _list.children.length) { return; }
            var row = _list.children[index];
            var focused = row.contains(document.activeElement);
            _release(row);
            _list.removeChild(row);
            _this.config.items.splice(index, 1);
            if (_index === index) { _index = NaN; }
            else if (_index > index) { _index--; }
            _updateEmpty();
            // Removing an item does not start another stream.
            if (focused) { _container.focus(); }
        };

        _this.select = function (index, silent) {
            if (_closed || index === _index) { return; }
            var clear = typeof index === 'number' && isNaN(index);
            if (!clear && (!Number.isInteger(index) || index < 0 || index >= _list.children.length || _list.children[index].firstChild.disabled)) { return; }
            var previous = _list.children[_index];
            if (previous) {
                previous.firstChild.classList.remove('selected');
                previous.firstChild.removeAttribute('aria-current');
            }
            _index = index;
            if (clear) { return; }
            var option = _list.children[_index].firstChild;
            option.classList.add('selected');
            option.setAttribute('aria-current', 'true');
            if (!silent) { _this.dispatchEvent(Event.CHANGE, { name: 'playlist', value: index }); }
        };

        function _updateEmpty() {
            _empty.hidden = _this.config.items.length !== 0;
            _list.hidden = _this.config.items.length === 0;
        }

        function _release(row) {
            row.firstChild.removeEventListener('click', _onItemClick);
            var snapshot = row.querySelector('img');
            if (snapshot) { snapshot.onerror = null; snapshot.removeAttribute('src'); }
        }

        _this.index = function () {
            return _index;
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function () {

        };

        _this.destroy = function () {
            if (_closed) { return; }
            _closed = true;
            for (var i = 0; i < _list.children.length; i++) { _release(_list.children[i]); }
            utils.emptyElement(_list);
            _this.config.items = [];
            _index = NaN;
            _container.hidden = true;
            _this.components = {};
        };

        _init();
    }

    Playlist.prototype = Object.create(EventDispatcher.prototype);
    Playlist.prototype.constructor = Playlist;
    Playlist.prototype.kind = 'Playlist';
    Playlist.prototype.CONF = _default;

    UI.register(Playlist);
})(odd);

