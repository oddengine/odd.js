playease = function() {
	if (playease.api) {
		return playease.api.getInstance.apply(this, arguments);
	}
};

playease.version = '1.0.19';

(function(playease) {
	var utils = playease.utils = {};
	
	utils.exists = function(item) {
		switch (utils.typeOf(item)) {
			case 'string':
				return (item.length > 0);
			case 'object':
				return (item !== null);
			case 'null':
				return false;
		}
		return true;
	};
	
	utils.extend = function() {
		var args = Array.prototype.slice.call(arguments, 0),
			obj = args[0];
		if (args.length > 1) {
			for (var i = 1; i < args.length; i++) {
				utils.foreach(args[i], function(key, val) {
					if (val !== undefined && val !== null) {
						obj[key] = val;
					}
				});
			}
		}
		return obj;
	};
	
	utils.foreach = function(data, fn) {
		for (var key in data) {
			if (data.hasOwnProperty && utils.typeOf(data.hasOwnProperty) === 'function') {
				if (data.hasOwnProperty(key)) {
					fn(key, data[key]);
				}
			} else {
				// IE8 has a problem looping through XML nodes
				fn(key, data[key]);
			}
		}
	};
	
	utils.getCookie = function(key) {
		var arr, reg=new RegExp('(^| )' + key + '=([^;]*)(;|$)');
		if (arr = document.cookie.match(reg))
			return unescape(arr[2]);
		return null;
	};
	
	utils.formatTime = function(date) {
		var hours = date.getHours() + 1;
		var minutes = date.getMinutes();
		var seconds = date.getSeconds();
		return date.toLocaleDateString() + ' ' + utils.pad(hours, 2) + ':' + utils.pad(minutes, 2) + ':' + utils.pad(seconds, 2);
	};
	
	utils.pad = function(val, len) {
		var str = val + '';
		while (str.length < len) {
			str = '0' + str;
		}
		return str;
	};
	
	
	utils.createElement = function(elem, className) {
		var newElement = document.createElement(elem);
		if (className) {
			newElement.className = className;
		}
		return newElement;
	};
	
	utils.addClass = function(element, classes) {
		var originalClasses = utils.typeOf(element.className) === 'string' ? element.className.split(' ') : [];
		var addClasses = utils.typeOf(classes) === 'array' ? classes : classes.split(' ');
		
		utils.foreach(addClasses, function(n, c) {
			if (utils.indexOf(originalClasses, c) === -1) {
				originalClasses.push(c);
			}
		});
		
		element.className = utils.trim(originalClasses.join(' '));
	};
	
	utils.removeClass = function(element, c) {
		var originalClasses = utils.typeOf(element.className) === 'string' ? element.className.split(' ') : [];
		var removeClasses = utils.typeOf(c) === 'array' ? c : c.split(' ');
		
		utils.foreach(removeClasses, function(n, c) {
			var index = utils.indexOf(originalClasses, c);
			if (index >= 0) {
				originalClasses.splice(index, 1);
			}
		});
		
		element.className = utils.trim(originalClasses.join(' '));
	};
	
	utils.emptyElement = function(element) {
		while (element.firstChild) {
			element.removeChild(element.firstChild);
		}
	};
	
	utils.typeOf = function(value) {
		if (value === null || value === undefined) {
			return 'null';
		}
		var typeofString = typeof value;
		if (typeofString === 'object') {
			try {
				if (toString.call(value) === '[object Array]') {
					return 'array';
				}
			} catch (e) {}
		}
		return typeofString;
	};
	
	utils.trim = function(inputString) {
		return inputString.replace(/^\s+|\s+$/g, '');
	};
	
	utils.indexOf = function(array, item) {
		if (array == null) return -1;
		for (var i = 0; i < array.length; i++) {
			if (array[i] === item) {
				return i;
			}
		}
		return -1;
	};
	
	utils.isMSIE = function(version) {
		if (version) {
			version = parseFloat(version).toFixed(1);
			return _userAgentMatch(new RegExp('msie\\s*' + version, 'i'));
		}
		return _userAgentMatch(/msie/i);
	};
	
	utils.isIOS = function(version) {
		if (version) {
			return _userAgentMatch(new RegExp('iP(hone|ad|od).+\\sOS\\s' + version, 'i'));
		}
		
		return _userAgentMatch(/iP(hone|ad|od)/i);
	};
	
	utils.isAndroid = function(version, excludeChrome) {
		//Android Browser appears to include a user-agent string for Chrome/18
		if (excludeChrome && _userAgentMatch(/chrome\/[123456789]/i) && !_userAgentMatch(/chrome\/18/)) {
			return false;
		}
		
		if (version) {
			// make sure whole number version check ends with point '.'
			if (utils.isInt(version) && !/\./.test(version)) {
				version = '' + version + '.';
			}
			
			return _userAgentMatch(new RegExp('Android\\s*' + version, 'i'));
		}
		
		return _userAgentMatch(/Android/i);
	};
	
	utils.isMobile = function() {
		return utils.isIOS() || utils.isAndroid();
	};
	
	function _userAgentMatch(regex) {
		var agent = navigator.userAgent.toLowerCase();
		return (agent.match(regex) !== null);
	};
	
	/** Logger */
	var console = window.console = window.console || {
		log: function() {}
	};
	utils.log = function() {
		var args = Array.prototype.slice.call(arguments, 0);
		if (utils.typeOf(console.log) === 'object') {
			console.log(args);
		} else {
			console.log.apply(console, args);
		}
	};
})(playease);

(function(playease) {
	var utils = playease.utils;
	
	utils.littleEndian = (function() {
		var buffer = new ArrayBuffer(2);
		new DataView(buffer).setInt16(0, 256, true);
		return new Int16Array(buffer)[0] === 256;
	})();
	
	utils.getUint32 = function(uint8, byteOffset, littleEndian) {
		if (byteOffset == undefined) {
			byteOffset = 0;
		}
		
		if (!littleEndian) {
			return (
				uint8[byteOffset + 0] << 24 |
				uint8[byteOffset + 1] << 16 |
				uint8[byteOffset + 2] <<  8 |
				uint8[byteOffset + 3]
			);
		}
		
		return (
			uint8[byteOffset + 0] |
			uint8[byteOffset + 1] >>>  8 |
			uint8[byteOffset + 2] >>> 16 |
			uint8[byteOffset + 3] >>> 24
		);
	};
})(playease);

(function(playease) {
	var utils = playease.utils,
		sheet;
	
	function createStylesheet() {
		var styleSheet = document.createElement('style');
		styleSheet.type = 'text/css';
		document.getElementsByTagName('head')[0].appendChild(styleSheet);
		return styleSheet.sheet || styleSheet.styleSheet;
	}
	
	var css = utils.css = function(selector, styles) {
		if (!sheet) {
			sheet = createStylesheet();
		}
		
		var _styles = '';
		utils.foreach(styles, function(style, value) {
			_styles += style + ': ' + value + '; ';
		});
		
		try {
			if (sheet.insertRule) 
				sheet.insertRule(selector + ' { ' + _styles + '}', sheet.cssRules.length);
			else 
				sheet.addRule(selector, _styles, sheet.rules.length);
		} catch (e) {
			utils.log('Failed to insert css rule: ' + selector);
		}
	};
	
	css.style = function(elements, styles, immediate) {
		if (elements === undefined || elements === null) {
			return;
		}
		if (elements.length === undefined) {
			elements = [elements];
		}
		
		var rules = utils.extend({}, styles);
		for (var i = 0; i < elements.length; i++) {
			var element = elements[i];
			if (element === undefined || element === null) {
				continue;
			}
			
			utils.foreach(rules, function(style, value) {
				var name = getStyleName(style);
				if (element.style[name] !== value) {
					element.style[name] = value;
				}
			});
		}
	};
	
	function getStyleName(name) {
		name = name.split('-');
		for (var i = 1; i < name.length; i++) {
			name[i] = name[i].charAt(0).toUpperCase() + name[i].slice(1);
		}
		return name.join('');
	}
})(playease);

(function(playease) {
	playease.events = {
		// General Events
		ERROR: 'error',
		
		// API Events
		PLAYEASE_READY: 'playeaseReady',
		PLAYEASE_SETUP_ERROR: 'playeaseSetupError',
		PLAYEASE_RENDER_ERROR: 'playeaseRenderError',
		
		PLAYEASE_STATE: 'playeaseState',
		PLAYEASE_PROPERTY: 'playeaseProperty',
		PLAYEASE_METADATA: 'playeaseMetaData',
		
		PLAYEASE_BUFFER: 'playeaseBuffer',
		PLAYEASE_PLAY: 'playeasePlay',
		PLAYEASE_PAUSE: 'playeasePause',
		PLAYEASE_RELOAD: 'playeaseReload',
		PLAYEASE_SEEK: 'playeaseSeek',
		PLAYEASE_STOP: 'playeaseStop',
		PLAYEASE_REPORT: 'playeaseReport',
		PLAYEASE_MUTE: 'playeaseMute',
		PLAYEASE_VOLUME: 'playeaseVolume',
		PLAYEASE_HD: 'playeaseHD',
		PLAYEASE_BULLET: 'playeaseBullet',
		PLAYEASE_FULLPAGE: 'playeaseFullpage',
		PLAYEASE_FULLSCREEN: 'playeaseFullscreen',
		
		// View Events
		PLAYEASE_VIEW_PLAY: 'playeaseViewPlay',
		PLAYEASE_VIEW_PAUSE: 'playeaseViewPause',
		PLAYEASE_VIEW_RELOAD: 'playeaseViewReload',
		PLAYEASE_VIEW_SEEK: 'playeaseViewSeek',
		PLAYEASE_VIEW_STOP: 'playeaseViewStop',
		PLAYEASE_VIEW_REPORT: 'playeaseViewReport',
		PLAYEASE_VIEW_MUTE: 'playeaseViewMute',
		PLAYEASE_VIEW_VOLUME: 'playeaseViewVolume',
		PLAYEASE_VIEW_HD: 'playeaseViewHD',
		PLAYEASE_VIEW_BULLET: 'playeaseViewBullet',
		PLAYEASE_VIEW_FULLPAGE: 'playeaseViewFullpage',
		PLAYEASE_VIEW_FULLSCREEN: 'playeaseViewFullscreen',
		
		// Loader Events
		PLAYEASE_CONTENT_LENGTH: 'playeaseContentLength',
		PLAYEASE_PROGRESS: 'playeaseProgress',
		PLAYEASE_COMPLETE: 'playeaseComplete',
		
		// Muxer Events
		PLAYEASE_FLV_TAG: 'playeaseFlvTag',
		PLAYEASE_AVC_CONFIG_RECORD: 'playeaseAVCConfigRecord',
		PLAYEASE_AVC_SAMPLE: 'playeaseAVCSample',
		PLAYEASE_AAC_SPECIFIC_CONFIG: 'playeaseAACSpecificConfig',
		PLAYEASE_AAC_SAMPLE: 'playeaseAACSample',
		
		PLAYEASE_MP4_INIT_SEGMENT: 'playeaseMp4InitSegment',
		PLAYEASE_MP4_SEGMENT: 'playeaseMp4Segment',
		
		PLAYEASE_END_OF_STREAM: 'playeaseEndOfStream',
		
		// Timer Events
		PLAYEASE_TIMER: 'playeaseTimer',
		PLAYEASE_TIMER_COMPLETE: 'playeaseTimerComplete'
	};
})(playease);

(function(playease) {
	var utils = playease.utils,
		events = playease.events;
	
	events.eventdispatcher = function(id) {
		var _id = id,
			_listeners = {},
			_globallisteners = [];
		
		this.addEventListener = function(type, listener, count) {
			try {
				if (!utils.exists(_listeners[type])) {
					_listeners[type] = [];
				}
				
				if (utils.typeOf(listener) === 'string') {
					listener = (new Function('return ' + listener))();
				}
				_listeners[type].push({
					listener: listener,
					count: count || null
				});
			} catch (err) {
				utils.log('error', err);
			}
			return false;
		};
		
		this.removeEventListener = function(type, listener) {
			if (!_listeners[type]) {
				return;
			}
			try {
				if (listener === undefined) {
					_listeners[type] = [];
					return;
				}
				var i;
				for (i = 0; i < _listeners[type].length; i++) {
					if (_listeners[type][i].listener.toString() === listener.toString()) {
						_listeners[type].splice(i, 1);
						break;
					}
				}
			} catch (err) {
				utils.log('error', err);
			}
			return false;
		};
		
		this.addGlobalListener = function(listener, count) {
			try {
 				if (utils.typeOf(listener) === 'string') {
					listener = (new Function('return ' + listener))();
				}
				_globallisteners.push({
					listener: listener,
					count: count || null
				});
			} catch (err) {
				utils.log('error', err);
			}
			return false;
		};
		
		this.removeGlobalListener = function(listener) {
			if (!listener) {
				return;
			}
			try {
				var i;
				for (i = _globallisteners.length - 1; i >= 0; i--) {
					if (_globallisteners[i].listener.toString() === listener.toString()) {
						_globallisteners.splice(i, 1);
					}
				}
			} catch (err) {
				utils.log('error', err);
			}
			return false;
		};
		
		
		this.dispatchEvent = function(type, data) {
			if (!data) {
				data = {};
			}
			utils.extend(data, {
				id: _id,
				version: playease.version,
				type: type
			});
			if (playease.debug) {
				utils.log(type, data);
			}
			_dispatchEvent(_listeners[type], data, type);
			_dispatchEvent(_globallisteners, data, type);
		};
		
		function _dispatchEvent(listeners, data, type) {
			if (!listeners) {
				return;
			}
			for (var index = 0; index < listeners.length; index++) {
				var listener = listeners[index];
				if (listener) {
					if (listener.count !== null && --listener.count === 0) {
						delete listeners[index];
					}
					try {
						listener.listener(data);
					} catch (err) {
						utils.log('Error handling "' + type +
							'" event listener [' + index + ']: ' + err.toString(), listener.listener, data);
					}
				}
			}
		}
	};
})(playease);

(function(playease) {
	var utils = playease.utils,
		events = playease.events;
	
	utils.loader = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('utils.loader')),
			_defaults = {
				method: 'GET',
				headers: {},
				mode: 'cors',
				cache: 'default'
			},
			_uri,
			_aborted;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			var headers = new Headers();
			for (var key in _this.config.headers) {
				headers.append(key, _this.config.headers[key]);
			}
			_this.config.headers = headers;
			
			_aborted = false;
		}
		
		_this.load = function(uri) {
			_uri = uri;
			_aborted = false;
			
			if (!fetch) {
				_this.dispatchEvent(events.ERROR, { message: 'Loader error: Fetch is not supported.' });
				return;
			}
			
			fetch(_uri, _this.config).then(function(res) {
				if (_aborted) {
					_aborted = false;
					return;
				}
				
				if (res.ok && res.status >= 200 && res.status <= 299) {
					var len = res.headers.get('Content-Length');
					if (len) {
						len = parseInt(len);
						_this.dispatchEvent(events.PLAYEASE_CONTENT_LENGTH, { length: len });
					}
					
					return _this.pump(res.body.getReader());
				} else {
					_this.dispatchEvent(events.ERROR, { message: 'Loader error: Invalid http status(' + res.status + ' ' + res.statusText + ').' });
				}
			}).catch(function(e) {
				_this.dispatchEvent(events.ERROR, { message: 'Loader error: ' + e.message });
			});
		};
		
		_this.pump = function(reader) {
			return reader.read().then(function(res) {
				if (res.done) {
					_this.dispatchEvent(events.PLAYEASE_COMPLETE);
					return;
				}
				
				if (_aborted) {
					_aborted = false;
					return reader.cancel();
				}
				
				_this.dispatchEvent(events.PLAYEASE_PROGRESS, { data: res.value.buffer });
				
				return _this.pump(reader);
			}).catch(function(e) {
				_this.dispatchEvent(events.ERROR, { message: 'Loader error: Failed to read response data.' });
			});
		};
		
		_this.abort = function() {
			_aborted = true;
		};
		
		_init();
	};
})(playease);

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

(function(playease) {
	var utils = playease.utils,
		events = playease.events;
	
	utils.timer = function(delay, repeatCount) {
		var _this = utils.extend(this, new events.eventdispatcher('utils.timer')),
			_intervalId,
			_currentCount = 0,
			_running = false;
		
		function _init() {
			_this.delay = delay || 50;
			_this.repeatCount = repeatCount || 0;
		}
		
		_this.start = function() {
			if (_running === false) {
				_intervalId = setInterval(_onTimer, _this.delay);
				_running = true;
			}
		};
		
		function _onTimer() {
			_currentCount++;
			_this.dispatchEvent(events.PLAYEASE_TIMER);
			
			if (_this.repeatCount > 0 && _currentCount >= _this.repeatCount) {
				_this.stop();
				_this.dispatchEvent(events.PLAYEASE_TIMER_COMPLETE);
			}
		}
		
		_this.stop = function() {
			if (_running) {
				clearInterval(_intervalId);
				_intervalId = 0;
				_running = false;
			}
		};
		
		_this.reset = function() {
			_this.stop();
			_currentCount = 0;
		};
		
		_this.currentCount = function() {
			return _currentCount;
		};
		
		_this.running = function() {
			return _running;
		};
		
		_init();
	};
})(playease);

(function(playease) {
	var utils = playease.utils,
		events = playease.events;
	
	var _insts = {},
		_eventMapping = {
			onError: events.ERROR,
			onReady: events.PLAYEASE_READY,
			onMetaData: events.PLAYEASE_METADATA,
			onBuffer: events.PLAYEASE_BUFFER,
			onPlay: events.PLAYEASE_PLAY,
			onPause: events.PLAYEASE_PAUSE,
			onReload: events.PLAYEASE_RELOAD,
			onSeek: events.PLAYEASE_SEEK,
			onStop: events.PLAYEASE_STOP,
			onReport: events.PLAYEASE_REPORT,
			onMute: events.PLAYEASE_MUTE,
			onVolume: events.PLAYEASE_VOLUME,
			onHD: events.PLAYEASE_HD,
			onBullet: events.PLAYEASE_BULLET,
			onFullpage: events.PLAYEASE_FULLPAFE,
			onFullscreen: events.PLAYEASE_VIEW_FULLSCREEN
		};
	
	playease.api = function(container) {
		var _this = utils.extend(this, new events.eventdispatcher('api')),
			_entity;
		
		_this.container = container;
		_this.id = container.id;
		
		function _init() {
			utils.foreach(_eventMapping, function(name, type) {
				_this[name] = function(callback) {
					_this.addEventListener(type, callback);
				};
			});
		}
		
		_this.setup = function(options) {
			utils.emptyElement(_this.container);
			
			playease.debug = !!options.debug;
			
			_this.config = options;
			_this.config.id = _this.id;
			
			_this.embedder = new playease.embed(_this);
			_this.embedder.addGlobalListener(_onEvent);
			_this.embedder.embed();
			
			return _this;
		};
		
		_this.setEntity = function(entity, renderName) {
			_entity = entity;
			_this.renderName = renderName;
			
			_this.play = _entity.play;
			_this.pause = _entity.pause;
			_this.reload = _entity.reload;
			_this.seek = _entity.seek;
			_this.stop = _entity.stop;
			_this.report = _entity.report;
			_this.mute = _entity.mute;
			_this.volume = _entity.volume;
			_this.hd = _entity.hd;
			_this.bullet = _entity.bullet;
			_this.fullpage = _entity.fullpage;
			_this.fullscreen = _entity.fullscreen;
			
			_this.resize = _entity.resize;
		};
		
		function _onEvent(e) {
			_forward(e);
		}
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_init();
	};
	
	playease.api.getInstance = function(identifier) {
		var _container;
		
		if (identifier == null) {
			identifier = 0;
		} else if (identifier.nodeType) {
			_container = identifier;
		} else if (utils.typeOf(identifier) === 'string') {
			_container = document.getElementById(identifier);
		}
		
		if (_container) {
			var inst = _insts[_container.id];
			if (!inst) {
				_insts[identifier] = inst = new playease.api(_container);
			}
			return inst;
		} else if (utils.typeOf(identifier) === 'number') {
			return _insts[identifier];
		}
		
		return null;
	};
	
	playease.api.displayError = function(message, config) {
		
	};
})(playease);

