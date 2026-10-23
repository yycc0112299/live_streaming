# 手機與電腦跨網路觀看：部署準備（2026-10-23）

第二位主播的逐步操作及管理者交付檢查見 **[SECOND_PC.md](SECOND_PC.md)**。下方「目前已確認／待核准」是早期部署準備紀錄；後續已套用的 HTTPS／RTMPS 設定及最新狀態優先，不要將舊的「只有 HTTP」描述當成現況。

## 2026-10-23 合併後狀態

PR #2 已合併至 main，但公開 HTTPS 網站仍顯示舊版單主播介面。這次 Azure Run Command 載入失敗、Portal 重載逾時，原臨時 SSH key 也未獲授權，故未部署新版。本機 `http://127.0.0.1:4180/` 已以真實單台 OBS 演練新版聊天、禮物與帳本，這個網址不能供手機或校外裝置觀看。詳細結果及限制以 `VERIFICATION.md` 的「合併 main 與真實單台 OBS 網站演練」為準。

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
5. 更新 OBS 目的地，實際確認 Azure 收到串流；從公開 HTTPS 網址驗證網站、測試版 1000 點訪客、Socket.IO、播放清單與影片解碼，再交付手機觀看連結。

## 2026-10-23 已套用的公網設定

- Azure DNS：`group9liveb11302133.japaneast.cloudapp.azure.com`，解析至既有 VM `20.89.110.14`。
- NSG 新增 TCP 443 `HTTPS_443`，以及 TCP 1936 `RTMPS_1936_HOST_IP`，來源限制為部署當下主播來源 `101.14.11.195/32`。第二台主播換網路後，需新增其公開來源 CIDR。
- Let's Encrypt 憑證已由 Certbot 申請並交給 Apache，公開 HTTPS `/group9/` 回應 200；憑證到期日為 2027-01-20，已啟用自動續期。
- MediaMTX 已備份設定後改用 TLS strict、監聽 `*:1936`；原本 `127.0.0.1:1935` 不再監聽。公開 API、HLS 上游及 Node 管理埠仍未公開。
- 使用 Azure VM Run Command 完成部署，未建立 SSH 金鑰，因而沒有短期私鑰需要清除。
- 本機驗證：HTTPS 443 與 RTMPS 1936 TCP 可連線，`https://group9liveb11302133.japaneast.cloudapp.azure.com/group9/api/status` 回應 200。尚未用手機行動網路實際播放，也尚未用 OBS 以 RTMPS 1936 推流驗收。
