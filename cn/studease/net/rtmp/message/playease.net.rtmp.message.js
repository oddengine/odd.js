(function(playease) {
	var utils = playease.utils,
		net = playease.net,
		rtmp = net.rtmp,
		
		Types = {
			SET_CHUNK_SIZE:     0x01,
			ABORT:              0x02,
			ACK:                0x03,
			USER_CONTROL:       0x04,
			ACK_WINDOW_SIZE:    0x05,
			BANDWIDTH:          0x06,
			EDGE:               0x07,
			AUDIO:              0x08,
			VIDEO:              0x09,
			AMF3_DATA:          0x0F,
			AMF3_SHARED_OBJECT: 0x10,
			AMF3_COMMAND:       0x11,
			DATA:               0x12,
			SHARED_OBJECT:      0x13,
			COMMAND:            0x14,
			AGGREGATE:          0x16
		};
	
	header = function() {
		var _this = this;
		
		function _init() {
			_this.Fmt = 0;       // 2 bits
			_this.CSID = 0;      // 6 | 14 | 22 bits
			_this.Type = 0;      // 1 bytes
			_this.Length = 0;    // 3 bytes
			_this.Timestamp = 0; // 4 byte
			_this.StreamID = 0;  // 3 bytes
		}
		
		_init();
	};
	
	rtmp.message = function() {
		var _this = utils.extend(this, new header());
		
		function _init() {
			_this.Payload = null;
		}
		
		_this.Parse = function(ab, offset, size) {
			if (size < 11) {
				throw 'data (size=' + size + ') not enough'
			}
			
			var b = new Uint8Array(ab, offset, size);
			var cost = 0;
			
			_this.Type = b[cost];
			cost += 1;
			
			_this.Length = b[cost]<<16 | b[cost+1]<<8 | b[cost+2];
			cost += 3;
			
			_this.Timestamp = b[cost]<<24 | b[cost+1]<<16 | b[cost+2]<<8 | b[cost+3];
			cost += 4;
			
			_this.StreamID = b[cost]<<16 | b[cost+1]<<8 | b[cost+2];
			cost += 3;
			
			if (size-cost < _this.Length) {
				throw 'data (size=' + (size-cost) + ') not enough';
			}
			
			_this.Payload = new Uint8Array(ab, offset+cost, _this.Length);
		};
		
		_init();
	};
	
	rtmp.message.Types = Types;
	rtmp.message.header = header;
})(playease);
