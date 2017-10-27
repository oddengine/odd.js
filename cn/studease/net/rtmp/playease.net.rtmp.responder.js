(function(playease) {
	var utils = playease.utils,
		net = playease.net,
		rtmp = net.rtmp;
	
	rtmp.responder = function(result, status) {
		var _this = this;
		
		function _init() {
			_this.result = result;
			_this.status = status;
		}
		
		_init();
	};
})(playease);
