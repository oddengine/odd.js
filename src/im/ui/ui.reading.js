(function (odd) {
    var UI = odd.IM.UI, Protocol = odd.IM.Protocol;
    function Reading(im, options) {
        var _this = this, root = document.createElement('section'), header = document.createElement('header'),
            heading = document.createElement('h3'), status = document.createElement('p'),
            results = document.createElement('div'), list = document.createElement('ul'),
            channel = null, policy = null, generation = 0, cursor = null, more = true,
            selected = null, snapshot = null, detailCursor = null, detailMore = false,
            inspected = false, origin = null, historyPending = null, published = new Set(), publishing = false,
            summaries = new Map(), querying = false, timer = null, members = [], names = new Map(), detailBusy = false, detailGeneration = 0;
        root.className = 'im-reading'; root.id = 'im-reading-' + odd.utils.guid();
        root.setAttribute('role', 'dialog'); root.setAttribute('aria-label', '已读成员');
        heading.textContent = '已读成员'; status.className = 'im-reading-status'; status.setAttribute('role', 'status');
        results.className = 'im-reading-members'; results.tabIndex = 0; results.setAttribute('aria-label', '已读成员列表');
        list.className = 'im-reading-list'; results.appendChild(list);
        function icon(path) {
            var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
            svg.setAttribute('stroke-width', '1.8'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
            var line = document.createElementNS(svg.namespaceURI, 'path'); line.setAttribute('d', path); svg.appendChild(line); return svg;
        }
        function action(label, path, handler) {
            var button = document.createElement('button'); button.type = 'button'; button.title = label; button.setAttribute('aria-label', label);
            button.appendChild(icon(path)); button.onclick = handler; return button;
        }
        var close = action('关闭已读成员', 'M6 6l12 12M18 6L6 18', function () { dismiss(true); });
        var retry = action('重新加载已读成员', 'M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M18 18a8 8 0 0 1-13-3', function () { loadMembers(!members.length); });
        retry.hidden = true; header.appendChild(heading); header.appendChild(retry); header.appendChild(close);
        root.appendChild(header); root.appendChild(results); root.appendChild(status);
        function current(value) { return channel && generation === value; }
        function update() { root.hidden = !channel || !inspected; }
        function position() {
            if (!origin || !origin.isConnected) { dismiss(false); return; }
            var box = origin.getBoundingClientRect(), viewport = window.visualViewport,
                left = viewport ? viewport.offsetLeft : 0, top = viewport ? viewport.offsetTop : 0,
                width = viewport ? viewport.width : window.innerWidth, height = viewport ? viewport.height : window.innerHeight;
            root.style.width = Math.min(288, width - 24) + 'px';
            root.style.maxHeight = Math.min(380, height - 24) + 'px';
            var bounds = root.getBoundingClientRect(), x = box.left - bounds.width - 8;
            if (x < left + 12) { x = box.right + 8; }
            root.style.left = Math.max(left + 12, Math.min(x, left + width - bounds.width - 12)) + 'px';
            root.style.top = Math.max(top + 12, Math.min(box.bottom - bounds.height, top + height - bounds.height - 12)) + 'px';
        }
        function outside(event) { if (!root.contains(event.target) && !origin?.contains(event.target)) { dismiss(false); } }
        function escape(event) { if (event.key === 'Escape') { event.preventDefault(); dismiss(true); } }
        function scrollOutside(event) { if (event.target !== results && !root.contains(event.target)) { dismiss(false); } }
        function dismiss(focus) {
            inspected = false; detailGeneration++; detailBusy = false; update();
            document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape);
            document.removeEventListener('scroll', scrollOutside, true); window.removeEventListener('resize', position);
            if (origin) { origin.setAttribute('aria-expanded', 'false'); if (focus && origin.isConnected) { origin.focus(); } }
        }
        _this.hide = function () { dismiss(false); };
        function key(row) { return row.sequence.high + ':' + row.sequence.low; }
        function count(row, item) {
            var value = item && item.state !== 'expired' ? { count: item.read, complete: item.read > 0 && item.unknown === 0 && item.released === 0 } : null;
            summaries.set(key(row), { value: value, at: Date.now() });
            while (summaries.size > 256) { summaries.delete(summaries.keys().next().value); }
            if (options.counts) { options.counts(row.id, value); }
        }
        _this.summary = function (row) { return row.sequence ? summaries.get(key(row))?.value : null; };
        _this.refresh = async function () {
            if (!_this.supported() || querying || !options.active()) { return; }
            var version = generation, rows = options.visible().filter(function (row) {
                var cached = row.sequence && summaries.get(key(row));
                return !row.incoming && row.reliable && row.sequence && (!cached || Date.now() - cached.at >= 10000);
            }).slice(0, 50);
            if (!rows.length) { return; }
            querying = true;
            try {
                var page = await im.receipts(channel.id, 'summary', { sequences: rows.map(function (row) { return row.sequence; }) });
                if (!current(version)) { return; }
                rows.forEach(function (row) { count(row, page.records.find(function (item) { return Protocol.compare64(item.sequence, row.sequence) === 0; })); });
            } catch (reason) {
                // Unknown is not zero and never a completed-read check mark.
                if (current(version)) { rows.forEach(function (row) { count(row, null); }); }
            } finally { if (current(version)) { querying = false; } }
        };
        _this.preferences = async function (enabled) {
            var version = generation, value = channel;
            if (!value || value.room || value.readOnly || !im.historyCapabilities().publicRead) {
                throw new DOMException('此聊天不支持已读回执。', 'NotSupportedError');
            }
            if (typeof enabled === 'boolean') { await im.receipt(value.id, enabled ? 'enable' : 'disable'); }
            var result = await im.receipts(value.id, 'policy');
            if (!current(version) || channel !== value) { throw new DOMException('聊天已切换。', 'AbortError'); }
            policy = result;
            if (!policy.enabled) { published.clear(); }
            if (options.changed) { options.changed(); }
            return { enabled: policy.enabled, available: policy.publicReceipts, historyDays: policy.historyDays };
        };
        _this.history = function (restart) {
            if (historyPending) { return historyPending; }
            if (!channel || channel.room || !im.historyCapabilities().history || (!restart && !more)) { return Promise.resolve(false); }
            var version = generation, value = channel;
            if (restart) { cursor = null; more = true; }
            var pending = im.history(value.id, cursor, 32).then(function (page) {
                if (!current(version) || channel !== value) { return false; }
                cursor = page.nextCursor; more = page.hasMore;
                options.show(page.records);
                return more;
            }).catch(function (reason) {
                if (current(version) && reason.code === Protocol.Status.EXPIRED) { cursor = null; more = true; }
                throw reason;
            }).finally(function () { if (historyPending === pending) { historyPending = null; } });
            historyPending = pending; return pending;
        };
        _this.hasMore = function () { return !!channel && !channel.room && im.historyCapabilities().history && more; };
        _this.seen = async function () {
            if (!channel || !policy || !policy.enabled || !policy.publicReceipts || publishing || !options.active()) { return; }
            var version = generation, value = channel;
            var rows = options.visible().filter(function (row) {
                return row.incoming && row.messageId && row.sequence && row.reliable && !published.has(row.id);
            }).slice(0, 64);
            if (!rows.length) { return; }
            publishing = true;
            try {
                await im.receipt(value.id, 'read', { messageIds: rows.map(function (row) { return row.messageId; }) });
                if (current(version)) {
                    rows.forEach(function (row) { published.add(row.id); });
                    while (published.size > 256) { published.delete(published.values().next().value); }
                }
            } catch (reason) {
                // Consent can be withdrawn on another device. Never turn it
                // back on, and never infer success from a missing response.
                if (current(version)) { policy = null; }
            } finally { if (current(version)) { publishing = false; } }
        };

        function renderMembers() {
            // Only the visible rows are DOM nodes; paging remains user driven.
            var first = Math.max(0, Math.floor(results.scrollTop / 48) - 3), last = Math.min(members.length, first + 18);
            list.style.height = members.length * 48 + 'px'; list.textContent = '';
            for (var i = first; i < last; i++) {
                var id = members[i], name = names.get(id) || '成员', row = document.createElement('li'), avatar = document.createElement('span'), label = document.createElement('span');
                row.style.top = i * 48 + 'px'; row.setAttribute('aria-posinset', i + 1); row.setAttribute('aria-setsize', members.length);
                avatar.className = 'im-reading-avatar'; avatar.setAttribute('aria-hidden', 'true'); avatar.textContent = Array.from(name).slice(0, 2).join('');
                label.textContent = name; label.title = name; row.appendChild(avatar); row.appendChild(label); list.appendChild(row);
            }
        }
        async function loadMembers(reset, retried) {
            if (!inspected || !channel || detailBusy) { return; }
            var version = generation, choice = ++detailGeneration, row = selected, id = channel.id;
            if (reset) { members = []; names.clear(); detailCursor = null; snapshot = null; results.scrollTop = 0; renderMembers(); }
            detailBusy = true; retry.hidden = true; status.textContent = '正在加载…'; root.setAttribute('aria-busy', 'true');
            try {
                var page = await im.receipts(id, 'detail', { sequences: [row.sequence], category: 'read', cursor: detailCursor || undefined, limit: 32 });
                if (!current(version) || choice !== detailGeneration || !inspected) { return; }
                if (snapshot && Protocol.compare64(snapshot, page.snapshotRevision) !== 0) {
                    if (!retried) { detailBusy = false; return loadMembers(true, true); }
                    throw new Error('Receipt snapshot changed');
                }
                snapshot = page.snapshotRevision; detailCursor = page.nextCursor; detailMore = page.hasMore;
                var added = page.records.map(function (item) { return item.userId; });
                added.forEach(function (id) { if (members.indexOf(id) < 0 && members.length < 65535) { members.push(id); } });
                if (options.names && added.length) {
                    var profiles = await options.names(added).catch(function () { return []; });
                    if (!current(version) || choice !== detailGeneration || !inspected) { return; }
                    profiles.forEach(function (value) { if (added.indexOf(value.id) >= 0 && value.name) { names.set(value.id, value.name); } });
                }
                heading.textContent = '已读成员' + (detailMore ? '' : ' · ' + members.length);
                status.textContent = members.length ? '' : '暂无已读成员';
                renderMembers(); position();
            } catch (reason) {
                if (!retried && reason.code === Protocol.Status.CONFLICT && current(version) && choice === detailGeneration && inspected) { detailBusy = false; return loadMembers(true, true); }
                if (current(version) && choice === detailGeneration && inspected) { status.textContent = '暂时无法加载'; retry.hidden = false; }
            } finally { if (current(version) && choice === detailGeneration) { detailBusy = false; root.setAttribute('aria-busy', 'false'); } }
        }
        results.addEventListener('scroll', function () {
            renderMembers();
            if (detailMore && !detailBusy && results.scrollHeight - results.scrollTop - results.clientHeight < 100) { loadMembers(false); }
        }, { passive: true });
        _this.attach = function (value) {
            _this.close(); channel = value; cursor = null; more = true; summaries.clear(); names.clear(); update();
            timer = setInterval(function () { _this.refresh(); }, 10000);
            if (channel && !channel.room && !channel.readOnly && im.historyCapabilities().publicRead) { return _this.preferences().catch(function () {}); }
            return Promise.resolve();
        };
        _this.supported = function () { return !!channel && !channel.room && !channel.readOnly && im.historyCapabilities().publicRead; };
        _this.inspect = function (row, anchor) {
            if (!_this.supported() || !anchor) { return; }
            if (inspected && origin === anchor) { dismiss(true); return; }
            dismiss(false); inspected = true; selected = row; origin = anchor;
            var style = getComputedStyle(options.host());
            ['ink', 'muted', 'accent', 'onaccent', 'line', 'selected', 'glass-solid', 'glass-content'].forEach(function (name) {
                root.style.setProperty('--odd-' + name, style.getPropertyValue('--odd-' + name));
            });
            document.body.appendChild(root); update(); position(); close.focus({ preventScroll: true });
            origin.setAttribute('aria-haspopup', 'dialog'); origin.setAttribute('aria-controls', root.id); origin.setAttribute('aria-expanded', 'true');
            document.addEventListener('pointerdown', outside); document.addEventListener('keydown', escape);
            document.addEventListener('scroll', scrollOutside, true); window.addEventListener('resize', position);
            return loadMembers(true);
        };
        _this.element = function () { return root; };
        _this.close = function () {
            dismiss(false); ++generation; clearInterval(timer); timer = null; channel = policy = null;
            querying = publishing = false; historyPending = null; published.clear(); members = []; list.textContent = ''; update();
        };
        _this.destroy = function () { _this.close(); close.onclick = retry.onclick = null; root.remove(); };
        update();
    }
    UI.Reading = Reading;
})(odd);
