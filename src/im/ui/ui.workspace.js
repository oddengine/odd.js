(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        MouseEvent = events.MouseEvent,
        IM = odd.IM,
        UI = IM.UI,
        Sending = IM.CommandMessage.Sending,
        Casting = IM.CommandMessage.Casting,

        _default = {
            kind: 'Workspace',
            active: 'maya',
            maxMessageLength: 500,
            contacts: [],
            conversations: {},
            channels: {},
            miniComposer: {
                placeholder: '说点什么…',
                tools: ['emoji'],
            },
            visibility: true,
        };

    function Workspace(im, config, logger) {
        var _this = this,
            _im = im,
            _contacts,
            _friend,
            _channels,
            _online,
            _active;

        EventDispatcher.call(this, 'IMWorkspace', { logger: logger }, MouseEvent);

        function _init() {
            _this.config = config;
            _channels = {};
            _online = {};
            _active = config.active || (config.contacts[0] && config.contacts[0].id);
            _contacts = _buildContacts();
            _friend = _buildConversation('friend', _active, _messagesFor(_active), false);
        }

        function _buildContacts() {
            var panel = utils.createElement('section', 'im-workspace-contacts');
            panel.setAttribute('presentation', 'full');
            var search = utils.createElement('label', 'im-workspace-search'),
                input = utils.createElement('input');
            search.appendChild(_icon('search'));
            input.type = 'search';
            input.placeholder = '搜索好友和群';
            input.addEventListener('input', _onSearch);
            search.appendChild(input);
            panel.appendChild(search);

            var groups = _groups();
            for (var i = 0; i < groups.length; i++) {
                var group = utils.createElement('section', 'im-workspace-group'),
                    heading = utils.createElement('header'),
                    title = utils.createElement('strong'),
                    count = utils.createElement('span');
                title.textContent = groups[i];
                count.textContent = _count(groups[i]);
                heading.appendChild(title);
                heading.appendChild(count);
                group.appendChild(heading);
                for (var j = 0; j < config.contacts.length; j++) {
                    if (config.contacts[j].group === groups[i]) {
                        group.appendChild(_contact(config.contacts[j]));
                    }
                }
                panel.appendChild(group);
            }
            return panel;
        }

        function _groups() {
            var groups = [];
            for (var i = 0; i < config.contacts.length; i++) {
                var group = config.contacts[i].group || '好友';
                if (utils.indexOf(groups, group) === -1) {
                    groups.push(group);
                }
            }
            return groups;
        }

        function _count(group) {
            var count = 0;
            for (var i = 0; i < config.contacts.length; i++) {
                if ((config.contacts[i].group || '好友') === group) {
                    count++;
                }
            }
            return count;
        }

        function _contact(item) {
            var button = utils.createElement('button', 'im-workspace-contact' + (item.id === _active ? ' active' : ''));
            button.type = 'button';
            button.setAttribute('data-id', item.id);
            button.setAttribute('data-search', ((item.name || '') + ' ' + (item.status || '')).toLowerCase());
            button.appendChild(_avatar(item));
            var copy = utils.createElement('span', 'im-workspace-contact-copy'),
                line = utils.createElement('span', 'im-workspace-contact-line'),
                name = utils.createElement('strong'),
                time = utils.createElement('time'),
                status = utils.createElement('small');
            name.textContent = item.name;
            time.textContent = item.time || '';
            status.textContent = item.status || (item.online ? '在线' : '离线');
            line.appendChild(name);
            line.appendChild(time);
            copy.appendChild(line);
            copy.appendChild(status);
            button.appendChild(copy);
            if (item.unread) {
                var badge = utils.createElement('i', 'im-workspace-unread');
                badge.textContent = item.unread;
                button.appendChild(badge);
            }
            button.addEventListener('click', _onContact);
            return button;
        }

        function _onSearch(e) {
            var query = utils.trim(e.currentTarget.value).toLowerCase(),
                items = _contacts.querySelectorAll('.im-workspace-contact');
            for (var i = 0; i < items.length; i++) {
                items[i].hidden = query && items[i].getAttribute('data-search').indexOf(query) === -1;
            }
        }

        function _onContact(e) {
            _this.active(e.currentTarget.getAttribute('data-id'));
            _this.dispatchEvent(MouseEvent.CLICK, { name: 'contact', id: _active });
        }

        function _messagesFor(id) {
            return config.conversations[id] || [];
        }

        function _buildConversation(kind, id, messages, compact) {
            var contact = _findContact(id) || { id: id, name: id, online: true },
                panel = utils.createElement('section', 'im-workspace-conversation ' + kind);
            panel.setAttribute('presentation', compact ? 'mini' : 'full');
            panel.setAttribute('data-conversation', id);

            var header = utils.createElement('header', 'im-workspace-conversation-head');
            header.appendChild(_avatar(contact));
            var copy = utils.createElement('span'),
                name = utils.createElement('strong'),
                state = utils.createElement('small');
            name.textContent = contact.name || id;
            state.textContent = contact.online === false ? '离线' : (kind === 'friend' ? '在线 · 端到端实时消息' : '实时频道');
            copy.appendChild(name);
            copy.appendChild(state);
            header.appendChild(copy);
            panel.appendChild(header);

            var list = utils.createElement('div', 'im-workspace-message-list');
            for (var i = 0; i < messages.length; i++) {
                _appendMessage(list, messages[i]);
            }
            panel.appendChild(list);
            panel.appendChild(_composer(kind, id, list, compact));
            return panel;
        }

        function _composer(kind, id, list, compact) {
            var composer = utils.createElement('div', 'im-workspace-composer' + (compact ? ' compact' : '')),
                tools = utils.createElement('div', 'im-workspace-tools'),
                file = utils.createElement('input'),
                emoji = utils.createElement('div', 'im-workspace-emoji'),
                row = utils.createElement('div', 'im-workspace-compose-row'),
                input = utils.createElement('textarea'),
                counter = utils.createElement('span', 'im-workspace-counter');

            tools.appendChild(_composerTool('emoji', 'smile', '表情'));
            tools.appendChild(_composerTool('file', 'file', '文件'));
            tools.appendChild(_composerTool('video-call', 'video', '视频通话'));
            tools.appendChild(_composerTool('voice-call', 'phone', '语音通话'));
            input.rows = 1;
            input.maxLength = config.maxMessageLength;
            var fullPlaceholder = kind === 'friend' ? '发送消息…' : '在实时频道中发言…';
            input.setAttribute('data-full-placeholder', fullPlaceholder);
            input.placeholder = compact ? _miniComposer().placeholder : fullPlaceholder;
            counter.textContent = '0/' + config.maxMessageLength;
            file.type = 'file';
            file.multiple = true;
            file.hidden = true;
            file.addEventListener('change', function () {
                if (file.files && file.files.length) {
                    _this.dispatchEvent(MouseEvent.CLICK, {
                        name: 'file',
                        conversation: id,
                        files: file.files,
                    });
                }
                file.value = '';
            });

            var emojis = ['😀', '😂', '😍', '👍', '🎮', '🔥', '🎉', '❤️'];
            for (var i = 0; i < emojis.length; i++) {
                var emojiButton = utils.createElement('button', 'im-workspace-emoji-item');
                emojiButton.type = 'button';
                emojiButton.textContent = emojis[i];
                emojiButton.setAttribute('data-value', emojis[i]);
                emojiButton.addEventListener('click', function (e) {
                    input.value += e.currentTarget.getAttribute('data-value');
                    counter.textContent = input.value.length + '/' + config.maxMessageLength;
                    emoji.classList.remove('open');
                    input.focus();
                });
                emoji.appendChild(emojiButton);
            }

            var send = _tool('send', 'send', '发送');
            send.classList.add('primary');
            row.appendChild(input);
            row.appendChild(send);
            composer.appendChild(tools);
            composer.appendChild(row);
            composer.appendChild(counter);
            composer.appendChild(file);
            composer.appendChild(emoji);

            tools.addEventListener('click', function (e) {
                var button = _closestButton(e.target),
                    action = button && button.getAttribute('data-action');
                if (!action) {
                    return;
                }
                if (action === 'emoji') {
                    emoji.classList.toggle('open');
                } else if (action === 'file') {
                    file.click();
                } else {
                    _this.dispatchEvent(MouseEvent.CLICK, {
                        name: action,
                        conversation: id,
                    });
                }
            });
            send.addEventListener('click', function () {
                _send(kind, id, input, counter, list);
            });
            input.addEventListener('input', function () {
                counter.textContent = input.value.length + '/' + config.maxMessageLength;
            });
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    _send(kind, id, input, counter, list);
                }
            });
            return composer;
        }

        function _composerTool(action, icon, label) {
            var button = _tool(action, icon, label);
            if (utils.indexOf(_miniComposer().tools, action) !== -1) {
                button.classList.add('mini-visible');
            }
            return button;
        }

        function _miniComposer() {
            var options = config.miniComposer || {};
            return {
                placeholder: options.placeholder || _default.miniComposer.placeholder,
                tools: utils.typeOf(options.tools) === 'array' ? options.tools : _default.miniComposer.tools,
            };
        }

        function _conversationPresentation(panel, presentation) {
            presentation = presentation || panel.getAttribute('presentation') || 'full';
            panel.setAttribute('presentation', presentation);
            var input = panel.querySelector('.im-workspace-compose-row textarea');
            if (input) {
                input.placeholder = presentation === 'mini'
                    ? _miniComposer().placeholder
                    : input.getAttribute('data-full-placeholder');
            }
            return panel;
        }

        function _closestButton(node) {
            while (node && node.tagName !== 'BUTTON') {
                node = node.parentNode;
            }
            return node;
        }

        function _send(kind, id, input, counter, list) {
            var text = utils.trim(input.value);
            if (!text) {
                return;
            }
            _appendMessage(list, {
                from: '我',
                text: text,
                time: '现在',
                mine: true,
            });
            input.value = '';
            counter.textContent = '0/' + config.maxMessageLength;
            _this.dispatchEvent(MouseEvent.CLICK, {
                name: 'send',
                conversation: id,
                text: text,
            });
            if (_im.connected && _im.connected()) {
                _im.send(Sending.TEXT, kind === 'friend' ? Casting.UNI : Casting.MULTI, id, text).catch(function (err) {
                    logger.warn('Failed to send IM message: ' + (err.message || err));
                });
            }
        }

        function _appendMessage(list, message) {
            var item = utils.createElement('article', 'im-workspace-message' + (message.mine ? ' mine' : ''));
            if (!message.mine) {
                item.appendChild(_avatar({ name: message.from || '?', online: true }));
            }
            var bubble = utils.createElement('div', 'im-workspace-bubble'),
                meta = utils.createElement('header'),
                from = utils.createElement('strong'),
                time = utils.createElement('time'),
                text = utils.createElement('p');
            from.textContent = message.from || '';
            time.textContent = message.time || '现在';
            text.textContent = message.text || '';
            meta.appendChild(from);
            meta.appendChild(time);
            bubble.appendChild(meta);
            bubble.appendChild(text);
            item.appendChild(bubble);
            list.appendChild(item);
            list.scrollTop = list.scrollHeight;
        }

        function _tool(action, icon, label) {
            var button = utils.createElement('button', 'im-workspace-tool ' + action);
            button.type = 'button';
            button.title = label;
            button.setAttribute('aria-label', label);
            button.setAttribute('data-action', action);
            button.appendChild(_icon(icon));
            return button;
        }

        function _icon(name) {
            var icon = utils.createElement('span', 'im-workspace-icon im-workspace-icon-' + name);
            icon.setAttribute('aria-hidden', 'true');
            return icon;
        }

        function _avatar(item) {
            var avatar = utils.createElement('span', 'im-workspace-avatar');
            if (item.avatar) {
                var image = utils.createElement('img', 'im-workspace-avatar-image');
                image.src = item.avatar;
                image.alt = '';
                avatar.appendChild(image);
                avatar.classList.add('has-image');
            } else {
                avatar.textContent = _initials(item.name || item.id);
            }
            if (item.online !== false) {
                avatar.appendChild(utils.createElement('i'));
            }
            return avatar;
        }

        function _initials(name) {
            var parts = String(name || '?').split(/\s+/),
                result = parts[0].charAt(0);
            if (parts.length > 1) {
                result += parts[parts.length - 1].charAt(0);
            } else if (/^[\x00-\x7F]+$/.test(name) && name.length > 1) {
                result += name.charAt(1);
            }
            return result.toUpperCase();
        }

        function _findContact(id) {
            for (var i = 0; i < config.contacts.length; i++) {
                if (config.contacts[i].id === id) {
                    return config.contacts[i];
                }
            }
            return null;
        }

        _this.active = function (id) {
            if (id !== undefined && _findContact(id)) {
                _active = id;
                var buttons = _contacts.querySelectorAll('.im-workspace-contact');
                for (var i = 0; i < buttons.length; i++) {
                    buttons[i].classList.toggle('active', buttons[i].getAttribute('data-id') === id);
                }
                var next = _buildConversation('friend', id, _messagesFor(id), _friend.getAttribute('presentation') === 'mini');
                if (_friend.parentNode) {
                    _friend.parentNode.replaceChild(next, _friend);
                }
                _friend = next;
            }
            return _active;
        };

        _this.contactsElement = function (presentation) {
            _contacts.setAttribute('presentation', presentation || _contacts.getAttribute('presentation') || 'full');
            return _contacts;
        };

        _this.friendElement = function (presentation) {
            return _conversationPresentation(_friend, presentation);
        };

        _this.channelElement = function (name, presentation) {
            if (!_channels[name]) {
                var messages = config.channels[name] || config.channels.default || [];
                _channels[name] = _buildConversation('channel', name, messages, true);
            }
            return _conversationPresentation(_channels[name], presentation || 'mini');
        };

        _this.onlineElement = function (name, items, label) {
            if (!_online[name]) {
                var panel = utils.createElement('section', 'im-workspace-online'),
                    header = utils.createElement('header'),
                    title = utils.createElement('strong'),
                    count = utils.createElement('span');
                title.textContent = label || '在线列表';
                count.textContent = (items || []).length + ' 人';
                header.appendChild(title);
                header.appendChild(count);
                panel.appendChild(header);
                for (var i = 0; i < (items || []).length; i++) {
                    panel.appendChild(_contact(items[i]));
                }
                _online[name] = panel;
            }
            return _online[name];
        };

        _this.element = function () {
            var root = utils.createElement('div', 'im-workspace');
            root.appendChild(_contacts);
            root.appendChild(_friend);
            return root;
        };

        _this.resize = function () {
        };

        _init();
    }

    Workspace.prototype = Object.create(EventDispatcher.prototype);
    Workspace.prototype.constructor = Workspace;
    Workspace.prototype.kind = 'Workspace';
    Workspace.prototype.CONF = _default;

    UI.register(Workspace);
})(odd);
