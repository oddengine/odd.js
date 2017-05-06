(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		net = playease.net,
		status = net.netstatus;
	
	net.netconnection = function() {
		var _this = utils.extend(this, new events.eventdispatcher('net.netconnection')),
			_websocket,
			_connected,
			_uri,
			_protocol;
		
		function _init() {
			_connected = false;
		}
		
		_this.connect = function(uri) {
			_uri = uri;
			
			if (_uri === undefined || _uri === null) {
				// http mode
				return;
			}
			
			try {
				window.WebSocket = window.WebSocket || window.MozWebSocket;
				_websocket = new WebSocket(_uri);
				_websocket.binaryType = 'arrayBuffer';
			} catch (err) {
				utils.log('Failed to initialize websocket: ' + err);
				return;
			}
			
			_websocket.onopen = _onOpen;
			_websocket.onmessage = _onMessage;
			_websocket.onerror = _onError;
			_websocket.onclose = _onClose;
		};
		
		function _onOpen(e) {
			_connected = true;
			_this.dispatchEvent(events.PLAYEASE_NET_STATUS, { info: { code: status.NETCONNECTION_CONNECT_SUCCESS } });
		}
		
		function _onMessage(e) {
			
		}
		
		function _onError(e) {
			_connected = false;
			_this.dispatchEvent(events.PLAYEASE_IO_ERROR, { message: 'IO error occurred!' });
		}
		
		function _onClose(e) {
			_connected = false;
			_this.dispatchEvent(events.PLAYEASE_NET_STATUS, { info: { code: status.NETCONNECTION_CONNECT_CLOSED } });
		}
		
		_this.callremote = function(command, responder) {
			
		};
		
		_this.close = function() {
			if (_websocket) {
				_websocket.close();
			}
			if (_connected) {
				_onClose();
			}
		};
		
		_this.connected = function() {
			return _connected;
		};
		
		_this.uri = function() {
			return _uri;
		};
		
		_this.protocol = function() {
			return _protocol;
		};
		
		_init();
	};
})(playease);
