# Mobile Cross-Network Live Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fixed HTTPS site where the owner can broadcast from a phone and invited friends can watch/chat across networks, without changing the running local demo.

**Architecture:** Author a Sites/Vinext app in `site/` of the existing VS Code repository; keep `src/` and `public/` for the local demo. Server routes sign short-lived LiveKit participant JWTs after checking either the creator key or a signed viewer invite. The browser uses LiveKit Cloud for media/data; Sites hosts the UI and token API while the user's PC is off.

**Tech Stack:** Existing Node.js 24/npm repository; Sites Vinext/React/TypeScript/Cloudflare Worker starter; `jose` for Worker-compatible HS256 signing; `livekit-client` for browser media; Node test runner; LiveKit Cloud.

**Spec:** `docs/superpowers/specs/2026-10-15-mobile-cross-network-live-design.md`

## Global Constraints

- The present local `http://127.0.0.1:4173/` server and room must not be interrupted during development.
- A friend needs a signed 12-hour bearer invite; newly issued LiveKit join JWTs last one hour and are room-scoped.
- Viewer tokens grant subscribe and chat data but never camera/mic publish; broadcaster tokens may publish, subscribe, and send data.
- No video, audio, image, or snapshot storage; no public directory, accounts, recording, gifts, or dual-camera integration.
- The site may be publicly reachable, but a room requires an invite; the creator key is separate and never included in the viewer URL.
- Long-lived secrets live only in an ignored local `.env.livekit.local` and Sites server-side secret settings, never in Git, browser code, or tool output.
- Build authoritative source in `site/`; for publication, copy only non-secret source into ignored `site/.sites-checkout/` and run the Sites workflow there. This confines Sites' separate `.git` to the ignored deployment checkout, so the parent repo can track `site/` source.
- Without the user's new LiveKit Cloud project/credentials, build and tests may pass but cross-network media is unverified.

## Review Focus

1. A malformed, expired, or tampered invite must fail before any LiveKit token is minted; Task 1 tests all three.
2. A viewer must not receive `canPublish` permission, including on repeated joins; Task 1 and Task 2 assert the decoded JWT grant.
3. Oversized/invalid API input must get a bounded 4xx response without echoing secrets; Task 2 tests it.
4. Camera permission refusal must close the attempted host connection and give an actionable UI error; Task 3 tests the session controller branch.
5. An invite arriving on a phone with no stream yet must show an offline/waiting state rather than a broken player; Task 3 browser QA covers it.

---

### Task 1: Sites skeleton, invite and participant tokens

**Files:**
- Create: `site/` from the supplied Sites Vinext starter, `site/lib/room-auth.ts`, `site/lib/livekit-token.ts`, `site/test/room-auth.test.mjs`, `site/test/livekit-token.test.mjs`
- Modify: `site/package.json`, `site/.gitignore`, root `.gitignore`

**Interfaces:**
- Produces: `newRoomId(): string` (32 lowercase hex characters); `issueViewerInvite(secret: string, room: string, now: number): Promise<{ invite: string; expiresAt: number }>`; `verifyViewerInvite(secret: string, invite: string, now: number): Promise<string | null>`.
- Produces: `creatorKeyMatches(provided: string, expected: string): Promise<boolean>` and `issueParticipantToken(apiKey: string, apiSecret: string, room: string, role: "host" | "viewer", now: number): Promise<string>`.
- `now` and `expiresAt` are Unix seconds. JWT identity is opaque/random; do not encode PII.

