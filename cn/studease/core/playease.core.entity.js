(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core;
	
	core.entity = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('core.entity')),
			_model,
			_view,
			_controller;
		
		function _init() {
			_this.id = config.id;
			
			_this.model = _model = new core.model(config);
			_this.view = _view = new core.view(_model);
			_this.controller = _controller = new core.controller(_model, _view);
			
			_controller.addGlobalListener(_forward);
			
			_initializeAPI();
		}
		
		function _initializeAPI() {
			_this.onSWFState = _view.onSWFState;
			
			_this.play = _controller.play;
			_this.pause = _controller.pause;
			_this.reload = _controller.reload;
			_this.seek = _controller.seek;
			_this.stop = _controller.stop;
			_this.report = _controller.report;
			_this.mute = _controller.mute;
			_this.volume = _controller.volume;
			_this.hd = _controller.hd;
			_this.bullet = _controller.bullet;
			_this.fullpage = _controller.fullpage;
			_this.fullscreen = _controller.fullscreen;
			
			_this.getState = _model.getState;
			
			_this.shoot = _view.shoot;
			_this.resize = _view.resize;
		}
		
		_this.setup = function() {
			setTimeout(function() {
				_controller.setup();
			}, 0);
		};
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_this.destroy = function() {
			if (_controller) {
				_controller.stop();
			}
			if (_view) {
				_view.destroy();
			}
			if (_model) {
				_model.destroy();
			}
		};
		
		_init();
	};
})(playease);
