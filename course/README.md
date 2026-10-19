# Group 9 — 課程最終實作

依 `Group9_英文講稿_2026-10-19.md` 的七頁內容實作：**OBS → RTMP → MediaMTX → HLS → React / hls.js**；聊天用 **Node.js / Socket.IO**。一間房、一位主播，影音與聊天分流。原本根目錄 WebRTC demo 與 `site/` LiveKit 版本保留。

## 功能與簡報對照

| 簡報承諾 | 實作 |
|---|---|
| OBS 傳送影音 | MediaMTX 單一 `live` 路徑，主播密碼驗證，不允許其他主播覆蓋 |
| 瀏覽器觀看 | React + hls.js；Safari 可用原生 HLS；自動重試、靜音自動播放、音量／全螢幕控制 |
| 即時聊天 | Socket.IO 雙向推播、最近 100 則、斷線重連、訊息長度與頻率限制 |
| 直播／離線狀態 | 每 2 秒讀 MediaMTX API 的 `ready`，服務故障另顯示連線中 |
| 聊天暱稱 | 1–24 字、可更換；文字由 React 顯示，不插入 HTML |
| 愛心動畫 | 廣播按讚數與動畫，每個連線每 0.5 秒最多一次 |
| 觀看人數 | 顯示 Socket.IO 已連線分頁數，含未播放／未設暱稱者；不冒稱獨立人數 |
| Azure VM / SSH | Docker Compose 部署、SSH tunnel 推流／觀看、可選 HTTPS 反向代理 |

## Windows 本機啟動

需求：Node.js 22.18+、PowerShell、OBS。第一次在 `course/` 執行：

```powershell
npm ci
npm test
powershell -File scripts/install-media.ps1
powershell -File scripts/start.ps1
```

開啟 <http://127.0.0.1:4180/>。啟動腳本會建置前端、檢查連接埠、啟動 MediaMTX 與 Node；Ctrl+C 一起停止。若連接埠被占用會停止啟動，不會殺掉既有服務。

OBS 的 **Settings → Stream → Custom**：從本機 `.runtime/OBS-PRIVATE.txt` 讀取 Server 與 Stream key，勿上傳該檔案。輸出設定 H.264、1280×720、30 FPS、CBR 2500 Kbps、keyframe 1 秒、AAC 48 kHz / 128 Kbps。加入畫面與音訊來源，點 Start Streaming。網頁應在約 2 秒內顯示 LIVE，影片需再等待 HLS 緩衝；這不是低延遲 WebRTC。播放預設靜音，手動打開音量。

安裝腳本固定 MediaMTX 1.21.2，並核對官方 SHA-256。生成的 256-bit 主播密碼只寫入忽略的私人檔案，重跑不覆寫。若重新產生密碼，OBS 也須更新。

## Azure Ubuntu VM 部署

使用既有 VM，不建立新的計費資源。先以課程既有 SSH 帳號連線，保留原本 `week5-lab` 等服務。在 VM 安裝官方 Docker Engine / Compose plugin 及 Node.js 22.18+ 後：

```sh
git clone --branch feature/course-final https://github.com/yycc0112299/live_streaming.git
cd live_streaming/course
node scripts/configure.mjs --docker
docker compose -f deploy/compose.yml config --quiet
docker compose -f deploy/compose.yml up -d --build
docker compose -f deploy/compose.yml ps
curl http://127.0.0.1:4180/api/status
```

私有 GitHub 登入沿用既有認證，勿把 access token 寫入 clone URL。若 VM 已有 checkout，先確認 `git status` 再 fetch / 切分支，不重設別人的修改。

Compose 將網頁 4180 與 RTMP 1935 都綁定 VM loopback，MediaMTX API / HLS 不對外發布。先用 **SSH tunnel** 完成安全跨網路展示，不必開 Azure 1935 / 4180 入站：

```powershell
ssh -N -L 4180:127.0.0.1:4180 -L 1935:127.0.0.1:1935 <課程使用者>@<VM公用IP>
```

主播在自己的電腦連上 tunnel，OBS Server 仍為 `rtmp://127.0.0.1:1935`。Stream key 請從 **VM 上** `.runtime/OBS-PRIVATE.txt` 取得；不是本機測試的密碼。觀看者使用自己的已授權 SSH 帳號建立 `-L 4180:127.0.0.1:4180` tunnel，再開 `http://127.0.0.1:4180/`。這條模式的流量由 SSH 加密。

若要讓一般觀眾免 SSH 觀看，將自有網域 DNS 指向 VM，使用 `deploy/Caddyfile` 做 HTTPS 反代（設定 `LIVE_DOMAIN`），開放 80/443，勿暴露 9997/8888。Caddy 在宿主機執行；反代保留 Host、支援 WebSocket。網域／DNS／Azure 入站規則需要現有帳號權限，不會因程式上傳而自動設定。公用版本是公開觀看及訪客聊天，沒有登入／私人直播權限。RTMP 持續使用 SSH tunnel。

更新：在乾淨 checkout 拉取已核對的提交，重跑 `docker compose -f deploy/compose.yml up -d --build`；停止用 `docker compose -f deploy/compose.yml down`。不使用 `down -v`。重啟清除聊天與按讚數，不錄影、不持久保存訊息。

## 驗收

1. 開兩個瀏覽器分頁，各設不同暱稱，雙向傳送文字；嘗試 HTML 字串應顯示為文字。
2. OBS 開播：確認 LIVE、兩邊畫面持續前進、取消靜音後有聲音。
3. 按讚、檢查數字與動畫、分頁開關後連線數變化。
4. OBS 停播：狀態變 OFFLINE，播放器消失；再開播可恢復。
5. 停止 MediaMTX：網頁顯示服務連線中；恢復後重連。停 Node 再啟動後需重新加入暱稱。
6. 換成兩台真實裝置與不同網路，重做影音、聊天與停止測試。不能以本機測試取代 Azure / 實機驗收。

`npm test` 測狀態、故障處理、HLS proxy、跨來源拒絕、暱稱、聊天、限速、兩連線、歷史與按讚；`npm run build` 驗證正式建置。`.github/workflows/course.yml` 在 GitHub 上自動執行。真實 RTMP 影音驗收可用 `scripts/media-smoke.mjs`，需本機 MediaMTX 及 FFmpeg。

## 限制與操作資料

聊天室是單一 Node process 的記憶體狀態，最多 100 個連線；水平擴充才需共享儲存。暱稱是訪客自選，不是身分認證。每連線限速是課堂展示保護，不是大型公開平台的反濫用系統。不增加簡報未要求的帳號、金流、錄影或 FPGA 整合。部署與實機通過狀態請見 `VERIFICATION.md`。

官方參考：[OBS 推流](https://mediamtx.org/docs/publish/obs-studio)、[MediaMTX 設定](https://mediamtx.org/docs/references/configuration-file)、[Control API](https://mediamtx.org/docs/features/control-api)。
