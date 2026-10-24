# Group 9 host RTMPS recovery: second IP change

- Current host egress IP: `49.218.251.200/32`.
- Azure NSG added `RTMPS_1936_HOST_CURRENT_IP_2` at priority 390: TCP 1936 Allow from that exact source.
- Existing host and guest TCP 1936 `/32` rules remained in place.
- Before the rule, OBS reported a connection timeout. After the rule, OBS showed `停止串流`, 30 FPS, and 0 dropped frames; the public site showed the host tile as `LIVE`.

This confirms that the first broadcaster's dynamic public IP must be compared with the Azure NSG before each launch.
