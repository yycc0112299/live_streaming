# 手機／瀏覽器直播（第二格可用手機加入）

老師要求「手機也可以加入直播畫面、手機可以直播」。本功能讓已加入直播間的主播，不必安裝 OBS，直接用手機（或電腦）的相機推流到自己的那一格。

## 架構

```text
手機瀏覽器 getUserMedia ──WebRTC WHIP (SDP over HTTPS)──> Apache /group9/ ──> Node server.mjs
        │                                                           │ 驗證登入與該格擁有者
        │                                                           │ 由伺服器加上 MediaMTX 發布帳密
        └──────────── RTP/SRTP 影音（UDP/TCP 8189）──────────────> MediaMTX  guest 或 live 路徑
                                                                    │
                                    觀眾 ◀── HLS / WHEP ────────────┘（與 OBS RTMP 來源相同）
```

- 影音走 WebRTC（W09：即時影音優先 UDP；不行時 ICE 退回 TCP 8189）。聊天仍是 Socket.IO（TCP）。
- 手機端優先 H.264，讓 MediaMTX 直接轉成 HLS；音訊為 Opus。
- 瀏覽器從不接觸串流金鑰：`/webrtc/<path>/whip` 只接受本場上鏡主播（第一位＝`live`、第二位＝`guest`），伺服器從 MediaMTX 設定讀取該路徑的發布帳號後加上 `Authorization`。
- 同一格同時只能有一個來源（MediaMTX `overridePublisher: false`）。手機推流前，該格的 OBS 必須先停止。

## 手機加入第二格的操作

1. 第一位主播已依 [DUAL_LIVE_RUNBOOK.md](DUAL_LIVE_RUNBOOK.md) 開好 VM、網站與自己的 `live` OBS。
2. 手機用 Chrome（Android）或 Safari（iPhone）開 `https://group9liveb11302133.japaneast.cloudapp.azure.com/group9/`，註冊或登入自己的帳號。
3. 按「以第二位主播加入」（或「直接加入第二路」）。
4. 出現「手機／瀏覽器直播 · 第二格」面板後，選「前鏡頭」或「後鏡頭」，按「開始手機直播」，允許相機與麥克風。
5. 狀態顯示 `LIVE`、已傳送 MB 持續增加；觀眾頁第二格顯示 `LIVE`。按「停止手機直播」結束。

電腦也能用同一個面板：選「前鏡頭／電腦鏡頭」或「分享螢幕」。

## VM 需求

- MediaMTX 設定 `webrtc: true`，`webrtcLocalUDPAddress: :8189`、`webrtcLocalTCPAddress: :8189`，`webrtcAdditionalHosts` 填 VM 公網 IP（見 `deploy/mediamtx.azure.example.yml`）。
- Azure NSG 需開放 **UDP 8189 與 TCP 8189**（手機的網路位址不固定，所以來源是 Any；只接受經過已驗證 WHIP 交握的 ICE 連線）。8889 不對外開放，WHIP 一律經過 Node 驗證。
- 網站必須是 HTTPS（手機瀏覽器只有在安全來源才允許相機）。

## 部署到 Azure VM（2026-11-27 實際做法）

1. 在 VM 上 clone 已推送的分支，把 `course/` 複製成新的 `/opt/group9-live/releases/<名稱>`，執行 `npm ci`、`npm test`，再執行 `APP_BASE=/group9/ npm run build`，最後把擁有者改為 `group9-live`。
2. 改 `/etc/systemd/system/group9-web.service.d/release.conf`：`WorkingDirectory` 和 `ExecStart` 指向新 release，並加上 `Environment=MEDIAMTX_CONFIG=/opt/group9-live/shared/mediamtx.yml`。改之前先備份舊檔。
3. 執行 `systemctl daemon-reload && systemctl restart group9-web`。MediaMTX 不用重啟，OBS 直播不會中斷。
4. **把新 release 的 `dist/assets/*` 複製到 `/var/www/html/group9/assets/`**。Apache 從這裡提供 JS／CSS，沒複製的話網頁會是空白。
5. 驗證：公開頁面的 JS／CSS 都回 200；未登入時 `POST /group9/webrtc/guest/whip` 回 401。

回滾：把備份的 `release.conf` 複製回去，再 `daemon-reload` 並重啟 `group9-web`。

## 限制

- 手機在行動網路下若同時封鎖 UDP 與 TCP 8189，就無法連線；需改用 Wi-Fi 或日後加 TURN。
- 觀眾端仍是 HLS，延遲約 2 秒；WebRTC 只用在上傳端。
- 手機鎖螢幕或切到背景時，瀏覽器可能暫停相機，直播會中斷。
