(function(playease) {
	var utils = playease.utils,
		net = playease.net,
		rtmp = net.rtmp,
		Types = rtmp.message.Types,
		
		EventTypes = {
			STREAM_BEGIN:       0x0000,
			STREAM_EOF:         0x0001,
			STREAM_DRY:         0x0002,
			SET_BUFFER_LENGTH:  0x0003,
			STREAM_IS_RECORDED: 0x0004,
			PING_REQUEST:       0x0006,
			PING_RESPONSE:      0x0007
		};
	
	UserControlEvent = function() {
		var _this = this;
		
		function _init() {
			_this.Type = 0;
			_this.StreamID = 0;     // uint32
			_this.BufferLength = 0; // uint32
			_this.Timestamp = 0;    // uint32
		}
		
		_init();
	};
	
	rtmp.usercontrolmessage = function() {
		var _this = utils.extend(this, new rtmp.message.header());
		
		function _init() {
			_this.Type = Types.USER_CONTROL;
			
			_this.Event = new UserControlEvent();
		}
		
		_this.Parse = function(ab, offset, size) {
			var b = new Uint8Array(ab, offset, size);
			var cost = 0;
			
			_this.Event.Type = b[cost]<<8 | b[cost+1];
			cost += 2;
			
			var data = new Uint8Array(ab, offset+cost);
			
			switch (_this.Event.Type) {
			case EventTypes.SET_BUFFER_LENGTH:
				_this.Event.BufferLength = b[cost+4]<<24 | b[cost+5]<<16 | b[cost+6]<<8 | b[cost+7];
				cost += 4;
			case EventTypes.STREAM_BEGIN:
			case EventTypes.STREAM_EOF:
			case EventTypes.STREAM_DRY:
			case EventTypes.STREAM_IS_RECORDED:
				_this.Event.StreamID = b[cost]<<24 | b[cost+1]<<16 | b[cost+2]<<8 | b[cost+3];
				cost += 4;
				break;
				
			case EventTypes.PING_REQUEST:
			case EventTypes.PING_RESPONSE:
				_this.Event.Timestamp = b[cost]<<24 | b[cost+1]<<16 | b[cost+2]<<8 | b[cost+3];
				cost += 4;
				break;
				
			default:
			}
		};
		
		_init();
	};
	
	rtmp.usercontrolmessage.UserControlEvent = UserControlEvent;
	rtmp.usercontrolmessage.UserControlEvent.Types = EventTypes;
})(playease);
