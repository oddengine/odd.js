(function(playease) {
	var renders = playease.core.renders;
	
	renders.modes = {
		DEFAULT: 'def',
		FLV: 'flv',
		WSS: 'wss',
		FLASH: 'flash'
	};
	
	renders.priority = ['def', 'flv', 'wss', 'flash'];
})(playease);
