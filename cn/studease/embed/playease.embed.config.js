(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		embed = playease.embed,
		rendermodes = playease.core.renders.modes,
		skinmodes = playease.core.skins.modes;
	
	embed.config = function(config) {
		var _defaults = {
			url: 'http://' + window.location.host + '/vod/sample.mp4',
			width: 640,
			height: 360,
			cors: 'no-cors',
			bufferTime: .1,
			controls: true,
			autoplay: true,
			poster: null,
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
