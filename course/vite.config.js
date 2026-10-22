import { defineConfig } from 'vite';
export default defineConfig({
  base: process.env.APP_BASE || '/',
  server: { proxy: { '/socket.io': { target: 'http://127.0.0.1:4180', ws: true }, '/api': 'http://127.0.0.1:4180', '/hls': 'http://127.0.0.1:4180', '/webrtc': 'http://127.0.0.1:4180' } },
});
