# Group 9 — English talk script (final report)

總長約 9:49：講話 6:10 + 影片 3:39。由王昱程一個人從頭講到尾（第一人稱）。
每頁都有英文講稿（上台講的）和中文對照（幫助理解），兩者也都放在簡報的講者備註裡（PowerPoint 簡報者檢視看得到）。語速約每分鐘 130 字；慢慢講、句子短，比背得一字不差重要。

| # | 投影片 | 開始 | 長度 |
|---|---|---|---|
| 1 | Title | 0:00 | 30 s |
| 2 | System architecture | 0:30 | 55 s |
| 3 | Everything the platform does | 1:25 | 35 s |
| 4 | Results and analysis | 2:00 | 45 s |
| 5 | Final platform screenshot | 2:45 | 30 s |
| 6 | Demo video | 3:15 | 10 s + 影片 3:39 |
| 7 | More features not shown in the video | 7:04 | 35 s |
| 8 | Work distribution | 7:39 | 25 s |
| 9 | What we learned | 8:04 | 40 s |
| 10 | Problems encountered | 8:44 | 40 s |
| 11 | Thank you | 9:24 | 25 s |

---

## 1. Title（約 30 秒，75 字）

> 重點：開場：介紹組名與兩位組員、一句話說明專案、預告六個主題。

**English（上台講這段）**

Good morning, everyone. We are Group 9. I'm Wang Yu-Cheng, and my partner is Tsao Shao-Huai. Our project is a cloud-based live streaming platform. Broadcasters can go live from OBS or straight from a phone browser, an Azure virtual machine relays the video, and viewers watch and chat on one web page. Today I will cover our architecture, our results, a demo, how we split the work, what we learned, and the problems we solved.

**中文對照**

大家早安，我們是第九組。我是王昱程，我的組員是曹少懷。我們的專題是一個雲端直播平台。主播可以用 OBS，或直接用手機瀏覽器開播；影像由 Azure 虛擬機轉送；觀眾在同一個網頁上觀看和聊天。今天我會介紹系統架構、成果、Demo、分工、學到的東西，以及我們解決的問題。

## 2. System architecture（約 55 秒，122 字）

> 重點：架構：一台 Azure VM；OBS 走 RTMPS (TCP)、手機走 WebRTC (UDP)；MediaMTX 轉 HLS；Node.js 管網站與聊天；聊天用 TCP、影像用 UDP 的原因。

**English（上台講這段）**

Here is our system architecture. Everything runs on one Azure VM in Japan East. Video comes in on the left. The two PCs use OBS and push RTMPS over TCP port 1936, and only the broadcasters' IP addresses are allowed in. The phone needs no app: its browser sends the camera with WebRTC over UDP. Inside the VM, MediaMTX receives both streams and turns them into low-latency HLS. Node.js and Socket.IO run the website, the API and the chat, Apache adds HTTPS, and SQLite stores accounts, chat and the gift ledger. In short: chat uses TCP because every message must arrive, the phone uses UDP because speed matters more for live video, and viewers use HLS so any browser can play it.

**中文對照**

這是我們的系統架構。所有服務都跑在一台位於日本東部的 Azure 虛擬機上。影像從左邊進來：兩台電腦用 OBS，透過 TCP 1936 埠推 RTMPS，而且只允許主播的 IP 連進來。手機不需要裝 App，瀏覽器直接用 WebRTC、走 UDP 把鏡頭畫面送上來。在虛擬機裡，MediaMTX 接收這兩路串流，轉成低延遲的 HLS。Node.js 和 Socket.IO 負責網站、API 和聊天室，Apache 提供 HTTPS，SQLite 存帳號、聊天紀錄和禮物帳本。簡單來說：聊天用 TCP，因為每則訊息都一定要送到；手機用 UDP，因為直播影像更重視速度；觀眾端用 HLS，任何瀏覽器都能播放。

## 3. Everything the platform does（約 35 秒，73 字）

> 重點：功能總覽：觀眾、主播、管理員三欄，大部分會在影片看到。

**English（上台講這段）**

