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

    Module.get = function (program) {
        var module = odd.Module[program.type];
        if (module && module.prototype.isSupported(program)) {
            return module;
        }
        return null;
    };

    odd.module = Module.get;
    odd.Module = Module;
})(odd);

