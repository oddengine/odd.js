(function(playease) {
	var io = playease.io = {};
	
	io.modes = {
		CORS:        'cors',
		NO_CORS:     'no-cors',
		SAME_ORIGIN: 'same-origin'
	},
	io.credentials = {
		OMIT:        'omit',
		INCLUDE:     'include',
		SAME_ORIGIN: 'same-origin'
	},
	io.caches = {
		DEFAULT:        'default',
		NO_STAORE:      'no-store',
		RELOAD:         'reload',
		NO_CACHE:       'no-cache',
		FORCE_CACHE:    'force-cache',
		ONLY_IF_CACHED: 'only-if-cached'
	},
	io.redirects = {
		FOLLOW: 'follow',
		MANUAL: 'manual',
		ERROR:  'error'
	},
	io.responseTypes = {
		ARRAYBUFFER: 'arraybuffer',
		BLOB:        'blob',
		DOCUMENT:    'document',
		JSON:        'json',
		TEXT:        'text'
	},
	io.readystates = {
		UNINITIALIZED: 0,
		OPEN:          1,
		SENT:          2,
		LOADING:       3,
		DONE:          4
	},
	
	io.types = {
		FETCH_STREAM_LOADER:   'fetch-stream-loader',
		XHR_MS_STREAM_LOADER:  'xhr-ms-stream-loader',
		XHR_MOZ_STREAM_LOADER: 'xhr-moz-stream-loader',
		XHR_CHUNKED_LOADER:    'xhr-chunked-loader',
		WEBSOCKET_LOADER:      'websocket-loader'
	},
	
	io.priority = [
		io.types.FETCH_STREAM_LOADER,
		io.types.XHR_MS_STREAM_LOADER,
		io.types.XHR_MOZ_STREAM_LOADER,
		io.types.XHR_CHUNKED_LOADER,
		io.types.WEBSOCKET_LOADER
	];
})(playease);
