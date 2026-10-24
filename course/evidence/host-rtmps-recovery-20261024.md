# Group 9 host RTMPS recovery

- Azure NSG added `RTMPS_1936_HOST_CURRENT_IP` at priority 380: TCP 1936 from `49.216.20.1/32`.
- Existing first-host (`49.214.7.169/32`) and guest (`106.1.117.66/32`) TCP 1936 rules remain unchanged.
- OBS after restart: streaming, about 685 kbps, 30 FPS, and 0 dropped frames.
- MediaMTX verification: both `live` and `guest` were ready and online; each had three HLS readers and non-zero inbound/outbound bytes.

The host ISP address changed, so the prior host-only NSG rule caused RTMPS publishing to time out.
