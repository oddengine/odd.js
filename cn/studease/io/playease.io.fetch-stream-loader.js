(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		io = playease.io,
		modes = io.modes,
		credentials = io.credentials,
		caches = io.caches,
		redirects = io.redirects,
		readystates = io.readystates;
	
	io['fetch-stream-loader'] = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('utils.fetch-stream-loader')),
			_defaults = {
				method: 'GET',
				headers: {},
				mode: modes.CORS,
				credentials: credentials.OMIT,
				cache: caches.DEFAULT,
				redirect: redirects.FOLLOW
			},
			_state,
			_url,
			_abort;
		
		function _init() {
			_this.name = io.types.FETCH_STREAM_LOADER;
			
			_this.config = utils.extend({}, _defaults, config);
			
			_state = readystates.UNINITIALIZED;
			_abort = undefined;
		}
		
		_this.load = function(url, start, end) {
			_url = url;
			
			if (!io[_this.name].isSupported(url)) {
				_this.dispatchEvent(events.ERROR, { message: 'Loader error: fetch-stream-loader is not supported.' });
				return;
			}
			
			_state = readystates.OPEN;
			
			if (start || end) {
				utils.extend(_this.config.headers, {
					Range: 'bytes=' + start + '-' + end
				});
			}
			
			var options = utils.extend({}, _this.config, {
				headers: new Headers(_this.config.headers)
			});
			
			Promise.race([
				new Promise(function(resolve, reject) {
					_abort = function() {
						reject(new Error('Loader aborted.'));
					};
				})
				['catch'](function(e) {
					utils.log(e.message);
				}),
				
				fetch(_url, options)
				['then'](function(res) {
					if (_state == readystates.UNINITIALIZED) {
						return Promise.reject(new Error('Promise rejected.'));
					}
					
					if (res.ok && res.status >= 200 && res.status <= 299) {
						var len = res.headers.get('Content-Length');
						if (len) {
							len = parseInt(len);
						}
						
						if (res.status == 206) {
							var range = res.headers.get('Content-Range');
							if (range) {
								var arr = range.match(/bytes (\d*)\-(\d*)\/(\d+)/i);
								if (arr && arr.length > 3) {
									len = parseInt(arr[3]);
								}
							}
						}
						
						_this.dispatchEvent(events.PLAYEASE_CONTENT_LENGTH, { length: len || 0 });
						
						return _pump(res.body.getReader());
					} else {
						_this.dispatchEvent(events.ERROR, { message: 'Loader error: Invalid http status(' + res.status + ' ' + res.statusText + ').' });
						return Promise.reject(new Error('Promise rejected.'));
					}
				})
				['catch'](function(e) {
					_this.dispatchEvent(events.ERROR, { message: 'Loader error: ' + e.message });
				})
			]);
		};
		
		function _pump(reader) {
			return reader.read()
				['then'](function(res) {
					if (res.done) {
						_state = readystates.DONE;
						_this.dispatchEvent(events.PLAYEASE_COMPLETE);
						return Promise.resolve('Loader completed.');
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
				_abort.apply(null);
			}
		};
		
		_this.state = function() {
			return _state;
		};
		
		_init();
	};
	
	io['fetch-stream-loader'].isSupported = function(file) {
		var protocol = utils.getProtocol(file);
		if (protocol != 'http' && protocol != 'https') {
			return false;
		}
		
		if (!utils.isChrome() || !fetch) {
			return false;
		}
		
		return true;
	};
})(playease);
