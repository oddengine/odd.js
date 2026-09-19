(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,

        MouseEvent = events.MouseEvent,

        IM = odd.IM,
        UI = IM.UI,
        components = UI.components,
        IMEvent = IM.Event,

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
                placeholder: '发送消息…',
                tools: ['emoji', 'file', 'video-call', 'voice-call'],
                miniTools: ['emoji'],
            },
            visibility: true,
        };

    function Conversation(im, config, logger) {
        EventDispatcher.call(this, 'Conversation', { logger: logger }, MouseEvent);

        var _this = this,
            _container;

        function _init() {
            _this.config = config;
            _this.components = {};
            _container = utils.createElement('div', CLASS_CONVERSATION);
            _buildComponents();
            var composer = _this.components['composer'];
            if (composer) {
                composer.update(config.composer);
            }
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
            if (e.type === MouseEvent.CLICK && e.data.name === 'send') {
                _send(e.data.text);
            }
            _this.forward(e);
        }

        function _onMessage(e) {
            var data = e.data,
                id = data.target.type === 'user' ?
                    (data.sender.id === im.userId() ? data.target.id : data.sender.id) : data.target.id,
                messages = _this.components['messages'];
            if (id === _this.config.active && messages) {
                messages.append({
                    from: data.sender.id,
                    text: typeof data.content === 'string' ? data.content : '[二进制消息]',
                    time: new Date().toLocaleTimeString(),
                    align: data.sender.id === im.userId() ? 'right' : 'left',
                });
            }
        }

        function _send(text) {
            if (!_this.config.active) {
                return;
            }
            var contact = _findContact(_this.config.active),
                type = contact && contact.type === 'group' ? 'group' :
                    contact && contact.type === 'channel' ? 'room' : 'user';
            im.send({ type: type, id: _this.config.active }, text).catch(function (err) {
                logger.warn('Failed to send IM message: ' + (err.message || err));
            });
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
            if (value !== undefined) {
                _this.config.active = value;
                if (contact) {
                    var found = _findContact(value);
                    if (!found) {
                        _this.config.contacts.push(contact);
                    }
                }
                var messages = _this.components['messages'],
                    composer = _this.components['composer'];
                if (messages) {
                    messages.update(_this.config.conversations[value] || []);
                }
                if (composer) {
                    composer.conversation(value);
                }
                _container.setAttribute('data-conversation', value || '');
            }
            return _this.config.active;
        };

        _this.presentation = function (value) {
            var composer = _this.components['composer'];
            return composer ? composer.presentation(value) : value;
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
            im.removeEventListener(IMEvent.MESSAGE, _onMessage);

            utils.forEach(_this.components, function (_, component) {
                component.removeGlobalListener(_onComponentEvent);
                component.destroy();
            });
            _this.components = {};
        };

        _init();
    }

    Conversation.prototype = Object.create(EventDispatcher.prototype);
    Conversation.prototype.constructor = Conversation;
    Conversation.prototype.kind = 'Conversation';
    Conversation.prototype.CONF = _default;

    UI.register(Conversation);
})(odd);