(function(playease) {
	playease.muxer = {};
})(playease);

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

(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		muxer = playease.muxer;
	
	var SPS = muxer.SPS = {};
	
	var ExpGolomb = function(bytes) {
		var _this = this,
			_buffer,
			_bufferIndex,
			_totalBytes,
			_totalBits,
			_currentWord,
			_currentWordBitsLeft;
		
		function _init() {
			_buffer = bytes;
			_bufferIndex = 0;
			_totalBytes = bytes.byteLength;
			_totalBits = bytes.byteLength * 8;
			_currentWord = 0;
			_currentWordBitsLeft = 0;
		}
		
		_this.readBits = function(bits) {
			if (bits > 32) {
				throw 'Data not enough while reading bits of ExpGolomb.';
			}
			
			if (bits <= _currentWordBitsLeft) {
				var res = _currentWord >>> (32 - bits);
				_currentWord <<= bits;
				_currentWordBitsLeft -= bits;
				
				return res;
			}
			
			var res = _currentWordBitsLeft ? _currentWord : 0;
			res = res >>> (32 - _currentWordBitsLeft);
			
			var neededBitsLeft = bits - _currentWordBitsLeft;
			_fillCurrentWord();
			
			var nextBits = Math.min(neededBitsLeft, _currentWordBitsLeft);
			var res2 = _currentWord >>> (32 - nextBits);
			_currentWord <<= nextBits;
			_currentWordBitsLeft -= nextBits;
			
			res = (res << nextBits) | res2;
			
			return res;
		};
		
		_this.readBool = function() {
			return _this.readBits(1) === 1;
		};
		
		_this.readByte = function() {
			return _this.readBits(8);
		};
		
		_this.readUEG = function() { // unsigned exponential golomb
			var leadingZeros = _skipLeadingZero();
			
			return _this.readBits(leadingZeros + 1) - 1;
		};
		
		_this.readSEG = function() { // signed exponential golomb
			var value = _this.readUEG();
			if (value & 0x01) {
				return (value + 1) >>> 1;
			}
			
			return -1 * (value >>> 1);
		};
		
		function _fillCurrentWord() {
			var bytesLeft = _totalBytes - _bufferIndex;
			if (bytesLeft <= 0) {
				throw 'Data not enough while filling current word.';
			}
			
			var readingBytes = Math.min(4, bytesLeft);
			var word = new Uint8Array(4);
			word.set(_buffer.subarray(_bufferIndex, _bufferIndex + readingBytes));
			_currentWord = new DataView(word.buffer).getUint32(0, false);
			
			_bufferIndex += readingBytes;
			_currentWordBitsLeft = readingBytes * 8;
		}
		
		function _skipLeadingZero() {
			var zeroCount;
			for (zeroCount = 0; zeroCount < _currentWordBitsLeft; zeroCount++) {
				if ((_currentWord & (0x80000000 >>> zeroCount)) !== 0) {
					_currentWord <<= zeroCount;
					_currentWordBitsLeft -= zeroCount;
					
					return zeroCount;
				}
			}
			
			_fillCurrentWord();
			
			return zeroCount + _skipLeadingZero();
		}
		
		_this.destroy = function() {
			_buffer = null;
		};
		
		_init();
	};
	
	
	SPS.parse = function(bytes) {
		var rbsp = _ebsp2rbsp(bytes);
		var gb = new ExpGolomb(rbsp);
		gb.readByte();
		
		var profile_idc = gb.readByte(); // profile_idc
		gb.readByte();                   // constraint_set_flags[5] + reserved_zero[3]
		
		var level_idc = gb.readByte();   // level_idc
		gb.readUEG();                    // seq_parameter_set_id
		
		var profile_string = _getProfileString(profile_idc);
		var level_string = _getLevelString(level_idc);
		var chroma_format_idc = 1;
		var chroma_format = 420;
		var chroma_format_table = [0, 420, 422, 444];
		var bit_depth = 8;
		
		if (profile_idc === 100 || profile_idc === 110 || profile_idc === 122 || profile_idc === 244
				|| profile_idc === 44 || profile_idc === 83 || profile_idc === 86 || profile_idc === 118
				|| profile_idc === 128 || profile_idc === 138 || profile_idc === 144) {
			chroma_format_idc = gb.readUEG();
			if (chroma_format_idc === 3) {
				gb.readBits(1);             // separate_colour_plane_flag
			}
			if (chroma_format_idc <= 3) {
				chroma_format = chroma_format_table[chroma_format_idc];
			}
			
			bit_depth = gb.readUEG() + 8; // bit_depth_luma_minus8
			gb.readUEG();                 // bit_depth_chroma_minus8
			gb.readBits(1);               // qpprime_y_zero_transform_bypass_flag
			if (gb.readBool()) {          // seq_scaling_matrix_present_flag
				var scaling_list_count = chroma_format_idc !== 3 ? 8 : 12;
				for (var i = 0; i < scaling_list_count; i++) {
					if (gb.readBool()) {      // seq_scaling_list_present_flag
						_skipScalingList(gb, i < 6 ? 16 : 64);
					}
				}
			}
		}
		
		gb.readUEG();     // log2_max_frame_num_minus4
		
		var pic_order_cnt_type = gb.readUEG();
		if (pic_order_cnt_type === 0) {
			gb.readUEG();   // log2_max_pic_order_cnt_lsb_minus_4
		} else if (pic_order_cnt_type === 1) {
			gb.readBits(1); // delta_pic_order_always_zero_flag
			gb.readSEG();   // offset_for_non_ref_pic
			gb.readSEG();   // offset_for_top_to_bottom_field
			
			var num_ref_frames_in_pic_order_cnt_cycle = gb.readUEG();
			for (var _i = 0; _i < num_ref_frames_in_pic_order_cnt_cycle; _i++) {
				gb.readSEG(); // offset_for_ref_frame
			}
		}
		
		gb.readUEG();     // max_num_ref_frames
		gb.readBits(1);   // gaps_in_frame_num_value_allowed_flag
		
		var pic_width_in_mbs_minus1 = gb.readUEG();
		var pic_height_in_map_units_minus1 = gb.readUEG();
		
		var frame_mbs_only_flag = gb.readBits(1);
		if (frame_mbs_only_flag === 0) {
			gb.readBits(1); // mb_adaptive_frame_field_flag
		}
		
		gb.readBits(1);   // direct_8x8_inference_flag
		
		var frame_crop_left_offset = 0;
		var frame_crop_right_offset = 0;
		var frame_crop_top_offset = 0;
		var frame_crop_bottom_offset = 0;
		
		var frame_cropping_flag = gb.readBool();
		if (frame_cropping_flag) {
			frame_crop_left_offset = gb.readUEG();
			frame_crop_right_offset = gb.readUEG();
			frame_crop_top_offset = gb.readUEG();
			frame_crop_bottom_offset = gb.readUEG();
		}
		
		var sar_width = 1,
			sar_height = 1;
		var fps = 0,
			fps_fixed = true,
			fps_num = 0,
			fps_den = 0;
		
		var vui_parameters_present_flag = gb.readBool();
		if (vui_parameters_present_flag) {
			if (gb.readBool()) {   // aspect_ratio_info_present_flag
				var aspect_ratio_idc = gb.readByte();
				var sar_w_table = [1, 12, 10, 16, 40, 24, 20, 32, 80, 18, 15, 64, 160, 4, 3, 2];
				var sar_h_table = [1, 11, 11, 11, 33, 11, 11, 11, 33, 11, 11, 33, 99, 3, 2, 1];
				
				if (aspect_ratio_idc > 0 && aspect_ratio_idc < 16) {
					sar_width = sar_w_table[aspect_ratio_idc - 1];
					sar_height = sar_h_table[aspect_ratio_idc - 1];
				} else if (aspect_ratio_idc === 255) {
					sar_width = gb.readByte() << 8 | gb.readByte();
					sar_height = gb.readByte() << 8 | gb.readByte();
				}
			}
			
			if (gb.readBool()) {   // overscan_info_present_flag
				gb.readBool();       // overscan_appropriate_flag
			}
			if (gb.readBool()) {   // video_signal_type_present_flag
				gb.readBits(4);      // video_format & video_full_range_flag
				if (gb.readBool()) { // colour_description_present_flag
					gb.readBits(24);   // colour_primaries & transfer_characteristics & matrix_coefficients
				}
			}
			if (gb.readBool()) {   // chroma_loc_info_present_flag
				gb.readUEG();        // chroma_sample_loc_type_top_field
				gb.readUEG();        // chroma_sample_loc_type_bottom_field
			}
			if (gb.readBool()) {   // timing_info_present_flag
				var num_units_in_tick = gb.readBits(32);
				var time_scale = gb.readBits(32);
				
				fps_fixed = gb.readBool(); // fixed_frame_rate_flag
				fps_num = time_scale;
				fps_den = num_units_in_tick * 2;
				fps = fps_num / fps_den;
			}
		}
		
		var sarScale = 1;
		if (sar_width !== 1 || sar_height !== 1) {
			sarScale = sar_width / sar_height;
		}
		
		var crop_unit_x = 0,
			crop_unit_y = 0;
		if (chroma_format_idc === 0) {
			crop_unit_x = 1;
			crop_unit_y = 2 - frame_mbs_only_flag;
		} else {
			var sub_wc = chroma_format_idc === 3 ? 1 : 2;
			var sub_hc = chroma_format_idc === 1 ? 2 : 1;
			crop_unit_x = sub_wc;
			crop_unit_y = sub_hc * (2 - frame_mbs_only_flag);
		}
		
		var codec_width = (pic_width_in_mbs_minus1 + 1) * 16;
		var codec_height = (2 - frame_mbs_only_flag) * ((pic_height_in_map_units_minus1 + 1) * 16);
		
		codec_width -= (frame_crop_left_offset + frame_crop_right_offset) * crop_unit_x;
		codec_height -= (frame_crop_top_offset + frame_crop_bottom_offset) * crop_unit_y;
		
		var present_width = Math.ceil(codec_width * sarScale);
		
		gb.destroy();
		gb = null;
		
		return {
			profile_string: profile_string, // baseline, high, high10, ...
			level_string: level_string,     // 3, 3.1, 4, 4.1, 5, 5.1, ...
			bit_depth: bit_depth,           // 8bit, 10bit, ...
			chroma_format: chroma_format,   // 4:2:0, 4:2:2, ...
			chroma_format_string: _getChromaFormatString(chroma_format),
			frame_rate: {
				fixed: fps_fixed,
				fps: fps,
				fps_den: fps_den,
				fps_num: fps_num
			},
			sar_ratio: {
				width: sar_width,
				height: sar_height
			},
			codec_size: {
				width: codec_width,
				height: codec_height
			},
			present_size: {
				width: present_width,
				height: codec_height
			}
		};
	};
	
	function _ebsp2rbsp(bytes) {
		var len = bytes.byteLength;
		var dst = new Uint8Array(len);
		var index = 0;
		
		for (var i = 0; i < len; i++) {
			if (i >= 2) {
				if (bytes[i] === 0x03 && bytes[i - 1] === 0x00 && bytes[i - 2] === 0x00) { // Unescape: Skip 0x03 after 00 00
					continue;
				}
			}
			
			dst[index] = bytes[i];
			index++;
		}
		
		return new Uint8Array(dst.buffer, 0, index);
	}
	
	function _skipScalingList(gb, count) {
		var last_scale = 8,
			next_scale = 8,
			delta_scale = 0;
		
		for (var i = 0; i < count; i++) {
			if (next_scale !== 0) {
				delta_scale = gb.readSEG();
				next_scale = (last_scale + delta_scale + 256) % 256;
			}
			
			last_scale = next_scale === 0 ? last_scale : next_scale;
		}
	}
	
	function _getProfileString(profile_idc) {
		var str;
		
		switch (profile_idc) {
			case 66:
				str = 'Baseline';
				break;
			case 77:
				str = 'Main';
				break;
			case 88:
				str = 'Extended';
				break;
			case 100:
				str = 'High';
				break;
			case 110:
				str = 'High10';
				break;
			case 122:
				str = 'High422';
				break;
			case 244:
				str = 'High444';
				break;
			default:
				str = 'Unknown';
		}
		
		return str;
	}
	
	function _getLevelString(level_idc) {
		return (level_idc / 10).toFixed(1);
	}
	
	function _getChromaFormatString(chroma) {
		var str;
		
		switch (chroma) {
			case 420:
				str = '4:2:0';
				break;
			case 422:
				str = '4:2:2';
				break;
			case 444:
				str = '4:4:4';
				break;
			default:
				str = 'Unknown';
		}
		
		return str;
	}
})(playease);

