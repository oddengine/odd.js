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
            items: [],
            visibility: true,
        };

    function Playlist(config, logger) {
        EventDispatcher.call(this, 'Playlist', { logger: logger }, [Event.CHANGE, MouseEvent.CLICK]);

        var _this = this,
            _container,
            _list,
            _index = NaN;

        function _init() {
            _this.config = config;
            _this.components = {};

            _container = utils.createElement('section', CLASS_PLAYLIST);

            _list = utils.createElement('div');
            _container.appendChild(_list);

            _buildComponents();
        }

        function _buildComponents() {
            utils.emptyElement(_list);

            for (var i = 0; i < _this.config.items.length; i++) {
                var item = _this.config.items[i];
                _buildItem(i, item);
            }
        }

        function _buildItem(index, item) {
            var option = utils.createElement('button');
            option.addEventListener('click', _onItemClick);
            option.type = 'button';

            if (item.snapshot) {
                var snapshot = utils.createElement('img');
                snapshot.src = item.snapshot;
                snapshot.alt = '';
                option.appendChild(snapshot);
            }

            var title = utils.createElement('strong');
            title.textContent = item.title;
            option.appendChild(title);

            var description = utils.createElement('small');
            description.textContent = item.description || '';
            option.appendChild(description);

            _list.appendChild(option);
        }

        function _onItemClick(e) {
            var index = utils.indexOf(_list.children, e.currentTarget);
            _this.select(index);
        }

        _this.append = function (item) {
            _buildItem(_list.children.length, item);
        };

        _this.remove = function (index) {
            if (index >= 0 && index < _list.children.length) {
                var option = _list.children[index];
                option.removeEventListener('click', _onItemClick);
                _list.removeChild(option);

                if (_index >= index) {
                    _this.select(0);
                }
            }
        };

        _this.select = function (index) {
            if (_index !== index && index >= 0 && index < _list.children.length) {
                if (!isNaN(_index)) {
                    var option = _list.children[_index];
                    option.classList.toggle('selected', false);
                }
                _index = index;

                var option = _list.children[_index];
                option.classList.toggle('selected', true);
                _this.dispatchEvent(Event.CHANGE, { name: 'playlist', value: index });
            }
        };

        _this.index = function () {
            return _index;
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function () {

        };

        _this.destroy = function () {
            utils.forEach(_this.components, function (_, component) {
                component.removeGlobalListener(_this.forward);
                component.destroy();
            });
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

