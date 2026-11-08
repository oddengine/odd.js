(function (odd) {
    var utils = odd.utils,
        events = odd.events,
        EventDispatcher = events.EventDispatcher,
        components = odd.IM.UI.components,

        State = {
            SENDING: 'sending',
            SENT: 'sent',
            FAILED: 'failed',
            UNKNOWN: 'unknown',
            ACCEPTED: 'accepted',
            DELIVERED: 'delivered',
            SETTLED: 'settled',
            SAVED: 'saved',
            READ: 'read',
        },

        CLASS_MESSAGE = 'im-message';

    function Message(name, data, logger) {
        EventDispatcher.call(this, 'Message', { logger: logger });

        var _this = this,
            _data,
            _container,
            _avatar,
            _indicator,
            _bubble,
            _meta,
            _from,
            _time,
            _body,
            _file,
            _fileName,
            _fileSize,
            _status,
            _retry,
            _receipts;

        function _init() {
            _container = utils.createElement('article', CLASS_MESSAGE + (name ? ' ' + name : ''));
            _avatar = new components.Avatar('avatar', undefined, logger);
            _indicator = utils.createElement('span', 'im-message-state');
            _indicator.setAttribute('role', 'img');

            var content = utils.createElement('div', 'im-message-content');
            _bubble = utils.createElement('div', 'im-message-bubble');
            _meta = utils.createElement('header', 'im-message-meta');
            _from = utils.createElement('strong');
            _time = utils.createElement('time');
            _body = utils.createElement('p');
            _file = utils.createElement('button', 'im-message-file');
            _file.type = 'button';
            _fileName = utils.createElement('strong');
            _fileSize = utils.createElement('small');
            _file.appendChild(_fileName);
            _file.appendChild(_fileSize);
            _file.onclick = function () {
                if (!_data.openAttachment || _file.disabled) { return; }
                _file.disabled = true;
                // Invoke synchronously so the host can open a native save
                // picker within the user's trusted activation.
                try {
                    Promise.resolve(_data.openAttachment()).catch(fileError).finally(function () { _file.disabled = !_data.openAttachment; });
                } catch (reason) { fileError(reason); _file.disabled = false; }
            };
            _status = utils.createElement('small', 'im-message-status');
            _status.setAttribute('role', 'status');
            _retry = utils.createElement('button', 'im-message-retry');
            _retry.type = 'button';
            _retry.title = '重试发送'; _retry.setAttribute('aria-label', '重试发送');
            _retry.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M18 18a8 8 0 0 1-13-3"/></svg>';
            _retry.onclick = function () { if (_data.retry) { _data.retry(); } };
            _receipts = utils.createElement('button', 'im-message-receipts');
            _receipts.type = 'button';
            _receipts.onclick = function () { if (_data.receipts) { _data.receipts(_receipts); } };
            _meta.appendChild(_from);
            _meta.appendChild(_time);
            content.appendChild(_meta);
            _bubble.appendChild(_body);
            _bubble.appendChild(_file);
            var body = utils.createElement('div', 'im-message-body');
            body.appendChild(_receipts); body.appendChild(_bubble); content.appendChild(body);
            content.appendChild(_status);
            content.appendChild(_retry);
            _container.appendChild(_avatar.element());
            _container.appendChild(_indicator);
            _container.appendChild(content);
            _this.update(data);
        }

        function fileError(reason) {
            if (reason && reason.name !== 'AbortError') { _status.hidden = false; _status.textContent = (/[\u4e00-\u9fff]/.test(reason.message || '') ? reason.message : '文件暂不可用，请重试。'); }
        }

        _this.update = function (value) {
            _data = value || {};
            _this.align(_data.align || (_data.mine ? 'right' : 'left'));
            _avatar.update({
                name: _data.from || '?',
                avatar: _data.avatar,
                online: _data.online,
            });
            _from.textContent = _data.from || '';
            _from.hidden = !_data.showSender || !_from.textContent;
            _time.textContent = _data.time || '';
            _time.hidden = !_time.textContent;
            _meta.hidden = _from.hidden && _time.hidden;
            _body.textContent = _data.text || '';
            var file = odd.IM.UI.History.attachment(_data.attachment);
            _body.hidden = !!file;
            _file.hidden = !file;
            _file.disabled = !_data.openAttachment;
            if (file) {
                _fileName.textContent = file.name;
                var bytes = Number(file.size);
                _fileSize.textContent = (bytes < 1048576 ? Math.ceil(bytes / 1024) + ' KB' : (bytes / 1048576).toFixed(1) + ' MB') + ' · 下载文件';
                _file.setAttribute('aria-label', '下载文件：' + file.name);
            }
            _this.state(_data.state || State.SENT);
            _this.receipt(_data.receiptSummary);
            _retry.hidden = !_data.retry || (_data.state !== State.UNKNOWN && _data.state !== 'gift-pending');
            return _data;
        };

        _this.receipt = function (summary) {
            _data.receiptSummary = summary;
            _receipts.hidden = !_data.receipts || !summary;
            _receipts.textContent = '';
            if (!summary) { return; }
            var badge = document.createElement('span');
            if (summary.complete) {
                badge.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
            } else { badge.textContent = String(summary.count); }
            _receipts.appendChild(badge);
            var label = (summary.complete ? '全部已读' : summary.count + ' 人已读') + '，查看已读成员';
            _receipts.title = label; _receipts.setAttribute('aria-label', label);
        };

        _this.align = function (value) {
            if (value !== undefined) {
                _container.setAttribute('align', value === 'right' ? 'right' : 'left');
            }
            return _container.getAttribute('align');
        };

        _this.state = function (value) {
            if (value !== undefined) {
                _data.state = value;
                _container.setAttribute('state', value);
                _container.setAttribute('aria-busy', value === State.SENDING);
                _indicator.setAttribute('aria-label', value);
                _indicator.hidden = value !== State.SENDING && value !== State.FAILED;
                var labels = { sending: '正在发送', sent: '', failed: '未发送', unknown: '结果待确认',
                    accepted: '已发送', delivered: '已送达', settled: '',
                    saved: '', read: '', expired: '消息已过期',
                    revoked: '权限已撤销', rejected: '已拒绝', 'gift-pending': '礼物交易已确认，消息待投递' };
                _status.textContent = _data.reliable ? (Object.prototype.hasOwnProperty.call(labels, value) ? labels[value] : '') : '';
                _status.hidden = !_status.textContent;
            }
            return _container.getAttribute('state');
        };

        _this.data = function () {
            return _data;
        };

        _this.element = function () {
            return _container;
        };

        _this.resize = function () {
            var height = _body.getBoundingClientRect().height;
            var line = parseFloat(getComputedStyle(_body).lineHeight) || 24;
            _bubble.setAttribute('single-line', !_body.hidden && height > 0 && height <= line + 1 ? 'true' : 'false');
        };

        _this.destroy = function () {
            _retry.onclick = null;
            _receipts.onclick = null;
            _file.onclick = null;
            _avatar.destroy();
            _container.innerHTML = '';
        };

        _init();
    }

    Message.prototype = Object.create(EventDispatcher.prototype);
    Message.prototype.constructor = Message;
    Message.prototype.kind = 'Message';

    Message.State = State;

    components.Message = Message;
})(odd);

