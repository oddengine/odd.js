(function(playease) {
	var renders = playease.core.renders = {};
	
	renders.types = {
		DEFAULT:  'def',
		FLV:      'flv',
		FMP4:     'fmp4',
		WSS:      'wss',
		DASH:     'dash',
		FLASH:    'flash'
	},
	
	renders.priority = [
		renders.types.DEFAULT,
		renders.types.FLV,
		renders.types.FMP4,
		renders.types.WSS,
		renders.types.DASH,
		renders.types.FLASH
	],
	
	renders.modes = {
		LIVE: 'live',
		VOD:  'vod'
	};
})(playease);
