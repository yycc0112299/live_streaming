"""Pinned AEC Client WASAPI/DTLN pipeline → local OBS Browser Source; no audio driver."""
import argparse
import json
import os
import queue
import secrets
import sys
import threading
import time
from http import HTTPStatus
from pathlib import Path

import numpy as np
from aec_guard import guard_inference
from websockets import State
from websockets.sync.server import serve

ROOT = Path(__file__).resolve().parents[1]
UPSTREAM = ROOT / '.runtime/aec/web/AEC-Web-v1.13.1-win64'
sys.path.insert(0, str(UPSTREAM))
os.chdir(UPSTREAM)
from web.chain import Chain
from web.audio import AudioRunner, list_devices, pa_patch
from web.dsp import soft_limit


# shortcut: upstream internals are pinned to v1.13.1; rerun capture and offline tests before upgrading.
class OBSRunner(AudioRunner):
    def start(self):
        self._pa = pa_patch.PyAudio()
        try:
            for index, rate_key, callback in [(self.mic_idx, '_mic_rate', self._on_mic), (self.ref_idx, '_ref_rate', self._on_ref)]:
                rate = int(self._pa.get_device_info_by_index(index)['defaultSampleRate'])
                setattr(self, rate_key, rate)
                self._streams.append(self._pa.open(format=pa_patch.paInt16, channels=1, rate=rate, input=True, input_device_index=index, frames_per_buffer=128, stream_callback=callback))
            self._stop.clear()
            self._threads = [threading.Thread(target=self._work, daemon=True)]
            self._threads[0].start()
        except Exception:
            self.stop()
            raise


