(function(playease) {
	var utils = playease.utils,
		events = playease.events,
		core = playease.core,
		states = core.states,
		renders = core.renders,
		rendermodes = renders.modes,
		skins = core.skins,
		skinmodes = skins.modes,
		css = utils.css,
		
		WRAP_CLASS = 'pla-wrapper',
		SKIN_CLASS = 'pla-skin',
		RENDER_CLASS = 'pla-render',
		POSTER_CLASS = 'pla-poster',
		CONTROLS_CLASS = 'pla-controls',
		CONTEXTMENU_CLASS = 'pla-contextmenu';
	
	core.view = function(entity, model) {
		var _this = utils.extend(this, new events.eventdispatcher('core.view')),
			_defaultLayout = '[play elapsed duration][time][hd volume fullscreen]',
			_wrapper,
			_renderLayer,
			_posterLayer,
			_controlsLayer,
			_contextmenuLayer,
			_render,
			_skin,
			_errorOccurred = false;
		
		function _init() {
			_wrapper = utils.createElement('div', WRAP_CLASS + ' ' + SKIN_CLASS + '-' + model.config.skin.name);
			_wrapper.id = entity.id;
			_wrapper.tabIndex = 0;
			
			_renderLayer = utils.createElement('div', RENDER_CLASS);
			_posterLayer = utils.createElement('div', POSTER_CLASS);
			_controlsLayer = utils.createElement('div', CONTROLS_CLASS);
			_contextmenuLayer = utils.createElement('div', CONTEXTMENU_CLASS);
			
			_wrapper.appendChild(_renderLayer);
			_wrapper.appendChild(_posterLayer);
			_wrapper.appendChild(_controlsLayer);
			_wrapper.appendChild(_contextmenuLayer);
			
			_initRender();
			_initSkin();
			
			var replace = document.getElementById(entity.id);
			replace.parentNode.replaceChild(_wrapper, replace);
			
			window.onresize = function() {
				if (utils.typeOf(model.config.onresize) == 'function') {
					model.config.onresize.call(null);
				}
			};
		}
		
		function _initRender() {
			var cfg = utils.extend({}, model.getConfig('render'), {
				id: entity.id,
				url: model.config.url,
				width: model.config.width,
				height: model.config.height,
				controls: model.config.controls,
				autoplay: model.config.autoplay,
				poster: model.config.poster,
				loader: {
					mode: model.config.cors
				}
			});
			
			try {
				_render = _this.render = new renders[cfg.name](_this, cfg);
				_render.addEventListener(events.PLAYEASE_READY, _forward);
				_render.addEventListener(events.PLAYEASE_VIEW_PLAY, _forward);
				_render.addEventListener(events.PLAYEASE_RENDER_ERROR, _onRenderError);
			} catch (e) {
				utils.log('Failed to init render ' + cfg.name + '!');
			}
			
			if (_render) {
				_renderLayer.appendChild(_render.element());
			}
		}
		
		function _initSkin() {
			var cfg = utils.extend({}, model.getConfig('skin'), {
				id: entity.id,
				width: model.config.width,
				height: model.config.height
			});
			
			try {
				_skin = new skins[cfg.name](cfg);
			} catch (e) {
				utils.log('Failed to init skin ' + cfg.name + '!');
			}
		}
		
		_this.setup = function() {
			if (!_render) {
				_this.dispatchEvent(events.PLAYEASE_SETUP_ERROR, { message: 'Render not available!', name: model.config.render.name });
				return;
			}
			_render.setup();
			
			// Ignore skin failure.
			
			try {
				_wrapper.addEventListener('keydown', _onKeyDown);
			} catch (e) {
				_wrapper.attachEvent('onkeydown', _onKeyDown);
			}
		};
		
		function _onKeyDown(e) {
			if (e.ctrlKey || e.metaKey) {
				return true;
			}
			
			switch (e.keyCode) {
				case 13: // enter
					
					break;
				case 32: // space
					
					break;
				default:
					break;
			}
			
			if (/13|32/.test(e.keyCode)) {
				// Prevent keypresses from scrolling the screen
				e.preventDefault ? e.preventDefault() : e.returnValue = false;
				return false;
			}
		}
		
		_this.display = function(icon, message) {
			
		};
		
		_this.resize = function(width, height) {
			if (_render) 
				_render.resize(width, height);
		};
		
		_this.destroy = function() {
			if (_wrapper) {
				try {
					_wrapper.removeEventListener('keydown', _onKeyDown);
				} catch (e) {
					_wrapper.detachEvent('onkeydown', _onKeyDown);
				}
			}
			if (_render) {
				_render.destroy();
			}
		};
		
		function _onRenderError(e) {
			_forward(e);
		}
		
		function _forward(e) {
			_this.dispatchEvent(e.type, e);
		}
		
		_init();
	};
})(playease);
