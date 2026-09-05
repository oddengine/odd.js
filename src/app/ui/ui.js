(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        UIEvent = events.UIEvent,
        AppEvent = events.AppEvent,
        App = odd.App,

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
            modules: {
                im: {
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
            _depot,
            _pages,
            _app,
            _modules,
            _activeMedia;

        EventDispatcher.call(this, 'AppUI', { id: id, logger: _logger }, Event, UIEvent, AppEvent);

        function _init() {
            _this.logger = _logger;
            _modules = {};
            _pages = {};
            _activeMedia = '';
        }

        _this.id = function () {
            return id;
        };

        _this.setup = async function (container, config) {
            _container = container;
            _app = App.get(id, _logger);
            _app.addEventListener(AppEvent.SECTION_CHANGE, _onSectionChange);
            _app.addEventListener(AppEvent.SKIN_CHANGE, _onSkinChange);
            await _app.setup(utils.extendz({}, _default, config || {}));
            _this.config = _app.config;

            _wrapper = utils.createElement('div', CLASS_WRAPPER + ' app-ui-' + _app.skin());
            _wrapper.setAttribute('section', _app.section());
            _wrapper.setAttribute('mode', 'im');
            _wrapper.setAttribute('sidebar', 'off');
            _main = utils.createElement('main', 'app-main');
            _aside = utils.createElement('aside', 'app-aside');
            _popup = utils.createElement('div', 'app-popup');
            _context = utils.createElement('div', 'app-context im-ui-classic');
            _depot = utils.createElement('div', 'app-depot');
            _depot.hidden = true;
            _aside.appendChild(_popup);
            _aside.appendChild(_context);
            _wrapper.appendChild(_main);
            _wrapper.appendChild(_aside);
            _wrapper.appendChild(_depot);
            _container.appendChild(_wrapper);

            await _setupModules();
            _modules.im.active(_app.section());
            _render();
            window.addEventListener('resize', _this.resize);
            _this.dispatchEvent(Event.READY);
            return Promise.resolve();
        };

        async function _setupModules() {
            var config = _this.config.modules;

            _modules.im = odd.im.ui.create(_logger);
            await _modules.im.setup(_main, config.im);
            _modules.im.addEventListener(Event.CHANGE, _onIMChange);

            utils.forEach(_media, function (section) {
                _pages[section] = utils.createElement('div', 'app-page app-' + section);
                _modules.im.insert(section, _pages[section]);
            });

            _modules.player = odd.player.ui.create(_logger);
            await _modules.player.setup(_depot, config.player);
            _modules.player.presentation(_pages.play, 'full');

            _modules.game = odd.famicom.ui.create(_logger);
            await _modules.game.setup(_depot, config.game);
            _modules.game.presentation(_pages.game, 'full');

            _modules.meeting = odd.rtc.ui.create(_logger);
            await _modules.meeting.setup(_depot, config.meeting);
            _modules.meeting.presentation(_pages.meeting, 'full');

            utils.forEach(_modules, function (name, module) {
                module.addGlobalListener(_this.forward);
                _app.module(name, module);
            });
        }

        function _onIMChange(e) {
            if (e.data.name === 'nav' && utils.indexOf(App.sections(), e.data.value) !== -1) {
                _app.section(e.data.value);
            }
        }

        function _onSectionChange(e) {
            if (_wrapper) {
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
                utils.forEach(_modules, function (_, module) {
                    module.skin(e.data.value);
                });
            }
            _this.forward(e);
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
                _wrapper.setAttribute('sidebar', 'on');
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
            utils.forEach(_modules, function (_, module) {
                module.resize();
            });
            _this.dispatchEvent(UIEvent.RESIZE, {
                width: _wrapper.clientWidth,
                height: _wrapper.clientHeight,
            });
        };

        _this.destroy = function (reason) {
            window.removeEventListener('resize', _this.resize);
            _modules.im.removeEventListener(Event.CHANGE, _onIMChange);
            utils.forEach(_modules, function (_, module) {
                module.removeGlobalListener(_this.forward);
                module.destroy(reason);
            });
            _app.removeEventListener(AppEvent.SECTION_CHANGE, _onSectionChange);
            _app.removeEventListener(AppEvent.SKIN_CHANGE, _onSkinChange);
            _app.destroy(reason);
            _container.innerHTML = '';
            delete _instances[id];
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