(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		muxer = playease.muxer,
		SPS = muxer.SPS,
		
		TAG = {
			AUDIO:  0x08,
			VIDEO:  0x09,
			SCRIPT: 0x12
		},
		FORMATS = {
			LINEAR_PCM_PLATFORM_ENDIAN:   0x0,
			ADPCM:                        0x1,
			MP3:                          0x2,
			LINEAR_PCM_LITTLE_ENDIAN:     0x3,
			NELLYMOSER_16_kHz_MONO:       0x4,
			NELLYMOSER_8_kHz_MONO:        0x5,
			NELLYMOSER:                   0x6,
			G_711_A_LAW_LOGARITHMIC_PCM:  0x7,
			G_711_MU_LAW_LOGARITHMIC_PCM: 0x8,
			RESERVED:                     0x9,
			AAC:                          0xA,
			SPEEX:                        0xB,
			MP3_8_kHz:                    0xE,
			DEVICE_SPECIFIC_SOUND:        0xF
		},
		FRAMES = {
			KEYFRAME:               0x1,
			INTER_FRAME:            0x2,
			DISPOSABLE_INTER_FRAME: 0x3,
			GENERATED_KEYFRAME:     0x4,
			INFO_OR_COMMAND_FRAME:  0x5
		},
		CODECS = {
			JPEG:           0x1,
			H263:           0x2,
			SCREEN_VIDEO:   0x3,
			VP6:            0x4,
			VP6_ALPHA:      0x5,
			SCREEN_VIDEO_2: 0x6,
			AVC:            0x7
		},
		AVC = {
			types: {
				SEQUENCE_HEADER: 0x00,
				NALU:            0x01,
				END_OF_SEQUENCE: 0x02
			}
		},
		AAC = {
			types: {
				SPECIFIC_CONFIG: 0x00,
				RAW_FRAME_DATA:  0x01
			},
			audioObjectTypes: {
				NULL:          0x00,
				AAC_MAIN:      0x01,
				AAC_LC:        0x02,
				AAC_SSR:       0x03, // Scalable Sample Rate
				AAC_LTP:       0x04, // Long Term Prediction
				AAC_HE_OR_SBR: 0x05, // Spectral Band Replication
				AAC_SCALABLE:  0x06
			},
			samplingRates: [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350]
		},
		rates = [5500, 11025, 22050, 44100],
		states = {
			START:  1, // just enum values
			HEADER: 2,
			DATA:   3,
			SIZE:   4
		};
	
	var mediainfo = function() {
		var _this = this,
			_defaults = {};
		
		function _init() {
			_this.mimeType = null;
			_this.duration = null;
			
			_this.hasAudio = null;
			_this.hasVideo = null;
			_this.audioCodec = null;
			_this.videoCodec = null;
			_this.audioDataRate = null;
			_this.videoDataRate = null;
			
			_this.audioSampleRate = null;
			_this.audioChannelCount = null;
			
			_this.width = null;
			_this.height = null;
			_this.fps = null;
			_this.profile = null;
			_this.level = null;
			_this.chromaFormat = null;
			_this.sarNum = null;
			_this.sarDen = null;
			
			_this.metadata = null;
			_this.segments = null;  // MediaInfo[]
			_this.segmentCount = null;
			_this.hasKeyframesIndex = null;
			_this.keyframesIndex = null;
		}
		
		_this.isComplete = function() {
			var audioInfoComplete = (_this.hasAudio === false)
					|| (_this.hasAudio === true && _this.audioCodec != null && _this.audioSampleRate != null && _this.audioChannelCount != null);
			
			var videoInfoComplete = (_this.hasVideo === false)
					|| (_this.hasVideo === true && _this.videoCodec != null && _this.width != null && _this.height != null && _this.fps != null
					&& _this.profile != null && _this.level != null && _this.chromaFormat != null && _this.sarNum != null && _this.sarDen != null);
			
			// keyframesIndex may not be present
			return _this.mimeType != null && _this.duration != null && _this.metadata != null && _this.hasKeyframesIndex != null
					&& audioInfoComplete && videoInfoComplete;
		};
		
		_this.isSeekable = function() {
			return _this.hasKeyframesIndex === true;
		};
		
		_this.getNearestKeyframe = function(milliseconds) {
			if (_this.keyframesIndex == null) {
				return null;
			}
			
			var table = _this.keyframesIndex;
			var keyframeIndex = _search(table.times, milliseconds);
			
			return {
				index: keyframeIndex,
				milliseconds: table.times[keyframeIndex],
				fileposition: table.filepositions[keyframeIndex]
			};
		};
		
		function _search(list, value) {
			var index = 0;
			var last = list.length - 1;
			var mid = 0;
			var lbound = 0;
			var ubound = last;
			
			if (value < list[0]) {
				index = 0;
				lbound = ubound + 1;  // skip search
			}
			
			while (lbound <= ubound) {
				mid = lbound + Math.floor((ubound - lbound) / 2);
				if (mid === last || (value >= list[mid] && value < list[mid + 1])) {
					index = mid;
					break;
				} else if (list[mid] < value) {
					lbound = mid + 1;
				} else {
					ubound = mid - 1;
				}
			}
			
			return index;
		}
	};
	
	
	muxer.flv = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('muxer.flv')),
			_defaults = {},
			_offset,
			_length,
			_state,
			_hasAudio,
			_hasVideo,
			_header,
			_tagsize,
			_hv,
			_sv,
			_lacking,
			_cachedchunks,
			
			_mediainfo,
			_metadata,
			_referenceFrameRate,
			_videoTrack,
			_audioTrack,
			_lengthSizeMinusOne,
			_timestampBase;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_offset = 0;
			_length = 0;
			
			_state = states.START;
			
			_header = new ArrayBuffer(11);
			_header.position = 0;
			_hv = new Uint8Array(_header);
			
			_tagsize = new ArrayBuffer(4);
			_tagsize.position = 0;
			_sv = new Uint8Array(_tagsize);
			
			_lacking = 0;
			_cachedchunks = [];
			
			_mediainfo = new mediainfo();
			
			_referenceFrameRate = {
				fixed: true,
				fps: 23.976,
				fps_num: 23976,
				fps_den: 1000
			};
			
			_videoTrack = { type: 'video', id: 1, sequenceNumber: 0, samples: [], length: 0 };
			_audioTrack = { type: 'audio', id: 2, sequenceNumber: 0, samples: [], length: 0 };
			
			_lengthSizeMinusOne = 0;
			_timestampBase = 0;
		}
		
		_this.reset = function() {
			_offset = 0;
			_length = 0;
			
			_state = states.START;
			
			_header.position = 0;
			_cachedchunks = [];
			
			_mediainfo = new mediainfo();
			
			_videoTrack = { type: 'video', id: 1, sequenceNumber: 0, samples: [], length: 0 };
			_audioTrack = { type: 'audio', id: 2, sequenceNumber: 0, samples: [], length: 0 };
			
			_lengthSizeMinusOne = 0;
			_timestampBase = 0;
		};
		
		_this.parse = function(chunk) {
			var dv = new Uint8Array(chunk);
			var pos = 0;
			
			if (_state == states.START) {
				if (chunk.byteLength < 13) {
					return 0;
				}
				
				pos = _this.probe(chunk);
				_state = states.SIZE;
				
				var firstTagSize = utils.getUint32(dv, pos);
				if (firstTagSize) {
					utils.log('First tag size ' + firstTagSize);
				}
				
				pos += 4;
				_state = states.HEADER;
			}
			
			for ( ; pos < chunk.byteLength; ) {
				switch (_state) {
					case states.HEADER:
						_hv[_header.position++] = dv[pos++];
						if (_header.position == 11) {
							_lacking = _hv[1] << 16 | _hv[2] << 8 | _hv[3];
							_state = states.DATA;
						}
						break;
					case states.DATA:
						var tagtype = _hv[0];
						var datasize = _hv[1] << 16 | _hv[2] << 8 | _hv[3];
						var timestamp = _hv[4] << 16 | _hv[5] << 8 | _hv[6] | _hv[7] << 24;
						var streamid = _hv[8] << 16 | _hv[9] << 8 | _hv[10];
						if (streamid != 0) {
							utils.log('Unknown stream ID ' + streamid);
						}
						
						var data = {
							tag: tagtype,
							data: chunk,
							offset: pos,
							size: datasize
						};
						
						switch (tagtype) {
							case TAG.AUDIO:
								data.timestamp = timestamp;
								if (_lacking == datasize) {
									data.format = dv[pos] >>> 4;
									data.rate = rates[(dv[pos] & 0x0C) >>> 2];
									data.samplesize = (dv[pos] & 0x02) >>> 1;
									data.sampletype = dv[pos] & 0x01;
								}
								break;
							case TAG.VIDEO:
								data.timestamp = timestamp;
								if (_lacking == datasize) {
									data.frametype = dv[pos] >>> 4;
									data.codec = dv[pos] & 0x0F;
								}
								break;
							case TAG.SCRIPT:
								data.hasAudio = _hasAudio;
								data.hasVideo = _hasVideo;
								break;
							default:
								// no addition, still dispatch
						}
						
						var actual = Math.min(chunk.byteLength - pos, _lacking);
						_lacking -= actual;
						
						pos += actual;
						
						if (_lacking) {
							_cachedchunks.push(data);
							break;
						}
						
						if (_cachedchunks.length) {
							data = _cachedchunks[0];
							
							var buf = new Uint8Array(datasize);
							buf.position = 0;
							
							var subarr;
							while (_cachedchunks.length) {
								var chk = _cachedchunks.shift();
								subarr = new Uint8Array(chk.data.slice(chk.offset));
								buf.set(subarr, buf.position);
								buf.position += chk.data.byteLength - chk.offset;
							}
							subarr = new Uint8Array(chunk.slice(0, pos));
							buf.set(subarr, buf.position);
							
							data.data = buf.buffer;
							data.offset = 0;
						}
						
						_state = states.SIZE;
						_tagsize.position = 0;
						
						_this.dispatchEvent(events.PLAYEASE_FLV_TAG, data);
						break;
					case states.SIZE:
						_sv[_tagsize.position++] = dv[pos++];
						if (_tagsize.position == 4) {
							var datasize = _hv[1] << 16 | _hv[2] << 8 | _hv[3];
							var prevTagSize = utils.getUint32(_sv);
							if (prevTagSize != 11 + datasize) {
								utils.log('prevTagSize(' + prevTagSize + ') is not equals to ' + (11 + datasize) + '.');
							}
							
							_state = states.HEADER;
							_header.position = 0;
						}
						break;
					default:
						utils.log('Unknown parsing state ' + _state);
						return;
				}
			}
		};
		
		_this.parseAVCVideoPacket = function(arrayBuffer, dataOffset, dataSize, timestamp, frameType) {
			if (dataSize < 5) {
				_this.dispatchEvent(events.ERROR, { message: 'Data not enough while parsing AVC video packet.' });
				return;
			}
			
			var v = new DataView(arrayBuffer, dataOffset, dataSize);
			
			var pos = 1; // skip frametype & codec
			var type = v.getUint8(pos++);
			var cts = v.getUint8(pos++) << 16 | v.getUint8(pos++) << 8 | v.getUint8(pos++); // CompositionTime
			
			switch (type) {
				case AVC.types.SEQUENCE_HEADER:
					_parseAVCDecoderConfigurationRecord(arrayBuffer, dataOffset + pos, dataSize - pos);
					break;
				case AVC.types.NALU:
					_parseAVCVideoData(arrayBuffer, dataOffset + pos, dataSize - pos, timestamp, frameType, cts);
					break;
				case AVC.types.END_OF_SEQUENCE:
					_this.dispatchEvent(events.PLAYEASE_END_OF_STREAM);
					break;
				default:
					_this.dispatchEvent(events.ERROR, { message: 'Unknown AVC video packet type ' + type + '.' });
			}
		};
		
		function _parseAVCDecoderConfigurationRecord(arrayBuffer, dataOffset, dataSize) {
			if (dataSize < 7) {
				_this.dispatchEvent(events.ERROR, { message: 'Data not enough while parsing AVC decoder configuration record.' });
				return;
			}
			
			var track = _videoTrack;
			var videometa = {
				type: track.type,
				id: track.id,
				timescale: 1000,
				duration: _metadata.duration * 1000 || 0
			};
			
			var v = new DataView(arrayBuffer, dataOffset, dataSize);
			
			var pos = 0;
			var configurationVersion = v.getUint8(pos++);
			var AVCProfileIndication = v.getUint8(pos++);
			var profileCompatibility = v.getUint8(pos++);
			var AVCLevelIndication = v.getUint8(pos++);
			
			if (configurationVersion != 1 || AVCProfileIndication == 0) {
				_this.dispatchEvent(events.ERROR, { message: 'Invalid AVCDecoderConfigurationRecord.' });
				return;
			}
			
			_lengthSizeMinusOne = 1 + (v.getUint8(pos++) & 0x03);
			if (_lengthSizeMinusOne != 3 && _lengthSizeMinusOne != 4) {
				_this.dispatchEvent(events.ERROR, { message: 'Invalid lengthSizeMinusOne ' + _lengthSizeMinusOne + '.' });
				return;
			}
			
			var numOfSequenceParameterSets = v.getUint8(pos++) & 0x1F;
			for (var i = 0; i < numOfSequenceParameterSets; i++) {
				var sequenceParameterSetLength = v.getUint16(pos);
				pos += 2;
				
				if (sequenceParameterSetLength == 0) {
					continue;
				}
				
				var sps = new Uint8Array(arrayBuffer, dataOffset + pos, sequenceParameterSetLength);
				pos += sequenceParameterSetLength;
				
				var spsinfo = SPS.parse(sps);
				_copySPSInfo(videometa, spsinfo, sps);
				_copyVideoInfo(videometa, spsinfo);
			}
			
			var numOfPictureParameterSets = v.getUint8(pos++);
			for (var i = 0; i < numOfPictureParameterSets; i++) {
				var pictureParameterSetLength = v.getUint16(pos);
				pos += 2;
				
				if (pictureParameterSetLength == 0) {
					continue;
				}
				
				var pps = new Uint8Array(arrayBuffer, dataOffset + pos, pictureParameterSetLength);
				pos += pictureParameterSetLength;
			}
			
			videometa.avcc = new Uint8Array(dataSize);
			videometa.avcc.set(new Uint8Array(arrayBuffer, dataOffset, dataSize), 0);
			
			_this.dispatchEvent(events.PLAYEASE_AVC_CONFIG_RECORD, { data: videometa });
		}
		
		function _copySPSInfo(videometa, info, sps) {
			videometa.codecWidth = info.codec_size.width;
			videometa.codecHeight = info.codec_size.height;
			videometa.presentWidth = info.present_size.width;
			videometa.presentHeight = info.present_size.height;
			
			videometa.profile = info.profile_string;
			videometa.level = info.level_string;
			videometa.bitDepth = info.bit_depth;
			videometa.chromaFormat = info.chroma_format;
			videometa.sarRatio = info.sar_ratio;
			videometa.frameRate = info.frame_rate;
			
			if (info.frame_rate.fixed === false || info.frame_rate.fps_num === 0 || info.frame_rate.fps_den === 0) {
				videometa.frameRate = _referenceFrameRate;
			}
			
			var fps_den = videometa.frameRate.fps_den;
			var fps_num = videometa.frameRate.fps_num;
			videometa.refSampleDuration = Math.floor(videometa.timescale * (fps_den / fps_num));
			
			var codecArray = sps.subarray(1, 4);
			var codecString = 'avc1.';
			for (var j = 0; j < 3; j++) {
				var h = codecArray[j].toString(16);
				if (h.length < 2) {
					h = '0' + h;
				}
				
				codecString += h;
			}
			
			videometa.codec = codecString;
		}
		
		function _copyVideoInfo(metadata, info) {
			_mediainfo.hasAudio = _hasAudio;
			_mediainfo.hasVideo = _hasVideo;
			_mediainfo.duration = _metadata.duration * 1000;
			_mediainfo.metadata = _metadata;
			
			_mediainfo.width = metadata.codecWidth;
			_mediainfo.height = metadata.codecHeight;
			_mediainfo.fps = metadata.frameRate.fps;
			_mediainfo.profile = metadata.profile;
			_mediainfo.level = metadata.level;
			_mediainfo.chromaFormat = info.chroma_format_string;
			_mediainfo.sarNum = metadata.sarRatio.width;
			_mediainfo.sarDen = metadata.sarRatio.height;
			_mediainfo.videoCodec = metadata.codec;
			
			_mediainfo.mimeType = 'video/mp4; codecs="' + _mediainfo.videoCodec
					+ (_mediainfo.hasAudio && _mediainfo.audioCodec ? ',' + _mediainfo.audioCodec : '') + '"';
			
			//if (_mediainfo.isComplete()) {
				_this.dispatchEvent(events.PLAYEASE_MEDIA_INFO, { info: _mediainfo });
			//}
		}
		
		function _parseAVCVideoData(arrayBuffer, dataOffset, dataSize, timestamp, frameType, cts) {
			var v = new DataView(arrayBuffer, dataOffset, dataSize);
			
			var units = [];
			var dts = _timestampBase + timestamp;
			var keyframe = frameType == FRAMES.KEYFRAME;
			
			var pos = 0, length = 0;
			while (pos < dataSize) {
				if (pos + 4 >= dataSize) {
					_this.dispatchEvent(events.ERROR, { message: 'Data not enough for next NALU.' });
					return;
				}
				
				var nalusize = v.getUint32(pos);
				if (nalusize == 3) {
					nalusize >>>= 8;
				}
				
				if (nalusize > dataSize - _lengthSizeMinusOne) {
					utils.log('Malformed Nalus near timestamp ' + dts + '.');
					return;
				}
				
				var unitType = v.getUint8(pos + _lengthSizeMinusOne) & 0x1F;
				if (unitType == FRAMES.INFO_OR_COMMAND_FRAME) {
					keyframe = true;
				}
				
				var data = new Uint8Array(arrayBuffer, dataOffset + pos, _lengthSizeMinusOne + nalusize);
				length += data.byteLength;
				
				var unit = { type: unitType, data: data };
				units.push(unit);
				
				pos += _lengthSizeMinusOne + nalusize;
			}
			
			if (units.length == 0) {
				return;
			}
			
			var avcsample = {
				units: units,
				length: length,
				isKeyframe: keyframe,
				cts: cts,
				dts: dts,
				pts: cts + dts
			};
			if (keyframe) {
				//avcsample.fileposition = 
			}
			
			_videoTrack.samples.push(avcsample);
			_videoTrack.length += length;
			
			_this.dispatchEvent(events.PLAYEASE_AVC_SAMPLE, { data: _videoTrack });
		}
		
		
		_this.parseAACAudioPacket = function(arrayBuffer, dataOffset, dataSize, timestamp, rate, samplesize, sampletype) {
			if (dataSize < 2) {
				_this.dispatchEvent(events.ERROR, { message: 'Data not enough while parsing AAC audio packet.' });
				return;
			}
			
			var v = new DataView(arrayBuffer, dataOffset, dataSize);
			
			var pos = 1; // skip format & rate & samplesize & sampletype
			var type = v.getUint8(pos++);
			
			switch (type) {
				case AAC.types.SPECIFIC_CONFIG:
					_parseAACAudioSpecificConfig(arrayBuffer, dataOffset + pos, dataSize - pos, rate, sampletype);
					break;
				case AAC.types.RAW_FRAME_DATA:
					_parseAACAudioData(arrayBuffer, dataOffset + pos, dataSize - pos, timestamp);
					break;
				default:
					_this.dispatchEvent(events.ERROR, { message: 'Unknown AAC audio packet type ' + type + '.' });
			}
		};
		
		function _parseAACAudioSpecificConfig(arrayBuffer, dataOffset, dataSize, rate, sampletype) {
			if (dataSize < 2) {
				_this.dispatchEvent(events.ERROR, { message: 'Data not enough while parsing AAC audio specific config.' });
				return;
			}
			
			var v = new DataView(arrayBuffer, dataOffset, dataSize);
			var pos = 0;
			
			var audioObjectType = v.getUint8(pos) >>> 3;                                 // 5 bits
			var samplingIndex = (v.getUint8(pos++) & 0x07) << 1 | v.getUint8(pos) >>> 7; // 4 bits
			if (samplingIndex < 0 || samplingIndex >= AAC.samplingRates.length) {
				_this.dispatchEvent(events.ERROR, { message: 'Invalid AAC sampling frequency index.', index: samplingIndex });
				return;
			}
			
			var track = _audioTrack;
			var audiometa = {
				type: track.type,
				id: track.id,
				timescale: 1000,
				duration: _metadata.duration * 1000 || 0
			};
			
			audiometa.audioSampleRate = AAC.samplingRates[samplingIndex];
			audiometa.refSampleDuration = Math.floor(1024 / audiometa.audioSampleRate * audiometa.timescale);
			
			var channelConfig = (v.getUint8(pos) & 0x78) >>> 3; // 4 bits
			if (channelConfig < 0 || channelConfig >= 8) {
				_this.dispatchEvent(events.ERROR, { message: 'Invalid AAC channel configuration.', config: channelConfig });
				return;
			}
			
			var extensionSamplingIndex, audioExtensionObjectType;
			if (audioObjectType === AAC.audioObjectTypes.AAC_HE_OR_SBR) {
				if (dataSize < 3) {
					_this.dispatchEvent(events.ERROR, { message: 'Data not enough while parsing AAC_HE_OR_SBR audio specific config.' });
					return;
				}
				
				extensionSamplingIndex = (v.getUint8(pos++) & 0x07) << 1 | v.getUint8(pos) >>> 7; // 4 bits
				audioExtensionObjectType = (v.getUint8(pos) & 0x7C) >>> 2;                        // 5 bits
			}
			
			var config;
			var userAgent = self.navigator.userAgent.toLowerCase();
			if (userAgent.indexOf('firefox') !== -1) {        // firefox: use SBR (HE-AAC) if freq less than 24kHz
				if (samplingIndex >= AAC.audioObjectTypes.AAC_SCALABLE) {
					audioObjectType = AAC.audioObjectTypes.AAC_HE_OR_SBR;
					extensionSamplingIndex = samplingIndex - 3;
					config = new Array(4);
				} else { // use LC-AAC
					audioObjectType = AAC.audioObjectTypes.AAC_LC;
					extensionSamplingIndex = samplingIndex;
					config = new Array(2);
				}
			} else if (userAgent.indexOf('android') !== -1) { // android: always use LC-AAC
				audioObjectType = AAC.audioObjectTypes.AAC_LC;
				extensionSamplingIndex = samplingIndex;
				config = new Array(2);
			} else {                                          // for other browsers,  use HE-AAC to make it easier to switch aac codec profile
				audioObjectType = AAC.audioObjectTypes.AAC_HE_OR_SBR;
				extensionSamplingIndex = samplingIndex;
				config = new Array(4);
				
				if (samplingIndex >= AAC.audioObjectTypes.AAC_SCALABLE) {
					extensionSamplingIndex = samplingIndex - 3;
				} else if (channelConfig === 1) { // Mono channel
					audioObjectType = AAC.audioObjectTypes.AAC_LC;
					extensionSamplingIndex = samplingIndex;
					config = new Array(2);
				}
			}
			
			config[0] = audioObjectType << 3;
			config[0] |= (samplingIndex & 0x0F) >>> 1;
			config[1] = (samplingIndex & 0x0F) << 7;
			config[1] |= (channelConfig & 0x0F) << 3;
			
			if (audioObjectType === AAC.audioObjectTypes.AAC_HE_OR_SBR) {
				config[1] |= (extensionSamplingIndex & 0x0F) >>> 1;
				config[2] = (extensionSamplingIndex & 0x01) << 7;
				// extended audio object type: force to 2 (LC-AAC)
				config[2] |= 2 << 2;
				config[3] = 0;
			}
			
			audiometa.channelCount = channelConfig;
			audiometa.codec = 'mp4a.40.' + audioObjectType;
			audiometa.config = config;
			
			_copyAudioInfo(audiometa);
			
			_this.dispatchEvent(events.PLAYEASE_AAC_SPECIFIC_CONFIG, { data: audiometa });
		}
		
		function _copyAudioInfo(audiometa) {
			_mediainfo.audioCodec = audiometa.codec;
			_mediainfo.audioSampleRate = audiometa.audioSampleRate;
			_mediainfo.audioChannelCount = audiometa.channelCount;
			
			_mediainfo.mimeType = 'video/mp4; codecs="' + _mediainfo.videoCodec
					+ (_mediainfo.hasAudio && _mediainfo.audioCodec ? ',' + _mediainfo.audioCodec : '') + '"';
			
			//if (_mediainfo.isComplete()) {
				_this.dispatchEvent(events.PLAYEASE_MEDIA_INFO, { info: _mediainfo });
			//}
		}
		
		function _parseAACAudioData(arrayBuffer, dataOffset, dataSize, timestamp) {
			var unit = new Uint8Array(arrayBuffer, dataOffset, dataSize);
			var dts = _timestampBase + timestamp;
			
			var aacsample = {
				unit: unit,
				dts: dts,
				pts: dts
			};
			
			_audioTrack.samples.push(aacsample);
			_audioTrack.length += unit.length;
			
			_this.dispatchEvent(events.PLAYEASE_AAC_SAMPLE, { data: _audioTrack });
		}
		
		
		_this.probe = function(buffer) {
			var data = new Uint8Array(buffer);
			if (data[0] !== 0x46 || data[1] !== 0x4C || data[2] !== 0x56 || data[3] !== 0x01) {
				return 0;
			}
			
			_hasAudio = (data[4] & 4) >>> 2 !== 0;
			_hasVideo = (data[4] & 1) !== 0;
			if (!_hasAudio && !_hasVideo) {
				return 0;
			}
			
			var offset = utils.getUint32(data, 5);
			if (offset < 9) {
				return 0;
			}
			
			return offset;
		};
		
		_this.setMetaData = function(metadata) {
			_metadata = metadata;
			
			if (typeof _metadata.audiodatarate === 'number') {
				_mediainfo.audioDataRate = _metadata.audiodatarate;
			}
			if (typeof _metadata.videodatarate === 'number') {
				_mediainfo.videoDataRate = _metadata.videodatarate;
			}
			if (typeof _metadata.framerate === 'number') {
				var fps_num = Math.floor(_metadata.framerate * 1000);
				if (fps_num > 0) {
					var fps = fps_num / 1000;
					
					_referenceFrameRate.fixed = true;
					_referenceFrameRate.fps = fps;
					_referenceFrameRate.fps_num = fps_num;
					_referenceFrameRate.fps_den = 1000;
					_mediainfo.fps = fps;
				}
			}
			if (typeof _metadata.keyframes === 'object') {
				_mediainfo.hasKeyframesIndex = true;
			} else {
				_mediainfo.hasKeyframesIndex = false;
			}
		};
		
		_this.getMetaData = function() {
			return _metadata;
		};
		
		_this.offset = function() {
			return _offset;
		};
		
		_this.length = function() {
			return _length;
		};
		
		_this.destroy = function() {
			
		};
		
		_init();
	};
	
	muxer.flv.TAG = TAG;
	muxer.flv.FORMATS = FORMATS;
	muxer.flv.FRAMES = FRAMES;
	muxer.flv.CODECS = CODECS;
	muxer.flv.AVC = AVC;
	muxer.flv.AAC = AAC;
})(playease);

