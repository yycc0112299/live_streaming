# 手機與電腦跨網路觀看：部署準備（2026-10-23）

## 目前已確認

- 本機 http://127.0.0.1:4180/ 正在接收第一台真實 OBS；127.0.0.1 只代表各裝置自己，不能交給手機當觀看網址。
- 既有 Azure VM B11302133 正在運作；http://20.89.110.14/group9/api/status 回應 200，但仍是舊版、尚無推流。
- VM 的 group9-web、group9-media、Apache 皆 active；目前只公開 HTTP 80，443 沒有監聽，也沒有 HTTPS 入站規則。1935／4180／8888／9997 僅監聽 loopback。
- 已有 SSH 22 入站規則，但這次沒有沿用中的本機 SSH 私鑰；先前的臨時 SSH 金鑰已清理。
- 原本試圖建立臨時公開轉送入口的命令被自動核准機制拒絕，僅回覆 blocked by policy；未繞過，也不能把它記為成功。

## 已準備的交付物

- 來源 commit：844aabde6dfe2627a4a47d9a28f9b90757b1b3c3。
- 來源封裝：course/.runtime/public-deploy/course-844aabd.tar.gz，632483 bytes，SHA-256 D1F50AA422506C622EF82814A90004BC1600AAE15768A5703FC108A8FB6A9A20。
- 81 個封裝項目，已檢查不含 .runtime、實際 .env、SQLite、SSH 私鑰等私人資料。封裝不提交 Git。
- HLS 播放作為手機觀看路徑，維持 H.264/AAC，不要求手機與 OBS 在同一區網。

## 待核准的具體部署變更

1. 使用既有 Azure VM，不建立新 VM。設定 Azure DNS 名稱，再申請免費 HTTPS 憑證；保留現有根目錄課程網站。
2. 網頁沿用 /group9/，新增 TCP 443 HTTPS 觀看入口；新版 PUBLIC_ORIGIN 指向實際 HTTPS 網域，保留 session cookie 與同源檢查。
3. OBS 使用 RTMPS 加密推流到 TCP 1936，該入站規則只允許主播目前的公開來源 IP；不公開 MediaMTX API、HLS 上游或 Node 管理埠。第二台的來源 IP 確認後再加入。
4. 配置一次性、限來源及短期有效的 SSH 部署金鑰，上傳已檢查封裝、備份既有 release／私人設定／資料庫後部署；完成後移除該部署金鑰。
5. 更新 OBS 目的地，實際確認 Azure 收到串流；從公開 HTTPS 網址驗證網站、100 點訪客、Socket.IO、播放清單與影片解碼，再交付手機觀看連結。

上述新增存取與連接埠尚未套用，依瀏覽器操作安全規則等待使用者確認。不能以 VM Running、HTTP 200 或本機成功取代公網影音驗收；最後仍需使用者手機行動網路實測。
