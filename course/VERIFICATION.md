# 驗證紀錄 — 2026-10-19

依本機 `Group9_英文講稿_2026-10-19.md` 的最終七頁講稿核對，並讀回 GitHub 功能分支。實作範圍是單房 OBS/RTMP/MediaMTX/HLS、React/hls.js、Socket.IO、暱稱、狀態，以及簡報列為選做的按讚與人數。

## 已通過

- Windows Node.js 24.18.0：課程版 `npm test` 5/5；原本根目錄 demo 6/6。
- 課程版 `npm run build` 成功；hls.js 的 bundle 大小會產生 Vite 提醒，不影響建置。
- `npm audit`：正式與開發依賴都回報 0 vulnerabilities（查核當下）。
- 官方 MediaMTX 1.21.2 Windows binary，官方 SHA-256 比對一致，私人設定檔通過 `--validate-conf`。
- 實際合成 1280×720 / 30 FPS H.264 + 48kHz AAC → RTMP → MediaMTX → HLS → 兩個獨立 FFmpeg 影音解碼器；各解碼 90 影格。
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
- 外部 FFmpeg 經公開 `/group9/hls/live/index.m3u8` 解碼影音，成功結束，輸出 60 影格，見 `evidence/azure-external-decode.txt`。這是傳輸／解碼驗證，不是延遲、穩定 FPS 或容量壓測。
- GitHub Actions 第一筆執行 [39206426173](https://github.com/yycc0112299/live_streaming/actions/runs/39206426173) 成功，包含 Linux 測試、正式建置、Compose 設定檢查與 Docker image 建置。Docker 是可攜備選模式，VM 本次實際使用原生 systemd。
- Windows `powershell -File scripts/start.ps1` 亦已實際啟動成功，健康端點可用。

## 尚未通過／操作限制

- 真實 OBS 畫面／麥克風、兩台真實裝置在不同網路觀看與聽音尚未通過；合成訊號不替代這些驗收。
- 示範彩條只在驗收期間推流，結束後網站應回到 OFFLINE；不是全天候自動播放影片。
- 主播 RTMP 1935、MediaMTX API 9997、內部 HLS 8888 保持 loopback，OBS 使用 SSH tunnel。現有 SSH 私鑰／密碼不在此工作環境中，因此未冒稱已從這台電腦完成 SSH 主播推流。
- VM 為 Running 才提供服務並產生運算費用；deallocate 後網站離線，systemd 服務會在下次開機恢復。
- 不包含簡報未承諾的帳號、錄影、金流、FPGA 或雙鏡頭辨識整合。
