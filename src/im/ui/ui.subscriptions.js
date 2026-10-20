(function (odd) {
    var UI = odd.IM.UI, Event = odd.events.Event, registries = new WeakMap();

    // View ownership, not another server permission lease. Each IM connection
    // retains its existing subscribe/refresh and reliable-storage contracts.
    UI.Subscriptions = {
        acquire: function (im, target, options) {
            var registry = registries.get(im);
            if (!registry) {
                registry = { entries: new Map(), epoch: 0 };
                registries.set(im, registry);
                im.addEventListener(Event.CLOSE, function () {
                    registry.epoch++;
                    registry.entries.clear();
                });
            }
            var key = JSON.stringify([target.type, target.id, !!options.messaging, options.topic || '', options.actions || 0]),
                entry = registry.entries.get(key), epoch = registry.epoch;
            if (!entry || entry.releasing) {
                var predecessor = entry ? entry.finished : Promise.resolve();
                entry = { references: 0, releasing: false, ready: null, finished: null };
                registry.entries.set(key, entry);
                entry.ready = predecessor.catch(function () {}).then(function () {
                    if (registry.epoch !== epoch || !im.connected()) {
                        throw { name: 'AbortError', message: '会话已关闭。' };
                    }
                    return im.subscribe(target, options);
                });
                // Every consumer gets the rejection through its ready promise.
                entry.ready.catch(function () {});
            }
            entry.references++;
            var released = false;
            return {
                ready: entry.ready,
                release: function () {
                    if (released) { return; }
                    released = true;
                    entry.references--;
                    if (entry.references !== 0 || registry.epoch !== epoch) { return; }
                    entry.releasing = true;
                    entry.finished = entry.ready.then(function () {
                        if (registry.epoch === epoch && im.connected()) { return im.unsubscribe(target, options); }
                    }).finally(function () {
                        if (registry.entries.get(key) === entry) { registry.entries.delete(key); }
                    });
                    entry.finished.catch(function (reason) {
                        if (registry.epoch === epoch) {
                            im.dispatchEvent(Event.ERROR, { name: reason.name, message: reason.message || '释放窗口订阅失败。' });
                        }
                    });
                },
            };
        },
    };
})(odd);
