(function (odd) {
    var utils = odd.utils, _id = 0;

    // Owns presentation of existing controls, never their media actions. The
    // original nodes and event dispatchers survive every overflow transition.
    function MediaControls(container, content, entries, config) {
        var _this = this, _closed = false, _frame = 0, _dragging = false,
            _more, _moreTooltip, _drawer, _close, _body, _observer, _resizeObserver, _wrapper, _reveal, _activity, _visible = true,
            _labels = utils.extendz({ more: 'More controls', close: 'Close controls', controls: 'Media controls' }, config.labels || {});

        function _init() {
            content.classList.add('pe-controls-row');
            container.setAttribute('aria-label', _labels.controls);
            container.id = 'pe-media-controls-' + (++_id);
            _more = utils.createElement('button', 'pe-button more');
            _more.type = 'button';
            _more.setAttribute('aria-label', _labels.more);
            _more.setAttribute('aria-expanded', 'false');
            _more.setAttribute('aria-controls', 'pe-controls-' + (++_id));
            _more.addEventListener('click', _onMore);
            _moreTooltip = utils.createElement('span', 'pe-tooltip');
            _moreTooltip.textContent = _labels.more;
            _more.appendChild(_moreTooltip);
            var right = content.querySelector('.pe-right');
            var last = right && right.querySelector('.calling');
            (right || content).insertBefore(_more, config.module === 'rtc' ? last : null);

            _drawer = utils.createElement('section', 'pe-controls-drawer');
            _drawer.id = _more.getAttribute('aria-controls');
            _drawer.setAttribute('aria-label', _labels.more);
            _drawer.hidden = true;
            _close = utils.createElement('button', 'pe-controls-close');
            _close.type = 'button';
            _close.textContent = _labels.close;
            _close.addEventListener('click', _onMore);
            _drawer.appendChild(_close);
            _body = utils.createElement('div', 'pe-controls-tools');
            _drawer.appendChild(_body);
            container.appendChild(_drawer);

            entries.forEach(function (entry) {
                entry.anchor = document.createComment(entry.name);
                entry.element.parentNode.insertBefore(entry.anchor, entry.element);
                if (entry.component.kind !== 'Label') {
                    entry.caption = utils.createElement('span', 'pe-action-caption');
                    entry.caption.setAttribute('aria-hidden', 'true');
                    entry.element.appendChild(entry.caption);
                }
            });
            container.addEventListener('keydown', _onKeyDown);
            container.addEventListener('focusin', _onTooltipActivity);
            container.addEventListener('pointerover', _onTooltipActivity);
            container.addEventListener('focusout', _onFocusOut);
            container.addEventListener('pointerdown', _onPointerDown);
            document.addEventListener('pointerup', _onPointerUp);
            document.addEventListener('pointercancel', _onPointerUp);
            document.addEventListener('pointerdown', _onOutside);
            if (typeof MutationObserver === 'function') {
                _observer = new MutationObserver(_schedule);
                entries.forEach(function (entry) {
                    _observer.observe(entry.element, { subtree: true, childList: true, characterData: true,
                        attributes: true, attributeFilter: ['state', 'disabled', 'aria-label', 'hidden'] });
                });
            }
            if (typeof ResizeObserver === 'function') {
                _resizeObserver = new ResizeObserver(_schedule);
                _resizeObserver.observe(container);
            }
            _schedule();
        }

        function _onMore() { _this.open(_drawer.hidden); }
        _this.open = function (visible, restore) {
            _drawer.hidden = !visible;
            _more.setAttribute('aria-expanded', String(visible));
            container.setAttribute('expanded', String(visible));
            if (visible) { _close.focus(); }
            else if (restore !== false && _more.isConnected && !_more.hidden) { _more.focus(); }
            if (!visible) { _schedule(); }
        };
        function _onKeyDown(event) {
            if (event.key !== 'Escape' || event.defaultPrevented) { return; }
            event.preventDefault(); event.stopPropagation();
            if (!_drawer.hidden) { _this.open(false); }
            container.setAttribute('tooltip-dismissed', 'true');
        }
        function _onTooltipActivity() { container.removeAttribute('tooltip-dismissed'); }
        function _onFocusOut(event) {
            if (!container.contains(event.relatedTarget)) { _this.open(false, false); _schedule(); }
        }
        function _onPointerDown() { _dragging = true; }
        function _onPointerUp() { _dragging = false; _schedule(); }
        function _onOutside(event) { if (!_drawer.hidden && !container.contains(event.target)) { _this.open(false, false); } }
        _this.active = function () {
            return _dragging || !_drawer.hidden || container.contains(document.activeElement) || !!container.querySelector('[aria-expanded="true"]');
        };

        _this.bind = function (wrapper, activity) {
            if (_wrapper) { return; }
            _wrapper = wrapper; _activity = activity;
            _reveal = utils.createElement('button', 'pe-controls-reveal');
            _reveal.type = 'button'; _reveal.textContent = _labels.show || 'Show controls';
            _reveal.setAttribute('aria-controls', container.id);
            _reveal.addEventListener('click', _onReveal);
            _wrapper.appendChild(_reveal);
            _wrapper.addEventListener('focusin', _onFocusIn);
            _wrapper.addEventListener('pointerup', _onTap);
            _this.visible(true); _activity();
        };
        function _onReveal() {
            _this.visible(true); _activity();
            var first = Array.from(content.querySelectorAll('button:not(:disabled), [tabindex="0"]')).find(function (element) {
                return element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden';
            });
            if (first) { first.focus(); }
            else { container.tabIndex = -1; container.focus(); }
        }
        function _onFocusIn(event) {
            // The reveal button stays visible and focused until activation.
            if (event.target === _reveal) { return; }
            _this.visible(true); _activity();
        }
        function _onTap(event) {
            if (event.pointerType !== 'touch' || _wrapper.getAttribute('controls') !== 'motion') { return; }
            if (event.target.closest('button, a, input, select, textarea, .pe-controlbar, .pe-control-menu, .pe-playlist, .pe-rtc-rail')) { return; }
            if (_this.active()) { return; }
            _this.visible(!_visible);
            if (_visible) { _activity(); }
        }
        _this.visible = function (visible) {
            if (visible === undefined) { return _visible; }
            _visible = !!visible;
            container.setAttribute('shown', String(_visible));
            container.inert = !_visible;
            container.setAttribute('aria-hidden', String(!_visible));
            if (_wrapper) { _wrapper.setAttribute('controls-visible', String(_visible)); }
            if (_reveal) { _reveal.hidden = _visible; }
        };

        function _schedule() {
            if (_closed || _frame) { return; }
            _frame = requestAnimationFrame(function () { _frame = 0; _this.resize(); });
        }
        function _caption(entry) {
            if (!entry.caption) { return; }
            var tooltip = typeof entry.component.tooltip === 'function' ? entry.component.tooltip() : null,
                label = entry.element.getAttribute('aria-label') || tooltip && tooltip.textContent || _labels[entry.name] || entry.name;
            if (entry.caption.textContent !== label) { entry.caption.textContent = label; }
        }
        _this.resize = function () {
            if (_closed) { return; }
            entries.forEach(_caption);
            if (container.parentNode) {
                container.style.setProperty('--pe-panel-height', Math.max(24, container.parentNode.clientHeight - container.clientHeight - 24) + 'px');
            }
            if (!content.clientWidth) { return; }
            if (_this.active()) {
                // Keep the focused node in place while allowing a newly narrow
                // window to scroll. Rebalance after focus leaves the controls.
                content.setAttribute('scrollable', String(content.scrollWidth > content.clientWidth));
                return;
            }
            entries.forEach(function (entry) {
                if (entry.element.parentNode !== entry.anchor.parentNode) {
                    entry.anchor.parentNode.insertBefore(entry.element, entry.anchor.nextSibling);
                }
            });
            _more.hidden = true;
            var order = (config.module === 'rtc'
                ? ['sharing', 'settings', 'theater', 'fullscreen']
                : ['report', 'capture', 'download', 'volume', 'definition', 'comments', 'settings', 'theater', 'layout', 'muted', 'reload', 'stop']);
            var core = config.module === 'rtc' ? ['microphone', 'camera', 'layout', 'calling'] : ['playing', 'quote', 'time', 'calling', 'fullscreen'];
            var candidates = entries.filter(function (entry) { return core.indexOf(entry.name) < 0; });
            candidates.sort(function (a, b) {
                var ai = order.indexOf(a.name), bi = order.indexOf(b.name);
                return (ai < 0 ? -1 : ai) - (bi < 0 ? -1 : bi);
            });
            for (var i = 0; i < candidates.length && content.scrollWidth > content.clientWidth; i++) {
                var entry = candidates[i];
                if (!entry.element.getClientRects().length || getComputedStyle(entry.element).display === 'none') { continue; }
                _more.hidden = false;
                _body.appendChild(entry.element);
            }
            // A very small embedded window keeps core actions reachable by
            // scrolling; no applicable action is silently discarded.
            content.setAttribute('scrollable', String(content.scrollWidth > content.clientWidth));
            entries.forEach(function (entry) {
                if (_body.contains(entry.element)) { return; }
                var tooltip = typeof entry.component.tooltip === 'function' ? entry.component.tooltip() : null;
                _placeTooltip(entry.element, tooltip);
            });
            _placeTooltip(_more, _moreTooltip);
        };
        function _placeTooltip(element, tooltip) {
            if (!tooltip || !element.getClientRects().length) { return; }
            var rect = element.getBoundingClientRect(), bounds = container.getBoundingClientRect();
            tooltip.style.maxWidth = Math.max(0, bounds.width - 8) + 'px';
            var left = Math.max(bounds.left + 4, Math.min(rect.left + (rect.width - tooltip.offsetWidth) / 2, bounds.right - tooltip.offsetWidth - 4));
            tooltip.style.left = (left - rect.left) + 'px';
            tooltip.style.right = 'auto';
        }
        _this.destroy = function () {
            if (_closed) { return; }
            _closed = true;
            if (_frame) { cancelAnimationFrame(_frame); }
            if (_observer) { _observer.disconnect(); }
            if (_wrapper) {
                _wrapper.removeEventListener('focusin', _onFocusIn);
                _wrapper.removeEventListener('pointerup', _onTap);
                _reveal.removeEventListener('click', _onReveal); _reveal.remove();
            }
            if (_resizeObserver) { _resizeObserver.disconnect(); }
            container.removeEventListener('keydown', _onKeyDown);
            container.removeEventListener('focusin', _onTooltipActivity);
            container.removeEventListener('pointerover', _onTooltipActivity);
            container.removeEventListener('focusout', _onFocusOut);
            container.removeEventListener('pointerdown', _onPointerDown);
            document.removeEventListener('pointerup', _onPointerUp);
            document.removeEventListener('pointercancel', _onPointerUp);
            document.removeEventListener('pointerdown', _onOutside);
            _more.removeEventListener('click', _onMore);
            _close.removeEventListener('click', _onMore);
            entries.forEach(function (entry) { entry.anchor.remove(); if (entry.caption) { entry.caption.remove(); } });
            _more.remove(); _drawer.remove();
        };

        _init();
    }
    utils.MediaControls = MediaControls;
})(odd);
