# Mobile, cross-network private live demo — design

## Context and user decisions

The existing `live_streaming` repository is a working local WebRTC proof of concept. Its Node/WebSocket server is bound to `127.0.0.1`, rooms use six-hex-digit IDs, and peers have no STUN/TURN service. It must not simply be exposed to the Internet.

The next slice is for friends **with a link** to test privately. A phone must be able to broadcast with its camera and microphone or watch, even on a different network from the broadcaster. The website URL must continue to work while the user's computer is off. The user accepts LiveKit Cloud as the media service but has not created a project there yet. The stream itself is live only while the broadcaster's phone or computer remains online.

Keep the local proof of concept available during development; do not interrupt its currently running room to develop the hosted version.

## Recommended architecture

```text
Phone/desktop host                         Phone/desktop viewer
      │ camera/mic                                  │ video/audio/chat
      └──────────────┐                   ┌───────────┘
                     ▼                   ▼
             Fixed HTTPS site and API (Sites)
                │             │
        server-only secrets   signed, short-lived participant tokens
                └─────────────┬───────────────┘
                              ▼
                   LiveKit Cloud media room
                  (SFU + connectivity service)
```

Build a new hosted slice in the same VS Code repository. The responsive UI reuses the local product language and room/chat behavior but connects with the LiveKit JavaScript client rather than the local WebSocket signaling server. A small server-side API signs participant tokens; the API key and secret never enter browser code or Git. A Sites Vinext/Cloudflare Worker build supports server routes and runtime secrets, so Sites hosts both HTTPS UI and token API independently of the user's computer. LiveKit Cloud carries video, audio, and chat/data between networks. Keep the existing local path as a separate development fallback until the cloud path works.

Rejected alternatives: a quick tunnel from the user's PC ends when that PC is off; opening the current local server to the Internet lacks adequate authorization and connectivity; STUN-only peer connections are unreliable across mobile/carrier NAT and multiply broadcaster upload per viewer. A self-hosted media server is unnecessary operational burden for a small class demo.

## User flow

1. The owner opens the fixed HTTPS site on desktop or phone and chooses **Start broadcast**. Only the owner can do so, using a high-entropy creator key kept in server-side configuration and entered into the browser when starting. The key is not placed in a share link, persisted in local storage, or sent to other viewers.
2. The API validates the creator key and creates a fresh, unguessable room identifier and an expiring, signed viewer invitation (at least 128 bits of unpredictability; expiry displayed). The invite lasts 12 hours, enough to share before a same-day class/friend test but not a permanent entry link. The owner receives a broadcaster participant token plus a viewer-only share URL. The room is not listed in a public directory.
3. A friend opens that HTTPS invite, grants no media permissions, and watches. The API validates the invite and issues a short-lived, viewer-only LiveKit token for the specified room. The friend can use text chat but cannot publish camera/audio. The page asks for camera/mic permission only when the owner deliberately starts broadcasting.
4. The owner stops broadcasting; media stops and the room ends when participants leave. For this first private-test slice, an existing invite may still show an offline/empty room until its short expiry. There is no permanent recording, automatic restart, or hard server-side invite revocation. The UI must describe this honestly.
5. If the owner's PC is off, the site remains reachable. A phone may start a **new** live stream with the creator key. A stream being sent from the PC does not stay live after that PC turns off.

## Security and privacy boundary

- Hosted site may be publicly reachable as a web page; actual room access is restricted by possession of a strong, time-limited bearer invitation. Clearly communicate that forwarding the invitation forwards access. This is private link sharing, not authenticated per-friend access.
- Only a server-side runtime signs LiveKit tokens. Host grant: room join, publish, subscribe, publish data. Viewer grant: room join, subscribe, publish data for chat; no camera/microphone publishing. Scope all tokens to one room and give them short expiry.
- Initial participant tokens last one hour. LiveKit refreshes tokens for participants who remain connected. A viewer who leaves/reloads can ask the API for a new token only until the 12-hour invite expires; an owner who reloads must enter the creator key again. Do not promise uninterrupted broadcasting after a complete browser/app exit.
- No LiveKit API secret, creator key, or invite-signing secret in committed files, frontend bundles, logs, or URLs. Document environment-variable names in `.env.example` only. Use secure comparisons and do not print secrets in errors.
- Limit message length, room occupancy, and token-request frequency where the hosting environment permits. Enforce request size bounds and basic security headers. Client UI should treat remote chat as text, not HTML.
- Do not store video/audio, photos, or camera snapshots. The earlier dual-camera tracking project is not part of this hosted slice. No public search, user accounts, donations, gifts, recording, or moderation console in this phase.
- Warn that a short-lived invite cannot be recalled instantly in this slice; if that is unacceptable, follow-up work must add persistent room/invite state and revocation.

## API/data contracts (builder may choose exact paths)

- Create broadcast request: creator key; response: room ID, viewer URL/invite expiry, host LiveKit connection details/token. Invalid key receives a generic denied response.
- Join request: signed viewer invite; response: viewer LiveKit connection details/token and room name. Invalid/expired invites are denied before token issuance.
- LiveKit URL is public connection metadata; LiveKit API key/secret and invite signing key are server-only configuration.
- Session state may remain ephemeral/stateless for this first slice. Tokens and invites expire; stopping broadcast stops local media and disconnects. Do not claim hard revocation without a persistent store.

## Verification and delivery

- Automated tests cover invite signature/expiry/tampering, host/viewer grant differences, bad creator key, boundary inputs, and UI logic; the current local tests must still pass.
- Test responsive layout at narrow phone widths and the secure-context permission flow. Test presenter and viewer join in two independent browser contexts, then test with two real mobile devices on different networks once LiveKit credentials and the hosted URL exist.
- Deploy the site initially privately for smoke tests, configure LiveKit Cloud URL/key/secret and creator/invite secrets through server-side runtime settings, then make the page accessible to friends. Share the HTTPS invite, not a localhost or LAN address. Never label the cross-network media test complete until a remote network actually connects.
- No GitHub push is implied by this request. Keep source in the current VS Code repository and show the user what configuration they must do in LiveKit Cloud. Do not ask them to paste a long-lived secret into chat if a secure dashboard input is available.

## Secret setup and open deployment gate

The user must create a LiveKit Cloud project. In VS Code, they enter `LIVEKIT_URL`, `LIVEKIT_API_KEY`, and `LIVEKIT_API_SECRET` into an ignored local `.env.livekit.local` file based on a committed key-name-only example. The creator key and invite-signing secret can be generated locally with strong randomness, also kept in that ignored file; show the user where to read the creator key locally, not in a shared viewer link. After the Site exists, the assistant transfers values into Sites runtime secret settings without printing them, committing them, embedding them in a URL, or pasting them into chat. The deployment should be completed only after all secrets are configured. If this transfer route is unavailable, stop and guide the user to a secure Sites settings input; do not fall back to asking for long-lived secrets in chat.

Until those credentials exist, code and tests can be completed and the site can be previewed, but actual cross-network media cannot be validated. External hosting and LiveKit Cloud may have quotas and may require the user's account/consent; disclose this before making the Site accessible to friends.
