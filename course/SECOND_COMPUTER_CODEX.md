# 第二位主播：給 Codex 的每次開播指令

第一位主播是 VM 操作者，負責開啟 Azure VM 並確認網站、串流服務及網路白名單已就緒。第二位主播不負責 VM 或 Azure 設定；只在第一位通知網站可用後，登入公開網站加入 guest，再用自己的 OBS 開播。完整流程請先讀 [`DUAL_LIVE_RUNBOOK.md`](DUAL_LIVE_RUNBOOK.md)。

在第二位主播的電腦開啟 Codex，貼上：

> 請讀取 `course/DUAL_LIVE_RUNBOOK.md`、`course/TROUBLESHOOTING.md` 與 `course/SECOND_COMPUTER_CODEX.md`。我是 Group 9 第二位主播；第一位主播已負責開啟並準備 VM、公開網站、串流服務和我的 TCP 1936 網路白名單。不要登入 Azure，不要修改 VM、NSG、防火牆、NGINX、Docker 或任何串流設定。請只協助我登入公開 Group 9 網站、以自己的帳號按「以第二位主播加入」，並使用我電腦既有的 guest OBS profile 開播或確認已自動開播。絕不可使用第一位的 live 路徑或停止第一位直播。只回報我的 OBS 串流狀態、位元組是否增加、是否重連，以及網站第二格是否 LIVE；不要輸出任何秘密。

## 一次性本機設定（尚未完成時才做）

首次設定由第一位主播及第二位主播協作完成。第一位負責 VM、服務與 Azure 網路準備；第二位只在自己的電腦設定 OBS guest profile、攝影機、麥克風及 WebSocket，並完成網站帳號配對／固定電腦自動加入。設定完成後，不要每次重做。若本機設定已完成，直接跳到「每次開播」。

## 第二位主播需要的入口與本機項目

- 公開網址：`https://group9liveb11302133.japaneast.cloudapp.azure.com/group9/`
- 自己的第二主播帳號。
- 專案已保存的 `course/.runtime/OBS-GUEST-PRIVATE.txt`。
- 第二位電腦已保存自己的 guest OBS profile；此私人設定不得複製或分享給第一位。
- 第二位所在網路的公開 IP 必須已由第一位主播加入 Azure TCP 1936 `/32` 白名單。缺少時告知第一位處理，第二位不要登入 Azure 或自行新增規則。

網站上的「以第二位主播加入」用來登入並占用第二格；實際影音仍由第二位自己的 OBS 傳送。若已完成固定電腦自動開播，Windows 登入後 OBS 可能已自動開始 guest 串流；若未自動開播，第二位在自己的 OBS 按「開始串流」。第一位不必每次操作，但負責本次 VM 與服務的啟動、確認及收播。

## 每次開播：第二位主播只做這些

1. 等第一位主播通知 VM 已啟動、公開網站可用。
2. 開啟公開 Group 9 網站，以自己的第二主播帳號登入，按「以第二位主播加入」。
3. 確認自己的 OBS 使用 `guest` profile；若尚未自動開始，按 OBS 的「開始串流」。不要使用 `live`，也不要重複啟動已在推流的 OBS。
4. 確認 OBS 顯示正在串流且傳送位元組增加，網站第二格顯示 `LIVE`。若連線逾時或位元組不增加，停止反覆嘗試並把錯誤告知第一位主播處理 VM／服務／白名單。
