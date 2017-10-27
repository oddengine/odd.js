(function(playease) {
	var utils = playease.utils,
		net = playease.net,
		rtmp = net.rtmp,
		Types = rtmp.message.Types;
	
	AggregateBody = function() {
		var _this = this;
		
		function _init() {
			_this.Message = null;
			_this.Size = 0;
		}
		
		_init();
	};
	
	rtmp.aggregatemessage = function() {
		var _this = utils.extend(this, new rtmp.message.header());
		
		function _init() {
			_this.Type = Types.AGGREGATE;
			
			_this.Body = [];
		}
		
		_this.Parse = function(ab, offset, size) {
			var b = new Uint8Array(ab, offset, size);
			var cost = 0;
			
			var m = new rtmp.message();
			m.Parse(b, offset, size);
			
			_this.Length = m.Length;
			_this.Timestamp = m.Timestamp;
			_this.StreamID = m.StreamID;
			
			var body;
			for (var i = 0; i < m.Length; i += body.Size) {
				body = new AggregateBody();
				body.Parse(m.Payload, i, m.Length);
				
				_this.Body.push(body);
			}
		};
		
		_init();
	};
	
	rtmp.aggregatemessage.Body = AggregateBody;
})(playease);
