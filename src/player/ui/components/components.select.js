(function (odd) {
    var utils = odd.utils,
        css = utils.css,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        components = odd.Player.UI.components,

        CLASS_SELECT = 'pe-select',
        CLASS_SELECT_LABEL = 'pe-select-label',
        CLASS_SELECT_LIST = 'pe-select-list',
        CLASS_SELECT_OPTION = 'pe-select-option';

    function Select(name, value, logger) {
        EventDispatcher.call(this, 'Select', { logger: logger }, [Event.CHANGE]);

        var _this = this,
            _name = name,
            _logger = logger,
            _container,
            _label,
            _list,
            _index = NaN;

        function _init() {
            _container = utils.createElement('div', CLASS_SELECT + ' ' + _name);

            _label = utils.createElement('span', CLASS_SELECT_LABEL);
            _label.addEventListener('click', _onClick);
            _container.appendChild(_label);

            _list = utils.createElement('div', CLASS_SELECT_LIST);
            _list.style.visibility = 'hidden';
            _container.appendChild(_list);
        }

        function _onClick(e) {
            _list.style.visibility = _list.style.visibility === 'hidden' ? 'visible' : 'hidden';
            _this.dispatchEvent(MouseEvent.CLICK, { name: _name, visibility: _list.style.visibility });
        }

        _this.append = function (label, value) {
            var option = utils.createElement('span', CLASS_SELECT_OPTION);
            option.addEventListener('click', _onItemClick);
            option.innerHTML = label;
            _list.appendChild(option);

            if (isNaN(_index)) {
                _this.select(0);
            }
            _this.resize();
        };

        function _onItemClick(e) {
            var index = indexOf(_list.children, e.target);
            if (index !== _this.index()) {
                _this.dispatchEvent(Event.CHANGE, { name: _name, index: index });
            }
            _list.style.visibility = 'hidden';
            _this.dispatchEvent(MouseEvent.CLICK, { name: _name, visibility: _list.style.visibility });
        }

        _this.remove = function (index) {
            if (index >= 0 && index < _list.children.length) {
                var option = _list.children[index];
                option.removeEventListener('click', _onItemClick);
                _label.innerHTML = '';
                _list.removeChild(option);

                if (_index >= index) {
                    _this.select(0);
                }
                _this.resize();
            }
        };

        _this.select = function (index) {
            if (_index !== index && index >= 0 && index < _list.children.length) {
                _index = index;

                var option = _list.children[_index];
                _label.innerHTML = option.innerHTML;
                _this.dispatchEvent(Event.CHANGE, { name: _name, index: index });
            }
        };

        _this.index = function () {
            return _index;
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {
            css.style(_list, {
                'left': (_container.clientWidth - _list.clientWidth) / 2 + 'px',
            });
        };

        _init();
    }

    Select.prototype = Object.create(EventDispatcher.prototype);
    Select.prototype.constructor = Select;
    Select.prototype.kind = 'Select';

    components.Select = Select;
})(odd);

