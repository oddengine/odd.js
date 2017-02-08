(function(playease) {
	var utils = playease.utils,
		events = playease.events;
	
	utils.loader = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('utils.loader')),
			_defaults = {
				method: 'GET',
				headers: {},
				mode: 'cors',
				cache: 'default'
			},
			_uri,
			_aborted;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			var headers = new Headers();
			for (var key in _this.config.headers) {
				headers.append(key, _this.config.headers[key]);
			}
			_this.config.headers = headers;
			
			_aborted = false;
		}
		
		_this.load = function(uri) {
			_uri = uri;
			
			if (!fetch) {
				_this.dispatchEvent(events.ERROR, { message: 'Loader error: Fetch is not supported.' });
				return;
			}
			
			fetch(_uri, _this.config).then(function(res) {
				if (_aborted) {
					_aborted = false;
					return;
				}
				
				if (res.ok && res.status >= 200 && res.status <= 299) {
					var len = res.headers.get('Content-Length');
					if (len) {
						len = parseInt(len);
						_this.dispatchEvent(events.PLAYEASE_CONTENT_LENGTH, { length: len });
					}
					
					return _this.pump(res.body.getReader());
				} else {
					_this.dispatchEvent(events.ERROR, { message: 'Loader error: Invalid http status(' + res.status + ' ' + res.statusText + ').' });
				}
			}).catch(function(e) {
				_this.dispatchEvent(events.ERROR, { message: 'Loader error: ' + e.message });
			});
		};
		
		_this.pump = function(reader) {
			return reader.read().then(function(res) {
				if (res.done) {
					_this.dispatchEvent(events.PLAYEASE_COMPLETE);
					return;
				}
				
				if (_aborted) {
					_aborted = false;
					return reader.cancel();
				}
				
				_this.dispatchEvent(events.PLAYEASE_PROGRESS, { data: res.value.buffer });
				
				return _this.pump(reader);
			}).catch(function(e) {
				_this.dispatchEvent(events.ERROR, { message: 'Loader error: Failed to read response data.' });
			});
		};
		
		_this.abort = function() {
			_aborted = true;
		};
		
		_init();
	};
})(playease);
