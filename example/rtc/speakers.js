// Optional example adapter. Supply the authenticated IM client, an existing RTC
// UI, and resource IDs/generations returned by the business API. No fake identity
// or separate signalling connection is created here.
async function bindRoomSpeakers(im, room, ui) {
    var bindings = [], closed = false, events = odd.events;

    function render() {
        if (!closed) { ui.speakers(im.roomSpeakers(room), bindings); }
    }

    function clear() {
        ui.speakers({ roomId: room, known: false, items: [] }, []);
    }

    function notify(e) {
        if (e.data.event === odd.IM.Protocol.Event.IM_SPEAKERS_CHANGE && e.data.payload.roomId === room) {
            render();
        }
    }

    function state(e) {
        if (e.data.target && e.data.target.type === 'room' && e.data.target.id === room) { render(); }
    }

    im.addEventListener(events.IMEvent.NOTIFY, notify);
    im.addEventListener(events.IMEvent.MESSAGE, state);
    im.addEventListener(events.Event.CLOSE, clear);
    try {
        await im.subscribe({ type: 'room', id: room }, { topic: 'events', messaging: true, speakers: true });
        render();
    } catch (error) {
        detach();
        throw error;
    }

    function detach() {
        closed = true;
        im.removeEventListener(events.IMEvent.NOTIFY, notify);
        im.removeEventListener(events.IMEvent.MESSAGE, state);
        im.removeEventListener(events.Event.CLOSE, clear);
        clear();
    }

    return {
        // Pass the current complete mapping, not names inferred from packets.
        // Include purpose: 'screen' for a remote screen resource.
        update: function (current) { bindings = current.slice(); render(); },
        close: async function () {
            detach();
            return im.unsubscribe({ type: 'room', id: room }, { topic: 'events', messaging: true });
        },
    };
}

