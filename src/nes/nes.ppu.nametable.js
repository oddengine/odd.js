(function (odd) {
    var utils = odd.utils,
        NES = odd.NES,
        PPU = NES.PPU;

    function NameTable(width, height, name) {
        var _this = this;

        function _init() {
            _this.width = width;
            _this.height = height;
            _this.name = name;

            _this.tile = new Array(width * height);
            _this.attrib = new Array(width * height);
        }

        _this.getTileIndex = function (x, y) {
            return _this.tile[y * _this.width + x];
        };

        _this.getAttrib = function (x, y) {
            return _this.attrib[y * _this.width + x];
        };

        _this.writeAttrib = function (index, value) {
            var basex = (index % 8) * 4;
            var basey = Math.floor(index / 8) * 4;
            var add;
            var tx, ty;
            var attindex;

            for (var sqy = 0; sqy < 2; sqy++) {
                for (var sqx = 0; sqx < 2; sqx++) {
                    add = (value >> (2 * (sqy * 2 + sqx))) & 3;
                    for (var y = 0; y < 2; y++) {
                        for (var x = 0; x < 2; x++) {
                            tx = basex + sqx * 2 + x;
                            ty = basey + sqy * 2 + y;
                            attindex = ty * _this.width + tx;
                            _this.attrib[ty * _this.width + tx] = (add << 2) & 12;
                        }
                    }
                }
            }
        };

        _init();
    }

    PPU.NameTable = NameTable;
})(odd);

