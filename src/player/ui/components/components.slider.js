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
            _active = false,
            _pointer = null;

        function _init() {
            _container = utils.createElement('div', CLASS_SLIDER + ' ' + _name);
            _container.setAttribute('role', 'slider');
            _container.setAttribute('aria-label', _name === 'volume' ? 'Volume' : 'Playback position');
            _container.setAttribute('aria-valuemin', '0');
            _container.setAttribute('aria-valuemax', '100');
            _container.setAttribute('aria-valuenow', '0');
            _container.tabIndex = 0;
            _container.style.touchAction = 'none';
            _container.addEventListener('keydown', _onKeyDown);

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

            document.addEventListener('pointerdown', _onMouseDown);
            document.addEventListener('pointermove', _onMouseMove);
            document.addEventListener('pointerup', _onMouseUp);
            document.addEventListener('pointercancel', _onCancel);
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
            value = Number.isFinite(Number(value)) ? Math.max(0, Math.min(100, Number(value))) : 0;
            _container.setAttribute('aria-valuenow', String(value));
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
            if (!_content.contains(e.target)) {
                return;
            }

            if (_active) { return; }
            _pointer = e.pointerId;
            e.preventDefault();
            _container.focus();
            var value = _calc(e.clientX, e.clientY);
            if (value !== _position.getAttribute('value')) {
                _this.dispatchEvent(Event.CHANGE, { name: _name, value: value });
            }
            _active = true;
        }

        function _onMouseMove(e) {
            if (!_active || e.pointerId !== _pointer) { return; }
            var value = _calc(e.clientX, e.clientY);
            var offset = _container.clientWidth * value / 100 - _tooltip.clientWidth / 2;
            css.style(_tooltip, { left: Math.max(0, Math.min(offset, _container.clientWidth - _tooltip.clientWidth)) + 'px', right: 'auto' });
            if (value !== _position.getAttribute('value')) {
                _this.dispatchEvent(Event.CHANGE, { name: _name, value: value });
            }
        }

        function _onMouseUp(e) {
            if (!_active || e.pointerId !== _pointer) {
                return;
            }
            var value = _calc(e.clientX, e.clientY);
            if (value !== _position.getAttribute('value')) {
                _this.dispatchEvent(Event.CHANGE, { name: _name, value: value });
            }
            _onCancel();
        }

        function _onCancel() { _active = false; _pointer = null; }

        function _onKeyDown(event) {
            var value = Number(_position.getAttribute('value')) || 0, next = value;
            if (event.key === 'ArrowRight' || event.key === 'ArrowUp') { next += 5; }
            else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') { next -= 5; }
            else if (event.key === 'Home') { next = 0; }
            else if (event.key === 'End') { next = 100; }
            else { return; }
            event.preventDefault(); event.stopPropagation();
            _this.dispatchEvent(Event.CHANGE, { name: _name, value: Math.max(0, Math.min(100, next)) });
        }

        function _calc(x, y) {
            var rect = _content.getBoundingClientRect();
            var value = _direction === HORIZONTAL ? (x - rect.left) / rect.width : (y - rect.top) / rect.height;
            return Number.isFinite(value) ? Math.max(0, Math.min(value * 100, 100)).toFixed(3) : '0';
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
            _onCancel();
            _container.removeEventListener('keydown', _onKeyDown);
            document.removeEventListener('pointerdown', _onMouseDown);
            document.removeEventListener('pointermove', _onMouseMove);
            document.removeEventListener('pointerup', _onMouseUp);
            document.removeEventListener('pointercancel', _onCancel);
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

