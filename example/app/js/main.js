(function () {
    var ui,
        session,
        programs = [],
        streams = {},
        generation = 0,
        loading,
        ready = false,
        container = document.getElementById('app'),
        status = document.getElementById('status'),
        notice = document.getElementById('notice'),
        retry = document.getElementById('retry'),
        source = document.getElementById('source'),
        address = document.getElementById('address'),
        type = document.getElementById('type'),
        vod = document.getElementById('vod'),
        remote = document.getElementById('remote'),
        streamList = document.getElementById('streams'),
        hints = {
            contacts: '选择联系人后进入会话。演示用户可在多个页面中收发消息。',
            messages: '消息使用实际 IM 房间转发；切换页面保留会话和媒体连接。',
            play: '先打开演示连接设置，选择可用的媒体源。观看时可在右侧继续聊天。',
            meeting: '使用控制条发起通话或共享屏幕；将发布的流 ID 交给另一页面订阅。',
            game: '打开游戏设置，选择服务器上的游戏创建实例，或输入实例 ID 加入。退出请使用设置中的退出操作。',
        };

    retry.addEventListener('click', connect);
    source.addEventListener('change', selectSource);
    document.getElementById('play').addEventListener('submit', play);
    document.getElementById('subscribe').addEventListener('submit', subscribe);
    window.addEventListener('pagehide', destroy);
    window.addEventListener('pageshow', function (e) {
        if (e.persisted) {
            connect();
        }
    });
    connect();

    async function connect() {
        destroy();
        var current = generation;
        retry.disabled = true;
        status.textContent = '正在连接…';
        status.setAttribute('state', 'connecting');
        notice.textContent = '';
        container.setAttribute('aria-busy', 'true');
        loading = new AbortController();

        try {
            var response = await fetch('/demo/app.json', { credentials: 'same-origin', signal: loading.signal });
            if (!response.ok) {
                throw new Error('无法读取演示配置：HTTP ' + response.status);
            }
            session = await response.json();
            if (!session.user || !session.user.id || !session.room || !session.room.id || !session.permissions) {
                throw new Error('演示配置缺少用户、房间或权限。');
            }
            if (current !== generation) {
                return;
            }
            if (!odd.utils.getCookie('token')) {
                throw new Error('演示接口没有设置 token cookie。请使用配套的 http-inline 配置。');
            }
            loading = null;

            programs = session.programs || [];
            programs.forEach(function (program) {
                (program.sources || []).forEach(function (source) {
                    source.url = new URL(source.url, location.origin).href;
                });
            });
            source.innerHTML = '';
            programs.forEach(function (program, index) {
                var option = document.createElement('option');
                option.value = index;
                option.textContent = program.title;
                source.appendChild(option);
            });
            selectSource();

            var contacts = [{ id: session.room.id, type: 'channel', name: session.room.name },
                { id: session.user.id, type: 'people', name: session.user.name + '（我的设备）' }],
                rtc = { profile: '360P_2', whip: location.origin + '/whip/live', whep: location.origin + '/whep/live' },
                app = odd.app.ui.create({ level: 'warn', mode: 'console' });
            ui = app;
            app.addEventListener(odd.events.AppEvent.SECTION_CHANGE, onSectionChange);
            app.addEventListener(odd.events.Event.ERROR, onError);
            app.addEventListener(odd.events.MouseEvent.CLICK, onClick);
            app.addEventListener(odd.events.MediaEvent.SCREENSHOT, onScreenshot);
            await app.setup(container, {
                section: new URLSearchParams(location.search).get('section') || 'messages',
                skin: 'classic',
                labels: {
                    media: '返回媒体',
                    play: '返回观看',
                    game: '返回游戏',
                    meeting: '返回会议',
                },
                modules: {
                    im: {
                        url: (location.protocol === 'https:' ? 'wss:' : 'ws:') + '//' + location.host + '/im',
                        retry: { count: 3, delay: 2000 },
                        user: session.user,
                        labels: {
                            contacts: '联系人',
                            messages: '聊天',
                            dashboard: '设置',
                            play: '观看',
                            game: '游戏',
                            meeting: '会议',
                        },
                        plugins: [{
                            kind: 'Contacts',
                            active: session.room.id,
                        }, {
                            kind: 'Conversations',
                            active: session.room.id,
                        }, {
                            kind: 'Conversation',
                            active: session.room.id,
                            contacts: contacts,
                            composer: {
                                placeholder: '发送消息…',
                                labels: {
                                    send: '发送',
                                    emoji: '表情',
                                    file: '文件',
                                    'video-call': '视频通话',
                                    'voice-call': '语音通话',
                                },
                            },
                        }, {
                            kind: 'Dashboard',
                            visibility: false,
                        }],
                    },
                    player: {
                        autoplay: false,
                        playlist: programs,
                        rtc: rtc,
                        service: { script: 'js/sw.js', scope: 'js/', enable: false },
                        plugins: [{ kind: 'Poster', file: 'image/live-poster.svg' },
                            { kind: 'Logo', visibility: false },
                            { kind: 'Chat', visibility: false }],
                    },
                    meeting: rtc,
                    game: { base: location.origin + '/famicom' },
                },
            });
            if (current !== generation) {
                app.destroy('cancelled');
                return;
            }

            var im = app.module('im');
            contacts.forEach(function (contact) {
                im.plugins['Contacts'].add(contact.id, contact.type, contact.name);
                im.plugins['Conversations'].add(contact.id, contact.type, contact.name);
            });
            await im.join(session.room.id);
            if (current !== generation) {
                return;
            }
            im.addEventListener(odd.events.IMEvent.MESSAGE, onMessage);
            app.module('meeting').addEventListener(odd.events.NetStatusEvent.NETSTATUS, onRTCStatus);
            app.module('player').addEventListener(odd.events.Event.CHANGE, onPlayerChange);

            ready = true;
            status.textContent = '';
            status.setAttribute('state', 'connected');
            onSectionChange({ data: { value: app.section() } });
            document.getElementById('identity').textContent = session.user.name + ' · ' + session.room.name;
            container.setAttribute('aria-busy', 'false');

            var name = new URLSearchParams(location.search).get('subscribe');
            if (name) {
                remote.value = name;
                app.section('meeting');
                var stream = await app.module('meeting').play(name);
                addStream(stream, name, false);
            }
        } catch (err) {
            if (current !== generation || err.name === 'AbortError') {
                return;
            }
            if (!ready && ui) {
                ui.destroy(err.message);
                ui = null;
            }
            status.textContent = ready ? '操作失败' : '连接失败';
            status.setAttribute('state', ready ? 'connected' : 'closed');
            showError(err);
        } finally {
            if (current === generation) {
                retry.disabled = false;
                container.setAttribute('aria-busy', 'false');
            }
        }
    }

    function selectSource() {
        var program = programs[Number(source.value)];
        if (!program || !program.sources || !program.sources.length) {
            return;
        }
        address.value = program.sources[0].url;
        type.value = program.type;
        vod.checked = !!program.vod;
    }

    function play(e) {
        e.preventDefault();
        if (!ready || !session.permissions.play) {
            showError(new Error('尚未连接或没有播放权限。'));
            return;
        }

        var url;
        try {
            url = new URL(address.value, location.href);
            if (url.protocol !== 'http:' && url.protocol !== 'https:') {
                throw new Error('请输入 HTTP 或 HTTPS 播放地址。');
            }
        } catch (err) {
            showError(err);
            return;
        }
        notice.textContent = '';
        ui.section('play');
        ui.module('player').play({
            title: source.options[source.selectedIndex] ? source.options[source.selectedIndex].textContent : '自定义播放源',
            type: type.value,
            vod: vod.checked,
            sources: [{ url: url.href, label: '原始画质' }],
        });
    }

    async function subscribe(e) {
        e.preventDefault();
        if (!ready || !session.permissions.play) {
            showError(new Error('尚未连接或没有订阅权限。'));
            return;
        }
        var name = remote.value.trim();
        if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
            showError(new Error('请输入发布页面显示的流 ID。'));
            return;
        }

        notice.textContent = '';
        ui.section('meeting');
        try {
            var stream = await ui.module('meeting').play(name);
            if (stream) {
                addStream(stream, name, false);
            }
        } catch (err) {
            showError(err);
        }
    }

    function onSectionChange(e) {
        document.getElementById('hint').textContent = hints[e.data.value] || '';
    }

    function onMessage(e) {
        if (ui && ui.section() === 'play' && e.data.target.type === 'room' &&
            e.data.target.id === session.room.id && typeof e.data.content === 'string') {
            ui.module('player').comment(e.data.content, { color: '#e6e6e6' });
        }
    }

    function onRTCStatus(e) {
        if (e.data.code === odd.events.Code.NETSTREAM_PUBLISH_START) {
            addStream(e.srcElement, e.data.info.stream, true);
        } else if (e.data.level === 'error') {
            showError({ name: e.data.code, message: e.data.description });
        }
    }

    function addStream(stream, name, publishing) {
        if (!name || streams[name]) {
            return;
        }
        var row = document.createElement('div'),
            label = document.createElement('label'),
            input = document.createElement('input');
        row.className = 'demo-stream';
        label.textContent = publishing ? '本机发布，可供其他页面订阅' : '已订阅';
        input.value = name;
        input.readOnly = true;
        input.setAttribute('aria-label', label.textContent);
        input.addEventListener('focus', function () { input.select(); });
        label.appendChild(input);
        row.appendChild(label);

        if (!publishing) {
            var stop = document.createElement('button');
            stop.type = 'button';
            stop.textContent = '停止订阅';
            stop.addEventListener('click', function () {
                if (ui) {
                    ui.module('meeting').stop(stream.name());
                }
            });
            row.appendChild(stop);
        }
        streamList.appendChild(row);
        streams[name] = row;
        stream.addEventListener(odd.events.Event.RELEASE, function onRelease() {
            stream.removeEventListener(odd.events.Event.RELEASE, onRelease);
            row.remove();
            delete streams[name];
        });
    }

    async function onClick(e) {
        switch (e.data.name) {
            case 'voice-call':
            case 'video-call':
                if (!ready || !session.permissions.publish) {
                    showError(new Error('尚未连接或没有发布权限。'));
                    return;
                }
                if (e.data.conversation !== session.room.id) {
                    showError(new Error('当前演示提供房间会议，尚未接入私聊呼叫邀请。请切换到房间会话。'));
                    return;
                }
                try {
                    var meeting = ui.module('meeting');
                    ui.section('meeting');
                    await meeting.microphone(true);
                    await meeting.camera(e.data.name === 'video-call');
                    await meeting.call();
                } catch (err) {
                    showError(err);
                }
                break;
            case 'file':
                notice.textContent = '演示尚未接入文件上传服务，所选文件未发送。';
                break;
            case 'report':
                notice.textContent = '演示尚未接入内容举报服务。';
                break;
        }
    }

    async function onPlayerChange(e) {
        if (e.data.name !== 'chat' || !ready) {
            return;
        }
        try {
            var meeting = ui.module('meeting');
            if (e.data.value) {
                if (!session.permissions.publish) {
                    throw new Error('没有发布权限。');
                }
                ui.section('meeting');
                var stream = await meeting.call();
                stream.addEventListener(odd.events.Event.RELEASE, function onRelease() {
                    stream.removeEventListener(odd.events.Event.RELEASE, onRelease);
                    if (ui) {
                        ui.module('player').chat(false);
                    }
                });
            } else {
                await meeting.hangup();
            }
        } catch (err) {
            ui.module('player').chat(false);
            showError(err);
        }
    }

    function onScreenshot(e) {
        var link = document.createElement('a');
        link.href = e.data.image;
        link.download = 'capture.png';
        link.click();
    }

    function onError(e) {
        if (e.srcElement.kind === 'Conversation') {
            return;
        }
        showError(e.data);
    }

    function showError(err) {
        notice.textContent = (err.name ? err.name + ': ' : '') + (err.message || String(err));
    }

    function destroy() {
        generation++;
        ready = false;
        if (loading) {
            loading.abort();
            loading = null;
        }
        if (ui) {
            ui.destroy('leaving demo');
            ui = null;
        }
        streams = {};
        streamList.innerHTML = '';
    }
})();

