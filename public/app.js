const $ = (id) => document.getElementById(id);
const ui = {
  welcome: $('welcome'), live: $('live-layout'), hostForm: $('host-form'), joinForm: $('join-form'),
  startButton: $('start-button'), titleInput: $('stream-title'), roomInput: $('room-code'),
  title: $('room-title'), subtitle: $('room-subtitle'), code: $('current-code'), viewerCount: $('viewer-count'),
  video: $('live-video'), placeholder: $('video-placeholder'), playButton: $('play-button'), videoLabel: $('video-label'),
  leaveButton: $('leave-button'), copyButton: $('copy-button'), chatForm: $('chat-form'), chatInput: $('chat-input'),
  chatMessages: $('chat-messages'), notice: $('notice'),
};

let socket = null;
let selfId = null;
let hostId = null;
let roomId = null;
let role = null;
let localStream = null;
const peers = new Map();
const rtcConfig = { iceServers: [] };

function notify(message, error = false) {
  ui.notice.textContent = message;
  ui.notice.classList.toggle('error', error);
  ui.notice.classList.remove('hidden');
  clearTimeout(notify.timer);
  notify.timer = setTimeout(() => ui.notice.classList.add('hidden'), 4500);
}

function send(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
}

function showRoom(title) {
  ui.welcome.classList.add('hidden');
  ui.live.classList.remove('hidden');
  ui.title.textContent = title;
  ui.code.textContent = roomId;
  ui.viewerCount.textContent = role === 'host' ? '0 位觀眾' : '正在觀看';
  ui.videoLabel.textContent = role === 'host' ? '● 開播中' : '● LIVE';
  ui.leaveButton.textContent = role === 'host' ? '結束直播' : '離開房間';
  ui.subtitle.textContent = role === 'host' ? '直播中 · 把連結分享給觀眾' : '正在連接直播影像…';
  history.replaceState(null, '', role === 'host' ? '/' : `/?room=${roomId}`);
}

function setVideoStream(stream, muted) {
  ui.video.srcObject = stream;
  ui.video.muted = muted;
  ui.placeholder.classList.add('hidden');
  ui.video.play().then(() => ui.playButton.classList.add('hidden')).catch(() => {
    ui.playButton.classList.remove('hidden');
  });
}

function closePeer(peerId) {
  const peer = peers.get(peerId);
  if (!peer) return;
  peer.pc.close();
  peers.delete(peerId);
}

function resetSession() {
  for (const peerId of peers.keys()) closePeer(peerId);
  localStream?.getTracks().forEach((track) => track.stop());
  localStream = null;
  if (socket) {
    socket.onclose = null;
    socket.close();
    socket = null;
  }
  role = null;
  hostId = null;
  roomId = null;
  selfId = null;
  ui.video.pause();
  ui.video.srcObject = null;
  ui.placeholder.classList.remove('hidden');
  ui.playButton.classList.add('hidden');
  ui.chatMessages.replaceChildren();
  const empty = document.createElement('p');
  empty.className = 'chat-empty';
  empty.textContent = '歡迎來到直播間，打聲招呼吧！';
  ui.chatMessages.append(empty);
  ui.live.classList.add('hidden');
  ui.welcome.classList.remove('hidden');
  ui.startButton.disabled = false;
  history.replaceState(null, '', '/');
}

function leaveRoom() {
  send({ type: 'leave_room' });
  resetSession();
}

function makePeer(peerId) {
  if (peers.has(peerId)) return peers.get(peerId);
  const pc = new RTCPeerConnection(rtcConfig);
  const peer = { pc, pendingIce: [] };
  peers.set(peerId, peer);
  pc.onicecandidate = (event) => {
    if (event.candidate) send({ type: 'signal', targetId: peerId, data: { candidate: event.candidate } });
  };
  pc.ontrack = (event) => {
    if (role !== 'viewer') return;
    if (event.streams[0]) setVideoStream(event.streams[0], false);
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === 'connected' && role === 'viewer') ui.subtitle.textContent = '正在觀看即時直播';
    if (['failed', 'disconnected'].includes(pc.connectionState) && role === 'viewer') ui.subtitle.textContent = '連線中斷，請重新加入';
  };
  return peer;
}

