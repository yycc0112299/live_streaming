# Pure Live reference review

Reference: <https://github.com/liuchuancong/pure_live>, inspected at commit `782f113d5ce1cf8555d5052226e5a316f94adda6` on 2026-10-15.

Pure Live is a Flutter client for watching streams from existing services. Its repository includes platform adapters, live-room browsing/search, player implementations, multi-view, favorites, chat/danmaku, recording, and account/settings modules. It is not a drop-in server for users to originate their own streams. The repository is licensed AGPL-3.0; this project links to it for attribution and uses an independently written implementation rather than copying its code or assets.

| Pure Live concept | This project |
| --- | --- |
| Browse and watch live rooms | First version: watch a shared room URL; room directory is later |
| Multiple playback engines | First version: browser WebRTC; HLS/LL-HLS later for larger audiences |
| Search, favorites, multi-view | Planned after the broadcast core |
| Chat/danmaku, gifts | First version: plain room chat; overlays and gifts later |
| Recording/replay | Planned after storage and consent design |
| Third-party platform adapters | Not copied; independent self-broadcasting is the requirement |

Scope note: we inspected the full repository tree and its core documentation and module structure to choose the architecture; this is not a claim that every individual source line has been manually reviewed. Features requiring proprietary third-party APIs or copyrighted assets are excluded from this original implementation.
