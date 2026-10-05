(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        UIEvent = events.UIEvent,
        AppEvent = events.AppEvent,
        App = odd.App,
        State = App.State,

        CLASS_WRAPPER = 'app-wrapper',

        _id = 0,
        _instances = {},
        _media = {
            play: 'player',
            game: 'game',
            meeting: 'meeting',
        },
        _default = {
            section: 'messages',
            skin: 'classic',
            labels: {
                media: 'Back to media',
                play: 'Back to watching',
                game: 'Back to game',
                meeting: 'Back to meeting',
            },
            modules: {
                im: {
                    labels: {
                        play: 'Watch',
                        game: 'Game',
                        meeting: 'Meeting',
                    },
                    plugins: [{
                        kind: 'Contacts',
                        visibility: true,
                    }, {
                        kind: 'Conversations',
                        visibility: true,
                    }, {
                        kind: 'Conversation',
                        visibility: true,
                    }, {
                        kind: 'Dashboard',
                        visibility: false,
                    }],
                },
                player: {
                    autoplay: false,
                    plugins: [{
                        kind: 'Chat',
                        visibility: false,
                    }],
                },
                game: {},
                meeting: {},
            },
        };

    function UI(id, logger) {
        var _this = this,
            _logger = logger instanceof utils.Logger ? logger : new utils.Logger(id, logger),
            _container,
            _wrapper,
            _main,
            _aside,
            _popup,
            _context,
            _return,
            _pages,
            _app,
            _modules,
            _activeMedia,
            _readyState;

        EventDispatcher.call(this, 'AppUI', { id: id, logger: _logger }, Event, UIEvent, AppEvent);

        function _init() {
            _this.logger = _logger;
            _modules = {};
            _pages = {};
            _activeMedia = '';
            _readyState = State.INITIALIZED;
        }

        _this.id = function () {
            return id;
        };

        _this.setup = async function (container, config) {
            if (_readyState !== State.INITIALIZED) {
                _logger.error('App UI cannot be setup more than once: id=' + id + '.');
                return;
            }

            _readyState = State.CONNECTING;

            _container = container;
            _app = App.get(id, _logger);
            _app.addEventListener(AppEvent.SECTION_CHANGE, _onSectionChange);
            _app.addEventListener(AppEvent.SKIN_CHANGE, _onSkinChange);
            await _app.setup(utils.extendz({}, _default, config || {}));
            if (_readyState !== State.CONNECTING) {
                return;
            }
            _this.config = _app.config;

            _wrapper = utils.createElement('div', CLASS_WRAPPER + ' app-ui-' + _app.skin());
            _wrapper.setAttribute('section', _app.section());
            _wrapper.setAttribute('mode', 'im');
            _wrapper.setAttribute('sidebar', 'off');
            _main = utils.createElement('main', 'app-main');
            _aside = utils.createElement('aside', 'app-aside');
            _popup = utils.createElement('div', 'app-popup');
            _context = utils.createElement('div', 'app-context im-ui-' + _app.skin());
            _return = utils.createElement('button', 'app-return');
            _return.type = 'button';
            _return.textContent = _this.config.labels.media;
            _return.addEventListener('click', _onReturnClick);
            _aside.appendChild(_popup);
            _aside.appendChild(_return);
            _aside.appendChild(_context);
            _wrapper.appendChild(_main);
            _wrapper.appendChild(_aside);
            _container.appendChild(_wrapper);

            try {
                await _setupModules();
                if (_readyState !== State.CONNECTING) {
                    return;
                }
                _readyState = State.READY;
                _modules.im.active(_app.section());
                _render();
            } catch (err) {
                _this.destroy(err.message);
                throw err;
            }

            if (_readyState !== State.READY) {
                return;
            }
            window.addEventListener('resize', _this.resize);
            _this.dispatchEvent(Event.READY);
            return Promise.resolve();
        };

        async function _setupModules() {
            var config = _this.config.modules;

            _modules.im = odd.im.ui.create(_logger);
            _modules.im.addEventListener(Event.CHANGE, _onIMChange);
            _modules.im.addGlobalListener(_this.forward);
            _app.module('im', _modules.im);
            await _modules.im.setup(_main, utils.extendz({}, config.im, { skin: _app.skin() }));
            if (_readyState !== State.CONNECTING) {
                return;
            }

            utils.forEach(_media, function (section) {
                _pages[section] = utils.createElement('div', 'app-page app-' + section);
                _modules.im.insert(section, _pages[section]);
            });

            _modules.meeting = odd.rtc.ui.create(_logger);
            _modules.meeting.addGlobalListener(_this.forward);
            _app.module('meeting', _modules.meeting);
            await _modules.meeting.setup(_pages.meeting, utils.extendz({}, config.meeting, { skin: _app.skin() }));
            if (_readyState !== State.CONNECTING) {
                return;
            }

            _modules.player = odd.player.ui.create(_logger);
            _modules.player.addGlobalListener(_this.forward);
            _app.module('player', _modules.player);
            await _modules.player.setup(_pages.play, utils.extendz({}, config.player, { skin: _app.skin() }));
            if (_readyState !== State.CONNECTING) {
                return;
            }

            _modules.game = odd.famicom.ui.create(_logger);
            _modules.game.addGlobalListener(_this.forward);
            _app.module('game', _modules.game);
            await _modules.game.setup(_pages.game, utils.extendz({}, config.game, { skin: _app.skin() }));
        }

        function _onIMChange(e) {
            if (_readyState === State.READY && e.data.name === 'nav' && utils.indexOf(App.sections(), e.data.value) !== -1) {
                _app.section(e.data.value);
            }
        }

        function _onSectionChange(e) {
            if (_readyState === State.READY) {
                if (_modules.im.active() !== e.data.value) {
                    _modules.im.active(e.data.value);
                }
                _render();
            }
            _this.forward(e);
        }

        function _onSkinChange(e) {
            if (_wrapper) {
                _wrapper.className = CLASS_WRAPPER + ' app-ui-' + e.data.value;
                _context.className = 'app-context im-ui-' + e.data.value;
                utils.forEach(_modules, function (_, module) {
                    module.skin(e.data.value);
                });
            }
            _this.forward(e);
        }

        function _onReturnClick() {
            if (_activeMedia) {
                _app.section(_activeMedia);
            }
        }

        function _render() {
            var section = _app.section(),
                module = _media[section];
            _wrapper.setAttribute('section', section);

            if (module) {
                if (_activeMedia && _activeMedia !== section) {
                    _modules[_media[_activeMedia]].presentation(_pages[_activeMedia], 'full');
                }
                _activeMedia = section;
                _modules[module].presentation(_pages[section], 'full');
                _wrapper.setAttribute('mode', 'media');
                _wrapper.setAttribute('sidebar', _modules.im.plugins['Conversation'] ? 'on' : 'off');
                if (_modules.im.plugins['Conversation']) {
                    _modules.im.attachPlugin('Conversation', _context, 'mini');
                }
            } else {
                _wrapper.setAttribute('mode', 'im');
                if (_modules.im.plugins['Conversation']) {
                    _modules.im.restorePlugin('Conversation', 'full');
                }
                if (_activeMedia) {
                    _modules[_media[_activeMedia]].presentation(_popup, 'popup');
                    _return.textContent = _this.config.labels[_activeMedia] || _this.config.labels.media;
                    _wrapper.setAttribute('sidebar', 'on');
                } else {
                    _wrapper.setAttribute('sidebar', 'off');
                }
            }
            _this.resize();
        }

        _this.section = function (value) {
            return _app.section(value);
        };

        _this.skin = function (value) {
            return _app.skin(value);
        };

        _this.module = function (name) {
            return _modules[name];
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function () {
            if (_readyState !== State.READY) {
                return;
            }

            utils.forEach(_modules, function (_, module) {
                module.resize();
            });
            _this.dispatchEvent(UIEvent.RESIZE, {
                width: _wrapper.clientWidth,
                height: _wrapper.clientHeight,
            });
        };

        _this.destroy = function (reason) {
            switch (_readyState) {
                case State.INITIALIZED:
                case State.CONNECTING:
                case State.READY:
                    _readyState = State.CLOSING;
                    window.removeEventListener('resize', _this.resize);

                    if (_modules.im) {
                        _modules.im.removeEventListener(Event.CHANGE, _onIMChange);
                    }
                    utils.forEach(_modules, function (_, module) {
                        module.removeGlobalListener(_this.forward);
                        module.destroy(reason);
                    });
                    _modules = {};

                    if (_app) {
                        _app.removeEventListener(AppEvent.SECTION_CHANGE, _onSectionChange);
                        _app.removeEventListener(AppEvent.SKIN_CHANGE, _onSkinChange);
                        _app.destroy(reason);
                    }
                    if (_return) {
                        _return.removeEventListener('click', _onReturnClick);
                    }
                    if (_wrapper && _wrapper.parentNode) {
                        _wrapper.parentNode.removeChild(_wrapper);
                    }
                    delete _instances[id];
                    _readyState = State.CLOSED;
                    break;
            }
        };

        _init();
    }

    UI.prototype = Object.create(EventDispatcher.prototype);
    UI.prototype.constructor = UI;
    UI.prototype.CONF = _default;

    UI.get = function (id, logger) {
        if (id == null) {
            id = 0;
        }
        var ui = _instances[id];
        if (ui === undefined) {
            ui = new UI(id, logger);
            _instances[id] = ui;
        }
        return ui;
    };

    UI.create = function (logger) {
        return UI.get(_id++, logger);
    };

    odd.app.ui = UI.get;
    odd.app.ui.create = UI.create;
    App.UI = UI;
})(odd);

