(function (odd) {
    var utils = odd.utils,
        Kernel = odd.Kernel,
        css = utils.css,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        NetStatusEvent = events.NetStatusEvent,
        MouseEvent = events.MouseEvent,
        Level = events.Level,
        Code = events.Code,
        RTC = odd.RTC,
        Constraints = RTC.Constraints,
        UI = RTC.UI,

        CLASS_USERLIST = 'pe-userlist',

        _default = {
            kind: 'Userlist',
            title: 'Userlist',
            visibility: true,
        };

    function Userlist(config, logger) {
        EventDispatcher.call(this, 'Userlist', { logger: logger }, MouseEvent);

        var _this = this,
            _logger = logger,
            _container,
            _list,
            _api,
            _index = NaN;

        function _init() {
            _this.config = config;
            _this.constraints = utils.extendz({}, Constraints[_this.config.profile || '180P_1']);
            _this.components = {};

            _container = utils.createElement('section', CLASS_USERLIST);

            _list = utils.createElement('div');
            _container.appendChild(_list);

            _api = RTC.get(_this.config.id, _logger);
            _api.addEventListener(NetStatusEvent.NETSTATUS, _onStatus);
            _api.addEventListener(Event.CLOSE, _onClose);
        }

        _this.applyConstraints = function (constraints) {
            _this.constraints = utils.extendz(_this.constraints, constraints);
            utils.forEach(_api.publishers, function (_, ns) {
                ns.applyConstraints(_this.constraints);
            });
        };

        _this.publish = async function () {
            for (var id in _api.publishers) {
                _logger.error(`Already published: user=${_userId()}`);
                return Promise.reject('published');
            }
            return _api.publish(_this.constraints).then(function (ns) {
                ns.addEventListener(Event.RELEASE, function (e) {
                    var video = e.srcElement.video;
                    video.removeEventListener('click', _onClick);
                    _detachVideo(video);
                });

                var video = ns.video;
                video.addEventListener('click', _onClick);
                video.muted = true;
                video.srcObject = ns.stream;
                video.play().catch(function (err) {
                    _logger.warn(`${err}`);
                });
                _list.appendChild(video);

                if (_this.constraints.video && !Kernel.isAppleWebKit) {
                    ns.beauty(true, {
                        brightness: 0.5,
                        smoothness: 1.0,
                    });
                }
            }).catch(function (err) {
                _logger.warn(`${err}`);
            });
        };

        _this.play = async function (name) {
            if (name === '') {
                _logger.warn('Stream id is empty.');
                return Promise.resolve();
            }
            return _api.play(name).then(function (ns) {
                ns.addEventListener(NetStatusEvent.NETSTATUS, function (e) {
                    switch (e.data.code) {
                        case Code.NETSTREAM_PLAY_START:
                            _attachVideo(e.srcElement, e.data.info.streams[0]);
                            break;
                    }
                });
                ns.addEventListener(Event.RELEASE, function (e) {
                    _detachVideo(e.srcElement.video);
                });
                if (ns.stream) {
                    _attachVideo(ns, ns.stream);
                }
            }).catch(function (err) {
                _logger.warn(`${err}`);
            });
        };

        _this.stop = function () {
            _api.stop();
        };

        function _onStatus(e) {
            var level = e.data.level;
            var code = e.data.code;
            var description = e.data.description;
            var info = e.data.info;
            var method = { status: 'log', warning: 'warn', error: 'error' }[level];
            _logger[method](`RTC.onStatus: user=${_userId()}, level=${level}, code=${code}, description=${description}, info=`, info);
            _this.forward(e);
        }

        function _onClose(e) {
            _logger.log(`RTC.onClose: user=${_userId()}, reason=${e.data.reason}`);
            _this.forward(e);
        }

        function _userId() {
            var client = _api.client();
            if (client && client.userId) {
                return client.userId();
            }
            return '';
        }

        function _attachVideo(ns, stream) {
            var video = ns.video;
            video.addEventListener('click', _onClick);
            video.srcObject = stream;

            video.play().catch(function (err) {
                switch (err.name) {
                    case 'AbortError':
                        _logger.debug(err.name + ': ' + err.message);
                        break;
                    case 'NotAllowedError':
                        if (video.muted == false) {
                            video.muted = true;
                            video.play().catch(function (err) {
                                _logger.warn(`${err}`);
                            });
                            break;
                        }
                    default:
                        _logger.error('Unexpected error occured, ' + err.name + ': ' + err.message);
                        break;
                }
            });
            video.controls = false;

            if (video.parentNode !== _playlist) {
                _playlist.appendChild(video);
            }
        }

        function _detachVideo(video) {
            if (video) {
                video.removeEventListener('click', _onClick);
                if (video.parentNode) {
                    video.parentNode.removeChild(video);
                }
            }
        }

        function _onClick(e) {
            // _this.dispatchEvent(MouseEvent.CLICK, { name: '' });
            // e.preventDefault();
        }

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _this.destroy = function () {
            utils.forEach(_this.components, function (_, component) {
                component.removeGlobalListener(_this.forward);
                component.destroy();
            });
            _this.components = {};
        };

        _init();
    }

    Userlist.prototype = Object.create(EventDispatcher.prototype);
    Userlist.prototype.constructor = Userlist;
    Userlist.prototype.kind = 'Userlist';
    Userlist.prototype.CONF = _default;

    UI.register(Userlist);
})(odd);

