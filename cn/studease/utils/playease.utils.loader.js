(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		
		readystates = {
			UNINITIALIZED: 0,
			OPEN:          1,
			SENT:          2,
			LOADING:       3,
			DONE:          4
		};
	
	utils.loader = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('utils.loader')),
			_defaults = {
				method: 'GET',
				headers: {},
				mode: 'cors',
				credentials: 'omit',
				cache: 'default',
				redirect: 'follow'
			},
			_state,
			_url,
			_abort;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_state = readystates.UNINITIALIZED;
		}
		
		_this.load = function(url, start, end) {
			_url = url;
			
			if (!fetch) {
				_this.dispatchEvent(events.ERROR, { message: 'Loader error: Fetch is not supported.' });
				return;
			}
			
			var options = utils.extend({}, _this.config, {
				headers: new Headers(_this.config.headers)
			});
			
			_state = readystates.OPEN;
			
			Promise.race([
				new Promise(function(resolve, reject) {
					_abort = function() {
						reject({ message: 'Promise aborted.' });
					};
				})
				['catch'](function(e) {
					utils.log(e.message);
				}),
				
				fetch(_url, options)
				['then'](function(res) {
					if (_state == readystates.UNINITIALIZED) {
						return;
					}
					
					if (res.ok && res.status >= 200 && res.status <= 299) {
						var len = res.headers.get('Content-Length');
						if (len) {
							len = parseInt(len);
							_this.dispatchEvent(events.PLAYEASE_CONTENT_LENGTH, { length: len });
						}
						
						return _pump(res.body.getReader());
					} else {
						_this.dispatchEvent(events.ERROR, { message: 'Loader error: Invalid http status(' + res.status + ' ' + res.statusText + ').' });
					}
				})
				['catch'](function(e) {
					_this.dispatchEvent(events.ERROR, { message: 'Loader error: ' + e.message + '.' });
				})
			]);
		};
		
		function _pump(reader) {
			return reader.read()
				['then'](function(res) {
					if (res.done) {
						_state = readystates.DONE;
						_this.dispatchEvent(events.PLAYEASE_COMPLETE);
						return;
					}
					
					if (_state == readystates.UNINITIALIZED) {
						return reader.cancel();
					}
					
					_state = readystates.LOADING;
					_this.dispatchEvent(events.PLAYEASE_PROGRESS, { data: res.value.buffer });
					
					return _pump(reader);
				})
				['catch'](function(e) {
					_this.dispatchEvent(events.ERROR, { message: 'Loader error: Failed to read response data.' });
				});
		}
		
		_this.abort = function() {
			_state = readystates.UNINITIALIZED;
			
			if (_abort) {
				_abort();
			}
		};
		
		_init();
	};
	
	utils.loader.readystates = readystates;
})(playease);
