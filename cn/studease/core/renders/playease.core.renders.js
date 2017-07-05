(function(playease) {
	var renders = playease.core.renders = {};
	
	renders.types = {
		DEFAULT: 'def',
		FLV:     'flv',
		WSS:     'wss',
		FLASH:   'flash'
	},
	
	renders.priority = ['def', 'flv', 'wss', 'flash'],
	
	renders.modes = {
		LIVE: 'live',
		VOD:  'vod'
	};
})(playease);
