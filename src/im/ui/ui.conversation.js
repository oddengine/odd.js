(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,

        Event = events.Event,
        MouseEvent = events.MouseEvent,
        IMEvent = events.IMEvent,

        IM = odd.IM,
        UI = IM.UI,
        components = UI.components,
        MessageState = components.Message.State,

        State = {
            INITIALIZED: 'initialized',
            READY: 'ready',
            CLOSING: 'closing',
            CLOSED: 'closed',
        },

        CLASS_CONVERSATION = 'im-conversation',

        _regi = /\[([a-z]+)\:([a-z]+)=([^\]]+)?\]/gi,
        _default = {
            kind: 'Conversation',
            tab: 'messages',
            layout: '[Messages:messages=][Composer:composer=]',
            active: '',
            contacts: [],
            conversations: {},
            composer: {
                maxlength: 500,
                placeholder: 'Send a message...',
                tools: ['emoji', 'file', 'video-call', 'voice-call'],
                miniTools: ['emoji'],
            },
            visibility: true,
        };

    function Conversation(im, config, logger) {
        EventDispatcher.call(this, 'Conversation', { logger: logger }, Event, MouseEvent);

        var _this = this,
            _container,
            _title,
            _readyState;

        function _init() {
            _this.config = config;
            _this.components = {};
            _readyState = State.INITIALIZED;

            _container = utils.createElement('div', CLASS_CONVERSATION);
            _title = utils.createElement('header', 'im-conversation-title');
            _container.appendChild(_title);

            _buildComponents();
            var composer = _this.components['composer'];
            if (composer) {
                composer.update(config.composer);
            }
            _readyState = State.READY;
            _this.active(config.active || (config.contacts[0] && config.contacts[0].id) || '');
            im.addEventListener(IMEvent.MESSAGE, _onMessage);
        }

        function _buildComponents() {
            var arr;
            while ((arr = _regi.exec(_this.config.layout)) !== null) {
                var component = new components[arr[1]](arr[2], arr[3], logger);
                component.addGlobalListener(_onComponentEvent);
                _container.appendChild(component.element());
                _this.components[arr[2]] = component;
            }
        }

        function _onComponentEvent(e) {
            if (_readyState === State.CLOSING || _readyState === State.CLOSED) {
                return;
            }

            if (e.type === MouseEvent.CLICK && e.data.name === 'send') {
                _send(e.data.text);
            }
            _this.forward(e);
        }

        function _onMessage(e) {
            if (_readyState === State.CLOSING || _readyState === State.CLOSED) {
                return;
            }

            var data = e.data,
                id = data.target.type === 'user' || data.target.type === 'endpoint' ?
                    (data.sender.id === im.userId() ? data.target.id : data.sender.id) : data.target.id,
                contact = _findContact(data.sender.id),
                history = _this.config.conversations[id] || [],
                clientMessageId = data.ext && data.ext.clientMessageId;
            if (data.sender.id === im.userId() && clientMessageId) {
                for (var i = 0; i < history.length; i++) {
                    if (history[i].id === clientMessageId) {
                        // The request result determines the local message state.
                        return;
                    }
                }
            }

            _append(id, {
                from: contact ? contact.name : data.sender.id,
                avatar: contact && contact.avatar,
                state: MessageState.SENT,
                text: typeof data.content === 'string' ? data.content : '[Binary]',
                time: new Date().toLocaleTimeString(),
                align: data.sender.id === im.userId() ? 'right' : 'left',
            });
        }

        function _append(id, message) {
            var history = _this.config.conversations[id];
            if (!history) {
                history = [];
                _this.config.conversations[id] = history;
            }
            history.push(message);

            var messages = _this.components['messages'];
            if (id === _this.config.active && messages) {
                messages.append(message);
            }
        }

        async function _send(text) {
            var id = _this.config.active,
                composer = _this.components['composer'];
            if (_readyState !== State.READY || !id) {
                logger.warn('Cannot send IM message without an available conversation.');
                return;
            }

            var user = im.config.user || {},
                message = {
                    id: utils.guid(),
                    from: user.name || im.userId() || user.id,
                    avatar: user.avatar,
                    text: text,
                    time: new Date().toLocaleTimeString(),
                    align: 'right',
                    state: im.connected() ? MessageState.SENDING : MessageState.FAILED,
                };
            _append(id, message);
            if (composer) {
                composer.clear(id);
            }
            if (message.state === MessageState.FAILED) {
                logger.warn('Cannot send IM message while disconnected: target=' + id + '.');
                return;
            }

            var contact = _findContact(id),
                type = contact && contact.type === 'group' ? 'group' :
                    contact && contact.type === 'channel' ? 'room' : 'user',
                Protocol = IM.Protocol;
            try {
                await im.send({ type: type, id: id }, text, {
                    ext: [{
                        key: 'clientMessageId',
                        type: Protocol.Type.STRING,
                        value: message.id,
                    }],
                });
                if (_readyState !== State.READY) {
                    return;
                }
                _update(id, message, MessageState.SENT);
            } catch (err) {
                if (_readyState !== State.READY) {
                    return;
                }
                _update(id, message, MessageState.FAILED);
                logger.error('Failed to send IM message: target=' + id + ', error=' + err.message);
                _this.dispatchEvent(Event.ERROR, { name: err.name, message: err.message });
            }
        }

        function _update(id, message, state) {
            message.state = state;

            var messages = _this.components['messages'];
            if (id === _this.config.active && messages) {
                var history = _this.config.conversations[id];
                messages.update(message, utils.indexOf(history, message));
            }
        }

        function _findContact(id) {
            for (var i = 0; i < config.contacts.length; i++) {
                if (config.contacts[i].id === id) {
                    return config.contacts[i];
                }
            }
            return null;
        }

        _this.active = function (value, contact) {
            if (_readyState === State.CLOSING || _readyState === State.CLOSED) {
                return _this.config.active;
            }
            if (value !== undefined) {
                _this.config.active = value;
                if (contact) {
                    var found = _findContact(value);
                    if (!found) {
                        _this.config.contacts.push(contact);
                    }
                }
                contact = contact || _findContact(value);
                _title.textContent = contact ? contact.name || contact.id : value || '';

                var messages = _this.components['messages'],
                    composer = _this.components['composer'];
                if (messages) {
                    messages.update(_this.config.conversations[value] || []);
                }
                if (composer) {
                    composer.conversation(value);
                    composer.state(value ? 'off' : 'empty');
                }
                _container.setAttribute('data-conversation', value || '');
            }
            return _this.config.active;
        };

        _this.presentation = function (value) {
            var composer = _this.components['composer'];
            return composer ? composer.presentation(value) : value;
        };

        _this.state = function () {
            return _readyState;
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {
            utils.forEach(_this.components, function (_, component) {
                component.resize(width, height);
            });
        };

        _this.destroy = function () {
            switch (_readyState) {
                case State.INITIALIZED:
                case State.READY:
                    _readyState = State.CLOSING;

                    im.removeEventListener(IMEvent.MESSAGE, _onMessage);

                    utils.forEach(_this.components, function (_, component) {
                        component.removeGlobalListener(_onComponentEvent);
                        component.destroy();
                    });
                    _this.components = {};
                    _readyState = State.CLOSED;
                    break;
            }
        };

        _init();
    }

    Conversation.prototype = Object.create(EventDispatcher.prototype);
    Conversation.prototype.constructor = Conversation;
    Conversation.prototype.kind = 'Conversation';
    Conversation.prototype.CONF = _default;

    Conversation.State = State;

    UI.register(Conversation);
})(odd);

