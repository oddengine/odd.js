(async function () {
    const checks = [], collector = new odd.utils.Quality();
    function assert(value, label) {
        if (!value) throw new Error(label);
        checks.push(label);
    }
    try {
        let rows = [];
        collector.setup({ enabled: true, samplePercent: 0 }, batch => rows.push(...batch));
        const skipped = collector.session('game');
        skipped.ready();
        skipped.fail({ code: 503, message: 'private message', token: 'private token' });
        await collector.flush();
        assert(rows.filter(row => row.component === 'game').length === 1 && rows.some(row => row.event === 'session.error'),
            'errors survive zero sampling');
        assert(!JSON.stringify(rows).includes('private'), 'error text and credentials are excluded');

        rows = [];
        collector.setup({ enabled: true, maxEvents: 64, batchSize: 64 }, batch => rows.push(...batch));
        const session = collector.session('im');
        for (let i = 0; i < 100; i++) session.event('im.publish', 'info', { durationMs: i, outcome: 0 });
        assert(collector.status().queueEvents === 48, 'normal events leave an urgent reserve');
        session.fail({ code: 500 });
        await collector.flush();
        assert(rows[0].event === 'session.error' && rows.length === 49, 'error is admitted and drained before normal records');

        let release, signal;
        collector.setup({ enabled: true }, (batch, abort) => {
            signal = abort;
            return new Promise(resolve => { release = resolve; });
        });
        const previous = collector.session('game');
        const pending = collector.flush();
        await Promise.resolve();
        const sent = collector.status().sent;
        collector.setup({ enabled: true }, () => {});
        assert(signal.aborted, 'reconfiguration cancels the old upload');
        previous.fail({ code: 500 });
        release();
        await pending;
        assert(collector.status().sent === sent && collector.status().queueEvents === 0,
            'old sessions and late completions cannot change the new collector');
        window.testResult = { passed: true, checks };
    } finally {
        collector.close();
    }
})().catch(error => { window.testResult = { passed: false, error: error.stack }; });

