(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		muxer = playease.muxer;
	
	var AMF = muxer.AMF = {};
	var types = AMF.types = {
		DOUBLE:        0x00,
		BOOLEAN:       0x01,
		STRING:        0x02,
		OBJECT:        0x03,
		MOVIE_CLIP:    0x04, // Not available in Remoting
		NULL:          0x05,
		UNDEFINED:     0x06,
		REFERENCE:     0x07,
		MIXED_ARRAY:   0x08,
		END_OF_OBJECT: 0x09,
		ARRAY:         0x0A,
		DATE:          0x0B,
		LONG_STRING:   0x0C,
		UNSUPPORTED:   0x0D,
		RECORD_SET:    0x0E, // Remoting, server-to-client only
		XML:           0x0F,
		TYPED_OBJECT:  0x10, // Class instance
		AMF3_DATA:     0x11  // Sent by Flash player 9+
	};
	
	AMF.parse = function(arrayBuffer, dataOffset, dataSize) {
		var data = {};
		
		try {
			var key = AMF.parseValue(arrayBuffer, dataOffset, dataSize);
			var value = AMF.parseValue(arrayBuffer, dataOffset + key.size, dataSize - key.size);
			
			data.key = key.data;
			data.value = value.data;
		} catch(e) {
			utils.log('AMF.parse() failed. Error: ' + e);
		}
		
		return data;
	};
	
	AMF.parseObject = function(arrayBuffer, dataOffset, dataSize) {
		if (dataSize < 3) {
			throw 'Data not enough while parsing AMF object.';
		}
		
		var obj = {};
		var pos = 0;
		
		var key, value = { ended: false };
		
		while (!value.ended && pos < dataSize) {
			key = AMF.parseString(arrayBuffer, dataOffset + pos, dataSize - pos);
			pos += key.size;
			
			value = AMF.parseValue(arrayBuffer, dataOffset + pos, dataSize - pos);
			pos += value.size;
			
			if (key.data && value.data) {
				obj[key.data] = value.data;
			}
		}
		
		return {
			data: obj,
			size: pos,
			ended: value.ended
		};
	};
	
	AMF.parseString = function(arrayBuffer, dataOffset, dataSize) {
		if (dataSize < 2) {
			throw 'Data not enough while parsing AMF string.';
		}
		
		var v = new DataView(arrayBuffer, dataOffset, dataSize);
		
		var pos = 0;
		var length = v.getUint16(pos);
		
		pos += 2;
		
		var str = void 0;
		if (length > 0) {
			str = String.fromCharCode.apply(String, new Uint8Array(arrayBuffer, dataOffset + pos, length));
		} else {
			str = '';
		}
		
		pos += length;
		
		return {
			data: str,
			size: pos
		};
	};
	
	AMF.parseLongString = function(arrayBuffer, dataOffset, dataSize) {
		if (dataSize < 4) {
			throw 'Data not enough while parsing AMF long string.';
		}
		
		var v = new DataView(arrayBuffer, dataOffset, dataSize);
		
		var pos = 0;
		var length = v.getUint32(pos);
		
		pos += 4;
		
		var str = void 0;
		if (length > 0) {
			str = String.fromCharCode.apply(String, new Uint8Array(arrayBuffer, dataOffset + pos, length));
		} else {
			str = '';
		}
		
		pos += length;
		
		return {
			data: str,
			size: pos
		};
	};
	
	AMF.parseDate = function(arrayBuffer, dataOffset, dataSize) {
		if (dataSize < 10) {
			throw 'Data not enough while parsing AMF date.';
		}
		
		var v = new DataView(arrayBuffer, dataOffset, dataSize);
		
		var pos = 0;
		var timestamp = v.getFloat64(pos);
		
		pos += 8;
		
		var timeoffset = v.getInt16(pos);
		timestamp += timeoffset * 60 * 1000;
		
		pos += 2;
		
		return {
			data: new Date(timestamp),
			size: pos
		};
	};
	
	AMF.parseValue = function(arrayBuffer, dataOffset, dataSize) {
		if (dataSize < 1) {
			throw 'Data not enough while parsing AMF value.';
		}
		
		var v = new DataView(arrayBuffer, dataOffset, dataSize);
		
		var pos = 0;
		var type = v.getUint8(pos);
		
		pos += 1;
		
		var value = void 0;
		var ended = false;
		
		try {
			switch (type) {
				case types.DOUBLE:
					value = v.getFloat64(pos);
					pos += 8;
					break;
				case types.BOOLEAN:
					var b = v.getUint8(pos);
					value = b ? true : false;
					pos += 1;
					break;
				case types.STRING:
					var str = AMF.parseString(arrayBuffer, dataOffset + pos, dataSize - pos);
					value = str.data;
					pos += str.size;
					break;
				case types.OBJECT:
					var obj = AMF.parseObject(arrayBuffer, dataOffset + pos, dataSize - pos);
					value = obj.data;
					pos += obj.size;
					break;
				case types.MIXED_ARRAY:
					var length = v.getUint32(pos);
					pos += 4;
					
					var arr = AMF.parseObject(arrayBuffer, dataOffset + pos, dataSize - pos);
					value = arr.data;
					pos += arr.size;
					break;
				case types.END_OF_OBJECT:
					value = undefined;
					ended = true;
					break;
				case types.ARRAY:
					var length = v.getUint32(pos);
					pos += 4;
					
					value = [];
					for (var i = 0; i < length; i++) {
						var val = AMF.parseValue(arrayBuffer, dataOffset + pos, dataSize - pos);
						value.push(val.data);
						pos += val.size;
					}
					break;
				case types.DATE:
					var date = AMF.parseDate(arrayBuffer, dataOffset + pos, dataSize - pos);
					value = date.data;
					pos += date.size;
					break;
				case types.LONG_STRING:
					var longstr = AMF.parseString(arrayBuffer, dataOffset + pos, dataSize - pos);
					value = longstr.data;
					pos += longstr.size;
					break;
				default:
					utils.log('Skipping unsupported AMF value type(' + type + ').');
					pos += dataSize;
			}
		} catch(e) {
			utils.log('AMF.parseValue() failed. Error: ' + e);
		}
		
		return {
			data: value,
			size: pos,
			ended: ended
		};
	};
})(playease);
