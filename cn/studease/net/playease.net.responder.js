(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		net = playease.net;
	
	net.responder = function(result, status) {
		var _this = this,
			_result,
			_status;
		
		function _init() {
			_this.result = result;
			_this.status = status;
		}
		
		_init();
	};
})(playease);
