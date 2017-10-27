(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		CommandEvent = events.CommandEvent,
		NetStatusEvent = events.NetStatusEvent,
		Level = NetStatusEvent.Level,
		Code = NetStatusEvent.Code,
		AudioEvent = events.AudioEvent,
		VideoEvent = events.VideoEvent,
		DataEvent = events.DataEvent,
		AMF = playease.muxer.AMF,
		net = playease.net,
		rtmp = net.rtmp,
		CSIDs = rtmp.chunk.CSIDs,
		States = rtmp.chunk.States,
		Types = rtmp.message.Types,
		EventTypes = rtmp.usercontrolmessage.UserControlEvent.Types,
		LimitTypes = rtmp.bandwidthmessage.LimitTypes,
		Commands = rtmp.commandmessage.Commands;
	
	rtmp.netstream = function(connection, config) {
		var _this = utils.extend(this, new events.eventdispatcher('rtmp.netstream')),
			_defaults = {
				bufferTime: .1
			},
			_connection,
			_streamId,
			_start,
			_duration,
			_reset,
			_paused,
			_time,
			_bytesLoaded,
			_bytesTotal,
			_info;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_streamId = 0;
			_start = undefined;
			_duration = undefined;
			_reset = undefined;
			_paused = false;
			_time = 0;
			_bytesLoaded = 0;
			_bytesTotal = 0;
			
			_info = {
				dataFrames: {},
				streamName: ''
			};
			
			_connection = connection;
			_connection.addEventListener(CommandEvent.CLOSE, _onClose);
			_connection.addEventListener(CommandEvent.ON_STATUS, _onStatus);
			_connection.addEventListener(DataEvent.SET_DATA_FRAME, _onSetDataFrame);
			_connection.addEventListener(DataEvent.CLEAR_DATA_FRAME, _onClearDataFrame);
			_connection.addEventListener(AudioEvent.DATA, _forward);
			_connection.addEventListener(VideoEvent.DATA, _forward);
		}
		
		_this.attach = function(c) {
			_connection = c;
		};
		
		function _onCreateStream(e) {
			_streamId = e.Message.Response.Data;
			
			if (_info.streamName) {
				_this.play(_info.streamName);
			}
		}
		
		_this.play = function(name, start, duration, reset) {
			_info.streamName = name;
			_start = start;
			_duration = duration;
			_reset = reset;
			
			if (_streamId == 0) {
				_connection.call(Commands.CREATE_STREAM, new rtmp.responder(_onCreateStream, null), {
					Type: AMF.types.NULL
				});
				
				return;
			}
			
			var args = [Commands.PLAY, null, {
				Type: AMF.types.NULL
			}, {
				Type: AMF.types.STRING,
				Data: _info.streamName
			}];
			
			if (_start !== undefined) {
				args.push({
					Type: AMF.types.DOUBLE,
					Data: _start
				});
			}
			if (_duration !== undefined) {
				args.push({
					Type: AMF.types.DOUBLE,
					Data: _duration
				});
			}
			if (_reset !== undefined) {
				args.push({
					Type: AMF.types.BOOLEAN,
					Data: _reset
				});
			}
			
			_connection.call.apply(_connection, args);
		};
		
		_this.play2 = function(options) {
			
		};
		
		_this.receiveAudio = function(flag) {
			_connection.call(Commands.RECEIVE_AUDIO, null, {
				Type: AMF.types.NULL
			}, {
				Type: AMF.types.BOOLEAN,
				Data: flag
			});
		};
		
		_this.receiveVideo = function(flag) {
			_connection.call(Commands.RECEIVE_VIDEO, null, {
				Type: AMF.types.NULL
			}, {
				Type: AMF.types.BOOLEAN,
				Data: flag
			});
		};
		
		_this.resume = function() {
			if (_paused == false) {
				return;
			}
			
			_pause(false);
		};
		
		_this.pause = function() {
			if (_paused) {
				return;
			}
			
			_pause(true);
		};
		
		function _pause(flag) {
			_connection.call(Commands.PAUSE, null, {
				Type: AMF.types.NULL
			}, {
				Type: AMF.types.BOOLEAN,
				Data: flag
			}, {
				Type: AMF.types.DOUBLE,
				Data: _time
			});
			
			_paused = flag;
		}
		
		_this.seek = function(offset) {
			_connection.call(Commands.SEEK, null, {
				Type: AMF.types.NULL
			}, {
				Type: AMF.types.DOUBLE,
				Data: offset * 1000
			});
		};
		
		_this.close = function() {
			_connection.call(Commands.CLOSE_STREAM, null, {
				Type: AMF.types.NULL
			}, {
				Type: AMF.types.DOUBLE,
				Data: _streamId
			});
		};
		
		_this.dispose = function() {
			if (_streamId) {
				_this.close();
			}
			
			_streamId = 0;
			_start = undefined;
			_duration = undefined;
			_reset = undefined;
			_paused = false;
			_time = 0;
			_bytesLoaded = 0;
			_bytesTotal = 0;
			
			_info = {
				dataFrames: {},
				streamName: ''
			};
		};
		
		
		_this.publish = function(name, type) {
			
		};
		
		_this.send = function(handlerName) {
			var args = Array.prototype.slice.call(arguments, 1);
			
		};
		
		
		function _onStatus(e) {
			var info = {};
			utils.foreach(e.Message.Response.Hash, function(k, v) {
				info[k] = v.Data;
			});
			
			_this.dispatchEvent(NetStatusEvent.NET_STATUS, {
				info: info
			});
		}
		
		function _onSetDataFrame(e) {
			if (_this.client && _this.client.onMetaData) {
				_this.client.onMetaData(e.info);
			}
		}
		
		function _onClearDataFrame(e) {
			
		}
		
		function _onClose(e) {
			_this.dispose();
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
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_init();
	};
})(playease);
