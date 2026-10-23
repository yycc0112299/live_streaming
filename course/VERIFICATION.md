# 驗證紀錄 — 2026-10-19

## 2026-10-23 13:20 本機 OBS 重連成功（取代下方暫停狀態）

使用者手動啟動 MediaMTX 後，1935 與網站 4180 均正常監聽。OBS 原先是無標題空白場景且 WebSocket 無監聽；重新啟動並在未正常關閉提示選一般模式後，成功載入既有 Group9 Local／Group9 Course／Group9 Demo，既有認證的 WebSocket 4455 恢復，未變更安全設定或密碼。使用現用雙來源設定中的既有 live 認證重新推流至 localhost，OBS 讀回 outputActive=true、outputReconnecting=false，約 19 秒時送出 1536295 bytes、outputSkippedFrames=0，錄影仍為 false。網站來源 live=true、guest=false；Chrome 實際讀回 1280×720、readyState=4、paused=false，兩次播放時間由 27.073913 增至 38.504780 秒，畫面可見真實桌面與攝影機。私人截圖存 `.runtime/obs-reconnected-20261023.jpg`，不提交使用者畫面至 Git。網站、OBS 及使用者啟動的媒體服務保留運作；本輪僅證明本機單台直播恢復，未驗證獨立聽音、雙機、回音消除或 Azure 公網播放。

## 2026-10-23 單台重測暫停於媒體服務啟動

使用者確認第二台尚未準備，改為先測本人電腦。網站 4180 仍在運作，但本機 1935 沒有 listener，OBS 指向本機 RTMP 並持續重連、送出位元組 0。停止失效重連後，OBS 最後讀回推流／錄影均為 false；公開站亦未推流。啟動既有 MediaMTX 的命令被自動核准審查拒絕，僅回覆 `blocked by policy`，未改用其它方式啟動。需要使用者手動啟動既有 `.runtime/mediamtx/mediamtx.exe` 並指定 `.runtime/mediamtx.duo.yml`，再繼續 OBS／網站實播驗證。本輪尚未恢復直播，亦未進行雙機測試。

## 2026-10-23 合併 main 與真實單台 OBS 網站演練

- 依使用者指示將 PR #2 合併至 `main`，合併提交為 `d031b6d92e5b523a01b7123189b8cd21680c5602`。本機已切至 main 並同步。合併前最新 PR Actions run `39899620857` 成功；合併後本機課程測試 21/21、根目錄測試 6/6 與 HLS production build 通過，仍有既有大型 bundle 提醒。
- 先停止既有本機 Node 服務、備份 SQLite/WAL/SHM，再使用既有 `scripts/start.ps1` 重啟新版。觀看網址為 `http://127.0.0.1:4180/`，僅此 Windows 電腦可用，不是手機或公網網址。
- 真實 OBS 使用現有螢幕、攝影機與麥克風場景，透過本機 RTMP/H.264/AAC、MediaMTX HLS 到 Chrome。第一次推流因私人文字檔與現用雙來源設定的認證不一致失敗；改用現用 `mediamtx.duo.yml` 的既有認證後成功，沒有移除驗證或重設密鑰。OBS 讀回推流中、輸出位元組增加且啟動樣本跳幀 0；Chrome 讀回 1280×720、readyState=4、paused=false。未獨立驗證實體喇叭聽音，也未測延遲／長時間穩定度。
- 演練主持帳號及場次以本機測試資料初始化；第二位名稱明寫「第二台待加入（演練占位）」，並未連接第二台實體 OBS。沒有勾選「兩台均已啟動 AEC」或宣稱 AEC 驗收通過。這是單台媒體及互動功能演練，不能視為雙機開播流程驗收。
- Chrome 實際以主持人及訪客身份透過 Enter 送出聊天。觀眾送出火箭 10 點、跑車 25 點、星光派對 50 點及語音留言 10 點；動畫狀態可見，四筆交易共 95 點。重新整理後觀眾餘額仍為 5 點；主持人登入後帳本實收 95 點，與 SQLite assert 核對一致。語音留言確認扣點與入帳，未以實體聽音驗證朗讀。
- 私人畫面證據存於忽略的 `.runtime/rehearsal-*-20261023.jpg`，包含直播、送禮及雙方帳本；因畫面含使用者真實桌面／攝影機，不提交至 Git。可提交的彙總證據為 `evidence/rehearsal-2026-10-23.json`。
- 公開 HTTPS 網站重新整理後仍是舊版單主播介面，未把 main 合併當成部署完成。Azure Run Command 清單載入失敗，重載後 Portal 回報 PageLoadTimeout；既有臨時 SSH key 亦未獲授權，因此本輪未更新 Azure。未新增 SSH key、網路規則或放寬權限。
- 自動核准審查拒絕啟動本機 OBS 網頁控制器，只回覆 `blocked by policy`，無更具體原因；未重試繞過，因此未進行本輪網頁麥克風／鏡頭／停播控制驗收。
- 為讓使用者接續演練，本機網站、MediaMTX、單台 OBS 推流與演練場次保留運作。OBS 目的地目前為本機 RTMP；原公網目的地設定私下備份於 `.runtime/rehearsal-obs-before.json`。未開始錄影、未由本機向公網推送畫面；需結束時停止 OBS 推流，勿把本機網址當作對外分享網址。

