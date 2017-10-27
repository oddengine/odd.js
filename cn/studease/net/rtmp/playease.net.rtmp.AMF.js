(function(playease) {
	var utils = playease.utils,
		net = playease.net,
		rtmp = net.rtmp;
	
	var AMF = rtmp.AMF = {};
	var types = AMF.types = {
		DOUBLE:        0x00,
		BOOLEAN:       0x01,
		STRING:        0x02,
		OBJECT:        0x03,
		MOVIE_CLIP:    0x04, // Not available in Remoting
		NULL:          0x05,
		UNDEFINED:     0x06,
		REFERENCE:     0x07,
		ECMA_ARRAY:    0x08,
		END_OF_OBJECT: 0x09,
		STRICT_ARRAY:  0x0A,
		DATE:          0x0B,
		LONG_STRING:   0x0C,
		UNSUPPORTED:   0x0D,
		RECORD_SET:    0x0E, // Remoting, server-to-client only
		XML:           0x0F,
		TYPED_OBJECT:  0x10, // Class instance
		AMF3_DATA:     0x11  // Sent by Flash player 9+
	};
	
	/*AMF.AMFValue = {
		Type: 0x00,
		Key: '',
		Data: null,
		Hash: {},
		Offset: 0,
		Cost: 0,
		Ended: false
	};*/
	
	AMF.Decode = function(arrayBuffer, dataOffset, dataSize) {
		var k, v;
		
		try {
			k = AMF.DecodeValue(arrayBuffer, dataOffset, dataSize);
			v = AMF.DecodeValue(arrayBuffer, dataOffset + k.Cost, dataSize - k.Cost);
			
			v.Key = k.Data;
		} catch(e) {
			utils.log('AMF.Decode() failed. Error: ' + e);
		}
		
		return v;
	};
	
	AMF.DecodeString = function(arrayBuffer, dataOffset, dataSize) {
		if (dataSize < 2) {
			return null;
		}
		
		var v = {
			Type: types.STRING,
			Data: ''
		};
		
		var view = new DataView(arrayBuffer, dataOffset, dataSize);
		var pos = 0;
		
		var length = view.getUint16(pos);
		pos += 2;
		
		if (length > 0) {
			v.Data = String.fromCharCode.apply(String, new Uint8Array(arrayBuffer, dataOffset + pos, length));
			pos += length;
		}
		
		v.Cost = pos;
		
		return v;
	};
	
	AMF.DecodeObject = function(arrayBuffer, dataOffset, dataSize) {
		if (dataSize < 3) {
			return null;
		}
		
		var v = {
			Type: types.OBJECT,
			Data: [],
			Hash: {},
			Ended: false
		};
		
		var pos = 0;
		
		while (!v.Ended && pos < dataSize) {
			var key = AMF.DecodeString(arrayBuffer, dataOffset + pos, dataSize - pos);
			pos += key.Cost;
			
			var val = AMF.DecodeValue(arrayBuffer, dataOffset + pos, dataSize - pos);
			pos += val.Cost;
			v.Ended = !!val.Ended;
			
			if (val.Type == types.END_OF_OBJECT) {
				break;
			}
			
			val.Key = key.Data;
			v.Data.push(val);
			v.Hash[val.Key] = val.Type == types.OBJECT || val.Type == types.ECMA_ARRAY ? val.Hash : val.Data;
		}
		
		v.Cost = pos;
		
		return v;
	};
	
	AMF.DecodeECMAArray = function(arrayBuffer, dataOffset, dataSize) {
		if (dataSize < 4) {
			return null;
		}
		
		var v = {
			Type: types.ECMA_ARRAY,
			Data: [],
			Hash: {},
			Ended: false
		};
		
		var view = new DataView(arrayBuffer, dataOffset, dataSize);
		var pos = 0;
		
		var length = view.getUint32(pos);
		pos += 4;
		
		for (var i = 0; i < length; i++) {
			var key = AMF.DecodeString(arrayBuffer, dataOffset + pos, dataSize - pos);
			pos += key.Cost;
			
			var val = AMF.DecodeValue(arrayBuffer, dataOffset + pos, dataSize - pos);
			pos += val.Cost;
			if (i == length - 1) {
				v.Ended = true
			}
			
			val.Key = key.Data;
			v.Data.push(val);
			v.Hash[val.Key] = val.Type == types.OBJECT || val.Type == types.ECMA_ARRAY ? val.Hash : val.Data;
		}
		
		v.Cost = pos;
		
		return v;
	};
	
	AMF.DecodeStrictArray = function(arrayBuffer, dataOffset, dataSize) {
		if (dataSize < 4) {
			return null;
		}
		
		var v = {
			Type: types.STRICT_ARRAY,
			Data: [],
			Ended: false
		};
		
		var view = new DataView(arrayBuffer, dataOffset, dataSize);
		var pos = 0;
		
		var length = view.getUint32(pos);
		pos += 4;
		
		for (var i = 0; i < length; i++) {
			var val = AMF.DecodeValue(arrayBuffer, dataOffset + pos, dataSize - pos);
			pos += val.Cost;
			if (i == length - 1) {
				v.Ended = true
			}
			
			v.Data.push(val.Data);
		}
		
		v.Cost = pos;
		
		return v;
	};
	
	AMF.DecodeDate = function(arrayBuffer, dataOffset, dataSize) {
		if (dataSize < 10) {
			return null;
		}
		
		var v = {
			Type: types.DATE,
			Data: 0,
			Timestamp: 0,
			Timeoffset: 0
		};
		
		var view = new DataView(arrayBuffer, dataOffset, dataSize);
		var pos = 0;
		
		v.Timestamp = view.getFloat64(pos);
		pos += 8;
		
		v.Timeoffset = view.getInt16(pos);
		pos += 2;
		
		v.Data = new Date(v.Timestamp + v.Timeoffset * 60 * 1000);
		v.Cost = pos;
		
		return v;
	};
	
	AMF.DecodeLongString = function(arrayBuffer, dataOffset, dataSize) {
		if (dataSize < 4) {
			return null;
		}
		
		var v = {
			Type: types.LONG_STRING,
			Data: ''
		};
		
		var view = new DataView(arrayBuffer, dataOffset, dataSize);
		var pos = 0;
		
		var length = view.getUint32(pos);
		pos += 4;
		
		if (length > 0) {
			v.Data = String.fromCharCode.apply(String, new Uint8Array(arrayBuffer, dataOffset + pos, length));
			pos += length;
		}
		
		v.Cost = pos;
		
		return v;
	};
	
	AMF.DecodeValue = function(arrayBuffer, dataOffset, dataSize) {
		if (dataSize < 1) {
			return null;
		}
		
		var v = {
			Type: types.UNSUPPORTED,
			Key: '',
			Data: [],
			Hash: {},
			Timestamp: 0,
			Timeoffset: 0,
			Ended: false
		};
		
		var view = new DataView(arrayBuffer, dataOffset, dataSize);
		var pos = 0;
		
		v.Type = view.getUint8(pos);
		pos += 1;
		
		try {
			switch (v.Type) {
				case types.DOUBLE:
					v.Data = view.getFloat64(pos);
					pos += 8;
					break;
					
				case types.BOOLEAN:
					var bool = view.getUint8(pos);
					v.Data = bool ? true : false;
					pos += 1;
					break;
					
				case types.STRING:
					var str = AMF.DecodeString(arrayBuffer, dataOffset + pos, dataSize - pos);
					v.Data = str.Data;
					pos += str.Cost;
					break;
					
				case types.OBJECT:
					var obj = AMF.DecodeObject(arrayBuffer, dataOffset + pos, dataSize - pos);
					v.Data = obj.Data;
					v.Hash = obj.Hash;
					pos += obj.Cost;
					break;
					
				case types.NULL:
					v.Data = null;
					break;
					
				case types.UNDEFINED:
					v.Data = undefined;
					break;
					
				case types.ECMA_ARRAY:
					var arr = AMF.DecodeECMAArray(arrayBuffer, dataOffset + pos, dataSize - pos);
					v.Data = arr.Data;
					v.Hash = arr.Hash;
					pos += arr.Cost;
					break;
					
				case types.END_OF_OBJECT:
					v.Ended = true;
					break;
					
				case types.STRICT_ARRAY:
					var arr = AMF.DecodeStrictArray(arrayBuffer, dataOffset + pos, dataSize - pos);
					v.Data = arr.Data;
					v.Hash = arr.Hash;
					pos += arr.Cost;
					break;
					
				case types.DATE:
					var date = AMF.DecodeDate(arrayBuffer, dataOffset + pos, dataSize - pos);
					v.Data = date.Data;
					v.Timestamp = date.Timestamp;
					v.Timeoffset = date.Timeoffset;
					pos += date.Cost;
					break;
					
				case types.LONG_STRING:
					var ls = AMF.DecodeLongString(arrayBuffer, dataOffset + pos, dataSize - pos);
					v.Data = ls.Data;
					pos += ls.Cost;
					break;
					
				default:
					utils.log('Skipping unsupported AMF value type(' + type + ').');
					pos = dataSize;
			}
		} catch(e) {
			utils.log('AMF.DecodeValue() failed. Error: ' + e);
		}
		
		v.Cost = pos;
		
		return v;
	};
	
	AMF.Encoder = function() {
		var _this = this,
			_buffer;
		
		function _init() {
			_buffer = new utils.buffer();
		}
		
		_this.AppendBytes = function(array) {
			_buffer.Write(array);
		};
		
		_this.AppendUint8 = function(n) {
			_buffer.WriteByte(n);
		};
		
		_this.AppendUint16 = function(n, littleEndian) {
			_buffer.WriteUint16(n, littleEndian);
		};
		
		_this.AppendUint32 = function(n, littleEndian) {
			_buffer.WriteUint32(n, littleEndian);
		};
		
		_this.Encode = function() {
			return _buffer.Bytes();
		};
		
		_this.EncodeNumber = function(n) {
			_buffer.WriteByte(types.DOUBLE);
			_buffer.WriteFloat64(n, false);
		};
		
		_this.EncodeBoolean = function(b) {
			_buffer.WriteByte(types.BOOLEAN);
			_buffer.WriteByte(b ? 1 : 0);
		};
		
		_this.EncodeString = function(s) {
			if (!s) {
				return;
			}
			
			if (s.length >= 0xFFFF) {
				_encodeLongString(s);
				return;
			}
			
			var array = crypt.stringToByteArray(s);
			
			_buffer.WriteByte(types.STRING);
			_buffer.WriteUint16(array.length, false);
			_buffer.Write(array);
		};
		
		_this.EncodeObject = function(o) {
			_buffer.WriteByte(types.OBJECT);
			_encodeProperties(o);
			
			if (o.ended) {
				_buffer.WriteUint16(0);
				_buffer.WriteByte(types.END_OF_OBJECT);
			}
		};
		
		function _encodeProperties(o) {
			for (var i = 0; i < o.Data.length; i++) {
				var v = o.Data[i];
				if (v.Key) {
					var array = crypt.stringToByteArray(v.Key);
					
					_buffer.WriteUint16(v.Key.length, false);
					_buffer.Write(array);
				}
				
				_this.EncodeValue(v);
			}
		}
		
		_this.EncodeNull = function() {
			_buffer.WriteByte(types.NULL);
		};
		
		_this.EncodeUndefined = function() {
			_buffer.WriteByte(types.UNDEFINED);
		};
		
		_this.EncodeECMAArray = function(o) {
			_buffer.WriteByte(types.ECMA_ARRAY);
			_buffer.WriteUint32(o.Data.length, false);
			_encodeProperties(o);
		};
		
		_this.EncodeStrictArray = function(o) {
			_buffer.WriteByte(types.STRICT_ARRAY);
			_buffer.WriteUint32(o.Data.length, false);
			_encodeProperties(o);
		};
		
		_this.EncodeDate = function(timestamp, timeoffset) {
			_buffer.WriteByte(types.DATE);
			_buffer.WriteFloat64(timestamp, false);
			_buffer.WriteUint16(timeoffset, false);
		};
		
		function _encodeLongString(s) {
			if (!s) {
				return;
			}
			
			var array = crypt.stringToByteArray(s);
			
			_buffer.WriteByte(types.LONG_STRING);
			_buffer.WriteUint32(array.length, false);
			_buffer.Write(array);
		}
		
		_this.EncodeValue = function(v) {
			switch (v.Type) {
				case types.DOUBLE:
					_this.EncodeNumber(v.Data);
					break;
					
				case types.BOOLEAN:
					_this.EncodeBoolean(v.Data);
					break;
					
				case types.STRING:
					_this.EncodeString(v.Data);
					break;
					
				case types.OBJECT:
					_this.EncodeObject(v);
					break;
					
				case types.NULL:
					_this.EncodeNull();
					break;
					
				case types.UNDEFINED:
					_this.EncodeUndefined();
					break;
					
				case types.ECMA_ARRAY:
					_this.EncodeECMAArray(v);
					break;
					
				case types.STRICT_ARRAY:
					_this.EncodeStrictArray(v);
					break;
					
				case types.DATE:
					this.EncodeDate(v.Timtstamp, v.Timeoffset);
					break;
					
				case types.LONG_STRING:
					_encodeLongString(v.Data);
					break;
					
				default:
					utils.log('Skipping unsupported AMF value type: ' + v.Type);
			}
		};
		
		_this.Len = function() {
			return _buffer.Len();
		};
		
		_this.Reset = function() {
			_buffer.Reset();
		};
		
		_init();
	};
})(playease);
