# MediaMTX WHEP reader

`mediamtx-reader.js` is the official MediaMTX v1.21.2 browser reader:
https://github.com/bluenviron/mediamtx/blob/v1.21.2/internal/servers/webrtc/reader.js

The only change is the final `export default MediaMTXWebRTCReader;` line for Vite.
The upstream MIT license is included in `mediamtx-LICENSE`.
Negotiation, ICE and reconnect behavior remain upstream code.
