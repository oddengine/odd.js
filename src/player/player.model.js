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

            _program = config.playlist.length ? config.playlist[0] : null;
            _definition = 0;
            _duration = NaN;
            _state = '';
            _properties = {};
        }

        _this.program = function (program) {
            if (utils.typeOf(program) === 'number') {
                if (program < 0 || program % 1 !== 0 || program >= _this.config.playlist.length) {
                    _logger.error('The program index is not in the allowed range.');
                    return _program;
                }
                program = _this.config.playlist[program];
            }
            if (program && program !== _program) {
                _program = program;
                _definition = 0;
                _duration = NaN;
            }
            return _program;
        };

        _this.definition = function (index) {
            if (utils.typeOf(index) === 'number' && index !== _definition) {
                if (!_program || utils.typeOf(_program.sources) !== 'array' || index < 0 || index % 1 !== 0 || index >= _program.sources.length) {
                    _logger.error('The definition index is not in the allowed range.');
                    return _definition;
                }
                _logger.log('Definition change: ' + index);
                _definition = index;
            }
            return _definition;
        };

        _this.duration = function (duration) {
            if (utils.typeOf(duration) === 'number' && duration !== _duration) {
                _logger.log('Duration change: ' + duration);
                if (_program && !isNaN(duration)) {
                    _program.vod = isFinite(duration) && duration > 0;
                }
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

