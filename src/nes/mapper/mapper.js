(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,
        CPU = NES.CPU,

        Mapper = {};

    Mapper.register = function (mapper) {
        try {
            Mapper[mapper.prototype.id] = mapper;
        } catch (err) {
            throw { name: err.name, message: 'Failed to register mapper ' + mapper.prototype.id + ': ' + err.message };
        }
    };

    Mapper.get = function (id) {
        var mapper = Mapper[id];
        if (mapper && mapper.prototype.name) {
            return mapper;
        }
        return null;
    };

    odd.nes.mapper = Mapper.get;
    NES.Mapper = Mapper;
})(odd);

