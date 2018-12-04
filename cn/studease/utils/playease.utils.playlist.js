(function(playease) {
	var utils = playease.utils,
		core = playease.core,
		renders = core.renders,
		priority = renders.priority;
	
	utils.playlist = function(sources, prior) {
		var _this = this;
		
		function _init() {
			_this.index = 0;
			_this.sources = sources;
			_this.prior = prior;
		}
		
		_this.format = function() {
			var array = _this.sources.splice(0, _this.sources.length);
			
			for (var i = 0; i < array.length; i++) {
				var item = array[i];
				if (!item || !item.file) {
					continue;
				}
				
				var name = _this.getSupported(item.file, item.type || _this.prior);
				if (name) {
					_this.sources.push({
						file: item.file,
						type: name,
						label: item.label || _this.sources.length
					});
				}
			}
		};
		
		_this.getSupported = function(file, prior) {
			if (prior) {
				var render = renders[prior];
				if (render && render.isSupported(file)) {
					return prior;
				}
			}
			
			for (var i = 0; i < priority.length; i++) {
				var name = priority[i];
				var render = renders[name];
				if (render && render.isSupported(file)) {
					return name;
				}
			}
			
			return null;
		};
		
		_this.addItem = function(file, prior, label) {
			if (!file) {
				return null;
			}
			
			for (var i = 0; i < _this.sources.length; i++) {
				var item = _this.sources[i];
				if (item.file === file) {
					return item;
				}
			}
			
			var name = _this.getSupported(file, prior || _this.prior);
			if (name) {
				var item = {
					file: file,
					type: name,
					label: label || _this.sources.length
				};
				
				_this.sources.push(item);
				
				return item;
			}
			
			return null;
		};
		
		_this.getItemAt = function(index) {
			if (index < 0 || index >= _this.sources.length) {
				return null;
			}
			
			return _this.sources[index];
		};
		
		_this.activeItemAt = function(index) {
			if (index < 0 || index >= _this.sources.length) {
				return false;
			}
			
			_this.index = index;
			
			return true;
		};
		
		_this.activeNextItem = function() {
			if (!_this.sources || !_this.sources.length) {
				return false;
			}
			
			_this.index++;
			if (_this.index == _this.sources.length) {
				_this.index = 0;
			}
			
			return true;
		};
		
		_this.getNextItem = function() {
			if (_this.activeNextItem()) {
				return _this.sources[_this.index];
			}
			
			return null;
		};
		
		_init();
	};
})(playease);
