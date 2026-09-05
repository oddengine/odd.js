var ui,
    secondary,
    violet = false,
    contacts = [{
        id: 'maya',
        type: 'people',
        name: 'Maya Chen',
        message: '正在看直播',
        date: '刚刚',
    }, {
        id: 'leo',
        type: 'people',
        name: 'Leo Wang',
        message: '在线',
        date: '12:08',
    }, {
        id: 'design',
        type: 'group',
        name: '产品设计群',
        message: '8 人在线',
        date: '昨天',
    }],
    messages = {
        maya: [{ from: 'Maya Chen', text: '晚上一起看直播？', time: '20:06' }],
        leo: [{ from: 'Leo Wang', text: '游戏房间已经准备好了。', time: '12:08' }],
    };

if (!window.odd || !odd.app || !odd.app.ui) {
    showFailure(new Error('请先在仓库根目录运行 compile.sh 生成 release/odd.min.js。'));
} else {
    ui = odd.app.ui.create({ level: 'debug' });
    ui.setup(document.getElementById('app'), {
        section: new URLSearchParams(location.search).get('section') || 'messages',
        modules: {
            im: {
                plugins: [{
                    kind: 'Contacts',
                    active: 'maya',
                }, {
                    kind: 'Conversations',
                    active: 'maya',
                }, {
                    kind: 'Dashboard',
                    visibility: false,
                }, {
                    kind: 'Conversation',
                    active: 'maya',
                    contacts: contacts,
                    conversations: messages,
                }],
            },
        },
    }).then(function () {
        var smoke = document.getElementById('smoke'),
            im = ui.module('im');
        contacts.forEach(function (item) {
            im.plugins['Contacts'].add(item.id, item.type, item.name, item.avatar);
            im.plugins['Conversations'].add(item.id, item.type, item.name, item.avatar);
            im.plugins['Conversations'].update(item.id, item.date, item.message);
        });
        ['im', 'player', 'game', 'meeting'].forEach(function (name) {
            if (!ui.module(name)) {
                throw new Error('模块未初始化：' + name);
            }
        });
        smoke.textContent = 'SDK ready';
        smoke.setAttribute('data-state', 'passed');
    }).catch(showFailure);
}

document.getElementById('theme').addEventListener('click', function () {
    violet = !violet;
    ui.skin(violet ? 'violet' : 'classic');
    if (secondary) {
        secondary.skin(violet ? 'classic' : 'violet');
    }
});

document.getElementById('multi').addEventListener('click', function () {
    var grid = document.querySelector('.demo-grid'),
        container = document.getElementById('app2'),
        visible = container.hidden;
    container.hidden = !visible;
    grid.classList.toggle('multi', visible);
    if (visible && !secondary) {
        secondary = odd.app.ui.create({ level: 'debug' });
        secondary.setup(container, { section: 'play', skin: 'violet' }).catch(showFailure);
    }
});

function showFailure(err) {
    var smoke = document.getElementById('smoke');
    smoke.textContent = err.name + ': ' + err.message;
    smoke.setAttribute('data-state', 'failed');
    console.error(err);
}

