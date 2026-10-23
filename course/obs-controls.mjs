import { randomBytes } from 'node:crypto';
export function createOBSControls(io, store, secureTransport) {
  const tickets = new Map(); const controllers = new Map();
  function pathFor(user) {
    const room = store.room();
    if (room.host?.userId === user.id) return 'live';
    if (room.guest?.userId === user.id) return 'guest';
    throw new Error('你不是本場上鏡主播。');
  }
  function attach(socket, account) {
    if (socket.handshake.auth?.obsPair || socket.handshake.auth?.obsDevice) {
      const code = socket.handshake.auth.obsPair;
      const ticket = code && tickets.get(code); if (code) tickets.delete(code);
      const user = ticket ? store.session(ticket.session) : store.obsDevice(socket.handshake.auth.obsDevice);
      try {
        if (!secureTransport(socket.request) || !user || (ticket && ticket.expires < Date.now())) throw new Error('OBS 配對碼無效或已過期');
        if (!ticket && user.trustedSecond) {
          const room = store.room();
          if (room.host && !room.guest && room.host.userId !== user.id) { store.join(user.id); io.emit('room:state', store.room()); }
        }
        const path = pathFor(user);
        if (ticket && path !== ticket.path) throw new Error('OBS 配對碼無效或已過期');
        controllers.get(user.id)?.socket.disconnect(true);
        socket.data.token = ticket?.session; socket.data.obsController = true;
        socket.data.authorized = () => ticket ? Boolean(store.session(ticket.session)) : Boolean(store.obsDevice(socket.handshake.auth.obsDevice));
        controllers.set(user.id, { socket, path });
        socket.emit('obs:bound', { path });
        socket.on('disconnect', () => { if (controllers.get(user.id)?.socket === socket) controllers.delete(user.id); });
      } catch (error) { socket.emit('obs:error', error.message); socket.disconnect(true); }
      return true;
    }
    socket.on('obs:pair', (ack) => {
      if (typeof ack !== 'function') return;
      try {
        const user = account(); const path = pathFor(user);
        for (const [code, ticket] of tickets) if (ticket.expires < Date.now() || ticket.userId === user.id) tickets.delete(code);
        const code = randomBytes(24).toString('hex');
        tickets.set(code, { userId: user.id, session: socket.data.token, path, expires: Date.now() + 300000 });
        ack({ code, path });
      } catch (error) { ack({ error: error.message }); }
    });
    socket.on('obs:device', (ack) => {
      if (typeof ack !== 'function') return;
      try { const user = account(); pathFor(user); ack({ token: store.newOBSDevice(user.id) }); }
      catch (error) { ack({ error: error.message }); }
    });
    socket.on('obs:control', async (value, ack) => {
      if (typeof ack !== 'function') return;
      let activeController;
      try {
        const user = account(); const path = pathFor(user);
        if (!value || !['status', 'microphone', 'camera', 'stop'].includes(value.action) || (['microphone', 'camera'].includes(value.action) && typeof value.enabled !== 'boolean')) throw new Error('無效的 OBS 操作。');
        const controller = controllers.get(user.id);
        if (!controller?.socket.connected || controller.path !== path) throw new Error('請先連接你這台電腦的 OBS 控制程式。');
        if (controller.busy) throw new Error('上一個 OBS 操作尚未完成。');
        controller.busy = true; activeController = controller;
        const result = await controller.socket.timeout(7000).emitWithAck('obs:execute', { action: value.action, enabled: value.enabled });
        if (!result || result.error) throw new Error(result?.error || 'OBS 未回覆狀態。');
        ack(result);
      } catch (error) { ack({ error: error.message || 'OBS 操作逾時，請重新讀取狀態。' }); }
      finally { if (activeController) activeController.busy = false; }
    });
    return false;
  }
  return { attach };
}
