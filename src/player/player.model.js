(function (odd) {
    var utils = odd.utils,
        Player = odd.Player;

    function Model(config, logger) {
        var _this = this,
            _logger = logger,
            _usermode,
            _state,
            _index,
            _duration,
            _properties;

        function _init() {
            _this.config = config;
            _usermode = _this.config.mode;
            _state = '';
            _duration = NaN;
            _properties = {};

            if (utils.typeOf(_this.config.sources) !== 'array') {
                _this.config.sources = [];
            }
            if (_this.config.file) {
                _this.config.sources = [{
                    file: _this.config.file,
                    module: _this.config.module,
                    loader: _this.config.loader,
                }];
            }
            _index = _this.config.sources.length ? 0 : NaN;

            for (var i = 0; i < _this.config.sources.length; i++) {
                var item = _this.config.sources[i];
                item.loader = utils.extendz({}, _this.config.loader, item.loader);

                var module = odd.module(item.file, item);
                if (module == null) {
                    _logger.warn('Ignored unsupported source url: ' + item.file + '.');
                    _this.config.sources.splice(i--, 1);
                    continue;
                }
                if (item['default']) {
                    _index = i;
                }
            }
            if (_this.config.sources.length === 0) {
                _logger.warn('No supported source url provided.');
            }
        }

        _this.definition = function (index) {
            if (utils.typeOf(index) === 'number' && index !== _index && index < _this.config.sources.length) {
                _logger.log('Model definition change: ' + index);
                _index = index;
            }
            return isNaN(_index) ? null : _this.config.sources[_index];
        };

        _this.duration = function (duration) {
            if (utils.typeOf(duration) === 'number') {
                if (duration !== _duration && !(isNaN(_duration) && isNaN(duration))) {
                    _logger.log('Model duration change: ' + duration);
                    // NaN -> Infinity: live
                    // NaN -> Number: vod
                    // Infinity -> NaN: live
                    // Infinity -> Number: live
                    // Number -> NaN: user config
                    // Number -> Infinity: live (should not happen)
                    // Number -> Number: live (Mac Safari)
                    if (isNaN(_duration) && duration !== Infinity) {
                        _this.config.mode = 'vod';
                    } else if (_duration !== Infinity && isNaN(duration)) {
                        _this.config.mode = _usermode;
                    } else {
                        _this.config.mode = 'live';
                    }
                    _duration = duration;
                }
            }
            return _duration;
        };

        _this.state = function (state) {
            if (utils.typeOf(state) === 'string' && state !== _state) {
                _logger.debug('State change: ' + state);
                _state = state;
            }
            return _state;
        };

        _this.setProperty = function (key, value) {
            var data = _properties[key];
            if (data === undefined) {
                _properties[key] = data = {};
            }
            utils.extendz(data, value);
        };

        _this.getProperty = function (key) {
            return _properties[key];
        };

        _init();
    }

    Player.Model = Model;
})(odd);

