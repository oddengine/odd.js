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
            placeholder: '输入消息…',
            presentation: 'full',
            tools: ['emoji', 'file', 'video-call', 'voice-call'],
            miniTools: ['emoji'],
            labels: {
                send: '发送',
                'voice-message': '语音消息（暂未开放）',
                emoji: '表情',
                file: '文件',
                'video-call': '视频通话',
                'voice-call': '语音通话',
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

    var _icons = {
        send: ['M12 20V4', 'M5 11l7-7 7 7'],
        'voice-message': ['M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5', 'M5 10v2a7 7 0 0 0 14 0v-2', 'M12 19v3'],
        emoji: ['M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0', 'M8 14c1.5 3 6.5 3 8 0', 'M8 9h.01M16 9h.01'],
        file: ['M8 12l6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l8-8', 'M6 14l8-8'],
        'video-call': ['M4 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2', 'M16 10l6-4v12l-6-4'],
        'voice-call': ['M5 3h3l2 5-3 2c2 4 3 5 7 7l2-3 5 2v3c0 2-2 3-4 2C10 19 5 14 3 7c-1-2 0-4 2-4'],
    };

    function Composer(name, config, logger) {
        EventDispatcher.call(this, 'Composer', { logger: logger }, MouseEvent);

        var _this = this,
            _config,
            _container,
            _tools,
            _input,
            _send,
            _voice,
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
            var footer = utils.createElement('div', 'im-composer-footer');
            var actions = utils.createElement('div', 'im-composer-actions');
            _input = utils.createElement('textarea');
            _input.rows = 1;
            _input.addEventListener('input', _onInput);
            _input.addEventListener('keydown', _onKeyDown);
            _send = _button('send', _config.labels.send);
            _send.classList.add('primary', 'mini-visible');
            _send.addEventListener('click', _onSend);
            // Reserved voice-message entry. Recording and transport are not connected yet.
            _voice = _button('voice-message', _config.labels['voice-message']);
            _voice.classList.add('mini-visible');
            _voice.disabled = true;
            row.appendChild(_input);
            actions.appendChild(_voice);
            actions.appendChild(_send);
            footer.appendChild(_tools);
            footer.appendChild(actions);
            _counter = utils.createElement('span', 'im-composer-counter');
            _container.appendChild(row);
            _container.appendChild(_counter);
            _container.appendChild(footer);
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
            if (Object.prototype.hasOwnProperty.call(_icons, action)) {
                var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('width', '20');
                svg.setAttribute('height', '20');
                svg.setAttribute('fill', 'none');
                svg.setAttribute('stroke', 'currentColor');
                svg.setAttribute('stroke-width', '1.8');
                svg.setAttribute('stroke-linecap', 'round');
                svg.setAttribute('stroke-linejoin', 'round');
                svg.setAttribute('aria-hidden', 'true');
                svg.setAttribute('focusable', 'false');
                _icons[action].forEach(function (value) {
                    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('d', value);
                    svg.appendChild(path);
                });
                button.appendChild(svg);
            } else {
                button.textContent = label;
            }
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

        function _fitInput() {
            _input.style.height = 'auto';
            _input.style.height = Math.min(Math.max(_input.scrollHeight, 56), 112) + 'px';
        }

        function _onInput() {
            _counter.textContent = _input.value.length + '/' + _config.maxlength;
            _counter.hidden = !_input.value.length;
            _fitInput();
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
            _input.setAttribute('aria-label', _config.placeholder);
            _send.title = _config.labels.send;
            _send.setAttribute('aria-label', _config.labels.send);
            _voice.title = _config.labels['voice-message'];
            _voice.setAttribute('aria-label', _config.labels['voice-message']);
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
                    buttons[i].disabled = _input.disabled || buttons[i] === _voice;
                }
            }
            return _container.getAttribute('state');
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function () {
            _fitInput();
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

