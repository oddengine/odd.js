(function (odd) {
    var utils = odd.utils,

        Module = {},
        _modules = [];

    Module.register = function (module, index) {
        try {
            _modules.splice(index || _modules.length, 0, module);
            Module[module.prototype.kind] = module;
        } catch (err) {
            throw { name: err.name, message: 'Failed to register module ' + module.prototype.kind + ': ' + err.message };
        }
    };

    Module.get = function (file, option) {
        if (option && option.module) {
            var module = odd.Module[option.module];
            if (module && module.prototype.isSupported(file) === true) {
                return module;
            }
            return null;
        }
        for (var i = 0; i < _modules.length; i++) {
            var module = _modules[i];
            if (module.prototype.isSupported(file)) {
                return module;
            }
        }
        return null;
    };

    odd.module = Module.get;
    odd.Module = Module;
})(odd);

