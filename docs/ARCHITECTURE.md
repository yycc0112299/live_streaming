# Architecture and components

## Goal

Build an original platform where a broadcaster can publish camera/microphone media and viewers can watch and chat in near real time. Pure Live informs the viewing experience, but its Flutter aggregator cannot itself provide the broadcasting backend this goal needs.

## First runnable slice

```text
Broadcaster browser ── WebRTC media ──> Viewer browser(s)
        │                                  │
        └──── WebSocket signaling/chat ────┘
                         │
                 Node.js local server
               room state + static UI
```

- `public/`: responsive broadcaster/viewer interface. Browser `getUserMedia` captures video and audio; `RTCPeerConnection` transports media.
- `src/rooms.mjs`: in-memory room ownership and membership; one host per room.
- `src/server.mjs`: HTTP static-file server and WebSocket signaling/chat relay.
- `test/`: room lifecycle and signaling tests using Node's built-in test runner.

The signaling server does not store video. WebRTC media goes directly between peers where possible. The MVP configures no external STUN/TURN service, keeping the supported workflow on the same computer. For reliable cross-network use, a production deployment needs STUN/TURN, HTTPS, and a deliberate privacy review. Browser camera access requires a secure context (localhost or HTTPS).

## Boundaries and later components

| Phase | Component | Purpose |
| --- | --- | --- |
| Demo | WebRTC + WebSocket | Self-broadcast, view, chat, room links |
| Next | Identity + database | Accounts, stream metadata, moderation history |
| Next | TURN + HTTPS | Reliable cross-network connections |
| Scale | SFU/media server | One upstream from the host, many viewers |
| Scale | Storage + transcoding | Recording, replay, adaptive quality |
| Product | Discovery, search, favorites, multi-view | Adapt Pure Live-inspired viewing ideas |
| Product | Moderation, analytics, donations/gifts | Safe community and creator features |

## Combination with the earlier dual-camera project

The existing dual-camera person-tracking and matching demo is **not yet wired into this live platform**. Its future integration point is an optional video source and metadata overlay in the broadcaster browser (or a separate processing service), followed by normal WebRTC delivery to viewers. The matching service should send track IDs, scores, and review decisions as data, not silently upload stored face photos. Keep the previous retention rule: transient photos are cleared when dual-camera capture stops; manual-review cards can fade from the UI after five seconds. ModelSim/Verilog work remains a separate hardware-validation track, not a dependency for a browser live stream. This separation lets the first presentation demonstrate a working broadcast without implying the tracking/FPGA integration is already finished.

Security and privacy: the MVP is local-only, un-authenticated, and intentionally not Internet-deployable as-is. Do not use it for private or sensitive streams. Do not expose the port publicly without authentication, HTTPS, origin controls, abuse limits, moderation, and a TURN/SFU deployment plan.

## Separate hosted LiveKit application

`site/` is a second application: a Sites HTTPS Worker issues short-lived LiveKit participant tokens, and LiveKit Cloud carries media and chat data between browsers. It does not route media through the local Node server or modify its port 4173 process. The landing page may be public only after credentialed smoke tests. Owner creation requires `CREATOR_KEY`; viewers require a signed invite that expires after 12 hours. A forwarded invite grants the same access until expiry. `LIVEKIT_API_SECRET` and `INVITE_SIGNING_KEY` stay server-side; all five runtime values are stored as Sites secrets.

The public origin is <https://mobile-cross-network-live.sureflea64.chatgpt.site>. The landing page is public, but creating a room requires the creator key and joining requires a signed invite; an unconfigured shell cannot create/join rooms. Automated API/UI tests are separate evidence from deployment and real media delivery. Cross-network audio/video/chat, viewer counts, and stop behavior require two real devices on different networks and have not been established by local tests. See [hosted setup](../site/README.md) for current evidence. The broadcasting device must stay online; turning off that device ends its outgoing media even though the cloud-hosted page remains available.

As of 2026-10-15, public deployment with all five secret runtime entries succeeded. Hosted creator/viewer token and authorization checks passed, as did LiveKit RoomService and participant signaling validation (HTTP 200). Hosted endpoint smoke tests passed 10/10 in both private and public modes. Those results do not prove two-device media, which remains to be tested on separate networks.
