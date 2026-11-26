# Group 9 雙主播開播 Runbook

這是從 **Azure VM 與兩台 OBS 都已關閉** 到兩格同時 `LIVE` 的固定流程。公開觀看入口：<https://group9liveb11302133.japaneast.cloudapp.azure.com/group9/>。

## 角色分工

- **第一位主播／VM 操作者**負責啟動 Azure VM、確認網站與串流服務已恢復、處理兩位主播的網路白名單，並啟動自己的 `live` OBS。VM 尚未準備好時，第二位先不要開始推流。
- **第二位主播**不負責啟動或管理 VM，也不需登入 Azure Portal 或修改 NSG。收到第一位確認「網站可用、VM 已準備好」後，使用自己的帳號進入公開網站並加入第二主播位置，再用自己電腦的 `guest` OBS 開始串流。
- 網站上的「以第二位主播加入」只加入直播間並占用 `guest` 位置；影音仍由第二位自己的 OBS 傳送。第二位須在自己的 OBS 按「開始串流」，或使用已配置好的自動開播流程。第二位只停止自己的 `guest` OBS，不影響第一位的 `live` OBS。
- 本 Runbook 說明 Group 9 雙 OBS／MediaMTX 流程。獨立的 LiveKit 手機直播網站是另一條流程，不使用此處的 VM、`live` 或 `guest` OBS 路徑。

## 固定前提（每台電腦只做一次）

- Azure VM 已部署目前 `main`，MediaMTX 的 `live`、`guest` 發布路徑與 HTTPS 網站已存在。
- 第一台 OBS 使用設定檔 `Group9 Local`、場景集合 `Group9 Course`，發布 `live`。
- 第二台 OBS 已載入自己的 `guest` 設定、攝影機與麥克風，並啟用本機 OBS WebSocket `4455`。
- 第二台已由第一位主播同意加入一次，且已執行網站產生的固定電腦命令與 `scripts/install-auto-broadcast.ps1`。

以上是第一次設定，不是每次開播都重做。兩台絕不可共用 `live` 或 `guest` 憑證。

## 每次開播

1. **第一位主播／VM 操作者**在 Azure Portal 啟動 `Capstone / B11302133`，等待 **Running**，並確認公開網站、`group9-web`、`group9-media` 與 Apache 已恢復。
2. 第一位確認兩位主播目前的外網 IP 都已列入各自的 Azure NSG TCP 1936 `/32` Allow 規則。第二位若遇到連線問題，將錯誤告知第一位處理；不要自行登入 Azure 或更動規則。
3. 第一位開 OBS，確認標題為 `設定檔: Group9 Local - 場景: Group9 Course`，按 **開始串流**。
4. 第二位打開公開網址並登入自己的第二主播帳號，按 **以第二位主播加入**。
5. 第二位在自己的 OBS 載入已設定好的 `guest` profile，按 **開始串流**。若已啟用固定電腦自動開播，先確認 OBS 已自行開始，不要再重複啟動推流。
6. 兩位各自確認 OBS 顯示「停止串流」、傳送位元組持續增加且沒有重連／逾時。若第二位 OBS 連線失敗，第二位停止重試並請第一位檢查 VM、服務和網路白名單。
7. 重新整理公開網站，第一格與第二格都必須顯示 `LIVE`；第一位負責確認 MediaMTX `live`、`guest` 的服務狀態。第二位只回報自己的 OBS 狀態與網站第二格結果。

## 可直接貼給 Codex 的提示詞

### 第一位主播電腦

```text
請依 course/DUAL_LIVE_RUNBOOK.md 執行「每次開播」第一位主播部分。假設 Azure VM 與 OBS 都已關閉：在 Azure Portal 啟動 Capstone/B11302133，確認公開 Group9 網站可用；查我目前公開 IP，僅在需要時新增 Azure NSG TCP 1936 的本機 /32 Allow 規則，保留既有兩位主播規則且不可對所有 IP 開放。接著開啟 OBS，確認設定檔 Group9 Local、場景 Group9 Course，開始 live 推流。以 OBS 傳送位元組與 Azure MediaMTX 的 live ready/online 狀態驗證，不要輸出任何金鑰、密碼或私人設定檔內容。
```

### 第二位主播電腦

```text
請依 course/DUAL_LIVE_RUNBOOK.md 與 course/SECOND_COMPUTER_CODEX.md 執行第二位主播本次開播。第一位主播已負責啟動並準備 Azure VM、網站、串流服務與我的 TCP 1936 網路白名單；不要登入 Azure，不要修改 VM、NSG、防火牆、NGINX、Docker 或串流設定。請打開公開 Group 9 網站，以我的第二主播帳號按「以第二位主播加入」，再使用我自己的 guest OBS profile 按「開始串流」；如果固定電腦自動開播已運作，不要重複啟動。只確認我的 OBS 正在串流且位元組增加、沒有重連，以及網站第二格顯示 LIVE。第一格的 live 串流不得停止或變更。不要輸出任何金鑰、密碼或私人設定內容。
```

## 收播

1. 兩台 OBS 各自按 **停止串流**；第二台只能停止自己的 `guest`。
2. 確認公開網站兩格皆為 `OFFLINE`，且 MediaMTX 不再有發布者。
3. 不再需要公開網站時，在 Azure Portal 將 VM **Stop (deallocate)**。這會停止運算費用，但磁碟與部分網路資源仍可能計費。

疑難排解請看 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。已驗證的 IP 變動事故記錄在 [evidence/host-rtmps-recovery-20261024.md](evidence/host-rtmps-recovery-20261024.md)。
