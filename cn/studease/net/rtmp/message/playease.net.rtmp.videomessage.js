(function(playease) {
	var utils = playease.utils,
		net = playease.net,
		rtmp = net.rtmp,
		Types = rtmp.message.Types,
		
		FrameTypes = {
			KEYFRAME:               0x01,
			INTER_FRAME:            0x02,
			DISPOSABLE_INTER_FRAME: 0x03,
			GENERATED_KEYFRAME:     0x04,
			INFO_OR_COMMAND_FRAME:  0x05
		};
	
	rtmp.videomessage = function() {
		var _this = utils.extend(this, new rtmp.message.header());
		
		function _init() {
			_this.Type = Types.VIDEO;
			
			_this.FrameType = 0; // 0xF0
			_this.Codec = 0;     // 0x0F
			_this.DataType = 0;
			_this.Payload = null;
		}
		
		_this.Parse = function(ab, offset, size) {
			var b = new Uint8Array(ab, offset, size);
			var cost = 0;
			
			_this.Length = size;
			
			var tmp = b[cost];
			_this.FrameType = (tmp >> 4) & 0x0F;
			_this.Codec = tmp & 0x0F;
			cost++;
			
			_this.DataType = b[cost];
			_this.Payload = b;
		};
		
		_init();
	};
	
	rtmp.videomessage.FrameTypes = FrameTypes;
})(playease);
