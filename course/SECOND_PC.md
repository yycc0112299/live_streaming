# 第二台電腦：OBS 免耳機 AEC 安裝包

這是本機 AEC 配套，不含推流密鑰、網站帳號、資料庫或任何第一台電腦的私人設定。第二台仍使用自己的 OBS，發布到伺服器的 `guest` 路徑；密鑰需另行私下交付。

需要 Windows 10/11、Python 3.10–3.13、Node.js 24、已安裝的 OBS，以及第一次安裝時可連線 GitHub／PyPI。ZIP 不是已安裝完成的軟體，也沒有打包一份不能搬移的第一台 Python venv。

1. 將 ZIP 解壓到自己的資料夾，開啟其中 `course`，在此資料夾開 PowerShell。
2. 執行 `powershell -File scripts/install-aec.ps1`。它會核對固定上游版本的 SHA-256，建立本機 Python 環境並安裝套件；不安裝核心音訊驅動、不改防毒或 Windows 預設裝置。若 Python 不在 PATH，可先設 `$env:AEC_PYTHON='你的 python.exe 完整路徑'`。
3. 執行 `powershell -File scripts/start-aec.ps1 -List`。從這台的清單選實體麥克風 capture index，以及實際播放對方聲音的喇叭 loopback index。**不能照抄第一台的數字。**
4. 執行 `powershell -File scripts/start-aec.ps1 -Mic <本機麥克風編號> -Reference <本機喇叭參考編號>`。
5. OBS 開啟本機 WebSocket server，保持既有認證；停止串流與錄影，再執行 `node scripts/configure-obs-aec.mjs`。它會新增處理後的 Browser Source、靜音原始麥克風／桌面音訊，關閉自己的本機監聽，並備份原設定。不要把原始麥克風再混入直播。
6. 以第二位帳號登入直播網站，自己的返聽會自動關閉。只開對方的音量，並確認使用第 3 步所選的喇叭。兩台都完成後，再各自用 OBS 開播。

收尾／復原：先停 OBS 推流／錄影，執行 `node scripts/configure-obs-aec.mjs --restore`，再執行 `powershell -File scripts/stop-aec.ps1`。重新啟動 bridge 後需要重跑配置腳本，更新 OBS 的私人來源 URL。

## 驗收

先做不使用音效裝置的引擎測試：

```powershell
.runtime/aec/venv/Scripts/python.exe scripts/test-aec.py
```

校正工具會播放 6 秒低音量合成聲，只在記憶體分析麥克風／喇叭回灌，不保存原始錄音。先停止任何推流／錄影，再從裝置清單選出相配的 speaker 與 loopback：

```powershell
.runtime/aec/venv/Scripts/python.exe scripts/calibrate-aec.py --self-test
.runtime/aec/venv/Scripts/python.exe scripts/calibrate-aec.py --mic <capture> --reference <loopback> --speaker <playback>
```

`inconclusive` 代表參考音／回灌太弱等情況，不能當作通過；不要單看「程式執行成功」。低音量自動校正也不代表正常對話音量已通過。

最後必須兩台都開喇叭、不戴耳機，做 A 單講、B 單講、同時說話、停播重開，由第三個觀看端獨立聽音，確認沒有可辨識的重複聲／嘯叫，且兩人的聲音沒有被吃掉。記錄兩台是否同房、喇叭音量和擺位；不能把合成測試的數字當成這項驗收已完成。

完整規格、開源來源與限制見 `DUAL_OBS.md`。`MANIFEST.json` 記錄安裝包來源 commit 與每個檔案的 SHA-256；下載的上游 AEC 包由 installer 另行驗證。

## 2026-10-23 網頁上的本人 OBS 控制

第二台要使用關麥／關鏡頭／結束自己的直播，需要完整 course 原始碼中的 `scripts/obs-controller.mjs`、`scripts/obs-actions.mjs` 及 Node 相依套件（在 course 執行 npm ci）。先前的 AEC 專用 ZIP 不包含這個後來新增的控制器，請勿把 AEC 已啟動誤認為網頁控制器也已配對。上鏡身份加入房間後，在自己的頁面產生一次性配對碼，依 DUAL_OBS.md 最新節操作；兩台各自配對，不共用配對碼。
