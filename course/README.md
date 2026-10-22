# Group 9 — 課程最終實作

## 2026-10-22 雙 OBS／帳號／管理／應援更新

目前版本改為固定兩台 OBS，各自發布 `live`、`guest`，同一網頁同時觀看兩人。新增 SQLite 註冊／登入、每帳號首次點數、應援帳本與防重送、公告／刪訊息／禁言／檢舉／慢速模式及管理稽核。免耳機路徑重用開源 AEC Client，透過本機 WASAPI 與 OBS Browser Source，不安裝虛擬音訊驅動。完整啟動、權限、備份與限制見 **[DUAL_OBS.md](DUAL_OBS.md)**。

此更新尚未部署到 Azure；兩台實體 OBS、喇叭同開及獨立聽音仍待驗收。下方單主播／暱稱暫存描述為原始版本紀錄，帳號與雙來源配置以新指南為準。

已部署的課程展示入口：[Cloud Live](http://20.89.110.14/group9/)。測試彩條結束後會顯示 OFFLINE，需由 OBS 開播才有影音。實際驗證範圍見 [VERIFICATION.md](VERIFICATION.md)。

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

### WebRTC 低延遲對照（2026-10-21）

已接入 [MediaMTX v1.21.2 官方 WHEP reader](https://github.com/bluenviron/mediamtx/blob/v1.21.2/internal/servers/webrtc/reader.js)，原始碼與 MIT 授權保留於 `src/vendor/`。不重寫協定。停止既有本機直播服務後，可用：

```powershell
powershell -File scripts/start.ps1 -WebRTC
```

這會產生獨立的 `.runtime/mediamtx.webrtc.yml`，保留原 HLS 私人設定與主播驗證，WebRTC HTTP 8889 與 UDP 8189 只綁定 loopback。OBS 依[官方 WHIP 方法](https://mediamtx.org/docs/publish/obs-studio)選 Service `WHIP`、Server `http://127.0.0.1:8889/live/whip`；Bearer Token 使用 `broadcaster:` 加上原本私人設定的主播密碼，勿放進網頁或 Git。OBS WHIP 使用 H.264（無 B-frame）與 Opus。啟動後開 `http://127.0.0.1:4180/`，標籤應顯示 WebRTC。

不加 `-WebRTC` 則建置原 HLS 播放器，OBS 也須切回原本 RTMP/AAC 設定。建置時 `VITE_WEBRTC=true` 才會啟用 WebRTC；Node 的 `MEDIAMTX_WEBRTC_URL` 預設為 `http://127.0.0.1:8889`。伺服器只代理單一直播路徑的觀眾 WHEP，不公開 WHIP 發布端點。此模式尚未完成 Azure／不同網路驗收，不能直接用 loopback 設定部署公網；官方跨網路設定見 [WebRTC connectivity](https://mediamtx.org/docs/features/webrtc-specific-features)。

需求：Node.js 22.18+、PowerShell、OBS。第一次在 `course/` 執行：

```powershell
npm ci
npm test
powershell -File scripts/install-media.ps1
powershell -File scripts/start.ps1
```

開啟 <http://127.0.0.1:4180/>。啟動腳本會建置前端、檢查連接埠、啟動 MediaMTX 與 Node；Ctrl+C 一起停止。若連接埠被占用會停止啟動，不會殺掉既有服務。

OBS 的 **Settings → Stream → Custom**：從本機 `.runtime/OBS-PRIVATE.txt` 讀取 Server 與 Stream key，勿上傳該檔案。輸出設定 H.264、1280×720、60 FPS、CBR 700 Kbps、keyframe 1 秒、AAC 48 kHz / 128 Kbps。加入畫面與音訊來源，點 Start Streaming。700 Kbps 是本次從校外網路推送 Azure VM，連續 1 分 55 秒仍零壅塞、零跳幀的實測值；若換網路再依畫質逐步提高。網頁應在約 2 秒內顯示 LIVE，影片需再等待 HLS 緩衝；這不是低延遲 WebRTC。播放預設靜音，手動打開音量。

安裝腳本固定 MediaMTX 1.21.2，並核對官方 SHA-256。生成的 256-bit 主播密碼只寫入忽略的私人檔案，重跑不覆寫。若重新產生密碼，OBS 也須更新。

## Azure Ubuntu VM 部署

### 本次已使用的原生服務模式

既有 VM 是 ARM64 Ubuntu 24.04，已有 Apache 與其他課程服務。因此本次實際部署採用原生 Node / MediaMTX + systemd，沒有替換原本網站，也沒有安裝 Docker。服務名稱為 `group9-web`、`group9-media`；執行目錄為 `/opt/group9-live/releases/course-final-20261019/course`；私人設定存於 `/opt/group9-live/shared/`。Node 與 MediaMTX 均固定版本、核對官方 SHA-256，應用以無登入權限的 `group9-live` 系統帳號執行。

原生安裝器是 `deploy/install-native.sh`。將非秘密的課程來源放到 `/opt/group9-live/releases/<commit>/course`，以 root 執行該腳本即可安裝／測試／建置並設定自動啟動；它不改 VM 的全域 Node 版本。舊版與新版 release 可並存，私人設定保留。若要保留 Apache 的根目錄網站，使用 `APP_BASE=/group9/ npm run build`，並啟用 `deploy/apache-group9.conf`。開啟此路徑前先執行 `apache2ctl configtest`，再 reload；不要覆寫既有站台設定。

目前觀看入口與即時驗收結果見 `VERIFICATION.md`。Apache 子路徑模式只公開課程網頁、HLS 與聊天室，MediaMTX 控制 API 與 RTMP 仍只接受 loopback；主播繼續走 SSH tunnel。原生模式的直播密碼位於 VM `/opt/group9-live/shared/OBS-PRIVATE.txt`，僅限管理者與服務帳號讀取，不放入網頁、GitHub 或講稿。

Azure VM 關機延誤的檢討與下次排查順序見 [關機復原步驟](../docs/AZURE_VM_SHUTDOWN_RECOVERY.md)。

```sh
sudo systemctl status group9-web group9-media
sudo journalctl -u group9-web -u group9-media --since '10 minutes ago'
sudo systemctl restart group9-web group9-media
```

HTTP 展示入口沒有 TLS 加密，只適合公開的課程演示內容；私人影音／敏感聊天應先配置自有網域與 HTTPS，或使用下面的 SSH tunnel。Apache 同時代理 HTTP 與 Socket.IO WebSocket 的設定依[官方說明](https://httpd.apache.org/docs/2.4/mod/mod_proxy.html#protoupgrade)。

### 可攜 Docker 模式（備選）

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
