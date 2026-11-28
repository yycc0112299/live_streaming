# Group 9 — English talk script (final report)

總長約 9:49：講話 6:10 + 影片 3:39。講者：Yu-Cheng = 王昱程，Shao-Huai = 曹少懷。
每頁的英文就是簡報的講者備註（PowerPoint 簡報者檢視看得到）。語速約每分鐘 130 字；慢慢講、句子短，比背得一字不差重要。

| # | 投影片 | 講者 | 開始 | 長度 |
|---|---|---|---|---|
| 1 | Title | Yu-Cheng | 0:00 | 30 s |
| 2 | System architecture | Shao-Huai | 0:30 | 55 s |
| 3 | Everything the platform does | Yu-Cheng | 1:25 | 35 s |
| 4 | Results and analysis | Shao-Huai | 2:00 | 45 s |
| 5 | Final platform screenshot | Yu-Cheng | 2:45 | 30 s |
| 6 | Demo video | Yu-Cheng | 3:15 | 10 s + 影片 3:39 |
| 7 | More features not shown in the video | Yu-Cheng | 7:04 | 35 s |
| 8 | Work distribution | Shao-Huai | 7:39 | 25 s |
| 9 | What we learned | Shao-Huai | 8:04 | 40 s |
| 10 | Problems encountered | Shao-Huai | 8:44 | 40 s |
| 11 | Thank you | Yu-Cheng | 9:24 | 25 s |

---

## 1. Title — Yu-Cheng（約 30 秒，76 字）

> 重點：開場：自我介紹、一句話說明專案、預告六個主題。

Good morning, everyone. We are Group 9. I'm Wang Yu-Cheng, and this is my partner Tsao Shao-Huai. Our project is a cloud-based live streaming platform. Broadcasters can go live from OBS or straight from a phone browser, an Azure virtual machine relays the video, and viewers watch and chat on one web page. Today we will cover our architecture, our results, a demo, how we split the work, what we learned, and the problems we solved.

## 2. System architecture — Shao-Huai（約 55 秒，124 字）

> 重點：架構：一台 Azure VM；OBS 走 RTMPS (TCP)、手機走 WebRTC (UDP)；MediaMTX 轉 HLS；Node.js 管網站與聊天；聊天用 TCP、影像用 UDP 的原因。

Thank you. Here is our system architecture. Everything runs on one Azure VM in Japan East. Video comes in on the left. The two PCs use OBS and push RTMPS over TCP port 1936, and only the broadcasters' IP addresses are allowed in. The phone needs no app: its browser sends the camera with WebRTC over UDP. Inside the VM, MediaMTX receives both streams and turns them into low-latency HLS. Node.js and Socket.IO run the website, the API and the chat, Apache adds HTTPS, and SQLite stores accounts, chat and the gift ledger. In short: chat uses TCP because every message must arrive, the phone uses UDP because speed matters more for live video, and viewers use HLS so any browser can play it.

## 3. Everything the platform does — Yu-Cheng（約 35 秒，73 字）

> 重點：功能總覽：觀眾、主播、管理員三欄，大部分會在影片看到。

This slide lists everything the platform does. Viewers can watch two broadcasters side by side, join with a QR code, chat, send 3D gifts, climb the supporters board, send AI voice messages, and read live captions. Broadcasters can use OBS, or just a browser, including a phone, which was the teacher's requirement. Admins get chat moderation, a stream health panel and session statistics. You will see most of these in our demo video.

## 4. Results and analysis — Shao-Huai（約 45 秒，101 字）

> 重點：成果：兩路同時直播、延遲約 2–3 秒、10 人同時加入、44 個測試全過；分析：延遲比課堂的 3–5 秒低；CPU 編碼掉幀 19%，換 GPU 變 0%。

Here are our results, all measured on the real Azure site. Both slots were live at the same time. The delay from camera to viewer is about two to three seconds. Ten viewers joined at once with no problem, and all forty-four automated tests pass. On the left: the lecture said RTMP to HLS usually adds three to five seconds, and by tuning low-latency HLS we brought it down to two to three. On the right: the CPU encoder skipped nineteen percent of frames on our host PC. After we switched OBS to the NVIDIA GPU encoder, that dropped to zero.

