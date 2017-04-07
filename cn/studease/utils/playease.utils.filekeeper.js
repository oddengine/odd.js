(function(playease) {
	var utils = playease.utils;
	
	utils.filekeeper = function(config) {
		var _this = this,
			_defaults = {
				filename: 'sample.fragmented.mp4',
				type: 'video/mpeg'
			},
			_array,
			_blob,
			_url,
			_event,
			_link;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_array = [];
		}
		
		_this.append = function(typedArray) {
			_array.push(typedArray);
		};
		
		_this.save = function(filename) {
			if (!filename) {
				filename = _this.config.filename;
			}
			
			_blob = new Blob(_array, { type: _this.config.type });
			_url = URL.createObjectURL(_blob);
			
			_event = document.createEvent('MouseEvents');
			_event.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
			
			_link = document.createElementNS('http://www.w3.org/1999/xhtml', 'a');
			_link.href = _url;
			_link.download = filename;
			_link.dispatchEvent(_event);
			
			_array = [];
			
			URL.revokeObjectURL(_url);
		};
		
		_init();
	};
})(playease);
