// Both fixed OBS computers publish to MediaMTX; this module controls their one shared room.
export function createOBSRoom(io, store) {
  const state = () => store.room();
  const notify = () => io.emit('room:state', state());
  function attach(socket) {
    const initial = store.session(socket.data.token);
    if (initial?.role === 'host' && !state().host) store.start(initial.id);
    socket.emit('room:state', state());
    socket.on('room:join', (ack) => {
      if (typeof ack !== 'function') return;
      try { const account = store.session(socket.data.token); if (!account || !['host', 'admin'].includes(account.role)) throw new Error('需要第二位主播權限。'); store.join(account.id); notify(); ack({ ok: true, ...state() }); }
      catch (error) { ack({ error: error.message }); }
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
        }
        notify(); ack({ ok: true, ...state() });
      } catch (error) { ack({ error: error.message }); }
    });
  }
  return { attach, state };
}
