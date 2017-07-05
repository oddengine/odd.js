(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		io = playease.io,
		readystates = io.readystates,
		net = playease.net,
		status = net.netstatus,
		netconnection = net.netconnection,
		
		packages = netconnection.packages,
		commands = netconnection.commands;
	
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
			_connection.addEventListener(events.PLAYEASE_MEDIA_INFO, _onMediaInfo);
			_connection.addEventListener(events.PLAYEASE_MP4_INIT_SEGMENT, _forward);
			_connection.addEventListener(events.PLAYEASE_MP4_SEGMENT, _forward);
			
			_bytesLoaded = 0;
			_bytesTotal = 0;
			
			_info = {
				state: readystates.UNINITIALIZED
			};
		}
		
		_this.attach = function(c) {
			_connection = c;
		};
		
		_this.play = function(name, start, len, reset) {
			if (name === undefined) {
				throw 'Failed to invoke play: "name" not specified.';
				return;
			}
			
			if (start === undefined) {
				start = -2;
			}
			if (len === undefined) {
				len = -1;
			}
			if (reset === undefined) {
				reset = 1;
			}
			
			_info.resourceName = name;
			
			_connection.send(packages.SCRIPT, commands.PLAY, null, {
				name: name,
				start: start,
				len: len,
				reset: reset
			});
		};
		
		_this.play2 = function(name, start, length, reset) {
			if (name === undefined) {
				throw 'Failed to invoke play2: "name" not specified.';
				return;
			}
			
			if (start === undefined) {
				start = -2;
			}
			if (length === undefined) {
				length = -1;
			}
			if (reset === undefined) {
				start = 1;
			}
			
			_connection.send(packages.SCRIPT, commands.PLAY2, null, {
				name: name,
				start: start,
				length: length,
				reset: reset
			});
		};
		
		_this.resume = function() {
			_connection.send(packages.SCRIPT, commands.RESUME);
		};
		
		_this.pause = function() {
			_connection.send(packages.SCRIPT, commands.PAUSE);
		};
		
		_this.seek = function(offset) {
			_connection.send(packages.SCRIPT, commands.SEEK, null, {
				offset: offset || 0
			});
		};
		
		_this.close = function() {
			if (_connection.connected()) {
				//_connection.send(packages.SCRIPT, commands.STOP);
			}
		};
		
		_this.dispose = function() {
			if (_connection.connected()) {
				_connection.send(packages.SCRIPT, commands.STOP);
			}
			
			_bytesLoaded = 0;
			_bytesTotal = 0;
			
			_info = {};
		};
		
		
		_this.publish = function(name, type) {
			_connection.send(packages.SCRIPT, commands.PUBLISH, null, {
				name: name || null,
				type: type || 'live'
			});
		};
		
		_this.send = function(type, data) {
			_connection.send(type, 0, null, data);
		};
		
		
		function _onMediaInfo(e) {
			if (_this.client && _this.client.onMetaData) {
				_this.client.onMetaData(e.info);
			}
		}
		
		
		_this.bytesLoaded = function() {
			return _bytesLoaded;
		};
		
		_this.bytesTotal = function() {
			return _bytesTotal;
		};
		
		_this.info = function() {
			return _info;
		};
		
		_this.state = function() {
			return _info.state;
		};
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_init();
	};
})(playease);
