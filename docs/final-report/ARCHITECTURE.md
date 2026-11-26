# Group 9 — Final System Architecture

Public site: `https://group9liveb11302133.japaneast.cloudapp.azure.com/group9/`
Everything runs on one Azure VM (`Capstone / B11302133`, Ubuntu 24.04 ARM64, Japan East).

```text
 BROADCASTERS                         AZURE VM (B11302133)                                VIEWERS
 ───────────                          ────────────────────                                ───────
 Host PC ── OBS ─── RTMPS :1936 (TCP, TLS, /32 allow-list) ──▶ ┌──────────────┐
                                                               │  MediaMTX    │── LL-HLS :8888 ─┐
 Guest PC ─ OBS ─── RTMPS :1936 ─────────────────────────────▶ │  live/guest  │                 │
                                                               │  publish auth│◀─ WHEP ─┐       │
 Phone ── browser ─ WebRTC WHIP ──┐ (signaling over HTTPS)     └──────▲───────┘         │       │
          camera     media: UDP/TCP 8189 ──────────────────────────────┘                │       │
                                  │                                                     │       │
                                  ▼                                                     │       ▼
                     ┌──────────────────────┐   proxy /group9/   ┌──────────────────────┴───────────┐
   all browsers ◀──▶ │ Apache 2.4  :443     │ ─────────────────▶ │ Node.js 24  server.mjs  :4180    │
   (HTTPS, WSS)      │ Let's Encrypt TLS    │                    │ • React app (Vite build)         │
                     │ static /assets       │                    │ • REST API  /api/status, account │
                     └──────────────────────┘                    │ • Socket.IO chat/likes/gifts/room│
                                                                 │ • HLS + WHEP proxy (viewers)     │
                                                                 │ • WHIP proxy (owner only, adds   │
                                                                 │   publish key server-side)       │
                                                                 └───────────────┬──────────────────┘
                                                                                 ▼
                                                                  SQLite (WAL): users, sessions,
                                                                  broadcasts, donations ledger,
                                                                  messages, mutes, reports, audit
```

## Three lanes

| Lane | Path | Protocol / transport | Why (course link) |
|---|---|---|---|
| Video ingest (PC) | OBS → MediaMTX `live`/`guest` | RTMPS over **TCP** 1936; H.264 + AAC, keyframe 1 s | W10: RTMP is the standard ingest from OBS; TLS + per-IP allow-list for security |
| Video ingest (phone) | Browser camera → Node (auth) → MediaMTX | **WebRTC WHIP**; media over **UDP** 8189 (TCP fallback); H.264 + Opus | W09: real-time media prefers UDP; phones need no app, only HTTPS |
| Video playback | MediaMTX → Node → hls.js | Low-latency **HLS** over HTTPS (1 s segments, 200 ms parts) | W10: HLS splits the stream into small HTTP segments that any browser can play |
| Chat & control | React ⇄ Socket.IO ⇄ Node | **WebSocket over TCP** | W09: every chat message must arrive and stay in order |
| Data | Node ⇄ SQLite | SQL transactions | W06: accounts, points ledger with unique request IDs (no double charge) |

## Components

- **Azure VM + NSG (W03).** IaaS. Inbound: 443/80 (site), 1936 only for each broadcaster's current `/32`, UDP/TCP 8189 for WebRTC media. MediaMTX API (9997) and HLS (8888) listen on localhost only. Deallocate the VM after every session to save the $100 student credit.
- **MediaMTX 1.21.2.** One server provides RTMPS ingest, WebRTC (WHIP/WHEP), LL-HLS and a control API. It replaces the lab's NGINX-RTMP + FFmpeg; we remux without transcoding, so a small 2-vCPU ARM VM is enough. `overridePublisher: false`: each slot accepts one source at a time.
- **Node.js server.** Static React build, REST API, Socket.IO events, HLS/WHEP proxy for viewers, and an authenticated WHIP proxy. The browser never sees a stream key.
- **React + hls.js frontend (W05).** Two-slot player, chat, gifts and point ledger, moderation tools, phone broadcast panel, Chinese/English switch, share link and QR code.
- **SQLite.** Persistent accounts and sessions (scrypt-hashed passwords), broadcasts, an atomic donation ledger, chat history, moderation audit.

## Security choices

- HTTPS everywhere (phone cameras only work on secure origins).
- Publish passwords live only on the VM. OBS uses its own key; the phone uses its login session and the server adds the key.
- Same-origin checks, rate limits, message length limits, and React escaping (no HTML injection).
- Lesson learned: two private config files had been committed to GitHub. They were removed from the repo; the keys still need rotating.
