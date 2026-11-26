# Final Report Presentation 規劃（Group 9）

助教公告（2026-11-26）：期末報告 11/30、12/7 兩週隨機抽組，每組約 10 分鐘，**英文**簡報（EMI）。投影片在 **11/29（日）23:59 前**上傳 Moodle，每組一個檔，檔名 `Group 9`。佔總成績 20%。

## 規定的六個主題與本專案可用內容

| 規定主題 | 可放的內容（都有 repo 證據） | 對應講義 |
|---|---|---|
| 1. System Architecture | 影音線：OBS →(RTMPS 1936)→ MediaMTX → HLS/WHEP → React + hls.js。手機線：瀏覽器 →(WebRTC WHIP，經 Node 驗證)→ MediaMTX。聊天線：React ⇄ Socket.IO ⇄ Node.js ⇄ SQLite。全部跑在 Azure VM，前面由 Apache 提供 HTTPS 並反向代理。 | W03 Azure VM、W10 RTMP/HLS、W09 Socket（TCP 聊天／UDP 影音）、W06 API + DB、W05 HTML/CSS/JS |
| 2. Results and Analysis | 兩路同時 LIVE（第一路 OBS、第二路 OBS 或手機）。網站延遲約 2 秒（HLS，見 `延遲排查SOP.md`）。10 個觀看分頁同時加入 10/10 成功。NVENC 對 x264 的跳格比較（19% → 0%）。WHIP 授權測試、31 項自動測試。 | W10「Typical latency 3–5 s」可和實測比較 |
| 3. Work Distribution | 王昱程：前端與 OBS。曹少懷：後端、Azure、MediaMTX、Node（第一次簡報的分工）。實際貢獻依 git log 補上。 | 第一次簡報 slide 5 |
| 4. What You Learned | RTMP chunk／port 1935 與 RTMPS、HLS 分段、TCP 與 UDP 的選擇（聊天用 TCP、WebRTC 用 UDP）、REST API 與 SQLite 交易（應援點數不重複扣款）、Azure NSG 白名單、用 AI agent 開發要附證據除錯。 | W09 exit question、W10 Bonus「what is real, what is simulated」 |
| 5. Problems Encountered | 換網路後 IP 變了，RTMPS 白名單擋住推流；VM 關機要自己恢復服務；喇叭回音（AEC）；HLS 延遲；Apache 靜態檔路徑導致新版網頁空白；x264 跳格；串流金鑰誤提交到 GitHub，需要輪替。 | `TROUBLESHOOTING.md`、`docs/AZURE_VM_SHUTDOWN_RECOVERY.md` |
| 6. Final Platform Screenshot | 公開網址兩格 LIVE、聊天室、禮物動畫、手機直播面板。**截圖前先清掉聊天室裡不當的公告、訊息和暱稱。** | — |

## 注意

- 只寫有證據的結果，例如「實體手機跨電信網路」若還沒測，就寫成待驗證，不要寫成已完成。
- 簡報與口頭報告都用英文；10 分鐘大約 8–10 頁。
- 投影片不放任何金鑰、密碼、IP 白名單細節或私人檔案內容。