This slide lists everything the platform does. Viewers can watch two broadcasters side by side, join with a QR code, chat, send 3D gifts, climb the supporters board, send AI voice messages, and read live captions. Broadcasters can use OBS, or just a browser, including a phone, which was the teacher's requirement. Admins get chat moderation, a stream health panel and session statistics. You will see most of these in our demo video.

**中文對照**

這一頁列出平台的所有功能。觀眾可以同時看兩位主播、用 QR code 加入、聊天、送 3D 禮物、登上應援榜、送 AI 語音留言，還能看即時字幕。主播可以用 OBS，也可以只用瀏覽器，包括手機，這是老師要求的功能。管理員有聊天室管理、直播健康面板和本場統計。大部分功能等一下會在 Demo 影片裡看到。

## 4. Results and analysis（約 45 秒，101 字）

> 重點：成果：兩路同時直播、延遲約 2–3 秒、10 人同時加入、44 個測試全過；分析：延遲比課堂的 3–5 秒低；CPU 編碼掉幀 19%，換 GPU 變 0%。

**English（上台講這段）**

Here are our results, all measured on the real Azure site. Both slots were live at the same time. The delay from camera to viewer is about two to three seconds. Ten viewers joined at once with no problem, and all forty-four automated tests pass. On the left: the lecture said RTMP to HLS usually adds three to five seconds, and by tuning low-latency HLS we brought it down to two to three. On the right: the CPU encoder skipped nineteen percent of frames on our host PC. After we switched OBS to the NVIDIA GPU encoder, that dropped to zero.

**中文對照**

這是我們的成果，全部都是在真正的 Azure 網站上量到的。兩個直播格曾經同時在線。從鏡頭到觀眾的延遲大約二到三秒。十位觀眾同時加入沒有問題，四十四個自動化測試全部通過。左邊：課堂上說 RTMP 轉 HLS 通常會多出三到五秒，我們調整低延遲 HLS 後降到二到三秒。右邊：用 CPU 編碼時，主播電腦掉了百分之十九的幀；把 OBS 換成 NVIDIA 顯示卡編碼後，掉幀降到零。

## 5. Final platform screenshot（約 30 秒，71 字）

> 重點：實際畫面：左邊電腦 OBS、右邊手機 4G 直播加即時字幕；手機拿不到推流金鑰（老師要求的功能）。

**English（上台講這段）**

This is our final platform during the demo. On the left, the host PC streams through OBS. On the right, a phone streams over 4G with WebRTC, and the text under it is a live caption of what the speaker is saying. The tall picture is the phone's own screen at the same moment. The phone never sees the stream key: the server checks the login and adds the key itself.

**中文對照**

這是 Demo 時平台的實際畫面。左邊是主播電腦用 OBS 直播；右邊是手機透過 4G、用 WebRTC 直播，下面那行字是講者說話的即時字幕。右側直的那張是同一時間手機自己的畫面。手機完全不會拿到推流金鑰：伺服器先確認登入，再自己把金鑰加上去。

## 6. Demo video（約 10 秒，25 字）

> 重點：一句話帶入影片，然後播放 3:39 影片（影片有英文旁白，不用講話）。

**English（上台講這段）**

Now let's watch our demo video. It is about three and a half minutes; slow parts are sped up, and the original sound is kept. [Play the video. It has its own English narration, so do not talk over it.]

**中文對照**

接下來請看我們的 Demo 影片，大約三分半；比較慢的地方有加速，原本的聲音都有保留。〔播放影片。影片本身有英文旁白，播放時不用講話。〕

## 7. More features not shown in the video（約 35 秒，75 字）

> 重點：影片沒拍到的四個功能：AI 語音留言、一鍵切換畫面、斷線自動重連、直播健康面板。

**English（上台講這段）**

A few features did not fit in the video. Top left: a viewer spends points on a voice message read by an AI voice, and the broadcaster can stop it at any time. Top right: a PC broadcaster switches between camera, screen plus camera, and screen with one click. Bottom left: if the network drops, the stream reconnects by itself. Bottom right: admins can check the bitrate and status of both slots in real time.

**中文對照**

有幾個功能影片裡沒放到。左上：觀眾花點數送語音留言，由 AI 聲音唸出來，主播隨時可以停止。右上：用電腦開播的主播，可以一鍵切換「只有鏡頭」、「螢幕加鏡頭」和「只有螢幕」。左下：網路斷掉時，直播會自己重新連線。右下：管理員可以即時看到兩個直播格的位元率和狀態。

