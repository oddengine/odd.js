(function(playease) {
	var utils = playease.utils,
		crypt = utils.crypt,
		events = playease.events,
		net = playease.net,
		rtmp = net.rtmp,
		
		PACKET_SIZE = 1536,
		states = {
			C0:       0x01,
			C1:       0x02,
			S0:       0x04,
			S1:       0x08,
			S2:       0x10,
			C2:       0x20,
			COMPLETE: 0x3F
		};
	
	rtmp.handshaker = function(websocket) {
		var _this = utils.extend(this, new events.eventdispatcher('rtmp.handshaker')),
			_websocket,
			_complex,
			_state,
			_c1,
			_s1;
		
		function _init() {
			_websocket = websocket;
			_websocket.onmessage = _onMessage;
			_websocket.onerror = _onError;
			_websocket.onclose = _onClose;
			
			_state = 0x00;
		}
		
		_this.shake = function(complex) {
			_complex = complex;
			
			_this.dispatchEvent(events.PLAYEASE_COMPLETE);
			return;
			
			if (_complex == false) {
				_simpleHandshake();
			} else {
				_complexHandshake();
			}
		};
		
		function _simpleHandshake() {
			var ab = new Uint8Array(1 + PACKET_SIZE);
			var dv = new DataView(ab.buffer);
			dv.setUint8(0, 0x03);
			dv.setUint32(1, 0);
			dv.setUint32(5, 0);
			
			for (var i = 9; i <= PACKET_SIZE; i++) {
				dv.setUint8(i, Math.random() * 256);
			}
			
			_state |= states.C0 | states.C1;
			_c1 = new Uint8Array(ab.buffer, 1);
			
			_websocket.send(ab.buffer);
		}
		
		function _complexHandshake() {
			
		}
		
		function _onMessage(e) {
			var pos = 0;
			
			if ((_states & states.S0) == 0) {
				var s0 = new Uint8Array(e.data, pos, 1);
				if (s0[0] != 0x03) {
					_this.dispatchEvent(events.ERROR, { message: 'Invalid handshake version: ' + s0[0] });
					return;
				}
				
				_states |= states.S0;
				pos += 1;
			}
			
			if ((_states & states.S1) == 0) {
				_s1 = new Uint8Array(e.data, pos, PACKET_SIZE);
				
				_states |= states.S1 | states.C2;
				pos += PACKET_SIZE;
				
				_websocket.send(_s1.buffer);
			}
			
			if ((_states & states.S2) == 0) {
				var s2 = new Uint8Array(e.data, pos, PACKET_SIZE);
				
				_states |= states.S2;
				pos += PACKET_SIZE;
				
				for (var i = 0; i < PACKET_SIZE; i++) {
					if (_c1[i] != _s2[i]) {
						_this.dispatchEvent(events.ERROR, { message: 'Packet C1 & S2 not match.' });
						return;
					}
				}
				
				_this.dispatchEvent(events.PLAYEASE_COMPLETE);
			}
		}
		
		function _onError(e) {
			_this.dispatchEvent(events.ERROR, { message: 'Connection error occurred!' });
		}
		
		function _onClose(e) {
			_this.dispatchEvent(events.ERROR, { message: 'Connection closed!' });
		}
		
		_this.getState = function() {
			return _state;
		};
		
		_init();
	};
	
	rtmp.handshaker.states = states;
})(playease);