(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		muxer = playease.muxer,
		
		FRAMES = muxer.flv.FRAMES,
		AAC = muxer.flv.AAC;
	
	var datas = {};
	
	datas.FTYP = new Uint8Array([
		0x69, 0x73, 0x6F, 0x6D, // major_brand: isom
		0x0,  0x0,  0x0,  0x1,  // minor_version: 0x01
		0x69, 0x73, 0x6F, 0x6D, // isom
		0x61, 0x76, 0x63, 0x31  // avc1
	]);
	
	datas.STSD_PREFIX = new Uint8Array([
		0x00, 0x00, 0x00, 0x00, // version(0) + flags
		0x00, 0x00, 0x00, 0x01  // entry_count
	]);
	
	datas.STTS = new Uint8Array([
		0x00, 0x00, 0x00, 0x00, // version(0) + flags
		0x00, 0x00, 0x00, 0x00  // entry_count
	]);
	
	datas.STSC = datas.STCO = datas.STTS;
	
	datas.STSZ = new Uint8Array([
		0x00, 0x00, 0x00, 0x00, // version(0) + flags
		0x00, 0x00, 0x00, 0x00, // sample_size
		0x00, 0x00, 0x00, 0x00  // sample_count
	]);
	
	datas.HDLR_VIDEO = new Uint8Array([
		0x00, 0x00, 0x00, 0x00, // version(0) + flags
		0x00, 0x00, 0x00, 0x00, // pre_defined
		0x76, 0x69, 0x64, 0x65, // handler_type: 'vide'
		0x00, 0x00, 0x00, 0x00, // reserved: 3 * 4 bytes
		0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00,
		0x56, 0x69, 0x64, 0x65,
		0x6F, 0x48, 0x61, 0x6E,
		0x64, 0x6C, 0x65, 0x72, 0x00 // name: VideoHandler
	]);
	
	datas.HDLR_AUDIO = new Uint8Array([
		0x00, 0x00, 0x00, 0x00, // version(0) + flags
		0x00, 0x00, 0x00, 0x00, // pre_defined
		0x73, 0x6F, 0x75, 0x6E, // handler_type: 'soun'
		0x00, 0x00, 0x00, 0x00, // reserved: 3 * 4 bytes
		0x00, 0x00, 0x00, 0x00,
		0x00, 0x00, 0x00, 0x00,
		0x53, 0x6F, 0x75, 0x6E,
		0x64, 0x48, 0x61, 0x6E,
		0x64, 0x6C, 0x65, 0x72, 0x00 // name: SoundHandler
	]);
	
	datas.DREF = new Uint8Array([
		0x00, 0x00, 0x00, 0x00, // version(0) + flags
		0x00, 0x00, 0x00, 0x01, // entry_count
		0x00, 0x00, 0x00, 0x0C, // entry_size
		0x75, 0x72, 0x6C, 0x20, // type 'url '
		0x00, 0x00, 0x00, 0x01  // version(0) + flags
	]);
	
	// Sound media header
	datas.SMHD = new Uint8Array([
		0x00, 0x00, 0x00, 0x00, // version(0) + flags
		0x00, 0x00, 0x00, 0x00  // balance(2) + reserved(2)
	]);
	
	// video media header
	datas.VMHD = new Uint8Array([
		0x00, 0x00, 0x00, 0x01, // version(0) + flags
		0x00, 0x00,             // graphicsmode: 2 bytes
		0x00, 0x00, 0x00, 0x00, // opcolor: 3 * 2 bytes
		0x00, 0x00
	]);
	
	AAC.getSilentFrame = function(channelCount) {
		if (channelCount === 1) {
			return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x23, 0x80]);
		} else if (channelCount === 2) {
			return new Uint8Array([0x21, 0x00, 0x49, 0x90, 0x02, 0x19, 0x00, 0x23, 0x80]);
		} else if (channelCount === 3) {
			return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x8e]);
		} else if (channelCount === 4) {
			return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x80, 0x2c, 0x80, 0x08, 0x02, 0x38]);
		} else if (channelCount === 5) {
			return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x38]);
		} else if (channelCount === 6) {
			return new Uint8Array([0x00, 0xc8, 0x00, 0x80, 0x20, 0x84, 0x01, 0x26, 0x40, 0x08, 0x64, 0x00, 0x82, 0x30, 0x04, 0x99, 0x00, 0x21, 0x90, 0x02, 0x00, 0xb2, 0x00, 0x20, 0x08, 0xe0]);
		}
		
		return null;
	};
	
	
	var sampleinfo = function(dts, pts, duration, originalDts, isSync) {
		var _this = this;
		
		function _init() {
			_this.dts = dts;
			_this.pts = pts;
			_this.duration = duration;
			_this.originalDts = originalDts;
			_this.isSyncPoint = isSync;
			_this.fileposition = null;
		}
		
		_init();
	};
	
	var segmentinfo = function() {
		var _this = this,
			_beginDts = 0,
			_endDts = 0,
			_beginPts = 0,
			_endPts = 0,
			_originalBeginDts = 0,
			_originalEndDts = 0,
			_syncPoints = [],    // SampleInfo[n], for video IDR frames only
			_firstSample = null, // SampleInfo
			_lastSample = null;  // SampleInfo
		
		function _init() {
			
		}
		
		_this.appendSyncPoint = function(sampleinfo) {
			sampleinfo.isSyncPoint = true;
			_syncPoints.push(sampleinfo);
		};
		
		_init();
	};
	
	var segmentinfolist = function(type) {
		var _this = this,
			_type = type,
			_list,
			_lastAppendLocation;
		
		function _init() {
			_list = [];
			_lastAppendLocation = -1;
		}
		
		_this.reset = _init;
		
		_this.searchNearestSegmentBefore = function(originalBeginDts) {
			if (_list.length === 0) {
				return -2;
			}
			
			var lastindex = _list.length - 1;
			var midindex = 0;
			var lbound = 0;
			var ubound = lastindex;
			
			var index = 0;
			if (originalBeginDts < _list[0].originalBeginDts) {
				index = -1;
				return index;
			}
			
			while (lbound <= ubound) {
				midindex = lbound + Math.floor((ubound - lbound) / 2);
				if (midindex === lastindex || originalBeginDts > _list[midindex].lastSample.originalDts && originalBeginDts < _list[midindex + 1].originalBeginDts) {
					index = midindex;
					break;
				}
				
				if (_list[midindex].originalBeginDts < originalBeginDts) {
					lbound = midindex + 1;
				} else {
					ubound = midindex - 1;
				}
			}
			
			return index;
		};
		
		_this.searchNearestSegmentAfter = function(originalBeginDts) {
			return _this.searchNearestSegmentBefore(originalBeginDts) + 1;
		};
		
		_this.append = function(seginfo) {
			var lastindex = _lastAppendLocation;
			var insertindex = 0;
			
			if (lastindex !== -1 && lastindex < _list.length
					&& seginfo.originalBeginDts >= _list[lastindex].lastSample.originalDts
					&& (lastindex === _list.length - 1 || lastindex < _list.length - 1
					&& seginfo.originalBeginDts < _list[lastindex + 1].originalBeginDts)) {
				insertindex = lastindex + 1; // use cached location idx
			} else {
				if (_list.length > 0) {
					insertindex = _this.searchNearestSegmentBefore(seginfo.originalBeginDts) + 1;
				}
			}
			
			_lastAppendLocation = insertindex;
			_list.splice(insertindex, 0, seginfo);
		};
		
		_this.getLastSegmentBefore = function(originalBeginDts) {
			var index = _this.searchNearestSegmentBefore(originalBeginDts);
			if (index < 0) {
				return null;
			}
			
			return _list[index];
		};
		
		_this.getLastSampleBefore = function(originalBeginDts) {
			var segment = _this.getLastSegmentBefore(originalBeginDts);
			if (segment == null) {
				return null;
			}
			
			return segment.lastSample;
		};
		
		_this.getLastSyncPointBefore = function(originalBeginDts) {
			var segindex = _this.searchNearestSegmentBefore(originalBeginDts);
			var syncPoints = _list[segindex].syncPoints;
			
			while (syncPoints.length === 0 && segindex--) {
				syncPoints = _list[segindex].syncPoints;
			}
			
			if (syncPoints.length <= 0) {
				return null;
			}
			
			return syncPoints[syncPoints.length - 1];
		};
		
		_this.isEmpty = function() {
			return _list.length === 0;
		};
		
		_this.clear = function() {
			_list = [];
			_lastAppendLocation = -1;
		};
		
		_init();
	};
	
	
	muxer.mp4 = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('muxer.mp4')),
			_defaults = {
				islive: false
			},
			_dtsBase,
			_videoNextDts,
			_audioNextDts,
			_videoMeta,
			_audioMeta,
			_videoseginfolist,
			_audioseginfolist,
			_fillSilentAfterSeek,
			
			_types = {
				avc1: [], avcC: [], btrt: [], dinf: [],
				dref: [], esds: [], ftyp: [], hdlr: [],
				mdat: [], mdhd: [], mdia: [], mfhd: [],
				minf: [], moof: [], moov: [], mp4a: [],
				mvex: [], mvhd: [], sdtp: [], stbl: [],
				stco: [], stsc: [], stsd: [], stsz: [],
				stts: [], tfdt: [], tfhd: [], traf: [],
				trak: [], trun: [], trex: [], tkhd: [],
				vmhd: [], smhd: []
			};
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			for (var name in _types) {
				_types[name] = [
					name.charCodeAt(0),
					name.charCodeAt(1),
					name.charCodeAt(2),
					name.charCodeAt(3)
				];
			}
			
			_dtsBase = 0;
			
			_videoseginfolist = new segmentinfolist('video');
			_audioseginfolist = new segmentinfolist('audio');
			
			_fillSilentAfterSeek = false;
		}
		
		_this.reset = function() {
			_dtsBase = 0;
			
			_videoNextDts = undefined;
			_audioNextDts = undefined;
			
			_videoseginfolist.reset();
			_audioseginfolist.reset();
			
			_fillSilentAfterSeek = false;
		};
		
		_this.getInitSegment = function(meta) {
			var ftyp = _this.box(_types.ftyp, datas.FTYP);
			var moov = _this.moov(meta);
			
			var seg = new Uint8Array(ftyp.byteLength + moov.byteLength);
			seg.set(ftyp, 0);
			seg.set(moov, ftyp.byteLength);
			
			_this.dispatchEvent(events.PLAYEASE_MP4_INIT_SEGMENT, { tp: meta.type, data: seg });
		};
		
		_this.getVideoSegment = function(track) {
			var samples = track.samples;
			var dtsCorrection = undefined;
			var firstDts = -1, lastDts = -1;
			var firstPts = -1, lastPts = -1;
			
			if (!samples || samples.length === 0) {
				return;
			}
			
			var pos = 0;
			
			var bytes = 8 + track.length;
			var mdatbox = new Uint8Array(bytes);
			mdatbox[pos++] = bytes >>> 24 & 0xFF;
			mdatbox[pos++] = bytes >>> 16 & 0xFF;
			mdatbox[pos++] = bytes >>>  8 & 0xFF;
			mdatbox[pos++] = bytes & 0xFF;
			
			mdatbox.set(_types.mdat, pos);
			pos += 4;
			
			var mp4Samples = [];
			var seginfo = new segmentinfo();
			
			while (samples.length) {
				var avcSample = samples.shift();
				var keyframe = avcSample.isKeyframe;
				var originalDts = avcSample.dts - _dtsBase;
				
				if (dtsCorrection == undefined) {
					if (_videoNextDts == undefined) {
						if (_videoseginfolist.isEmpty()) {
							dtsCorrection = 0;
						} else {
							var lastSample = _videoseginfolist.getLastSampleBefore(originalDts);
							if (lastSample != null) {
								var distance = originalDts - (lastSample.originalDts + lastSample.duration);
								if (distance <= 3) {
									distance = 0;
								}
								
								var expectedDts = lastSample.dts + lastSample.duration + distance;
								dtsCorrection = originalDts - expectedDts;
							} else {
								// lastSample == null
								dtsCorrection = 0;
							}
						}
					} else {
						dtsCorrection = originalDts - _videoNextDts;
					}
				}
				
				var dts = originalDts - dtsCorrection;
				var cts = avcSample.cts;
				var pts = dts + cts;
				
				if (firstDts === -1) {
					firstDts = dts;
					firstPts = pts;
				}
				
				// fill mdat box
				var sampleSize = 0;
				while (avcSample.units.length) {
					var unit = avcSample.units.shift();
					var data = unit.data;
					mdatbox.set(data, pos);
					pos += data.byteLength;
					sampleSize += data.byteLength;
				}
				
				var sampleDuration = 0;
				if (samples.length >= 1) {
					var nextDts = samples[0].dts - _dtsBase - dtsCorrection;
					sampleDuration = nextDts - dts;
				} else {
					if (mp4Samples.length >= 1) {
						sampleDuration = mp4Samples[mp4Samples.length - 1].duration;
					} else {
						sampleDuration = _videoMeta.refSampleDuration + dtsCorrection;
					}
				}
				
				if (keyframe) {
					var syncPoint = new sampleinfo(dts, pts, sampleDuration, avcSample.dts, true);
					syncPoint.fileposition = avcSample.fileposition;
					seginfo.appendSyncPoint(syncPoint);
				}
				
				var mp4Sample = {
					dts: dts,
					pts: pts,
					cts: cts,
					size: sampleSize,
					isKeyframe: keyframe,
					duration: sampleDuration,
					originalDts: originalDts,
					flags: {
						isLeading: 0,
						dependsOn: keyframe ? 2 : 1,
						isDependedOn: keyframe ? 1 : 0,
						hasRedundancy: 0,
						isNonSync: keyframe ? 0 : 1
					}
				};
				
				mp4Samples.push(mp4Sample);
			}
			
			var latest = mp4Samples[mp4Samples.length - 1];
			lastDts = latest.dts + latest.duration;
			lastPts = latest.pts + latest.duration;
			_videoNextDts = lastDts;
			
			// fill media segment info & add into info list
			seginfo.beginDts = firstDts;
			seginfo.endDts = lastDts;
			seginfo.beginPts = firstPts;
			seginfo.endPts = lastPts;
			seginfo.originalBeginDts = mp4Samples[0].originalDts;
			seginfo.originalEndDts = latest.originalDts + latest.duration;
			seginfo.firstSample = new sampleinfo(mp4Samples[0].dts, mp4Samples[0].pts, mp4Samples[0].duration, mp4Samples[0].originalDts, mp4Samples[0].isKeyframe);
			seginfo.lastSample = new sampleinfo(latest.dts, latest.pts, latest.duration, latest.originalDts, latest.isKeyframe);
			if (!_this.config.islive) {
				_videoseginfolist.append(seginfo);
			}
			
			track.samples = mp4Samples;
			track.sequenceNumber++;
			
			// workaround for chrome < 50: force first sample as a random access point
			// see https://bugs.chromium.org/p/chromium/issues/detail?id=229412
			/*if (_forceFirstIDR) {
				var flags = mp4Samples[0].flags;
				flags.dependsOn = 2;
				flags.isNonSync = 0;
			}*/
			
			var moofbox = _this.moof(track, firstDts);
			track.samples = [];
			track.length = 0;
			
			_this.dispatchEvent(events.PLAYEASE_MP4_SEGMENT, {
				tp: 'video',
				data: _mergeBoxes(moofbox, mdatbox),
				sampleCount: mp4Samples.length,
				info: seginfo
			});
		};
		
		_this.getAudioSegment = function(track) {
			var samples = track.samples;
			var dtsCorrection = undefined;
			var firstDts = -1, lastDts = -1;
			
			var remuxSilentFrame = false;
			var silentFrameDuration = -1;
			
			if (!samples || samples.length === 0) {
				return;
			}
			
			var pos = 0;
			
			var bytes = 8 + track.length;
			var mdatbox = new Uint8Array(bytes);
			mdatbox[pos++] = bytes >>> 24 & 0xFF;
			mdatbox[pos++] = bytes >>> 16 & 0xFF;
			mdatbox[pos++] = bytes >>>  8 & 0xFF;
			mdatbox[pos++] = bytes & 0xFF;
			
			mdatbox.set(_types.mdat, pos);
			pos += 4;
			
			var mp4Samples = [];
			
			while (samples.length) {
				var aacSample = samples.shift();
				var unit = aacSample.unit;
				var originalDts = aacSample.dts - _dtsBase;
				
				if (dtsCorrection == undefined) {
					if (_audioNextDts == undefined) {
						if (_audioseginfolist.isEmpty()) {
							dtsCorrection = 0;
							if (_fillSilentAfterSeek && !_videoseginfolist.isEmpty()) {
								remuxSilentFrame = true;
							}
						} else {
							var lastSample = _audioseginfolist.getLastSampleBefore(originalDts);
							if (lastSample != null) {
								var distance = originalDts - (lastSample.originalDts + lastSample.duration);
								if (distance <= 3) {
									distance = 0;
								}
								var expectedDts = lastSample.dts + lastSample.duration + distance;
								dtsCorrection = originalDts - expectedDts;
							} else {
								// lastSample == null
								dtsCorrection = 0;
							}
						}
					} else {
						dtsCorrection = originalDts - _audioNextDts;
					}
				}
				
				var dts = originalDts - dtsCorrection;
				if (remuxSilentFrame) {
					// align audio segment beginDts to match with current video segment's beginDts
					var videoSegment = _videoseginfolist.getLastSegmentBefore(originalDts);
					if (videoSegment != null && videoSegment.beginDts < dts) {
						silentFrameDuration = dts - videoSegment.beginDts;
						dts = videoSegment.beginDts;
					} else {
						remuxSilentFrame = false;
					}
				}
				if (firstDts === -1) {
					firstDts = dts;
				}
				
				if (remuxSilentFrame) {
					remuxSilentFrame = false;
					samples.unshift(aacSample);
					
					var frame = _generateSilentAudio(dts, silentFrameDuration);
					if (frame == null) {
						continue;
					}
					var mp4Spl = frame.mp4Sample;
					var unt = frame.unit;
					mp4Samples.push(mp4Spl);
					
					// re-allocate mdatbox buffer with new size, to fit with this silent frame
					pos = 0;
					
					bytes += unt.byteLength;
					mdatbox = new Uint8Array(bytes);
					mdatbox[pos++] = bytes >>> 24 & 0xFF;
					mdatbox[pos++] = bytes >>> 16 & 0xFF;
					mdatbox[pos++] = bytes >>>  8 & 0xFF;
					mdatbox[pos++] = bytes & 0xFF;
					
					mdatbox.set(_types.mdat, pos);
					pos += 4;
					
					mdatbox.set(unt, pos);
					pos += unt.byteLength;
					
					continue;
				}
				
				var sampleDuration = 0;
				
				if (samples.length >= 1) {
					var nextDts = samples[0].dts - _dtsBase - dtsCorrection;
					sampleDuration = nextDts - dts;
				} else {
					if (mp4Samples.length >= 1) {
						sampleDuration = mp4Samples[mp4Samples.length - 1].duration;
					} else {
						sampleDuration = _audioMeta.refSampleDuration + dtsCorrection;
					}
				}
				
				var mp4Sample = {
					dts: dts,
					pts: dts,
					cts: 0,
					size: unit.byteLength,
					duration: sampleDuration,
					originalDts: originalDts,
					flags: {
						isLeading: 0,
						dependsOn: 1,
						isDependedOn: 0,
						hasRedundancy: 0
					}
				};
				
				mp4Samples.push(mp4Sample);
				mdatbox.set(unit, pos);
				pos += unit.byteLength;
			}
			
			var latest = mp4Samples[mp4Samples.length - 1];
			lastDts = latest.dts + latest.duration;
			_audioNextDts = lastDts;
			
			// fill media segment info & add to info list
			var seginfo = new segmentinfo();
			seginfo.beginDts = firstDts;
			seginfo.endDts = lastDts;
			seginfo.beginPts = firstDts;
			seginfo.endPts = lastDts;
			seginfo.originalBeginDts = mp4Samples[0].originalDts;
			seginfo.originalEndDts = latest.originalDts + latest.duration;
			seginfo.firstSample = new sampleinfo(mp4Samples[0].dts, mp4Samples[0].pts, mp4Samples[0].duration, mp4Samples[0].originalDts, false);
			seginfo.lastSample = new sampleinfo(latest.dts, latest.pts, latest.duration, latest.originalDts, false);
			if (!_this.config.islive) {
				_audioseginfolist.append(seginfo);
			}
			
			track.samples = mp4Samples;
			track.sequenceNumber++;
			
			var moofbox = _this.moof(track, firstDts);
			track.samples = [];
			track.length = 0;
			
			_this.dispatchEvent(events.PLAYEASE_MP4_SEGMENT, {
				tp: 'audio',
				data: _mergeBoxes(moofbox, mdatbox),
				sampleCount: mp4Samples.length,
				info: seginfo
			});
		};
		
		function _generateSilentAudio(dts, frameDuration) {
			var unit = AAC.getSilentFrame(_audioMeta.channelCount);
			if (unit == null) {
				utils.log('Cannot generate silent aac frame, channelCount: ' + _audioMeta.channelCount + '.');
				return null;
			}
			
			var mp4Sample = {
				dts: dts,
				pts: dts,
				cts: 0,
				size: unit.byteLength,
				duration: frameDuration,
				originalDts: dts,
				flags: {
					isLeading: 0,
					dependsOn: 1,
					isDependedOn: 0,
					hasRedundancy: 0
				}
			};
			
			return {
				unit: unit,
				mp4Sample: mp4Sample
			};
		}
		
		_mergeBoxes = function(moof, mdat) {
			var res = new Uint8Array(moof.byteLength + mdat.byteLength);
			res.set(moof, 0);
			res.set(mdat, moof.byteLength);
			
			return res;
		};
		
		_this.setVideoMeta = function(meta) {
			_videoMeta = meta;
		};
		
		_this.setAudioMeta = function(meta) {
			_audioMeta = meta;
		};
		
		
		_this.box = function(type) {
			var size = 8;
			var arrs = Array.prototype.slice.call(arguments, 1);
			for (var i = 0; i < arrs.length; i++) {
				size += arrs[i].byteLength;
			}
			
			var data = new Uint8Array(size);
			var pos = 0;
			
			// set size
			data[pos++] = size >>> 24 & 0xFF;
			data[pos++] = size >>> 16 & 0xFF;
			data[pos++] = size >>>  8 & 0xFF;
			data[pos++] = size & 0xFF;
			
			// set type
			data.set(type, pos);
			pos += 4;
			
			// set data
			for (var i = 0; i < arrs.length; i++) {
				data.set(arrs[i], pos);
				pos += arrs[i].byteLength;
			}
			
			return data;
		};
		
		// Movie metadata box
		_this.moov = function(meta) {
			var mvhd = _this.mvhd(meta.timescale, meta.duration);
			var trak = _this.trak(meta);
			var mvex = _this.mvex(meta);
			
			return _this.box(_types.moov, mvhd, trak, mvex);
		}
		
		// Movie header box
		_this.mvhd = function(timescale, duration) {
			return _this.box(_types.mvhd, new Uint8Array([
				0x00, 0x00, 0x00, 0x00,    // version(0) + flags
				0x00, 0x00, 0x00, 0x00,    // creation_time
				0x00, 0x00, 0x00, 0x00,    // modification_time
				(timescale >>> 24) & 0xFF, // timescale: 4 bytes
				(timescale >>> 16) & 0xFF,
				(timescale >>>  8) & 0xFF,
				(timescale) & 0xFF,
				(duration >>> 24) & 0xFF,  // duration: 4 bytes
				(duration >>> 16) & 0xFF,
				(duration >>>  8) & 0xFF,
				(duration) & 0xFF,
				0x00, 0x01, 0x00, 0x00,    // Preferred rate: 1.0
				0x01, 0x00, 0x00, 0x00,    // PreferredVolume(1.0, 2bytes) + reserved(2bytes)
				0x00, 0x00, 0x00, 0x00,    // reserved: 4 + 4 bytes
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x01, 0x00, 0x00,    // ----begin composition matrix----
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x01, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x40, 0x00, 0x00, 0x00,    // ----end composition matrix----
				0x00, 0x00, 0x00, 0x00,    // ----begin pre_defined 6 * 4 bytes----
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,    // ----end pre_defined 6 * 4 bytes----
				0xFF, 0xFF, 0xFF, 0xFF     // next_track_ID
			]));
		};
		
		// Track box
		_this.trak = function(meta) {
			return _this.box(_types.trak, _this.tkhd(meta), _this.mdia(meta));
		};
		
		// Track header box
		_this.tkhd = function(meta) {
			var trackId = meta.id;
			var duration = meta.duration;
			var width = meta.presentWidth;
			var height = meta.presentHeight;
			
			return _this.box(_types.tkhd, new Uint8Array([
				0x00, 0x00, 0x00, 0x07,   // version(0) + flags
				0x00, 0x00, 0x00, 0x00,   // creation_time
				0x00, 0x00, 0x00, 0x00,   // modification_time
				(trackId >>> 24) & 0xFF,  // track_ID: 4 bytes
				(trackId >>> 16) & 0xFF,
				(trackId >>>  8) & 0xFF,
				(trackId) & 0xFF,
				0x00, 0x00, 0x00, 0x00,   // reserved: 4 bytes
				(duration >>> 24) & 0xFF, // duration: 4 bytes
				(duration >>> 16) & 0xFF,
				(duration >>>  8) & 0xFF,
				(duration) & 0xFF,
				0x00, 0x00, 0x00, 0x00,   // reserved: 2 * 4 bytes
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,   // layer(2bytes) + alternate_group(2bytes)
				0x00, 0x00, 0x00, 0x00,   // volume(2bytes) + reserved(2bytes)
				0x00, 0x01, 0x00, 0x00,   // ----begin composition matrix----
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x01, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x40, 0x00, 0x00, 0x00,   // ----end composition matrix----
				(width >>> 8) & 0xFF,     // width and height
				(width) & 0xFF,
				0x00, 0x00,
				(height >>> 8) & 0xFF,
				(height) & 0xFF,
				0x00, 0x00
			]));
		};
		
		// Media Box
		_this.mdia = function(meta) {
			return _this.box(_types.mdia, _this.mdhd(meta), _this.hdlr(meta), _this.minf(meta));
		};
		
		// Media header box
		_this.mdhd = function(meta) {
			var timescale = meta.timescale;
			var duration = meta.duration;
			
			return _this.box(_types.mdhd, new Uint8Array([
				0x00, 0x00, 0x00, 0x00,    // version(0) + flags
				0x00, 0x00, 0x00, 0x00,    // creation_time
				0x00, 0x00, 0x00, 0x00,    // modification_time
				(timescale >>> 24) & 0xFF, // timescale: 4 bytes
				(timescale >>> 16) & 0xFF,
				(timescale >>>  8) & 0xFF,
				(timescale) & 0xFF,
				(duration >>> 24) & 0xFF,  // duration: 4 bytes
				(duration >>> 16) & 0xFF,
				(duration >>>  8) & 0xFF,
				(duration) & 0xFF,
				0x55, 0xC4,                // language: und (undetermined)
				0x00, 0x00                 // pre_defined = 0
			]));
		};
		
		// Media handler reference box
		_this.hdlr = function(meta) {
			var data = null;
			
			if (meta.type === 'audio') {
				data = datas.HDLR_AUDIO;
			} else {
				data = datas.HDLR_VIDEO;
			}
			
			return _this.box(_types.hdlr, data);
		};
		
		// Media infomation box
		_this.minf = function(meta) {
			var xmhd = null;
			
			if (meta.type === 'audio') {
				xmhd = _this.box(_types.smhd, datas.SMHD);
			} else {
				xmhd = _this.box(_types.vmhd, datas.VMHD);
			}
			
			return _this.box(_types.minf, xmhd, _this.dinf(), _this.stbl(meta));
		};
		
		// Data infomation box
		_this.dinf = function() {
			return _this.box(_types.dinf, _this.box(_types.dref, datas.DREF));
		};
		
		// Sample table box
		_this.stbl = function(meta) {
			var result = _this.box(_types.stbl,   // type: stbl
				_this.stsd(meta),                   // Sample Description Table
				_this.box(_types.stts, datas.STTS), // Time-To-Sample
				_this.box(_types.stsc, datas.STSC), // Sample-To-Chunk
				_this.box(_types.stsz, datas.STSZ), // Sample size
				_this.box(_types.stco, datas.STCO)  // Chunk offset
			);
			
			return result;
		};
		
		// Sample description box
		_this.stsd = function(meta) {
			if (meta.type === 'audio') {
				return _this.box(_types.stsd, datas.STSD_PREFIX, _this.mp4a(meta));
			} else {
				return _this.box(_types.stsd, datas.STSD_PREFIX, _this.avc1(meta));
			}
		};
		
		_this.mp4a = function(meta) {
			var channelCount = meta.channelCount;
			var sampleRate = meta.audioSampleRate;
			
			var data = new Uint8Array([
				0x00, 0x00, 0x00, 0x00,    // reserved(4)
				0x00, 0x00, 0x00, 0x01,    // reserved(2) + data_reference_index(2)
				0x00, 0x00, 0x00, 0x00,    // reserved: 2 * 4 bytes
				0x00, 0x00, 0x00, 0x00,
				0x00, channelCount,        // channelCount(2)
				0x00, 0x10,                // sampleSize(2)
				0x00, 0x00, 0x00, 0x00,    // reserved(4)
				(sampleRate >>> 8) & 0xFF, // Audio sample rate
				(sampleRate) & 0xFF,
				0x00, 0x00
			]);
			
			return _this.box(_types.mp4a, data, _this.esds(meta));
		};
		
		_this.esds = function(meta) {
			var config = meta.config;
			var configSize = config.length;
			var data = new Uint8Array([
				0x00, 0x00, 0x00, 0x00, // version 0 + flags
				
				0x03,                   // descriptor_type
				0x17 + configSize,      // length3
				0x00, 0x01,             // es_id
				0x00,                   // stream_priority
				
				0x04,                   // descriptor_type
				0x0F + configSize,      // length
				0x40,                   // codec: mpeg4_audio
				0x15,                   // stream_type: Audio
				0x00, 0x00, 0x00,       // buffer_size
				0x00, 0x00, 0x00, 0x00, // maxBitrate
				0x00, 0x00, 0x00, 0x00, // avgBitrate
				
				0x05                    // descriptor_type
			].concat(
				[configSize]
			).concat(
				config
			).concat(
				[0x06, 0x01, 0x02]      // GASpecificConfig
			));
			
			return _this.box(_types.esds, data);
		};
		
		_this.avc1 = function(meta) {
			var avcc = meta.avcc;
			var width = meta.codecWidth;
			var height = meta.codecHeight;
			
			var data = new Uint8Array([
				0x00, 0x00, 0x00, 0x00, // reserved(4)
				0x00, 0x00, 0x00, 0x01, // reserved(2) + data_reference_index(2)
				0x00, 0x00, 0x00, 0x00, // pre_defined(2) + reserved(2)
				0x00, 0x00, 0x00, 0x00, // pre_defined: 3 * 4 bytes
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				(width >>> 8) & 0xFF,   // width: 2 bytes
				(width) & 0xFF,
				(height >>> 8) & 0xFF,  // height: 2 bytes
				(height) & 0xFF,
				0x00, 0x48, 0x00, 0x00, // horizresolution: 4 bytes
				0x00, 0x48, 0x00, 0x00, // vertresolution: 4 bytes
				0x00, 0x00, 0x00, 0x00, // reserved: 4 bytes
				0x00, 0x01,             // frame_count
				0x0A,                   // strlen
				0x78, 0x71, 0x71, 0x2F, // compressorname: 32 bytes
				0x66, 0x6C, 0x76, 0x2E,
				0x6A, 0x73, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00, 0x00,
				0x00, 0x00, 0x00,
				0x00, 0x18,             // depth
				0xFF, 0xFF              // pre_defined = -1
			]);
			
			return _this.box(_types.avc1, data, _this.box(_types.avcC, avcc));
		};
		
		// Movie Extends box
		_this.mvex = function(meta) {
			return _this.box(_types.mvex, _this.trex(meta));
		};
		
		// Track Extends box
		_this.trex = function(meta) {
			var trackId = meta.id;
			var data = new Uint8Array([
				0x00, 0x00, 0x00, 0x00,  // version(0) + flags
				(trackId >>> 24) & 0xFF, // track_ID
				(trackId >>> 16) & 0xFF,
				(trackId >>>  8) & 0xFF,
				(trackId) & 0xFF,
				0x00, 0x00, 0x00, 0x01,  // default_sample_description_index
				0x00, 0x00, 0x00, 0x00,  // default_sample_duration
				0x00, 0x00, 0x00, 0x00,  // default_sample_size
				0x00, 0x01, 0x00, 0x01   // default_sample_flags
			]);
			
			return _this.box(_types.trex, data);
		};
		
		// Movie fragment box
		_this.moof = function(track, baseMediaDecodeTime) {
			return _this.box(_types.moof, _this.mfhd(track.sequenceNumber), _this.traf(track, baseMediaDecodeTime));
		};
		
		_this.mfhd = function(sequenceNumber) {
			var data = new Uint8Array([
				0x00, 0x00, 0x00, 0x00,
				(sequenceNumber >>> 24) & 0xFF, // sequence_number: int32
				(sequenceNumber >>> 16) & 0xFF,
				(sequenceNumber >>>  8) & 0xFF,
				(sequenceNumber) & 0xFF
			]);
			
			return _this.box(_types.mfhd, data);
		};
		
		// Track fragment box
		_this.traf = function(track, baseMediaDecodeTime) {
			var trackId = track.id;
			
			// Track fragment header box
			var tfhd = _this.box(_types.tfhd, new Uint8Array([
				0x00, 0x00, 0x00, 0x00,  // version(0) & flags
				(trackId >>> 24) & 0xFF, // track_ID
				(trackId >>> 16) & 0xFF,
				(trackId >>>  8) & 0xFF,
				(trackId) & 0xFF
			]));
			
			// Track Fragment Decode Time
			var tfdt = _this.box(_types.tfdt, new Uint8Array([
				0x00, 0x00, 0x00, 0x00,              // version(0) & flags
				(baseMediaDecodeTime >>> 24) & 0xFF, // baseMediaDecodeTime: int32
				(baseMediaDecodeTime >>> 16) & 0xFF,
				(baseMediaDecodeTime >>>  8) & 0xFF,
				(baseMediaDecodeTime) & 0xFF
			]));
			
			var sdtp = _this.sdtp(track);
			var trun = _this.trun(track, sdtp.byteLength + 16 + 16 + 8 + 16 + 8 + 8);
			
			return _this.box(_types.traf, tfhd, tfdt, trun, sdtp);
		};
		
		// Sample Dependency Type box
		_this.sdtp = function(track) {
			var samples = track.samples || [];
			var sampleCount = samples.length;
			var data = new Uint8Array(4 + sampleCount);
			
			// 0~4 bytes: version(0) & flags
			for (var i = 0; i < sampleCount; i++) {
				var flags = samples[i].flags;
				data[i + 4] = (flags.isLeading << 6) // is_leading: 2 (bit)
					| (flags.dependsOn << 4)           // sample_depends_on
					| (flags.isDependedOn << 2)        // sample_is_depended_on
					| (flags.hasRedundancy);           // sample_has_redundancy
			}
			
			return _this.box(_types.sdtp, data);
		};
		
		// Track fragment run box
		_this.trun = function(track, offset) {
			var samples = track.samples || [];
			var sampleCount = samples.length;
			var dataSize = 12 + 16 * sampleCount;
			var data = new Uint8Array(dataSize);
			
			offset += 8 + dataSize;
			
			data.set([
				0x00, 0x00, 0x0F, 0x01,      // version(0) & flags
				(sampleCount >>> 24) & 0xFF, // sample_count
				(sampleCount >>> 16) & 0xFF,
				(sampleCount >>>  8) & 0xFF,
				(sampleCount) & 0xFF,
				(offset >>> 24) & 0xFF,      // data_offset
				(offset >>> 16) & 0xFF,
				(offset >>>  8) & 0xFF,
				(offset) & 0xFF
			], 0);
			
			for (var i = 0; i < sampleCount; i++) {
				var duration = samples[i].duration;
				var size = samples[i].size;
				var flags = samples[i].flags;
				var cts = samples[i].cts;
				
				data.set([
					(duration >>> 24) & 0xFF, // sample_duration
					(duration >>> 16) & 0xFF,
					(duration >>>  8) & 0xFF,
					(duration) & 0xFF,
					(size >>> 24) & 0xFF,     // sample_size
					(size >>> 16) & 0xFF,
					(size >>>  8) & 0xFF,
					(size) & 0xFF,
					(flags.isLeading << 2) | flags.dependsOn, // sample_flags
					(flags.isDependedOn << 6) | (flags.hasRedundancy << 4) | flags.isNonSync,
					0x00, 0x00,               // sample_degradation_priority
					(cts >>> 24) & 0xFF,      // sample_composition_time_offset
					(cts >>> 16) & 0xFF,
					(cts >>>  8) & 0xFF,
					(cts) & 0xFF
				], 12 + 16 * i);
			}
			
			return _this.box(_types.trun, data);
		};
		
		_this.mdat = function(data) {
			return _this.box(_types.mdat, data);
		};
		
		
		_this.destroy = function() {
			
		};
		
		_init();
	};
})(playease);

