(function (playease) {
    var utils = playease.utils,
        events = playease.events,
        EventDispatcher = events.EventDispatcher,
        UI = playease.UI,
        components = UI.components,

        CLASS_LABEL = 'pe-label';

    function Label(name, kind) {
        EventDispatcher.call(this, 'Label');

        var _this = this,
            _name,
            _kind,
            _container;

        function _init() {
            _name = name;
            _kind = kind || '';
            _container = utils.createElement('span', CLASS_LABEL + ' ' + name);
            _container.innerHTML = _kind;
        }

        _this.text = function (text) {
            if (text !== undefined) {
                _container.innerHTML = text;
            }
            return _kind;
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function (width, height) {

        };

        _init();
    }

    Label.prototype = Object.create(EventDispatcher.prototype);
    Label.prototype.constructor = Label;
    Label.prototype.kind = 'Label';

    components.Label = Label;
})(playease);

