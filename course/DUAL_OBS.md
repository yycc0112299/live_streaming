# 固定兩台 OBS、帳號、聊天室管理與示範應援

2026-10-22 使用者確認：固定兩台電腦各自以 OBS 推流，觀眾在同一頁看兩人；希望兩人使用喇叭、不戴耳機。這一版使用既有 MediaMTX 的兩個媒體來源，不另建兩個直播間，也不要求改成瀏覽器攝影機。

## 開播與帳號

1. 在 `course/` 執行 `npm ci`、`npm test`，再執行 `powershell -File scripts/start.ps1 -WebRTC`。這會新增雙來源私人設定，保留原本的 `mediamtx.yml` 和第一台密鑰。若走原本 RTMP/AAC + HLS，不加 `-WebRTC`。
2. 兩位上鏡者與觀眾都可在網站註冊。帳號是 3–24 位英數／底線，密碼為 12–128 字。觀眾不登入仍可看影音；發言、檢舉、應援需要登入。
3. 管理者在伺服器本機執行 `node scripts/account-role.mjs <主持人帳號> host`，需要全站核帳時用 `admin`。這不提供公開自封主播接口；變更角色會撤銷該帳號現有登入。主持人重新登入後，可填另一位的帳號、確認音訊配置，開啟一場直播記帳。
4. 第一台 OBS 使用原本 `live` 路徑。第二台使用 `guest`，獨立 `guest_broadcaster` 密鑰；從伺服器 `.runtime/OBS-GUEST-PRIVATE.txt` 私下交付給第二位，不能放入 Git、聊天或截圖。兩台均不可共用 `live` 發布路徑。
5. 兩位的 OBS 使用相同伺服器，各自建立原有 SSH tunnel。WebRTC/WHIP 需要再轉送 `8889:127.0.0.1:8889`；觀眾 ICE/UDP 必須能到 MediaMTX，公網部署不能照搬 loopback 設定。不要公開 MediaMTX API。

| 模式 | 第一台 | 第二台 | 編碼 |
|---|---|---|---|
| RTMP → HLS | `rtmp://127.0.0.1:1935`，原本 `live` key | 同 server，私人檔案中的 `guest` key | H.264 + AAC |
| WHIP → WHEP | `http://127.0.0.1:8889/live/whip`，原本 broadcaster Bearer | `http://127.0.0.1:8889/guest/whip`，guest_broadcaster Bearer | H.264（無 B-frame）+ Opus |

`127.0.0.1` 指每台電腦上的 SSH tunnel，不是第二台直接連到第一台的 localhost。每台都要有自己的已授權 tunnel。不要把 RTMP 的 AAC 音軌當成 WebRTC Opus；WHEP 有畫面不代表有聲音。

網頁左右分割、窄螢幕上下排列，兩路各自顯示名字與 LIVE/OFFLINE。停一台不會讓另一台消失；恢復推流會重新播放。登入的兩位各自關閉自己的返聽，仍能收聽對方。主持人重新整理／關閉網頁不會停止 OBS；目前房間、身份對應及記帳 ID 保留在 SQLite，重新連線會恢復。結束本場記帳後，仍需兩台 OBS 各自停止串流。

## 免耳機 AEC：直接重用開源程式