(function(playease) {
	playease.core = {};
})(playease);

(function(playease) {
	playease.core.states = {
		BUFFERING: 'buffering',
		PLAYING: 'playing',
		SEEKING: 'seeking',
		PAUSED: 'paused',
		STOPPED: 'stopped',
		ERROR: 'error'
	};
})(playease);

(function(playease) {
	playease.core.skins = {};
})(playease);

(function(playease) {
	playease.core.skins.modes = {
		DEFAULT: 'def'
	};
})(playease);

(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		skins = playease.core.skins,
		skinmodes = skins.modes,
		css = utils.css,
		
		WRAP_CLASS = 'pla-wrapper',
		SKIN_CLASS = 'pla-skin',
		RENDER_CLASS = 'pla-render',
		POSTER_CLASS = 'pla-poster',
		CONTROLS_CLASS = 'pla-controls',
		CONTEXTMENU_CLASS = 'pla-contextmenu',
		
		DEVIDER_CLASS = 'pldevider',
		LABEL_CLASS = 'pllabel',
		BUTTON_CLASS = 'plbutton',
		SLIDER_CLASS = 'plslider',
		
		// For all api instances
		CSS_SMOOTH_EASE = 'opacity .25s ease',
		CSS_100PCT = '100%',
		CSS_ABSOLUTE = 'absolute',
		CSS_RELATIVE = 'relative',
		CSS_NORMAL = 'normal',
		CSS_IMPORTANT = ' !important',
		CSS_HIDDEN = 'hidden',
		CSS_NONE = 'none',
		CSS_BLOCK = 'block';
	
	skins.def = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('skins.def')),
			_width = config.width,
			_height = config.height;
		
		function _init() {
			_this.name = skinmodes.DEFAULT;
			
			SKIN_CLASS += '-' + _this.name;
			
			css('.' + WRAP_CLASS, {
				width: _width + 'px',
				height: (_height + 40) + 'px',
				'box-shadow': '0 1px 1px rgba(0, 0, 0, 0.05)'
			});
			css('.' + WRAP_CLASS + '.fp, .' + WRAP_CLASS + '.fs', {
				width: CSS_100PCT,
				height: CSS_100PCT
			});
			css('.' + WRAP_CLASS + ' *', {
				margin: '0',
				padding: '0',
				'font-family': '微软雅黑,arial,sans-serif',
				'font-size': '12px',
				'font-weight': CSS_NORMAL,
				'box-sizing': 'content-box'
			});
			
			css('.' + SKIN_CLASS + ' .' + DEVIDER_CLASS, {
				padding: '0 2px',
				'line-height': '40px',
				color: '#FFF',
				cursor: 'default'
			});
			
			css('.' + SKIN_CLASS + ' .' + LABEL_CLASS, {
				'line-height': '40px',
				color: '#FFF',
				cursor: 'default'
			});
			
			css('.' + SKIN_CLASS + ' .' + BUTTON_CLASS, {
				cursor: 'pointer'
			});
			
			css('.' + SKIN_CLASS + ' .' + SLIDER_CLASS, {
				cursor: 'pointer'
			});
			
			css('.' + SKIN_CLASS + ' .' + RENDER_CLASS, {
				width: CSS_100PCT,
				height: 'calc(100% - 40px)',
				position: CSS_RELATIVE,
				background: 'black'
			});
			css('.' + SKIN_CLASS + '.fs .' + RENDER_CLASS, {
				height: CSS_100PCT
			});
			css('.' + SKIN_CLASS + ' .' + RENDER_CLASS + ' video', {
				width: CSS_100PCT,
				height: CSS_100PCT
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS, {
				width: CSS_100PCT,
				height: '40px',
				background: '#222',
				position: CSS_RELATIVE
			});
			css('.' + SKIN_CLASS + '.fs .' + CONTROLS_CLASS, {
				top: '-40px'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' > div'
				+ ', .' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' > div > *', {
				'float': 'left'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plcenter', {
				
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plright', {
				'float': 'right'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plslider.time', {
				width: CSS_100PCT,
				height: '2px',
				position: CSS_ABSOLUTE,
				top: '-2px',
				display: CSS_NONE
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ':hover .plslider.time', {
				height: '10px',
				top: '-10px'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plslider.time .plrail', {
				width: '0',
				height: CSS_100PCT,
				position: CSS_ABSOLUTE,
				top: '0'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plslider.time .plrail.bg', {
				width: CSS_100PCT,
				background: '#CCC',
				filter: 'alpha(opacity=50)',
				opacity: '0.5'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plslider.time .plrail.buf', {
				background: '#707070'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plslider.time .plrail.pro', {
				background: '#00A0E9'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plplay', {
				'margin-left': '8px',
				width: '26px',
				height: '40px',
				background: 'url(/webplayer/playease/skins/playButton.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plplay:hover', {
				background: 'url(/webplayer/playease/skins/playButtonOver.png) no-repeat center'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plpause', {
				'margin-left': '8px',
				width: '26px',
				height: '40px',
				display: CSS_NONE,
				background: 'url(/webplayer/playease/skins/pauseButton.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plpause:hover', {
				background: 'url(/webplayer/playease/skins/pauseButtonOver.png) no-repeat center'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plreload', {
				'margin-right': '8px',
				width: '26px',
				height: '40px',
				background: 'url(/webplayer/playease/skins/reloadButton.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plreload:hover', {
				background: 'url(/webplayer/playease/skins/reloadButtonOver.png) no-repeat center'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plstop', {
				'margin-right': '8px',
				width: '26px',
				height: '40px',
				display: CSS_NONE,
				background: 'url(/webplayer/playease/skins/stopButton.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plstop:hover', {
				background: 'url(/webplayer/playease/skins/stopButtonOver.png) no-repeat center'
			});
			
			css('.' + SKIN_CLASS + '.playing .' + CONTROLS_CLASS + ' .plplay'
				+ ', .' + SKIN_CLASS + '.vod .' + CONTROLS_CLASS + ' .plreload'
				+ ', .' + SKIN_CLASS + '.vod .' + CONTROLS_CLASS + ' .plalt'
				+ ', .' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plelapsed'
				+ ', .' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .pldevider'
				+ ', .' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plduration', {
				display: CSS_NONE
			});
			css('.' + SKIN_CLASS + '.vod .' + CONTROLS_CLASS + ' .plslider.time'
				+ ', .' + SKIN_CLASS + '.playing .' + CONTROLS_CLASS + ' .plpause'
				+ ', .' + SKIN_CLASS + '.vod .' + CONTROLS_CLASS + ' .plstop'
				+ ', .' + SKIN_CLASS + '.vod .' + CONTROLS_CLASS + ' .plelapsed'
				+ ', .' + SKIN_CLASS + '.vod .' + CONTROLS_CLASS + ' .pldevider'
				+ ', .' + SKIN_CLASS + '.vod .' + CONTROLS_CLASS + ' .plduration', {
				display: CSS_BLOCK
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plreport', {
				'margin-right': '4px',
				width: '20px',
				height: '40px',
				background: 'url(/webplayer/playease/skins/reportButton.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plreport:hover', {
				background: 'url(/webplayer/playease/skins/reportButtonOver.png) no-repeat center'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plvolume', {
				width: '25px',
				height: '40px',
				background: 'url(/webplayer/playease/skins/volumeButton.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plvolume:hover', {
				background: 'url(/webplayer/playease/skins/volumeButtonOver.png) no-repeat center'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plvolume.mute', {
				background: 'url(/webplayer/playease/skins/volumeMuteButton.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plvolume.mute:hover', {
				background: 'url(/webplayer/playease/skins/volumeMuteButtonOver.png) no-repeat center'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plslider.volume', {
				margin: '15px 4px 0 0',
				width: '60px',
				height: '12px',
				position: CSS_RELATIVE
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plslider.volume .plrail', {
				width: CSS_100PCT,
				height: '33%',
				position: CSS_ABSOLUTE,
				top: '33%'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plslider.volume .plrail.buf', {
				background: '#909090'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plslider.volume:hover .plrail.buf', {
				background: '#B0B0B0'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plslider.volume .plrail.pro', {
				width: '80%',
				background: '#E6E6E6'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plslider.volume:hover .plrail.pro', {
				background: '#FFFFFF'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plhd', {
				'margin-right': '4px',
				width: '48px',
				height: '40px',
				background: 'url(/webplayer/playease/skins/hdButton.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plhd:hover', {
				background: 'url(/webplayer/playease/skins/hdButtonOver.png) no-repeat center'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plbullet', {
				'margin-right': '4px',
				width: '58px',
				height: '40px',
				background: 'url(/webplayer/playease/skins/bulletButton.png) no-repeat center'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plbullet.off', {
				background: 'url(/webplayer/playease/skins/bulletOffButton.png) no-repeat center'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plfullpage', {
			'margin-right': '4px',
				width: '25px',
				height: '40px',
				background: 'url(/webplayer/playease/skins/fullpageButton.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plfullpage:hover', {
				background: 'url(/webplayer/playease/skins/fullpageButtonOver.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + '.fp .' + CONTROLS_CLASS + ' .plfullpage', {
				display: CSS_NONE
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plfpexit', {
				'margin-right': '4px',
				width: '25px',
				height: '40px',
				display: CSS_NONE,
				background: 'url(/webplayer/playease/skins/fullpageExitButton.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plfpexit:hover', {
				background: 'url(/webplayer/playease/skins/fullpageExitButtonOver.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + '.fp .' + CONTROLS_CLASS + ' .plfpexit', {
				display: CSS_BLOCK
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plfullscreen', {
				'margin-right': '10px',
				width: '25px',
				height: '40px',
				background: 'url(/webplayer/playease/skins/fullscreenButton.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plfullscreen:hover', {
				background: 'url(/webplayer/playease/skins/fullscreenButtonOver.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + '.fs .' + CONTROLS_CLASS + ' .plfullscreen', {
				display: CSS_NONE
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plfsexit', {
				'margin-right': '10px',
				width: '25px',
				height: '40px',
				display: CSS_NONE,
				background: 'url(/webplayer/playease/skins/fullscreenExitButton.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plfsexit:hover', {
				background: 'url(/webplayer/playease/skins/fullscreenExitButtonOver.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + '.fs .' + CONTROLS_CLASS + ' .plfsexit', {
				display: CSS_BLOCK
			});
		}
		
		_this.resize = function(width, height) {
			utils.log('Resizing to ' + width + ', ' + height);
			
			_width = parseInt(width);
			_height = parseInt(height);
		};
		
		_init();
	};
})(playease);

(function(playease) {
	playease.core.renders = {};
})(playease);

(function(playease) {
	playease.core.renders.modes = {
		DEFAULT: 'def',
		FLV: 'flv'
	};
})(playease);

(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		renders = core.renders,
		rendermodes = renders.modes,
		css = utils.css,
		
		RENDER_CLASS = 'pla-render',
		
		// For all api instances
		CSS_SMOOTH_EASE = 'opacity .25s ease',
		CSS_100PCT = '100%',
		CSS_ABSOLUTE = 'absolute',
		CSS_IMPORTANT = ' !important',
		CSS_HIDDEN = 'hidden',
		CSS_NONE = 'none',
		CSS_BLOCK = 'block';
	
	renders.def = function(view, config) {
		var _this = utils.extend(this, new events.eventdispatcher('renders.def')),
			_defaults = {},
			_video;
		
		function _init() {
			_this.name = rendermodes.DEFAULT;
			
			_this.config = utils.extend({}, _defaults, config);
			
			_video = utils.createElement('video');
			_video.playsinline = _video['webkit-playsinline'] = _this.config.playsinline;
			_video.poster = _this.config.poster;
		}
		
		_this.setup = function() {
			_this.dispatchEvent(events.PLAYEASE_READY, { id: _this.config.id });
		};
		
		_this.play = function(url) {
			if (url) {
				config.url = url;
			}
			
			if (url || _video.src != config.url) {
				_video.pause();
				_video.src = config.url;
				_video.load();
			}
			
			_video.play();
		};
		
		_this.pause = function() {
			_video.pause();
		};
		
		_this.reload = function() {
			
		};
		
		_this.seek = function(offset) {
			
		};
		
		_this.stop = function() {
			_video.pause();
			_video.src = '';
		};
		
		_this.mute = function(bool) {
			bool = !!bool;
		};
		
		_this.volume = function(vol) {
			
		};
		
		_this.hd = function(index) {
			
		};
		
		_this.element = function() {
			return _video;
		};
		
		_this.resize = function(width, height) {
			
		};
		
		_this.destroy = function() {
			
		};
		
		_init();
	};
})(playease);

(function(playease) {
	var utils = playease.utils,
		//filekeeper = utils.filekeeper,
		events = playease.events,
		core = playease.core,
		muxer = playease.muxer,
		renders = core.renders,
		rendermodes = renders.modes,
		css = utils.css,
		
		AMF = muxer.AMF,
		TAG = muxer.flv.TAG,
		FORMATS = muxer.flv.FORMATS,
		CODECS = muxer.flv.CODECS,
		
		RENDER_CLASS = 'pla-render',
		
		// For all api instances
		CSS_SMOOTH_EASE = 'opacity .25s ease',
		CSS_100PCT = '100%',
		CSS_ABSOLUTE = 'absolute',
		CSS_IMPORTANT = ' !important',
		CSS_HIDDEN = 'hidden',
		CSS_NONE = 'none',
		CSS_BLOCK = 'block';
	
	renders.flv = function(view, config) {
		var _this = utils.extend(this, new events.eventdispatcher('renders.def')),
			_defaults = {},
			_video,
			_loader,
			_demuxer,
			_remuxer,
			_mediainfo,
			_ms,
			_sbs,
			_segments,
			//_fileindex,
			//_filekeeper,
			_endOfStream = false;
		
		function _init() {
			_this.name = rendermodes.FLV;
			
			_this.config = utils.extend({}, _defaults, config);
			
			_sbs = { audio: null, video: null };
			_segments = { audio: [], video: [] };
			
			_video = utils.createElement('video');
			_video.playsinline = _video['webkit-playsinline'] = _this.config.playsinline;
			_video.poster = _this.config.poster;
			/*
			_fileindex = 0;
			_filekeeper = new filekeeper();
			*/
			_initMuxer();
			_initMSE();
		}
		
		function _initMuxer() {
			_loader = new utils.loader(config.loader);
			_loader.addEventListener(events.PLAYEASE_CONTENT_LENGTH, _onContenLength);
			_loader.addEventListener(events.PLAYEASE_PROGRESS, _onLoaderProgress);
			_loader.addEventListener(events.PLAYEASE_COMPLETE, _onLoaderComplete);
			_loader.addEventListener(events.ERROR, _onLoaderError);
			
			_demuxer = new muxer.flv();
			_demuxer.addEventListener(events.PLAYEASE_FLV_TAG, _onFLVTag);
			_demuxer.addEventListener(events.PLAYEASE_MEDIA_INFO, _onMediaInfo);
			_demuxer.addEventListener(events.PLAYEASE_AVC_CONFIG_RECORD, _onAVCConfigRecord);
			_demuxer.addEventListener(events.PLAYEASE_AVC_SAMPLE, _onAVCSample);
			_demuxer.addEventListener(events.PLAYEASE_AAC_SPECIFIC_CONFIG, _onAACSpecificConfig);
			_demuxer.addEventListener(events.PLAYEASE_AAC_SAMPLE, _onAACSample);
			_demuxer.addEventListener(events.PLAYEASE_END_OF_STREAM, _onEndOfStream);
			_demuxer.addEventListener(events.ERROR, _onDemuxerError);
			
			_remuxer = new muxer.mp4();
			_remuxer.addEventListener(events.PLAYEASE_MP4_INIT_SEGMENT, _onMP4InitSegment);
			_remuxer.addEventListener(events.PLAYEASE_MP4_SEGMENT, _onMP4Segment);
			_remuxer.addEventListener(events.ERROR, _onRemuxerError);
		}
		
		function _initMSE() {
			window.MediaSource = window.MediaSource || window.WebKitMediaSource;
			
			_ms = new MediaSource();
			_ms.addEventListener('sourceopen', _onMediaSourceOpen);
			_ms.addEventListener('sourceended', _onMediaSourceEnded);
			_ms.addEventListener('sourceclose', _onMediaSourceClose);
			_ms.addEventListener('error', _onMediaSourceError);
			
			_ms.addEventListener('webkitsourceopen', _onMediaSourceOpen);
			_ms.addEventListener('webkitsourceended', _onMediaSourceEnded);
			_ms.addEventListener('webkitsourceclose', _onMediaSourceClose);
			_ms.addEventListener('webkiterror', _onMediaSourceError);
		}
		
		_this.setup = function() {
			_this.dispatchEvent(events.PLAYEASE_READY, { id: _this.config.id });
		};
		
		_this.play = function(url) {
			if (url) {
				config.url = url;
			}
			
			if (url || _video.src != config.url) {
				_segments.audio = [];
				_segments.video = [];
				
				_loader.abort();
				_demuxer.reset();
				_remuxer.reset();
				
				_video.pause();
				_video.src = URL.createObjectURL(_ms);
				_video.load();
			}
			
			_video.play();
		};
		
		_this.pause = function() {
			_video.pause();
		};
		
		_this.reload = function() {
			
		};
		
		_this.seek = function(offset) {
			
		};
		
		_this.stop = function() {
			_segments.audio = [];
			_segments.video = [];
			
			_loader.abort();
			
			_video.pause();
			_video.src = '';
		};
		
		_this.mute = function(bool) {
			bool = !!bool;
		};
		
		_this.volume = function(vol) {
			
		};
		
		_this.hd = function(index) {
			
		};
		
		/**
		 * Loader
		 */
		function _onContenLength(e) {
			utils.log('onContenLength: ' + e.length);
		}
		
		function _onLoaderProgress(e) {
			//utils.log('onLoaderProgress: ' + e.data.byteLength);
			_demuxer.parse(e.data);
		}
		
		function _onLoaderComplete(e) {
			utils.log('onLoaderComplete');
		}
		
		function _onLoaderError(e) {
			utils.log(e.message);
		}
		
		/**
		 * Demuxer
		 */
		function _onFLVTag(e) {
			//utils.log('onFlvTag { tag: ' + e.tag + ', offset: ' + e.offset + ', size: ' + e.size + ' }');
			
			switch (e.tag) {
				case TAG.AUDIO:
					if (e.format && e.format != FORMATS.AAC) {
						utils.log('Unsupported audio format(' + e.format + ').');
						break;
					}
					
					_demuxer.parseAACAudioPacket(e.data, e.offset, e.size, e.timestamp, e.rate, e.samplesize, e.sampletype);
					break;
				case TAG.VIDEO:
					if (e.codec && e.codec != CODECS.AVC) {
						utils.log('Unsupported video codec(' + e.codec + ').');
						break;
					}
					
					_demuxer.parseAVCVideoPacket(e.data, e.offset, e.size, e.timestamp, e.frametype);
					break;
				case TAG.SCRIPT:
					var data = AMF.parse(e.data, e.offset, e.size);
					utils.log(data.key + ': ' + JSON.stringify(data.value));
					
					if (data.key == 'onMetaData') {
						_demuxer.setMetaData(data.value);
					}
					break;
				default:
					utils.log('Skipping unknown tag type ' + e.tag);
			}
		}
		
		function _onMediaInfo(e) {
			_mediainfo = e.info;
		}
		
		function _onAVCConfigRecord(e) {
			_remuxer.setVideoMeta(e.data);
			_remuxer.getInitSegment(e.data);
		}
		
		function _onAVCSample(e) {
			_remuxer.getVideoSegment(e.data);
		}
		
		function _onAACSpecificConfig(e) {
			_remuxer.setAudioMeta(e.data);
			_remuxer.getInitSegment(e.data);
		}
		
		function _onAACSample(e) {
			_remuxer.getAudioSegment(e.data);
		}
		
		function _onEndOfStream(e) {
			_endOfStream = true;
		}
		
		function _onDemuxerError(e) {
			utils.log(e.message);
		}
		
		/**
		 * Remuxer
		 */
		function _onMP4InitSegment(e) {
			/*
			_fileindex++
			_filekeeper.append(e.data);
			//_filekeeper.save('sample.' + e.tp + '.init.mp4');
			*/
			_this.appendInitSegment(e.tp, e.data);
		}
		
		function _onMP4Segment(e) {
			/*
			_fileindex++
			_filekeeper.append(e.data);
			//_filekeeper.save('sample.' + e.tp + '.' + (_fileindex++) + '.m4s');
			*/
			_this.appendSegment(e.tp, e.data);
		}
		
		function _onRemuxerError(e) {
			utils.log(e.message);
		}
		
		/**
		 * MSE
		 */
		_this.appendInitSegment = function(type, seg) {
			var mimetype = type + '/mp4; codecs="' + _mediainfo[type + 'Codec'] + '"';
			utils.log('Mime type: ' + mimetype + '.');
			
			var issurpported = MediaSource.isTypeSupported(mimetype);
			if (!issurpported) {
				_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'Mime type is not surpported: ' + mimetype + '.' });
				return;
			}
			
			if (_ms.readyState == 'closed') {
				_this.dispatchEvent(events.PLAYEASE_RENDER_ERROR, { message: 'MediaSource is closed while appending init segment.' });
				return;
			}
			
			var sb = _sbs[type] = _ms.addSourceBuffer(mimetype);
			sb.type = type;
			sb.addEventListener('updateend', _onUpdateEnd);
			sb.addEventListener('error', _onSourceBufferError);
			sb.appendBuffer(seg);
		};
		
		_this.appendSegment = function(type, seg) {
			_segments[type].push(seg);
			
			var sb = _sbs[type];
			if (sb.updating) {
				return;
			}
			
			var seg = _segments[type].shift();
			sb.appendBuffer(seg);
		};
		
		function _onMediaSourceOpen(e) {
			utils.log('media source open');
			
			_loader.load(config.url);
		}
		
		function _onUpdateEnd(e) {
			utils.log('update end');
			
			var type = e.target.type;
			
			if (_endOfStream) {
				if (!_ms || _ms.readyState !== 'open') {
					return;
				}
				
				if (!_segments.audio.length && !_segments.video.length) {
					//_filekeeper.save();
					_ms.endOfStream();
					return;
				}
			}
			
			if (_segments[type].length == 0) {
				return;
			}
			
			var sb = _sbs[type];
			if (sb.updating) {
				return;
			}
			
			var seg = _segments[type].shift();
			try {
				sb.appendBuffer(seg);
			} catch (err) {
				utils.log(err);
			}
		}
		
		function _onSourceBufferError(e) {
			utils.log('source buffer error');
		}
		
		function _onMediaSourceEnded(e) {
			utils.log('media source ended');
		}
		
		function _onMediaSourceClose(e) {
			utils.log('media source close');
		}
		
		function _onMediaSourceError(e) {
			utils.log('media source error');
		}
		
		
		_this.element = function() {
			return _video;
		};
		
		_this.resize = function(width, height) {
			
		};
		
		_this.destroy = function() {
			
		};
		
		_init();
	};
})(playease);

(function(playease) {
	playease.core.components = {};
})(playease);

(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		components = core.components,
		
		directions = {
			HORIZONTAL: 0,
			VERTICAL:   1
		};
	
	components.slider = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('components.controlbar')),
			_defaults = {
				wrapper: '',
				name: '',
				direction: directions.HORIZONTAL
			},
			_railnames = ['bg', 'buf', 'pro'],
			_rails,
			_direction,
			_container,
			_percentage,
			_active,
			_value;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_rails = {};
			_direction = _this.config.direction;
			_percentage = 0;
			_active = false;
			
			_build();
			
			try {
				document.addEventListener('mousedown', _onMouseDown);
				document.addEventListener('mousemove', _onMouseMove);
				document.addEventListener('mouseup', _onMouseUp);
			} catch (err) {
				document.attachEvent('onmousedown', _onMouseDown);
				document.attachEvent('onmousemove', _onMouseMove);
				document.attachEvent('onmouseup', _onMouseUp);
			}
		}
		
		function _build() {
			if (utils.isMobile() && _this.config.name.indexOf('volume') === 0) {
				return;
			}
			
			_container = utils.createElement('div', 'plslider ' + _this.config.name);
			
			for (var i = 0; i < _railnames.length; i++) {
				var name = _railnames[i];
				var rail = _rails[name] = utils.createElement('span', 'plrail ' + name);
				_container.appendChild(rail);
			}
			
			var thumb = utils.createElement('span', 'plthumb');
			_container.appendChild(thumb);
		}
		
		_this.buffered = function(percentage) {
			_rails.buf.style.width = percentage + '%';
		};
		
		_this.update = function(percentage) {
			_percentage = percentage;
			_rails.pro.style.width = _percentage + '%';
		};
		
		function _onMouseDown(e) {
			var target = e.target.parentNode === _container ? e.target.parentNode : e.target;
			if (target !== _container) {
				return;
			}
			
			var value = _getValue(e.x, e.y);
			if (value != _value) {
				_value = value;
				_this.dispatchEvent(events.PLAYEASE_SLIDER_CHANGE, { value: value });
			}
			
			_active = true;
		}
		
		function _onMouseMove(e) {
			if (!_active) {
				return;
			}
			
			var value = _getValue(e.x, e.y);
			if (value != _value) {
				_value = value;
				_this.dispatchEvent(events.PLAYEASE_SLIDER_CHANGE, { value: value });
			}
		}
		
		function _onMouseUp(e) {
			if (!_active) {
				return;
			}
			
			var value = _getValue(e.x, e.y);
			if (value != _value) {
				_value = value;
				_this.dispatchEvent(events.PLAYEASE_SLIDER_CHANGE, { value: value });
			}
			
			_active = false;
		}
		
		function _getValue(x, y) {
			var wrapper = document.getElementById(_this.config.wrapper);
			var offsetX = x - _container.offsetLeft - wrapper.offsetLeft;
			var offsetY = y - _container.offsetTop - _container.parentNode.parentNode.offsetTop;
			
			var value;
			if (_direction == directions.HORIZONTAL) {
				value = Math.floor(offsetX / _container.clientWidth * 100);
			} else {
				value = Math.floor(offsetY / _container.clientHeight * 100);
			}
			
			value = Math.max(0, Math.min(value, 100));
			
			return value;
		}
		
		_this.element = function() {
			return _container;
		};
		
		_init();
	};
})(playease);

(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		components = core.components,
		
		types = {
			DEVIDER: 0,
			LABEL:   1,
			BUTTON:  2,
			SLIDER:  3
		};
	
	components.controlbar = function(layer, config) {
		var _this = utils.extend(this, new events.eventdispatcher('components.controlbar')),
			_defaults = {
				wrapper: ''
			},
			_layout = {
				left: [
					_layoutElement('play', types.BUTTON),
					_layoutElement('pause', types.BUTTON),
					_layoutElement('reload', types.BUTTON),
					_layoutElement('stop', types.BUTTON),
					_layoutElement('alt', types.LABEL),
					_layoutElement('elapsed', types.LABEL),
					_layoutElement('devider', types.DEVIDER),
					_layoutElement('duration', types.LABEL)
				],
				center: [
					
				],
				right: [
					_layoutElement('report', types.BUTTON),
					_layoutElement('volume', types.BUTTON),
					_layoutElement('volume', types.SLIDER),
					_layoutElement('hd', types.BUTTON),
					_layoutElement('bullet', types.BUTTON),
					_layoutElement('fullpage', types.BUTTON),
					_layoutElement('fpexit', types.BUTTON),
					_layoutElement('fullscreen', types.BUTTON),
					_layoutElement('fsexit', types.BUTTON)
				]
			},
			_leftgroup,
			_centergroup,
			_rightgroup,
			_timeBar,
			_volumeBar,
			_labels,
			_buttons;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_timeBar = new components.slider({ wrapper: _this.config.wrapper, name: 'time' });
			_timeBar.addEventListener(events.PLAYEASE_SLIDER_CHANGE, _onTimeBarChange);
			layer.appendChild(_timeBar.element());
			
			_labels = {};
			_buttons = {};
			
			_buildLayout();
		}
		
		function _layoutElement(name, type, className) {
			return {
				name: name,
				type: type,
				className: className
			};
		}
		
		function _buildLayout() {
			_buildGroup('left', _layout.left);
			_buildGroup('center', _layout.center);
			_buildGroup('right', _layout.right);
		}
		
		function _buildGroup(pos, elts) {
			var group = utils.createElement('div', 'pl' + pos);
			
			for (var i = 0; i < elts.length; i++) {
				var element = _buildElement(elts[i], pos);
				if (element) {
					group.appendChild(element);
				}
			}
			
			layer.appendChild(group);
		}
		
		function _buildElement(elt, pos) {
			var element;
			
			switch (elt.type) {
				case types.DEVIDER:
					element = _buildDevider(elt.name);
					break;
				case types.LABEL:
					element = _buildLabel(elt.name);
					break;
				case types.BUTTON:
					element = _buildButton(elt.name, pos);
					break;
				case types.SLIDER:
					if (elt.name === 'volume') {
						_volumeBar = new components.slider({ wrapper: _this.config.wrapper, name: elt.name });
						_volumeBar.addEventListener(events.PLAYEASE_SLIDER_CHANGE, _onVolumeBarChange);
						element = _volumeBar.element();
					}
					break;
				default:
					break;
			}
			
			return element;
		}
		
		function _buildDevider(name) {
			var className = 'pldevider';
			var element = utils.createElement('span', className);
			element.innerHTML = '/';
			
			return element;
		}
		
		function _buildLabel(name) {
			var className = 'pllabel pl' + name;
			var text = '';
			
			switch (name) {
				case 'alt':
					text = 'Live broadcast';
					break;
				case 'elapsed':
				case 'duration':
					className += ' plhidden';
					text = '00:00';
					break;
				case 'devider':
					text = '/';
					break;
				default:
					break;
			}
			
			var element = utils.createElement('span', className);
			element.innerHTML = text;
			
			_labels[name] = element;
			
			return element;
		}
		
		function _buildButton(name, pos) {
			// Don't show volume or mute controls on mobile, since it's not possible to modify audio levels in JS
			if (utils.isMobile() && (name === 'volume' || name.indexOf('volume') === 0)) {
				return null;
			}
			// Having issues with stock (non-chrome) Android browser and showing overlays.
			// Just remove HD/CC buttons in that case
			if (utils.isAndroid(4, true) && /hd|cc/.test(name)) {
				return null;
			}
			
			var element = utils.createElement('span', 'plbutton pl' + name);
			element.name = name;
			try {
				element.addEventListener('click', _onButtonClick);
			} catch(err) {
				element.attachEvent('onclick', _onButtonClick);
			}
			
			_buttons[name] = element;
			
			return element;
		}
		
		function _onButtonClick(e) {
			var name = e.target.name;
			
			switch (name) {
				case 'play':
					_this.dispatchEvent(events.PLAYEASE_VIEW_PLAY);
					break;
				case 'pause':
					_this.dispatchEvent(events.PLAYEASE_VIEW_PAUSE);
					break;
				case 'reload':
					_this.dispatchEvent(events.PLAYEASE_VIEW_RELOAD);
					break;
				case 'stop':
					_this.dispatchEvent(events.PLAYEASE_VIEW_STOP);
					break;
				case 'report':
					_this.dispatchEvent(events.PLAYEASE_VIEW_REPORT);
					break;
				case 'volume':
					_this.dispatchEvent(events.PLAYEASE_VIEW_MUTE);
					break;
				case 'hd':
					_this.dispatchEvent(events.PLAYEASE_VIEW_HD);
					break;
				case 'bullet':
					_this.dispatchEvent(events.PLAYEASE_VIEW_BULLET);
					break;
				case 'fullpage':
				case 'fpexit':
					_this.dispatchEvent(events.PLAYEASE_VIEW_FULLPAGE);
					break;
				case 'fullscreen':
				case 'fsexit':
					_this.dispatchEvent(events.PLAYEASE_VIEW_FULLSCREEN);
					break;
				default:
					break;
			}
		}
		
		function _onTimeBarChange(e) {
			_this.dispatchEvent(events.PLAYEASE_VIEW_SEEK, { offset: e.value });
		}
		
		function _onVolumeBarChange(e) {
			_this.dispatchEvent(events.PLAYEASE_VIEW_VOLUME, { volume: e.value });
		}
		
		_this.setDuration = function(duration) {
			var h = Math.floor(duration / 3600);
			var m = Math.floor((duration % 3600) / 60);
			var s = Math.floor(duration % 60);
			var text = (h ? utils.pad(h, 2) + ':' : '') + utils.pad(m, 2) + ':' + utils.pad(s, 2);
			_labels.duration.innerHTML = text;
		};
		
		_this.setElapsed = function(elapsed) {
			var h = Math.floor(elapsed / 3600);
			var m = Math.floor((elapsed % 3600) / 60);
			var s = Math.floor(elapsed % 60);
			var text = (h ? utils.pad(h, 2) + ':' : '') + utils.pad(m, 2) + ':' + utils.pad(s, 2);
			_labels.elapsed.innerHTML = text;
		};
		
		_this.setProgress = function(elapsed, duration) {
			if (!duration) {
				return;
			}
			
			var percentage = Math.floor(elapsed / duration * 10000) / 100;
			_timeBar.update(percentage);
		};
		
		_this.setBuffered = function(buffered, total) {
			if (!total) {
				return;
			}
			
			var percentage = Math.floor(buffered / total * 10000) / 100;
			_timeBar.buffered(percentage);
		};
		
		_this.setMuted = function(muted, vol) {
			if (muted) {
				utils.addClass(_buttons.volume, 'mute');
				_volumeBar.update(0);
			} else {
				utils.removeClass(_buttons.volume, 'mute');
				_volumeBar.update(vol);
			}
		};
		
		_this.setVolume = function(vol) {
			if (vol) {
				utils.removeClass(_buttons.volume, 'mute');
			} else {
				utils.addClass(_buttons.volume, 'mute');
			}
			_volumeBar.update(vol);
		};
		
		_this.setBullet = function(on) {
			if (on) {
				utils.removeClass(_buttons.bullet, 'off');
			} else {
				utils.addClass(_buttons.bullet, 'off');
			}
		};
		
		_this.resize = function(width, height) {
			
		};
		
		_this.destroy = function() {
			
		};
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_init();
	};
})(playease);

(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core;
	
	core.entity = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('core.entity')),
			_model,
			_view,
			_controller;
		
		function _init() {
			_this.id = config.id;
			
			_this.model = _model = new core.model(config);
			_this.view = _view = new core.view(_this, _model);
			_this.controller = _controller = new core.controller(_model, _view);
			
			_controller.addGlobalListener(_forward);
			
			_initializeAPI();
		}
		
		function _initializeAPI() {
			_this.play = _controller.play;
			_this.pause = _controller.pause;
			_this.reload = _controller.reload;
			_this.seek = _controller.seek;
			_this.stop = _controller.stop;
			_this.report = _controller.report;
			_this.mute = _controller.mute;
			_this.volume = _controller.volume;
			_this.hd = _controller.hd;
			_this.bullet = _controller.bullet;
			_this.fullpage = _controller.fullpage;
			_this.fullscreen = _controller.fullscreen;
			
			_this.getState = _model.getState;
			
			_this.resize = _view.resize;
		}
		
		_this.setup = function() {
			setTimeout(function() {
				_view.setup();
			}, 0);
		};
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_this.destroy = function() {
			if (_controller) {
				_controller.stop();
			}
			if (_view) {
				_view.destroy();
			}
			if (_model) {
				_model.destroy();
			}
		};
		
		_init();
	};
})(playease);