- [ ] **Step 1: Prepare the Site starter without editing the local server.** Create empty `site/`, run the Sites `project-setup.mjs` helper there, retain its build integration, add `jose` and `livekit-client`, set `site/package.json` test script to `node --test`, and ignore the deployment checkout plus local secret file. Check: `npm --prefix site install` exits 0.
- [ ] **Step 2: Write failing tests.** In `site/test/room-auth.test.mjs`, assert two room IDs match `/^[0-9a-f]{32}$/` and differ; an invite issued at `now=1_000` verifies at `1_001` but fails at `44_201`, with a changed signature, and with malformed input; empty/wrong creator keys fail. In `site/test/livekit-token.test.mjs`, decode host/viewer JWTs and assert `iss`, `video.room`, `video.roomJoin`, `video.canPublish`, `video.canSubscribe`, `video.canPublishData`, `exp=now+3600`, and unique anonymous `sub` values.
- [ ] **Step 3: See the red tests.** Run `npm --prefix site test`; expected: module/function-not-found failures from new tests.
- [ ] **Step 4: Implement the exact interfaces.** Use Web Crypto randomness, constant-time creator-key comparison, and `jose` HS256 signing/verification. Invites have 12-hour expiry, `scope="viewer"`, and a fresh nonce; tokens have one-hour expiry, room-scoped grants, and no user names in identity.
- [ ] **Step 5: Verify and commit only this task's files.** Run `npm --prefix site test` and root `npm test`; both pass. Stage only task files, not existing unrelated work, then commit `feat: add secure hosted room tokens`.

### Task 2: Server-side create/join API

**Files:**
- Create: `site/lib/room-api.ts`, `site/app/api/create/route.ts`, `site/app/api/join/route.ts`, `site/test/room-api.test.mjs`, `site/.env.livekit.example`
- Modify: `site/.gitignore`

**Interfaces:**
- Consumes Task 1 token/invite functions.
- Produces: `createBroadcast(request: Request, config: RoomConfig, now: number): Promise<Response>` and `joinBroadcast(request: Request, config: RoomConfig, now: number): Promise<Response>` in `room-api.ts`; `RoomConfig` has `livekitUrl`, `apiKey`, `apiSecret`, `creatorKey`, and `inviteSecret` strings.
- `POST /api/create` accepts `{creatorKey}` and returns `{room, inviteUrl, expiresAt, livekitUrl, token}`; `POST /api/join` accepts `{invite}` and returns `{room, livekitUrl, token}`. Only same-origin relative invite paths are derived from the request origin; no secrets are reflected.

