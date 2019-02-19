(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		embed = playease.embed,
		io = playease.io,
		core = playease.core,
		renderModes = core.renders.modes,
		renderTypes = core.renders.types,
		skinTypes = core.skins.types;
	
	embed.config = function(config) {
		var _defaults = {
			width: 640,
			height: 400,
			aspectratio: '16:9',
			file: '',
			sources: [],
			mode: renderModes.VOD,
			bufferTime: .1,
			maxRetries: 0,
			retryDelay: 3000,
			controls: true,
			autoplay: true,
			airplay: 'allow',
			playsinline: true,
			poster: '',
			report: false,
			debug: false,
			loader: {
				//name: 'xhr-chunked-loader', // For flv render in vod mode only. Otherwise, don't name it out.
				//chunkSize: 2 * 1024 * 1024, // For xhr-chunked-loader only
				mode: io.modes.CORS
			},
			logo: {
				visible: true
			},
			bulletCurtain: {
				enable: true,
				visible: false
			},
			fullpage: {
				visible: false
			},
			render: {
				name: renderTypes.DEFAULT,
				//bufferLength: 4 * 1024 * 1024, // For flv render in vod mode only
				swf: 'swf/playease.swf'
			},
			skin: {
				name: skinTypes.DEFAULT
			},
			events: {
				
			}
		},
		
		_config = utils.extend({}, _defaults, config);
		
		return _config;
	};
	
	embed.config.addConfig = function(oldConfig, newConfig) {
		return utils.extend(oldConfig, newConfig);
	};
})(playease);
