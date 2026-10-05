(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        MouseEvent = events.MouseEvent,
        components = odd.IM.UI.components,

        CLASS_COMPOSER = 'im-composer',
        _default = {
            conversation: '',
            maxlength: 500,
            placeholder: 'Send a message...',
            presentation: 'full',
            tools: ['emoji', 'file', 'video-call', 'voice-call'],
            miniTools: ['emoji'],
            labels: {
                send: 'Send',
                emoji: 'Emoji',
                file: 'File',
                'video-call': 'Video call',
                'voice-call': 'Voice call',
            },
            emojis: [
                '😀', '😁', '😂', '😃', '😄', '😅', '😆', '😇',
                '😈', '😉', '😊', '😋', '😌', '😍', '😎', '😏',
                '😐', '😑', '😒', '😓', '😔', '😕', '😖', '😗',
                '😘', '😙', '😚', '😛', '😜', '😝', '😞', '😟',
                '😠', '😡', '😢', '😣', '😤', '😥', '😦', '😧',
                '😨', '😩', '😪', '😫', '😬', '😭', '😮', '😯',
                '😰', '😱', '😲', '😳', '😴', '😵', '😶', '😷',
                '😸', '😹', '😺', '😻', '😼', '😽', '😾', '😿',
                '🙀', '🙁', '🙂', '🙃', '🙄', '🙅', '🙆', '🙇',
                '🙈', '🙉', '🙊', '🙋', '🙌', '🙍', '🙎', '🙏',
                '🚀', '🚁', '🚂', '🚃', '🚄', '🚅', '🚋', '🚌',
                '🚑', '🚓', '🚗', '🚙', '🚢', '🚲',

                '🤐', '🤑', '🤒', '🤓', '🤔', '🤕', '🤖', '🤗',
                '🤛', '🤜', '🤝', '🤟', '🤠', '🤡', '🤢', '🤣',
                '🤤', '🤥', '🤦', '🤧', '🤨', '🤩', '🤪', '🤫',
                '🤬', '🤭', '🤮', '🤯', '🥀', '🥇', '🥈', '🥉',
                '🥎', '🥤', '🦉', '🦊', '🦋', '🧐',

                '☕', '⚡', '⚽', '⚾', '✌', '✨',

                '🌂', '🌶', '🌷', '🌸', '🌹', '🌺', '🌻', '🌼',
                '🍄', '🍅', '🍆', '🍇', '🍈', '🍉', '🍊', '🍋',
                '🍌', '🍍', '🍎', '🍏', '🍐', '🍑', '🍒', '🍓',
                '🍔', '🍕', '🍖', '🍗', '🍚', '🍜', '🍝', '🍞',
                '🍟', '🍡', '🍢', '🍣', '🍤', '🍦', '🍩', '🍬',
                '🍭', '🍮', '🍰', '🍶', '🍷', '🍸', '🍹', '🍺',
                '🍻', '🍼', '🍾', '🍿', '🎀', '🎁', '🎂', '🎃',
                '🎄', '🎅', '🎆', '🎈', '🎉', '🎓', '🎖', '🎧',
                '🎩', '🎬', '🎮', '🎱', '🎲', '🎳', '🎵', '🎶',
                '🎷', '🎸', '🎹', '🎺', '🎻', '🎼', '🎽', '🎾',
                '🏀', '🏂', '🏃', '🏄', '🏅', '🏆', '🏇', '🏈',
                '🏉', '🏊', '🏋', '🏌', '🏍', '🏎', '🏏', '🏐',
                '🏓', '🏘', '🏠', '🏡',

                '🐣', '🐨', '🐭', '🐮', '🐯', '🐰', '🐱', '🐲',
                '🐳', '🐴', '🐵', '🐶', '🐷', '🐸', '🐹', '🐺',
                '🐻', '🐼', '🐽', '🐿', '👁', '👂', '👃', '👄',
                '👅', '👆', '👇', '👈', '👉', '👊', '👋', '👌',
                '👍', '👎', '👏', '👐', '👑', '👓', '👔', '👕',
                '👖', '👗', '👘', '👙', '👚', '👛', '👜', '👝',
                '👞', '👟', '👠', '👡', '👢', '👻', '👽', '👿',
                '💀', '💁', '💂', '💃', '💄', '💅', '💆', '💇',
                '💉', '💊', '💋', '💌', '💍', '💎', '💔', '💕',
                '💖', '💗', '💘', '💝', '💣', '💤', '💩', '💪',
                '💭', '💯', '💰',

                '🔥',
            ],
        };

    function Composer(name, config, logger) {
        EventDispatcher.call(this, 'Composer', { logger: logger }, MouseEvent);

        var _this = this,
            _config,
            _container,
            _tools,
            _input,
            _send,
            _counter,
            _file,
            _emoji,
            _drafts;

        function _init() {
            _drafts = {};
            _config = utils.extendz({}, _default, utils.typeOf(config) === 'object' ? config : {});
            _container = utils.createElement('div', CLASS_COMPOSER + (name ? ' ' + name : ''));
            _container.setAttribute('presentation', _config.presentation);
            _container.setAttribute('state', 'off');
            _tools = utils.createElement('div', 'im-composer-tools');
            _emoji = utils.createElement('div', 'im-composer-emoji');
            _file = utils.createElement('input');
            _file.type = 'file';
            _file.multiple = true;
            _file.hidden = true;
            _file.addEventListener('change', _onFile);

            var row = utils.createElement('div', 'im-composer-row');
            _input = utils.createElement('textarea');
            _input.rows = 1;
            _input.addEventListener('input', _onInput);
            _input.addEventListener('keydown', _onKeyDown);
            _send = _button('send', _config.labels.send);
            _send.classList.add('primary');
            _send.addEventListener('click', _onSend);
            row.appendChild(_input);
            row.appendChild(_send);
            _counter = utils.createElement('span', 'im-composer-counter');
            _container.appendChild(_tools);
            _container.appendChild(row);
            _container.appendChild(_counter);
            _container.appendChild(_file);
            _container.appendChild(_emoji);
            _this.update(_config);
        }

        function _button(action, label) {
            var button = utils.createElement('button', 'im-composer-tool ' + action);
            button.type = 'button';
            button.title = label;
            button.setAttribute('aria-label', label);
            button.setAttribute('data-action', action);
            button.textContent = label;
            return button;
        }

        function _buildTools() {
            utils.emptyElement(_tools);
            for (var i = 0; i < _config.tools.length; i++) {
                var action = _config.tools[i],
                    button = _button(action, _config.labels[action] || action);
                if (utils.indexOf(_config.miniTools, action) !== -1) {
                    button.classList.add('mini-visible');
                }
                button.addEventListener('click', _onTool);
                _tools.appendChild(button);
            }
            utils.emptyElement(_emoji);
            for (var j = 0; j < _config.emojis.length; j++) {
                var item = _button('emoji-value', _config.emojis[j]);
                item.classList.add('im-composer-emoji-item');
                item.setAttribute('data-value', _config.emojis[j]);
                item.addEventListener('click', _onEmoji);
                _emoji.appendChild(item);
            }
        }

        function _onInput() {
            _counter.textContent = _input.value.length + '/' + _config.maxlength;
        }

        function _onKeyDown(e) {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) {
                e.preventDefault();
                _onSend();
            }
        }

        function _onSend() {
            var value = utils.trim(_input.value);
            if (!value || _input.disabled) {
                return;
            }
            _this.dispatchEvent(MouseEvent.CLICK, {
                name: 'send',
                conversation: _config.conversation,
                text: value,
            });
        }

        function _onTool(e) {
            var action = e.currentTarget.getAttribute('data-action');
            if (action === 'emoji') {
                _emoji.setAttribute('state', _emoji.getAttribute('state') === 'on' ? 'off' : 'on');
            } else if (action === 'file') {
                _file.click();
            } else {
                _this.dispatchEvent(MouseEvent.CLICK, {
                    name: action,
                    conversation: _config.conversation,
                });
            }
        }

        function _onEmoji(e) {
            var emoji = e.currentTarget.getAttribute('data-value');
            if (_input.value.length + emoji.length > _config.maxlength) {
                return;
            }
            _input.value += emoji;
            _emoji.setAttribute('state', 'off');
            _onInput();
            _input.focus();
        }

        function _onFile() {
            if (_file.files && _file.files.length) {
                _this.dispatchEvent(MouseEvent.CLICK, {
                    name: 'file',
                    conversation: _config.conversation,
                    files: _file.files,
                });
            }
            _file.value = '';
        }

        _this.update = function (value) {
            _config = utils.extendz({}, _config, value || {});
            _input.maxLength = _config.maxlength;
            _input.placeholder = _config.placeholder;
            _send.textContent = _config.labels.send;
            _send.title = _config.labels.send;
            _send.setAttribute('aria-label', _config.labels.send);
            _container.setAttribute('presentation', _config.presentation);
            _buildTools();
            _this.state(_container.getAttribute('state'));
            _onInput();
            return _config;
        };

        _this.conversation = function (value) {
            if (value !== undefined && value !== _config.conversation) {
                _drafts[_config.conversation] = _input.value;
                _config.conversation = value;
                _input.value = _drafts[value] || '';
                _onInput();
            }
            return _config.conversation;
        };

        _this.clear = function (id) {
            delete _drafts[id];
            if (id === _config.conversation) {
                _input.value = '';
                _onInput();
            }
        };

        _this.presentation = function (value) {
            if (value !== undefined) {
                _config.presentation = value;
                _container.setAttribute('presentation', value);
            }
            return _container.getAttribute('presentation');
        };

        _this.state = function (value) {
            if (value !== undefined) {
                _container.setAttribute('state', value);
                _input.disabled = value === 'empty';

                var buttons = _container.querySelectorAll('button');
                for (var i = 0; i < buttons.length; i++) {
                    buttons[i].disabled = _input.disabled;
                }
            }
            return _container.getAttribute('state');
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function () {
        };

        _this.destroy = function () {
            _input.removeEventListener('input', _onInput);
            _input.removeEventListener('keydown', _onKeyDown);
            _file.removeEventListener('change', _onFile);
            var buttons = _container.querySelectorAll('button');
            for (var i = 0; i < buttons.length; i++) {
                buttons[i].removeEventListener('click', _onTool);
                buttons[i].removeEventListener('click', _onEmoji);
                buttons[i].removeEventListener('click', _onSend);
            }
            _container.innerHTML = '';
        };

        _init();
    }

    Composer.prototype = Object.create(EventDispatcher.prototype);
    Composer.prototype.constructor = Composer;
    Composer.prototype.kind = 'Composer';

    components.Composer = Composer;
})(odd);

