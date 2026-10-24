# 第二台電腦：給 Codex 的固定加入指令

第二台電腦可在**不同 Wi-Fi、不同住所或不同網路**使用；它只需要能連到 Azure 公開網站與 Azure TCP 1936。完整標準請先讀 [`AUTO_BROADCAST_FLOW.md`](AUTO_BROADCAST_FLOW.md)。

在第二台電腦開啟 Codex，貼上：

> 請讀取 `course/AUTO_BROADCAST_FLOW.md` 與 `course/SECOND_COMPUTER_CODEX.md`。我是第二位主播，網路可能和第一位主播不同。請完成第一次固定電腦加入：確認 Azure TCP 1936 可從我目前網路連線、使用 `guest` 推流身分設定 OBS、啟用 4455 WebSocket、由網站建立固定電腦自動加入；直接使用專案已保存的設定檔，但不得在終端或回覆中輸出其內容。完成後讀回網站第二格為 LIVE。

## 第二台首次設定的必要資料

- 公開網址：`https://group9liveb11302133.japaneast.cloudapp.azure.com/group9/`
- 自己的第二主播帳號。
- 專案已保存的 `course/.runtime/OBS-GUEST-PRIVATE.txt`。
- 若不同網路，該網路的公開 IP 必須已在 Azure TCP 1936 白名單。

第一次由第一位主播在網站按一次同意。完成後，後續每次只要第二台登入 Windows，Startup 捷徑會自動開啟 OBS 並加入第二路直播；第一位不必再次操作。

