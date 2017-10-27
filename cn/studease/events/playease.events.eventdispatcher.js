(function(playease) {
	var utils = playease.utils,
		events = playease.events;
	
	events.eventdispatcher = function(id) {
		var _id = id,
			_listeners = {},
			_globallisteners = [];
		
		this.addEventListener = function(type, listener, count) {
			try {
				if (!utils.exists(_listeners[type])) {
					_listeners[type] = [];
				}
				
				if (utils.typeOf(listener) === 'string') {
					listener = (new Function('return ' + listener))();
				}
				_listeners[type].push({
					listener: listener,
					count: count || null
				});
			} catch (err) {
				utils.log('error', err);
			}
			return false;
		};
		
		this.removeEventListener = function(type, listener) {
			if (!_listeners[type]) {
				return;
			}
			try {
				if (listener === undefined) {
					_listeners[type] = [];
					return;
				}
				var i;
				for (i = 0; i < _listeners[type].length; i++) {
					if (_listeners[type][i].listener.toString() === listener.toString()) {
						_listeners[type].splice(i, 1);
						break;
					}
				}
			} catch (err) {
				utils.log('error', err);
			}
			return false;
		};
		
		this.hasEventListener = function(type) {
			return _listeners.hasOwnProperty(type);
		};
		
		this.addGlobalListener = function(listener, count) {
			try {
 				if (utils.typeOf(listener) === 'string') {
					listener = (new Function('return ' + listener))();
				}
				_globallisteners.push({
					listener: listener,
					count: count || null
				});
			} catch (err) {
				utils.log('error', err);
			}
			return false;
		};
		
		this.removeGlobalListener = function(listener) {
			if (!listener) {
				return;
			}
			try {
				var i;
				for (i = _globallisteners.length - 1; i >= 0; i--) {
					if (_globallisteners[i].listener.toString() === listener.toString()) {
						_globallisteners.splice(i, 1);
					}
				}
			} catch (err) {
				utils.log('error', err);
			}
			return false;
		};
		
		
		this.dispatchEvent = function(type, data) {
			if (!data) {
				data = {};
			}
			utils.extend(data, {
				id: _id,
				type: type,
				target: this,
				version: playease.version
			});
			if (playease.debug) {
				utils.log(type, data);
			}
			_dispatchEvent(_listeners[type], data, type);
			_dispatchEvent(_globallisteners, data, type);
		};
		
		function _dispatchEvent(listeners, data, type) {
			if (!listeners) {
				return;
			}
			for (var index = 0; index < listeners.length; index++) {
				var listener = listeners[index];
				if (listener) {
					if (listener.count !== null && --listener.count === 0) {
						delete listeners[index];
					}
					try {
						listener.listener(data);
					} catch (err) {
						utils.log('Error handling "' + type +
							'" event listener [' + index + ']: ' + err.toString(), listener.listener, data);
					}
				}
			}
		}
	};
})(playease);