(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		states = core.states;
	
	core.model = function(config) {
		 var _this = utils.extend(this, new events.eventdispatcher('core.model')),
		 	_defaults = {},
		 	_state = states.STOPPED,
		 	_properties;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_properties = {
				sources: config.sources,
				muted: false,
				volume: 80,
				bullet: true,
				fullpage: false,
				fullscreen: false
			};
		}
		
		_this.setState = function(state) {
			if (state === _state) {
				return;
			}
			_state = state;
			_this.dispatchEvent(events.PLAYEASE_STATE, { state: state });
		};
		
		_this.getState = function() {
			return _state;
		};
		
		_this.setProperty = function(key, value) {
			if (_properties.hasOwnProperty(key) == true) {
				_properties[key] = value;
				_this.dispatchEvent(events.PLAYEASE_PROPERTY, { key: key, value: value });
			}
		};
		
		_this.getProperty = function(key) {
			return _properties[key];
		};
		
		_this.getConfig = function(name) {
			return _this.config[name] || {};
		};
		
		_this.destroy = function() {
			
		};
		
		_init();
	};
})(playease);

(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		states = core.states,
		renders = core.renders,
		rendermodes = renders.modes,
		components = core.components,
		skins = core.skins,
		skinmodes = skins.modes,
		css = utils.css,
		
		WRAP_CLASS = 'pla-wrapper',
		SKIN_CLASS = 'pla-skin',
		RENDER_CLASS = 'pla-render',
		BULLET_CLASS = 'pla-bullet',
		CONTROLS_CLASS = 'pla-controls',
		CONTEXTMENU_CLASS = 'pla-contextmenu';
	
	core.view = function(entity, model) {
		var _this = utils.extend(this, new events.eventdispatcher('core.view')),
			_wrapper,
			_renderLayer,
			_bulletLayer,
			_controlsLayer,
			_contextmenuLayer,
			_render,
			_controlbar,
			_skin,
			_video,
			_timer,
			_errorOccurred = false;
		
		function _init() {
			SKIN_CLASS += '-' + model.config.skin.name;
			_wrapper = utils.createElement('div', WRAP_CLASS + ' ' + SKIN_CLASS + (model.config.type === 'vod' ? ' vod' : ''));
			_wrapper.id = entity.id;
			_wrapper.tabIndex = 0;
			
			_renderLayer = utils.createElement('div', RENDER_CLASS);
			_bulletLayer = utils.createElement('div', BULLET_CLASS);
			_controlsLayer = utils.createElement('div', CONTROLS_CLASS);
			_contextmenuLayer = utils.createElement('div', CONTEXTMENU_CLASS);
			
			_wrapper.appendChild(_renderLayer);
			_wrapper.appendChild(_bulletLayer);
			_wrapper.appendChild(_controlsLayer);
			_wrapper.appendChild(_contextmenuLayer);
			
			_initRender();
			_initComponents();
			_initSkin();
			
			var replace = document.getElementById(entity.id);
			replace.parentNode.replaceChild(_wrapper, replace);
			
			window.onresize = function() {
				if (utils.typeOf(model.config.onresize) == 'function') {
					model.config.onresize.call(null);
				}
			};
		}
		
		function _initRender() {
			var cfg = utils.extend({}, model.getConfig('render'), {
				id: entity.id,
				url: model.config.url,
				width: model.config.width,
				height: model.config.height,
				controls: model.config.controls,
				autoplay: model.config.autoplay,
				playsinline: model.config.playsinline,
				poster: model.config.poster,
				loader: {
					mode: model.config.cors
				}
			});
			
			try {
				_render = _this.render = new renders[cfg.name](_this, cfg);
				_render.addEventListener(events.PLAYEASE_READY, _forward);
				_render.addEventListener(events.PLAYEASE_RENDER_ERROR, _onRenderError);
			} catch (err) {
				utils.log('Failed to init render ' + cfg.name + '!');
			}
			
			if (_render) {
				_video = _render.element();
				_video.addEventListener('loadstart', _onLoading);
				_video.addEventListener('durationchange', _onDurationChange);
				_video.addEventListener('ended', _onEnded);
				_video.addEventListener('error', _onError);
				
				_renderLayer.appendChild(_video);
			}
		}
		
		function _onLoading(e) {
			_startTimer();
		}
		
		function _onDurationChange(e) {
			var duration = _video.duration;
			_controlbar.setDuration(duration);
			utils.addClass(_wrapper, 'vod');
		}
		
		function _updateElapsed(e) {
			var elapsed = _video.currentTime;
			_controlbar.setElapsed(elapsed);
			_controlbar.setProgress(elapsed, _video.duration);
			
			var ranges = _video.buffered;
			for (var i = 0; i < ranges.length; i++) {
				var start = ranges.start(i);
				var end = ranges.end(i);
				if (start <= elapsed && elapsed < end) {
					_controlbar.setBuffered(end, _video.duration);
				}
			}
		}
		
		function _onEnded(e) {
			_stopTimer();
		}
		
		function _onError(e) {
			_stopTimer();
		}
		
		function _startTimer() {
			if (!_timer) {
				_timer = new utils.timer(500);
				_timer.addEventListener(events.PLAYEASE_TIMER, _updateElapsed);
			}
			_timer.start();
		}
		
		function _stopTimer() {
			if (_timer) {
				_timer.stop();
			}
		}
		
		function _initComponents() {
			try {
				_controlbar = new components.controlbar(_controlsLayer, { wrapper: entity.id });
				_controlbar.addGlobalListener(_forward);
				
				_controlbar.setVolume(model.getProperty('volume'));
			} catch (err) {
				utils.log('Failed to init controlbar!');
			}
		}
		
		function _initSkin() {
			var cfg = utils.extend({}, model.getConfig('skin'), {
				id: entity.id,
				width: model.config.width,
				height: model.config.height
			});
			
			try {
				_skin = new skins[cfg.name](cfg);
			} catch (err) {
				utils.log('Failed to init skin ' + cfg.name + '!');
			}
		}
		
		_this.setup = function() {
			if (!_render) {
				_this.dispatchEvent(events.PLAYEASE_SETUP_ERROR, { message: 'Render not available!', name: model.config.render.name });
				return;
			}
			_render.setup();
			
			// Ignore skin failure.
			
			try {
				_wrapper.addEventListener('keydown', _onKeyDown);
			} catch (err) {
				_wrapper.attachEvent('onkeydown', _onKeyDown);
			}
		};
		
		_this.play = function(url) {
			utils.addClass(_wrapper, 'playing');
			_render.play(url);
		};
		
		_this.pause = function() {
			utils.removeClass(_wrapper, 'playing');
			_render.pause();
		};
		
		_this.reload = function() {
			utils.addClass(_wrapper, 'playing');
			_render.reload();
		};
		
		_this.seek = function(offset) {
			utils.addClass(_wrapper, 'playing');
			_controlbar.setProgress(offset, 100);
			_render.seek(offset);
		};
		
		_this.stop = function() {
			utils.removeClass(_wrapper, 'playing');
			_controlbar.setDuration(0);
			_controlbar.setElapsed(0);
			_controlbar.setProgress(0, 1);
			_controlbar.setBuffered(0, 1);
			_render.stop();
		};
		
		_this.report = function() {
			
		};
		
		_this.mute = function(muted) {
			_controlbar.setMuted(muted, model.getProperty('volume'));
			_render.mute(muted);
		};
		
		_this.volume = function(vol) {
			_controlbar.setVolume(vol);
			_render.volume(vol);
		};
		
		_this.bullet = function(bullet) {
			_controlbar.setBullet(bullet);
		};
		
		_this.fullpage = function(exit) {
			if (document.webkitIsFullScreen) {
				document.exitFullscreen = document.exitFullscreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || document.msExitFullscreen;
				if (!document.exitFullscreen) {
					return;
				}
				
				document.exitFullscreen();
				utils.removeClass(_wrapper, 'fs');
			}
			
			if (exit) {
				utils.removeClass(_wrapper, 'fp');
			} else {
				utils.addClass(_wrapper, 'fp');
			}
		};
		
		_this.fullscreen = function(exit) {
			if (exit) {
				document.exitFullscreen = document.exitFullscreen || document.webkitCancelFullScreen || document.mozCancelFullScreen || document.msExitFullscreen;
				if (!document.exitFullscreen) {
					_this.fullpage(exit);
					return;
				}
				
				document.exitFullscreen();
				utils.removeClass(_wrapper, 'fs');
			} else {
				_wrapper.requestFullscreen = _wrapper.requestFullscreen || _wrapper.webkitRequestFullScreen || _wrapper.mozRequestFullScreen || _wrapper.msRequestFullscreen;
				if (!_wrapper.requestFullscreen) {
					_this.fullpage(exit);
					return;
				}
				
				_wrapper.requestFullscreen();
				utils.addClass(_wrapper, 'fs');
			}
		};
		
		function _onKeyDown(e) {
			if (e.ctrlKey || e.metaKey) {
				return true;
			}
			
			switch (e.keyCode) {
				case 13: // enter
					
					break;
				case 32: // space
					
					break;
				default:
					break;
			}
			
			if (/13|32/.test(e.keyCode)) {
				// Prevent keypresses from scrolling the screen
				e.preventDefault ? e.preventDefault() : e.returnValue = false;
				return false;
			}
		}
		
		_this.display = function(icon, message) {
			
		};
		
		_this.resize = function(width, height) {
			if (_render) 
				_render.resize(width, height);
		};
		
		_this.destroy = function() {
			if (_wrapper) {
				try {
					_wrapper.removeEventListener('keydown', _onKeyDown);
				} catch (e) {
					_wrapper.detachEvent('onkeydown', _onKeyDown);
				}
			}
			if (_render) {
				_render.destroy();
			}
		};
		
		function _onRenderError(e) {
			_forward(e);
		}
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_init();
	};
})(playease);