依本機 `Group9_英文講稿_2026-10-19.md` 的最終七頁講稿核對，並讀回 GitHub 功能分支。實作範圍是單房 OBS/RTMP/MediaMTX/HLS、React/hls.js、Socket.IO、暱稱、狀態，以及簡報列為選做的按讚與人數。

## 2026-10-23 Azure 公網觀看與加密推流

既有 Azure VM `B11302133` 已設定 DNS `group9liveb11302133.japaneast.cloudapp.azure.com`。NSG 新增 TCP 443 公開 HTTPS，並新增 TCP 1936 RTMPS，來源限制為當時主播公開 IP `101.14.11.195/32`。Let's Encrypt 憑證已由 Certbot 申請並部署到 Apache，期限至 2027-01-20，並啟用自動續期。

MediaMTX 設定備份後改為 TLS strict 並監聽 `*:1936`；公開 API、HLS 上游及 Node 管理埠仍維持 loopback。從本機驗證 HTTPS 443 與 RTMPS 1936 可連線，`https://group9liveb11302133.japaneast.cloudapp.azure.com/group9/api/status` 回應 HTTP 200。這次使用 Azure Run Command，未建立 SSH 金鑰。尚未用手機行動網路播放或用 OBS 實際 RTMPS 推流驗收；第二台主播換網路後需新增來源 CIDR。

## 已通過

- Windows Node.js 24.18.0：課程版 `npm test` 5/5；原本根目錄 demo 6/6。
- 課程版 `npm run build` 成功；hls.js 的 bundle 大小會產生 Vite 提醒，不影響建置。
- `npm audit`：正式與開發依賴都回報 0 vulnerabilities（查核當下）。
- 官方 MediaMTX 1.21.2 Windows binary，官方 SHA-256 比對一致，私人設定檔通過 `--validate-conf`。
- 實際合成 1280×720 / 60 FPS H.264 + 48kHz AAC → RTMP → MediaMTX → HLS → 兩個獨立 FFmpeg 影音解碼器；主播放清單也必須標示 `FRAME-RATE=60.000`。
- Chrome `videoWidth=1280`、`videoHeight=720`、`readyState=4`、`paused=false`，播放時間持續前進。
- 兩個 Chrome 分頁設不同暱稱並互傳訊息，按讚數同步；新分頁可見最近歷史。
- 手機尺寸覆寫 390px：文件內容寬度 375px，無橫向溢出；畫面存於 `evidence/mobile-offline.png`。這是桌面瀏覽器尺寸模擬，不是真實手機。
- 推流停止後 `/api/status` 回到 `live=false`。
- 未提供主播密碼的 RTMP 發布被 MediaMTX 拒絕。
- `.runtime/OBS-PRIVATE.txt` 與 `.runtime/mediamtx.yml` 被 Git 忽略，沒有提交秘密。

影音證據：[`evidence/media-smoke.json`](evidence/media-smoke.json)、[`evidence/desktop-live.png`](evidence/desktop-live.png)、[`evidence/mobile-offline.png`](evidence/mobile-offline.png)。畫面中的彩條及音訊均為明確的合成測試訊號。

## Azure 與外部觀看

