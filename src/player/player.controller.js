(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        Event = events.Event,
        IOEvent = events.IOEvent,
        MediaEvent = events.MediaEvent,
        SaverEvent = events.SaverEvent,
        Player = odd.Player;

    function Controller(model, view, logger) {
        EventDispatcher.call(this, 'Controller', { logger: logger }, Event, IOEvent);

        var _this = this,
            _logger = logger,
            _model,
            _view,
            _file,
            _option,
            _stalled,
            _retries,
            _retrying;

        function _init() {
            _model = model;
            _view = view;
            _stalled = 0;
            _retries = 0;
            _retrying = false;

            _view.addEventListener(Event.READY, _onReady);
            _view.addEventListener(Event.PLAY, _onStateChange);
            _view.addEventListener(Event.WAITING, _onStateChange);
            _view.addEventListener(IOEvent.LOADSTART, _onLoadStart);
            _view.addEventListener(IOEvent.OPEN, _this.forward);
            _view.addEventListener(IOEvent.PROGRESS, _this.forward);
            _view.addEventListener(IOEvent.SUSPEND, _this.forward);
            _view.addEventListener(IOEvent.STALLED, _this.forward);
            _view.addEventListener(IOEvent.ABORT, _this.forward);
            _view.addEventListener(IOEvent.TIMEOUT, _this.forward);
            _view.addEventListener(Event.DURATIONCHANGE, _onDurationChange);
            _view.addEventListener(Event.LOADEDMETADATA, _this.forward);
            _view.addEventListener(Event.LOADEDDATA, _this.forward);
            _view.addEventListener(Event.CANPLAY, _this.forward);
            _view.addEventListener(Event.PLAYING, _onStateChange);
            _view.addEventListener(Event.CANPLAYTHROUGH, _this.forward);
            _view.addEventListener(Event.PAUSE, _onStateChange);
            _view.addEventListener(Event.SEEKING, _onStateChange);
            _view.addEventListener(Event.SEEKED, _this.forward);
            _view.addEventListener(Event.SWITCHING, _onSwitching);
            _view.addEventListener(Event.SWITCHED, _this.forward);
            _view.addEventListener(Event.RATECHANGE, _onRateChange);
            _view.addEventListener(Event.TIMEUPDATE, _onTimeUpdate);
            _view.addEventListener(Event.VOLUMECHANGE, _this.forward);
            _view.addEventListener(IOEvent.LOAD, _this.forward);
            _view.addEventListener(IOEvent.LOADEND, _this.forward);
            _view.addEventListener(MediaEvent.INFOCHANGE, _onInfoChange);
            _view.addEventListener(MediaEvent.STATSUPDATE, _onStatsUpdate);
            _view.addEventListener(MediaEvent.SEI, _this.forward);
            _view.addEventListener(MediaEvent.SCREENSHOT, _this.forward);
            _view.addEventListener(SaverEvent.WRITERSTART, _this.forward);
            _view.addEventListener(SaverEvent.WRITEREND, _this.forward);
            _view.addEventListener(Event.ENDED, _onStateChange);
            _view.addEventListener(Event.ERROR, _onError);
        }

        _this.play = function (file, option) {
            if (file === undefined) {
                if (_model.state() === 'pause') {
                    _view.play();
                    return;
                }

                var current = _model.definition();
                if (current == null || !current.file) {
                    _this.dispatchEvent(Event.ERROR, { name: 'NotFoundError', message: 'No supported source url found.' });
                    return;
                }
                file = current.file;
                option = current;
            }
            _file = file;
            _option = option;
            _view.play(_file, _option);
        };

        _this.reload = function () {
            _view.stop();
            _this.play(_file, _option);
        };

        _this.destroy = function () {
            _model.config.maxRetries = 0;

            if (_view) {
                _view.destroy();
                _view.removeEventListener(Event.READY, _onReady);
                _view.removeEventListener(Event.PLAY, _onStateChange);
                _view.removeEventListener(Event.WAITING, _onStateChange);
                _view.removeEventListener(IOEvent.LOADSTART, _onLoadStart);
                _view.removeEventListener(IOEvent.OPEN, _this.forward);
                _view.removeEventListener(IOEvent.PROGRESS, _this.forward);
                _view.removeEventListener(IOEvent.SUSPEND, _this.forward);
                _view.removeEventListener(IOEvent.STALLED, _this.forward);
                _view.removeEventListener(IOEvent.ABORT, _this.forward);
                _view.removeEventListener(IOEvent.TIMEOUT, _this.forward);
                _view.removeEventListener(Event.DURATIONCHANGE, _onDurationChange);
                _view.removeEventListener(Event.LOADEDMETADATA, _this.forward);
                _view.removeEventListener(Event.LOADEDDATA, _this.forward);
                _view.removeEventListener(Event.CANPLAY, _this.forward);
                _view.removeEventListener(Event.PLAYING, _onStateChange);
                _view.removeEventListener(Event.CANPLAYTHROUGH, _this.forward);
                _view.removeEventListener(Event.PAUSE, _onStateChange);
                _view.removeEventListener(Event.SEEKING, _onStateChange);
                _view.removeEventListener(Event.SEEKED, _this.forward);
                _view.removeEventListener(Event.SWITCHING, _onSwitching);
                _view.removeEventListener(Event.SWITCHED, _this.forward);
                _view.removeEventListener(Event.RATECHANGE, _onRateChange);
                _view.removeEventListener(Event.TIMEUPDATE, _onTimeUpdate);
                _view.removeEventListener(Event.VOLUMECHANGE, _this.forward);
                _view.removeEventListener(IOEvent.LOAD, _this.forward);
                _view.removeEventListener(IOEvent.LOADEND, _this.forward);
                _view.removeEventListener(MediaEvent.INFOCHANGE, _onInfoChange);
                _view.removeEventListener(MediaEvent.STATSUPDATE, _onStatsUpdate);
                _view.removeEventListener(MediaEvent.SEI, _this.forward);
                _view.removeEventListener(MediaEvent.SCREENSHOT, _this.forward);
                _view.removeEventListener(SaverEvent.WRITERSTART, _this.forward);
                _view.removeEventListener(SaverEvent.WRITEREND, _this.forward);
                _view.removeEventListener(Event.ENDED, _onStateChange);
                _view.removeEventListener(Event.ERROR, _onError);
                _view = undefined;
            }
        };

        function _onReady(e) {
            _logger.log(e.data.kind + ' module is ready.');
            _onStateChange(e);
            _this.play(_file, _option);
        }

        function _onLoadStart(e) {
            _stalled = 0;
            _this.forward(e);
        }

        function _onDurationChange(e) {
            _model.duration(e.data.duration);
            _this.forward(e);
        }

        function _onSwitching(e) {
            var current = _model.definition();
            _logger.log('Switching definition ' + e.data.index + ': ' + current.file);

            var offset = 0;
            var video = _view.element();
            if (video) {
                offset = video.currentTime;
            }
            _onStateChange(e);
            _this.play(current.file, current);
            _view.seek(offset);
        }

        function _onRateChange(e) {
            var video = _view.element();
            if (video) {
                _logger.log('Rate change: ' + video.playbackRate);
            }
            _this.forward(e);
        }

        function _onTimeUpdate(e) {
            _model.setProperty('stats', {
                TimeStart: e.data.start,
                TimeEnd: e.data.buffered,
                Time: e.data.time,
                BufferLength: e.data.buffered - e.data.time,
            });
            _this.forward(e);
        }

        function _onInfoChange(e) {
            _model.setProperty('info', e.data.info);
            _this.forward(e);
        }

        function _onStatsUpdate(e) {
            _model.setProperty('stats', e.data.stats);
            _this.forward(e);
        }

        function _onError(e) {
            _logger.error(e.data.name + ': ' + e.data.message);

            // Ignore these specific errors.
            if ((function () {
                switch (e.data.name) {
                    case 'SecurityError':
                        if (e.data.message.indexOf('toDataURL') !== -1) {
                            return true;
                        }
                        break;
                }
                return false;
            })()) {
                _this.forward(e);
                return;
            }

            if (_retries++ < _model.config.maxRetries || _model.config.maxRetries === -1) {
                _logger.log('Retrying...');
                _retrying = true;
                setTimeout(_this.reload, _model.config.retrying);
            } else {
                _view.stop();
                _onStateChange(e);
            }
        }

        function _onStateChange(e) {
            var state = _model.state();

            // Don't switch from error state to ended.
            if (state === e.type || e.type === Event.ENDED && (state === Event.ERROR || _retrying)) {
                return;
            }

            _retrying = false;
            _model.state(e.type);

            switch (e.type) {
                case Event.WAITING:
                    _stalled++;
                    _model.setProperty('stats', { StalledTimes: _stalled });
                    _this.dispatchEvent(MediaEvent.STATSUPDATE, { stats: { StalledTimes: _stalled } });
                    break;
                case Event.ENDED:
                    _view.stop();
                    break;
            }
            _this.forward(e);
        }

        _init();
    }

    Controller.prototype = Object.create(EventDispatcher.prototype);
    Controller.prototype.constructor = Controller;

    Player.Controller = Controller;
})(odd);

