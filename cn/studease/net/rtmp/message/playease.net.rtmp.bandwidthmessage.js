(function(playease) {
	var utils = playease.utils,
		net = playease.net,
		rtmp = net.rtmp,
		Types = rtmp.message.Types,
		
		LimitTypes = {
			HARD:    0x00,
			SOFT:    0x01,
			DYNAMIC: 0x02
		};
	
	rtmp.bandwidthmessage = function() {
		var _this = utils.extend(this, new rtmp.message.header());
		
		function _init() {
			_this.Type = Types.BANDWIDTH;
			
			_this.AckWindowSize = 0; // 4 byte
			_this.LimitType = 0;     // 1 bytes
		}
		
		_this.Parse = function(ab, offset, size) {
			var b = new Uint8Array(ab, offset, size);
			var cost = 0;
			
			_this.AckWindowSize = b[cost]<<24 | b[cost+1]<<16 | b[cost+2]<<8 | b[cost+3];
			cost += 4;
			
			_this.LimitType = b[offset+cost];
			cost += 1;
		};
		
		_init();
	};
	
	rtmp.bandwidthmessage.LimitTypes = LimitTypes;
})(playease);