(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		states = core.states;
	
	core.controller = function(model, view) {
		var _this = utils.extend(this, new events.eventdispatcher('core.controller')),
			_ready = false;
		
		function _init() {
			model.addEventListener(events.PLAYEASE_STATE, _modelStateHandler);
			
			view.addEventListener(events.PLAYEASE_READY, _onReady);
			view.addEventListener(events.PLAYEASE_SETUP_ERROR, _onSetupError);
			
			view.addEventListener(events.PLAYEASE_VIEW_PLAY, _onPlay);
			view.addEventListener(events.PLAYEASE_VIEW_PAUSE, _onPause);
			view.addEventListener(events.PLAYEASE_VIEW_RELOAD, _onReload);
			view.addEventListener(events.PLAYEASE_VIEW_SEEK, _onSeek);
			view.addEventListener(events.PLAYEASE_VIEW_STOP, _onStop);
			view.addEventListener(events.PLAYEASE_VIEW_REPORT, _onReport);
			view.addEventListener(events.PLAYEASE_VIEW_MUTE, _onMute);
			view.addEventListener(events.PLAYEASE_VIEW_VOLUME, _onVolume);
			view.addEventListener(events.PLAYEASE_VIEW_HD, _onHD);
			view.addEventListener(events.PLAYEASE_VIEW_BULLET, _onBullet);
			view.addEventListener(events.PLAYEASE_VIEW_FULLPAGE, _onFullpage);
			view.addEventListener(events.PLAYEASE_VIEW_FULLSCREEN, _onFullscreen);
			
			view.addEventListener(events.PLAYEASE_RENDER_ERROR, _onRenderError);
			
			_initializeAPI();
		}
		
		function _initializeAPI() {
			_this.report = view.report;
			_this.fullpage = view.fullpage;
			_this.fullscreen = view.fullscreen;
		}
		
		_this.play = function(url) {
			model.setState(states.PLAYING);
			view.play(url);
		};
		
		_this.pause = function() {
			model.setState(states.PAUSED);
			view.pause();
		};
		
		_this.reload = function() {
			model.setState(states.PLAYING);
			view.play();
		};
		
		_this.seek = function(offset) {
			model.setState(states.PLAYING);
			view.seek(offset);
		};
		
		_this.stop = function() {
			model.setState(states.STOPPED);
			view.stop();
		};
		
		_this.mute = function() {
			var muted = model.getProperty('muted');
			model.setProperty('muted', !muted);
			view.mute(!muted);
		};
		
		_this.volume = function(vol) {
			model.setProperty('volume', vol);
			view.volume(vol);
		};
		
		_this.bullet = function() {
			var bullet = model.getProperty('bullet');
			model.setProperty('bullet', !bullet);
			view.bullet(!bullet);
		};
		
		_this.hd = function(index) {
			var sources = model.getProperty('sources');
			if (!sources || !sources[index]) {
				return;
			}
			
			_this.play(sources[index]);
		};
		
		function _modelStateHandler(e) {
			switch (e.state) {
				case states.BUFFERING:
					_this.dispatchEvent(events.PLAYEASE_BUFFER);
					break;
				case states.PLAYING:
					_this.dispatchEvent(events.PLAYEASE_PLAY);
					break;
				case states.PAUSED:
					_this.dispatchEvent(events.PLAYEASE_PAUSE);
					break;
				case states.SEEKING:
					_this.dispatchEvent(events.PLAYEASE_SEEK);
					break;
				case states.STOPPED:
					_this.dispatchEvent(events.PLAYEASE_STOP);
					break;
				case states.ERROR:
					// do nothing here.
					break;
				default:
					_this.dispatchEvent(events.ERROR, { message: 'Unknown model state!', state: e.state });
					break;
			}
		}
		
		function _onReady(e) {
			if (!_ready) {
				utils.log('Player ready!');
				
				_ready = true;
				_forward(e);
				
				if (model.config.autoplay) {
					_this.play();
				}
				
				window.onbeforeunload = function(ev) {
					
				};
			}
		}
		
		function _onPlay(e) {
			var state = model.getState();
			if (state == states.PAUSED || state == states.STOPPED || state == states.ERROR) {
				_this.play();
				_forward(e);
			}
		}
		
		function _onPause(e) {
			var state = model.getState();
			if (state == states.BUFFERING || state == states.PLAYING || state == states.ERROR) {
				_this.pause();
				_forward(e);
			}
		}
		
		function _onReload(e) {
			model.setState(states.BUFFERING);
			_this.reload();
			_forward(e);
		}
		
		function _onSeek(e) {
			var state = model.getState();
			if (state != states.SEEKING) {
				_this.seek(e.offset);
				_forward(e);
			}
		}
		
		function _onStop(e) {
			_this.stop();
			_forward(e);
		}
		
		function _onReport(e) {
			_this.report();
			_forward(e);
		}
		
		function _onMute(e) {
			_this.mute();
			_forward(e);
		}
		
		function _onVolume(e) {
			_this.volume(e.volume);
			_forward(e);
		}
		
		function _onHD(e) {
			
		}
		
		function _onBullet(e) {
			_this.bullet();
			_forward(e);
		}
		
		function _onFullpage(e) {
			var fp = model.getProperty('fullpage');
			_this.fullpage(fp);
			_forward(e);
			
			model.setProperty('fullpage', !fp);
		}
		
		function _onFullscreen(e) {
			var fs = model.getProperty('fullscreen');
			_this.fullscreen(fs);
			_forward(e);
			
			model.setProperty('fullscreen', !fs);
		}
		
		function _onSetupError(e) {
			model.setState(states.ERROR);
			_forward(e);
		}
		
		function _onRenderError(e) {
			model.setState(states.ERROR);
			_forward(e);
		}
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_init();
	};
})(playease);

