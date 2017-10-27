(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		states = core.states,
		rendermodes = core.renders.modes,
		skins = core.skins,
		skintypes = skins.types,
		css = utils.css,
		
		WRAP_CLASS = 'pe-wrapper',
		SKIN_CLASS = 'pe-skin',
		RENDER_CLASS = 'pe-render',
		CONTROLS_CLASS = 'pe-controls',
		CONTEXTMENU_CLASS = 'pe-contextmenu',
		
		POSTER_CLASS = 'pe-poster',
		DISPLAY_CLASS = 'pe-display',
		DISPLAY_ICON_CLASS = 'pe-display-icon',
		DISPLAY_LABEL_CLASS = 'pe-display-label',
		LOGO_CLASS = 'pe-logo',
		OVERLAY_CLASS = 'pe-overlay',
		
		LEFT_CLASS = 'pe-left',
		CENTER_CLASS = 'pe-center',
		RIGHT_CLASS = 'pe-right',
		
		DEVIDER_CLASS = 'pe-devider',
		LABEL_CLASS = 'pe-label',
		BUTTON_CLASS = 'pe-button',
		SLIDER_CLASS = 'pe-slider',
		RAIL_CLASS = 'pe-rail',
		THUMB_CLASS = 'pe-thumb',
		
		TOOLTIP_CLASS = 'pe-tooltip',
		TOOLTIP_ITEM_CLASS = 'pe-tooltip-item',
		
		FEATURED_CLASS = 'pe-featured',
		
		// For all api instances
		CSS_SMOOTH_EASE = 'opacity .25s ease',
		CSS_100PCT = '100%',
		CSS_ABSOLUTE = 'absolute',
		CSS_RELATIVE = 'relative',
		CSS_NORMAL = 'normal',
		CSS_IMPORTANT = ' !important',
		CSS_VISIBLE = 'visible',
		CSS_HIDDEN = 'hidden',
		CSS_NONE = 'none',
		CSS_BOLD = 'bold',
		CSS_CENTER = 'center',
		CSS_BLOCK = 'block',
		CSS_INLINE_BLOCK = 'inline-block',
		CSS_DEFAULT = 'default',
		CSS_POINTER = 'pointer',
		CSS_NO_REPEAT = 'no-repeat',
		CSS_NOWRAP = 'nowrap';
	
	skins.def = function(config) {
		var _this = utils.extend(this, new events.eventdispatcher('skins.def')),
			_width = config.width,
			_height = config.height;
		
		function _init() {
			_this.name = skintypes.DEFAULT;
			
			SKIN_CLASS += '-' + _this.name;
			
			css('.' + WRAP_CLASS, {
				width: CSS_100PCT,
				height: CSS_100PCT,
				position: CSS_RELATIVE,
				'box-shadow': '0 1px 1px rgba(0, 0, 0, 0.05)'
			});
			css('.' + WRAP_CLASS + ' *', {
				margin: '0',
				padding: '0',
				'font-family': 'Microsoft YaHei,arial,sans-serif',
				'font-size': '12px',
				'font-weight': CSS_NORMAL,
				'box-sizing': 'content-box'
			});
			
			css('.' + SKIN_CLASS + ' .' + DEVIDER_CLASS, {
				padding: '0 2px',
				'line-height': '40px',
				color: '#FFFFFF',
				cursor: CSS_DEFAULT
			});
			
			css('.' + SKIN_CLASS + ' .' + LABEL_CLASS, {
				'line-height': '40px',
				color: '#FFFFFF',
				cursor: CSS_DEFAULT
			});
			
			css('.' + SKIN_CLASS + ' .' + BUTTON_CLASS, {
				'text-align': CSS_CENTER,
				'background-repeat': CSS_NO_REPEAT,
				'background-position': CSS_CENTER,
				cursor: CSS_POINTER
			});
			css('.' + SKIN_CLASS + ' .' + BUTTON_CLASS + ' > span', {
				padding: '3px 12px',
				color: '#FFFFFF',
				'line-height': '40px',
				'border-radius': '2px',
				background: '#454545'
			});
			css('.' + SKIN_CLASS + ' .' + BUTTON_CLASS + ':hover > span', {
				color: '#00A0E9'
			});
			
			css('.' + SKIN_CLASS + ' .' + SLIDER_CLASS, {
				cursor: CSS_POINTER
			});
			
			css('.' + SKIN_CLASS + ' .' + TOOLTIP_CLASS, {
				'line-height': '12px',
				color: '#FFFFFF',
				background: '#454545',
				cursor: CSS_DEFAULT,
				display: CSS_INLINE_BLOCK,
				visibility: CSS_HIDDEN
			});
			css('.' + SKIN_CLASS + ' .' + TOOLTIP_ITEM_CLASS, {
				'margin': '4px 0',
				padding: '8px 12px',
				'text-align': CSS_CENTER,
				'white-space': CSS_NOWRAP,
				cursor: CSS_POINTER
			});
			css('.' + SKIN_CLASS + ' .' + TOOLTIP_ITEM_CLASS + ':hover'
				+ ', .' + SKIN_CLASS + ' .' + TOOLTIP_ITEM_CLASS + '.active', {
				background: '#00A0E9'
			});
			
			css('.' + SKIN_CLASS + ' .' + RENDER_CLASS, {
				width: CSS_100PCT,
				height: 'calc(100% - 40px)',
				'font-size': '0',
				'line-height': '0',
				position: CSS_RELATIVE,
				background: '#000000'
			});
			css('.' + SKIN_CLASS + '.fs .' + RENDER_CLASS, {
				height: CSS_100PCT
			});
			css('.' + SKIN_CLASS + ' .' + RENDER_CLASS + ' canvas', {
				position: CSS_ABSOLUTE
			});
			css('.' + SKIN_CLASS + ' .' + RENDER_CLASS + ' video'
				+ ', .' + SKIN_CLASS + ' .' + RENDER_CLASS + ' object', {
				width: CSS_100PCT,
				height: CSS_100PCT,
				display: CSS_BLOCK
			});
			css('.' + SKIN_CLASS + ' .' + RENDER_CLASS + ' video::-webkit-media-controls-start-playback-button', {
				display: CSS_NONE
			});
			
			css('.' + SKIN_CLASS + ' .' + RENDER_CLASS + ' .' + POSTER_CLASS, {
				width: CSS_100PCT,
				height: CSS_100PCT,
				position: CSS_ABSOLUTE,
				background: '#000000'
			});
			css('.' + SKIN_CLASS + ' .' + RENDER_CLASS + ' .' + POSTER_CLASS + ' img', {
				width: CSS_100PCT,
				height: CSS_100PCT,
				position: CSS_ABSOLUTE
			});
			css('.' + SKIN_CLASS + '.' + states.BUFFERING + ' .' + RENDER_CLASS + ' .' + POSTER_CLASS
				+ ', .' + SKIN_CLASS + '.' + states.PLAYING + ' .' + RENDER_CLASS + ' .' + POSTER_CLASS
				+ ', .' + SKIN_CLASS + '.' + states.PAUSED + ' .' + RENDER_CLASS + ' .' + POSTER_CLASS, {
				display: CSS_NONE
			});
			css('.' + SKIN_CLASS + '.' + states.ERROR + ' .' + RENDER_CLASS + ' .' + POSTER_CLASS + ' img', {
				display: CSS_NONE
			});
			
			css('.' + SKIN_CLASS + ' .' + RENDER_CLASS + ' .' + DISPLAY_CLASS, {
				width: CSS_100PCT,
				height: CSS_100PCT,
				'text-align': CSS_CENTER,
				top: '0px',
				position: CSS_ABSOLUTE,
				overflow: CSS_HIDDEN,
				display: CSS_NONE,
				'z-index': '1'
			});
			css('.' + SKIN_CLASS + '.' + states.IDLE + ' .' + RENDER_CLASS + ' .' + DISPLAY_CLASS
				+ ', .' + SKIN_CLASS + '.' + states.BUFFERING + ' .' + RENDER_CLASS + ' .' + DISPLAY_CLASS
				+ ', .' + SKIN_CLASS + '.' + states.PLAYING + ' .' + RENDER_CLASS + ' .' + DISPLAY_CLASS
				+ ', .' + SKIN_CLASS + '.' + states.PAUSED + ' .' + RENDER_CLASS + ' .' + DISPLAY_CLASS
				+ ', .' + SKIN_CLASS + '.' + states.STOPPED + ' .' + RENDER_CLASS + ' .' + DISPLAY_CLASS
				+ ', .' + SKIN_CLASS + '.' + states.ERROR + ' .' + RENDER_CLASS + ' .' + DISPLAY_CLASS, {
				display: CSS_BLOCK
			});
			css('.' + SKIN_CLASS + ' .' + RENDER_CLASS + ' .' + DISPLAY_CLASS + ' .' + DISPLAY_ICON_CLASS, {
				margin: '0 auto',
				width: '48px',
				height: '48px',
				top: (_height - 40 - 48) / 2 + 'px',
				left: (_width - 48) / 2 + 'px',
				position: CSS_ABSOLUTE,
				'background-repeat': CSS_NO_REPEAT,
				'background-position': CSS_CENTER,
				display: CSS_INLINE_BLOCK
			});
			css('.' + SKIN_CLASS + ' .' + RENDER_CLASS + ' .' + DISPLAY_CLASS + ' .' + DISPLAY_LABEL_CLASS, {
				'margin-top': (_height - 40 - 32) / 2 + 'px',
				'font-size': '14px',
				'line-height': '32px',
				color: '#CCCCCC',
				'text-align': CSS_CENTER,
				display: CSS_NONE
			});
			css('.' + SKIN_CLASS + ' .' + RENDER_CLASS + ' .' + DISPLAY_CLASS + ' .' + DISPLAY_LABEL_CLASS + ' a', {
				'font-size': '14px',
				'font-weight': CSS_BOLD,
				color: '#FFFFFF'
			});
			css('.' + SKIN_CLASS + '.' + states.IDLE + ' .' + RENDER_CLASS + ' .' + DISPLAY_CLASS + ' .' + DISPLAY_ICON_CLASS
				+ ', .' + SKIN_CLASS + '.' + states.PAUSED + ' .' + RENDER_CLASS + ' .' + DISPLAY_CLASS + ' .' + DISPLAY_ICON_CLASS, {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwBAMAAAClLOS0AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAtUExURUxpcejo6Obm5ubm5ubm5u/v7+bm5ufn5+Xl5ebm5ubm5ufn5+bm5ubm5ubm5jSWEg4AAAAOdFJOUwA5vYDwEOBg0KBQIJBws1NytAAAAdRJREFUOMttVD1LglEUvq9hVhZINgSCFA0NQWRtDUJDCEEvDg1N0g+oF4mGJqkh2qS5IYJaWkT/QDg1RlNjVL6pmTy/oXO/77XO4HvOfe495zlfMqYluNvY2MywUUkehyCJl8v+efoGSr6b3n1zToj75gSO7NjzSW5/buZad6tcuzKO6mRdS/2B1L52tk/Gor41S8aF0uue33vyKrVpoOskFkRAW2gN+1Z7HojQIbpeuskIcVl62vLLMCd9PQJV+iRWDDAD/NDnRpJIYM0gdQzpN8SHBCy1PGLGpoAFCdjykX7L61RVBkoKSPF6jQNlDUARSAIHrKIKIABNoI4vCtRxAEWgSITePEARKKInQAfAruTb+QOIzvwL9Aww8IB+RnSiw2p+8PhFB8+LghlApvhM/ivoO8COTvCdTQBNAwxlGdPAGW/giwb6GdOpNgt4wSQQ61ZRYelKJJhzwDS3hq6g1pWAHbpIpLAni50YmhkaA7blh+eessPYUH2h+fJWLwhVavmRiaN5+9Cs46o9T4UqMz5y6JjIySK10dm0kruOZtf4zh4KAsET7AMRhQZkqZBdj+AHnHfX+dyl+GrPj/xlOdXnl6P/Mlmx+58F9lda2ULOWr8ERXrQBrGziQAAAABJRU5ErkJggg==)'
			});
			css('.' + SKIN_CLASS + '.' + states.IDLE + ' .' + RENDER_CLASS + ' .' + DISPLAY_CLASS + ' .' + DISPLAY_ICON_CLASS + ':hover'
				+ ', .' + SKIN_CLASS + '.' + states.PAUSED + ' .' + RENDER_CLASS + ' .' + DISPLAY_CLASS + ' .' + DISPLAY_ICON_CLASS + ':hover', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwBAMAAAClLOS0AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAtUExURUxpcQCg6QCf6ACg6QCf6wCf7wCg6QCg6ACg6gCf6gCf6QCf6QCf7wCf6QCg6cCd4h0AAAAOdFJOUwB8wPBAEKTgYDDQUCCQyqqJ9wAAAdhJREFUOMt1lD1LA0EQhtdgNNEIEUSRQLCwEUSwEBThSKwlBOwsRDtBCfoDPAKChUWI2FmIjaBNUARLSWEt6ezE5NTTxLy/wdnP201wi9zOPLszs/MRxvRK3o+PZ6qsd8VPPNAKdouuPlWCWl9157zRE7HvHMNaq5F+SJzMrD/fi5vbxlCNpD25f6RtWxvbJGFWn1oj4Vrta47dB6Ald2NAaD0s6QMNsXuK7mrLHeHaQ+g8N+4jKEpLK24azqWtF6BMn9i8AQPAL31KMogY0obU0KVfDx8ShDkNCggYGwVmJIjSR/s7nqeyErCsQILnaxgoagAVQBw4YFsqAQLoAGr4JEdNC6gAshRQ1gEqgCy+BbQAFmW8zT6Auf/AtwEdB7SrohJNVnGdB2ntvCASZsC+EN7I/hbaFljVD3xnI0DdgK5MYwq44gVMa9DOmUo12CBPmASBLhUllo74InIOTHErCEVooQRR0/niCRvSSaxbtJphSX742xOm4rwD0/Ji4Ixe0lNPu+zpOOq3H20yKEf6hGcqTGPUNJ7jWSqjNWnL9jiaWeOTdyQCSL4iuiC8UIPsTOQnfbgOL+xxvrVDnIr0h+6wnGr9Te+/zNkCV7emWf96zk+sR9If3YN+fNM6EiIAAAAASUVORK5CYII=)'
			});
			css('.' + SKIN_CLASS + '.' + states.BUFFERING + ' .' + RENDER_CLASS + ' .' + DISPLAY_CLASS + ' .' + DISPLAY_ICON_CLASS, {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAACaElEQVRYR8WXQW4aMRSG3wMjjVeBDZKfF0lPUHIC0hM03CCcoM0JmhuUnKDkBElPkPQEJSfobMYjsYGuQGKQq2d50HQy0GnAZCQ2g/H7nu3/9w/CGz+4q/50Ou21Wq240+nMQ3FWAnDhLMvuAeCMC1trx1rrYQiISoAkSSaI+L5U8JqIRoeGqAQwxtiKQj+I6OItAe6I6OooAEmS3CDil0Kx34jYU0rFRwHgIsaYSwC4tNbGjUZjHKI419kpw0N3WzWfAyjJLhZCDLrd7uRoAMYY3tvTvKC1dq617hwFwHf/s1wMET8opZ5CQ7gtqNK9lLIT0oLzxhxAmqZX1tpvm5eIQ6XUOHT3f6kgTVP2ff7EoSS3VQXH6LRYYzabtReLxb2UcrDxAb8NHwHgiYhuQ0Ox22qtbxxAhfU+ENEgNMTmDJR9gL8gomAuyTYvhIjZ7HIZst77xcuHiNqhVsDL3l3vRStmiBO3LIFlmKYp5wqnts0y88lcLpe9kDL0NdpFmW+LZJwHeEvmUsrhoRzRGMPh9gQR3+UQLwDKrggA34mIs8Hej8+aZ8Vw8wKgKg3tcyC9w/aVUne1nJAPiLX2sTDYZUE/0WkURc//syX5sgNAZarelopdHAOACUdxvrJXq9UjIrI0Yynl+TYIf8L7URTd8phXAZSXyhjD/wc+lW/LwvsREV3zKllrf/lx7uzkl9y2bFHL7YwxnwHgaw4ghDhfr9ft4lZxgGk2m/Msy1y4sdY+a61Z1jufWgA+tPAq8IR8T4xK3QJDsbV6FV0IIUZ1cmVtgKo28ujuoR7+1W0tFbxmkn1+8wdECS8NBZyNpgAAAABJRU5ErkJggg==)'
			});
			css('.' + SKIN_CLASS + '.' + states.STOPPED + ' .' + RENDER_CLASS + ' .' + DISPLAY_CLASS + ' .' + DISPLAY_ICON_CLASS, {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwBAMAAAClLOS0AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAnUExURUxpcebm5ubm5ufn5+fn5+bm5ubm5ujo6Obm5ubm5uXl5e/v7+bm5v4Cjk0AAAAMdFJOUwDAmSBi7IA9ULDQEGJkMtUAAAFESURBVDjLdVShUgMxEE17Nz0YEHQGDBOBoQgi7gMQeBAIBOIEg8FUVKEQGFwFKAQ1DLYCwQ8EOKCd91FN0lznst2NuMu9d3m72eyLUq1xpISxdyoQ+ksi8M6gd88VUD9QuDhEGFSs0Esc8zLBs4nD3gZO6zhd8AjMznzwyxTPnbaX0PUoJQxskNavKd4DDsJkl6Q0xs9ykmaksgp8jToQSjTGjlS6ksULSamLb57YxhNP3AvJqiE+eGIyFw56agWCy7b34onfdeK8FoghBCkDIbi2zYNmOuM3uBXiMiXJ8ccXcRMXfNlPQtcwB2UQGm9KjzaD5Zuhg3++fUz8kzZcjrokLRpLG5V8wrGpm69raoMgrFshu9E4HjetBSurKfXpzHjV3pI3bX9w03cvm2x3o0LjZ3IFFCZeAKP1K2PfWf129bkALBuQv4Z6ZbEAAAAASUVORK5CYII=)'
			});
			css('.' + SKIN_CLASS + '.' + states.STOPPED + ' .' + RENDER_CLASS + ' .' + DISPLAY_CLASS + ' .' + DISPLAY_ICON_CLASS + ':hover', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAwBAMAAAClLOS0AAAABGdBTUEAALGPC/xhBQAAAAFzUkdCAK7OHOkAAAAnUExURUxpcQCf6ACf6QCf7wCf6gCg6QCg6QCf6wCf6QCg6QCf6QCf7wCg6Ta1FVAAAAAMdFJOUwDAmSBi7IA9ULDQEGJkMtUAAAFESURBVDjLdVShUgMxEE17Nz0YEHQGDBOBoQgi7gMQeBAIBOIEg8FUVKEQGFwFKAQ1DLYCwQ8EOKCd91FN0lznst2NuMu9d3m72eyLUq1xpISxdyoQ+ksi8M6gd88VUD9QuDhEGFSs0Esc8zLBs4nD3gZO6zhd8AjMznzwyxTPnbaX0PUoJQxskNavKd4DDsJkl6Q0xs9ykmaksgp8jToQSjTGjlS6ksULSamLb57YxhNP3AvJqiE+eGIyFw56agWCy7b34onfdeK8FoghBCkDIbi2zYNmOuM3uBXiMiXJ8ccXcRMXfNlPQtcwB2UQGm9KjzaD5Zuhg3++fUz8kzZcjrokLRpLG5V8wrGpm69raoMgrFshu9E4HjetBSurKfXpzHjV3pI3bX9w03cvm2x3o0LjZ3IFFCZeAKP1K2PfWf129bkALBuQv4Z6ZbEAAAAASUVORK5CYII=)'
			});
			
			css('.' + SKIN_CLASS + ' .' + RENDER_CLASS + ' .' + LOGO_CLASS, {
				top: '0',
				position: CSS_ABSOLUTE,
				'z-index': '2'
			});
			css('.' + SKIN_CLASS + ' .' + RENDER_CLASS + ' .' + LOGO_CLASS + ' > a', {
				width: CSS_100PCT,
				height: CSS_100PCT,
				'background-size': CSS_100PCT + ' ' + CSS_100PCT,
				'background-repeat': CSS_NO_REPEAT,
				'background-position': CSS_CENTER,
				position: CSS_ABSOLUTE
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS, {
				width: CSS_100PCT,
				height: '40px',
				background: '#171717',
				position: CSS_RELATIVE,
				'z-index': '4'
			});
			css('.' + SKIN_CLASS + '.fs .' + CONTROLS_CLASS, {
				top: '-40px'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + SLIDER_CLASS + '.time', {
				width: CSS_100PCT,
				height: '2px',
				top: '-2px',
				position: CSS_ABSOLUTE,
				display: CSS_NONE
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ':hover .' + SLIDER_CLASS + '.time', {
				height: '10px',
				top: '-10px'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + SLIDER_CLASS + '.time .' + RAIL_CLASS, {
				width: '0',
				height: CSS_100PCT,
				top: '0',
				position: CSS_ABSOLUTE
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + SLIDER_CLASS + '.time .' + RAIL_CLASS + '.bg', {
				width: CSS_100PCT,
				background: '#CCCCCC',
				filter: 'alpha(opacity=70)',
				opacity: '0.7'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + SLIDER_CLASS + '.time .' + RAIL_CLASS + '.buf', {
				background: '#707070'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + SLIDER_CLASS + '.time .' + RAIL_CLASS + '.pro', {
				background: '#00A0E9'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + LEFT_CLASS
				+ ', .' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + CENTER_CLASS
				+ ', .' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + RIGHT_CLASS
				+ ', .' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + LEFT_CLASS + ' > *'
				+ ', .' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + CENTER_CLASS + ' > *'
				+ ', .' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + RIGHT_CLASS + ' > *', {
				'float': 'left'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + RIGHT_CLASS, {
				right: '0',
				position: CSS_ABSOLUTE
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.play', {
				'margin-left': '8px',
				width: '26px',
				height: '40px',
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAA7UlEQVRIS73Vuw2DMBAG4LvChelokA6qbJARMgqMkA1gA7JBRmCDZIMkGyQFQqJKeqSLjCBFeORsRFxbn3+fzmeElRau5MJ/4bIsU6VUEQTB1fVGg8RVVe2Y+WRAREyJKHPBZ+EOvCNiQkRnmwMkcO/lWuvM9/2n5AAb2Hji9LawOL0r3KYHgH0YhsVYaZbArcfMxyiKkm98Mdy15YaIzA0+ayn8AoB4rBxL4IPWOp1qPxf4gYjxrwdjC8+mdKmxKKUVzMyZ53m59Cn3+KAUdV1vm6a5MPNNKRW7js7RQW9wV3AysWRySfas9jW9AbDjlhedpANmAAAAAElFTkSuQmCC)'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.play:hover', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAA2klEQVRIS73U0RHBQBDG8f9OBs8eyLMOlKATuRJ0kHRABVGCDugAHfCIFxqwRgxjCLm7OFvA777b2V0hUEkglz/D+S4FmWG6K98fvSfODwPkPC9AIWUYZz74d7gQdYNGBtNZuDxgAd85GaONDNM+2jzgALuld4Tt03vC9/QywsSzstbUgB/clCQ2r/gvYNBmD9PePOP1YOUEJGXt8IdVJ9BKP42fO6y6hSipWhg3uCKle48tU7rBSgbNse0qP1bobbjzfR/RJcoaJPE9neWH/orXuMW3ixuogsEXAwpyFxd7ZW8AAAAASUVORK5CYII=)'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.pause', {
				'margin-left': '8px',
				width: '26px',
				height: '40px',
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAASElEQVRIS2NkoBFgpJG5DMPE4GfPnv1HDiIpKSkUnxGSB+nFGhSENBKSHzUYJeWOhjE8OEaDYjQoUAspnGUFNQr/YVLQUyMoAN6NcBeNBoG9AAAAAElFTkSuQmCC)',
				display: CSS_NONE
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.pause:hover', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAS0lEQVRIS2NkoBFgpJG5DMPF4AUv/6MEUYI4qs8IyTMw4AgKQhoJyY8ajBwv2JMboTAkJD8axqNhzMCAnuWHUaqgQuk/XAp6KgQFAKp5VBfJ2vW8AAAAAElFTkSuQmCC)'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.reload', {
				'margin-left': '4px',
				width: '26px',
				height: '40px',
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAASCAYAAACw50UTAAABo0lEQVQ4T61UzU0CURD+hnDg7UW4kOxwUDugA7ECpQKhAqQCsQKwArECoQKxAzoQDrxNuIAXOEAyZshiHsvuskQn2du8b+f7mSGcUdbaRwATZh5keUZZmrRnPp9XN5tNi4gaAAbGmGapVFqmvU8FV8DtdvskIjUiKrpAIrLM5XJt3/f7ST9IBLfW9gC0UiYbGmMaadPHgltrdZqHEHiYz+c75XJ5PJvNOkSkujey6H4EHprWVWAiarq0gyCoFQqF8Smt92wPwBeLRXG1Wn2pviLyXKlUOlkNj+s7AA+CoCEirwCmzHz1F+AdcxfA0fqFmVXbzKXJUl/cB1HwEYCbcyVRL0TkA8AbM+se7OpfwMMUPQH4ZOZaEvg+2wcTnNJmL2eUcXTyewDvun2e511niZybMAB1N/9xOZ8AuNT7wcz1DFPrEbuLS9gRuGMORKTveV47jkE4cTc8ZLpwt77vayB+K3b9nbxrozLpEZHGTPtFRKoANKq7XYhucqyhkcyr/mqwSpRUU/1J0p1JPblKfb1ea241XvpdAPgGoPRHxph+muk/W8LNEwZCyJwAAAAASUVORK5CYII=)'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.reload:hover', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAASCAYAAACw50UTAAABjElEQVQ4T62UwVECQRBFX4uFR/Egy03NgAzECIQI3IlAiACMQIxgMAIxAjEDMhBvLB7Ao1ZhW7O7VME6wELZ191+0/P/7xF2KTtugowwQT9Pm+T5Kf7HTqqI3gIh0EeLBnMy29S/GZ4A20ANKGVAM1RamHJv3QHr4XbcRcRN6i/lGYrhpun9cBv1EG5iagyRDqY8xEYdoBlLk0P3v3Bnmsh9Ahazcm37UYPD4TatF1ddhdtpCfl+i/VV7jCBm3TvysAnIaIW1XdM5XxvatqYgadaqz5gKk7b/OWS5XxZqgx8PEDkcmdJnBfy84LyiAncHsT1T/Cog9BG9RVTcTvhhSfZzkywVZtFdDMhyGpeR3gCZmjxIlfkVhPWWM6/L+cjRM7i9yMMGjmm7iNc+xLmgafmJNQeWmx5b5BM7JYtMVAPrjCng/VpWXyxad6TrhFCFykMmSMUUHReRd0zIMkuZDfZa+jysTaqgzqDnUT+csuGNNe9M1ue3GkJvkIQF68awjHKJzAAHcBRb5Ppv4ilpRPPrZusAAAAAElFTkSuQmCC)'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.stop', {
				'margin-left': '4px',
				width: '26px',
				height: '40px',
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAfUlEQVQ4T2NkoBJgpJI5DCgGvXr1yuDv37/8xBjOzMz8UUxM7AJMLdwgkCF//vw5T4whMDUsLCyGMMPgBj1//tzh////+0kxiJGR0VFSUvIASM+oQdhDbjSMCKco2oYROVkEq4tAHoFmWgHCnoKogGUPlCxCrGZc6qhWHgEATUBvE9w5bHsAAAAASUVORK5CYII=)',
				display: CSS_NONE
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.stop:hover', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAd0lEQVQ4T2NkoBJgpJI5DKgGzX9lwMDMyE+U4X//f2RIFLsAU4swCGQI4//zRBkCU/Sf0RBmGJJBrx0YGP/tJ80gJkeGRNEDID2jBuEIuf+jYUQwTdE4jMjJIthiDeQPUH5jYBQg6CWYAmj2QM0iROvGrpBq5REAFKdRE3q6U4sAAAAASUVORK5CYII=)'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + LABEL_CLASS + '.alt'
				+ ', .' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + LABEL_CLASS + '.elapsed', {
				'margin-left': '8px'
			});
			
			css('.' + SKIN_CLASS + '.' + states.BUFFERING + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.play'
				+ ', .' + SKIN_CLASS + '.' + states.PLAYING + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.play'
				+ ', .' + SKIN_CLASS + '.' + rendermodes.VOD + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.reload'
				+ ', .' + SKIN_CLASS + '.' + rendermodes.VOD + ' .' + CONTROLS_CLASS + ' .' + LABEL_CLASS + '.alt'
				+ ', .' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + LABEL_CLASS + '.elapsed'
				+ ', .' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + DEVIDER_CLASS
				+ ', .' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + LABEL_CLASS + '.duration', {
				display: CSS_NONE
			});
			css('.' + SKIN_CLASS + '.' + states.BUFFERING + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.pause'
				+ ', .' + SKIN_CLASS + '.' + states.PLAYING + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.pause'
				+ ', .' + SKIN_CLASS + '.' + rendermodes.VOD + ' .' + CONTROLS_CLASS + ' .' + SLIDER_CLASS + '.time'
				+ ', .' + SKIN_CLASS + '.' + rendermodes.VOD + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.stop'
				+ ', .' + SKIN_CLASS + '.' + rendermodes.VOD + ' .' + CONTROLS_CLASS + ' .' + LABEL_CLASS + '.elapsed'
				+ ', .' + SKIN_CLASS + '.' + rendermodes.VOD + ' .' + CONTROLS_CLASS + ' .' + DEVIDER_CLASS
				+ ', .' + SKIN_CLASS + '.' + rendermodes.VOD + ' .' + CONTROLS_CLASS + ' .' + LABEL_CLASS + '.duration', {
				display: CSS_BLOCK
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.report', {
				'margin-right': '8px',
				width: '20px',
				height: '40px',
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAB+klEQVQ4T52UzZHaQBCFuwd04QQXqjQcTAaWI7A2g3UEVgZLCDgDHIFxBusIFiIwG4HZg0ZVXOAGVULdrreloSQtyPLOaX6/6dczr5kqzTk3s9Yu9vv98Hg8JujvdruoKIphGIarLMsSIlqFYbitnqv2GYdPp9NHTIrIwhgzU9VIVRP0RQQQMsYssc7MS2beENHLNTA757aqemDmAxF9JqJ1eWNERDg4LceIChdty70RM0dNKIDKzHeQlKbpfDKZzAHw8iH5fD5PrbWPVcnVczXJtxZu5cjP41y/3/+EcVEUBx9pLcJ/Qarr5WMhBT+QsiAI7sbj8aYGdM7dE9GsBbyAdKxnWRYjvwBi7KHvihC5VNW5qj4ZY9YeSkTfa8Asy/CiH1oifCGiWFWHqvoVr6yqS0BFZDYYDOImMBYRSLnamBkXbjzMb1LVb/53dJZcyrxEVoE9I7LRaIR/TJ0kwznYeyWyGuwNEF8hz3O89KUxcwy7icgDcnYrMj/fKhnOMcZsmzDYk5nnvV7vgL/XySl4cVX9c+V1flprE+cc/H8Py3YCwsuoKmWFea1GRPQKK71+qQGdgGmaboIgSOBTEfnNzL887L+BXq6qPjPzipkfm9Jaqw0RffEexe0ounmeT5sJ99LKir73Za8peUFEDy12u7W0tta+cdVfayyTMVHcLB4AAAAASUVORK5CYII=)'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.report:hover', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAAB3ElEQVQ4T52UwXnTQBCF/5FIzs6BODfUAaIClA5MBXgrwCWYDkwFEh2ECnAqQKkAc7PDwbriJBq+HUVCkq0kZk6r3Z2n92bnjdCOdD3DXSxItyP4M63WtzHICPd6SXo7hZMl7mzVyWt9iCWH929trywXBMEMfYhRmdq6LKd2FgSZnYtmSJjz8OrXIWAhXa9ACtACkfeoXlc/lBg0B6JHAv5eDKzsrq1P4z6okG0UDS4rSZs5bjw3gEa+l6wRbnzVkdzO60geOBiqUbNvefKu+j4paqZdhs+itC7YYxEjmgIFKpe487wveQI6G8aVhUm3kvxOrBQVoA8D/T+G1j7lHJHvqFw3oKpfegy3EeH9m0GGvlW4S6AcIfLRJENmoKbsNOkBehll8kQpI2ulf2DVVeVz3R0vl1zJbDOrwW48M9xZYd3b7cMByd45JXKAWQfsAKA18aQrWRMIMkQ/PdbsILM652nJ3jnIah/M2zOcmwXdubdnE8OA6TZCdj/3Hkj5ihtPSTcFBBOz7MsA1zMIc/AThmoa1WB+fbSX000O4udfgex+oHwzZnUcBVjLVW5AlxBe9aU9w5APjUfNp35i30X9gjfs/Lnsts3Y69QwXS8Q8S1xXPhB7C72XPUXUpIzkgX2T8IAAAAASUVORK5CYII=)'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.volume', {
				'margin-right': '4px',
				width: '25px',
				height: '40px',
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAABRUlEQVQ4T8WUwW2DQBBFZyQ4cApckNg9xK4guAKTCtJC0kE6iFNJUoI7SNyBU0HsA7NHcoMTE40F1oI3GBlL4bis3vz5f3YQrvzhEM8Y81jX9UxrvRpb90+gwJj5DQA2SqlsEtCCCecEaIyZyY8kSXb9QicKezAnkIg+mfnO9/37OI63NrQDdMCOQCJ6RsS1qMrzfIWIL8y81VovOkAiWgPATXPo8mqDiOLnNwDsgiBYRFH0IyoBYImIT0mSvLdQJCI+Y/jBw6bwAzO/SurGmIyZP/oqRwOLogjLsixEpVJqLiKISEK5VUodrRsNdAGstudt4v8HtFreK6UOczip5YFQvrTWqZ2yjE3YHCwdidtjsw+CIB0cGxtwwWB31Anr4qcHAKnnedng02vVnlsOElBVVeGo5eCATl9fNvRqC3bsQu3f+wXvgQ4kgi83UAAAAABJRU5ErkJggg==)'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.volume:hover', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAABOUlEQVQ4T8WUsVHDQBBF/yYoRE4sZdgVIFdguwJauOuADjCVrEtwB0AHpgLkTIJAxA5Y5k7InE+WOI81g0LNzdu/u38/YeCPenn8rgCZQCer0LrdQAMjYYi8QKeLy4ANzFBOAbma2AJ6lPuF2gpdWCeweAbRLYSW0OOtCz0G+jAXyMU9EG2sKi5XIDwA2EIls2MglxuQXNc/qT0r0zIiBdq/AZJDohn06BNsVc4hpKHH6wZKWJfSO/BmhrYw7iB4tFvnjwXo68lXeQawikH7yqpU6dSK4CIH0Q1UchhdOPAU4ND21bTZ+D8C+adlkR10Wvvwopa7liJ4hU6y3y2bh5C4dg3NWxt3bWPUIcr6beMSzjW2p85qaikKPT1QZg+h9/Qa+t/hYEYUh4WDDx0kvlzoYAEbmqjeu2/Qu+AVc0ee5wAAAABJRU5ErkJggg==)'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.volume.mute', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAABFElEQVQ4T62UwY3CMBBFv6XJGU45OBc6gA6ATigBOqCD3Q5oYTtY6ACamEg5wTlWjMaykWVlWax4zvbz/D/fo1C41Dte27a7YRgWTdMcP333T6DArLUnABet9WYSMIIJZxowgU0DjsDygcz8A2DmPRrz6iWZmb8BLInoUNf1Ve50XbcyxnwBuGmt94qZ7T+Gx8AzgLW19l5V1Vbu9X3/q5SaB6+zgL4bgc4EKkAPexDRRrrOAkYSHdQre8HcAzmSAzCSiSA/eJoFFMkR7OE7dPLF02zJzOyGAsDJFKAxJsh3w5MOJTYyJSk5nFYamxUR7ZPYSJyuLjbx7SLBTtsp+vUCvOhyGIFO2zapp8UW7KcLNT33BBvV1hUPsh0RAAAAAElFTkSuQmCC)'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.volume.mute:hover', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABQAAAAUCAYAAACNiR0NAAABCklEQVQ4T62UzVHDMBCFv00D+BRyTAe4A6AT1EHoIB2QDkQJdEDowHSR+JQ0kGX0B7aYeBDWXjX69N7b1QqVSyZ5tn8CXWNut3999zrQwUQtqh+Y1cM8YII5ymzgEDYbmMP+BbTHN0RvQkbyO6uhZXvYIdyhi2fMsvNXbN8ilxeUT8xqI7wedTLwMXCPyD1wQuUxaNB3oElZFwL7FnSP4BydopAG5ezdmWVXBkwWf6AMYV5wkeXvzKLNIDHYj5mWAX0DUmbOppcU7EdoIfAQmpIy88SYaWye4MYGbcJrvoPjyscGWlhsRmPDZQd0YWyGVWWwc0VVv16CV10OOXT2tskzrbZgJz/49cMvxZO5FboZZaEAAAAASUVORK5CYII=)'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + SLIDER_CLASS + '.volume', {
				margin: '15px 8px 0 0',
				width: '60px',
				height: '12px',
				position: CSS_RELATIVE
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + SLIDER_CLASS + '.volume .' + RAIL_CLASS, {
				width: CSS_100PCT,
				height: '4px',
				top: '4px',
				position: CSS_ABSOLUTE
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + SLIDER_CLASS + '.volume .' + RAIL_CLASS + '.buf', {
				background: '#909090'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + SLIDER_CLASS + '.volume:hover .' + RAIL_CLASS + '.buf', {
				background: '#B0B0B0'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + SLIDER_CLASS + '.volume .' + RAIL_CLASS + '.pro', {
				width: '80%',
				background: '#E6E6E6'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + SLIDER_CLASS + '.volume:hover .' + RAIL_CLASS + '.pro', {
				background: '#FFFFFF'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + SLIDER_CLASS + '.volume .' + THUMB_CLASS, {
				width: '10px',
				height: '12px',
				'background-repeat': CSS_NO_REPEAT,
				'background-position': CSS_CENTER,
				'background-image': 'url(data:image/png;base64,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)',
				position: CSS_ABSOLUTE
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.videooff', {
				'margin-right': '8px',
				width: '25px',
				height: '40px',
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAABDklEQVRIS7XUsU3EMBgFYD+XqZLScsMG3AjHBmwAbHAbAJNwTMKNwAip7DJUUbqHfoRPSWT7cokvXSTn8++n+EHd6MGNXHWGnXNHkrTWvpTYbAIrpZ5IHkvgkyhk6lL4HD6QfAVQjyd3zj0CuI9E9GmMaWPRnWHv/Z7k13hRwLuuq/u+P81xku/W2jf5xnv/rJRqjTEnec/CsiCHB1hQkh8AHhbDOVxgrXUr6N+U18IpnOQ3gF2IbxV8KZbVE4epcpmvnvgSvhlOxVIEjuFa68NVv1uulMaZD8NQh5sYu9L10nYDcJfqls19nCquzbCc7r/Ld1VV7Zum+Zl0xdLjp9ZJUQW0KDzfsEgUsVP8AjbPIyaydhRcAAAAAElFTkSuQmCC)'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.videooff:hover', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAABBklEQVRIS7WUwRGCMBBF/3LgjAeHqx1oCdqBHUg6oAO1kmAlWoIlcBQ96NkDcVZEIRAUE/bGTHi7eZP9hIGKBuLiA5ZZAoJCFAoXzXTwCkDiAl5XUUztBK6BTzGI1gCC2uQyW8LDtKEo93cQo7RNXUXFZQ7K99qhQou8BsD9ANLgCluIcPP8R54jgFKI8YE/v4H5jBleghlKSkJ5iz5gM5zBPCVDuf4Am+BHALO3vj/B3VosJi4H63De37H+otrhFiqqDZpwR+Cmc3hx3+fWlUuVyRGUm9hcaRCv8681MWWLfR4bgsse/MyJLCkWxZ9DjG71rPj18qZzHFQvqFuw1tCNipZbPACegZ0XwtDqewAAAABJRU5ErkJggg==)'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.videooff.on', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAsElEQVRIS+2UwQkCQQxF89OAXsMWoSVoJ5ZgCVqJWomWoB3MaVLGlyy4oCzsLMyAh53bQOYxvOQH0uigEVcW8GD2S0XO+QhgNcP7zczSWP0AdvcdyfsMqJA8d113ijfufhCRZGaPuFcBB5TkBcC+GlhVU0D7X1YEPwFsP/qqgX/78f9gki8Am+oqYtxaNa+f4ybjNhmQ8BSRJrkuTZ+qXicjXQorrVv28fg+LvVXUvcGIO6bF1fJcVMAAAAASUVORK5CYII=)'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.videooff.on:hover', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAsUlEQVRIS2NkoBFgpJG5DKMGw0MWNSjmvyhgYGLkJzrc/7EtZEgUfIBNPcLg+a8dGBj/7SfaUJDC/wyNDIniDWA9818lMDAwPmBIFD0A4lLHYJChjP/nM/xncqSewSBXggwF+4BaBjMwXGBgYDCABx8VDUaNksFv8H+GiwyMDPrUDwpQcqNJ5MHSMU2SG8EMAs49LwoYGBgFiM99bAsIZ2niTSNK5Wh5jKM8Jir0iFMEAFAJZBetwVsWAAAAAElFTkSuQmCC)'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.videooff'
				+ ', .' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.videooff.on', {
				display: CSS_NONE
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.videooff.enable', {
				display: CSS_BLOCK
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + ' .' + TOOLTIP_CLASS, {
				bottom: '40px',
				position: CSS_ABSOLUTE
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + ':hover .' + TOOLTIP_CLASS, {
				visibility: CSS_VISIBLE
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.hd', {
				'margin-right': '8px',
				height: '40px',
				position: CSS_RELATIVE
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.hd .' + TOOLTIP_CLASS, {
				'z-index': '3'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.hd .' + TOOLTIP_CLASS + ' .' + TOOLTIP_ITEM_CLASS, {
				'min-width': '40px'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.bullet', {
				'margin-right': '8px',
				width: '58px',
				height: '40px',
				'background-image': 'url(data:image/png;base64,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)'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.bullet.off', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADoAAAAUCAYAAADcHS5uAAAACXBIWXMAAAsTAAALEwEAmpwYAAAKTWlDQ1BQaG90b3Nob3AgSUNDIHByb2ZpbGUAAHjanVN3WJP3Fj7f92UPVkLY8LGXbIEAIiOsCMgQWaIQkgBhhBASQMWFiApWFBURnEhVxILVCkidiOKgKLhnQYqIWotVXDjuH9yntX167+3t+9f7vOec5/zOec8PgBESJpHmomoAOVKFPDrYH49PSMTJvYACFUjgBCAQ5svCZwXFAADwA3l4fnSwP/wBr28AAgBw1S4kEsfh/4O6UCZXACCRAOAiEucLAZBSAMguVMgUAMgYALBTs2QKAJQAAGx5fEIiAKoNAOz0ST4FANipk9wXANiiHKkIAI0BAJkoRyQCQLsAYFWBUiwCwMIAoKxAIi4EwK4BgFm2MkcCgL0FAHaOWJAPQGAAgJlCLMwAIDgCAEMeE80DIEwDoDDSv+CpX3CFuEgBAMDLlc2XS9IzFLiV0Bp38vDg4iHiwmyxQmEXKRBmCeQinJebIxNI5wNMzgwAABr50cH+OD+Q5+bk4eZm52zv9MWi/mvwbyI+IfHf/ryMAgQAEE7P79pf5eXWA3DHAbB1v2upWwDaVgBo3/ldM9sJoFoK0Hr5i3k4/EAenqFQyDwdHAoLC+0lYqG9MOOLPv8z4W/gi372/EAe/tt68ABxmkCZrcCjg/1xYW52rlKO58sEQjFu9+cj/seFf/2OKdHiNLFcLBWK8ViJuFAiTcd5uVKRRCHJleIS6X8y8R+W/QmTdw0ArIZPwE62B7XLbMB+7gECiw5Y0nYAQH7zLYwaC5EAEGc0Mnn3AACTv/mPQCsBAM2XpOMAALzoGFyolBdMxggAAESggSqwQQcMwRSswA6cwR28wBcCYQZEQAwkwDwQQgbkgBwKoRiWQRlUwDrYBLWwAxqgEZrhELTBMTgN5+ASXIHrcBcGYBiewhi8hgkEQcgIE2EhOogRYo7YIs4IF5mOBCJhSDSSgKQg6YgUUSLFyHKkAqlCapFdSCPyLXIUOY1cQPqQ28ggMor8irxHMZSBslED1AJ1QLmoHxqKxqBz0XQ0D12AlqJr0Rq0Hj2AtqKn0UvodXQAfYqOY4DRMQ5mjNlhXIyHRWCJWBomxxZj5Vg1Vo81Yx1YN3YVG8CeYe8IJAKLgBPsCF6EEMJsgpCQR1hMWEOoJewjtBK6CFcJg4Qxwicik6hPtCV6EvnEeGI6sZBYRqwm7iEeIZ4lXicOE1+TSCQOyZLkTgohJZAySQtJa0jbSC2kU6Q+0hBpnEwm65Btyd7kCLKArCCXkbeQD5BPkvvJw+S3FDrFiOJMCaIkUqSUEko1ZT/lBKWfMkKZoKpRzame1AiqiDqfWkltoHZQL1OHqRM0dZolzZsWQ8ukLaPV0JppZ2n3aC/pdLoJ3YMeRZfQl9Jr6Afp5+mD9HcMDYYNg8dIYigZaxl7GacYtxkvmUymBdOXmchUMNcyG5lnmA+Yb1VYKvYqfBWRyhKVOpVWlX6V56pUVXNVP9V5qgtUq1UPq15WfaZGVbNQ46kJ1Bar1akdVbupNq7OUndSj1DPUV+jvl/9gvpjDbKGhUaghkijVGO3xhmNIRbGMmXxWELWclYD6yxrmE1iW7L57Ex2Bfsbdi97TFNDc6pmrGaRZp3mcc0BDsax4PA52ZxKziHODc57LQMtPy2x1mqtZq1+rTfaetq+2mLtcu0W7eva73VwnUCdLJ31Om0693UJuja6UbqFutt1z+o+02PreekJ9cr1Dund0Uf1bfSj9Rfq79bv0R83MDQINpAZbDE4Y/DMkGPoa5hpuNHwhOGoEctoupHEaKPRSaMnuCbuh2fjNXgXPmasbxxirDTeZdxrPGFiaTLbpMSkxeS+Kc2Ua5pmutG003TMzMgs3KzYrMnsjjnVnGueYb7ZvNv8jYWlRZzFSos2i8eW2pZ8ywWWTZb3rJhWPlZ5VvVW16xJ1lzrLOtt1ldsUBtXmwybOpvLtqitm63Edptt3xTiFI8p0in1U27aMez87ArsmuwG7Tn2YfYl9m32zx3MHBId1jt0O3xydHXMdmxwvOuk4TTDqcSpw+lXZxtnoXOd8zUXpkuQyxKXdpcXU22niqdun3rLleUa7rrStdP1o5u7m9yt2W3U3cw9xX2r+00umxvJXcM970H08PdY4nHM452nm6fC85DnL152Xlle+70eT7OcJp7WMG3I28Rb4L3Le2A6Pj1l+s7pAz7GPgKfep+Hvqa+It89viN+1n6Zfgf8nvs7+sv9j/i/4XnyFvFOBWABwQHlAb2BGoGzA2sDHwSZBKUHNQWNBbsGLww+FUIMCQ1ZH3KTb8AX8hv5YzPcZyya0RXKCJ0VWhv6MMwmTB7WEY6GzwjfEH5vpvlM6cy2CIjgR2yIuB9pGZkX+X0UKSoyqi7qUbRTdHF09yzWrORZ+2e9jvGPqYy5O9tqtnJ2Z6xqbFJsY+ybuIC4qriBeIf4RfGXEnQTJAntieTE2MQ9ieNzAudsmjOc5JpUlnRjruXcorkX5unOy553PFk1WZB8OIWYEpeyP+WDIEJQLxhP5aduTR0T8oSbhU9FvqKNolGxt7hKPJLmnVaV9jjdO31D+miGT0Z1xjMJT1IreZEZkrkj801WRNberM/ZcdktOZSclJyjUg1plrQr1zC3KLdPZisrkw3keeZtyhuTh8r35CP5c/PbFWyFTNGjtFKuUA4WTC+oK3hbGFt4uEi9SFrUM99m/ur5IwuCFny9kLBQuLCz2Lh4WfHgIr9FuxYji1MXdy4xXVK6ZHhp8NJ9y2jLspb9UOJYUlXyannc8o5Sg9KlpUMrglc0lamUycturvRauWMVYZVkVe9ql9VbVn8qF5VfrHCsqK74sEa45uJXTl/VfPV5bdra3kq3yu3rSOuk626s91m/r0q9akHV0IbwDa0b8Y3lG19tSt50oXpq9Y7NtM3KzQM1YTXtW8y2rNvyoTaj9nqdf13LVv2tq7e+2Sba1r/dd3vzDoMdFTve75TsvLUreFdrvUV99W7S7oLdjxpiG7q/5n7duEd3T8Wej3ulewf2Re/ranRvbNyvv7+yCW1SNo0eSDpw5ZuAb9qb7Zp3tXBaKg7CQeXBJ9+mfHvjUOihzsPcw83fmX+39QjrSHkr0jq/dawto22gPaG97+iMo50dXh1Hvrf/fu8x42N1xzWPV56gnSg98fnkgpPjp2Snnp1OPz3Umdx590z8mWtdUV29Z0PPnj8XdO5Mt1/3yfPe549d8Lxw9CL3Ytslt0utPa49R35w/eFIr1tv62X3y+1XPK509E3rO9Hv03/6asDVc9f41y5dn3m978bsG7duJt0cuCW69fh29u0XdwruTNxdeo94r/y+2v3qB/oP6n+0/rFlwG3g+GDAYM/DWQ/vDgmHnv6U/9OH4dJHzEfVI0YjjY+dHx8bDRq98mTOk+GnsqcTz8p+Vv9563Or59/94vtLz1j82PAL+YvPv655qfNy76uprzrHI8cfvM55PfGm/K3O233vuO+638e9H5ko/ED+UPPR+mPHp9BP9z7nfP78L/eE8/sl0p8zAAAAIGNIUk0AAHolAACAgwAA+f8AAIDpAAB1MAAA6mAAADqYAAAXb5JfxUYAAAQ3SURBVHjazJjNS+toFMafJE3SJCa1TenCURTn4tJNF+rC/gtesU6Vy8W1MDCr8TIDLkSsY8fFbGbrQiroaOciunAhUouiCDLgRkctzhUVFyJSR237Jm/uZgqt/a4MeiCQ75xfnvOePG8Yy7JQLGRZFgC8Z1n2PcMwXSzLNgAQGIbBG4h/Lcu6sCzrL8uyPgNYppSmTdOEaZoghOSczBQDlSSp12azhXiefyeKIgRBAM/zYBgGrwmaydeyLJimCcMwkE6nQQg5NU3zk2VZfxJC8PT0VBpUkiSOYZigIAgjiqKgvb0dgUAAPp8PjY2NAICLiwtsbW1haWkJ8Xj8VYEppaCUIp1OI5VKIZVKhQzD+DmRSJglQWVZnrLb7SO6rmNsbAwDAwNgWbbgwyiliEQiCIVCSKVSrwKbWbJhk8lk6Obm5lNRUFmW/aIoLrrdbszOzqKrq6uiB+7t7WF4eDhvXBQKn8+HWCxWdLva87KBTdPMhu2/ublZygOVZVngOC6uaVrj9PQ0BgcHq3q78/PzCAaDeclmolDShWAqjefQ2bDJZBIsy14+PDy0Xl9fp3NAFUX5YLfbwx0dHVhZWQHHcVWBUkrR19dXcMxmg1WaeDWKZsNSSkEIAcuyoJR+PD4+DueAqqq6qKqqf3JyEkNDQzWNmXA4jFAoVBI0k2yp9WrVfA5LCAGlFHa7PXJwcODPAdU07R+Xy9W8sbGB1tbWmkDPzs7Q09NTtHQrUbSckuWUzZQvIQSapn3Z399vyQGtr69P6rouHh0dgef5mkAJIfB6vRUl+X8pCgCGYYAQAl3X07u7u+Jz0ITb7VYPDw9rBn18fERnZ2dJ0FrHaDVhGAYopdB1Pb29vZ0H+rfL5WpbX1+vuXTj8Th6e3vLdt1iIC/pus9LVxAEaJr2JRaL5ZXuoqZp/vHx8Zqb0dzcHKampl7cdSsp8XLNyOl0QhTFSDQazW1GDofjgyzLYa/Xi+Xl5Zo+L36/H6enp2U//uWMwkvUzFjChoYGmKb5MRqNhp93XUEQhLiqqo3BYLBqw7CwsICJiYmK3FC5feUULXRttmFwOp1QVfXy6enp21gslsqzgE6ns1+W5T80TcPMzMyLLWBGnUosXrFjz8u+0DXZkIqiwOPxgFL63dra2mJRU+92u0OSJP1YV1eH0dHRN2/qs2cwkiTB4/HAZrP9urq6OlJy9uJwODi73f6bLMvf22w2tLW1IRAIoLu7G01NTSCE4PLyEjs7O4hEIjg5OXnVuSmlFBzHweFwoL6+HhzH/Z5IJH7Y3Nw0K5p4t7S09CmK8gvLsu8y/jFz87fwh4HjOIiiCEVRUFdXB57nT03T/On+/n7p/Pwc5+fnlf1hAIDm5mZB07R+SZJ6eZ738jz/Dcuy/GtD/veiCcMwlwzD7DMM85kQsnh7e5u+urrC3d1dXr/4OgA7HNX3e/xToQAAAABJRU5ErkJggg==)'
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.fullpage', {
				'margin-right': '8px',
				width: '25px',
				height: '40px',
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAA1klEQVQ4T6WU0Q3CMAxEL2PEX4zABrAJZQNGYQPoJrABbMCXO0aQqziyoqTFxX9N69fzXZIARzHzA8Ch1RIcHDDzFcDe9BSoC2R/ysx3ACdd2wQykBHATsZ1gyyEiAb1zQWqITKWG9SCZNAcwE+KpmkaUko3AKOM81f8AosxSlLNWlS01myJXZB6EkI4Lykp+yi7/iKiiy72jF06BYGZE4AnER1zCrpju8Y2zbagLUrsaLMiAJ98dlxKapA+b4JIs3qkILlvtN42gLXrpgbZ70sAaxB5/wUKOHOr0JSnagAAAABJRU5ErkJggg==)'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.fullpage:hover', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAA1ElEQVQ4T52U0RXCIAxFX5bQfjqCG+gmlg0cxQ3ATXQD3cDPtkvEE2oLeIAC+eSQm5cXAqEm9PAA0SmWQjUc6OEG4LjmeNA6kF9VjwaEy3LUBlogjDvAB2m3HuRD1L7Hz7c60D9E+qoGxSAzyA6gTJGeehBriCfSTiTKQLby1EPtTOq55EEbyT40DVo9IZVT4t6RuA68oLrrWiFlbGYNCGZkMD+hurO91wCRtBDUCAlBoI/dncyIcws+K1qiEeIUOZIYPwfjHQxg478JFfmX/QEUfFpfQyBuipf1nDYAAAAASUVORK5CYII=)'
			});
			css('.' + SKIN_CLASS + '.fp .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.fullpage', {
				display: CSS_NONE
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.fpexit', {
				'margin-right': '8px',
				width: '25px',
				height: '40px',
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAt0lEQVQ4T72UQQ4CIQxF7ZKuZMsl9AjjyfUIegm2uIJlTc38hBAMFJNhRYC+/sIvdPpjpJTOGu69f9MsJ8YoejaE8I1RSM75rnNmvi2BACGiq4i8mHkzg5xzXpXUkKXSROTZQrQ8syINQjmqBHe8BGofSB/geNDIJtOKpkAwW+8wDHgsCNlqx2LNpKjuHZiNiC51b02V1uudUkoygXoQdWzb7UNFO+ixfwcbbG8G4X7wQY0y/9r/AJnWkc0bPWKhAAAAAElFTkSuQmCC)',
				display: CSS_NONE
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.fpexit:hover', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAuUlEQVQ4T2NkoATMfy8A1p4o+IGRaHMWvPwPVpsgDtEDMoTx134w+z+bI3kGIQwxYPjPcJGBgc2BdIP+swlCXQI3hDyvMTBcYGBgQDEE5DvSXQQOE4h3QC6BhTF5BqHHUII44wAYRCCdEO8iogyCJTZsimEJkL4GwWxDTrEwMZJchJp3IImNkUEfJW8R5TUseYeB8dd70gzCZggoxaLndoIuApcpvw5A1CEle5INgoUPtIAiunxCUwgApE9cT85zkWYAAAAASUVORK5CYII=)'
			});
			css('.' + SKIN_CLASS + '.fp .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.fpexit', {
				display: CSS_BLOCK
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.fullscreen', {
				'margin-right': '8px',
				width: '25px',
				height: '40px',
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAnElEQVQ4T+WU3Q3CMAyEOW8RZRi6GWWzdJgkW+TQIbUyEBR4qFRBnuLYcuzPPyil8NQ5JK8xxtmrcs4zgEvPHns4Wkim9TczSyGETdZ7rXVqrU2rDQDdz5K3iHqp9FJ4l+oBHakSCrfHZJSaZ4aR8af6X3Yk2GamMVmeG3DER7D/oSHd9CcAfkhfmHkm4kdSjO5DvMsaeSjSt4vtBtnsp8JMC9GXAAAAAElFTkSuQmCC)'
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.fullscreen:hover', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAnUlEQVQ4T92UwQ3CMAxFn7MDYhyySiehTFJGScep2CGukkNjwFJAKhJqbo4tx//FtnBfFO8oN4bz+OSalhHh6oXL/olUZ5DUXguJ4WRsYHpEyLHFaETkUuxWkSfF1WwujdR/TFTKq8dh0pXWmEkv9lP/oRMV2AElh/mtAXuASoOGfPyG3NaIJsQMrcfMMKn4VCNIHeIfrJHXH/pysa1ohHWEOdPAyAAAAABJRU5ErkJggg==)'
			});
			css('.' + SKIN_CLASS + '.fs .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.fullscreen', {
				display: CSS_NONE
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.fsexit', {
				'margin-right': '8px',
				width: '25px',
				height: '40px',
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAAq0lEQVQ4T91TwQ3CMAz0eYsoS7ABdCOYgDIB3YiyAUsk2SJGrgpKW0vkkUeFn7Z18t35QEWllE4i8tCWiNy89305DyH0AK7aA9A558bPHPsDUjrKZKZzIKKhhhoRnQG8vtRijBPIun5ptN5HMyB1wrqImcfSFd1RGXLOKsWmFq5ZC7W9fwZSsZnZeoGnJTYRHU2xm9nfDGiOyHStiGhE7pURuSwisr/0t7roDbmXxCMvcdiYAAAAAElFTkSuQmCC)',
				display: CSS_NONE
			});
			css('.' + SKIN_CLASS + ' .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.fsexit:hover', {
				'background-image': 'url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAASCAYAAABWzo5XAAAArElEQVQ4T2NkQAbzXzswMP7bDxb6z9DIkCjegCr/soGBkaEeIs/kyJAoegAmzzgIDQJ5h5nhP8S5fw0Y/jNOIMprjP8LGBiZLyC8tuAlxBB0QCiM0NQzMlDNoPkvUWMGbhPTAeRYAQuDgoHhnwM2D6DGGlY/Eic4rA0CBTYTNB0hB8c/poNYA5vpnz32wKZa9FPNIHDagIG/BgyMjP1EZZH//wsZGJCzyLAtRgCyOYnaQdfFTQAAAABJRU5ErkJggg==)'
			});
			css('.' + SKIN_CLASS + '.fs .' + CONTROLS_CLASS + ' .' + BUTTON_CLASS + '.fsexit', {
				display: CSS_BLOCK
			});
			
			css('.' + SKIN_CLASS + ' .' + CONTEXTMENU_CLASS, {
				'white-space': CSS_NOWRAP,
				position: CSS_ABSOLUTE,
				display: CSS_NONE,
				'z-index': '5'
			});
			css('.' + SKIN_CLASS + ' .' + CONTEXTMENU_CLASS + ' ul', {
				'list-style': CSS_NONE
			});
			css('.' + SKIN_CLASS + ' .' + CONTEXTMENU_CLASS + ' ul li', {
				
			});
			css('.' + SKIN_CLASS + ' .' + CONTEXTMENU_CLASS + ' ul li a', {
				padding: '8px 14px',
				color: '#E6E6E6',
				'line-height': '20px',
				'text-decoration': CSS_NONE,
				background: '#252525',
				display: CSS_BLOCK
			});
			css('.' + SKIN_CLASS + ' .' + CONTEXTMENU_CLASS + ' ul li a:hover', {
				'text-decoration': CSS_NONE,
				background: '#303030'
			});
			css('.' + SKIN_CLASS + ' .' + CONTEXTMENU_CLASS + ' ul li.' + FEATURED_CLASS + ' a', {
				color: '#BDBDBD',
				background: '#454545'
			});
			css('.' + SKIN_CLASS + ' .' + CONTEXTMENU_CLASS + ' ul li.' + FEATURED_CLASS + ' a:hover', {
				'text-decoration': CSS_NONE,
				background: '#505050'
			});
			css('.' + SKIN_CLASS + ' .' + CONTEXTMENU_CLASS + ' ul li a span', {
				'margin-right': '10px',
				'padding-right': '10px',
				width: '20px',
				height: '20px',
				'border-right': '1px solid #BDBDBD',
				'vertical-align': 'middle',
				display: CSS_INLINE_BLOCK
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
