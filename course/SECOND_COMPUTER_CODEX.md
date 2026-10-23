# 第二台電腦：交給 Codex 的加入指令

在第二台電腦開啟 Codex，貼上這句：

> 請讀取 `course/SECOND_COMPUTER_CODEX.md`，依序完成第二主播加入；操作 OBS 與網站並讀回驗證，私人推流金鑰不得顯示、上傳或寫入 Git。

## 一次性準備

- 安裝 OBS 與 Node.js 22 以上，取得本專案。
- 第二主播帳號必須已由管理者設為 `host`；這項權限只需設定一次。
- 將管理者私下提供的 `OBS-GUEST-PRIVATE.txt` 放在 `course/.runtime/`。檔案受 Git 忽略；Codex 只能拿它設定 OBS，不得輸出內容。
- 若第二台使用不同網路，Codex 先取得該網路的公開 IP，經使用者核准後把该单一 `/32` IP 加入 Azure TCP 1936 白名單。

## 每次加入

1. 開啟 `https://group9liveb11302133.japaneast.cloudapp.azure.com/group9/`，以第二主播帳號登入。
2. 確認畫面顯示第一位主播及「以第二位主播加入」，按下該按鈕。第一位主播不必輸入帳號或批准。
3. 依 `.runtime/OBS-GUEST-PRIVATE.txt` 設定第二台 OBS 的 `guest` 推流；不得使用第一台的 `live` 路徑。
4. 啟用 OBS WebSocket，從網站產生一次性 OBS 配對碼；在 `course` 執行網站顯示的 `node scripts/obs-controller.mjs ...` 命令。
5. 啟動 AEC Browser Source，停用原始麥克風與桌面音訊，再開始串流。
6. 讀回網站：第二台应显示 LIVE；「讀取 OBS 狀態」應顯示串流中；測試自己的開關麥克風與鏡頭。任一項失敗就停止並回報具體阻擋，不得宣稱加入成功。

主持人登入網站後，系統會自動建立等待第二位加入的房間；第二位離線不會阻止第一路直播。第二主播位置同時只允許一個具主播權限的帳號占用。
