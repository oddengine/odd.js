(function(playease) {
	var utils = playease.utils,
		css = utils.css,
		events = playease.events,
		core = playease.core,
		components = core.components,
		
		FEATURED_CLASS = 'pe-featured';
	
	components.contextmenu = function(layer, config) {
		var _this = utils.extend(this, new events.eventdispatcher('components.contextmenu')),
			_defaults = {
				items: []
			},
			_info = {
				icon: 'http://studease.cn/images/favicon.png',
				text: 'Playease ' + playease.version,
				link: 'http://studease.cn/playease',
				target: '_blank'
			},
			_container,
			_logo,
			_img,
			_loaded = false;
		
		function _init() {
			_this.config = utils.extend({}, _defaults, config);
			
			_this.config.items = [_info].concat(_this.config.items);
			
			var flashVersion = utils.getFlashVersion();
			if (flashVersion) {
				_this.config.items.push({
					text: 'Flash Version ' + flashVersion,
					link: 'http://get.adobe.com/cn/flashplayer/about/',
					target: '_blank'
				});
			}
			
			_container = utils.createElement('ul');
			
			for (var i = 0; i < _this.config.items.length; i++) {
				var item = _this.config.items[i];
				
				var a = utils.createElement('a');
				if (item.link) {
					a.href = item.link;
				}
				if (item.target) {
					a.target = item.target;
				}
				if (item.text) {
					a.innerText = item.text;
				}
				if (item.icon) {
					var span = utils.createElement('span');
					a.insertAdjacentElement('afterbegin', span);
					
					css.style(span, {
						background: 'url(' + item.icon + ') no-repeat center left'
					});
				}
				
				var li = utils.createElement('li', item.icon ? FEATURED_CLASS : '');
				li.appendChild(a);
				
				_container.appendChild(li);
			}
			
			layer.appendChild(_container);
		}
		
		_this.show = function(offsetX, offsetY) {
			css.style(layer, {
				left: offsetX + 'px',
				top: offsetY + 'px',
				display: 'block'
			});
		};
		
		_this.hide = function() {
			css.style(layer, {
				display: 'none'
			});
		};
		
		
		_this.element = function() {
			return _container;
		};
		
		_this.resize = function(width, height) {
			
		};
		
		_init();
	};
})(playease);
