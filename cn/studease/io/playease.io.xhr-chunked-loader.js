(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		io = playease.io,
		modes = io.modes,
		credentials = io.credentials,
		caches = io.caches,
		redirects = io.redirects,
		responseTypes = io.responseTypes,
		readystates = io.readystates;
	
	io['xhr-chunked-loader'] = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('utils.xhr-chunked-loader')),
			_defaults = {
				method: 'GET',
				headers: {},
				mode: modes.CORS,
				credentials: credentials.OMIT,
				cache: caches.DEFAULT,
				redirect: redirects.FOLLOW,
				chunkSize: 0,
				responseType: responseTypes.TEXT
			},
			_state,
			_url,
			_xhr,
			_range,
			_filesize;
		
		function _init() {
			_this.name = io.types.XHR_CHUNKED_LOADER;
			
			_this.config = utils.extend({}, _defaults, config);
			
			_state = readystates.UNINITIALIZED;
			_range = { start: 0, end: '', position: 0 };
			_filesize = Number.MAX_VALUE;
		}
		
		_this.load = function(url, start, end) {
			_url = url;
			
			if (!io[_this.name].isSupported(url)) {
				_this.dispatchEvent(events.ERROR, { message: 'Loader error: ' + _this.name + ' is not supported.' });
				return;
			}
			
			_xhr = new XMLHttpRequest();
			_xhr.open(_this.config.method, _url, true);
			_xhr.responseType = _this.config.responseType;
			_xhr.onreadystatechange = _onXHRReadyStateChange;
			_xhr.onprogress = _onXHRProgress;
			_xhr.onload = _onXHRLoad;
			_xhr.onerror = _onXHRError;
			
			if (start || end) {
				_range.start = _range.position = start;
				_range.end = Math.min(end, _filesize);
				
				if (_range.position >= _range.end) {
					return;
				}
			}
			if (_range.start || _range.end || _this.config.chunkSize) {
				utils.extend(_this.config.headers, {
					Range: 'bytes=' + _range.position + '-' + Math.min(_range.end, _range.position + _this.config.chunkSize - 1)
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
					if (!_this.config.headers.Range) {
						return;
					}
					
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
					
					if (len && len != _filesize) {
						_filesize = len;
						_this.dispatchEvent(events.PLAYEASE_CONTENT_LENGTH, { length: len || 0 });
					}
				} else {
					_this.dispatchEvent(events.ERROR, { message: 'Loader error: Invalid http status(' + _xhr.status + ' ' + _xhr.statusText + ').' });
				}
			}
		}
		
		function _onXHRProgress(e) {
			/* void */
		}
		
		function _onXHRLoad(e) {
			var data, len;
			
			switch (_xhr.responseType) {
				case responseTypes.ARRAYBUFFER:
					var arr = new Uint8Array(_xhr.response);
					data = arr.buffer;
					len = data.byteLength;
					break;
					
				case responseTypes.BLOB:
					// TODO: read blob.
					break;
					
				default:
					data = _xhr.response;
					len = data.length;
					break;
			}
			
			_range.position += len;
			_this.dispatchEvent(events.PLAYEASE_PROGRESS, { data: data });
			
			var end = _range.end ? Math.min(_range.end, _filesize - 1) : _filesize - 1;
			if (!_this.config.headers.Range || _range.position >= _filesize || _range.position > end) {
				_this.dispatchEvent(events.PLAYEASE_COMPLETE);
				return;
			}
			
			utils.extend(_this.config.headers, {
				Range: 'bytes=' + _range.position + '-' + Math.min(_range.end, _range.position + _this.config.chunkSize - 1)
			});
			
			_xhr.open(_this.config.method, _url, true);
			_xhr.setRequestHeader('Range', _this.config.headers.Range);
			_xhr.send();
		}
		
		function _onXHRError(e) {
			_this.dispatchEvent(events.ERROR, { message: 'Loader error: ' + e.message });
		}
		
		_this.abort = function() {
			_state = readystates.DONE;
			
			if (_xhr) {
				_xhr.abort();
			}
		};
		
		_this.state = function() {
			return _state;
		};
		
		_init();
	};
	
	io['xhr-chunked-loader'].isSupported = function(file) {
		var protocol = utils.getProtocol(file);
		if (protocol != 'http' && protocol != 'https') {
			return false;
		}
		
		return true;
	};
})(playease);
