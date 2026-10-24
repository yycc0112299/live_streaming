# Group 9 雙主播開播 Runbook

這是從 **Azure VM 與兩台 OBS 都已關閉** 到兩格同時 `LIVE` 的固定流程。公開觀看入口：<https://group9liveb11302133.japaneast.cloudapp.azure.com/group9/>。

## 固定前提（每台電腦只做一次）

- Azure VM 已部署目前 `main`，MediaMTX 的 `live`、`guest` 發布路徑與 HTTPS 網站已存在。
- 第一台 OBS 使用設定檔 `Group9 Local`、場景集合 `Group9 Course`，發布 `live`。
- 第二台 OBS 已載入自己的 `guest` 設定、攝影機與麥克風，並啟用本機 OBS WebSocket `4455`。
- 第二台已由第一位主播同意加入一次，且已執行網站產生的固定電腦命令與 `scripts/install-auto-broadcast.ps1`。

以上是第一次設定，不是每次開播都重做。兩台絕不可共用 `live` 或 `guest` 憑證。

## 每次開播

1. 在 Azure Portal 啟動 `Capstone / B11302133`，等待狀態為 **Running**。
2. 用公開網址確認網站可開啟；若 VM 剛啟動，等待 `group9-web`、`group9-media` 與 Apache 恢復。
3. 分別取得第一台與第二台目前的公開 IP。兩個 IP 都必須各有一條 Azure NSG **TCP 1936、來源 `/32`、Allow** 規則。IP 改變時只新增／更新該台的 `/32`，不得對所有 IP 開放 1936。
4. 第一台開 OBS，確認標題為 `設定檔: Group9 Local - 場景: Group9 Course`，按 **開始串流**。
5. 第二台登入 Windows。已完成固定電腦設定時，Startup 會開 OBS、連上自己的 `guest` 路徑並開始串流；若沒有自動啟動，執行 `powershell -File course/scripts/start-auto-broadcast.ps1`。
6. 各自確認 OBS 顯示「停止串流」、傳送位元組持續增加、沒有重連／逾時。
7. 重新整理公開網站，第一格與第二格都必須顯示 `LIVE`；Azure MediaMTX 讀回 `live`、`guest` 皆為 ready/online，且有非零 inbound／outbound bytes。

## 可直接貼給 Codex 的提示詞

### 第一位主播電腦

```text
請依 course/DUAL_LIVE_RUNBOOK.md 執行「每次開播」第一位主播部分。假設 Azure VM 與 OBS 都已關閉：在 Azure Portal 啟動 Capstone/B11302133，確認公開 Group9 網站可用；查我目前公開 IP，僅在需要時新增 Azure NSG TCP 1936 的本機 /32 Allow 規則，保留既有兩位主播規則且不可對所有 IP 開放。接著開啟 OBS，確認設定檔 Group9 Local、場景 Group9 Course，開始 live 推流。以 OBS 傳送位元組與 Azure MediaMTX 的 live ready/online 狀態驗證，不要輸出任何金鑰、密碼或私人設定檔內容。
```

### 第二位主播電腦

```text
請依 course/DUAL_LIVE_RUNBOOK.md 與 course/SECOND_COMPUTER_CODEX.md 執行第二位主播部分。假設 OBS 已關閉：確認 Azure TCP 1936 可由我目前網路連線；若我的公開 IP 不在 Azure NSG，請建立僅限此 /32 的 TCP 1936 Allow 規則，保留既有規則且不要對所有 IP 開放。使用本機已設定的 guest OBS profile，確認 WebSocket 4455，執行 course/scripts/start-auto-broadcast.ps1 或開 OBS 後由固定電腦控制器開始 guest 推流。以 OBS 傳送位元組、公開網站第二格 LIVE 與 Azure MediaMTX guest ready/online 驗證。不要在終端、聊天或 Git 輸出任何金鑰、密碼或 .runtime 私人檔內容。
```

## 收播

1. 兩台 OBS 各自按 **停止串流**；第二台只能停止自己的 `guest`。
2. 確認公開網站兩格皆為 `OFFLINE`，且 MediaMTX 不再有發布者。
3. 不再需要公開網站時，在 Azure Portal 將 VM **Stop (deallocate)**。這會停止運算費用，但磁碟與部分網路資源仍可能計費。

疑難排解請看 [TROUBLESHOOTING.md](TROUBLESHOOTING.md)。已驗證的 IP 變動事故記錄在 [evidence/host-rtmps-recovery-20261024.md](evidence/host-rtmps-recovery-20261024.md)。