採用 [samudinzul/aec-client v1.13.1](https://github.com/samudinzul/aec-client/tree/f76ed632649723003e8778661d565523bdbd5732)，MIT；不自行重寫 AEC 演算法。安裝腳本固定版本並檢查 GitHub release SHA-256，保留上游程式與模型。主程式授權存於 `third-party/AEC-Client-LICENSE.txt`；模型與 Python 套件沿用各自授權，沒有將它們混稱為本專案原創程式。

音訊路徑：實體麥克風 + **實際發聲的喇叭 WASAPI loopback** → 上游 DTLN-AEC 128 → 本機 WebSocket／AudioWorklet → OBS Browser Source（Control audio via OBS）。演算法、WASAPI callback 與輸入同步沿用固定版本的 AEC Client，只新增輸出到 OBS 的介面；不安裝虛擬音訊驅動，也不改 Windows 預設音訊裝置。

每台 Windows 電腦各做一次：

1. 安裝 Python 3.10–3.13。`powershell -File scripts/install-aec.ps1` 下載固定 AEC Client Web 包並核對 SHA-256，在 `.runtime/aec/venv` 安裝固定版本的套件。可用環境變數 `AEC_PYTHON` 指定既有 Python 執行檔。
2. `powershell -File scripts/start-aec.ps1 -List` 列出裝置，不啟動收音。找實體麥克風的 capture index，以及實際喇叭的 loopback index。
3. `powershell -File scripts/start-aec.ps1 -Mic <index> -Reference <index>` 啟動本機 bridge。僅監聽 loopback；實際收音只在 OBS 來源連線時開始，來源斷開後停止。
4. OBS 開啟本機 WebSocket server、停止串流／錄影，再執行 `node scripts/configure-obs-aec.mjs`。沿用 OBS 儲存的本機認證，不印出密碼。這會在目前場景新增 1px 的 `Group9 AEC Microphone`，啟用 Control audio via OBS、關閉本機監聽，並靜音該場景／全域原始麥克風與桌面音訊，避免混回未處理音訊；不自動開播。
5. 腳本會讀回 OBS 設定，並確認本機 AEC 已持續處理超過 10 個 frame。來源私有 URL 與還原資料只放在忽略的 `.runtime/`，不要分享。
6. 網站上開對方的聲音，用同一個被選為 reference 的喇叭播放。登入的兩位自己的返聽已關閉。不要另加原始麥克風來源；改用其它播放裝置時，必須重選 reference。
7. 收尾：`node scripts/configure-obs-aec.mjs --restore` 還原原來的靜音狀態／移除新增來源；`powershell -File scripts/stop-aec.ps1` 停止本次 bridge（會核對 PID、Python 路徑及腳本路徑）。bridge 停止時 OBS 輸出靜音。重新啟動 bridge 後重跑配置腳本更新私人 URL。

正常 Chrome 開啟本機 bridge 頁面只顯示診斷音軌，不把麥克風送到實體喇叭；真正的 OBS 環境才把處理後的音訊送到 OBS。bridge 遺失、處理錯誤或連線中斷時不改回原始收音，輸出靜音，避免突然回灌。此接法不需要 VB-CABLE；上游原生桌面版另需該閉源驅動，因此本專案沒有採用。

網站的靜音／返聽保護不等於聲學 AEC；真正消除喇叭回灌的是各台本機 AEC Client 引擎與 bridge。大音量、喇叭失真、參考選錯、兩人同房直接串音或雙重收音仍會影響效果。不能用合成測試宣稱「所有音量零回音」。

尚待的實機驗收：兩台均啟動 AEC Browser Source 後，分別單講、雙講、靜音、停播／重開；用第三個觀看端聽是否有重複聲／嘯叫及近端人聲被吃掉，固定並記錄喇叭音量與擺位。兩台喇叭開啟、完全不戴耳機的驗收才是此需求完成的依據。

## 持久帳號與應援帳務

使用 Node 內建 `node:sqlite`；預設 `.runtime/live.sqlite`，可用 `DB_PATH` 指向既有持久目錄。此檔包含帳號、登入驗證資料、聊天室訊息、規則、禁言、檢舉、稽核、直播場次與應援。不要將資料庫、WAL、SHM 或備份提交到 Git。

- 密碼使用各自隨機 salt 的 scrypt（N=32768、r=8、p=3），不存明文。Session 為隨機 256-bit 值，資料庫只存 SHA-256；七天過期，登出撤銷，角色更新撤銷登入。
- Cookie 為 HttpOnly、SameSite=Strict；HTTPS 使用 Secure。註冊／登入只接受 HTTPS 或本機 loopback；拒絕外站 Origin，限制內容大小、登入頻率及同時執行 scrypt 數量。不信任客戶端提交的身份、角色或餘額。
- 測試版每帳號初次註冊固定 1000 示範點數，重連／重新登入不補發。多個新帳號仍可各自領點；這不是實名或真人唯一性系統。正式版再改回 100 點。
- 應援只允許數字 1、5、10，本場至少一路必須在推流，不能送給自己。每筆有唯一請求 ID、發送者、收取者、場次、時間及交易 ID。SQLite `BEGIN IMMEDIATE` 同時扣點與插入收入紀錄；失敗全部回滾，同一請求重試回傳原交易，不重複扣點或播提示。
- 主播收入由不可重複的交易帳本加總，另於可用餘額顯示；不可購買、提領、兌換或轉回錢包。個人可查自己送出／收到，管理員可查最近全站交易與「已發點數 = 錢包 + 主播收入」核帳。
- 管理員可改置頂公告、每帳號 1–120 秒發言間隔及限制詞，刪訊息、禁言／解除、審核檢舉並讀操作紀錄。限速與禁言以帳號保存，換分頁／重連不能繞過。前端只顯示最近 100 則；刪除會從所有目前畫面和後續歷史移除，資料庫保留原文供檢舉查核。

## 部署與備份

單一 Node process 搭配本機 SQLite，沿用現有服務。Docker 備選啟動前先跑 `node scripts/configure.mjs --docker --duo`；推流憑證分別存 `.runtime/OBS-DOCKER-PRIVATE.txt` 與 `.runtime/OBS-GUEST-DOCKER-PRIVATE.txt`，不覆寫本機測試憑證。原生安裝器的 DB 放在 `/opt/group9-live/shared/live.sqlite`，跨 release 保留，私人目錄 0700；Docker 使用獨立 `accounts` volume，禁止 `docker compose down -v` 當一般更新指令。

公開登入必須先配置 HTTPS。在原生 shared `app.env` 設定 `PUBLIC_ORIGIN=https://你的網域`；Docker 將此環境值傳入，網域反代可沿用 `deploy/Caddyfile`。子路徑建置用 `APP_BASE=/group9/`；WebRTC 再加 `VITE_WEBRTC=true`。舊 HTTP IP 網址的公開影音可看，但新帳號功能會拒絕明文登入；不要為了登入而移除此保護。

更新前停服務再備份 SQLite（或用 SQLite backup API 做一致性備份）；不要只在運行時複製 `.sqlite` 而漏掉 WAL。資料庫與私人推流設定一起保留，分別限制存取。這版沒有重設密碼郵件、付費金流、多房間或無限擴充。

## 可重跑驗證

```powershell
npm test
$env:VITE_WEBRTC='true'
npm run build
# 需要既有 playwright、Chrome 與 MediaMTX；PLAYWRIGHT_MODULE 可指定已安裝的模組 URL。
node scripts/duo-smoke.mjs
```

雙來源 smoke 使用兩個獨立的合成 H.264/Opus WHIP sender，接入真正 MediaMTX，再由網頁兩個 WHEP reader 解碼；不是兩台實體 OBS 的驗收。結果位於 `evidence/duo-smoke.json`，手機寬度截圖 `evidence/duo-mobile.png`。

AEC 引擎測試先執行 `install-aec.ps1`，再以 `.runtime/aec/venv/Scripts/python.exe scripts/test-aec.py` 驗證。只使用合成訊號，不開啟麥克風或播放實體喇叭；結果不替代上述雙機免耳機驗收。

介面測試可先啟動 `python scripts/aec-bridge.py --synthetic`（使用上述 venv），再跑 `node scripts/test-aec-bridge.mjs`。OBS 閒置時可用 `node scripts/configure-obs-aec.mjs --test` 驗證真正 Browser Source 接收合成音訊；最後執行 `--restore` 和 `stop-aec.ps1`。不要把 synthetic 模式拿去正式直播。

## 既有開源元件來源

此變更沿用 [MediaMTX](https://github.com/bluenviron/mediamtx) 及其已保留 MIT 授權的 WHEP reader、[OBS／obs-browser](https://github.com/obsproject/obs-browser) 的原生 Browser Source 音訊介面、[Socket.IO](https://github.com/socketio/socket.io)、[hls.js](https://github.com/video-dev/hls.js)、[React](https://github.com/facebook/react)，資料庫與密碼原語使用 [Node.js](https://github.com/nodejs/node) 內建 SQLite／scrypt。不另外下載一套登入／聊天產品替換現有應用；只寫本專案的身份、權限、交易與介面接線。

AEC 查核另看了 [LocalVQE](https://github.com/localai-org/LocalVQE)（Apache-2.0，有 OBS 濾鏡源碼、查核當下無現成 Windows release binary）、[rust-aec](https://github.com/DeviesVi/rust-aec)（WASAPI/AEC3、原版需虛擬音訊裝置）；最後採用上述固定 AEC Client 引擎及免驅動輸出接線。下載包沒有因 README 的防毒排除建議而變更本機防護設定。

## 第二台電腦安裝包與實際聲學校正

執行 `powershell -File scripts/package-aec.ps1` 產生 `.runtime/exports/OBS-AEC-Second-PC-<commit>.zip`；包內 `SECOND_PC.md` 列出第二台所需的 Python、Node 與 OBS 步驟。僅以白名單收錄程式／說明／授權，逐檔與 ZIP 讀回 SHA-256 核對；不含既有憑證、帳號、資料庫、音訊或第一台的 venv。`MANIFEST.json` 記錄來源 commit 與工作樹是否有未提交修改。

`scripts/calibrate-aec.py` 可用實際喇叭與麥克風做 6 秒低音量校正，原始聲音只在記憶體分析，不寫成錄音。使用前須停止推流／錄影，並確認參考對應到實際播放裝置；`--self-test` 只測計算、不開啟聲音。測試回灌訊號不足時輸出 `inconclusive`，不能解讀為通過。完整雙機單講／雙講聽音仍是必要驗收。

### 2026-10-22 Docker 建置選項修正

Docker Compose 現在將 `APP_BASE`（預設 `/`）與 `VITE_WEBRTC`（預設 `false`）傳入前端建置；修改後必須執行 `docker compose -f deploy/compose.yml up -d --build`。WHEP 代理的容器內上游指定為 `http://media:8889`，不能指向 web 容器自己的 localhost。CI 另建 `/group9/` + WebRTC 映像並檢查實際輸出資產。

這只補齊建置與容器代理設定；預設 MediaMTX 配置仍是 HLS，啟用公網 WebRTC 還需配置媒體服務的 WebRTC、ICE 位址與 UDP/TURN。子路徑部署仍須反向代理移除 `/group9/` 前綴（包含 Socket.IO），目前 root Caddyfile 適用 `/`。未對 Azure 作部署變更。

### 最新訪客規則（2026-10-22，取代上方觀眾登入要求）

觀眾不用帳號密碼，測試版進站自動領 1000 示範點數並能聊天／應援；改暱稱是選用。主播與管理員仍可展開登入面板管理直播。相同瀏覽器 session 保留餘額，重新整理不補發；Cookie 過期（7 天）、清除、無痕或換瀏覽器會取得新訪客身份。SQLite 帳本與管理權限保留。應援需先有主播開啟的記帳場次。

## 2026-10-23 主播各自控制 OBS 與分級禮物

每位已綁定本場 live／guest 的主播，在自己的網頁會看到「我的麥克風、鏡頭與直播」。這是真正對各自 OBS 下指令，不是僅將觀看端靜音。關鏡頭會停用目前場景內指定的鏡頭來源，螢幕分享仍會繼續；結束直播只停本人的 OBS 推流，另一人不受影響，並有確認提示。

1. 在各自 OBS 啟用本機 WebSocket server。網站的上鏡身份需與該台發布路徑相同（主持人 live、第二位 guest）；主持人先建立房間，第二位可以使用自己的訪客「上鏡配對代碼」。
2. 點「產生本機 OBS 配對碼」，在自己的電腦 course 目錄執行頁面提供的 `node scripts/obs-controller.mjs <網站網址> <配對碼>`。需先執行 npm ci。配對碼只用一次、5 分鐘到期，不可分享；OBS 密碼只從本機設定讀取，不送到網站。
3. 保持控制程式運作，按「讀取 OBS 狀態」，即可使用開／關麥、開／關鏡頭、結束我的直播。控制器掉線或 OBS 未回覆會報錯，不會假稱操作完成。配對及 session 過期後需重新配對，沒有自動開機啟動。
4. 預設來源為 `Group9 Microphone` 與 `Group9 Camera`；有 `Group9 AEC Microphone` 時優先控制該 AEC 音軌。自訂來源可先設定環境變數 `OBS_MIC_INPUT`、`OBS_CAMERA_INPUT`。鏡頭需直接位於目前場景；群組內鏡頭請明確移至目前場景或後續擴充群組支援。請勿另保留重複收音的麥克風來源，關閉指定來源不會幫忙關閉其它重複來源。

控制器僅接受 HTTPS 網站或 localhost，對外只有主動 Socket.IO 連線，不開放本機控制 HTTP 埠或公開 OBS WebSocket。伺服器每次操作重新驗證主播本人與路徑，另一位主播或觀眾不能指定目標來越權控制。

禮物點數為 1 愛心、5 玫瑰、10 火箭、25 跑車、50 星光派對、100 夢幻嘉年華。高級禮物使用原創 SVG 火箭／跑車／城堡與摩天輪場景、光束及粒子；不是 TikTok 官方素材。動畫依序播放，聊天不蓋掉禮物，同一筆交易重試不重播。扣點、收入與帳本沿用同一原子交易；舊資料庫自動升級金額限制並保留舊交易。提供減少動態效果設定的 CSS 支援。
