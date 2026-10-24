# Group 9 直播疑難排解

先依 [DUAL_LIVE_RUNBOOK.md](DUAL_LIVE_RUNBOOK.md) 做「VM Running、兩台 IP 白名單、兩路 OBS 開播」三項檢查，再依症狀處理。

| 症狀 | 最可能原因 | 固定處理方式 | 成功判斷 |
| --- | --- | --- | --- |
| OBS 顯示連線逾時、`bytes=0`、RTMPS socket failed | 主播外網 IP 改變，不再符合 Azure NSG | **先取得目前公開 IP，再和 Azure 入站規則逐列比對**；缺少時新增 TCP 1936、該 IP `/32` 的 Allow 規則，保留其他主播規則 | Azure 表格已顯示該 `/32`，OBS 傳送位元組增加且無重連 |
| OBS 顯示無法存取頻道／串流金鑰 | 發布路徑或憑證配錯 | 第一台只用 `live`，第二台只用 `guest`；以本機既有 private 設定重新套用，不要猜測或重設金鑰 | MediaMTX 對應路徑 online |
| OBS 開成空白畫面或沒有正確推流設定 | 載入了空白預設檔 | 第一台切回 `Group9 Local`／`Group9 Course`；第二台載入自己的 guest profile | 正確攝影機、麥克風與 Stream 設定出現 |
| 第一格 LIVE、第二格 OFFLINE | 第二台沒有真正發布 guest，或使用了 live | 第二台確認 WebSocket 4455、固定電腦憑證、Startup 任務及 guest profile；必要時執行 `course/scripts/start-auto-broadcast.ps1` | `guest` ready/online 且網站第二格 LIVE |
| 第二台 Windows 登入後沒有自動開播 | 固定電腦捷徑或憑證不存在 | 在第二台網站控制區重新產生固定電腦命令，執行 `save-obs-device.mjs` 後再執行 `install-auto-broadcast.ps1` | Startup 有 `Group9 Auto Broadcast.lnk`，重新登入後 OBS 自動推流 |
| 網站可開但兩格都 Offline | VM 的 MediaMTX 尚未恢復，或兩台 OBS 未開始 | 等 VM 服務恢復，再看兩台 OBS 是否顯示「停止串流」與傳送位元組 | `live`、`guest` 的 inbound bytes 持續增加 |
| 網站按鈕不能控制本機 OBS | OBS WebSocket 未開或控制器未配對 | 在該台 OBS 啟用 WebSocket 4455；網站重新產生配對碼並執行 `obs-controller.mjs` | 「讀取 OBS 狀態」顯示本機 streaming／mic／camera 狀態 |
| VM 已 Running 但公開網址無法使用 | web/media/Apache 服務未恢復或部署問題 | 在 VM 檢查 `group9-web`、`group9-media`、Apache；只重啟失效服務並讀回狀態 | 公開 `/group9/` 與 `/group9/api/status` 正常，媒體服務 active |

## 不要做的事

- 不要把 TCP 1936 開放給 `Any`；每位主播只用自己的目前 `/32`。
- 不要讓第二台使用第一台的 `live` 路徑或憑證。
- 不要把 `.runtime`、OBS 金鑰、WebSocket 密碼或固定電腦憑證輸出到聊天、終端紀錄或 Git。
- 不要只看到 OBS 按鈕就宣稱成功；必須同時看到 OBS 位元組增加，以及 Azure／公開網站的對應路徑 LIVE。

## 已知復原案例：主機 IP 變動

2026-10-24 同一台第一主播電腦曾由 `49.216.20.1/32` 改為 `49.218.251.200/32`。舊規則仍存在時，OBS 會顯示「與伺服器連線失敗／連線逾時」且無傳送位元組；新增新 IP 的 TCP 1936 `/32` Allow 規則後，OBS 立即恢復推流，公開網站第一格回到 `LIVE`。因此每次開播在換 Wi-Fi、手機分享或 ISP 重連後，都先做 IP 比對，避免重複嘗試 OBS。