## 8. Work distribution（約 25 秒，48 字）

> 重點：分工：王昱程前端與 OBS；曹少懷後端與雲端；測試、彩排、簡報、影片一起做。

**English（上台講這段）**

For work distribution: I led the frontend, which means the website, the chat and gift interface, and the OBS setup. Shao-Huai led the backend and the cloud: the Azure VM, MediaMTX, Node.js and the database. We did the testing, the rehearsals, the slides and the demo video together.

**中文對照**

分工方面：我負責前端，包括網站、聊天和禮物介面，以及 OBS 設定。少懷負責後端和雲端：Azure 虛擬機、MediaMTX、Node.js 和資料庫。測試、彩排、簡報和 Demo 影片是我們一起完成的。

## 9. What we learned（約 40 秒，83 字）

> 重點：學到什麼：對應課堂（Azure 要自己管連接埠和費用、資料庫交易避免重複扣點、TCP 與 UDP 混用、延遲與緩衝的取捨、AI 代理要常 commit 和保護金鑰）。

**English（上台講這段）**

What we learned maps directly to the lectures. From the Azure lecture: with a VM we manage the ports and the cost ourselves, so ours shuts down automatically every night. From the API and database lecture: transactions keep gift points correct, so nobody is charged twice. From the socket lecture: real services mix TCP and UDP. From the RTMP lecture: lower latency always trades off against buffering. And from the AI agent lecture: commit often, protect your secrets, and always ask for evidence.

**中文對照**

我們學到的東西都能對應到課堂。Azure 那堂：用虛擬機就要自己管連接埠和費用，所以我們的機器每天晚上會自動關機。API 和資料庫那堂：用交易確保禮物點數正確，不會重複扣點。Socket 那堂：真實的服務會同時用 TCP 和 UDP。RTMP 那堂：延遲越低，就越要在緩衝上取捨。AI 代理那堂：要常常 commit、保護好金鑰，而且一定要求拿出證據。

## 10. Problems encountered（約 40 秒，87 字）

> 重點：遇到的問題：IP 變動連不上、兩位主播回音、手機鏡頭需要 HTTPS、CPU 編碼掉幀、金鑰誤傳 GitHub，以及各自的解法。

**English（上台講這段）**

These are the main problems we hit. OBS could not connect when a broadcaster's IP address changed, so now we check the IP first and add a firewall rule. Two hosts with speakers caused echo, which we fixed with echo cancellation in OBS. Phones only allow the camera on HTTPS, so we added a certificate. The CPU encoder skipped frames, so we moved to the GPU. And once we pushed private keys to GitHub by mistake: we removed them, changed the keys, and added a gitignore rule.

**中文對照**

這些是我們遇到的主要問題。主播的 IP 一換，OBS 就連不上，所以現在會先確認 IP，再加防火牆規則。兩位主播都開喇叭會產生回音，我們用 OBS 的回音消除解決。手機只有在 HTTPS 下才能開鏡頭，所以我們加了憑證。CPU 編碼會掉幀，所以改用 GPU。還有一次不小心把私密金鑰推上 GitHub：我們把它移除、換掉金鑰，並加上 gitignore 規則。

## 11. Thank you（約 25 秒，56 字）

> 重點：總結與下一步（TURN 伺服器、低於一秒的 WebRTC 播放、錄影回放），謝謝並開放提問。

**English（上台講這段）**

To sum up, we built a working cloud live streaming platform where both OBS and phones can broadcast, with chat, gifts and accounts, all running on Azure. Next, we would like to add a TURN server for strict mobile networks, sub-second WebRTC playback, and recording. Thank you for listening. We are happy to take your questions.

**中文對照**

總結來說，我們做出一個可以實際運作的雲端直播平台，OBS 和手機都能開播，有聊天、禮物和帳號功能，全部跑在 Azure 上。接下來，我們想加上 TURN 伺服器來支援比較嚴格的行動網路、低於一秒的 WebRTC 播放，以及錄影功能。謝謝大家聆聽，歡迎提問。
