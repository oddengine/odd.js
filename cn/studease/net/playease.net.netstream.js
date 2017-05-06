(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		net = playease.net,
		status = net.netstatus;
	
	net.netstream = function(connection, config) {
		var _this = utils.extend(this, new events.eventdispatcher('net.netstream')),
			_defaults = {
				bufferTime: .1
			},
			_connection,
			_bytesLoaded,
			_bytesTotal,
			_info;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_connection = connection;
			
			_bytesLoaded = 0;
			_bytesTotal = 0;
			_info = {};
		}
		
		_this.attach = function(c) {
			_connection = c;
		};
		
		_this.play = function(name, start, len, reset) {
			_connection.callremote('play', null, name);
		};
		
		_this.resume = function() {
			_connection.callremote('resume');
		};
		
		_this.pause = function() {
			_connection.callremote('pause');
		};
		
		_this.seek = function(offset) {
			_connection.callremote('seek', null, offset);
		};
		
		_this.close = function() {
			_connection.callremote('close');
		};
		
		_this.dispose = function() {
			_connection.callremote('dispose');
			
			_bytesLoaded = 0;
			_bytesTotal = 0;
			_info = {};
		};
		
		_this.bytesLoaded = function() {
			return _bytesLoaded;
		};
		
		_this.bytesTotal = function() {
			return _bytesTotal;
		};
		
		_this.info = function() {
			return _info;
		};
		
		_init();
	};
})(playease);