- Azure 既有 `B11302133` VM 第一次啟動回報通用錯誤；重新載入並重試後顯示 Running。實際確認為 ARM64 Ubuntu 24.04、1 GiB RAM，既有 Apache / MySQL 保留。
- 原生 Node.js 24.18.0 與 MediaMTX 1.21.2 均核對官方 SHA-256。VM 上測試 5/5、建置成功；`group9-web` 與 `group9-media` systemd 服務均 `active`，設定為開機啟動；`/api/status` 顯示服務可用。
- 公開展示入口：<http://20.89.110.14/group9/>。這是 HTTP 課程演示入口，尚未配置自有網域／HTTPS。原本 `/` 首頁在代理啟用前後 SHA-256 相同。
- 外部 Chrome 已實際播放 Azure HLS，讀回 1280×720、`readyState=4`、`paused=false`。兩個外部觀看分頁以不同測試暱稱互傳訊息，按讚數同步。畫面：`evidence/azure-live.png`。
- Azure VM 上的真實 RTMP/HLS 合成影音驗收也已通過：兩個影音解碼器各輸出 90 影格；停止推流後變成 OFFLINE、服務仍可用。見 `evidence/azure-media-smoke.json` 與 `evidence/azure-run-output.txt`，驗收時間為臺灣時間 13:56。
- 外部 FFmpeg 經公開 `/group9/hls/live/index.m3u8` 解碼影音，成功結束，輸出 60 影格，見 `evidence/azure-external-decode.txt`。這是傳輸／解碼驗證，不是延遲、穩定 FPS 或容量壓測。
- GitHub Actions 第一筆執行 [39206426173](https://github.com/yycc0112299/live_streaming/actions/runs/39206426173) 成功，包含 Linux 測試、正式建置、Compose 設定檢查與 Docker image 建置。Docker 是可攜備選模式，VM 本次實際使用原生 systemd。
- 部署程式提交 `3cbf918` 的 [push 檢查](https://github.com/yycc0112299/live_streaming/actions/runs/39207095213) 與 [PR 檢查](https://github.com/yycc0112299/live_streaming/actions/runs/39207098617) 均成功。
- Windows `powershell -File scripts/start.ps1` 亦已實際啟動成功，健康端點可用。

## 尚未通過／操作限制

- 真實 OBS 畫面／麥克風、兩台真實裝置在不同網路觀看與聽音尚未通過；合成訊號不替代這些驗收。
- 示範彩條只在驗收期間推流，結束後網站應回到 OFFLINE；不是全天候自動播放影片。
- 主播 RTMP 1935、MediaMTX API 9997、內部 HLS 8888 保持 loopback，OBS 使用 SSH tunnel。現有 SSH 私鑰／密碼不在此工作環境中，因此未冒稱已從這台電腦完成 SSH 主播推流。
- VM 為 Running 才提供服務並產生運算費用；deallocate 後網站離線，systemd 服務會在下次開機恢復。
- 不包含簡報未承諾的帳號、錄影、金流、FPGA 或雙鏡頭辨識整合。

## 2026-10-21 OBS 延遲實測

以 OBS `Group9 Demo` 的攝影機、Realtek 麥克風及螢幕來源推流至本機 RTMP，再經 MediaMTX、HLS、課程網站及 Chrome 播放。MediaMTX 確認收到 H.264/AAC 雙軌；OBS 麥克風電平有反應，但本次沒有獨立聽音驗收。攝影機已偵測且有 1280×720 來源尺寸，預覽區卻接近全黑，因此不能宣稱鏡頭影像驗收通過。螢幕畫面可播放。

延遲量測是在 OBS 暫時加入毫秒時鐘來源，對照 Chrome 觀眾端截圖的時鐘與截圖時間。均為同一台電腦、本機網路、8 張以內的短時測試，約有一個畫面影格與截圖時序誤差；不代表跨網路 Azure 觀眾端延遲。

| 設定 | 截圖數 | 端到端畫面延遲 | 結果 |
| --- | ---: | ---: | --- |
| 原有 MPEG-TS HLS、1 秒 segment | 6 | 約 2387–2411 ms，平均約 2400 ms | 基準 |
| Low-Latency HLS、200 ms part、1 秒 segment | 8 | 約 1285–1338 ms，平均 1299 ms | 保留此設定 |
| Low-Latency HLS、100 ms part、1 秒 segment | 8 | 約 1306–1360 ms，平均 1337 ms | 無改善，且 MediaMTX 警告 part duration 變動可能使 iOS 出錯 |

因此 `deploy/mediamtx.yml` 使用 Low-Latency HLS 與 200 ms parts，播放器啟用 hls.js `lowLatencyMode`。本機測得約減少 1.1 秒，但尚未達到低於 1 秒；不能把「以毫秒為單位量測」當成「毫秒級低延遲」。

上述紀錄是第一次測試的結果；後續已透過受限、限時的 SSH tunnel 完成 Azure OBS 實播與遠端延遲量測，結果記錄於下方。每次測試結束仍須停止 OBS、移除臨時金鑰，並在 Azure Portal 讀回 `Stopped (deallocated)`；解除配置停止 VM 運算計費，但儲存與網路資源可能仍計費。

### 2026-10-21 再測

- 同一台電腦的內建 `USB2.0 HD UVC WebCam` 這次在 Chrome 直播播放器中顯示清楚的人像，螢幕畫面亦同步可見。前次攝影機黑畫面並非持續故障；未確認它恢復的確切原因。麥克風仍只確認 OBS 電平及 MediaMTX 接收 AAC，未做獨立聽音。
- 暫時把 HLS segment 改為 600 ms，OBS 實際輸出約 600 ms GOP，維持 200 ms part。八張相隔約 0.9 秒的 Chrome 截圖量得 1256–1312 ms、平均 1277 ms。相較 1 秒 segment 的 1299 ms，改善約 22 ms，低於這套截圖方法的可靠辨識幅度，因此不採用此實驗設定；OBS 與私人 MediaMTX 設定已恢復。
- 使用者指定的 Google Chrome 可以自動登入 Azure Portal；在 Bastion 輸入既有 VM 使用者名稱後，Chrome **沒有**自動填入 VM 密碼。免費 Bastion Developer 仍需 VM 密碼或既有 SSH 私鑰，且瀏覽器內的 Bastion 連線不能直接提供本機 OBS 所需的 SSH tunnel。VM 保持 `Stopped (deallocated)`，未因此建立 Bastion 資源或開放新的入站埠。

### 2026-10-21 Azure OBS 60 FPS 實播

- 經使用者核准的限時、只允許轉送 VM loopback `1935` 的 SSH 公鑰建立 tunnel；RTMP、MediaMTX API 與內部 HLS 沒有改成公開入站。
- OBS 使用內建 `USB2.0 HD UVC WebCam`、Realtek 麥克風及螢幕來源，輸出 1280×720 / 60 FPS H.264、AAC。MediaMTX 的公開 HLS master playlist 讀回 `FRAME-RATE=60.000`。
- Azure VM 已部署 `lowLatency` HLS、1 秒 segment、200 ms part。播放器以 hls.js 的正式低延遲設定把目標延遲設為 0.8 秒、最大延遲設為 1.5 秒，最多以 1.5 倍速追趕。Chrome 新開前景分頁的端到端畫面樣本曾達 832、912、958 ms；分頁失去前景後則可增加到數秒，因此不能承諾所有情況都低於 1 秒，也不能把單一最佳樣本當成穩定延遲。
- 2500 Kbps 曾出現 `outputCongestion=1` 與大量跳幀；1000 Kbps 短測正常，但約 3 分鐘後累積 1411 個跳幀。降至 700 Kbps 後連續 1 分 55 秒仍為 `outputCongestion=0`、`outputSkippedFrames=0`，因此採用 700 Kbps 作為這條校外網路的展示預設值。曾測試強制跳轉播放位置與 500 ms 追趕門檻，但會造成黑畫面或停滯，最終未保留。

### 2026-10-21 17:00–17:10 官方 WebRTC 方法本機對照

- 方法來源：MediaMTX 官方 [OBS WHIP](https://mediamtx.org/docs/publish/obs-studio)、[WebRTC](https://mediamtx.org/docs/read/webrtc)、[Bearer 認證](https://mediamtx.org/docs/features/authentication)，以及 v1.21.2 開源 `reader.js`。課程網站直接使用原 reader，僅增加 ES module export，MIT 授權與來源已保留。
- 先使用同一個 OBS RTMP/H.264/AAC 來源，同時由原課程 HLS 播放器及 MediaMTX 原生 WebRTC 網頁觀看。HLS 時鐘落後約 1.59–1.65 秒，WebRTC 約 0.07–0.17 秒；這時 WebRTC 明確跳過 AAC，只有畫面，不能當完整影音成功。
- 再依官方方法改 OBS WHIP，Bearer 使用原主播帳密，沒有移除驗證。MediaMTX 日誌確認發布及讀取均為 H.264＋Opus 雙軌。課程網站已透過自己的 WHEP proxy 使用官方 reader，Chrome 播放讀回 `1280×720`、`readyState=4`、`paused=false`。
- 以下是毫秒時鐘的人工讀圖樣本。`before/after` 包住瀏覽器截圖呼叫，不是精密相機曝光時間；仍有影格、時鐘來源與截圖時序誤差。量的是 OBS 時鐘來源到播放器畫面，不是實體鏡頭曝光到螢幕的完整延遲。全部為同一台 Windows 電腦的 loopback，不能代表 Azure 或手機跨網路。

| 路徑 | 畫面中的 Unix 毫秒 | 截圖呼叫 before–after | 相減的粗略範圍 |
| --- | ---: | --- | --- |
| RTMP → 官方 WebRTC 頁 | 1792573264053 | 1792573264127–1792573264225 | 74–172 ms |
| 同來源 RTMP → 課程 HLS | 1792573262636 | 1792573264225–1792573264282 | 1589–1646 ms |
| WHIP → 官方 WebRTC 頁 | 1792573395266 | 1792573395500–1792573395594 | 234–328 ms |
| WHIP → 課程網站 WebRTC | 1792573525996 | 1792573526155–1792573526196 | 159–200 ms |
| WHIP → 課程網站 WebRTC（稍後） | 1792573668809 | 1792573669065–1792573669167 | 256–358 ms |
| WHIP → 課程網站 WebRTC（停播再開） | 1792573771908 | 1792573772081–1792573772161 | 173–253 ms |

- OBS WHIP 連續運行 5 分 36 秒時，狀態為 `outputCongestion=0`、`outputSkippedFrames=0`、20161 個輸出影格。網站稍後樣本仍可播；這不是逐影格無凍結測試，也不是長期穩定度證明。獨立聽音驗收仍未完成。
- OBS 停播後網站可見 OFFLINE；再開播後，不重新整理網站即恢復 LIVE、720p 播放。新 `scripts/start.ps1 -WebRTC` 已實際啟動成功；獨立設定通過 MediaMTX `--validate-conf`。原 HLS 與 WebRTC 兩種建置均成功。
- `npm test` 6/6。新增測試涵蓋 WHEP OPTIONS、POST、PATCH、DELETE、session Location 重寫、64 KiB 輸入限制、外站 Origin 拒絕、禁止 WHIP 與其他路徑。
- 結論：官方方法在本機有明顯改善，因此保留此方案；Azure 低延遲部署、真實跨網路觀看及獨立聽音尚未完成，不能標記整個目標完成。
- 收尾：OBS 已停止，串流服務設定與時鐘來源 URL 恢復測試前值；本次啟動的本機 HTTP／MediaMTX 服務已停止、相關連接埠無 listener。Azure 曾為準備測試啟動，未部署新版本或新增權限；之後已在 Portal 讀回 `Stopped (deallocated)`。跨網路測試等待使用者明確允許限時 SSH 轉送金鑰與 WebRTC 入站規則。
- 最終清理已讀回：OBS 推流 `outputActive=false`、本機 1935 tunnel 無監聽、OBS 程序已退出、VM 內臨時金鑰 `temporary_key_count=0`，Azure Portal 狀態為 `Stopped (deallocated)`。

### 2026-10-21 直播延遲結論修正

- 本次網站端到端觀看體感仍約 2 秒；這是跨裝置測試時應採用的目前實際數字。
- 先前記錄的 0.1–0.3 秒只代表同機 WebRTC／局部傳輸量測，不代表課程網站的完整端到端延遲，也不能用來宣稱跨網路已達毫秒級。
- 課程展示目前仍以 OBS → RTMP → MediaMTX → HLS 播放為主；HLS 播放器的片段與緩衝會使端到端延遲落在秒級。只有確認觀看端走 WebRTC，才可比較 0.1–0.3 秒目標。
- 排查與啟停流程已整理於 [延遲排查SOP.md](../延遲排查SOP.md)。

### 2026-10-21 延遲約 2 秒的根因定位

- 課程網站目前的正式建置沒有設定 `VITE_WEBRTC=true`，因此 `course/src/main.jsx` 的 `useWebRTC` 為 `false`，播放器走 `hls.js`。
- Azure/課程版 MediaMTX 部署設定 `course/deploy/mediamtx.yml` 使用 `hls: true`、`hlsVariant: lowLatency`、`hlsSegmentDuration: 1s`、`hlsPartDuration: 200ms`；這仍是 HLS，只是低延遲 HLS，不是 WebRTC。
- `hls.js` 雖設定 `liveSyncDuration: 0.8` 與 `liveMaxLatencyDuration: 1.5`，但 HLS 播放器仍要等待 playlist、segment/part、HTTP 代理與瀏覽器播放緩衝，所以實際端到端接近 2 秒是目前架構的預期結果。
- `course/scripts/configure.mjs` 的 `--webrtc` 只產生 loopback 的本機試驗設定；正式部署設定仍將 `webrtc` 關閉。故先前同機 WebRTC 的 0.1–0.3 秒不能代表目前 Azure 公開網站。
- 結論：目前主要問題不是 OBS 編碼速度，而是公開觀看端仍使用 HLS。若要把端到端延遲壓到數百毫秒，必須把 Azure 的觀看鏈路切換成可跨網路的 WebRTC/WHEP，並配置 HTTPS、ICE/UDP 或 TURN，再重新做跨裝置量測。

### 2026-10-21 量測定義補充

- 先前的 0.1–0.3 秒樣本，是 OBS 來源中的毫秒時鐘與瀏覽器播放器畫面截圖讀值之差；測試在同一台 Windows 電腦的 loopback，並非「OBS 實體螢幕」與「另一台裝置網站螢幕」的完整端到端比較。
- 因此該數字不能代表跨裝置、跨網路或實體螢幕到螢幕延遲。正確的總延遲驗證，應讓 OBS 畫面與網站觀看畫面同時顯示可辨識且同步遞增的時間戳，再以另一台裝置／相機記錄兩個畫面，取多次差值。
- 目前約 2 秒的網站延遲仍是使用者實際觀看端較可信的結果；在完成上述同步量測前，不把 0.1–0.3 秒稱為總延遲。

### 2026-10-21 免費示範應援功能

- 已加入每個 Socket 連線 100 點的示範點數錢包，只能送出 1、5、10 點。
- 伺服器驗證金額、餘額與扣點，並廣播本場應援總數；測試涵蓋合法扣點、非法金額與超額拒絕。
- 這是暫存示範功能：點數隨連線建立，重連會重置，不代表可登入帳號，也沒有現金價值、購買、提領或兌換功能。

### 2026-10-21 直播互動 MVP

- 應援事件會廣播應援者暱稱與 1/5/10 點金額，觀看端在影片畫面上顯示短動畫提示。
- 聊天訊息會在影片畫面疊加 6 秒；觀看端使用瀏覽器 `SpeechSynthesis` 朗讀最多 120 個字，並在新訊息到達時取消前一段朗讀。
- 這是瀏覽器端互動效果，不是錄影合成到串流影像；關閉分頁後效果不保留。瀏覽器若封鎖自動語音，仍可看到文字。

### 2026-10-21 有線網路延遲重測結果

- 已重新啟動 Azure VM，網站 `/group9/api/status` 曾回應 HTTP 200，服務可用。
- 本次實測未能開始：本機沒有建立 SSH RTMP 轉送，且沒有 1935 listener；OBS 雖已開啟，`live` 仍為 `false`，因此沒有可比較的 OBS 螢幕與網站播放螢幕畫面。
- 已停止 OBS 並關閉 Azure VM；本次不能把結果解讀成有線網路延遲，也不能宣稱測得 2 秒或其他數字。

### 2026-10-22 WebRTC 限時部署測試

- Azure MediaMTX 已啟用 WebRTC；NSG 新增 TCP 8889 與 UDP 8189 入站規則。
- 部署前網站顯示 HLS，原因是 VM 上的舊版 `server.mjs` 沒有 WHEP 代理路由，且 `/group9/` 資產基底路徑錯誤；已同步目前 repo 的 `server.mjs` 與 `dist`，以 `APP_BASE=/group9/ VITE_WEBRTC=true` 建置。
- 網站已驗證顯示 `WebRTC · 影音直播`、播放器播放中；WHEP 代理 `OPTIONS` 回 HTTP 204，服務正常。
- 本次沒有宣稱完整螢幕到螢幕數值：直播畫面內沒有可讀的同步時鐘，因此只確認 WebRTC 播放成功，未把伺服器端邊緣時間當成總延遲。
- 測試完成後已停止 Azure VM，避免持續產生計算費用；NSG 規則仍保留，VM 下次啟動後可再次測試。

## 2026-10-22 WebRTC 毫秒時鐘端到端實測

- OBS 以 `time.ms/zh-tw/` 毫秒時鐘作為桌面擷取來源，網站以 WebRTC 播放。
- 同步截圖讀值：來源 `11:09:58.901`；網站直播畫面內的時鐘 `11:09:58.344`。
- 估算端到端延遲：`0.557 秒`（約 557 ms；截圖與讀值誤差約數十毫秒）。
- 這是 WebRTC 實測，不是先前 HLS 約 2 秒的結果。
## 2026-10-22 固定雙 OBS、帳號、聊天室管理與 AEC（本分支）

使用者確認兩台固定電腦各用 OBS，並新增「兩台開喇叭、不戴耳機」要求。最新操作規格見 `DUAL_OBS.md`；舊單主播／每連線點數描述由本節取代。

- Node.js 24.18.0：課程版 `npm test` 14/14；原根目錄 demo 6/6。
- 正式 HLS 與 WebRTC 建置均成功；既有 hls.js/Vite 大 bundle 提醒仍存在。
- 雙來源設定經真實 MediaMTX 1.21.2 `--validate-conf` 通過。第一台 `live` 密鑰保留，第二台 `guest_broadcaster` 僅能發到 `guest`，兩路都不允許覆蓋 publisher。
- 三個獨立網站瀏覽器環境及兩個獨立合成 WHIP sender，實際經 MediaMTX 與兩個 WHEP reader，在同一頁收到 H.264/Opus 雙路影音；兩路持續播放，讀回各自 RTP audio bytes / decoded video frames。測試包含停／重開第二路、主持人網頁重新整理不丟場次、註冊登入登出、餘額重開後仍為 90、應援及主播收入帳本、公告／禁言／刪除、390px 無橫向溢出。證據：`evidence/duo-smoke.json`、`evidence/duo-mobile.png`。這不是兩台實體 OBS 或公網驗收。
- SQLite 關閉重開仍保留帳號、salted 密碼驗證、hashed sessions、餘額、場次及兩人身份、交易／收入、訊息刪除、禁言、規則與稽核。測試用觸發器故意令交易寫入失敗，確認扣點也全部回滾；重送不重複扣點，併發不能超額，自送被拒，管理員核帳平衡。
- AEC 直接使用 `samudinzul/aec-client` v1.13.1 / `f76ed632649723003e8778661d565523bdbd5732` 的 DTLN-AEC 引擎、模型及 WASAPI pipeline。Web release SHA-256 `2b17531a7ec5e619f4213b686be0c8fb6d3c54537e666878164d73914875282d` 已核對。Python 3.10.6、numpy 2.2.6、ai-edge-litert 2.3.0、pyaudiowpatch 0.2.12.9、websockets 16.1.1。
- 12 秒合成參考／延遲多路徑回音、近端人聲類訊號與雙講：測得回音能量降低 51.69 dB，正確參考較無參考改善 51.46 dB；近端單獨訊號增益 -0.19 dB，雙講近端相關係數 0.939。這是特定合成 fixture，不能外推實際房間。證據 `evidence/aec-smoke.json`。
- 免驅動本機 bridge 經 WebSocket／AudioWorklet 到真正 OBS Browser Source；已讀回 reroute_audio、關閉本機監聽，並從 OBS 讀到合成 AEC 輸出電平。測試拒絕錯誤私有路徑、失聯靜音與 PCM 溢位；原本 raw mic 靜音避免雙重收音。證據 `evidence/aec-bridge-smoke.json`、`evidence/aec-obs-smoke.json`。
- 本機真實 Realtek 麥克風及實際喇叭 loopback 短測：AEC frame 持續處理並進 OBS，未啟動錄影／推流、未播放校正聲；當時喇叭參考能量為 0，故只證明實際輸入能開啟，不證明聲學消除效果。證據 `evidence/aec-local-capture.json`。
- 收尾已還原 OBS 原始來源與靜音狀態、移除測試 AEC source、停止本次 AEC service；沒有安裝音訊核心驅動、變更 Windows 預設音訊、防毒排除或開機啟動。未啟動／修改 Azure VM。

未完成的實際交付門檻：第二台 Windows 配置、兩台真實 OBS 推流、兩台喇叭開啟的單講／雙講／移動與音量測試、第三觀看端獨立聽音、長時間穩定度與跨網路；本分支也尚未部署 Azure。公開帳號必須先有 HTTPS。尚不能宣稱兩台完全免耳機且零回音，也不能以本機合成數據保證真實延遲。
補充：已對上游 LiteRT 呼叫加上錯誤標記；注入推論故障的測試確認即使上游內部選擇 passthrough，bridge 仍會停止輸出，不將原始麥克風送回直播。重跑 AEC 合成、Browser Source 與還原／停服測試通過。GitHub PR #2 的 Linux 測試、建置、Compose 設定與 Docker image 建置亦通過。

### 2026-10-22 第二台安裝包與首次實際聲學探測

- 新增可重跑的 `scripts/calibrate-aec.py`，沿用上游 WASAPI／DTLN 與本機 OBS bridge 的輸入流程。相關回音計算先以已知延遲／衰減 fixture 自檢，驗證 123-sample 延遲及 20 dB 差值；不保存原始麥克風錄音。
- 執行前讀回 OBS `GetStreamStatus`、`GetRecordStatus` 均為 `outputActive=false`。本機 Realtek 麥克風、Realtek 喇叭及相配 loopback 實際播放／擷取 6 秒，數位播放峰值限制 0.025，未改系統音量。參考 RMS 0.004995、原始麥克風 RMS 0.000239、基準 RMS 0.000126、相關係數 0.2629。回灌相對背景聲不足本工具的驗收門檻，結果 **inconclusive／無法判定**，不報回音消除通過。證據 `evidence/aec-acoustic-local.json`；不推論雙機免耳機已達成。
- 新增第二台 AEC 設定包產生器，白名單 12 個來源檔＋manifest，ZIP 逐檔 SHA-256 讀回核對。套件不含任何既有 `.runtime`、推流密鑰、帳號或資料庫；上游 runtime 於第二台首次安裝時下載並核對固定 SHA-256。
- 將安裝包解到全新中文／空白路徑，使用既有 Python 3.10.6 重新建立獨立 venv、安裝全部依賴，AEC 引擎／注入故障保護／近端及雙講 fixture 與校正自檢全部通過。發現並修正了全新套件不存在 `evidence/` 時無法寫入測試結果的問題。這是同一台電腦的全新安裝測試，**不是第二台實體電腦驗收**。
- 本次音效裝置已在 finally 中關閉，沒有啟動網站推流、修改 OBS 場景、安裝驅動或改變系統音量。第二台的操作方式與兩台是否同房仍等待使用者提供，現階段保留未完成狀態。
## 2026-10-22 帳本歷史與自動更新

- 第二台電腦尚未決定，依使用者指示延後雙機與免耳機回音實機驗收，繼續完成帳號、聊天室管理與應援功能。
- 帳本新增每頁 100 筆的游標分頁，可讀取更早交易；一般帳號僅能查自己的收支，管理員可查全站。累計與核帳仍以完整資料計算。
- 已開啟的帳本收到交易通知會更新；載入中的舊回應不會覆蓋較新的刷新結果。
- Node 測試 15/15 通過，包含超過 100 筆、新交易插入期間翻頁、不重複與不漏舊資料、非法游標及私有帳目權限。HLS 與 WHEP 建置通過。
- 本機 Chrome 操作驗證涵蓋登入登出、點數保存、公告、禁言、刪訊息、主播帳本自動更新及手機版面。媒體來源為合成串流，不代表兩台實體 OBS 或聲學驗收。
- 此分支尚未部署至 Azure 正式站；公開帳號登入仍需要 HTTPS。建置保留既有大型 bundle 警告。

### 2026-10-22 檢舉介面完整流程

Chrome 操作測試新增觀眾輸入檢舉原因、送出後看到成功提示、主播載入檢舉、標記已處理及清空待辦，全流程通過。既有雙路合成影音、帳號、帳本自動更新與管理操作亦通過。前一版 a49e7f7 的 GitHub Actions run 39726121909 已成功。此輪未部署或進行第二台硬體驗收。

### 2026-10-22 使用者本機重跑

依使用者「用我的電腦測試一次」指示，在目前 Windows 電腦執行課程版 npm test（15/15）、WHEP production build，以及本機 Chrome + MediaMTX 全流程。兩路獨立合成 H.264/Opus 皆收到音訊 RTP 與解碼影格；註冊登入登出、持久餘額、應援與帳本自動更新、公告、檢舉與結案、禁言、刪訊息、斷線恢復及 390px 版面通過。最新證據覆存於 evidence/duo-smoke.json 與 duo-mobile.png，測試完成後暫存服務與測試帳號資料庫已清理。

未使用實體攝影機或麥克風、未啟動 OBS 串流、未部署 Azure。此輪不代表雙實體電腦、跨網路或回音消除已通過；Vite 仍有既有大型 bundle 警告。

### 2026-10-22 本機網站無法開啟與 OBS 開播修復

使用者回報臨時網站無法開啟、OBS 無法開播。檢查證實原先動態埠展示服務已停止；OBS 程序有回應，但未推流。恢復既有 `scripts/start.ps1` 的固定本機服務後，MediaMTX 記錄 OBS 認證失敗。將 OBS 既有 RTMP custom 設定與本機忽略檔 `.runtime/OBS-PRIVATE.txt` 的現有憑證對齊，保留密鑰隱私並重新開播成功。

OBS WebSocket 讀回 outputActive=true、輸出位元組持續增加；Chrome 實際顯示 OBS 目前的螢幕與攝影機場景。固定觀看網址為 http://127.0.0.1:4180/ ，第二路未發布時獨立顯示離線。此輪為真實單台 OBS → RTMP → MediaMTX → HLS 本機驗證，不是雙機／公網／AEC 驗收；未開始錄影、未部署 Azure。OBS 與本機網站依使用者指示維持運作。

往後在 course 目錄執行 `powershell -File scripts/start.ps1` 啟動本機服務；服務必須保持執行，不能使用已結束的臨時展示網址。此方式不會自動設定 Windows 開機啟動。OBS 推流使用原本本機私人憑證，勿把另一組 Docker 或臨時測試密鑰混用。

## 2026-10-22 觀眾改為免登入訪客

依使用者最新指示，觀眾進站自動建立訪客身份並取得 100 示範點數，不再要求註冊／輸入帳號密碼。可自行改暱稱、聊天、檢舉、應援及查個人帳本；主播／管理員登入收在可展開的面板，原有角色權限與資料不刪除。

點數與訊息仍由 SQLite 及伺服器驗證，瀏覽器使用 HttpOnly session cookie；重新整理／開同瀏覽器分頁不補發點數。訪客沒有可用密碼，不能以內部識別碼登入。新訪客建立端點具同源、HTTPS／localhost與頻率限制，現有 session 呼叫不補發。Cookie 目前保存 7 天；到期、清除 Cookie、無痕或換瀏覽器會被視為新訪客，無法保證一位真人只領一次。這是無現金價值的示範點數，不接真實金流。

16 項自動測試通過；Chrome 雙路影音測試驗證免登入進站、改暱稱、送點、重新整理後餘額 90／89 不變、主播帳本自動更新及聊天室管理。原生 HLS 與 WHEP 建置通過。已更新本機 4180 網站並確認自動顯示訪客 100 點、可輸入聊天；真實 OBS 的 MediaMTX 程序保持運作。應援仍需主播開啟一場記帳，不會將收入記到未指定的收款者。

## 2026-10-23 各主播 OBS 控制與分級禮物

- 網頁加入本人 OBS 配對／狀態、麥克風開關、鏡頭開關、結束自己的直播（確認後才送出）。控制器在各主播電腦執行，網站不取得 OBS 密碼。配對碼為 192-bit、一次性、5 分鐘到期；每次命令驗證 session、房間身份及 live／guest 路徑，控制器再次檢查 OBS 實際發布路徑。結束自己的推流不會結束另一台。來源狀態在操作後讀回，不符合就回報錯誤。
- 19 項 Node 測試通過，包含雙主播命令隔離、觀眾無權控制、非法資料與重用配對碼拒絕、控制器連線不破壞狀態輪詢，以及來源切換／停止命令。舊 1/5/10 帳本自動升級後原交易 ID 保留，六級禮物皆能扣點與防重送。
- `node scripts/obs-live-smoke.mjs` 實際連接這台 Windows 的 OBS，以短暫關麥／關鏡頭後恢復方式讀回成功；恢復了原來的狀態，推流前後皆維持原狀，未啟動錄影，也沒有真的執行停止直播。結束直播按鈕及 StopStream 路由用模擬控制器驗證，未聲稱雙實體電腦停播驗收。
- 1 點愛心、5 點玫瑰、10 點火箭、25 點跑車、50 點星光派對、100 點夢幻嘉年華。火箭、跑車、城堡與摩天輪為專案原創 SVG/CSS，未使用 TikTok 官方動畫資產。高級禮物具有更豐富光束、粒子與更長播放時間；連續交易加入佇列，聊天不蓋掉禮物。作業系統減少動態效果設定會停用動畫。
- Chrome 完整操作測試涵蓋六級禮物逐一購買、依序顯示及結束，以及配對／關開麥／關開鏡頭／確認結束的網頁操作；後者使用模擬 OBS 控制器，和真實單機來源切換的測試分開記錄。證據 `evidence/duo-smoke.json`、`evidence/gift-carnival.png`。
- 配對操作方式、來源選擇與群組鏡頭限制見 DUAL_OBS.md 最新節。未開放公網 OBS 控制埠、未部署 Azure，第二台實機與聲學 AEC 驗收仍延後。建置保留既有 bundle 大小警告。

## 2026-10-23 Enter 送出與點數語音留言

聊天室按 Enter 直接送出、不插入換行；中文輸入法組字確認時不會誤送，空白及傳送中的重複操作會擋下。一般聊天及普通禮物不再觸發朗讀。

新增獨立語音留言：10 示範點數、最多 120 字，沿用本場應援交易、餘額檢查與請求 ID 去重；成功扣點才廣播朗讀事件。禁言、限制詞與無效內容在扣點前拒絕。留言存入帳本；既有交易新增空白留言欄位，不刪除舊資料。語音沿用瀏覽器 SpeechSynthesis，依序播放，未混入 OBS 音軌；瀏覽器可能需要使用者先操作網頁才能出聲。

20 項 Node 測試通過。Chrome 雙路影音流程驗證 Enter 送出、組字 Enter 不誤送、普通聊天及六級禮物不呼叫語音、點數留言只朗讀一次、同筆事件重送不重播、扣點後重新整理餘額保持 79。語音測試記錄 SpeechSynthesis 呼叫，沒有驗證實體喇叭發聲。證據見 evidence/duo-smoke.json。未進行雙實體電腦、手機跨網路或 Azure 部署驗收。

## 2026-10-23 公開多人直播壓測

- OBS 經 RTMPS 1936 推流，最終設定為 1280×720、30 FPS、CBR 500 Kbps；MediaMTX 以 WebRTC/UDP 8189 提供觀眾畫面。
- Apache 對版本化 `/group9/assets/` 直接提供檔案，啟用一年 immutable cache、gzip 與 HTTP/2；WebRTC、Socket.IO 和 API 繼續反向代理至應用程式。
- 最終持續壓測後的 10 分頁同時加入結果為 10/10 播放成功，p50 19.048 秒、p95 19.061 秒；原始結果在 `evidence/public-10-viewers-2026-10-23.json`。
- 20 分頁測試曾單次達 20/20，但重複結果降至 15/20、14/20；目前只把 10 個同時加入視為已重複驗證的容量。`evidence/public-20-viewers-2026-10-23.json` 保留最後一次結果，不以單次最佳值宣稱穩定容量。
- MediaMTX 的 `webrtcHandshakeTimeout` 從預設 10 秒延長至 30 秒，避免突發加入時過早中止 ICE；壓測後仍有逾時，表示小型 VM／單一測試來源的尖峰容量有限。
- 以上數字是開頁至影片開始播放時間，不是畫面端到端延遲。所有模擬觀眾來自同一台電腦與同一公開 IP；尚未以多支實體手機及不同電信網路驗證。
