(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        UIEvent = events.UIEvent,
        AppEvent = events.AppEvent,
        MouseEvent = events.MouseEvent,
        App = odd.App,

        CLASS_WRAPPER = 'app-wrapper',
        _id = 0,
        _instances = {},
        _sectionOrder = ['contacts', 'game', 'live', 'video', 'meeting'],
        _labels = {
            contacts: '通讯录',
            game: '游戏',
            live: '直播',
            video: '视频',
            meeting: '会议',
        },
        _default = {
            title: 'odd.js',
            subtitle: 'Unified Experience',
            skin: 'classic',
            profile: {
                name: 'Odd User',
                initials: 'OD',
                online: true,
            },
            contacts: [{
                id: 'maya',
                name: 'Maya',
                status: '正在直播',
                online: true,
                group: '好友',
            }, {
                id: 'alex',
                name: 'Alex',
                status: '游戏中 · 32 ms',
                online: true,
                group: '好友',
            }, {
                id: 'luna',
                name: 'Luna',
                status: '在线',
                online: true,
                group: '好友',
            }, {
                id: 'design',
                name: '产品设计群',
                status: '8 位成员',
                online: true,
                group: '群组',
            }, {
                id: 'retro',
                name: '复古游戏群',
                status: '16 位成员',
                online: true,
                group: '群组',
            }],
            messages: [{
                from: 'Maya',
                text: '准备好一起体验 odd.js 了吗？',
                time: '10:24',
            }, {
                from: '我',
                text: '当然，先从云游戏开始。',
                time: '10:25',
                mine: true,
            }, {
                from: 'Maya',
                text: '好主意，右侧也能继续聊天。',
                time: '10:26',
            }],
            liveMessages: [{
                from: 'Luna',
                text: '这个画面太棒了 🔥',
                time: '刚刚',
            }, {
                from: 'Alex',
                text: '延迟很低，操作很跟手。',
                time: '刚刚',
            }, {
                from: 'Maya',
                text: '布局切换也很顺畅。',
                time: '刚刚',
            }],
            playlist: [{
                title: 'odd.js 四能力概览',
                meta: '03:24 · 1080P',
                active: true,
            }, {
                title: 'WebRTC 互动直播',
                meta: '08:16 · 1080P',
            }, {
                title: '云游戏低延迟实战',
                meta: '12:40 · 720P',
            }, {
                title: 'IM 与会议协作',
                meta: '06:08 · 1080P',
            }],
            modules: {
                im: {},
                live: {},
                video: {},
                game: {},
                meeting: {},
                call: {},
            },
        };

    function UI(id, logger) {
        var _this = this,
            _logger = new utils.Logger(id, logger),
            _container,
            _wrapper,
            _app,
            _left,
            _middle,
            _right,
            _nav,
            _stages,
            _modules,
            _moduleDepot,
            _imWorkspace,
            _sceneStatus,
            _presence,
            _profileButton,
            _profileMenu,
            _mountCleanups,
            _dynamic,
            _controlbar,
            _hideTimer,
            _pressedKeys,
            _callWindow,
            _drag,
            _destroyed;

        EventDispatcher.call(this, 'AppUI', { id: id, logger: _logger }, Event, UIEvent, AppEvent);

        function _init() {
            _this.id = id;
            _this.logger = _logger;
            _stages = {};
            _modules = {};
            _mountCleanups = [];
            _dynamic = [];
            _nav = {};
            _pressedKeys = {};
            _destroyed = false;
        }

        _this.setup = async function (container, config) {
            if (_destroyed) {
                return Promise.reject(_error('InvalidStateError', 'The App UI has been destroyed.'));
            }
            if (!container || !container.appendChild) {
                return Promise.reject(_error('DataError', 'App UI requires a DOM container.'));
            }
            if (_wrapper) {
                return Promise.resolve(_this);
            }

            _container = container;
            _app = App.get(id, _logger);
            _bindAppEvents();
            try {
                await _app.setup(utils.extendz({}, _default, config || {}));
            } catch (err) {
                _unbindAppEvents();
                return Promise.reject(err);
            }
            _this.config = _app.config;

            _wrapper = utils.createElement('div', CLASS_WRAPPER + ' app-ui-' + _app.skin());
            _wrapper.setAttribute('data-section', _app.section());
            _wrapper.setAttribute('data-activity', _app.activity());
            _wrapper.setAttribute('data-layout', _app.layout());
            _wrapper.setAttribute('data-right-collapsed', _app.rightCollapsed());
            _wrapper.setAttribute('data-fullpage', _app.fullpage());
            _wrapper.setAttribute('data-fullscreen', _app.fullscreen());
            _wrapper.setAttribute('data-controls-hidden', 'false');
            _wrapper.tabIndex = 0;

            _left = _createPane('left', _this.config.title);
            _middle = _createPane('middle', '');
            _right = _createPane('right', '协作侧栏');
            _wrapper.appendChild(_left.element);
            _wrapper.appendChild(_middle.element);
            _wrapper.appendChild(_right.element);
            _container.appendChild(_wrapper);

            _buildNavigation();
            _buildStages();
            _buildRightToggle();
            _buildHeaderChrome();
            try {
                await _setupModules();
            } catch (err) {
                _logger.error('Failed to setup App modules: ' + err.message);
                _this.destroy('module-setup-failed');
                return Promise.reject(err);
            }
            _render();
            _bindDomEvents();
            _this.resize();
            return Promise.resolve(_this);
        };

        function _error(name, message) {
            var err = new Error(message);
            err.name = name;
            return err;
        }

        function _bindAppEvents() {
            _app.addEventListener(Event.BIND, _onAppEvent);
            _app.addEventListener(Event.READY, _onAppEvent);
            _app.addEventListener(Event.ERROR, _onAppEvent);
            _app.addEventListener(Event.CLOSE, _onAppEvent);
            _app.addEventListener(AppEvent.SECTION_CHANGE, _onAppEvent);
            _app.addEventListener(AppEvent.ACTIVITY_CHANGE, _onAppEvent);
            _app.addEventListener(AppEvent.LAYOUT_CHANGE, _onAppEvent);
            _app.addEventListener(AppEvent.SIDEBAR_CHANGE, _onAppEvent);
            _app.addEventListener(AppEvent.FULLPAGE_CHANGE, _onAppEvent);
            _app.addEventListener(AppEvent.FULLSCREEN_CHANGE, _onAppEvent);
            _app.addEventListener(AppEvent.SKIN_CHANGE, _onAppEvent);
            _app.addEventListener(AppEvent.ACTION, _this.forward);
        }

        function _unbindAppEvents() {
            if (!_app) {
                return;
            }
            _app.removeEventListener(Event.BIND, _onAppEvent);
            _app.removeEventListener(Event.READY, _onAppEvent);
            _app.removeEventListener(Event.ERROR, _onAppEvent);
            _app.removeEventListener(Event.CLOSE, _onAppEvent);
            _app.removeEventListener(AppEvent.SECTION_CHANGE, _onAppEvent);
            _app.removeEventListener(AppEvent.ACTIVITY_CHANGE, _onAppEvent);
            _app.removeEventListener(AppEvent.LAYOUT_CHANGE, _onAppEvent);
            _app.removeEventListener(AppEvent.SIDEBAR_CHANGE, _onAppEvent);
            _app.removeEventListener(AppEvent.FULLPAGE_CHANGE, _onAppEvent);
            _app.removeEventListener(AppEvent.FULLSCREEN_CHANGE, _onAppEvent);
            _app.removeEventListener(AppEvent.SKIN_CHANGE, _onAppEvent);
            _app.removeEventListener(AppEvent.ACTION, _this.forward);
        }

        function _createPane(kind, title) {
            var pane = utils.createElement(kind === 'middle' ? 'main' : 'aside', 'app-pane app-' + kind + '-pane'),
                head = utils.createElement('header', 'app-pane-title'),
                heading = utils.createElement('div', 'app-pane-heading'),
                body = utils.createElement('div', 'app-pane-body'),
                actions = utils.createElement('div', 'app-pane-actions');
            heading.textContent = title;
            head.appendChild(heading);
            head.appendChild(actions);
            pane.appendChild(head);
            pane.appendChild(body);
            return {
                element: pane,
                head: head,
                title: heading,
                actions: actions,
                body: body,
            };
        }

        function _buildNavigation() {
            utils.emptyElement(_left.title);
            var profile = _this.config.profile || _default.profile;
            _profileButton = utils.createElement('button', 'app-profile-trigger');
            _profileButton.type = 'button';
            _profileButton.title = profile.name || _default.profile.name;
            _profileButton.setAttribute('aria-label', '打开个人菜单');
            _profileButton.setAttribute('aria-expanded', 'false');
            _profileButton.appendChild(_avatar(profile.initials || _initials(profile.name), profile.online !== false));
            _profileButton.addEventListener('click', _onProfileToggle);
            _left.title.appendChild(_profileButton);

            _profileMenu = utils.createElement('div', 'app-profile-menu');
            _profileMenu.setAttribute('role', 'menu');
            _profileMenu.hidden = true;
            var profileActions = [{
                name: 'profile',
                label: '个人信息',
            }, {
                name: 'signature',
                label: '签名',
            }, {
                name: 'settings',
                label: '设置',
            }, {
                name: 'help',
                label: '帮助',
            }, {
                name: 'about',
                label: '关于',
            }];
            for (var p = 0; p < profileActions.length; p++) {
                var menuItem = utils.createElement('button', 'app-profile-menu-item ' + profileActions[p].name);
                menuItem.type = 'button';
                menuItem.setAttribute('role', 'menuitem');
                menuItem.setAttribute('data-action', profileActions[p].name);
                menuItem.textContent = profileActions[p].label;
                menuItem.addEventListener('click', _onProfileAction);
                _profileMenu.appendChild(menuItem);
            }
            _left.element.appendChild(_profileMenu);

            var list = utils.createElement('nav', 'app-navigation');
            list.setAttribute('aria-label', '主导航');
            for (var i = 0; i < _sectionOrder.length; i++) {
                var key = _sectionOrder[i],
                    button = utils.createElement('button', 'app-nav-item ' + key);
                button.type = 'button';
                button.setAttribute('data-section', key);
                button.setAttribute('aria-label', _labels[key]);
                var icon = utils.createElement('span', 'app-nav-icon'),
                    label = utils.createElement('span', 'app-nav-label'),
                    badge = utils.createElement('span', 'app-nav-badge');
                icon.appendChild(_icon(key));
                label.textContent = _labels[key];
                if (key === 'contacts') {
                    badge.textContent = '3';
                } else if (key === 'live') {
                    badge.textContent = 'LIVE';
                }
                button.appendChild(icon);
                button.appendChild(label);
                button.appendChild(badge);
                button.addEventListener('click', _onNavigation);
                list.appendChild(button);
                _nav[key] = button;
            }
            _left.body.appendChild(list);
        }

        function _onProfileToggle(e) {
            e.stopPropagation();
            var open = _profileMenu.hidden;
            _profileMenu.hidden = !open;
            _profileButton.setAttribute('aria-expanded', open);
        }

        function _onProfileAction(e) {
            var action = e.currentTarget.getAttribute('data-action');
            _closeProfileMenu();
            _app.dispatchEvent(AppEvent.ACTION, {
                domain: 'app',
                action: action,
                data: {},
                handled: false,
            });
        }

        function _closeProfileMenu() {
            if (!_profileMenu || !_profileButton) {
                return;
            }
            _profileMenu.hidden = true;
            _profileButton.setAttribute('aria-expanded', 'false');
        }

        function _onDocumentClick(e) {
            if ((_profileButton && _profileButton.contains(e.target)) ||
                (_profileMenu && _profileMenu.contains(e.target))) {
                return;
            }
            _closeProfileMenu();
        }

        function _buildRightToggle() {
            var toggle = utils.createElement('button', 'app-sidebar-toggle');
            toggle.type = 'button';
            toggle.title = '伸缩右侧栏';
            toggle.setAttribute('aria-label', '伸缩右侧栏');
            toggle.setAttribute('data-collapsed', _app.rightCollapsed());
            toggle.appendChild(_icon('chevron'));
            toggle.addEventListener('click', _onRightToggle);
            _right.actions.appendChild(toggle);
            _right.toggle = toggle;
        }

        function _buildHeaderChrome() {
            _sceneStatus = utils.createElement('span', 'app-scene-status');
            _middle.actions.appendChild(_sceneStatus);

            _presence = utils.createElement('span', 'app-presence');
            var dot = utils.createElement('i'),
                label = utils.createElement('span');
            _presence.appendChild(dot);
            _presence.appendChild(label);
            _right.actions.insertBefore(_presence, _right.toggle);
        }

        function _buildStages() {
            _moduleDepot = utils.createElement('div', 'app-module-depot');
            _moduleDepot.hidden = true;
            _wrapper.appendChild(_moduleDepot);
            var activities = App.activities();
            for (var i = 0; i < activities.length; i++) {
                var activity = activities[i],
                    stage = utils.createElement('div', 'app-stage app-stage-' + activity);
                stage.setAttribute('data-kind', activity);
                var content = utils.createElement('div', 'app-stage-content');
                stage.appendChild(content);
                _stages[activity] = stage;
            }
        }

        async function _setupModules() {
            if (!odd.im || !odd.im.ui || !odd.im.ui.create ||
                !odd.player || !odd.player.ui || !odd.player.ui.create ||
                !odd.famicom || !odd.famicom.ui || !odd.famicom.ui.create ||
                !odd.rtc || !odd.rtc.ui || !odd.rtc.ui.create) {
                throw _error('NotSupportedError', 'App UI requires IM.UI, Player.UI, Famicom.UI and RTC.UI.');
            }

            var moduleConfig = _this.config.modules || {},
                imConfig = utils.extendz({}, moduleConfig.im || {}, {
                    contacts: _this.config.contacts,
                    conversations: {
                        maya: _this.config.messages,
                    },
                    channels: {
                        default: _this.config.liveMessages,
                        game: _this.config.liveMessages,
                        live: _this.config.liveMessages,
                        meeting: _this.config.liveMessages,
                    },
                });
            imConfig.connect = imConfig.connect === true;
            var workspaceConfig = {
                kind: 'Workspace',
                contacts: imConfig.contacts,
                conversations: imConfig.conversations,
                channels: imConfig.channels,
                maxMessageLength: _this.config.maxMessageLength,
                visibility: true,
            };
            if (imConfig.miniComposer) {
                workspaceConfig.miniComposer = imConfig.miniComposer;
            }
            imConfig.plugins = _mergePlugin(imConfig.plugins, workspaceConfig);

            _modules.im = odd.im.ui.create(_logger);
            await _modules.im.setup(_moduleDepot, imConfig);
            _imWorkspace = _modules.im.plugin('Workspace');
            if (!_imWorkspace) {
                throw _error('NotSupportedError', 'IM Workspace plugin is required by App UI.');
            }
            _imWorkspace.addEventListener(MouseEvent.CLICK, _onWorkspaceAction);

            _modules.live = odd.player.ui.create(_logger);
            await _modules.live.setup(_stages.live.firstChild, utils.extendz({
                autoplay: false,
                mode: 'live',
                presentation: 'full',
            }, moduleConfig.live || {}));
            _modules.live.addEventListener(MouseEvent.CLICK, _onModuleClick);
            _bindModuleDisplayEvents(_modules.live);

            var videoConfig = utils.extendz({
                autoplay: false,
                mode: 'vod',
                presentation: 'full',
            }, moduleConfig.video || {});
            videoConfig.plugins = _mergePlugin(videoConfig.plugins, {
                kind: 'Playlist',
                title: '播放列表',
                items: _this.config.playlist,
                active: 0,
                visibility: true,
            });
            _modules.video = odd.player.ui.create(_logger);
            await _modules.video.setup(_stages.video.firstChild, videoConfig);
            _modules.video.addEventListener(MouseEvent.CLICK, _onModuleClick);
            _bindModuleDisplayEvents(_modules.video);

            _modules.game = odd.famicom.ui.create(_logger);
            await _modules.game.setup(_stages.game.firstChild, utils.extendz({
                presentation: 'full',
            }, moduleConfig.game || {}));
            _modules.game.addEventListener(MouseEvent.CLICK, _onModuleClick);
            _bindModuleDisplayEvents(_modules.game);

            _modules.meeting = odd.rtc.ui.create(_logger);
            await _modules.meeting.setup(_stages.meeting.firstChild, utils.extendz({
                presentation: 'full',
            }, moduleConfig.meeting || {}));
            _modules.meeting.addEventListener(MouseEvent.CLICK, _onModuleClick);
            _bindModuleDisplayEvents(_modules.meeting);

            _modules.call = odd.rtc.ui.create(_logger);
            await _modules.call.setup(_moduleDepot, utils.extendz({
                presentation: 'popup',
                title: '好友视频通话',
                subtitle: '端到端 RTC 预览',
                controls: true,
            }, moduleConfig.call || {}));

            for (var name in _modules) {
                if (_modules.hasOwnProperty(name)) {
                    _app.module(name, _modules[name]);
                }
            }
        }

        function _bindModuleDisplayEvents(module) {
            module.addEventListener(UIEvent.FULLPAGE, _onModuleDisplayMode);
            module.addEventListener(UIEvent.FULLSCREEN, _onModuleDisplayMode);
        }

        function _mergePlugin(plugins, config) {
            var result = (plugins || []).slice(),
                found = false;
            for (var i = 0; i < result.length; i++) {
                if (result[i].kind === config.kind) {
                    result[i] = utils.extendz({}, result[i], config);
                    found = true;
                    break;
                }
            }
            if (!found) {
                result.push(config);
            }
            return result;
        }

        function _bindDomEvents() {
            window.addEventListener('resize', _this.resize);
            document.addEventListener('keydown', _onKeyDown);
            document.addEventListener('keyup', _onKeyUp);
            document.addEventListener('fullscreenchange', _onFullscreenChange);
            document.addEventListener('webkitfullscreenchange', _onFullscreenChange);
            document.addEventListener('click', _onDocumentClick);
            _wrapper.addEventListener('pointermove', _onPointerMove);
            _wrapper.addEventListener('pointerleave', _onPointerLeave);
        }

        function _unbindDomEvents() {
            window.removeEventListener('resize', _this.resize);
            document.removeEventListener('keydown', _onKeyDown);
            document.removeEventListener('keyup', _onKeyUp);
            document.removeEventListener('fullscreenchange', _onFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', _onFullscreenChange);
            document.removeEventListener('click', _onDocumentClick);
            if (_wrapper) {
                _wrapper.removeEventListener('pointermove', _onPointerMove);
                _wrapper.removeEventListener('pointerleave', _onPointerLeave);
            }
        }

        function _onNavigation(e) {
            _app.section(e.currentTarget.getAttribute('data-section'));
        }

        function _onRightToggle() {
            _app.rightCollapsed(!_app.rightCollapsed());
        }

        function _onAppEvent(e) {
            if (!_wrapper) {
                _this.forward(e);
                return;
            }
            switch (e.type) {
                case AppEvent.SECTION_CHANGE:
                case AppEvent.ACTIVITY_CHANGE:
                    _render();
                    break;
                case AppEvent.LAYOUT_CHANGE:
                    _wrapper.setAttribute('data-layout', _app.layout());
                    _syncControlStates();
                    break;
                case AppEvent.SIDEBAR_CHANGE:
                    _wrapper.setAttribute('data-right-collapsed', _app.rightCollapsed());
                    _right.toggle.setAttribute('data-collapsed', _app.rightCollapsed());
                    break;
                case AppEvent.FULLPAGE_CHANGE:
                    _wrapper.setAttribute('data-fullpage', _app.fullpage());
                    if (_app.fullpage()) {
                        _app.rightCollapsed(true);
                    }
                    _syncControlStates();
                    _armControls();
                    break;
                case AppEvent.FULLSCREEN_CHANGE:
                    _wrapper.setAttribute('data-fullscreen', _app.fullscreen());
                    if (_app.fullscreen()) {
                        _app.rightCollapsed(true);
                    }
                    _syncControlStates();
                    _armControls();
                    break;
                case AppEvent.SKIN_CHANGE:
                    _applySkin();
                    break;
            }
            _this.forward(e);
        }

        function _applySkin() {
            _wrapper.className = CLASS_WRAPPER + ' app-ui-' + _app.skin();
            for (var name in _modules) {
                if (_modules.hasOwnProperty(name) && _modules[name].skin) {
                    _modules[name].skin(_app.skin());
                }
            }
        }

        function _render() {
            if (!_wrapper) {
                return;
            }
            _disposeDynamic();
            var section = _app.section(),
                activity = _app.activity();
            _wrapper.setAttribute('data-section', section);
            _wrapper.setAttribute('data-activity', activity);
            for (var key in _nav) {
                if (_nav.hasOwnProperty(key)) {
                    _nav[key].classList.toggle('active', key === section);
                    _nav[key].setAttribute('aria-current', key === section ? 'page' : 'false');
                }
            }

            utils.emptyElement(_middle.body);
            utils.emptyElement(_right.body);
            if (section === 'contacts') {
                _renderContacts(activity);
            } else {
                _renderActivity(section);
            }
            _renderHeaderChrome(section, activity);
            _syncControlStates();
            _armControls();
        }

        function _renderHeaderChrome(section, activity) {
            var active = section === 'contacts' ? activity : section,
                status = {
                    game: '32 ms',
                    live: 'LIVE',
                    video: 'VOD',
                    meeting: 'CONNECTED',
                }[active],
                presence = {
                    game: '2 位玩家在线',
                    live: '2,842 人在线',
                    video: '4 个视频',
                    meeting: '3 人参会',
                }[active];
            _sceneStatus.textContent = section === 'contacts' ? 'IM ONLINE' : status;
            _sceneStatus.setAttribute('data-kind', section === 'contacts' ? 'contacts' : active);
            _presence.lastChild.textContent = presence;
            _presence.setAttribute('data-kind', active);
        }

        function _disposeDynamic() {
            clearTimeout(_hideTimer);
            _hideTimer = undefined;
            if (_controlbar) {
                _controlbar.destroy();
                _controlbar = undefined;
            }
            for (var i = 0; i < _dynamic.length; i++) {
                if (_dynamic[i] && utils.typeOf(_dynamic[i].destroy) === 'function') {
                    _dynamic[i].destroy();
                }
            }
            _dynamic = [];
        }

        function _renderContacts(activity) {
            _middle.title.textContent = 'odd.js · 通讯录';
            _right.title.textContent = _labels[activity] + ' · 进行中';
            _middle.body.appendChild(_contactWorkspace());

            var preview = utils.createElement('div', 'app-mini-stage');
            var badge = utils.createElement('span', 'app-mini-badge');
            badge.textContent = _labels[activity] + '进行中';
            preview.appendChild(badge);
            _modules[activity].attach(preview, 'mini');
            _right.body.appendChild(preview);
            _right.body.appendChild(_tabsFor(activity, true));
        }

        function _renderActivity(activity) {
            _middle.title.textContent = 'odd.js · ' + _activityTitle(activity);
            _right.title.textContent = '';

            var workspace = utils.createElement('div', 'app-activity-workspace');
            _modules[activity].attach(_stages[activity].firstChild, 'full');
            workspace.appendChild(_stages[activity]);
            _middle.body.appendChild(workspace);
            _right.body.appendChild(_tabsFor(activity, false));
        }

        function _activityTitle(activity) {
            return {
                game: '云游戏',
                live: '直播',
                video: '视频',
                meeting: '会议',
            }[activity];
        }

        function _contactWorkspace() {
            var workspace = utils.createElement('div', 'app-contact-workspace');
            workspace.appendChild(_imWorkspace.contactsElement('full'));
            workspace.appendChild(_imWorkspace.friendElement('full'));
            return workspace;
        }

        function _directory(compact) {
            var directory = utils.createElement('section', 'app-directory' + (compact ? ' compact' : '')),
                search = utils.createElement('input', 'app-search');
            search.type = 'search';
            search.placeholder = '搜索好友和群';
            directory.appendChild(search);

            var groups = ['好友', '群组'];
            for (var i = 0; i < groups.length; i++) {
                var heading = utils.createElement('h3', 'app-list-heading');
                heading.textContent = groups[i];
                directory.appendChild(heading);
                for (var j = 0; j < _this.config.contacts.length; j++) {
                    var contact = _this.config.contacts[j];
                    if (contact.group === groups[i]) {
                        directory.appendChild(_contactCard(contact, compact));
                    }
                }
            }
            return directory;
        }

        function _contactCard(contact, compact) {
            var card = utils.createElement('button', 'app-contact-card' + (contact.id === 'maya' ? ' active' : ''));
            card.type = 'button';
            card.setAttribute('data-contact', contact.id);
            card.appendChild(_avatar(_initials(contact.name), contact.online));
            var copy = utils.createElement('span', 'app-contact-copy');
            var name = utils.createElement('strong');
            var status = utils.createElement('small');
            name.textContent = contact.name;
            status.textContent = compact ? contact.status.split(' · ')[0] : contact.status;
            copy.appendChild(name);
            copy.appendChild(status);
            card.appendChild(copy);
            card.addEventListener('click', _onContactClick);
            return card;
        }

        function _onContactClick(e) {
            var cards = _wrapper.querySelectorAll('.app-contact-card');
            for (var i = 0; i < cards.length; i++) {
                cards[i].classList.toggle('active', cards[i] === e.currentTarget);
            }
            _app.invoke('im', 'select-contact', {
                id: e.currentTarget.getAttribute('data-contact'),
            });
        }

        function _conversation(title, messages, domain, compact) {
            var panel = utils.createElement('section', 'app-conversation' + (compact ? ' compact' : '')),
                header = utils.createElement('header', 'app-conversation-head');
            header.appendChild(_avatar(_initials(title), true));
            var copy = utils.createElement('div');
            var name = utils.createElement('strong');
            var state = utils.createElement('small');
            name.textContent = title;
            state.textContent = '在线 · 端到端实时消息';
            copy.appendChild(name);
            copy.appendChild(state);
            header.appendChild(copy);
            panel.appendChild(header);

            var list = _messageList(messages);
            panel.appendChild(list);
            var composer = new UI.components.Composer(domain, {
                placeholder: domain === 'friend' ? '给 ' + title + ' 发消息…' : '说点什么…',
                maxLength: _this.config.maxMessageLength,
                compact: compact,
            }, _logger);
            composer.addEventListener(AppEvent.ACTION, _onComposerAction);
            composer.messageList = list;
            _dynamic.push(composer);
            panel.appendChild(composer.element());
            return panel;
        }

        function _messageList(messages) {
            var list = utils.createElement('div', 'app-message-list');
            for (var i = 0; i < messages.length; i++) {
                _appendMessage(list, messages[i]);
            }
            return list;
        }

        function _appendMessage(list, message) {
            var item = utils.createElement('article', 'app-message' + (message.mine ? ' mine' : ''));
            if (!message.mine) {
                item.appendChild(_avatar(_initials(message.from), true));
            }
            var bubble = utils.createElement('div', 'app-message-bubble');
            var meta = utils.createElement('div', 'app-message-meta');
            var from = utils.createElement('strong');
            var time = utils.createElement('span');
            var text = utils.createElement('p');
            from.textContent = message.from;
            time.textContent = message.time || '现在';
            text.textContent = message.text;
            meta.appendChild(from);
            meta.appendChild(time);
            bubble.appendChild(meta);
            bubble.appendChild(text);
            item.appendChild(bubble);
            list.appendChild(item);
            list.scrollTop = list.scrollHeight;
        }

        function _onComposerAction(e) {
            var action = e.data.action,
                domain = e.data.name,
                composer = e.target;
            switch (action) {
                case 'send':
                    _appendMessage(composer.messageList, {
                        from: '我',
                        text: e.data.text,
                        time: '现在',
                        mine: true,
                    });
                    _app.invoke(domain === 'friend' ? 'im' : domain, 'send', { text: e.data.text });
                    break;
                case 'file':
                    _app.invoke(domain === 'friend' ? 'im' : domain, 'file', { files: e.data.files });
                    break;
                case 'video-call':
                case 'voice-call':
                    _openCall(action === 'video-call', domain);
                    _app.invoke('rtc', action, { contact: domain });
                    break;
            }
        }

        function _onWorkspaceAction(e) {
            var data = e.data || {};
            if (data.name === 'video-call' || data.name === 'voice-call') {
                _openCall(data.name === 'video-call', data.conversation);
            }
            _app.dispatchEvent(AppEvent.ACTION, {
                domain: 'im',
                action: data.name,
                data: data,
                handled: true,
                module: 'Workspace',
            });
        }

        function _onModuleClick(e) {
            var data = e.data || {};
            if (data.name === 'playlist' && data.item && data.item.file) {
                _modules.video.play(data.item.file);
            }
            _app.dispatchEvent(AppEvent.ACTION, {
                domain: _app.activity(),
                action: data.name,
                data: data,
                handled: true,
                module: e.target && e.target.constructor && e.target.constructor.name,
            });
        }

        function _onModuleDisplayMode(e) {
            var status = !!(e.data && e.data.status);
            if (e.type === UIEvent.FULLPAGE) {
                _app.fullpage(status);
            } else if (e.type === UIEvent.FULLSCREEN) {
                _app.fullscreen(status);
            }
        }

        function _tabsFor(activity, contactsMode) {
            var tabs = new UI.components.Tabs('sidebar', _logger),
                schema = contactsMode ? _activityTabs(activity, true) : _activityTabs(activity, false);
            tabs.set(schema);
            _dynamic.push(tabs);
            return tabs.element();
        }

        function _activityTabs(activity, contactsMode) {
            var items = [];
            if (activity === 'game' || activity === 'live' || activity === 'meeting' || contactsMode && activity === 'video') {
                items.push({
                    name: 'live-chat',
                    label: '实时聊天',
                    content: _imWorkspace.channelElement(activity, 'mini'),
                });
            }
            if (activity === 'game' || activity === 'live') {
                items.push({
                    name: 'online',
                    label: '在线列表',
                    content: _imWorkspace.onlineElement(activity, _this.config.contacts.slice(0, 4), '在线用户'),
                });
            } else if (activity === 'video' && !contactsMode) {
                items.push({
                    name: 'playlist',
                    label: '播放列表',
                    content: _modules.video.plugin('Playlist').element(),
                });
            } else if (activity === 'meeting') {
                items.push({
                    name: 'participants',
                    label: '参会人员',
                    content: _modules.meeting.rosterElement(),
                });
            }
            if (!contactsMode) {
                items.push({
                    name: 'contacts',
                    label: '通讯录',
                    content: _imWorkspace.contactsElement('mini'),
                });
                items.push({
                    name: 'friend-chat',
                    label: '好友聊天',
                    content: _imWorkspace.friendElement('mini'),
                });
            }
            return items;
        }

        function _onlineList(title) {
            var container = utils.createElement('div', 'app-online-list'),
                heading = utils.createElement('h3', 'app-list-heading');
            heading.textContent = title + ' · ' + (title === '参会人员' ? '4' : '12');
            container.appendChild(heading);
            var contacts = _this.config.contacts.slice(0, 4);
            for (var i = 0; i < contacts.length; i++) {
                container.appendChild(_contactCard(contacts[i], true));
            }
            return container;
        }

        function _playlist() {
            var list = utils.createElement('div', 'app-playlist');
            for (var i = 0; i < _this.config.playlist.length; i++) {
                var item = _this.config.playlist[i],
                    button = utils.createElement('button', 'app-playlist-item' + (item.active ? ' active' : ''));
                button.type = 'button';
                button.setAttribute('data-index', i);
                var thumb = utils.createElement('span', 'app-playlist-thumb');
                var copy = utils.createElement('span', 'app-contact-copy');
                var title = utils.createElement('strong');
                var meta = utils.createElement('small');
                thumb.textContent = '▶';
                title.textContent = item.title;
                meta.textContent = item.meta;
                copy.appendChild(title);
                copy.appendChild(meta);
                button.appendChild(thumb);
                button.appendChild(copy);
                button.addEventListener('click', _onPlaylistClick);
                list.appendChild(button);
            }
            return list;
        }

        function _onPlaylistClick(e) {
            var items = _wrapper.querySelectorAll('.app-playlist-item');
            for (var i = 0; i < items.length; i++) {
                items[i].classList.toggle('active', items[i] === e.currentTarget);
            }
            _app.invoke('video', 'playlist', {
                index: parseInt(e.currentTarget.getAttribute('data-index')),
            });
        }

        function _controlsFor(activity) {
            if (activity === 'game') {
                return [
                    { type: 'label', name: 'player', label: 'P1', group: 'identity' },
                    { type: 'key', name: 'up', icon: '↑', label: '上', group: 'dpad' },
                    { type: 'key', name: 'left', icon: '←', label: '左', group: 'dpad' },
                    { type: 'key', name: 'down', icon: '↓', label: '下', group: 'dpad' },
                    { type: 'key', name: 'right', icon: '→', label: '右', group: 'dpad' },
                    { type: 'key', name: 'select', icon: '−', text: 'Select', label: 'Select', group: 'keys' },
                    { type: 'key', name: 'start', icon: '+', text: 'Start', label: 'Start', group: 'keys' },
                    { type: 'key', name: 'b', icon: 'B', label: 'B', group: 'keys' },
                    { type: 'key', name: 'a', icon: 'A', label: 'A', group: 'keys' },
                    { name: 'capture', icon: '◫', label: '截图', group: 'tools' },
                    { type: 'toggle', name: 'muted', icon: '◖', label: '静音', group: 'tools' },
                    { type: 'slider', name: 'volume', label: '音量', value: 80, group: 'tools' },
                    { type: 'toggle', name: 'fullpage', icon: '▱', label: '网页全屏', group: 'view' },
                    { type: 'toggle', name: 'fullscreen', icon: '⛶', label: '全屏', group: 'view' },
                    { type: 'label', name: 'latency', label: '32 ms', group: 'view' },
                    { type: 'toggle', name: 'layout', icon: '▦', label: '布局', group: 'view' },
                    { name: 'settings', icon: '⚙', label: '设置', group: 'view' },
                ];
            }
            if (activity === 'meeting') {
                return [
                    { type: 'toggle', name: 'microphone', icon: '◖', text: '麦克风', label: '麦克风', checked: true, group: 'main' },
                    { type: 'toggle', name: 'camera', icon: '▣', text: '摄像头', label: '摄像头', checked: true, group: 'main' },
                    { name: 'share', icon: '▱', text: '共享', label: '共享屏幕', group: 'main' },
                    { name: 'raise-hand', icon: '✋', text: '举手', label: '举手', group: 'main' },
                    { name: 'more', icon: '•••', text: '更多', label: '更多', group: 'main' },
                    { type: 'toggle', name: 'layout', icon: '▦', label: '布局', group: 'view' },
                    { name: 'leave', icon: '⌕', text: '离开', label: '离开会议', group: 'danger' },
                ];
            }
            var controls = [
                { name: 'play', icon: '▶', label: '播放', group: 'main' },
                { name: 'pause', icon: 'Ⅱ', label: '暂停', group: 'main' },
                { name: 'reload', icon: '↻', label: '重新加载', group: 'main' },
                { name: 'stop', icon: '■', label: '停止', group: 'main' },
                { name: 'capture', icon: '◫', label: '截图', group: 'tools' },
                { name: 'download', icon: '⇩', label: '下载', group: 'tools' },
                { type: 'toggle', name: 'muted', icon: '◖', label: '静音', group: 'tools' },
                { type: 'slider', name: 'volume', label: '音量', value: 80, group: 'tools' },
            ];
            if (activity === 'live') {
                controls.push({ type: 'toggle', name: 'danmu', icon: '弹', label: '弹幕', checked: true, group: 'view' });
            }
            controls.push({ type: 'toggle', name: 'fullpage', icon: '▱', label: '网页全屏', group: 'view' });
            controls.push({ type: 'toggle', name: 'fullscreen', icon: '⛶', label: '全屏', group: 'view' });
            controls.push({ type: 'toggle', name: 'layout', icon: '▦', label: '布局', group: 'view' });
            controls.push({ name: 'settings', icon: '⚙', label: '设置', group: 'view' });
            return controls;
        }

        function _onControlAction(e) {
            var data = e.data,
                action = data.action,
                domain = data.name;
            if (domain === 'game' && _isGameKey(action)) {
                if (data.phase !== 'click') {
                    _app.invoke('game', 'key', { key: action, pressed: !!data.pressed });
                }
                return;
            }
            switch (action) {
                case 'fullpage':
                    _this.fullpage(data.checked);
                    break;
                case 'fullscreen':
                    _this.fullscreen(data.checked);
                    break;
                case 'layout':
                    _cycleLayout();
                    break;
                default:
                    _app.invoke(domain, action, data);
                    break;
            }
        }

        function _isGameKey(name) {
            return utils.indexOf(['up', 'down', 'left', 'right', 'select', 'start', 'b', 'a'], name) !== -1;
        }

        function _cycleLayout() {
            var layouts = ['focus', 'split', 'grid'],
                index = utils.indexOf(layouts, _app.layout());
            _app.layout(layouts[(index + 1) % layouts.length]);
        }

        function _syncControlStates() {
            if (!_controlbar) {
                return;
            }
            _controlbar.state('fullpage', _app.fullpage());
            _controlbar.state('fullscreen', _app.fullscreen());
            _controlbar.state('layout', _app.layout() !== 'focus');
        }

        _this.fullpage = function (status) {
            if (status === undefined) {
                return _app.fullpage();
            }
            if (status && _app.fullscreen()) {
                _this.fullscreen(false);
            }
            return _app.fullpage(!!status);
        };

        _this.fullscreen = function (status) {
            if (status === undefined) {
                return _app.fullscreen();
            }
            var fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
            if (status) {
                if (_app.fullpage()) {
                    _app.fullpage(false);
                }
                var request = _wrapper.requestFullscreen || _wrapper.webkitRequestFullscreen;
                if (!request) {
                    _app.fullpage(true);
                    _this.dispatchEvent(Event.ERROR, {
                        name: 'NotSupportedError',
                        message: 'Fullscreen API is not supported; using fullpage mode.',
                    });
                    return false;
                }
                var promise;
                try {
                    promise = request.call(_wrapper);
                } catch (err) {
                    _onFullscreenError(err);
                    return false;
                }
                if (promise && promise.catch) {
                    promise.catch(_onFullscreenError);
                }
                return true;
            }
            if (fullscreenElement) {
                var exit = document.exitFullscreen || document.webkitExitFullscreen;
                if (exit) {
                    var result = exit.call(document);
                    if (result && result.catch) {
                        result.catch(_onFullscreenError);
                    }
                    return true;
                }
            }
            _app.fullscreen(false);
            return false;
        };

        function _onFullscreenError(err) {
            _app.fullscreen(false);
            _app.fullpage(true);
            _this.dispatchEvent(Event.ERROR, {
                name: err.name || 'NotSupportedError',
                message: err.message || 'Fullscreen request failed; using fullpage mode.',
            });
        }

        function _onFullscreenChange() {
            var fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement,
                belongsToApp = !!(fullscreenElement && (fullscreenElement === _wrapper || _wrapper.contains(fullscreenElement)));
            _app.fullscreen(belongsToApp);
        }

        function _onPointerMove() {
            _wrapper.setAttribute('data-controls-hidden', 'false');
            _armControls();
        }

        function _onPointerLeave() {
            _armControls(true);
        }

        function _armControls(immediate) {
            clearTimeout(_hideTimer);
            _hideTimer = undefined;
            if (!_wrapper || (!_app.fullscreen() && !_app.fullpage()) || !_this.config.autoHide) {
                if (_wrapper) {
                    _wrapper.setAttribute('data-controls-hidden', 'false');
                }
                return;
            }
            _hideTimer = setTimeout(function () {
                if (_wrapper) {
                    _wrapper.setAttribute('data-controls-hidden', 'true');
                }
            }, immediate ? Math.min(500, _this.config.autoHide) : _this.config.autoHide);
        }

        function _onKeyDown(e) {
            if (!_wrapper || _app.activity() !== 'game') {
                return;
            }
            var key = _gameKey(_this.config.keyboard[e.code]);
            if (!key || _pressedKeys[e.code]) {
                return;
            }
            _pressedKeys[e.code] = key;
            if (_app.section() === 'game' || _app.section() === 'contacts') {
                e.preventDefault();
                _modules.game.key(key, true);
            }
        }

        function _onKeyUp(e) {
            var key = _pressedKeys[e.code];
            if (!key) {
                return;
            }
            delete _pressedKeys[e.code];
            _modules.game.key(key, false);
        }

        function _releaseKeys() {
            for (var code in _pressedKeys) {
                if (_pressedKeys.hasOwnProperty(code)) {
                    _modules.game.key(_pressedKeys[code], false);
                }
            }
            _pressedKeys = {};
        }

        function _gameKey(value) {
            if (utils.typeOf(value) === 'number') {
                return value;
            }
            if (!value || !odd.Famicom || !odd.Famicom.Key) {
                return 0;
            }
            return odd.Famicom.Key[String(value).toUpperCase()] || 0;
        }

        function _icon(name) {
            var icon = utils.createElement('span', 'app-svg-icon app-svg-icon-' + name);
            icon.setAttribute('aria-hidden', 'true');
            return icon;
        }

        function _openCall(video, contact) {
            if (_callWindow) {
                _closeCall();
            }
            _callWindow = utils.createElement('section', 'app-call-window');
            _callWindow.setAttribute('data-video', video);
            var head = utils.createElement('header', 'app-call-head');
            var title = utils.createElement('strong');
            var close = utils.createElement('button', 'app-call-close');
            title.textContent = video ? '视频通话 · Maya' : '语音通话 · Maya';
            close.type = 'button';
            close.appendChild(_icon('close'));
            close.setAttribute('aria-label', '关闭通话窗');
            head.appendChild(title);
            head.appendChild(close);
            var body = utils.createElement('div', 'app-call-body');
            _callWindow.appendChild(head);
            _callWindow.appendChild(body);
            _wrapper.appendChild(_callWindow);
            _modules.call.attach(body, 'popup');
            head.addEventListener('pointerdown', _onDragStart);
            close.addEventListener('click', _closeCall);
            _modules.call.preview(undefined, false, video).catch(function (err) {
                _logger.warn('RTC call preview unavailable: ' + (err.message || err));
            });
            _app.dispatchEvent(AppEvent.ACTION, {
                domain: 'rtc',
                action: 'call-window-open',
                data: { video: video, contact: contact },
                handled: true,
                module: 'RTC.UI',
            });
        }

        function _closeCall() {
            if (!_callWindow) {
                return;
            }
            var head = _callWindow.querySelector('.app-call-head');
            head.removeEventListener('pointerdown', _onDragStart);
            _callWindow.parentNode.removeChild(_callWindow);
            _callWindow = undefined;
            document.removeEventListener('pointermove', _onDragMove);
            document.removeEventListener('pointerup', _onDragEnd);
            if (_modules.call) {
                _modules.call.unpublish();
                _modules.call.stop();
            }
        }

        function _onDragStart(e) {
            if (e.target.tagName === 'BUTTON') {
                return;
            }
            var rect = _callWindow.getBoundingClientRect(),
                parent = _wrapper.getBoundingClientRect();
            _drag = {
                x: e.clientX,
                y: e.clientY,
                left: rect.left - parent.left,
                top: rect.top - parent.top,
            };
            document.addEventListener('pointermove', _onDragMove);
            document.addEventListener('pointerup', _onDragEnd);
        }

        function _onDragMove(e) {
            if (!_drag || !_callWindow) {
                return;
            }
            var maxLeft = _wrapper.clientWidth - _callWindow.offsetWidth - 8,
                maxTop = _wrapper.clientHeight - _callWindow.offsetHeight - 8,
                left = Math.max(8, Math.min(maxLeft, _drag.left + e.clientX - _drag.x)),
                top = Math.max(8, Math.min(maxTop, _drag.top + e.clientY - _drag.y));
            _callWindow.style.left = left + 'px';
            _callWindow.style.top = top + 'px';
            _callWindow.style.right = 'auto';
        }

        function _onDragEnd() {
            _drag = undefined;
            document.removeEventListener('pointermove', _onDragMove);
            document.removeEventListener('pointerup', _onDragEnd);
        }

        function _avatar(initials, online) {
            var avatar = utils.createElement('span', 'app-avatar');
            avatar.textContent = initials;
            if (online) {
                var status = utils.createElement('i', 'app-avatar-status');
                avatar.appendChild(status);
            }
            return avatar;
        }

        function _initials(name) {
            if (!name) {
                return '?';
            }
            var parts = name.split(/\s+/),
                text = parts[0].charAt(0);
            if (parts.length > 1) {
                text += parts[parts.length - 1].charAt(0);
            } else if (/^[\x00-\x7F]+$/.test(name) && name.length > 1) {
                text += name.charAt(1);
            }
            return text.toUpperCase();
        }

        _this.section = function (value) {
            return _app.section(value);
        };

        _this.activity = function (value) {
            return _app.activity(value);
        };

        _this.layout = function (value) {
            return _app.layout(value);
        };

        _this.rightCollapsed = function (value) {
            return _app.rightCollapsed(value);
        };

        _this.skin = function (value) {
            return _app.skin(value);
        };

        _this.state = function () {
            return _app.state();
        };

        _this.module = function (name) {
            return _modules[name];
        };

        _this.resize = function () {
            if (!_wrapper) {
                return;
            }
            for (var name in _modules) {
                if (_modules.hasOwnProperty(name) && _modules[name].resize) {
                    _modules[name].resize();
                }
            }
            _this.dispatchEvent(UIEvent.RESIZE, {
                width: _wrapper.clientWidth,
                height: _wrapper.clientHeight,
            });
        };

        _this.destroy = function (reason) {
            if (_destroyed) {
                return;
            }
            _destroyed = true;
            clearTimeout(_hideTimer);
            _disposeDynamic();
            _closeCall();
            _releaseKeys();
            if (document.fullscreenElement === _wrapper || document.webkitFullscreenElement === _wrapper) {
                _this.fullscreen(false);
            }
            _unbindDomEvents();
            _unbindAppEvents();
            for (var key in _nav) {
                if (_nav.hasOwnProperty(key)) {
                    _nav[key].removeEventListener('click', _onNavigation);
                }
            }
            if (_right && _right.toggle) {
                _right.toggle.removeEventListener('click', _onRightToggle);
            }
            if (_profileButton) {
                _profileButton.removeEventListener('click', _onProfileToggle);
            }
            if (_profileMenu) {
                var profileItems = _profileMenu.querySelectorAll('.app-profile-menu-item');
                for (var p = 0; p < profileItems.length; p++) {
                    profileItems[p].removeEventListener('click', _onProfileAction);
                }
            }
            for (var i = _mountCleanups.length - 1; i >= 0; i--) {
                try {
                    _mountCleanups[i]();
                } catch (err) {
                    _logger.warn('App mount cleanup failed: ' + err.message);
                }
            }
            _mountCleanups = [];
            if (_imWorkspace) {
                _imWorkspace.removeEventListener(MouseEvent.CLICK, _onWorkspaceAction);
            }
            for (var name in _modules) {
                if (!_modules.hasOwnProperty(name)) {
                    continue;
                }
                _modules[name].removeEventListener(MouseEvent.CLICK, _onModuleClick);
                _modules[name].removeEventListener(UIEvent.FULLPAGE, _onModuleDisplayMode);
                _modules[name].removeEventListener(UIEvent.FULLSCREEN, _onModuleDisplayMode);
                if (_modules[name].destroy) {
                    _modules[name].destroy(reason);
                }
            }
            _modules = {};
            if (_app) {
                _app.destroy(reason);
            }
            if (_container) {
                utils.emptyElement(_container);
            }
            delete _instances[id];
        };

        _init();
    }

    UI.prototype = Object.create(EventDispatcher.prototype);
    UI.prototype.constructor = UI;
    UI.prototype.CONF = _default;

    UI.get = function (id, logger) {
        if (id === null || id === undefined) {
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
