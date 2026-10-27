(function (odd) {
    var IM = odd.IM, UI = IM.UI, utils = odd.utils;

    UI.createView = function (im, config, logger) {
        config = config || {};
        var kinds = ['Conversation', 'Conversations', 'Contacts', 'CallPanel', 'Settings'],
            kind = config.kind, container = config.container;
        if (kinds.indexOf(kind) < 0 || !container || container.nodeType !== 1) {
            throw { name: 'DataError', message: '独立窗口需要有效的类型与容器。' };
        }
        if (kind !== 'Settings' && (!im || typeof im.addEventListener !== 'function' || typeof im.connected !== 'function')) {
            throw { name: 'DataError', message: '窗口需要借用一个 IM 实例。' };
        }
        var constructor = kind === 'Settings' ? utils.SettingsPanel : UI[kind];
        if (typeof constructor !== 'function') {
            throw { name: 'NotSupportedError', message: '未加载此窗口组件。' };
        }
        var provided = {};
        Object.keys(config).forEach(function (name) {
            if (name !== 'container' && name !== 'settings') { provided[name] = config[name]; }
        });
        var options = utils.extendz({}, constructor.prototype.CONF || {}, provided);
        var view = kind === 'Settings' ? new constructor(config.settings, options) : new constructor(im, options, logger),
            element = view.element(), originalDestroy = view.destroy, originalOpen = view.open,
            closed = false, skin = config.skin || { brand: 'im', theme: 'light' }, observer;
        element.classList.add('odd-view', 'odd-view-' + kind.toLowerCase());
        view.skin = function (value) {
            if (value !== undefined && !closed) { skin = utils.Skin.apply(element, value); }
            return utils.extendz({}, skin);
        };
        view.skin(skin);
        view.open = function (target) {
            if (closed) { return Promise.reject({ name: 'InvalidStateError', message: '窗口已关闭。' }); }
            if (!target || typeof target.id !== 'string' || ['user', 'group', 'room', 'conversation'].indexOf(target.type) < 0) {
                return Promise.reject({ name: 'DataError', message: '需要明确的会话目标。' });
            }
            if (kind === 'Conversation' && !im.connected()) {
                return Promise.reject({ name: 'InvalidStateError', message: '请先建立会话连接。' });
            }
            if (originalOpen) {
                return originalOpen.call(view, target.id, { id: target.id, name: target.name || target.id, target: target });
            }
            if (view.active) { view.active(target.id); }
            return Promise.resolve();
        };
        view.destroy = function () {
            if (closed) { return; }
            closed = true;
            if (observer) { observer.disconnect(); }
            originalDestroy.call(view);
            element.remove();
            // The borrowed IM, its storage and calls remain owned by the host.
        };
        container.appendChild(element);
        if (typeof ResizeObserver === 'function' && view.resize) {
            observer = new ResizeObserver(function (entries) {
                if (!closed) { view.resize(entries[0].contentRect.width, entries[0].contentRect.height); }
            });
            observer.observe(container);
        }
        if (config.target) { view.open(config.target).catch(function () {}); }
        return view;
    };
})(odd);
