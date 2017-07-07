(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		io = playease.io,
		modes = io.modes,
		credentials = io.credentials,
		caches = io.caches,
		redirects = io.redirects,
		readystates = io.readystates;
	
	io['xhr-moz-stream-loader'] = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('utils.xhr-moz-stream-loader')),
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
			_xhr;
		
		function _init() {
			_this.name = io.types.XHR_MOZ_STREAM_LOADER;
			
			_this.config = utils.extend({}, _defaults, config);
			
			_state = readystates.UNINITIALIZED;
		}
		
		_this.load = function(url, start, end) {
			_url = url;
			
			if (!io[_this.name].isSupported(url)) {
				_this.dispatchEvent(events.ERROR, { message: 'Loader error: ' + _this.name + ' is not supported.' });
				return;
			}
			
			_xhr = new XMLHttpRequest();
			_xhr.open(_this.config.method, _url, true);
			_xhr.responseType = 'moz-chunked-arraybuffer';
			_xhr.onreadystatechange = _onXHRReadyStateChange;
			_xhr.onprogress = _onXHRProgress;
			_xhr.onloadend = _onXHRLoadend;
			_xhr.onerror = _onXHRError;
			
			if (start || end) {
				utils.extend(_this.config.headers, {
					Range: 'bytes=' + start + '-' + end
				});
			}
			
			utils.foreach(_this.config.headers, function(key, value) {
				_xhr.setRequestHeader(key, value);
			});
			
			switch (_this.config.credentials) {
				case credentials.INCLUDE:
					_xhr.withCredentials = true;
					break;
				case credentials.SAME_ORIGIN:
					_xhr.withCredentials = window.location.host == utils.getOrigin(_url);
					break;
				default:
					_xhr.withCredentials = false;
			}
			
			_xhr.send();
		};
		
		function _onXHRReadyStateChange(e) {
			_state = _xhr.readyState;
			
			if (_xhr.readyState == readystates.SENT) {
				if (_xhr.status >= 200 && _xhr.status <= 299) {
					var len = _xhr.getResponseHeader('Content-Length');
					if (len) {
						len = parseInt(len);
					}
					
					if (_xhr.status == 206) {
						var range = _xhr.getResponseHeader('Content-Range');
						if (range) {
							var arr = range.match(/bytes (\d*)\-(\d*)\/(\d+)/i);
							if (arr && arr.length > 3) {
								len = parseInt(arr[3]);
							}
						}
					}
					
					_this.dispatchEvent(events.PLAYEASE_CONTENT_LENGTH, { length: len || 0 });
				} else {
					_this.dispatchEvent(events.ERROR, { message: 'Loader error: Invalid http status(' + _xhr.status + ' ' + _xhr.statusText + ').' });
				}
			}
		}
		
		function _onXHRProgress(e) {
			var data = new Uint8Array(_xhr.response);
			_this.dispatchEvent(events.PLAYEASE_PROGRESS, { data: data.buffer });
		}
		
		function _onXHRLoadend(e) {
			_this.dispatchEvent(events.PLAYEASE_COMPLETE);
		}
		
		function _onXHRError(e) {
			_this.dispatchEvent(events.ERROR, { message: 'Loader error: ' + e.message });
		}
		
		_this.abort = function() {
			_state = readystates.UNINITIALIZED;
			
			if (_xhr) {
				_xhr.abort();
			}
		};
		
		_this.state = function() {
			return _state;
		};
		
		_init();
	};
	
	io['xhr-moz-stream-loader'].isSupported = function(file) {
		var protocol = utils.getProtocol(file);
		if (protocol != 'http' && protocol != 'https') {
			return false;
		}
		
		return utils.isFirefox();
	};
})(playease);