CLIENT = r"""
const status = document.querySelector('#status');
const audio = new AudioContext();
await audio.audioWorklet.addModule('./worklet.js');
const node = new AudioWorkletNode(audio, 'obs-aec');
window.aecOutput = audio.createMediaStreamDestination();
node.connect(window.aecOutput); // Browser diagnostics never monitor the microphone to physical speakers.
if (window.obsstudio) node.connect(audio.destination); // OBS must use Control audio via OBS, monitoring OFF.
const analyser = audio.createAnalyser(); node.connect(analyser); window.aecAnalyser = analyser;
let socket;
function connect() {
  socket = new WebSocket(new URL('./pcm', location.href).href.replace('http:', 'ws:'));
  socket.binaryType = 'arraybuffer';
  socket.onmessage = ({data}) => {
    if (typeof data === 'string') { status.textContent = data; return; }
    const pcm = new Int16Array(data); const floats = Float32Array.from(pcm, (n) => n / 32768);
    node.port.postMessage(floats, [floats.buffer]);
  };
  socket.onclose = () => { status.textContent = 'AEC 已停止，輸出靜音'; node.port.postMessage('clear'); };
  socket.onerror = () => { status.textContent = 'AEC 連線失敗，請檢查本機服務'; };
  window.aecSocket = socket;
}
async function start() {
  await audio.resume();
  if (audio.state === 'running' && !socket) connect();
  else if (audio.state !== 'running') status.textContent = '請按啟動；OBS Browser Source 需允許自動播放';
}
document.querySelector('button').onclick = start;
await start();
window.addEventListener('pagehide', () => { socket?.close(); audio.close(); });
"""
WORKLET = r"""
class AECAudio extends AudioWorkletProcessor {
  constructor() {
    super(); this.data = new Float32Array(8192); this.read = 0; this.write = 0; this.size = 0; this.phase = 0; this.last = 0;
    this.port.onmessage = ({data}) => {
      if (data === 'clear') { this.size = 0; this.read = this.write; this.phase = 0; this.last = 0; return; }
      if (this.size + data.length > 2048) { this.size = 0; this.read = this.write; this.phase = 0; }
      for (const sample of data) { this.data[this.write] = sample; this.write = (this.write + 1) % this.data.length; this.size++; }
    };
  }
  process(inputs, outputs) {
    const output = outputs[0][0];
    for (let i = 0; i < output.length; i++) {
      if (this.size >= 2) {
        output[i] = this.data[this.read] * (1 - this.phase) + this.data[(this.read + 1) % this.data.length] * this.phase;
        this.phase += 16000 / sampleRate;
        while (this.phase >= 1 && this.size) { this.phase--; this.read = (this.read + 1) % this.data.length; this.size--; }
      }
      else output[i] = Math.abs(this.last) > 0.0000001 ? this.last * 0.95 : 0;
      this.last = output[i];
    }
    return true;
  }
}
registerProcessor('obs-aec', AECAudio);
"""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--list', action='store_true')
    parser.add_argument('--mic', type=int)
    parser.add_argument('--reference', type=int)
    parser.add_argument('--port', type=int, default=47660)
    parser.add_argument('--synthetic', action='store_true', help='Test only; never opens audio hardware')
    args = parser.parse_args()
    if args.list:
        print(json.dumps(list_devices(), ensure_ascii=False)); return
    if not 1024 <= args.port <= 65535:
        parser.error('Port must be 1024–65535')
    if not args.synthetic:
        devices = list_devices()
        if args.mic not in [d['index'] for d in devices['capture']] or args.reference not in [d['index'] for d in devices['loopback']]:
            parser.error('Select a physical mic and the loopback of the actual playback speakers using --list')
    chain = Chain(model_dir='models', num_threads=2)
    chain.set_ns_backend('off')
    if not chain.start() or chain.state()['dtlnBackend'] == 0:
        raise RuntimeError(chain.last_error or 'AEC model unavailable')
    guard_inference(chain)
    chain.stop()
    token = secrets.token_hex(24)
    origin = f'http://127.0.0.1:{args.port}'
    private = ROOT / '.runtime/AEC-BROWSER-PRIVATE.json'
    private.write_text(json.dumps({'url': f'{origin}/{token}/', 'pid': os.getpid(), 'synthetic': args.synthetic}), encoding='utf-8')
    os.chmod(private, 0o600)
    lock = threading.Lock()
    health = {'running': False, 'frames': 0, 'synthetic': args.synthetic}

    def request(connection, request):
        if request.headers.get('Host') != f'127.0.0.1:{args.port}':
            return connection.respond(HTTPStatus.FORBIDDEN, 'Local OBS only')
        if request.path == f'/{token}/pcm':
            return None
        if request.path == f'/{token}/status':
            return connection.respond(HTTPStatus.OK, json.dumps(health))
        resources = {
            f'/{token}/': ('text/html; charset=utf-8', '<!doctype html><meta charset="utf-8"><title>OBS AEC</title><p id="status">準備 AEC…</p><button>啟動 AEC</button><script type="module" src="./client.js"></script>'),
            f'/{token}/client.js': ('text/javascript', CLIENT),
            f'/{token}/worklet.js': ('text/javascript', WORKLET),
        }
        if request.path not in resources:
            return connection.respond(HTTPStatus.NOT_FOUND, 'Not found')
        content_type, text = resources[request.path]
        response = connection.respond(HTTPStatus.OK, text)
        del response.headers['Content-Type']
        response.headers['Content-Type'] = content_type
        response.headers['Cache-Control'] = 'no-store'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'self'"
        return response

    def consume(connection):
        if not lock.acquire(blocking=False):
            connection.close(1013, 'One OBS consumer per computer'); return
        runner = None
        try:
            assert chain.start(), chain.last_error
            if not args.synthetic:
                runner = OBSRunner(chain, mic_idx=args.mic, ref_idx=args.reference, out_idx=0)
                runner.start()
            health.update(running=True, frames=0)
            connection.send('AEC 運行中：DTLN-AEC 128 → OBS（16 kHz）')
            frame = 0
            deadline = time.monotonic()
            while connection.state is State.OPEN:
                if args.synthetic:
                    t = (np.arange(128) + frame * 128) / 16000
                    ref = (0.1 * np.sin(2 * np.pi * 160 * t) * 32767).astype(np.int16)
                    mic = (0.15 * np.sin(2 * np.pi * 231 * t) * 32767).astype(np.int16)
                    out = chain.process_frame(mic + ref // 2, ref).astype(np.float32) / 32768
                    frame += 1; deadline += 0.008; time.sleep(max(0, deadline - time.monotonic()))
                else:
                    try: out = runner._out_q.get(timeout=0.1)
                    except queue.Empty:
                        if not runner._threads[0].is_alive(): raise RuntimeError('AEC capture worker stopped')
                        continue
                if chain.last_error or not np.isfinite(out).all():
                    raise RuntimeError('AEC processing failed; output muted')
                health.update(frames=chain.frames, micRms=runner.in_rms if runner else 0, referenceRms=runner.ref_rms if runner else 0)
                connection.send(soft_limit(out).astype('<i2').tobytes())
        except Exception:
            connection.close(1011, 'AEC unavailable; microphone output stopped')
        finally:
            health['running'] = False
            if runner: runner.stop()
            chain.stop(); lock.release()

    print('AEC bridge ready on loopback. Private OBS source URL is in .runtime/AEC-BROWSER-PRIVATE.json.', flush=True)
    with serve(consume, '127.0.0.1', args.port, process_request=request, origins=[origin], max_size=1024, max_queue=1, compression=None) as server:
        server.serve_forever()


if __name__ == '__main__':
    main()
