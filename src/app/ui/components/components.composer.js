(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        AppEvent = events.AppEvent,
        App = odd.App,
        UI = App.UI,
        components = UI.components,

        _default = {
            placeholder: '输入消息…',
            maxLength: 500,
            compact: false,
        };

    function Composer(name, config, logger) {
        var _this = this,
            _container,
            _toolbar,
            _input,
            _file,
            _emoji,
            _counter;

        EventDispatcher.call(this, 'AppComposer', { logger: logger }, AppEvent);

        function _init() {
            _this.config = utils.extendz({}, _default, config || {});
            _container = utils.createElement('div', 'app-composer ' + name + (_this.config.compact ? ' compact' : ''));
            _toolbar = utils.createElement('div', 'app-composer-tools');
            _toolbar.appendChild(_button('emoji', '表情'));
            _toolbar.appendChild(_button('file', '文件'));
            _toolbar.appendChild(_button('video-call', '视频通话'));
            _toolbar.appendChild(_button('voice-call', '语音通话'));

            _input = utils.createElement('textarea', 'app-composer-input');
            _input.placeholder = _this.config.placeholder;
            _input.maxLength = _this.config.maxLength;
            _input.rows = 1;
            _input.addEventListener('input', _onInput);
            _input.addEventListener('keydown', _onKeyDown);

            _counter = utils.createElement('span', 'app-composer-counter');
            _counter.textContent = '0/' + _this.config.maxLength;

            var send = _button('send', '发送');
            send.classList.add('primary');

            _file = utils.createElement('input', 'app-composer-file');
            _file.type = 'file';
            _file.multiple = true;
            _file.addEventListener('change', _onFile);

            _emoji = utils.createElement('div', 'app-emoji-menu');
            var values = ['😀', '😂', '😍', '👍', '🎮', '🔥', '🎉', '❤️'];
            for (var i = 0; i < values.length; i++) {
                var item = _button('emoji-value', values[i], values[i]);
                item.setAttribute('data-value', values[i]);
                _emoji.appendChild(item);
            }

            var row = utils.createElement('div', 'app-composer-row');
            row.appendChild(_input);
            row.appendChild(send);
            _container.appendChild(_toolbar);
            _container.appendChild(row);
            _container.appendChild(_counter);
            _container.appendChild(_file);
            _container.appendChild(_emoji);
        }

        function _button(action, label, content) {
            var button = utils.createElement('button', 'app-icon-button ' + action);
            button.type = 'button';
            button.title = label;
            button.setAttribute('aria-label', label);
            button.setAttribute('data-action', action);
            if (content !== undefined) {
                button.textContent = content;
            } else {
                var icon = utils.createElement('span', 'app-composer-icon app-composer-icon-' + action);
                icon.setAttribute('aria-hidden', 'true');
                button.appendChild(icon);
            }
            button.addEventListener('click', _onAction);
            return button;
        }

        function _onAction(e) {
            var action = e.currentTarget.getAttribute('data-action');
            switch (action) {
                case 'send':
                    _send();
                    break;
                case 'emoji':
                    _emoji.classList.toggle('open');
                    break;
                case 'emoji-value':
                    _insert(e.currentTarget.getAttribute('data-value'));
                    _emoji.classList.remove('open');
                    break;
                case 'file':
                    _file.click();
                    break;
                case 'video-call':
                case 'voice-call':
                    _this.dispatchEvent(AppEvent.ACTION, { name: name, action: action });
                    break;
            }
        }

        function _insert(text) {
            var start = _input.selectionStart,
                end = _input.selectionEnd,
                value = _input.value;
            _input.value = value.substring(0, start) + text + value.substring(end);
            _input.selectionStart = _input.selectionEnd = start + text.length;
            _input.focus();
            _onInput();
        }

        function _onFile() {
            if (_file.files && _file.files.length) {
                _this.dispatchEvent(AppEvent.ACTION, {
                    name: name,
                    action: 'file',
                    files: _file.files,
                });
            }
            _file.value = '';
        }

        function _onInput() {
            _counter.textContent = _input.value.length + '/' + _this.config.maxLength;
        }

        function _onKeyDown(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                _send();
            }
        }

        function _send() {
            var text = utils.trim(_input.value);
            if (!text) {
                return;
            }
            _this.dispatchEvent(AppEvent.ACTION, { name: name, action: 'send', text: text });
            _input.value = '';
            _onInput();
        }

        _this.value = function (text) {
            if (text !== undefined) {
                _input.value = text;
                _onInput();
            }
            return _input.value;
        };

        _this.element = function () {
            return _container;
        };

        _this.focus = function () {
            _input.focus();
        };

        _this.destroy = function () {
            _input.removeEventListener('input', _onInput);
            _input.removeEventListener('keydown', _onKeyDown);
            _file.removeEventListener('change', _onFile);
            var buttons = _container.querySelectorAll('button');
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].removeEventListener('click', _onAction);
            }
        };

        _init();
    }

    Composer.prototype = Object.create(EventDispatcher.prototype);
    Composer.prototype.constructor = Composer;
    Composer.prototype.kind = 'Composer';
    Composer.prototype.CONF = _default;

    components.Composer = Composer;
})(odd);
