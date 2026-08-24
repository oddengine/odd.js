(function (odd) {
    var utils = odd.utils,
        Player = odd.Player;

    function Model(config, logger) {
        var _this = this,
            _logger = logger,
            _program,
            _definition,
            _duration,
            _state,
            _properties;

        function _init() {
            _this.config = config;

            _program = 0;
            _definition = 0;
            _duration = NaN;
            _state = '';
            _properties = {};
        }

        _this.program = function (index) {
            if (utils.typeOf(index) === 'number' && index !== _program && index < _this.config.playlist.length) {
                _logger.log('Program change: ' + index);
                _program = index;
            }
            return _program < _this.config.playlist.length ? _this.config.playlist[_program] : null;
        };

        _this.definition = function (index) {
            if (utils.typeOf(index) === 'number' && index !== _definition && index < _this.config.playlist[_program].sources.length) {
                _logger.log('Definition change: ' + index);
                _definition = index;
            }
            return _definition;
        };

        _this.duration = function (duration) {
            if (utils.typeOf(duration) === 'number' && duration !== _duration) {
                _logger.log('Duration change: ' + duration);
                _this.config.playlist[_program].vod = !!duration;
                _duration = duration;
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

