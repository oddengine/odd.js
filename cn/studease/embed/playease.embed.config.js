(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		embed = playease.embed,
		renderModes = playease.core.renders.modes,
		skinModes = playease.core.renders.skins.modes;
	
	embed.config = function(config) {
		var _defaults = {
			url: 'http://' + window.location.host + '/vod/sample.flv',
			width: 640,
			height: 360,
			cors: 'no-cors',
			bufferTime: .1,
			controls: true,
			autoplay: true,
			poster: null,
			render: {
				name: renderModes.DEFAULT,
				skin: {
					name: skinModes.DEFAULT
				}
			}
		},
		
		_config = utils.extend({}, _defaults, config);
		
		return _config;
	};
	
	embed.config.addConfig = function(oldConfig, newConfig) {
		return utils.extend(oldConfig, newConfig);
	};
})(playease);