## 5. Final platform screenshot — Yu-Cheng（約 30 秒，71 字）

> 重點：實際畫面：左邊電腦 OBS、右邊手機 4G 直播加即時字幕；手機拿不到推流金鑰（老師要求的功能）。

This is our final platform during the demo. On the left, the host PC streams through OBS. On the right, a phone streams over 4G with WebRTC, and the text under it is a live caption of what the speaker is saying. The tall picture is the phone's own screen at the same moment. The phone never sees the stream key: the server checks the login and adds the key itself.

## 6. Demo video — Yu-Cheng（約 10 秒，25 字）

> 重點：一句話帶入影片，然後播放 3:39 影片（影片有英文旁白，不用講話）。

Now let's watch our demo video. It is about three and a half minutes; slow parts are sped up, and the original sound is kept. [Play the video. It has its own English narration, so do not talk over it.]

## 7. More features not shown in the video — Yu-Cheng（約 35 秒，75 字）

> 重點：影片沒拍到的四個功能：AI 語音留言、一鍵切換畫面、斷線自動重連、直播健康面板。

A few features did not fit in the video. Top left: a viewer spends points on a voice message read by an AI voice, and the broadcaster can stop it at any time. Top right: a PC broadcaster switches between camera, screen plus camera, and screen with one click. Bottom left: if the network drops, the stream reconnects by itself. Bottom right: admins can check the bitrate and status of both slots in real time.

## 8. Work distribution — Shao-Huai（約 25 秒，48 字）

> 重點：分工：昱程前端與 OBS；少懷後端與雲端；測試、彩排、簡報、影片一起做。

For work distribution: Yu-Cheng led the frontend, which means the website, the chat and gift interface, and the OBS setup. I led the backend and the cloud: the Azure VM, MediaMTX, Node.js and the database. We did the testing, the rehearsals, the slides and the demo video together.

## 9. What we learned — Shao-Huai（約 40 秒，83 字）

> 重點：學到什麼：對應課堂（Azure 要自己管連接埠和費用、資料庫交易避免重複扣點、TCP 與 UDP 混用、延遲與緩衝的取捨、AI 代理要常 commit 和保護金鑰）。

What we learned maps directly to the lectures. From the Azure lecture: with a VM we manage the ports and the cost ourselves, so ours shuts down automatically every night. From the API and database lecture: transactions keep gift points correct, so nobody is charged twice. From the socket lecture: real services mix TCP and UDP. From the RTMP lecture: lower latency always trades off against buffering. And from the AI agent lecture: commit often, protect your secrets, and always ask for evidence.

## 10. Problems encountered — Shao-Huai（約 40 秒，87 字）

> 重點：遇到的問題：IP 變動連不上、兩位主播回音、手機鏡頭需要 HTTPS、CPU 編碼掉幀、金鑰誤傳 GitHub，以及各自的解法。

These are the main problems we hit. OBS could not connect when a broadcaster's IP address changed, so now we check the IP first and add a firewall rule. Two hosts with speakers caused echo, which we fixed with echo cancellation in OBS. Phones only allow the camera on HTTPS, so we added a certificate. The CPU encoder skipped frames, so we moved to the GPU. And once we pushed private keys to GitHub by mistake: we removed them, changed the keys, and added a gitignore rule.

## 11. Thank you — Yu-Cheng（約 25 秒，56 字）

> 重點：總結與下一步（TURN 伺服器、低於一秒的 WebRTC 播放、錄影回放），謝謝並開放提問。

To sum up, we built a working cloud live streaming platform where both OBS and phones can broadcast, with chat, gifts and accounts, all running on Azure. Next, we would like to add a TURN server for strict mobile networks, sub-second WebRTC playback, and recording. Thank you for listening. We are happy to take your questions.
