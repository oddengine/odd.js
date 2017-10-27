(function(playease) {
	var utils = playease.utils;
	
	utils.buffer = function() {
		var _this = this,
			_array,
			_length,
			_bytes;
		
		function _init() {
			_array = [];
			_length = 0;
		}
		
		_this.Bytes = function() {
			_bytes = new Uint8Array(_length);
			
			for (var i = 0, pos = 0; i < _array.length; i++) {
				var typedArray = _array[i];
				_bytes.set(typedArray, pos);
				
				pos += typedArray.byteLength;
			}
			
			return _bytes.buffer;
		};
		
		_this.Write = function(array) {
			var typedArray = new Uint8Array(array);
			_array.push(typedArray);
			_length += typedArray.byteLength;
		};
		
		_this.WriteByte = function(c) {
			var ab = new ArrayBuffer(1);
			var dv = new DataView(ab);
			dv.setUint8(0, c);
			
			var typedArray = new Uint8Array(ab);
			_array.push(typedArray);
			_length += typedArray.byteLength;
		};
		
		_this.WriteUint16 = function(n, littleEndian) {
			var ab = new ArrayBuffer(2);
			var dv = new DataView(ab);
			dv.setUint16(0, n, littleEndian);
			
			var typedArray = new Uint8Array(ab);
			_array.push(typedArray);
			_length += typedArray.byteLength;
		};
		
		_this.WriteUint32 = function(n, littleEndian) {
			var ab = new ArrayBuffer(4);
			var dv = new DataView(ab);
			dv.setUint32(0, n, littleEndian);
			
			var typedArray = new Uint8Array(ab);
			_array.push(typedArray);
			_length += typedArray.byteLength;
		};
		
		_this.WriteFloat64 = function(n, littleEndian) {
			var ab = new ArrayBuffer(8);
			var dv = new DataView(ab);
			dv.setFloat64(0, n, littleEndian);
			
			var typedArray = new Uint8Array(ab);
			_array.push(typedArray);
			_length += typedArray.byteLength;
		};
		
		_this.Len = function() {
			return _length;
		};
		
		_this.Reset = function() {
			_array = [];
			_length = 0;
			_bytes = undefined;
		};
		
		_init();
	};
})(playease);
