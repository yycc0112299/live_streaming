# First presentation plan — October 19

This is a 5–7 minute English presentation outline for the EMI course. Replace role placeholders with real member names before presenting.

| Time | Slide | Talking points |
| --- | --- | --- |
| 0:00–0:45 | Problem and goal | Existing viewers aggregate other platforms; our platform lets people broadcast themselves and lets others watch live. |
| 0:45–1:45 | Team responsibilities | **Frontend:** responsive studio and viewer UI. **Backend:** room lifecycle, signaling, chat, later identity/moderation. **Environment:** Node setup, tests, HTTPS/TURN deployment and CI. Assign actual names. |
| 1:45–3:00 | Architecture | Browser camera/mic → WebRTC → viewer; Node WebSocket server for room coordination/chat. Explain why a media server will be needed at scale. |
| 3:00–4:30 | Platform features | Now: create room, live video/audio, share link, watch, chat. Next: room discovery, search, favorites, multi-view, moderated chat, recording/replay. Later: gifts/donations after safety and payment design. |
| 4:30–5:45 | Schedule and milestones | Oct 15: architecture and local prototype. Oct 17: integration and two-browser demo. Oct 18: tests, slides, English rehearsal. Oct 19: first presentation. Later sprints: accounts/moderation, TURN/HTTPS, SFU/recording, discovery/product features. |
| 5:45–6:30 | Demo and risks | Show host and viewer tabs; mention camera permission, network reliability, and scalability limits. |

Keep the talk inside 5–7 minutes. The current implementation is a prototype, so distinguish working features from planned features during the recorded presentation.