async function onSignal(message) {
  const { fromId, data } = message;
  if (!data || typeof fromId !== 'string') return;
  const peer = makePeer(fromId);
  if (data.description) {
    await peer.pc.setRemoteDescription(data.description);
    for (const candidate of peer.pendingIce.splice(0)) await peer.pc.addIceCandidate(candidate);
    if (data.description.type === 'offer' && role === 'viewer') {
      const answer = await peer.pc.createAnswer();
      await peer.pc.setLocalDescription(answer);
      send({ type: 'signal', targetId: fromId, data: { description: peer.pc.localDescription } });
    }
  } else if (data.candidate) {
    if (peer.pc.remoteDescription) await peer.pc.addIceCandidate(data.candidate);
    else peer.pendingIce.push(data.candidate);
  }
}

async function offerToViewer(viewerId) {
  if (!localStream) return;
  const peer = makePeer(viewerId);
  for (const track of localStream.getTracks()) peer.pc.addTrack(track, localStream);
  const offer = await peer.pc.createOffer();
  await peer.pc.setLocalDescription(offer);
  send({ type: 'signal', targetId: viewerId, data: { description: peer.pc.localDescription } });
}

function addChat(message) {
  ui.chatMessages.querySelector('.chat-empty')?.remove();
  const line = document.createElement('p');
  line.className = `chat-item${message.role === 'host' ? ' host' : ''}`;
  const name = document.createElement('strong');
  name.textContent = message.fromId === selfId ? '你' : message.role === 'host' ? '主播' : '觀眾';
  line.append(name, document.createTextNode(message.text));
  ui.chatMessages.append(line);
  ui.chatMessages.scrollTop = ui.chatMessages.scrollHeight;
}

async function handleMessage(message) {
  switch (message.type) {
    case 'room_created':
      role = 'host';
      roomId = message.roomId;
      showRoom(message.title);
      setVideoStream(localStream, true);
      notify('開播成功！分享連結邀請觀眾。');
      break;
    case 'room_joined':
      role = 'viewer';
      roomId = message.roomId;
      hostId = message.hostId;
      showRoom(message.title);
      break;
    case 'viewer_joined':
      ui.viewerCount.textContent = `${message.viewerCount} 位觀眾`;
      await offerToViewer(message.viewerId);
      break;
    case 'viewer_left':
      closePeer(message.viewerId);
      ui.viewerCount.textContent = `${peers.size} 位觀眾`;
      break;
    case 'signal':
      await onSignal(message);
      break;
    case 'chat':
      addChat(message);
      break;
    case 'room_closed':
      resetSession();
      notify('主播已結束直播。');
      break;
    case 'error':
      notify(message.message || '操作失敗，請再試一次。', true);
      if (message.code === 'room_not_found') resetSession();
      break;
  }
}

function connect() {
  return new Promise((resolve, reject) => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${location.host}`);
    socket = ws;
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'welcome') {
          selfId = message.id;
          resolve();
        } else {
          handleMessage(message).catch((error) => notify(`連線處理失敗：${error.message}`, true));
        }
      } catch {
        notify('收到無法讀取的伺服器訊息。', true);
      }
    };
    ws.onerror = () => reject(new Error('無法連接直播伺服器'));
    ws.onclose = () => {
      if (socket === ws) {
        resetSession();
        notify('與伺服器的連線已中斷。', true);
      }
    };
  });
}

ui.hostForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  ui.startButton.disabled = true;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720 }, audio: true });
    await connect();
    send({ type: 'create_room', title: ui.titleInput.value });
  } catch (error) {
    resetSession();
    notify(`無法開播：${error.message}`, true);
  }
});

ui.joinForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const code = ui.roomInput.value.trim().toLowerCase();
  if (!/^[a-f0-9]{6}$/.test(code)) return notify('請輸入 6 位房間代碼。', true);
  try {
    await connect();
    send({ type: 'join_room', roomId: code });
  } catch (error) {
    resetSession();
    notify(error.message, true);
  }
});

ui.chatForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = ui.chatInput.value.trim();
  if (!text) return;
  send({ type: 'chat', text });
  ui.chatInput.value = '';
});

ui.leaveButton.addEventListener('click', leaveRoom);
ui.copyButton.addEventListener('click', async () => {
  if (!roomId) return;
  try {
    await navigator.clipboard.writeText(`${location.origin}/?room=${roomId}`);
    notify('觀看連結已複製。');
  } catch {
    notify(`觀看連結：${location.origin}/?room=${roomId}`);
  }
});
ui.playButton.addEventListener('click', () => ui.video.play().then(() => ui.playButton.classList.add('hidden')));
window.addEventListener('pagehide', () => {
  localStream?.getTracks().forEach((track) => track.stop());
  socket?.close();
});

const sharedRoom = new URLSearchParams(location.search).get('room');
if (sharedRoom && /^[a-f0-9]{6}$/i.test(sharedRoom)) ui.roomInput.value = sharedRoom.toLowerCase();
