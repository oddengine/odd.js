(function () {
    var Event = odd.events.Event,
        IMEvent = odd.events.IMEvent,
        Protocol = odd.IM.Protocol,
        base = document.querySelector('meta[name="odd-api"]').content.replace(/\/$/, ''),
        status = document.getElementById('status'),
        ui = null,
        session = null,
        selected = '',
        joining = '',
        generation = 0,
        controller = new AbortController(),
        renewal = null,
        retry = null,
        expiresAt = 0,
        busy = false,
        challenge = null,
        creation = null,
        roomCursor = '',
        memberCursor = '';

    document.getElementById('login').addEventListener('submit', function (event) {
        event.preventDefault();
        var form = event.currentTarget;

        run(async function () {
            await request('/session', 'POST', {
                email: form.elements.namedItem('email').value,
                password: form.elements.namedItem('password').value,
            });
            form.elements.namedItem('password').value = '';
            await connect();
        });
    });

    document.getElementById('challenge').addEventListener('submit', function (event) {
        event.preventDefault();
        var form = event.currentTarget;

        run(async function () {
            challenge = null;
            var purpose = form.elements.namedItem('purpose').value,
                result = await request('/identity/challenges', 'POST', { email: form.elements.namedItem('email').value, purpose: purpose });
            challenge = {
                id: result.challengeId,
                purpose: purpose,
                expiresAt: Number(result.expiresAt),
            };
            status.textContent = 'Verification email sent.';
        });
    });

    document.getElementById('verify').addEventListener('submit', function (event) {
        event.preventDefault();
        var form = event.currentTarget;

        run(async function () {
            if (!challenge || challenge.expiresAt <= Date.now()) {
                throw new Error('Request a new verification code first.');
            }
            var current = challenge,
                body = {
                    challengeId: current.id,
                    code: form.elements.namedItem('code').value,
                    password: form.elements.namedItem('password').value,
                };
            challenge = null;
            if (current.purpose === 'register') {
                body.name = form.elements.namedItem('name').value;
            }
            await request(current.purpose === 'register' ? '/users' : '/password/reset', 'POST', body);
            form.reset();
            status.textContent = 'Completed. Sign in with your password.';
        });
    });

    document.getElementById('logout').addEventListener('click', function () {
        run(async function () {
            disconnect();
            await request('/session', 'DELETE');
            signedOut();
        });
    });

    document.getElementById('reconnect').addEventListener('click', function () { run(connect); });
    document.getElementById('room-create').addEventListener('submit', function (event) {
        event.preventDefault();
        var form = event.currentTarget;

        run(async function () {
            var fingerprint = form.elements.namedItem('name').value + '\n' + form.elements.namedItem('visibility').value;
            if (!creation || creation.fingerprint !== fingerprint) {
                creation = { fingerprint: fingerprint, id: crypto.randomUUID() };
            }
            var room = await request('/rooms', 'POST', {
                name: form.elements.namedItem('name').value,
                visibility: form.elements.namedItem('visibility').value,
                creationId: creation.id,
            });
            // Keep the key until the form changes: a lost response must not create another room.
            await enter(room.id);
            await rooms(false);
        });
    });

    document.getElementById('room-join').addEventListener('submit', function (event) {
        event.preventDefault();
        var id = event.currentTarget.elements.namedItem('room').value.trim();
        run(function () { return enter(id); });
    });
    document.getElementById('leave').addEventListener('click', function () {
        run(async function () {
            var id = selected;
            if (!id) {
                return;
            }
            await request('/rooms/' + encodeURIComponent(id) + '/members/me', 'DELETE');
            selected = '';
            if (ui) {
                try {
                    await ui.leave(id);
                } catch (err) {
                    disconnect();
                    throw err;
                }
                removeRoom(id);
            }
            document.getElementById('room-id').value = '';
        });
    });

    document.getElementById('close-room').addEventListener('click', function () {
        run(async function () {
            if (!selected) {
                return;
            }
            var id = selected;
            await request('/rooms/' + encodeURIComponent(id), 'DELETE');
            selected = '';
            if (ui) {
                try {
                    await ui.leave(id);
                } catch (err) {
                    disconnect();
                    throw err;
                }
                removeRoom(id);
            }
            await rooms(false);
        });
    });

    document.getElementById('refresh-rooms').addEventListener('click', function () { run(function () { return rooms(false); }); });
    document.getElementById('more-rooms').addEventListener('click', function () { run(function () { return rooms(true); }); });
    document.getElementById('refresh-members').addEventListener('click', function () { run(function () { return members(false); }); });
    document.getElementById('more-members').addEventListener('click', function () { run(function () { return members(true); }); });
    document.getElementById('member').addEventListener('submit', function (event) {
        event.preventDefault();
        var form = event.currentTarget;

        run(async function () {
            if (!selected) {
                throw new Error('Select a room first.');
            }
            await request('/rooms/' + encodeURIComponent(selected) + '/members/' + encodeURIComponent(form.elements.namedItem('userId').value), 'PUT', {
                role: form.elements.namedItem('role').value,
                state: form.elements.namedItem('state').value,
                muted: form.elements.namedItem('muted').checked,
            });
            await members(false);
        });
    });

    document.getElementById('transfer').addEventListener('submit', function (event) {
        event.preventDefault();
        var id = event.currentTarget.elements.namedItem('userId').value;
        run(async function () {
            if (!selected) {
                throw new Error('Select a room first.');
            }
            await request('/rooms/' + encodeURIComponent(selected) + '/owner', 'PUT', { userId: id });
            await members(false);
        });
    });

    async function request(path, method, body) {
        var current = generation,
            operation = new AbortController(),
            parent = controller.signal,
            cancel = function () { operation.abort(); },
            timeout = setTimeout(cancel, 30000);
        parent.addEventListener('abort', cancel, { once: true });
        if (parent.aborted) {
            cancel();
        }
        try {
            var response = await fetch(base + path, {
                method: method || 'GET',
                credentials: 'same-origin',
                headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: operation.signal,
            });
            var result = response.status === 204 ? null : await response.json();
            if (current !== generation) {
                throw new DOMException('Cancelled', 'AbortError');
            }
            if (!response.ok) {
                var error = new Error(result.message || 'HTTP ' + response.status);
                error.status = response.status;
                throw error;
            }
            return result;
        } finally {
            clearTimeout(timeout);
            parent.removeEventListener('abort', cancel);
        }
    }

    async function run(action) {
        if (busy) {
            return;
        }
        busy = true;
        document.querySelectorAll('#account button').forEach(function (button) { button.disabled = true; });
        status.textContent = '';
        try {
            await action();
        } catch (err) {
            if (err.status === 401) {
                signedOut();
            }
            if (err.name !== 'AbortError') {
                status.textContent = err.message;
            }
        } finally {
            busy = false;
            document.querySelectorAll('#account button').forEach(function (button) { button.disabled = false; });
        }
    }

    function disconnect() {
        generation++;
        controller.abort();
        controller = new AbortController();
        clearTimeout(renewal);
        clearTimeout(retry);
        renewal = retry = null;
        expiresAt = 0;
        joining = '';

        var previous = ui;
        ui = null;
        if (previous) {
            previous.destroy();
        }
    }

    function signedOut() {
        disconnect();
        session = null;
        selected = '';
        creation = null;
        document.getElementById('signed-in').hidden = true;
        document.getElementById('signed-out').hidden = false;
        document.getElementById('identity').textContent = '';
    }

    async function connect() {
        disconnect();
        var current = generation;
        session = await request('/session');
        document.getElementById('signed-in').hidden = false;
        document.getElementById('signed-out').hidden = true;
        document.getElementById('identity').textContent = session.user.name + ' · ' + session.user.id;

        var client = odd.im.ui.create({ level: 'warn', mode: 'console' });
        ui = client;
        client.addEventListener(Event.CLOSE, function () {
            if (current !== generation || ui !== client) {
                return;
            }
            clearTimeout(renewal);
            retry = setTimeout(function () {
                if (current !== generation || ui !== client) {
                    return;
                }
                reconnect();
            }, 2000);
        });
        client.addEventListener(IMEvent.NOTIFY, function (event) {
            if (current !== generation || ui !== client) {
                return;
            }
            if (event.data.event === Protocol.Event.ROOM_REVOKED && event.data.payload.roomId === joining) {
                selected = '';
                disconnect();
                status.textContent = 'Room permission changed during subscription. Reconnect to continue.';
                return;
            }
            if (event.data.event === Protocol.Event.ROOM_REVOKED && event.data.payload.roomId === selected) {
                removeRoom(selected);
                selected = '';
                status.textContent = 'Room permission expired or was revoked. Enter the room again to refresh it.';
            }
        });
        expiresAt = Math.min(Number(session.session.expiresAt), Date.now() + session.im.leaseMilliseconds);
        try {
            await client.setup(document.getElementById('im'), {
                skin: 'classic',
                url: session.im.url,
                retry: { count: 0 },
                user: session.user,
                plugins: [
                    { kind: 'Contacts' },
                    { kind: 'Conversations' },
                    { kind: 'Conversation' },
                    { kind: 'Dashboard' },
                ],
            });
            if (current !== generation || ui !== client) {
                return;
            }
            if (selected) {
                try {
                    joining = selected;
                    var room = await request('/rooms/' + encodeURIComponent(joining));
                    if (!room.member || room.member.state !== 'active' || room.state !== 'active') {
                        selected = '';
                    } else {
                        await client.join(room.id);
                        if (current !== generation || client !== ui) {
                            return;
                        }
                        showRoom(room);
                    }
                } catch (err) {
                    if (err.status !== 403 && err.status !== 404 && err.code !== Protocol.Status.FORBIDDEN &&
                        err.code !== Protocol.Status.NOT_FOUND) {
                        throw err;
                    }
                    selected = '';
                    status.textContent = 'The previous room is no longer available.';
                } finally {
                    if (current === generation) {
                        joining = '';
                    }
                }
            }
            await rooms(false);
            if (current !== generation || ui !== client) {
                return;
            }
            joining = '';
            scheduleRenewal();
        } catch (err) {
            if (current === generation) {
                disconnect();
            }
            throw err;
        }
    }

    async function enter(id) {
        if (!ui || !ui.connected()) {
            throw new Error('Connect IM first.');
        }
        var current = generation,
            client = ui,
            previous = selected;
        joining = id;

        try {
            var room = await request('/rooms/' + encodeURIComponent(id) + '/members/me', 'PUT', {});
            await client.join(id);
            if (current !== generation || client !== ui) {
                return;
            }
            if (previous && previous !== id) {
                await client.leave(previous);
                if (current !== generation || client !== ui) {
                    return;
                }
                removeRoom(previous);
            }
            selected = id;
            showRoom(room);
            await members(false);
        } catch (err) {
            if (current === generation) {
                disconnect();
            }
            throw err;
        } finally {
            if (current === generation) {
                joining = '';
            }
        }
    }

    function showRoom(room) {
        document.getElementById('room-id').value = room.id;
        var contact = {
            id: room.id,
            type: 'channel',
            name: room.name,
        };
        ui.plugins['Contacts'].add(contact.id, contact.type, contact.name);
        ui.plugins['Conversations'].add(contact.id, contact.type, contact.name);
        ui.plugins['Conversation'].active(contact.id, contact);
        ui.active('messages');
    }

    function removeRoom(id) {
        if (!ui) {
            return;
        }
        ui.plugins['Contacts'].remove(id);
        ui.plugins['Conversations'].remove(id);
        ui.plugins['Conversation'].active('');
    }

    function scheduleRenewal() {
        clearTimeout(renewal);
        if (!ui || !session) {
            return;
        }
        renewal = setTimeout(function () {
            if (!ui || !session) {
                return;
            }
            if (busy) {
                if (expiresAt <= Date.now() + 5000) {
                    disconnect();
                    status.textContent = 'IM lease expired. Reconnect to continue.';
                    return;
                }
                renewal = setTimeout(scheduleRenewal, 1000);
                return;
            }
            run(renew);
        }, Math.max(0, expiresAt - Date.now() - session.im.renewBeforeMilliseconds));
    }

    async function renew() {
        var current = generation,
            client = ui;
        if (!client || !client.connected()) {
            return;
        }
        try {
            var token = await request('/session/reauth-token', 'POST', { audience: session.im.audience }),
                result = await client.reauth(token.token);
            if (current !== generation || ui !== client) {
                return;
            }
            expiresAt = result.expiresAt.high * 4294967296 + result.expiresAt.low;
            if (selected) {
                joining = selected;
                var room = await request('/rooms/' + encodeURIComponent(joining));
                if (!room.member || room.member.state !== 'active' || room.state !== 'active') {
                    var id = selected;
                    selected = '';
                    await client.leave(id);
                    if (current !== generation || client !== ui) {
                        return;
                    }
                    removeRoom(id);
                } else {
                    await client.join(room.id);
                }
            }
            if (current !== generation || ui !== client) {
                return;
            }
            joining = '';
            scheduleRenewal();
        } catch (err) {
            if (current === generation) {
                disconnect();
            }
            throw err;
        }
    }

    async function rooms(more) {
        if (!more) {
            roomCursor = '';
            document.getElementById('rooms').textContent = '';
        }
        var result = await request('/rooms?limit=50&cursor=' + encodeURIComponent(roomCursor));
        result.items.forEach(function (room) {
            var item = document.createElement('li'),
                button = document.createElement('button');
            button.type = 'button';
            button.textContent = room.name + ' · ' + room.visibility;
            button.addEventListener('click', function () { run(function () { return enter(room.id); }); });
            item.appendChild(button);
            document.getElementById('rooms').appendChild(item);
        });
        roomCursor = result.cursor;
        document.getElementById('more-rooms').hidden = !roomCursor;
    }

    async function members(more) {
        if (!selected) {
            return;
        }
        if (!more) {
            memberCursor = '';
            document.getElementById('members').textContent = '';
        }
        var id = selected,
            result = await request('/rooms/' + encodeURIComponent(id) + '/members?limit=50&cursor=' + encodeURIComponent(memberCursor));
        if (id !== selected || !ui) {
            return;
        }
        result.items.forEach(function (member) {
            var item = document.createElement('li');
            item.textContent = member.name + ' · ' + member.userId + ' · ' + member.role + ' · ' + member.state + (member.muted ? ' · muted' : '');
            document.getElementById('members').appendChild(item);
            if (member.state === 'active' && member.userId !== session.user.id) {
                ui.plugins['Contacts'].add(member.userId, 'user', member.name);
            }
        });
        memberCursor = result.cursor;
        document.getElementById('more-members').hidden = !memberCursor;
    }

    function reconnect() {
        clearTimeout(retry);
        if (busy) {
            retry = setTimeout(reconnect, 1000);
            return;
        }
        run(connect);
    }

    window.addEventListener('pagehide', disconnect);
    window.addEventListener('pageshow', function (event) {
        if (event.persisted) {
            reconnect();
        }
    });
    document.addEventListener('visibilitychange', function () {
        if (!document.hidden && ui && expiresAt <= Date.now()) {
            disconnect();
            reconnect();
        }
    });
    run(connect);
})();

