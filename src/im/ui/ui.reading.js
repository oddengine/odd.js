(function (odd) {
    var UI = odd.IM.UI, Protocol = odd.IM.Protocol;

    // Inline, explicitly operated history and reading controls. The renderer
    // supplies visible saved rows; this panel never infers reading from arrival.
    function Reading(im, options) {
        var _this = this, root = document.createElement('details'), heading = document.createElement('summary'),
            status = document.createElement('p'), explanation = document.createElement('p'),
            actions = document.createElement('div'), results = document.createElement('section'),
            channel = null, policy = null, generation = 0, busy = false, cursor = null, more = true,
            selected = null, snapshot = null, selectedCategory = '', detailCursor = null;
        root.className = 'im-reading';
        heading.textContent = '云历史与阅读记录';
        status.className = 'im-reading-status';
        status.tabIndex = -1;
        status.setAttribute('role', 'status');
        explanation.textContent = '公开阅读需要先开启，再手动标记当前可见消息。关闭后停止新记录，已有记录按保留期保留。';
        actions.className = 'im-reading-actions';
        results.className = 'im-reading-results';
        results.tabIndex = -1;
        results.setAttribute('aria-label', '消息阅读记录');
        [heading, status, explanation, actions, results].forEach(function (element) { root.appendChild(element); });

        function current(value) { return channel && generation === value; }
        function failure(reason) {
            var labels = {};
            labels[Protocol.Status.CONFLICT] = '阅读记录或成员身份已变化，请刷新后重试。';
            labels[Protocol.Status.EXPIRED] = '本次历史页已失效，请重新读取云历史。';
            labels[Protocol.Status.GONE] = '这条消息的云端记录已过保留期。';
            labels[Protocol.Status.EXHAUSTED] = '阅读记录达到当前存储或查询上限，请稍后刷新或联系管理员。';
            labels[Protocol.Status.FORBIDDEN] = '当前没有访问或公开阅读的权限，请刷新状态。';
            return labels[reason.code] || (reason.name === 'NotSupportedError' ? '当前会话尚未开通这项能力。' :
                reason.name === 'NotAllowedError' ? '请先开启公开阅读，并选择当前成员期内已保存的消息。' :
                reason.name === 'NotFoundError' ? '消息尚未保存到本机，请先读取历史后重试。' :
                '操作结果暂未确认，请刷新状态后再操作。');
        }
        function button(parent, label, work) {
            var value = document.createElement('button');
            value.type = 'button'; value.textContent = label;
            value.onclick = function () { run(work); };
            parent.appendChild(value);
            return value;
        }
        function update() {
            var capabilities = im.historyCapabilities(), capable = channel && capabilities.history;
            root.hidden = !channel || channel.room || channel.readOnly;
            root.setAttribute('aria-busy', busy ? 'true' : 'false');
            root.querySelectorAll('button').forEach(function (value) { value.disabled = busy || !capable; });
            cloud.disabled = busy || !capable || !policy || !more;
            restart.disabled = busy || !capable || !policy;
            consent.disabled = busy || !capable || !capabilities.publicRead || !policy || (!policy.publicReceipts && !policy.enabled);
            publish.disabled = busy || !capable || !capabilities.publicRead || !policy || !policy.enabled || !policy.publicReceipts;
            consent.textContent = policy && policy.enabled ? '关闭公开阅读' : '开启公开阅读';
            cloud.textContent = cursor ? '更早的云历史' : '读取云历史';
        }
        async function run(work) {
            if (!channel || busy) { return; }
            var version = generation, origin = document.activeElement, failed = false;
            if (root.contains(origin) && origin.tagName === 'BUTTON') { status.focus(); }
            busy = true; update();
            try { await work(version); }
            catch (reason) { if (current(version)) { failed = true; status.textContent = failure(reason); } }
            finally {
                if (current(version)) {
                    busy = false; update();
                    if (failed && origin && origin.isConnected && !origin.disabled) { origin.focus(); }
                }
            }
        }
        async function refresh(version) {
            var value = await im.receipts(channel.id, 'policy');
            if (!current(version)) { return; }
            policy = value;
            status.textContent = '云端保留 ' + value.historyDays + ' 天 · ' +
                (!im.historyCapabilities().publicRead ? '当前服务未开通公开阅读能力' :
                    value.publicReceipts ? (value.enabled ? '你已开启公开阅读' : '你尚未开启公开阅读') : '频道未开启公开阅读功能');
            var hadFocus = results.contains(document.activeElement);
            results.textContent = ''; selected = snapshot = null; detailCursor = null;
            if (options.changed) { options.changed(); }
            if (hadFocus) { results.focus(); }
            update();
        }
        var refreshButton = button(actions, '刷新阅读状态', refresh);
        async function history(version) {
            var firstPage = !cursor;
            var page = await im.history(channel.id, cursor, 32);
            if (!current(version)) { return; }
            cursor = page.nextCursor; more = page.hasMore;
            options.show(page.records, firstPage);
            var missing = page.records.some(function (record) { return record.kind === 'expired'; });
            status.textContent = missing ? '本页包含已过保留期的记录，可继续读取更早页面。' :
                page.records.length ? '历史已保存到本机；查看不会自动公开阅读。' : '当前成员期内没有可读取的云历史。';
            if (!more) { status.textContent += ' 已到当前成员期的历史起点。'; }
        }
        var cloud = button(actions, '读取云历史', history);
        var restart = button(actions, '重新读取云历史', function (version) {
            cursor = null; more = true;
            return history(version);
        });
        var consent = button(actions, '开启公开阅读', async function (version) {
            await im.receipt(channel.id, policy.enabled ? 'disable' : 'enable');
            if (current(version)) { await refresh(version); }
        });
        var publish = button(actions, '公开当前可见消息的阅读', async function (version) {
            if (document.visibilityState !== 'visible') { return; }
            var rows = options.visible().filter(function (row) { return row.incoming && row.messageId && row.sequence && row.reliable; }).slice(0, 64);
            if (!rows.length) { status.textContent = '请先在消息区显示已保存的消息。'; return; }
            await im.receipt(channel.id, 'read', { messageIds: rows.map(function (row) { return row.messageId; }) });
            if (current(version)) { status.textContent = '当前可见消息的阅读已公开；后续消息仍需手动标记。'; results.textContent = ''; }
        });

        function table(caption, headings) {
            var wrapper = document.createElement('div'), value = document.createElement('table'), title = document.createElement('caption'),
                head = document.createElement('thead'), row = document.createElement('tr'), body = document.createElement('tbody');
            wrapper.className = 'im-reading-table';
            wrapper.tabIndex = 0; wrapper.setAttribute('role', 'region'); wrapper.setAttribute('aria-label', caption);
            title.textContent = caption; value.appendChild(title);
            headings.forEach(function (label) { var cell = document.createElement('th'); cell.scope = 'col'; cell.textContent = label; row.appendChild(cell); });
            head.appendChild(row); value.appendChild(head); value.appendChild(body); wrapper.appendChild(value); results.appendChild(wrapper);
            return body;
        }
        async function summary(version) {
            var row = selected, page = await im.receipts(channel.id, 'summary', { sequences: [row.sequence] });
            if (!current(version) || selected !== row) { return; }
            results.textContent = ''; snapshot = page.snapshotRevision; detailCursor = null;
            var item = page.records[0];
            if (!item || item.state === 'expired') { status.textContent = '这条消息的云端阅读记录已过保留期。'; results.focus(); return; }
            var preview = document.createElement('p'); preview.textContent = '消息：' + String(row.text || '').slice(0, 80); results.appendChild(preview);
            var body = table('所选消息的接收成员', ['阅读情况', '人数', '查看']);
            [['read', '已公开阅读'], ['unknown', '无公开证据'], ['released', '已退出且无公开证据']].forEach(function (category) {
                var tr = document.createElement('tr'), label = document.createElement('td'), count = document.createElement('td'), action = document.createElement('td');
                label.textContent = category[1]; count.textContent = String(item[category[0]]);
                button(action, '查看成员', async function (version) { selectedCategory = category[0]; detailCursor = null; await details(version); });
                tr.appendChild(label); tr.appendChild(count); tr.appendChild(action); body.appendChild(tr);
            });
            status.textContent = '统计发送当时的接收成员，不含发送者。“无公开证据”不表示未读。';
            button(results, '刷新此消息的阅读记录', summary);
            results.focus();
        }
        async function details(version) {
            var row = selected, category = selectedCategory;
            var page = await im.receipts(channel.id, 'detail', { sequences: [row.sequence], category: category, cursor: detailCursor || undefined, limit: 32 });
            if (!current(version) || selected !== row || selectedCategory !== category) { return; }
            if (Protocol.compare64(snapshot, page.snapshotRevision) !== 0) {
                await summary(version);
                if (current(version)) { status.textContent = '阅读记录已变化，摘要已刷新，请重新选择成员分类。'; }
                return;
            }
            results.textContent = '';
            var names = { read: '已公开阅读', unknown: '无公开证据', released: '已退出且无公开证据' };
            var body = table(names[category] + '的成员', ['用户编号']);
            page.records.forEach(function (item) { var row = document.createElement('tr'), cell = document.createElement('td'); cell.textContent = item.userId; row.appendChild(cell); body.appendChild(row); });
            if (!page.records.length) { var empty = document.createElement('p'); empty.textContent = '此分类当前没有成员。'; results.appendChild(empty); }
            detailCursor = page.nextCursor;
            button(results, '返回阅读摘要', summary);
            if (page.hasMore) { button(results, '下一页成员', details); }
            results.focus();
        }
        _this.attach = function (value) {
            ++generation; channel = value; policy = null; cursor = null; more = true; busy = false;
            selected = snapshot = null; detailCursor = null; results.textContent = '';
            status.textContent = im.historyCapabilities().history ? '可刷新状态，查看本会话的保留期限。' : '当前服务尚未开通云历史与公开阅读；仍可翻阅本机记录。';
            update();
            if (channel && !channel.room && !channel.readOnly && im.historyCapabilities().history) { return run(refresh); }
            return Promise.resolve();
        };
        _this.supported = function () { return !!channel && !channel.room && !channel.readOnly && !!policy && im.historyCapabilities().publicRead; };
        _this.inspect = function (row) {
            if (!_this.supported() || busy) { return; }
            root.open = true; selected = row;
            results.focus();
            return run(summary);
        };
        _this.element = function () { return root; };
        _this.close = function () { ++generation; channel = null; policy = null; busy = false; results.textContent = ''; update(); };
        _this.destroy = function () { _this.close(); root.querySelectorAll('button').forEach(function (value) { value.onclick = null; }); root.remove(); };
        update();
    }
    UI.Reading = Reading;
})(odd);
