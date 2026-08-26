(function (odd) {
    var utils = odd.utils,
        Browser = odd.Browser,
        css = utils.css,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        MouseEvent = events.MouseEvent,
        components = odd.Player.UI.components,

        CLASS_SLIDER = 'pe-slider',
        CLASS_SLIDER_CONTENT = 'pe-slider-content',
        CLASS_SLIDER_RAIL = 'pe-slider-rail',
        CLASS_SLIDER_THUMB = 'pe-slider-thumb',
        CLASS_TOOLTIP = 'pe-tooltip',

        HORIZONTAL = 'horizontal',
        VERTICAL = 'vertical';

    function Slider(name, value, logger) {
        EventDispatcher.call(this, 'Slider', { logger: logger }, [Event.CHANGE, MouseEvent.MOUSEMOVE]);

        var _this = this,
            _name = name,
            _logger = logger,
            _container,
            _tooltip,
            _content,
            _background,
            _progress,
            _position,
            _thumb,
            _direction = HORIZONTAL,
            _active = false;

        function _init() {
            _container = utils.createElement('div', CLASS_SLIDER + ' ' + _name);

            _tooltip = utils.createElement('span', CLASS_TOOLTIP + ' value');
            _container.appendChild(_tooltip);

            _content = utils.createElement('div', CLASS_SLIDER_CONTENT);
            _container.appendChild(_content);

            _background = utils.createElement('span', CLASS_SLIDER_RAIL + ' background');
            _content.appendChild(_background);

            _progress = utils.createElement('span', CLASS_SLIDER_RAIL + ' progress');
            _content.appendChild(_progress);

            _position = utils.createElement('span', CLASS_SLIDER_RAIL + ' position');
            _content.appendChild(_position);

            _thumb = utils.createElement('span', CLASS_SLIDER_THUMB);
            _thumb.innerHTML = '<span></span>';
            _content.appendChild(_thumb);

            document.addEventListener('mousedown', _onMouseDown);
            document.addEventListener('mousemove', _onMouseMove);
            document.addEventListener('mouseup', _onMouseUp);
        }

        _this.tips = function (value) {
            if (value !== undefined) {
                _tooltip.innerHTML = value;
            }
            return _tooltip.innerHTML;
        };

        _this.progress = function (value) {
            css.style(_progress, {
                'width': value + '%',
            });
            _progress.setAttribute('value', value);
        };

        _this.position = function (value) {
            css.style(_position, {
                'width': value + '%',
            });
            css.style(_thumb, {
                'left': value + '%',
            });
            _position.setAttribute('value', value);
        };

        function _onMouseDown(e) {
            if (e.button !== (Browser.isIE8 ? 1 : 0)) {
                return;
            }
            if (!e.target) {
                e.target = e.srcElement;
            }
            if (_content !== e.target &&
                _content !== e.target.parentNode &&
                _content !== e.target.parentNode.parentNode) {
                return;
            }

            var value = _calc(e.clientX, e.clientY);
            if (value !== _position.getAttribute('value')) {
                _this.dispatchEvent(Event.CHANGE, { name: _name, value: value });
            }
            _active = true;
        }

        function _onMouseMove(e) {
            if (!_active) {
                return;
            }
            var value = _calc(e.clientX, e.clientY);
            if (_content === e.target ||
                _content === e.target.parentNode ||
                _content === e.target.parentNode.parentNode) {
                var offset = _container.clientWidth * value / 100 - _tooltip.clientWidth / 2;
                var left = offset + _container.offsetLeft;
                var right = element.offsetParent.offsetLeft + left + tooltip.clientWidth;

                if (left < 1 && _container.offsetParent === e.target.parentNode.parentNode) {
                    css.style(tooltip, {
                        'left': 1 - element.offsetLeft + 'px',
                        'right': 'auto',
                    });
                } else if (right > e.target.parentNode.parentNode.clientWidth - 1) {
                    css.style(tooltip, {
                        'left': 'auto',
                        'right': element.offsetParent.offsetLeft + element.offsetLeft + element.clientWidth + 1 - _content.clientWidth + 'px',
                    });
                } else {
                    css.style(tooltip, {
                        'left': offset + 'px',
                        'right': 'auto',
                    });
                }
                if (value !== _position.getAttribute('value')) {
                    _this.dispatchEvent(Event.CHANGE, { name: _name, value: value });
                }
            }
        }

        function _onMouseUp(e) {
            if (!_active) {
                return;
            }
            var value = _calc(e.clientX, e.clientY);
            if (value !== _position.getAttribute('value')) {
                _this.dispatchEvent(Event.CHANGE, { name: _name, value: value });
            }
            _active = false;
        }

        function _calc(x, y) {
            var offsetX = x, offsetY = y, value;
            for (var node = _content; node; node = node.offsetParent) {
                offsetX -= node.offsetLeft;
                offsetY -= node.offsetTop;
            }
            if (_direction === HORIZONTAL) {
                value = (offsetX / _content.clientWidth * 100).toFixed(3);
            } else {
                value = (offsetY / _content.clientHeight * 100).toFixed(3);
            }
            return Math.max(0, Math.min(value, 100));
        }

        _this.tooltip = function () {
            return _tooltip;
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _this.destroy = function () {
            _container.removeEventListener('click', _onClick);
            _container.innerHTML = '';
        };

        _init();
    }

    Slider.prototype = Object.create(EventDispatcher.prototype);
    Slider.prototype.constructor = Slider;
    Slider.prototype.kind = 'Slider';
    Slider.HORIZONTAL = HORIZONTAL;
    Slider.VERTICAL = VERTICAL;

    components.Slider = Slider;
})(odd);

