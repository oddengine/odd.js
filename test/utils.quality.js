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
        collector.close();
        const originalInterval = window.setInterval, originalClear = window.clearInterval;
        const timers = new Map();
        let timerId = 0;
        window.setInterval = callback => { const id = ++timerId; timers.set(id, callback); return id; };
        window.clearInterval = id => timers.delete(id);
        try {
            let uploads = 0;
            collector.setup({ enabled: true }, () => { uploads++; });
            assert(timers.size === 0, 'configuration alone creates no idle health timer');
            const first = collector.session('game'), second = collector.session('im');
            assert(timers.size === 1, 'concurrent products share one active collection timer');
            first.close();
            assert(timers.size === 1, 'closing one product preserves its active sibling');
            second.close();
            await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
            assert(timers.size === 0, 'last close stops periodic health uploads');
            const settled = uploads;
            first.event('im.publish', 'info', { durationMs: 1, outcome: 0 });
            first.close(); second.close();
            await collector.flush();
            assert(uploads === settled && collector.status().queueEvents === 0,
                'late completions and duplicate closes cannot restart uploads');
            let finish;
            uploads = 0;
            collector.setup({ enabled: true }, () => {
                uploads++;
                if (uploads === 1) return new Promise(resolve => { finish = resolve; });
            });
            const inFlight = collector.session('game');
            const sending = collector.flush();
            await Promise.resolve();
            inFlight.close();
            assert(timers.size === 0, 'close stops the timer even with an in-flight batch');
            finish(); await sending;
            for (let i = 0; i < 8; i++) await Promise.resolve();
            assert(uploads <= 2 && collector.status().queueEvents === 0 && timers.size === 0,
                'an in-flight upload has at most one final drain and then becomes silent');
            const resumed = collector.session('game');
            assert(timers.size === 1, 'a subsequent channel starts collection again');
            resumed.close();
            await collector.flush();

            const clockDescriptor = Object.getOwnPropertyDescriptor(performance, 'now');
            let now = 60000;
            Object.defineProperty(performance, 'now', { configurable: true, value: () => now });
            try {
                for (const level of ['basic', 'standard', 'detailed']) {
                    rows = []; uploads = 0;
                    collector.setup({ enabled: true, level }, batch => { uploads++; rows.push(...batch); });
                    const idle = collector.session('im');
                    idle.ready();
                    await collector.flush();
                    for (let i = 0; i < 6; i++) { now += 10000; await collector.flush(); }
                    assert(uploads === 1 && timers.size === 1 && rows.some(row => row.event === 'session.ready'),
                        level + ': an open idle connection preserves lifecycle telemetry without periodic HTTP');
                    idle.fail({ code: 503 });
                    await collector.flush();
                    assert(uploads === 2 && rows.some(row => row.event === 'session.error' && row.metrics.errorCode === 503),
                        level + ': an idle connection resumes reporting on a real error');
                    idle.close(); await collector.flush();
                }

                rows = [];
                collector.setup({ enabled: true }, batch => rows.push(...batch));
                const media = collector.session('game');
                const report = new Map([['video', { id: 'video', type: 'inbound-rtp', kind: 'video',
                    timestamp: now, bytesReceived: 1000, framesDecoded: 60 }]]);
                media.stats(report); await collector.flush();
                now += 10000;
                Object.assign(report.get('video'), { timestamp: now, bytesReceived: 5000, framesDecoded: 660 });
                media.stats(report); await collector.flush();
                assert(rows.some(row => row.event === 'media.window' && row.metrics.bytes === 4000 && row.metrics.frames === 600),
                    'active media continues to report its measured window');
                media.close(); await collector.flush();

                uploads = 0;
                collector.setup({ enabled: true }, () => { uploads++; throw new Error('offline'); });
                const failed = collector.session('im');
                await collector.flush();
                for (let i = 0; i < 6; i++) { now += 10000; await collector.flush(); }
                assert(uploads === 1 && collector.status().failed > 0,
                    'a failed health upload cannot create a periodic retry loop');
                failed.fail({ code: 500 }); await collector.flush();
                assert(uploads === 2, 'subsequent real activity still reaches a failing sink');

                uploads = 0; rows = [];
                collector.setup({ enabled: true, samplePercent: 0 }, batch => { uploads++; rows.push(...batch); });
                collector.session('im');
                await collector.flush(); now += 20000; await collector.flush();
                assert(uploads === 1 && rows.length === 1 && rows[0].event === 'collector.health' && rows[0].metrics.sampled > 0,
                    'sampled-out activity is summarized once without sustaining idle traffic');
            } finally {
                if (clockDescriptor) { Object.defineProperty(performance, 'now', clockDescriptor); }
                else { delete performance.now; }
            }
        } finally {
            collector.close();
            window.setInterval = originalInterval; window.clearInterval = originalClear;
        }
        window.testResult = { passed: true, checks };
    } finally {
        collector.close();
    }
})().catch(error => { window.testResult = { passed: false, error: error.message, stack: error.stack }; });

