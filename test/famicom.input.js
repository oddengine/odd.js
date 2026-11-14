(function () {
    var checks = [], input, mask = 0, Key = odd.Famicom.Key;
    function assert(value, name) {
        if (!value) throw new Error(name);
        checks.push(name);
    }
    function key(type, code, repeat) {
        window.dispatchEvent(new KeyboardEvent(type, { code: code, repeat: !!repeat, cancelable: true }));
    }
    try {
        input = new odd.Famicom.Input({
            ports: function () { return [0]; },
            keyDown: function (_, value) { mask |= value; },
            keyUp: function (_, value) { mask &= ~value; },
            clearInput: function () { mask = 0; },
        }, document.getElementById('host'));
        [['KeyG', Key.SELECT], ['KeyH', Key.START], ['KeyJ', Key.B]].forEach(function (binding) {
            key('keydown', binding[0]);
            assert(mask === binding[1], 'default ' + binding[0] + ' action');
            key('keyup', binding[0]);
        });
        key('keydown', 'KeyK');
        assert(mask === Key.A, 'default K maps to A');
        var custom = input.keyboard();
        delete custom.KeyK;
        custom.KeyL = Key.A;
        assert(input.keyboard(custom) && mask === 0, 'remapping releases held keys');
        custom.KeyL = Key.B;
        assert(input.keyboard().KeyL === Key.A, 'setter copies the mapping');
        key('keydown', 'KeyK', true);
        key('keydown', 'KeyL', true);
        assert(mask === 0, 'held repeats cannot resume input after remapping');
        key('keyup', 'KeyK');
        key('keydown', 'KeyL');
        assert(mask === Key.A, 'new press uses the changed mapping');
        key('keyup', 'KeyL');
        assert(mask === 0, 'new binding releases normally');
        assert(!input.keyboard({ Escape: Key.A }) && input.keyboard().KeyL === Key.A,
            'reserved keys are rejected without changing the mapping');
        assert(!input.keyboard({ KeyL: 255 }), 'combined masks are rejected');
        input.enabled(false);
        key('keydown', 'KeyL');
        assert(mask === 0, 'settings pause gameplay input');
        input.enabled(true);
        key('keydown', 'KeyL', true);
        assert(mask === 0, 'closing settings requires a fresh press');
        input.keyboard(odd.Famicom.Input.Keyboard);
        key('keydown', 'KeyL');
        assert(mask === 0, 'restore removes custom bindings');
        key('keydown', 'KeyG');
        assert(mask === Key.SELECT, 'restore uses G for Select');
        input.destroy();
        key('keydown', 'KeyH');
        assert(mask === 0, 'destroy clears state and removes keyboard listeners');
        window.testResult = { passed: true, checks: checks };
    } catch (error) {
        window.testResult = { passed: false, checks: checks, error: error.message };
    } finally {
        if (input) input.destroy();
    }
})();
