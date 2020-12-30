(function (playease) {
    var utils = playease.utils,
        OS = playease.OS,
        Kernel = playease.Kernel,
        Browser = playease.Browser,
        FileSaver = utils.FileSaver,

        Level = {
            DEBUG: 0x00,
            LOG: 0x10,
            WARN: 0x20,
            ERROR: 0x40,
        },
        Prefix = {
            0x00: '[DEBUG]',
            0x10: '[L O G]',
            0x20: '[WARN ]',
            0x40: '[ERROR]',
        },
        Mode = {
            CONSOLE: 0x00,
            FILE: 0x01,
            FEEDBACK: 0x02,
        },
        _default = {
            level: 'log',    // debug, log, warn, error
            mode: 'console', // console, file, feedback
            maxLines: 60,
        };

    function getLevel(level) {
        return {
            debug: Level.DEBUG,
            log: Level.LOG,
            warn: Level.WARN,
            error: Level.ERROR,
        }[level];
    }

    function getMode(mode) {
        return {
            console: Mode.CONSOLE,
            file: Mode.FILE,
            feedback: Mode.FEEDBACK,
        }[mode];
    }

    function getTime() {
        var date = new Date();
        return utils.padStart(date.getHours(), 2, '0') + ':' +
            utils.padStart(date.getMinutes(), 2, '0') + ':' +
            utils.padStart(date.getSeconds(), 2, '0') + '.' +
            utils.padStart(date.getMilliseconds(), 3, '0');
    }

    function Logger(id, config) {
        var _this = this,
            _prefix,
            _lines,
            _saver;

        function _init() {
            _this.id = id;
            _this.config = utils.extendz({ id: _this.id }, _default, config);
            _this.config.level = getLevel(_this.config.level);
            _this.config.mode = getMode(_this.config.mode);

            _prefix = '[ID:' + utils.padStart(_this.id, 2, '0') + ']';

            playease.DEBUG = _this.config.level === Level.DEBUG;
            if (_this.config.mode >= Mode.FILE) {
                _lines = [];
                _saver = new FileSaver({ filename: 'playease.log', type: 'text/plain' });
            }

            _append(Level.LOG, ['Version: playease/' + playease.VERSION]);
            _append(Level.LOG, ['OS:      ' + OS.name + '/' + OS.version + (OS.model ? '; ' + OS.model : '')]);
            _append(Level.LOG, ['Kernel:  ' + Kernel.name + '/' + Kernel.version]);
            _append(Level.LOG, ['Browser: ' + Browser.name + '/' + Browser.version]);
        }

        _this.debug = function () {
            if (_this.config.level <= Level.DEBUG) {
                var args = Array.prototype.slice.call(arguments, 0);
                utils.debug.apply(utils, [_prefix].concat(args));
                _append(Level.DEBUG, args);
            }
        };

        _this.log = function () {
            if (_this.config.level <= Level.LOG) {
                var args = Array.prototype.slice.call(arguments, 0);
                utils.log.apply(utils, [_prefix].concat(args));
                _append(Level.LOG, args);
            }
        };

        _this.warn = function () {
            if (_this.config.level <= Level.WARN) {
                var args = Array.prototype.slice.call(arguments, 0);
                utils.warn.apply(utils, [_prefix].concat(args));
                _append(Level.WARN, args);
            }
        };

        _this.error = function () {
            if (_this.config.level <= Level.ERROR) {
                var args = Array.prototype.slice.call(arguments, 0);
                utils.error.apply(utils, [_prefix].concat(args));
                _append(Level.ERROR, args);
            }
        };

        _this.flush = function () {
            var api = playease(_this.id);
            utils.forEach(['info', 'stats'], function (i, key) {
                var data = api.getProperty(key) || {};
                _this.log(key + ':', data);
            });

            switch (_this.config.mode) {
                case Mode.FILE:
                    var date = new Date();
                    var time = date.getFullYear() +
                        utils.padStart(date.getMonth() + 1, 2, '0') +
                        utils.padStart(date.getDate(), 2, '0') + '-' +
                        utils.padStart(date.getHours(), 2, '0') +
                        utils.padStart(date.getMinutes(), 2, '0') +
                        utils.padStart(date.getSeconds(), 2, '0') + '.' +
                        utils.padStart(date.getMilliseconds(), 3, '0');
                    utils.forEach(_lines, function (i, line) {
                        _saver.append(line);
                    });
                    _saver.save('playease-' + time + '.log');
                    break;
                case Mode.FEEDBACK:
                    // TODO(spencer-lau): Post to service.
                    break;
            }
            _lines = [];
        };

        function _append(level, args) {
            if (_this.config.mode >= Mode.FILE) {
                var line = _getLine(level, args);
                switch (_this.config.mode) {
                    case Mode.FILE:
                    case Mode.FEEDBACK:
                        if (_lines.length >= _this.config.maxLines) {
                            _lines.splice(0, _this.config.maxLines / 4);
                        }
                        _lines.push(line);
                        break;
                }
            }
        }

        function _getLine(level, args) {
            var line = getTime() + ' ' + Prefix[level];
            utils.forEach(args, function (i, item) {
                switch (utils.typeOf(item)) {
                    case 'object':
                        line += ' ' + JSON.stringify(item);
                        break;
                    default:
                        line += ' ' + item;
                        break;
                }
            });
            line += '\n';
            return line;
        }

        _init();
    }

    Logger.prototype.CONF = _default;

    Logger.Level = Level;
    Logger.Prefix = Prefix;
    Logger.Mode = Mode;
    utils.Logger = Logger;
})(playease);

