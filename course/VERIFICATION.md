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

## 正在驗證／仍需實機

- Azure 既有 `B11302133` VM 第一次啟動回報通用錯誤；重新載入並重試後已顯示 Running。部署驗證繼續進行，不能把 Running 當作服務部署成功。
- Azure Docker 執行與 GitHub Actions 的最新結果以後續更新為準。
- 真實 OBS 畫面／麥克風、兩台真實裝置在不同網路觀看與聽音尚未通過；合成訊號不替代這些驗收。
- 不包含簡報未承諾的帳號、錄影、金流、FPGA 或雙鏡頭辨識整合。
