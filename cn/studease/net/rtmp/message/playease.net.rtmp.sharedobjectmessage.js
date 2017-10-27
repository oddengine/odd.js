(function(playease) {
	var utils = playease.utils,
		net = playease.net,
		rtmp = net.rtmp,
		message = rtmp.message;
	
	rtmp.sharedobjectmessage = function() {
		var _this = utils.extend(this, new message.header());
		
		function _init() {
			
		}
		
		_init();
	};
})(playease);
