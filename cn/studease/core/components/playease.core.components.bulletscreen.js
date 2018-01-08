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
				lineHeight: 20,
				interval: 30,
				duration: 10000,
				alpha: alphas.LOW,
				position: positions.FULLSCREEN,
				visible: true
			},
			_canvas,
			_context,
			_rows,
			_maxRow,
			_random,
			_marginTop,
			_beats,
			_timer;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_rows = [];
			_marginTop = _this.config.lineHeight - _this.config.fontsize;
			
			_canvas = utils.createElement('canvas');
			
			_this.resize(_this.config.width, _this.config.height);
		}
		
		_this.bullet = function(text) {
			var _self = this,
				_doublechars;
			
			function _init() {
				var metrics = _context.measureText(text);
				_doublechars = _getDoubleChars(text);
				
				_self.text = text;
				_self.width = metrics.width + 10;
				_self.weight = text.length + _doublechars;
				_self.ticks = 0;
			}
			
			function _getDoubleChars(text) {
				var arr = text.match(/([^x00-xff])/gi);
				return arr ? arr.length : 0;
			}
			
			_init();
		};
		
		_this.shoot = function(text) {
			if (!_context || _this.config.enable == false) {
				return;
			}
			
			var bullet = new _this.bullet(text);
			var index = _getIndex(bullet);
			
			var row = _rows[index];
			if (!row) {
				row = [];
				row.weight = 0;
				
				_rows[index] = row;
			}
			
			row.weight += bullet.weight;
			row.pushable = 0;
			row.push(bullet);
			
			_startTimer();
		};
		
		function _getIndex(bullet) {
			var index = _rows.length;
			var best = 0;
			var minweight = 0;
			
			for (var i = Math.floor(Math.random() * _random); i < _maxRow; i++) {
				var row = _rows[i];
				if (utils.typeOf(row) != 'array' || row.length == 0 || row.pushable >= bullet.weight) {
					index = i;
					break;
				}
				
				var last = row[row.length - 1];
				var ticks = _beats - last.ticks;
				var offsetX = _canvas.width - (_canvas.width + bullet.width) * ticks / _beats;
				if (row.pushable && offsetX >= 0) {
					index = i;
					break;
				}
				
				if (!minweight || row.weight < minweight) {
					best = i;
					minweight = row.weight;
				}
			}
			
			if (index >= _maxRow) {
				index = best;
			}
			
			return index;
		}
		
		function _update(e) {
			_context.clearRect(0, 0, _canvas.width, _canvas.height);
			
			var hasContent = false;
			
			for (var i = 0; i < _rows.length; i++) {
				var row = _rows[i];
				if (utils.typeOf(row) != 'array' || row.length == 0) {
					continue;
				}
				
				var offsetY = _marginTop + i * _this.config.lineHeight;
				
				for (var j = 0; j < row.length; j++) {
					var bullet = row[j];
					
					if (bullet.ticks++ >= _beats) {
						row.splice(j--, 1);
						row.weight -= bullet.weight;
						continue;
					}
					
					var offsetX = _canvas.width - (_canvas.width + bullet.width) * bullet.ticks / _beats;
					_context.fillText(bullet.text, offsetX, offsetY);
					
					if (j == row.length - 1 && offsetX + bullet.width <= _canvas.width) {
						row.pushable = bullet.weight;
					}
					
					hasContent = true;
				}
			}
			
			if (hasContent == false) {
				_stopTimer();
			}
		}
		
		function _startTimer() {
			if (!_timer) {
				_timer = new utils.timer(_this.config.interval);
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
			
			switch (key) {
				case 'enable':
					_this.dispatchEvent(events.PLAYEASE_BULLET, { bullet: value ? 'on' : 'off' });
					break;
				default:
					break;
			}
		};
		
		_this.element = function() {
			return _canvas;
		};
		
		_this.resize = function(width, height) {
			var rows = _canvas.height / (_this.config.fontsize * 1.4);
			_maxRow = Math.floor(rows);
			_random = rows / 2;
			
			var n = 1;
			if (width > _this.config.width) {
				n = width / _this.config.width;
				n *= Math.pow(.8, n - 1);
			}
			_beats = _this.config.duration * n / _this.config.interval;
			
			_canvas.width = width;
			_canvas.height = height;
			
			try {
				_context = _canvas.getContext("2d");
			} catch (err) {
				return;
			}
			
			_context.font = 'bold ' + _this.config.fontsize + 'px Microsoft YaHei,arial,sans-serif';
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