- [ ] **Step 1: Write failing API tests.** Use real `Request` objects and fixed test-only secrets. Assert a valid owner creates a 32-hex room and viewer URL; wrong/missing key returns 403; valid invite joins; expired/altered invite returns 403; viewer token has `canPublish:false`; non-JSON, missing, >4 KiB, and unexpected field bodies return 4xx; a foreign `Origin` returns 403; responses contain no API/creator/invite signing secret; missing configuration returns 503.
- [ ] **Step 2: See red.** Run `npm --prefix site test`; expected: missing API module/failed assertions.
- [ ] **Step 3: Implement API boundary.** Validate strict JSON, length, and same-origin `Origin` when present; avoid secret-bearing diagnostics; use `Cache-Control: no-store`, `Content-Type: application/json`, and `X-Content-Type-Options: nosniff`; allow `POST` only. Route handlers read server runtime environment via `process.env` (starter's Worker `nodejs_compat`) and call the tested functions. Commit a names-only `.env.livekit.example`; ignore `.env.livekit.local`.
- [ ] **Step 4: Verify and commit.** Run `npm --prefix site test`; expected pass. Stage task files only and commit `feat: add protected live token API`.

### Task 3: Mobile broadcast, viewer, and chat UI

**Files:**
- Create: `site/components/LiveExperience.tsx`, `site/lib/live-session.ts`, `site/test/live-session.test.mjs`
- Modify: `site/app/page.tsx`, `site/app/globals.css`, `site/app/layout.tsx`

**Interfaces:**
- Consumes `/api/create`, `/api/join`, and their JSON response fields from Task 2.
- Produces: `startHostSession(room: LiveKitRoomLike, url: string, token: string, createLocalTracks: TrackFactory): Promise<void>` and `joinViewerSession(room: LiveKitRoomLike, url: string, token: string): Promise<void>` in `live-session.ts`, where the host factory supplies camera/mic tracks only after explicit start; `stopSession(room)` stops owned tracks and disconnects. `decodeChatPayload(bytes: Uint8Array): string | null` accepts only bounded UTF-8 text.

- [ ] **Step 1: Write failing session tests.** Fake only the external LiveKit room/media APIs. Assert viewer join never invokes camera factory; host permission refusal disconnects and stops any acquired tracks; stop closes tracks and disconnects; invalid or oversized chat payloads are dropped while accepted payloads remain plain text.
- [ ] **Step 2: See red.** Run `npm --prefix site test`; expected missing session functions/failed assertions.
- [ ] **Step 3: Implement mobile-first UI.** The home page chooses **Start broadcast** or **Watch**; host enters creator key, sees local preview/share URL/expiry, starts camera+mic after click, sees connection and viewer state, and can stop; viewer invite preselects watch mode, shows waiting/offline, remote video/audio, text chat, reconnecting/error states. Use `livekit-client` Room events and reliable data packets; restrict chat length; never use HTML injection. Keep usable 320 px width, large touch targets, visible mute/camera permission errors, and accessible labels.
- [ ] **Step 4: Verify and commit.** Run `npm --prefix site test`, `npm --prefix site run build`, and root `npm test`; expected pass. Preview in browser and check 320/390 px layout. Once LiveKit credentials exist, Task 4 must additionally exercise camera/mic permission, offline waiting, and chat `<img>` text rendering in a connected room; do not claim those before the credential gate. Stage task files only and commit `feat: add mobile LiveKit broadcast UI`.

### Task 4: Secret setup, publication, and real cross-network proof

**Files:**
- Create: `site/README.md`, `site/.openai/hosting.json` via Sites setup/registration
- Modify: root `README.md`, `docs/ARCHITECTURE.md` only to distinguish local vs hosted status

**Interfaces:**
- Consumes the built Site, tested routes/UI, and user-created LiveKit Cloud credentials.
- Produces a stable HTTPS Site URL plus a tested viewer invite; if credentials are not yet provided, produces a private deployed shell and an explicit verification blocker instead.

- [ ] **Step 1: Document setup and failure boundary.** Explain LiveKit Cloud project creation, where `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `CREATOR_KEY`, and `INVITE_SIGNING_KEY` belong, that `.env.livekit.local` is untracked, and that owner PC-off does not keep its stream online. Document 12-hour invite expiry and forwarded-link access.
- [ ] **Step 2: Register the Site once and persist the returned project ID.** Read `site/.openai/hosting.json` first; if absent, use `create_site` once, immediately run Sites `set-project-id.mjs` in `site/`. Keep audience owner-private through smoke tests. Never print or commit credentials.
- [ ] **Step 3: Transfer secrets and validate.** Copy only tracked/intended source files (exclude `.env*`, `node_modules`, build output, and runtime data) to ignored `site/.sites-checkout/`; run dependency installation and Sites source workflow from **that checkout**, not from `site/`, because the helper otherwise initializes a nested Git repo in the authoring directory. If the user has made the LiveKit project and filled ignored local config, set each as a Sites secret through native tools without printing values and check `get_environment_variables` shows keys as secrets, not plaintext. Build/package, save/deploy the private version, and inspect terminal deployment status. If credentials are still absent, the private page may deploy as an explicitly unconfigured shell; do not make it public or claim media works.
- [ ] **Step 4: Enable friend access and test actual remote media.** Set Site audience to public as the approved link-access design requires. On two real phones or a phone plus computer on different networks, start a stream, join via invite, verify audio/video/chat and viewer count, stop, and verify media ends. Do not claim this passed from a same-device/same-network test. If credentials or phones are missing, report exactly which proof remains unrun.
- [ ] **Step 5: Verify and commit documentation.** Run `npm --prefix site test`, `npm --prefix site run build`, and root `npm test` again; commit only task docs/manifest. Leave the original local stream untouched.
