# Live Streaming Platform

## Group 9 course final version

**兩台固定電腦請先讀：[雙主播開播 Runbook](course/DUAL_LIVE_RUNBOOK.md)**。它涵蓋 Azure VM、兩個 `/32` RTMPS 規則、第一／第二台 OBS 與雙路 LIVE 驗證；故障請看 [疑難排解](course/TROUBLESHOOTING.md)。第二位第一次完成固定電腦設定後，日後登入 Windows 會自動開啟 OBS 並開始自己的第二路推流。

2026-10-23 update: the Azure site now runs `course/` with **two fixed OBS computers in one viewing page**, persistent SQLite accounts, chat moderation, and an atomic/idempotent demo support ledger. A pinned open-source AEC Client engine feeds an OBS Browser Source through a local driver-free bridge. See **[DUAL_OBS.md](course/DUAL_OBS.md)** for setup and acceptance limits. The two physical speaker/microphone systems still need a no-headphones test.

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

## 延遲驗證紀錄

課程展示的目前端到端網站延遲以約 2 秒為準；同機 WebRTC 的 0.1–0.3 秒是局部對照結果，不能代表 HLS 網站觀看延遲。完整排查與啟停流程見 [延遲排查SOP.md](延遲排查SOP.md)，量測證據見 [course/VERIFICATION.md](course/VERIFICATION.md)。

## Current demo support feature

The course app grants 100 non-cash points once per registered account. Balances, sender/host transaction records and room identities persist in SQLite. Sending 1, 5 or 10 points uses one database transaction and a unique request ID; retries do not charge twice. This remains a demo with no purchases, withdrawal or cash value.
