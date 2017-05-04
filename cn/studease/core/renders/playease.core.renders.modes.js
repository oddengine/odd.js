(function(playease) {
	var renders = playease.core.renders;
	
	renders.modes = {
		DEFAULT: 'def',
		FLV: 'flv',
		FLASH: 'flash'
	};
	
	renders.priority = ['def', 'flv', 'flash'];
})(playease);
