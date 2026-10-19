# Live Streaming Platform

## Group 9 course final version

The presentation's OBS → RTMP → MediaMTX → HLS stack is implemented in **[course/](course/README.md)** with React/hls.js playback, Socket.IO nickname chat, live/offline status, likes and connected-tab count. It includes tests, Windows startup and Azure Docker/SSH deployment. See [verification](course/VERIFICATION.md) for evidence and remaining deployment/device checks. The earlier prototypes below remain available.

An original, web-first live-streaming prototype inspired by [Pure Live](https://github.com/liuchuancong/pure_live). Unlike Pure Live's third-party stream viewer, this project lets a user start their own broadcast. No Pure Live source code is copied into this repository.

## Run locally

Requirements: Node.js 22+ and npm. In this folder:

```powershell
npm install
npm test
npm start
```

Open <http://127.0.0.1:4173/>. Choose **Start a broadcast**, allow camera/microphone access, and share the room link. Open that link in another browser or tab and choose **Watch**. Stop the broadcast to close its room.

The first version supports one broadcaster, multiple viewers in small rooms, low-latency WebRTC video/audio, text chat, and room links. It does **not** yet provide user accounts, recording, replay, gifts, platform aggregation, transcoding, or scalable media distribution. Each viewer is a separate peer connection, so this is a demo architecture, not a production-scale service.

See [architecture](docs/ARCHITECTURE.md), [Pure Live comparison](docs/PURE_LIVE_REVIEW.md), and [presentation plan](docs/PRESENTATION_PLAN.md).

## Separate hosted mobile version

`site/` contains the separate HTTPS/LiveKit Cloud version for phone broadcasting and invited viewers. Its setup, secret names, 12-hour viewer invites, and operational limits are documented in [site/README.md](site/README.md). The public Site URL is <https://mobile-cross-network-live.sureflea64.chatgpt.site>. Actual phone-to-phone audio/video/chat across different networks still requires a real device test. The original local demo and port 4173 remain independent.

Setup evidence (2026-10-15): the configured deployment succeeded with all five runtime entries stored as secrets. LiveKit RoomService and participant signaling validation returned HTTP 200; hosted private and public endpoint smoke tests each passed 10/10 checks. The Site is public, but a viewer still needs a signed invite and the owner needs the creator key. No two-device media test has passed yet.
