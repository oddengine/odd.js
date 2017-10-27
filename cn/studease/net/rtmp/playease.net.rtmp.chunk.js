(function(playease) {
	var utils = playease.utils,
		net = playease.net,
		rtmp = net.rtmp,
		
		CSIDs = {
			PROTOCOL_CONTROL: 0x02,
			COMMAND:          0x03,
			COMMAND_2:        0x04,
			STREAM:           0x05,
			VIDEO:            0x06,
			AUDIO:            0x07,
			AV:               0x08
		},
		States = {
			START:                0x00,
			FMT:                  0x01,
			CSID_0:               0x02,
			CSID_1:               0x03,
			TIMESTAMP_0:          0x04,
			TIMESTAMP_1:          0x05,
			TIMESTAMP_2:          0x06,
			MESSAGE_LENGTH_0:     0x07,
			MESSAGE_LENGTH_1:     0x08,
			MESSAGE_LENGTH_2:     0x09,
			MESSAGE_TYPE_ID:      0x0A,
			MESSAGE_STREAM_ID_0:  0x0B,
			MESSAGE_STREAM_ID_1:  0x0C,
			MESSAGE_STREAM_ID_2:  0x0D,
			MESSAGE_STREAM_ID_3:  0x0E,
			EXTENDED_TIMESTAMP_0: 0x0F,
			EXTENDED_TIMESTAMP_1: 0x10,
			EXTENDED_TIMESTAMP_2: 0x11,
			EXTENDED_TIMESTAMP_3: 0x12,
			DATA:                 0x13,
			COMPLETE:             0x14
		};
	
	header = function() {
		var _this = this;
		
		function _init() {
			_this.Fmt = 0;             // 2 bits
			_this.CSID = 0;            // 6 | 14 | 22 bits
			_this.Timestamp = 0;       // 3 bytes
			_this.MessageLength = 0;   // 3 bytes
			_this.MessageTypeID = 0;   // 1 byte
			_this.MessageStreamID = 0; // 4 bytes
		}
		
		_init();
	};
	
	rtmp.chunk = function() {
		var _this = utils.extend(this, new header());
		
		function _init() {
			_this.Data = new utils.buffer();
			
			_this.CurrentFmt = 0;
			_this.Polluted = false;
			_this.Extended = false;
			_this.Loaded = 0;
			_this.State = States.START;
		}
		
		_init();
	};
	
	rtmp.chunk.CSIDs = CSIDs;
	rtmp.chunk.States = States;
	rtmp.chunk.header = header;
})(playease);
