# 專案問題與進度同步規則

Repository：`yycc0112299/live_streaming`

## 規則

之後在本專案中討論的專案相關問題，都要同步更新到這個 GitHub repository。同步範圍包括：

- 問題描述與目前狀態
- 排查流程、原因判定與解法
- 架構、設定與部署決策
- 測試結果、量測數據與限制
- 使用者確認過的需求與後續待辦
- 失敗嘗試、回復動作與安全注意事項

一般閒聊、與本專案無關的問題、密碼、私鑰、token、SSH 金鑰和其他秘密資料不寫入 repository。

## 更新方式

1. 完成一個專案相關處理後，更新適合的 README、`course/VERIFICATION.md`、SOP 或其他專案文件。
2. 若內容跨多次討論，追加日期與明確標題，不覆寫既有驗證紀錄。
3. 提交前檢查是否含有秘密資料，以及數據是否標示量測範圍和限制。
4. 提交並推送到 `yycc0112299/live_streaming`；需要審查的變更使用功能分支和 Pull Request。
5. 回報時提供遠端 commit，只有遠端讀回成功才算同步完成。

## 目前同步基準

- 正式 repository：`https://github.com/yycc0112299/live_streaming`
- 目前同步分支：`main`。雙 OBS、帳號、聊天室管理、應援與 AEC 的 PR #2 已於 2026-10-23 合併，合併提交 `d031b6d`；實機／部署驗收範圍見 `course/VERIFICATION.md` 最新節。
- 先前同步基準：`a246223`；本次遠端 commit 以 Pull Request／Git log 為準。

## 專案邊界

- `電子工程總整課程`／`yycc0112299/live_streaming`：只放課程直播平台，包括 OBS、RTMP、MediaMTX、HLS、WebRTC、聊天室、應援與直播部署。
- `專題`／`yycc0112299/-`：只放人物辨識、雙鏡頭、YOLOX、ModelSim、FPGA 與相關影像處理。
- 兩個 repository 不互相複製功能、文件或測試；若需求同時涉及兩者，分別在各自 repository 記錄。
