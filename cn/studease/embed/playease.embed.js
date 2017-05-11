(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		renderModes = playease.core.renders.modes;
	
	var embed = playease.embed = function(api) {
		var _this = utils.extend(this, new events.eventdispatcher('embed')),
			_config = {},
			_errorOccurred = false,
			_embedder = null;
		
		function _init() {
			utils.foreach(api.config.events, function(e, cb) {
				var fn = api[e];
				if (utils.typeOf(fn) === 'function') {
					fn.call(api, cb);
				}
			});
		}
		
		_this.embed = function() {
			try {
				_config = new embed.config(api.config);
				_embedder = new embed.embedder(api, _config);
			} catch (e) {
				utils.log('Failed to init embedder!');
				_this.dispatchEvent(events.PLAYEASE_SETUP_ERROR, { message: 'Failed to init embedder!', render: _config.render.name });
				return;
			}
			_embedder.addGlobalListener(_onEvent);
			_embedder.embed();
		};
		
		_this.errorScreen = function(message) {
			if (_errorOccurred) {
				return;
			}
			
			_errorOccurred = true;
			playease.api.displayError(message, _config);
		};
		
		_this.clearScreen = function() {
			_errorOccurred = false;
			playease.api.displayError('', _config);
		};
		
		function _onEvent(e) {
			switch (e.type) {
				case events.ERROR:
				case events.PLAYEASE_SETUP_ERROR:
				case events.PLAYEASE_RENDER_ERROR:
				case events.PLAYEASE_ERROR:
					utils.log('[ERROR] ' + e.message);
					_this.errorScreen(e.message);
					_this.dispatchEvent(events.ERROR, e);
					break;
					
				case events.PLAYEASE_VIEW_PLAY:
				case events.PLAYEASE_VIEW_RELOAD:
				case events.PLAYEASE_VIEW_SEEK:
					_this.clearScreen();
					break;
					
				default:
					_forward(e);
					break;
			}
		}
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_init();
	};
})(playease);
