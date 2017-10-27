(function(playease) {
	var utils = playease.utils,
		net = playease.net,
		rtmp = net.rtmp,
		Types = rtmp.message.Types;
	
	rtmp.audiomessage = function() {
		var _this = utils.extend(this, new rtmp.message.header());
		
		function _init() {
			_this.Type = Types.AUDIO;
			
			_this.Format = 0;     // 1111 0000
			_this.SampleRate = 0; // 0000 1100
			_this.SampleSize = 0; // 0000 0010
			_this.Channels = 0;   // 0000 0001
			_this.DataType = 0;
			_this.Payload = null;
		}
		
		_this.Parse = function(ab, offset, size) {
			var b = new Uint8Array(ab, offset, size);
			var cost = 0;
			
			_this.Length = size;
			
			var tmp = b[cost];
			_this.Format = (tmp >> 4) & 0x0F;
			_this.SampleRate = (tmp >> 2) & 0x03;
			_this.SampleSize = (tmp >> 1) & 0x01;
			_this.Channels = tmp & 0x01;
			cost++;
			
			_this.DataType = b[cost];
			_this.Payload = b;
		};
		
		_init();
	};
})(playease);
