(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		embed = playease.embed,
		core = playease.core,
		alphas = core.components.bulletscreen.alphas,
		positions = core.components.bulletscreen.positions,
		rendertypes = core.renders.types,
		rendermodes = core.renders.modes,
		skinmodes = core.skins.modes;
	
	embed.config = function(config) {
		var _defaults = {
			width: 640,
			height: 400,
			file: '',
			sources: [],
			type: rendertypes.VOD,
			cors: 'no-cors',
			bufferTime: .1,
			controls: true,
			autoplay: true,
			airplay: 'allow',
			playsinline: true,
			poster: '',
			report: true,
			debug: false,
			bulletscreen: {
				enable: true,
				fontsize: 14,
				alpha: alphas.LOW,
				position: positions.FULLSCREEN,
				visible: true
			},
			render: {
				name: rendermodes.DEFAULT,
				swf: 'swf/playease.swf'
			},
			skin: {
				name: skinmodes.DEFAULT
			},
			events: {}
		},
		
		_config = utils.extend({}, _defaults, config);
		
		return _config;
	};
	
	embed.config.addConfig = function(oldConfig, newConfig) {
		return utils.extend(oldConfig, newConfig);
	};
})(playease);
