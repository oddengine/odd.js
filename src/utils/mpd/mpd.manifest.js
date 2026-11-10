(function (odd) {
    var MPD = odd.utils.MPD;

    // A bounded playback snapshot, separate from the legacy incremental MPD
    // cursor. SegmentList and SegmentTemplate inherit at each DASH level. The
    // player consumes this once-parsed model without reparsing XML per track.
    MPD.parse = function (text, location, supports) {
        if (typeof text !== 'string' || text.length > 1048576 || /<!DOCTYPE|<!ENTITY/i.test(text)) { throw invalid(); }
        var document = new DOMParser().parseFromString(text, 'application/xml'), root = document.documentElement;
        if (!root || root.localName !== 'MPD' || document.getElementsByTagName('parsererror').length) { throw invalid(); }
        var dynamic = root.getAttribute('type') === 'dynamic', periods = children(root, 'Period');
        if (!periods.length || periods.length > 128) { throw invalid(); }
        var start = 0, snapshots = [];
        periods.forEach(function (period, index) {
            start = period.hasAttribute('start') ? duration(period.getAttribute('start')) : start;
            var periodDuration = period.hasAttribute('duration') ? duration(period.getAttribute('duration')) : NaN,
                parent = inherit(inherit({}, root, location), period), tracks = [];
            children(period, 'AdaptationSet').forEach(function (set, setIndex) {
                var adaptation = inherit(parent, set), variants = [];
                children(set, 'Representation').forEach(function (representation) {
                    var state = inherit(adaptation, representation), mime = representation.getAttribute('mimeType') || set.getAttribute('mimeType'),
                        codecs = representation.getAttribute('codecs') || set.getAttribute('codecs'), kind = (mime || '').split('/')[0];
                    if (['audio', 'video'].indexOf(kind) === -1) { return; }
                    if (children(set, 'ContentProtection').length || children(representation, 'ContentProtection').length) { return; }
                    var contentType = mime + (codecs ? '; codecs="' + codecs + '"' : '');
                    if (supports && !supports(contentType)) { return; }
                    var id = representation.getAttribute('id') || String(setIndex), bandwidth = number(representation, 'bandwidth', 0),
                        result = segments(state, id, bandwidth, periodDuration, start);
                    if (!result || !result.items.length) { return; }
                    variants.push({ id: id, kind: kind, mime: contentType, bandwidth: bandwidth, period: period.getAttribute('id') || String(index),
                        start: start, offset: start - result.offset, initialization: result.initialization, segments: result.items });
                });
                variants.sort(function (a, b) { return b.bandwidth - a.bandwidth; });
                if (variants.length && !tracks.some(function (track) { return track.kind === variants[0].kind; })) { tracks.push(variants[0]); }
            });
            if (tracks.length) { snapshots.push(tracks); }
            if (Number.isFinite(periodDuration)) { start += periodDuration; }
        });
        if (!snapshots.length) { throw { name: 'NotSupportedError', message: 'No supported DASH tracks are available.' }; }
        return { dynamic: dynamic, tracks: snapshots[snapshots.length - 1],
            update: Math.max(0.5, Math.min(10, duration(root.getAttribute('minimumUpdatePeriod') || 'PT2S'))),
            delay: duration(root.getAttribute('suggestedPresentationDelay') || 'PT3S') };
    };

    function invalid() { return { name: 'DataError', message: 'Invalid DASH playback manifest.' }; }
    function children(node, name) { return Array.prototype.filter.call(node.children || [], function (item) { return item.localName === name; }); }
    function first(node, name) { return children(node, name)[0]; }
    function number(node, name, fallback) {
        if (!node || !node.hasAttribute(name)) { return fallback; }
        var text = node.getAttribute(name), value = Number(text);
        if (!/^-?\d+$/.test(text) || !Number.isSafeInteger(value)) { throw invalid(); }
        return value;
    }
    function duration(text) {
        var match = /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(text);
        if (!match || !match.slice(1).some(function (part) { return part !== undefined; })) { throw invalid(); }
        var value = Number(match[1] || 0) * 86400 + Number(match[2] || 0) * 3600 + Number(match[3] || 0) * 60 + Number(match[4] || 0);
        if (!Number.isFinite(value)) { throw invalid(); }
        return value;
    }
    function resolve(path, base) {
        var result = new URL(path, base), parent = new URL(base);
        if (!result.search && result.origin === parent.origin) { result.search = parent.search; }
        return result.href;
    }
    function inherit(parent, node, location) {
        var state = { base: parent.base || location, type: parent.type, attributes: Object.assign({}, parent.attributes),
            timeline: parent.timeline, initialization: parent.initialization, urls: parent.urls }, base = first(node, 'BaseURL'),
            list = first(node, 'SegmentList'), template = first(node, 'SegmentTemplate');
        if (base) { state.base = resolve(base.textContent.trim(), state.base); }
        if (list && template) { throw invalid(); }
        var current = list || template;
        if (current) {
            var type = list ? 'list' : 'template';
            if (state.type && state.type !== type) { state.attributes = {}; state.timeline = state.initialization = state.urls = undefined; }
            state.type = type;
            Array.prototype.forEach.call(current.attributes, function (attribute) { state.attributes[attribute.name] = attribute.value; });
            state.timeline = first(current, 'SegmentTimeline') || state.timeline;
            state.initialization = first(current, 'Initialization') || state.initialization;
            var urls = children(current, 'SegmentURL');
            if (urls.length) { state.urls = urls; }
        }
        return state;
    }
    function segments(state, id, bandwidth, periodDuration, periodStart) {
        if (!state.type) { return null; }
        var values = state.attributes, scale = Number(values.timescale || 1), offset = Number(values.presentationTimeOffset || 0),
            startNumber = Number(values.startNumber || 1), points = [], urls = state.urls || [];
        if (![scale, offset, startNumber].every(Number.isSafeInteger) || scale <= 0 || offset < 0 || startNumber < 0 || urls.length > 8192) { throw invalid(); }
        if (state.timeline) {
            var entries = children(state.timeline, 'S'), time = 0;
            if (entries.length > 8192) { throw invalid(); }
            entries.forEach(function (entry, index) {
                time = number(entry, 't', time);
                var span = number(entry, 'd', 0), repeat = number(entry, 'r', 0);
                if (span <= 0 || time < 0 || repeat < -1) { throw invalid(); }
                if (repeat === -1) {
                    var end = number(entries[index + 1], 't', Number.isFinite(periodDuration) ? offset + periodDuration * scale : NaN);
                    repeat = Number.isFinite(end) ? Math.ceil((end - time) / span) - 1 : urls.length - points.length - 1;
                }
                if (repeat < 0 || points.length + repeat + 1 > 8192) { throw invalid(); }
                for (var i = 0; i <= repeat; i++) { points.push({ time: time, duration: span }); time += span; }
                if (!Number.isSafeInteger(time)) { throw invalid(); }
            });
        } else {
            var span = Number(values.duration), count = state.type === 'list' ? urls.length : Math.ceil(periodDuration * scale / span);
            if (!Number.isSafeInteger(span) || span <= 0 || !Number.isSafeInteger(count) || count < 0 || count > 8192) { throw invalid(); }
            for (var i = 0; i < count; i++) { points.push({ time: offset + i * span, duration: span }); }
        }
        if (state.type === 'list' && points.length !== urls.length) { throw invalid(); }
        function expand(pattern, point, index) {
            if (!pattern) { throw invalid(); }
            var escaped = pattern.replace(/\$\$/g, '\u0000');
            escaped = escaped.replace(/\$(RepresentationID|Bandwidth|Number|Time)(?:%0(\d+)d)?\$/g, function (_, key, width) {
                var value = { RepresentationID: id, Bandwidth: bandwidth, Number: startNumber + index, Time: point ? point.time : 0 }[key];
                if (width && (Number(width) > 20 || key === 'RepresentationID')) { throw invalid(); }
                return width ? String(value).padStart(Number(width), '0') : String(value);
            });
            if (/\$[^$]+\$/.test(escaped)) { throw invalid(); }
            return resolve(escaped.replace(/\u0000/g, '$'), state.base);
        }
        var initialization = state.type === 'template' ? expand(values.initialization, null, 0) :
            state.initialization && state.initialization.getAttribute('sourceURL') && resolve(state.initialization.getAttribute('sourceURL'), state.base);
        if (!initialization || state.initialization && state.initialization.hasAttribute('range')) { throw invalid(); }
        return { offset: offset / scale, initialization: initialization, items: points.map(function (point, index) {
            if (state.type === 'list' && (urls[index].hasAttribute('mediaRange') || !urls[index].hasAttribute('media'))) { throw invalid(); }
            return { time: periodStart + (point.time - offset) / scale, duration: point.duration / scale,
                url: state.type === 'template' ? expand(values.media, point, index) : resolve(urls[index].getAttribute('media'), state.base) };
        }) };
    }
})(odd);

