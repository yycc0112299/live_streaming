# Azure VM 關機延誤檢討與復原步驟（2026-10-20）

適用於課程 VM `Capstone / B11302133`，以及「必須透過使用者指定的 Chrome 操作 Azure Portal」的情況。這份紀錄描述當天實際發生的事；每次執行仍須重新查詢 Azure 的即時狀態。

## 結果與耗時

最終在 **@Chrome** 的 Azure Portal 按下 **Stop → Yes**，並讀回 **`Stopped (deallocated)`**。Codex 的五分鐘重試排程 `azure-vm-3` 隨即暫停；一次性的 Windows 重啟排程在成功執行後已移除。

| 時間（臺灣時間） | 已核實事件 |
| --- | --- |
| 約 14:34 | 課程網站仍回應 HTTP 200；這只能說網站可連，不足以證明 VM 的 Azure 狀態。 |
| 14:43:55 | Windows 排程開始關閉 Codex 原程序 PID 42788。 |
| 14:44:30 | Codex 以新 PID 67824 重新開啟；排程結果為 0。 |
| 約 14:45 | Codex 的瀏覽器清單還沒有 Chrome。透過官方 Computer Use 啟動 Chrome 後，原生 UI 控制因無法可靠判定瀏覽器網址而停止該回合。 |
| 約 14:50 | Codex 瀏覽器清單出現 Chrome 擴充連線；Azure Portal 已登入，`Capstone / B11302133` 顯示 `Running`。 |
| 約 14:51 | 確認 Stop 對話框，約 30 秒後概覽頁顯示 `Stopped (deallocated)`。 |

從第一次嘗試到完成拖了很久，**停機操作本身不是主要耗時**。時間主要花在瀏覽器工具故障、重啟與等待 Chrome 擴充連線，以及每五分鐘一次的接續排程。排程的五分鐘間隔是本次選擇，並非 Azure 必須等待的時間。

## 問題在哪裡

1. **最初的控制工具未啟動。** `cua_repl`／Computer Use 曾在執行任何 UI 指令前回報 `failed to write kernel assets: 系統找不到指定的路徑 (os error 3)`。重新初始化仍失敗。重啟 Codex 後工具可用，但沒有證據能判定是單一檔案、Chrome 擴充或哪個 Codex 元件壞掉；不能把「重啟有效」寫成已找出根因。
2. **沒有可用的非瀏覽器 Azure 身分驗證。** 當時沒有已登入的 Azure CLI／PowerShell 設定或可用的 SSH 憑證。檢查一次可排除替代路徑，反覆嘗試不會讓憑證出現。網站離線、OBS 停止和 VM 停止是不同層級，不能互相替代。
3. **重啟後未立即連上指定的 Chrome。** 當下 `cua.getState()` 只列出內建瀏覽器，Chrome 程序也未運行。啟動 Chrome 後，擴充連線稍後才出現在清單中。這段期間改試原生 UI 控制，卻碰到瀏覽器網址無法驗證的安全停止，造成多一次回合延誤。下次應先在指定的 Chrome 連線上完成操作；工具明確停止時不能繞過限制。
4. **接續排程降低了即時性。** 為了在 Codex 自行關閉、重開後接續，建立了五分鐘 heartbeat。它保證後續會再嘗試，但也使 Chrome 可用後的下一次操作最多延後一個排程週期。

## 下次照這個順序做

1. **先確認目標與授權。** 核對資源群組、VM 名稱，以及使用者是否要求關機。若指定 @Chrome，就只在 Chrome 開 Azure Portal。不要拿本機網站、OBS、HTTP 回應推斷 VM 狀態。
2. **先查 Azure 即時狀態。** 在 Chrome 的 `https://portal.azure.com/` 登入既有帳號（可用已授權的自動填入，不讀取或保存密碼），開啟目標 VM 的 **Overview → Essentials → Status**。若已是 `Stopped (deallocated)`，到此停止；若是 `Running`，才執行 Stop。
3. **瀏覽器連不上時先做一次分層診斷。** 查看 `cua.getState()` 是否列出 `name: Chrome, type: extension`；若 Chrome 未運行，使用受支援的 Computer Use 啟動官方 Chrome，再重新查看清單。Chrome 已開但擴充未出現時，給它一次有限時間重新連接；不要改用內建瀏覽器。若工具報明確安全停止，遵守停止訊息，在下一回合改從已連線的 Chrome 繼續。
4. **若在 UI 指令前反覆遇到相同的 `kernel assets` 錯誤，才重啟 Codex。** 使用者已授權重啟時，先建立並讀回一次性的 Windows 重啟排程；如任務需要在重啟後自動續做，再建立指向目前對話的 Codex heartbeat。兩者確認有效後才關閉 Codex。重開後核對舊／新 PID 與排程結果，再回到第 3 步。不要手動更改 Chrome 安全設定或擴充的 native-host 設定。
5. **只在 Azure 頁面顯示 `Running` 時按 Stop。** 讀清確認框是否寫明 deallocation，按 **Yes**。通知顯示 `Stopping virtual machine` 只代表請求已送出；等待概覽頁 **Status** 變成 **`Stopped (deallocated)`** 才報告完成。必要時按頁面 **Refresh**，不要重複送 Stop。
6. **做收尾。** 保存可見狀態畫面，暫停臨時 heartbeat，移除已完成的一次性 Windows 重啟排程，並清楚告知使用者結果。若仍無法登入或控制，說明精確阻礙與最後查到的 VM 狀態，避免無限重試或聲稱已關機。

## 本次應改進的做法

- 一開始就先核對 **Chrome 擴充連線與 Azure 概覽頁**，能更早發現真正的阻礙。CLI／SSH 沒有現成登入時，檢查一次便結束該路線。
- 重啟是針對重複的工具初始化錯誤，不是例行第一步。重啟後先查指定 Chrome 是否出現在瀏覽器清單，再動作；不要在 Chrome 尚未連線時切到其他 UI 控制路線。
- 每一步只報告其實證明的事：`Stop` 已送出、`Stopping`、`Stopped (deallocated)` 是三個不同狀態。看到最後一個狀態後立即停用重試排程。

**界線：** `Stopped (deallocated)` 代表 VM 運算資源解除配置；儲存空間與部分網路資源仍可能計費。下一次開機後課程服務可能隨 systemd 自動啟動，所以再次操作前必須重新讀取 Azure 狀態。
