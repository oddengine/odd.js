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

            var bubble = utils.createElement('div', 'im-message-bubble'),
                meta = utils.createElement('header');
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
            _retry.textContent = '沿原标识重试';
            _retry.onclick = function () { if (_data.retry) { _data.retry(); } };
            _receipts = utils.createElement('button', 'im-message-receipts');
            _receipts.type = 'button';
            _receipts.textContent = '阅读记录';
            _receipts.onclick = function () { if (_data.receipts) { _data.receipts(); } };
            meta.appendChild(_from);
            meta.appendChild(_time);
            bubble.appendChild(meta);
            bubble.appendChild(_body);
            bubble.appendChild(_file);
            bubble.appendChild(_status);
            bubble.appendChild(_retry);
            bubble.appendChild(_receipts);
            _container.appendChild(_avatar.element());
            _container.appendChild(_indicator);
            _container.appendChild(bubble);
            _this.update(data);
        }

        function fileError(reason) {
            if (reason && reason.name !== 'AbortError') { _status.hidden = false; _status.textContent = reason.message || '文件暂不可用，请重试。'; }
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
            _time.textContent = _data.time || '';
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
            _receipts.hidden = !_data.receipts;
            _retry.hidden = !_data.retry || (_data.state !== State.UNKNOWN && _data.state !== 'gift-pending');
            return _data;
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
                    accepted: '服务端已接收', delivered: '投递完成', settled: '投递责任已完成',
                    saved: '已保存到本机', read: '本账号已读', expired: '已过期，先前结果可能不可用',
                    revoked: '权限已撤销', rejected: '已拒绝', 'gift-pending': '礼物交易已确认，消息待投递' };
                _status.textContent = _data.reliable ? labels[value] || value : '';
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

