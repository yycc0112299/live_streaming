# 第二台電腦加入同一場直播：操作指南

## 先看目前是否能連（2026-10-23）

**Azure 公開站已部署雙主播版。第二位不需要 SSH 金鑰，也不必由第一位主播操作；但不能只讀 GitHub 就直接推流。** 第一次仍須由管理者建立 `host` 帳號、私下提供第二路 OBS 推流金鑰，並把第二位目前的公開 IP 加入 TCP 1936 白名單。GitHub 不會保存私人推流金鑰。

- 觀看及主播網頁：<https://group9liveb11302133.japaneast.cloudapp.azure.com/group9/>
- OBS 伺服器：`rtmps://group9liveb11302133.japaneast.cloudapp.azure.com:1936`
- 第二台發布路徑：`guest`；第一台是 `live`。兩台各有自己的密鑰。
- `http://127.0.0.1:4180/` 只供第一台本機演練。第二台打這個網址是在找第二台自己，不會連到第一台或 Azure。
- 只觀看／聊天：準備完成後開公開 HTTPS 網址即可，不必裝 OBS、Node 或 Python。以下是第二位也要出鏡、收音的流程。

## 一、由管理者先完成，完成後再通知第二位

1. 在既有 Azure VM 部署 `main` 的 `course/` 雙主播版；先停網站服務並一致性備份 SQLite/WAL/SHM、私人設定及現用 release，保留資料庫及原第一台密鑰。不要把本機 `.runtime` 整份複製到 Azure。部署規格見 [PUBLIC_ACCESS.md](PUBLIC_ACCESS.md) 與 [DUAL_OBS.md](DUAL_OBS.md#部署與備份)。
2. 公網先採 **RTMPS → HLS**，兩台 OBS 使用 H.264 + AAC，前端以 `APP_BASE=/group9/ VITE_WEBRTC=false` 建置，`PUBLIC_ORIGIN` 設為上述 HTTPS origin（不含 `/group9/`）。**不要照跑目前預設安裝器就認定完成**：須保留現有 RTMPS TLS／憑證設定，將第二台發布身份與 guest 讀取權限加入實際服務正在使用的 MediaMTX 設定，並確認 `live`、`guest` 都是禁止覆蓋既有 publisher 的獨立路徑。HLS 的每路播放清單也要能經網站代理讀取。RTMP/AAC 不可直接拿來宣稱 WebRTC 影音成功；WHIP/Opus 是另外的部署方式。
3. 在 Azure NSG 的 TCP 1936 來源中加入第二位當下的**公開 IPv4 `/32`**，保留第一台來源。第二位可用「what is my IP」查詢或由自己的網路管理介面確認，私下交給管理者；Wi-Fi／手機熱點切換後可能改變。不要填 `192.168.*`、`10.*`，也不必把 1936 對所有 IP 開放。觀看端走現有 HTTPS 443；不要公開 4455、4180、8888 或 9997。
4. **私下交付第二台專用的 Stream key**，格式為 `guest?user=guest_broadcaster&pass=<第二台專用密鑰>`。必須從 Azure 現用設定／同次產生且核對相符的私人檔案取得；本機 `.runtime/OBS-GUEST-PRIVATE.txt` 不一定與 Azure 相同。不要把密鑰放入 GitHub、Issue、截圖或共享帳本，也不要交付第一台的 `live` key。這個指南沒有包含真實密鑰。
5. 確認有能登入**這個 Azure 資料庫**的主持人帳號。若需變更既有帳號角色，由管理者在 VM 的目前 `course` release 設定 `DB_PATH=/opt/group9-live/shared/live.sqlite`，再執行 `node scripts/account-role.mjs <既有帳號> host`；這會撤銷原登入，須重新登入。第二位只需訪客身份的「上鏡配對代碼」，不必另外給管理員權限。
6. 交付前實際驗證公開站已顯示「雙 OBS 同台直播」、兩路獨立狀態、點數帳本；`/group9/api/account/me` 回 HTTP 200 JSON（未登入的 `user=null` 正常）。測一台停播不會讓另一台離線，再通知第二位可以開始。僅有首頁 200 或 GitHub 合併成功不算部署通過。

管理者私下交付清單：①已可用的公開網址 ②第二台 guest Stream key ③已加入哪個來源 IP ④雙方約定的測試時間。若 GitHub repo 是私人，第二位還需要 repo 的讀取權限；只觀看則不需要 GitHub 權限。

## 二、第二位先接通真實畫面與聲音

1. Windows 10/11 安裝官方 [OBS Studio](https://obsproject.com/download)。先用耳機做影音排查，避免還沒配置 AEC 就讓喇叭聲重複進入麥克風；**這只是連線基準測試，不代表免耳機需求完成**。
2. OBS 新增自己的「視訊擷取裝置」與「音訊輸入擷取」，選本機攝影機及麥克風；不要照抄另一台的裝置名稱。先確認預覽有人像、說話時音量表有反應。建議來源命名 `Group9 Camera`、`Group9 Microphone`，供後續網頁控制器使用。
3. OBS「設定 → 串流」選「自訂」，伺服器填上述 **rtmps://…:1936**，Stream key 貼管理者私下交付的完整 **guest** key，不要用 live，也不要把密鑰貼進伺服器欄。這個方案不需要在第二台啟動本機網站、MediaMTX 或 SSH tunnel。
4. OBS「設定 → 輸出」採 H.264、AAC 音軌 1；影像先設 1280×720、30 FPS、CBR 700 Kbps、關鍵影格間隔 1 秒，音訊 48 kHz／128 Kbps。這是排查用起點，並非所有網路的穩定容量保證；通過後再由雙方一起調整畫質。
5. 按「開始串流」。請管理者開公開 HTTPS 網址確認第二路顯示 LIVE，兩路畫面都能持續播放，第二位說話能被第三個觀看端聽到。OBS 的綠燈／送出位元組不等於網站已解碼成功。播放器預設靜音，觀看端需點音量；上鏡者不要開啟自己的返聽。
6. 停止第二台推流，確認第一台仍可播；再開第二台，確認網站能恢復。若連線失敗先看下方對照表，不要把防火牆全部關閉。

## 三、取得原始碼、完成免耳機配置及身份綁定

網頁本身不會把攝影機送進 OBS，也不會自動消除實體喇叭回音。兩台都必須完成本頁下方的 AEC 安裝與實機驗收。

需要完整原始碼時，在有 repo 讀取權限的電腦下載 main ZIP 並解壓，或執行：

```powershell
git clone https://github.com/yycc0112299/live_streaming.git
cd live_streaming/course
npm ci
```

Node.js 使用官方 24.x；Python 3.10–3.13 供 AEC 使用。若用 ZIP，請在解壓後的 `live_streaming-main/course` 開 PowerShell，再執行 `npm ci`。此時**不用**執行 `scripts/start.ps1`；它會另開本機伺服器，不能替你接到 Azure。舊 AEC 專用 ZIP 沒有完整網頁控制器及 Node 相依套件。

1. 先停止兩台 OBS 推流／錄影，各自在自己的電腦依下方「免耳機 AEC 安裝」選裝置、安裝及校正。不要照抄另一台的音效裝置編號。
2. 第二位用自己固定的瀏覽器開**同一個公開 HTTPS 網址**。在「點數與應援帳本」找到「上鏡配對代碼」，只把這個身份代碼交給主持人；它不是 Stream key，也不是下面的一次性 OBS 控制器配對碼。
3. 主持人登入同一公開網站，在「第二台參與者帳號」填第二位剛提供的完整代碼。**只有兩台確實已啟動 AEC Browser Source、停用原始麥克風及桌面音訊時，才勾選相應檢查並按「開啟雙 OBS 直播間」。** 不要為了讓按鈕可按而假勾；未準備好仍可先測上節的兩路影音。
4. 第二位留在同一個瀏覽器／身份重新整理，確認被指派為第二位，上鏡身份對應 `guest`，自己的返聽已關閉。清 Cookie、換無痕或換瀏覽器會變成另一個身份，不能沿用舊代碼。
5. 兩台重新推流，依下方驗收程序測單講、雙講及第三端聽音。未通過前保留「AEC 尚未驗收」，不要宣稱免耳機零回音。

## 四、選用：讓第二位用網站控制自己的 OBS

這不影響手動 OBS 推流；若控制器無法啟動，先用 OBS 原生按鈕排查，不要把它當作媒體連線失敗。

1. OBS「工具 → WebSocket 伺服器設定」啟用本機 WebSocket 並保留認證；不把 4455 開放到公網。控制程式只讀本機 OBS 設定，無需把 OBS 密碼交給主持人。
2. 第二位完成身份綁定後，在自己的公開網頁點「產生本機 OBS 配對碼」，把頁面顯示的完整命令貼到自己的 `course` PowerShell 執行。命令格式為 `node scripts/obs-controller.mjs https://group9liveb11302133.japaneast.cloudapp.azure.com/group9/ <一次性配對碼>`；請替換角括號部分，不要照打佔位字。
3. 配對碼只能用一次、5 分鐘內有效。保持程式運作，按網頁「讀取 OBS 狀態」，確認連到本人的 guest 路徑，才試麥克風／攝影機開關並讀回狀態。不要共用兩位的配對碼。
4. 若來源不是預設名稱，在執行命令前設定 `$env:OBS_CAMERA_INPUT='你的鏡頭來源名'`、`$env:OBS_MIC_INPUT='你的麥克風來源名'`；使用 AEC 時應指定／使用 `Group9 AEC Microphone`，不要同時送出原始麥克風。鏡頭需直接位於目前場景。
5. 「結束我的直播」會停止第二台的真實 OBS 推流，確認後才按；測完需第二位自行重新開始串流。它不應停止第一台。關網頁、結束記帳或控制器斷線不等於 OBS 已停播，最後要讀回 OBS 狀態。

## 問題對照

| 現象 | 先確認 |
|---|---|
| 公開站仍只有一個播放器、沒有帳本 | 管理者尚未部署新版；不是再裝一次 OBS 就能解決 |
| 第二台打 127.0.0.1 無法開啟 | 改用上方公開 HTTPS 網址；localhost 指第二台自己 |
| OBS 無法連到伺服器／逾時 | VM 是否 Running、TCP 1936 是否允許第二位目前的公開 IP、網路是否限制對外推流 |
| OBS 認證失敗 | guest key 是否完整、是否與 Azure 現用設定相符；勿用第一台或本機測試 key |
| OBS 發布成功但第二格仍離線 | Azure guest path／讀取權限、網站兩路代理與 HLS 建置、OBS 實際發布路徑；不要將兩台覆蓋到 live |
| 有畫面沒聲音 | 播放器靜音、OBS AAC 音軌／音量表、來源是否靜音；WebRTC 模式另需 Opus，不能只改前端開關 |
| 第二位看不到「我的 OBS 控制」 | 主持人綁定的身份代碼是否為此瀏覽器目前的代碼、場次是否還有效 |
| 控制器說發布路徑不符 | 第二台 OBS 必須是 guest；不要停用程式中的身份／路徑檢查 |
| 找不到麥克風／攝影機 | 實際來源名、目前場景及環境變數；不要另外加重複收音來源 |
| 回音、嘯叫或聲音被吃掉 | 先停止測試／關閉返聽，檢查 AEC reference 是否為真正發聲的喇叭、是否仍混入 raw mic／桌面音訊，再重做校正 |

## 最後確認才算第二台成功

- 同一公開網址同時顯示兩路真實影像，第三端能分辨兩人的聲音。
- 第二台停播／重開，第一台不受影響；第二路可恢復。
- 主持人綁定的是第二位目前身份，聊天、送禮與帳本在相同場次工作。
- 若要網站控制：關第二位麥／鏡頭只影響第二台，並可恢復。
- 若要免耳機：兩台實際喇叭開啟的單講／雙講測試通過，保留結果與限制。

## 免耳機 AEC 安裝（完整原始碼或 AEC 專用包）

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
