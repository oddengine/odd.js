(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		components = core.components,
		
		alphas = {
			NONE: 1,
			LOW:  0.75,
			MID:  0.5,
			HIGH: 0.25
		},
		positions = {
			FULLSCREEN: 0,
			TOP:        1,
			BOTTOM:     2
		};
	
	components.bulletscreen = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('components.bulletscreen')),
			_defaults = {
				width: 640,
				height: 360,
				enable: true,
				fontsize: 14,
				alpha: alphas.LOW,
				position: positions.FULLSCREEN
			},
			_rows,
			_timer,
			_canvas,
			_context;
		
		_this.bullet = function(text) {
			var _self = this;
			
			function _init() {
				_self.text = text;
				
				_self.doublechars = _getDoubleChars();
				_self.width = (_self.text.length + _self.doublechars * 0.96) / 2 * _this.config.fontsize;
				_self.weight = (_canvas.width + _self.width) / (8000 / 30);
				_self.tick = 0;
			}
			
			function _getDoubleChars() {
				var chars = _self.text.match(/([^x00-xff])/gi);
				return chars ? chars.length : 0;
			}
			
			_init();
		};
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_rows = [];
			
			_canvas = utils.createElement('canvas');
			_this.resize(_this.config.width, _this.config.height);
		}
		
		_this.shoot = function(text) {
			if (_this.config.enable == false) {
				return;
			}
			
			var bullet = new _this.bullet(text);
			var index = _getIndex(bullet.weight);
			var row = _rows[index];
			if (!row) {
				row = [];
				row.weight = 0;
				row.bitmap = 0x0000;
				
				_rows[index] = row;
			}
			
			var blockwidth = _canvas.width / 10;
			var bits = Math.ceil(bullet.width / blockwidth);
			var pos = 6 - bits;
			
			row.push(bullet);
			row.weight += bullet.weight;
			row.bitmap |= ((1 << bits) - 1) << pos;
			
			_startTimer();
		};
		
		function _getIndex(weight) {
			var index = 0;
			var best = 0;
			var minweight = 0;
			
			for (var i = 0; i < _rows.length; i++) {
				var row = _rows[i];
				if (!row || row.length == 0) {
					index = i;
					break;
				}
				
				if ((row.bitmap & 0x007F) == 0) {
					index = i;
					break;
				}
				
				if (!minweight || row.weight < minweight) {
					best = i;
					minweight = row.weight;
				}
				
				index = i + 1;
			}
			
			if (index >= Math.floor(_canvas.height / _this.config.fontsize)) {
				index = best;
			}
			
			return index;
		}
		
		function _update(e) {
			_context.clearRect(0, 0, _canvas.width, _canvas.height);
			
			var blockwidth = _canvas.width / 10;
			var hasContent = false;
			
			for (var i = 0; i < _rows.length; i++) {
				var row = _rows[i];
				if (!row || row.length == 0) {
					continue;
				}
				
				row.bitmap = 0x0000;
				
				var offsetY = i * _this.config.fontsize;
				for (var j = 0; j < row.length; j++) {
					var bullet = row[j];
					var offsetX = _canvas.width - bullet.weight * bullet.tick++;
					if (offsetX <= -1 * bullet.width) {
						row.splice(j--, 1);
						row.weight -= bullet.weight;
						
						bullet = undefined;
						
						continue;
					}
					
					var bits = Math.ceil(bullet.width / blockwidth);
					var pos = Math.floor(offsetX / blockwidth);
					row.bitmap |= ((1 << bits) - 1) << (10 - pos);
					
					hasContent = true;
					
					_context.fillText(bullet.text, offsetX, offsetY);
				}
			}
			
			if (!hasContent) {
				_stopTimer();
			}
		}
		
		function _startTimer() {
			if (!_timer) {
				_timer = new utils.timer(30);
				_timer.addEventListener(events.PLAYEASE_TIMER, _update);
			}
			_timer.start();
		}
		
		function _stopTimer() {
			if (_timer) {
				_timer.stop();
			}
		}
		
		_this.setProperty = function(key, value) {
			_this.config[key] = value;
		};
		
		_this.element = function() {
			return _canvas;
		};
		
		_this.resize = function(width, height) {
			_canvas.width = width;
			_canvas.height = height;
			
			_context = _canvas.getContext("2d");
			_context.font = 'bold ' + _this.config.fontsize + 'px 微软雅黑';
			_context.fillStyle = '#E6E6E6';
			_context.globalAlpha = _this.config.alpha;
			_context.textAlign = 'left';
			_context.textBaseline = 'top';
		};
		
		_init();
	};
	
	components.bulletscreen.alphas = alphas;
	components.bulletscreen.positions = positions;
})(playease);
