(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        Event = events.Event,
        components = odd.IM.UI.components,
        Panel = components.Panel,

        CLASS_GROUP = 'im-settings-group',
        CLASS_TITLE = 'im-settings-title',
        CLASS_CONTENT = 'im-settings-content',
        CLASS_FOOTER = 'im-settings-footer',

        _default = {
            groups: [],
        };

    function Settings(name, config, logger) {
        Panel.call(this, name, 'Settings', logger, [Event.CHANGE]);

        var _this = this,
            _config,
            _data,
            _groups,
            _content = _this.content(),
            _destroy = _this.destroy;

        function _init() {
            _config = utils.extendz({}, _default);
            _data = {};
            _groups = {};
            utils.forEach(_config.groups, function (_, group) {
                _buildGroup(group);
            });
        }

        function _buildGroup(config) {
            var element = utils.createElement('section', CLASS_GROUP),
                title = utils.createElement('h3', CLASS_TITLE),
                content = utils.createElement('div', CLASS_CONTENT),
                group = {
                    config: config,
                    element: element,
                    title: title,
                    content: content,
                    items: {},
                    buttons: [],
                };
            element.setAttribute('name', config.name);
            title.textContent = config.title || config.name;
            element.appendChild(title);
            element.appendChild(content);
            utils.forEach(config.items || [], function (_, item) {
                _buildItem(group, item);
            });
            _buildFooter(group, config.footer);
            _content.appendChild(element);
            _groups[config.name] = group;
        }

        function _buildFooter(group, config) {
            if (!config || !config.length) {
                return;
            }
            group.footer = utils.createElement('footer', CLASS_FOOTER);
            utils.forEach(config, function (_, item) {
                var button = utils.createElement('button');
                button.type = 'button';
                button.name = item.name;
                button.data = item.value;
                button.textContent = item.title || item.name;
                button.addEventListener('click', _onFooterClick);
                group.footer.appendChild(button);
                group.buttons.push(button);
            });
            group.element.appendChild(group.footer);
        }

        function _buildItem(group, config) {
            if (config.type === 'radio') {
                var field = utils.createElement('div'),
                    heading = utils.createElement('span'),
                    radios = [];
                heading.textContent = config.title || config.name;
                field.appendChild(heading);
                utils.forEach(config.options || [], function (_, option) {
                    var label = utils.createElement('label'),
                        input = utils.createElement('input'),
                        text = utils.createElement('span'),
                        object = utils.typeOf(option) === 'object',
                        value = object ? option.value : option;
                    input.type = 'radio';
                    input.name = config.name;
                    input.value = value;
                    input.addEventListener('change', _onChange);
                    text.textContent = object ? option.label || value : option;
                    label.appendChild(input);
                    label.appendChild(text);
                    field.appendChild(label);
                    radios.push(input);
                });
                group.content.appendChild(field);
                group.items[config.name] = {
                    config: config,
                    elements: radios,
                };
                return;
            }
            var label = utils.createElement('label'),
                title = utils.createElement('span'),
                input = utils.createElement(config.type === 'select' ? 'select' : 'input');
            title.textContent = config.title || config.name;
            input.name = config.name;
            if (config.type !== 'select') {
                input.type = config.type || 'checkbox';
            }
            input.addEventListener('change', _onChange);
            label.appendChild(title);
            label.appendChild(input);
            group.content.appendChild(label);
            group.items[config.name] = {
                config: config,
                element: input,
            };
        }

        function _onChange(e) {
            _this.dispatchEvent(Event.CHANGE, {
                name: e.currentTarget.name,
                value: _value(e.currentTarget),
            });
        }

        function _onFooterClick(e) {
            _this.dispatchEvent(Event.CHANGE, {
                name: e.currentTarget.name,
                value: e.currentTarget.data,
            });
        }

        function _value(input) {
            switch (input.type) {
                case 'checkbox':
                    return input.checked;
                case 'number':
                case 'range':
                    return Number(input.value);
                default:
                    return input.value;
            }
        }

        function _updateItem(item, data) {
            data = utils.typeOf(data) === 'object' ? data : { value: data };
            if (item.elements) {
                utils.forEach(item.elements, function (_, input) {
                    input.checked = String(input.value) === String(data.value);
                });
                return;
            }
            var input = item.element;
            switch (item.config.type) {
                case 'select':
                    utils.emptyElement(input);
                    utils.forEach(data.options || [], function (_, value) {
                        var option = utils.createElement('option'),
                            key = utils.typeOf(value) === 'object' ? value.value : value;
                        option.value = key;
                        option.textContent = utils.typeOf(value) === 'object' ? value.label || key : value;
                        option.selected = key === data.value;
                        input.appendChild(option);
                    });
                    break;
                case 'checkbox':
                    input.checked = data.value === true;
                    break;
                case 'radio':
                    input.checked = String(input.value) === String(data.value);
                    break;
                default:
                    input.value = data.value === undefined ? '' : data.value;
                    break;
            }
        }

        _this.update = function (data) {
            _data = data || { groups: [] };
            var groups = {};
            utils.forEach(_data.groups || [], function (_, group) {
                if (!_groups[group.name]) {
                    _buildGroup(group);
                }
                groups[group.name] = group;
            });
            utils.forEach(_groups, function (name, group) {
                var source = groups[name] || {},
                    footer = {},
                    items = {};
                group.title.textContent = source.title || group.config.title || name;
                utils.forEach(source.items || [], function (_, item) {
                    if (!group.items[item.name]) {
                        _buildItem(group, item);
                    }
                    items[item.name] = item;
                });
                if (!group.footer) {
                    _buildFooter(group, source.footer);
                }
                utils.forEach(group.items, function (key, item) {
                    _updateItem(item, items[key]);
                });
                utils.forEach(source.footer || [], function (_, item) {
                    footer[item.name] = item;
                });
                utils.forEach(group.buttons, function (_, button) {
                    button.data = footer[button.name] ? footer[button.name].value : undefined;
                });
            });
            return _data;
        };

        _this.destroy = function () {
            utils.forEach(_groups, function (_, group) {
                utils.forEach(group.items, function (__, item) {
                    utils.forEach(item.elements || [item.element], function (___, input) {
                        input.removeEventListener('change', _onChange);
                    });
                });
                utils.forEach(group.buttons, function (__, button) {
                    button.removeEventListener('click', _onFooterClick);
                });
            });
            _groups = {};
            _destroy();
        };

        _init();
    }

    Settings.prototype = Object.create(Panel.prototype);
    Settings.prototype.constructor = Settings;
    Settings.prototype.kind = 'Settings';

    components.Settings = Settings;
})(odd);

