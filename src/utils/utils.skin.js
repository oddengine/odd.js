(function (odd) {
    var brands = ['paas', 'live', 'meeting', 'im', 'account'];
    odd.utils.Skin = {
        apply: function (element, value) {
            if (!element || !value || brands.indexOf(value.brand) < 0 || ['light', 'dark'].indexOf(value.theme) < 0) {
                throw { name: 'DataError', message: '需要有效的产品皮肤与主题。' };
            }
            Array.from(element.classList).forEach(function (name) {
                if (/^odd-brand-(paas|live|meeting|im|account)$/.test(name) || /^odd-theme-(light|dark)$/.test(name)) {
                    element.classList.remove(name);
                }
            });
            element.classList.add('odd-brand-' + value.brand, 'odd-theme-' + value.theme);
            return { brand: value.brand, theme: value.theme };
        },
    };
})(odd);