(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		renderModes = playease.core.renders.modes;
	
	var embed = playease.embed = function(api) {
		var _this = utils.extend(this, new events.eventdispatcher('embed')),
			_config = {},
			_errorOccurred = false,
			_embedder = null;
		
		function _init() {
			utils.foreach(api.config.events, function(e, cb) {
				var fn = api[e];
				if (utils.typeOf(fn) === 'function') {
					fn.call(api, cb);
				}
			});
		}
		
		_this.embed = function() {
			try {
				_config = new embed.config(api.config);
				_embedder = new embed.embedder(api, _config);
			} catch (e) {
				utils.log('Failed to init embedder!');
				_this.dispatchEvent(events.PLAYEASE_SETUP_ERROR, { message: 'Failed to init embedder!', render: _config.render.name });
				return;
			}
			_embedder.addGlobalListener(_onEvent);
			_embedder.embed();
		};
		
		_this.errorScreen = function(message) {
			if (_errorOccurred) {
				return;
			}
			
			_errorOccurred = true;
			playease.api.displayError(message, _config);
		};
		
		function _onEvent(e) {
			switch (e.type) {
				case events.ERROR:
				case events.PLAYEASE_SETUP_ERROR:
				case events.PLAYEASE_RENDER_ERROR:
				case events.PLAYEASE_ERROR:
					_this.errorScreen(e.message);
					_this.dispatchEvent(events.ERROR, e);
					break;
				default:
					_forward(e);
					break;
			}
		}
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_init();
	};
})(playease);

(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		embed = playease.embed,
		rendermodes = playease.core.renders.modes,
		skinmodes = playease.core.skins.modes,
		
		sourcetypes = {
			LIVE: 'live',
			VOD:  'vod'
		};
	
	embed.config = function(config) {
		var _defaults = {
			url: 'http://' + window.location.host + '/vod/sample.mp4',
			width: 640,
			height: 360,
			sources: [],
			type: sourcetypes.LIVE,
			cors: 'no-cors',
			bufferTime: .1,
			controls: true,
			autoplay: true,
			playsinline: true,
			poster: '',
			render: {
				name: rendermodes.DEFAULT
			},
			skin: {
				name: skinmodes.DEFAULT
			}
		},
		
		_config = utils.extend({}, _defaults, config);
		
		return _config;
	};
	
	embed.config.addConfig = function(oldConfig, newConfig) {
		return utils.extend(oldConfig, newConfig);
	};
})(playease);

(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		embed = playease.embed,
		core = playease.core;
	
	embed.embedder = function(api, config) {
		var _this = utils.extend(this, new events.eventdispatcher('embed.embedder'));
		
		_this.embed = function() {
			var entity = new core.entity(config);
			entity.addGlobalListener(_onEvent);
			entity.setup();
			api.setEntity(entity, config.render.name);
		};
		
		function _onEvent(e) {
			_forward(e);
		}
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
	};
})(playease);
