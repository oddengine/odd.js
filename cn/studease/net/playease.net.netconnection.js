(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		net = playease.net,
		status = net.netstatus,
		
		packages = {
			AUDIO:  0x08,
			VIDEO:  0x09,
			SCRIPT: 0x12
		},
		commands = {
			PLAY:    0x000001, // name, start = -2, length = -1, reset = 1
			PLAY2:   0x000002,
			RESUME:  0x000003,
			PAUSE:   0x000004,
			SEEK:    0x000005, // offset
			CLOSE:   0x000006,
			DISPOSE: 0x000007,
			
			PUBLISH: 0x000010, // name = null, type = live
			
			ON_META_DATA: 'onMetaData'
		};
	
	net.netconnection = function() {
		var _this = utils.extend(this, new events.eventdispatcher('net.netconnection')),
			_websocket,
			_connected,
			_uri,
			_protocol,
			_responders,
			_requestId;
		
		function _init() {
			_connected = false;
			_responders = {};
			_requestId = 0;
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
		
		_this.send = function(type, command, responder, data) {
			if (type !== packages.AUDIO && type !== packages.VIDEO && type !== packages.SCRIPT) {
				throw 'Failed to send package: Unknown type ' + type + '.';
				return;
			}
			
			if (_connected == false) {
				_this.dispatchEvent(events.PLAYEASE_IO_ERROR, { message: 'Connection not connected!' });
				return;
			}
			
			if (responder) {
				_responders[++_requestId] = responder;
			}
			if (utils.typeOf(data) == 'object') {
				data.req = _requestId;
			}
			
			var body = new Uint8Array(data);
			var ab = new Uint8Array(4 + body.byteLength);
			
			var pos = 0;
			ab[pos++] = type;
			ab[pos++] = command >>> 16;
			ab[pos++] = command >>> 8;
			ab[pos++] = command;
			ab.set(body, pos);
			
			_websocket.send(ab.buffer);
		};
		
		function _onOpen(e) {
			_connected = true;
			_this.dispatchEvent(events.PLAYEASE_NET_STATUS, { info: { level: 'status', code: status.NETCONNECTION_CONNECT_SUCCESS } });
		}
		
		function _onMessage(e) {
			var data = new Uint8Array(e.data);
			
			var pos = 0;
			var type = data[pos++];
			
			switch (type) {
				case packages.AUDIO:
				case packages.VIDEO:
					pos += 3; // skip 3 bytes of command
					
					var evttype = events.PLAYEASE_MP4_SEGMENT;
					if (data[pos] === 0x69 && data[pos + 1] === 0x73 && data[pos + 2] === 0x6F && data[pos + 3] === 0x6D) { // is ftyp box
						evttype = events.PLAYEASE_MP4_INIT_SEGMENT;
					}
					
					var segtype = type == packages.AUDIO ? 'audio' : 'video';
					var seg = new Uint8Array(data, pos);
					
					_this.dispatchEvent(evttype, { tp: segtype, data: seg });
					break;
					
				case packages.SCRIPT:
					var command = 0;
					command |= data[pos++] << 16;
					command |= data[pos++] << 8;
					command |= data[pos++];
					
					var tmp = new Uint8Array(data, pos);
					var str = String.fromCharCode.apply(null, tmp);
					
					var info = JSON.parse(str);
					if (info.req && _responders.hasOwnProperty(info.req)) {
						var responder = _responders[info.req];
						
						var fn = responder.result;
						if (info.level == 'error') {
							fn = responder.status;
						}
						
						if (fn) {
							fn.call(null, info);
						}
						
						delete _responders[info.req];
					}
					
					delete info.req;
					
					_this.dispatchEvent(events.PLAYEASE_NET_STATUS, { info: info });
					break;
					
				default:
					utils.log('Got an unknown package: ' + type + '.');
					break;
			}
		}
		
		function _onError(e) {
			_connected = false;
			_this.dispatchEvent(events.PLAYEASE_IO_ERROR, { message: 'Connection error occurred!' });
		}
		
		function _onClose(e) {
			_connected = false;
			_this.dispatchEvent(events.PLAYEASE_NET_STATUS, { info: { level: 'status', code: status.NETCONNECTION_CONNECT_CLOSED } });
		}
		
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
	
	net.netconnection.packages = packages;
	net.netconnection.commands = commands;
})(playease);
