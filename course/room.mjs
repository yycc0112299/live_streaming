// Both fixed OBS computers publish to MediaMTX; this module controls their one shared room.
export function createOBSRoom(io, store) {
  const requests = new Map();
  const state = () => { const current = store.room(); if (current.donationsEnabled && !current.host) store.ensureDonationRoom(); return store.room(); };
  const notify = () => io.emit('room:state', state());
  const pending = () => [...requests.values()];
  const notifyRequests = () => {
    for (const client of io.sockets.sockets.values()) {
      const account = store.session(client.data.token);
      if (account && ['host', 'admin'].includes(account.role)) client.emit('room:requests', pending());
    }
  };
  function attach(socket) {
    const initial = store.session(socket.data.token);
    if (initial?.role === 'host') {
      const room = state();
      if (!room.host) store.start(initial.id);
      else if (initial.trustedSecond && !room.guest && room.host.userId !== initial.id) store.join(initial.id);
    }
    socket.emit('room:state', state());
    if (initial && ['host', 'admin'].includes(initial.role)) socket.emit('room:requests', pending());
    socket.on('room:request', (ack) => {
      if (typeof ack !== 'function') return;
      try {
        const account = store.session(socket.data.token); const room = state();
        if (!account || !room.host) throw new Error('第一位主播尚未開啟直播間。');
        if (room.guest) throw new Error('第二位主播位置已有人使用。');
        if (room.host.userId === account.id) throw new Error('第一位主播不需要申請第二路。');
        requests.set(account.id, { userId: account.id, nickname: account.nickname }); notifyRequests(); ack({ ok: true });
      } catch (error) { ack({ error: error.message }); }
    });
    socket.on('room:approve', (userId, ack) => {
      if (typeof ack !== 'function') return;
      try {
        const account = store.session(socket.data.token); const room = state(); const request = requests.get(userId);
        if (!account || !room.host || (room.host.userId !== account.id && account.role !== 'admin')) throw new Error('只有本場主持人可以同意申請。');
        if (!request) throw new Error('申請已失效。');
        store.authorizeHost(request.userId); store.join(request.userId); requests.clear(); notify(); notifyRequests(); ack({ ok: true, ...state() });
      } catch (error) { ack({ error: error.message }); }
    });
    socket.on('room:join', (ack) => {
      if (typeof ack !== 'function') return;
      try { const account = store.session(socket.data.token); if (!account) throw new Error('請先登入才能加入直播。'); store.join(account.id); notify(); ack({ ok: true, ...state() }); }
      catch (error) { ack({ error: error.message }); }
    });
    socket.on('room:donations', (enabled, ack) => {
      if (typeof ack !== 'function') return;
      try {
        const account = store.session(socket.data.token);
        if (!account || account.role !== 'admin') throw new Error('只有管理員可以開關抖內。');
        if (enabled === true && !state().host) store.start(account.id);
        store.setDonationsEnabled(enabled === true); notify(); ack({ ok: true, ...state() });
      } catch (error) { ack({ error: error.message }); }
    });
    for (const action of ['start', 'end']) socket.on(`room:${action}`, (value, callback) => {
      const ack = typeof value === 'function' ? value : callback;
      if (typeof ack !== 'function') return;
      try {
        const account = store.session(socket.data.token);
        if (!account || !socket.data.user || !['host', 'admin'].includes(account.role)) throw new Error('需要主播權限。');
        if (action === 'start') {
          if (value?.audioChecklist !== true) throw new Error('請先確認兩台 OBS 的 AEC 與音訊檢查。');
          store.start(account.id, value.guestUsername);
        } else {
          const room = state();
          if (room.host && room.host.userId !== account.id && account.role !== 'admin') throw new Error('只有本場主持人可以結束直播。');
          if (room.broadcastId) store.end(room.broadcastId);
          requests.clear(); notifyRequests();
        }
        notify(); ack({ ok: true, ...state() });
      } catch (error) { ack({ error: error.message }); }
    });
  }
  return { attach, state };
}
