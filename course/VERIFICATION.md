# 驗證紀錄 — 2026-10-19

依本機 `Group9_英文講稿_2026-10-19.md` 的最終七頁講稿核對，並讀回 GitHub 功能分支。實作範圍是單房 OBS/RTMP/MediaMTX/HLS、React/hls.js、Socket.IO、暱稱、狀態，以及簡報列為選做的按讚與人數。

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
