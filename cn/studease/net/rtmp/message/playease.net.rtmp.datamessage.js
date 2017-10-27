(function(playease) {
	var utils = playease.utils,
		net = playease.net,
		rtmp = net.rtmp,
		Types = rtmp.message.Types;
	
	rtmp.datamessage = function(encoding) {
		var _this = utils.extend(this, new rtmp.message.header());
		
		function _init() {
			if (encoding == rtmp.ObjectEncoding.AMF0) {
				_this.Type = Types.DATA
			} else {
				_this.Type = Types.AMF3_DATA
			}
			
			_this.Handler = '';
			_this.Key = '';
			_this.Data = null;
			_this.Payload = null;
		}
		
		_this.Parse = function(ab, offset, size) {
			var b = new Uint8Array(ab, offset, size);
			var cost = 0;
			
			v = AMF.DecodeValue(b, cost, size-cost);
			cost += v.Cost;
			_this.Handler = v.Data;
			
			v = AMF.DecodeValue(b, cost, size-cost);
			cost += v.Cost;
			_this.Key = v.Data;
			
			v = AMF.DecodeValue(b, cost, size-cost);
			if (v) {
				cost += v.Cost;
				_this.Data = v;
			}
			
			_this.Payload = b;
		};
		
		_init();
	};
})(playease);
