(function(playease) {
	var utils = playease.utils,
		AMF = playease.muxer.AMF,
		net = playease.net,
		rtmp = net.rtmp,
		Types = rtmp.message.Types;
		
		Commands = {
			CONNECT:       'connect',
			CLOSE:         'close',
			CREATE_STREAM: 'createStream',
			RESULT:        '_result',
			ERROR:         '_error',
			
			PLAY:          'play',
			PLAY2:         'play2',
			DELETE_STREAM: 'deleteStream',
			CLOSE_STREAM:  'closeStream',
			RECEIVE_AUDIO: 'receiveAudio',
			RECEIVE_VIDEO: 'receiveVideo',
			PUBLISH:       'publish',
			SEEK:          'seek',
			PAUSE:         'pause',
			ON_STATUS:     'onStatus',
			
			CHECK_BANDWIDTH: 'checkBandwidth',
			GET_STATS:       'getStats'
		};
	
	rtmp.commandmessage = function(encoding) {
		var _this = utils.extend(this, new rtmp.message.header());
		
		function _init() {
			if (encoding == rtmp.ObjectEncoding.AMF0) {
				_this.Type = Types.COMMAND;
			} else {
				_this.Type = Types.AMF3_COMMAND;
			}
			
			_this.Name = '';
			_this.TransactionID = 0;
			
			_this.CommandObject = null;
			_this.Arguments = null;
			_this.Response = null;
			_this.StreamID = 0;
			_this.StreamName = '';
			_this.Start = 0;
			_this.Duration = 0;
			_this.Reset = true;
			_this.Flag = false;
			_this.PublishingName = '';
			_this.PublishingType = '';
			_this.MilliSeconds = 0;
			_this.Pause = true;
		}
		
		_this.Parse = function(ab, offset, size) {
			var cost = 0;
			
			var v = AMF.DecodeValue(ab, offset+cost, size-cost);
			cost += v.Cost;
			_this.Name = v.Data;
			
			v = AMF.DecodeValue(ab, offset+cost, size-cost);
			cost += v.Cost;
			_this.TransactionID = v.Data;
			
			switch (_this.Name) {
			// NetConnection Commands
			case Commands.CONNECT:
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.CommandObject = v;
				
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				if (v) {
					cost += v.Cost;
					_this.Arguments = v;
				}
				break;
				
			case Commands.CLOSE:
				utils.log('Parsing command ' + this.Name);
				break;
				
			case Commands.CREATE_STREAM:
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.CommandObject = v;
				break;
				
			case Commands.RESULT:
			case Commands.ERROR:
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.CommandObject = v;
				
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.Response = v;
				break;
				
			// NetStream Commands
			case Commands.PLAY:
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.CommandObject = null; // v.Type == Types.NULL
				
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.StreamName = v.Data;
				
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				if (v == null) {
					_this.Start = -2;
				} else {
					cost += v.Cost;
					_this.Start = v.Data;
				}
				
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				if (v == null) {
					_this.Duration = -1;
				} else {
					cost += v.Cost;
					_this.Duration = v.Data;
				}
				
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				if (v == null) {
					_this.Reset = true;
				} else {
					cost += v.Cost;
					_this.Reset = v.Data;
				}
				break;
				
			case Commands.PLAY2:
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.CommandObject = null; // v.Type == Types.NULL
				
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.Arguments = v;
				break;
				
			case Commands.DELETE_STREAM:
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.CommandObject = null; // v.Type == Types.NULL
				
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.StreamID = v.Data;
				break;
				
			case Commands.CLOSE_STREAM:
				utils.log('Parsing command ' + _this.Name);
				break;
				
			case Commands.RECEIVE_AUDIO:
			case Commands.RECEIVE_VIDEO:
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.CommandObject = null; // v.Type == Types.NULL
				
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.Flag = v.Data;
				break;
				
			case Commands.PUBLISH:
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.CommandObject = null; // v.Type == Types.NULL
				
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.PublishingName = v.Data;
				
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.PublishingType = v.Data;
				break;
				
			case Commands.SEEK:
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.CommandObject = null; // v.Type == Types.NULL
				
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.MilliSeconds = v.Data;
				break;
				
			case Commands.PAUSE:
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.CommandObject = null; // v.Type == Types.NULL
				
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.Pause = v.Data;
				
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.MilliSeconds = v.Data;
				break;
				
			case Commands.ON_STATUS:
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.CommandObject = null; // v.Type == Types.NULL
				
				v = AMF.DecodeValue(ab, offset+cost, size-cost);
				cost += v.Cost;
				_this.Response = v;
				break;
				
			default:
			}
		};
		
		_init();
	};
	
	rtmp.commandmessage.Commands = Commands;
})(playease);
