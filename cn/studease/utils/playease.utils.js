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
	
	utils.typeOf = function(value) {
		if (value === null || value === undefined) {
			return 'null';
		}
		
		var typeofString = typeof value;
		if (typeofString === 'object') {
			try {
				var str = Object.prototype.toString.call(value);
				var arr = str.match(/^\[object ([a-z]+)\]$/i);
				if (arr && arr.length > 1 && arr[1]) {
					return arr[1].toLowerCase();
				}
			} catch (err) {
				/* void */
			}
		}
		
		return typeofString;
	};
	
	utils.isInt = function(value) {
		return parseFloat(value) % 1 === 0;
	};
	
	utils.trim = function(inputString) {
		return inputString.replace(/^\s+|\s+$/g, '');
	};
	
	utils.indexOf = function(array, item) {
		if (array == null) {
			return -1;
		}
		
		for (var i = 0; i < array.length; i++) {
			if (array[i] === item) {
				return i;
			}
		}
		
		return -1;
	};
	
	
	/* DOM */
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
	
	utils.hasClass = function(element, classes) {
		var originalClasses = element.className || '';
		var hasClasses = utils.typeOf(classes) === 'array' ? classes : classes.split(' ');
		
		for (var i = 0; i < hasClasses.length; i++) {
			var re = new RegExp('\\b' + hasClasses[i] + '\\b', 'i');
			if (originalClasses.search(re) == -1) {
				return false;
			}
		}
		
		return true;
	};
	
	utils.removeClass = function(element, classes) {
		var originalClasses = utils.typeOf(element.className) === 'string' ? element.className.split(' ') : [];
		var removeClasses = utils.typeOf(classes) === 'array' ? classes : classes.split(' ');
		
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
	
	
	/* Browser */
	utils.isMSIE = function(version) {
		version = version || '';
		return _userAgentMatch(new RegExp('MSIE\\s*' + version, 'i'));
	};
	
	utils.isIETrident = function() {
		return _userAgentMatch(/trident\/.+rv:\s*11/i);
	};
	
	utils.isEdge = function(version) {
		version = version || '';
		return _userAgentMatch(new RegExp('\\sEdge\\/' + version, 'i'));
	};
	
	utils.isMac = function(version) {
		version = version || '';
		return _userAgentMatch(new RegExp('\\sMac OS X ' + version, 'i'));
	};
	
	utils.isSafari = function(version) {
		version = version || '';
		return _userAgentMatch(new RegExp('\\sSafari\\/' + version, 'i'))
				&& !_userAgentMatch(/Chrome/i) && !_userAgentMatch(/Chromium/i) && !_userAgentMatch(/Android/i);
	};
	
	utils.isIOS = function(version) {
		version = version || '';
		return _userAgentMatch(new RegExp('iP(hone|ad|od).+\\sOS\\s' + version, 'i'));
	};
	
	utils.isAndroid = function(version, excludeChrome) {
		//Android Browser appears to include a user-agent string for Chrome/18
		if (excludeChrome && _userAgentMatch(/Chrome\/[123456789]/i) && !_userAgentMatch(/Chrome\/18/)) {
			return false;
		}
		
		version = version || '';
		return _userAgentMatch(new RegExp('Android\\s*' + version, 'i'));
	};
	
	utils.isMobile = function() {
		return utils.isIOS() || utils.isAndroid();
	};
	
	utils.isFirefox = function(version) {
		version = version || '';
		return _userAgentMatch(new RegExp('Firefox\\/' + version, 'i'));
	};
	
	utils.isChrome = function(version) {
		version = version || '';
		return _userAgentMatch(new RegExp('\\s(?:Chrome|CriOS)\\/' + version, 'i')) && !utils.isEdge();
	};
	
	utils.isSogou = function(version) {
		version = version || '';
		return _userAgentMatch(new RegExp('MetaSr\\s' + version, 'i'));
	};
	
	utils.isWeixin = function(version) {
		version = version || '';
		return _userAgentMatch(new RegExp('MicroMessenger\\/' + version, 'i'));
	};
	
	utils.isQQBrowser = function(version) {
		version = version || '';
		return _userAgentMatch(new RegExp('QQBrowser\\/' + version, 'i'));
	};
	
	function _userAgentMatch(regex) {
		var agent = navigator.userAgent.toLowerCase();
		return (agent.match(regex) !== null);
	};
	
	utils.isHorizontal = function() {
		if (window.orientation != undefined) {
			return (window.orientation == 90 || window.orientation == -90);
		} else {
			return window.innerWidth > window.innerHeight;
		}
	};
	
	utils.getFlashVersion = function() {
		if (utils.isAndroid()) {
			return 0;
		}
		
		var plugins = navigator.plugins, flash;
		if (plugins) {
			flash = plugins['Shockwave Flash'];
			if (flash && flash.description) {
				var version = flash.description.replace(/\D+(\d+\.?\d*).*/, '$1');
				return parseFloat(version);
			}
		}
		
		if (typeof window.ActiveXObject !== 'undefined') {
			try {
				flash = new window.ActiveXObject('ShockwaveFlash.ShockwaveFlash');
				if (flash) {
					var version = flash.GetVariable('$version').split(' ')[1].replace(/\s*,\s*/, '.')
					return parseFloat(version);
				}
			} catch (err) {
				return 0;
			}
			
			return flash;
		}
		
		return 0;
	};
	
	
	/* protocol & extension */
	utils.getProtocol = function(url) {
		var protocol = 'http';
		
		var arr = url.match(/^([a-z]+)\:\/\//i);
		if (arr && arr.length > 1) {
			protocol = arr[1];
		}
		
		return protocol;
	};
	
	utils.getOrigin = function(file) {
		var origin = '';
		
		var arr = file.match(/^[a-z]+\:\/\/([a-z0-9\-.:])\//i);
		if (arr && arr.length > 1) {
			origin = arr[1];
		}
		
		return origin;
	};
	
	utils.getFileName = function(file) {
		var name = '';
		
		var arr = file.match(/\/([a-z0-9\(\)\[\]\{\}\s\-_%]*(\.[a-z0-9]+)?)$/i);
		if (arr && arr.length > 1) {
			name = arr[1];
		}
		
		return name;
	};
	
	utils.getExtension = function(file) {
		var extension = '';
		
		var arr = file.match(/\/?([a-z0-9\(\)\[\]\{\}\s\-_%]*(\.([a-z0-9]+))*)\??([a-z0-9\.\-_%&=]*)$/i);
		if (arr && arr.length > 3) {
			extension = arr[3];
		}
		
		return extension;
	};
	
	
	/* Logger */
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
