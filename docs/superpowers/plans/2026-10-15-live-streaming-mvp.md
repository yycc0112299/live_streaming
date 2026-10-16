# Live-streaming MVP implementation plan

> **For Codex:** Follow this plan in this session, verify each milestone, and report unimplemented future scope honestly.

## Goal

Create a runnable original self-broadcasting web app in the user's `live_streaming` VS Code workspace, using Pure Live as a product reference rather than source-code base.

## Architecture

Node HTTP serves the static frontend; WebSocket manages room lifecycle, text chat, and WebRTC signaling. The browser publishes camera/mic through one peer connection per viewer. In-memory rooms mean server restart clears rooms. This design is only for a local small-room demo.

## Tasks

1. Document architecture, upstream comparison, environment, and Oct 19 English presentation outline.
2. Test room registry behavior first, then implement it.
3. Test HTTP and WebSocket signaling behavior first, then implement it.
4. Implement broadcaster/viewer UI and browser WebRTC flows.
5. Install dependencies, run tests and local smoke checks, show workspace and preview.

## Out of scope

Cloning all Pure Live features, copying AGPL source/assets, public deployment, scalable SFU, TURN, recording, monetization, and user accounts.
