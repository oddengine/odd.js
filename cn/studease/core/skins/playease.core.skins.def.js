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
				'margin-left': '4px',
				width: '26px',
				height: '40px',
				background: 'url(/webplayer/playease/skins/reloadButton.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plreload:hover', {
				background: 'url(/webplayer/playease/skins/reloadButtonOver.png) no-repeat center'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plstop', {
				'margin-left': '4px',
				width: '26px',
				height: '40px',
				display: CSS_NONE,
				background: 'url(/webplayer/playease/skins/stopButton.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plstop:hover', {
				background: 'url(/webplayer/playease/skins/stopButtonOver.png) no-repeat center'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plelapsed', {
				'margin-left': '8px'
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
				'margin-right': '8px',
				width: '20px',
				height: '40px',
				background: 'url(/webplayer/playease/skins/reportButton.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plreport:hover', {
				background: 'url(/webplayer/playease/skins/reportButtonOver.png) no-repeat center'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plvolume', {
				'margin-right': '4px',
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
				margin: '15px 8px 0 0',
				width: '60px',
				height: '12px',
				position: CSS_RELATIVE
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plslider.volume .plrail', {
				width: CSS_100PCT,
				height: '4px',
				position: CSS_ABSOLUTE,
				top: '4px'
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
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plslider.volume .plthumb', {
				width: '10px',
				height: '12px',
				position: CSS_ABSOLUTE,
				background: 'url(/webplayer/playease/skins/volumeSliderThumb.png) no-repeat center'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plhd', {
				'margin-right': '8px',
				width: '48px',
				height: '40px',
				background: 'url(/webplayer/playease/skins/hdButton.png) no-repeat center'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plhd:hover', {
				background: 'url(/webplayer/playease/skins/hdButtonOver.png) no-repeat center'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plbullet', {
				'margin-right': '8px',
				width: '58px',
				height: '40px',
				background: 'url(/webplayer/playease/skins/bulletButton.png) no-repeat center'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plbullet.off', {
				background: 'url(/webplayer/playease/skins/bulletOffButton.png) no-repeat center'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .plfullpage', {
			'margin-right': '8px',
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
				'margin-right': '8px',
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
				'margin-right': '8px',
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
				'margin-right': '8px',
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
