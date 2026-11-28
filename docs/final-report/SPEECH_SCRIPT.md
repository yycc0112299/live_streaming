# Group 9 — English talk script (final report)

總長約 9:29：講話 5:50 + 影片 3:39。由王昱程一個人從頭講到尾（第一人稱）。
每頁都有英文講稿（上台講的）和中文對照（幫助理解），兩者也都放在簡報的講者備註裡（PowerPoint 簡報者檢視看得到）。語速約每分鐘 130 字；慢慢講、句子短，比背得一字不差重要。

| # | 投影片 | 開始 | 長度 |
|---|---|---|---|
| 1 | Title | 0:00 | 25 s |
| 2 | System architecture | 0:25 | 25 s |
| 3 | Everything the platform does | 0:50 | 75 s |
| 4 | Results and analysis | 2:05 | 30 s |
| 5 | Final platform screenshot | 2:35 | 30 s |
| 6 | Demo video | 3:05 | 10 s + 影片 3:39 |
| 7 | More features not shown in the video | 6:54 | 50 s |
| 8 | Work distribution | 7:44 | 20 s |
| 9 | What we learned | 8:04 | 30 s |
| 10 | Problems encountered | 8:34 | 35 s |
| 11 | Thank you | 9:09 | 20 s |

---

## 1. Title（約 25 秒，62 字）

> 重點：開場：自我介紹、一句話說明做了什麼、說明今天重點是功能。

**English（上台講這段）**

Good morning, everyone. We are Group 9. I'm Wang Yu-Cheng, and my partner is Tsao Shao-Huai. We built a cloud live streaming website. People can go live from OBS on a computer, or just from a phone browser, and everyone watches, chats and sends gifts on the same page. I'll show the architecture briefly, and then focus on the features we built.

**中文對照**

大家早安，我們是第九組。我是王昱程，我的組員是曹少懷。我們做了一個雲端直播網站。可以用電腦的 OBS 開播，也可以直接用手機瀏覽器開播，所有人在同一個網頁上觀看、聊天和送禮物。我會先簡單帶過架構，然後重點介紹我們做出來的功能。

## 2. System architecture（約 25 秒，47 字）

> 重點：架構只講大概：影像從 OBS 或手機進來 → 一台 Azure 虛擬機處理 → 觀眾用瀏覽器看。

**English（上台講這段）**

Here is the architecture, very briefly. Video comes in from OBS on a computer, or from a phone browser. One Azure virtual machine receives it, runs our website and chat, and stores accounts and points. Viewers simply open the page in any browser to watch and chat.

**中文對照**

架構簡單帶過。影像從電腦的 OBS 或手機瀏覽器進來，由一台 Azure 虛擬機接收，同時負責網站和聊天室，並存放帳號和點數。觀眾只要用任何瀏覽器打開網頁，就能觀看和聊天。

## 3. Everything the platform does（約 75 秒，149 字）

> 重點：重點頁：觀眾功能（雙主播、掃碼加入、聊天、3D 禮物與連擊、應援榜、AI 語音留言、即時字幕）、主播功能（手機直播是老師要求）、管理員功能。

**English（上台講這段）**

Now the main part: what the platform can do. For viewers, two broadcasters can be live side by side on one page. You join just by scanning a QR code, with no app, and you get a guest account with points right away. You can chat, send GIFs and likes, and send 3D gifts, which play an animation with a quiet sound that never covers the streamer's voice. Send the same gift several times and it shows a combo. The supporters board updates instantly. You can also pay points for a voice message, read aloud by an AI voice you choose. And live captions turn the streamer's speech into text. For broadcasters, besides OBS, anyone can go live straight from a phone browser; this was the teacher's requirement. For admins, there are tools to manage the chat, check that both streams are healthy, and see statistics for each session.

**中文對照**

接下來是重點：平台能做什麼。觀眾方面，兩位主播可以在同一頁並排直播。只要掃 QR code 就能加入，不用裝 App，一進來就有訪客帳號和點數。可以聊天、傳 GIF、按讚，也可以送 3D 禮物：會播動畫和小聲的音效，不會蓋過主播的聲音；同一個禮物連續送會顯示連擊。應援榜會即時更新。觀眾還可以花點數送語音留言，用自己選的 AI 聲音唸出來。即時字幕會把主播說的話轉成文字。主播方面，除了 OBS，任何人都能直接用手機瀏覽器開播，這是老師要求的功能。管理員方面，有管理聊天室、檢查兩路直播是否正常、以及查看每場統計的工具。

## 4. Results and analysis（約 30 秒，57 字）

> 重點：成果用白話講：在真正的網站上測過、兩路同時直播、10 位觀眾同時加入沒問題、畫面只慢約兩秒、改用顯示卡後不再卡頓。

**English（上台講這段）**

For results, we tested everything on the real website. Two streams were live at the same time, and ten viewers joined together without problems. Viewers see the picture only about two seconds after the camera, so chat and gifts feel live. One problem was stuttering video, and moving the encoding to the graphics card made it smooth.

**中文對照**

成果方面，我們全部在真正的網站上測試過。兩路直播可以同時進行，十位觀眾一起加入也沒有問題。觀眾看到的畫面只比鏡頭慢大約兩秒，所以聊天和送禮物都很即時。我們遇過畫面卡頓的問題，改用顯示卡編碼之後就變順了。

## 5. Final platform screenshot（約 30 秒，63 字）

> 重點：實際畫面：左邊電腦 OBS、右邊手機 4G 直播加即時字幕；右側是同一時間的手機畫面，手機不需要任何金鑰。

**English（上台講這段）**

This is the real platform during our demo. On the left is the computer streaming with OBS. On the right is a phone streaming over 4G, with live captions under the picture. And this is the phone's own screen at the same moment: a camera preview, a mic button and a stop button. The phone never needs a password or a stream key.

**中文對照**

這是 Demo 時平台的實際畫面。左邊是電腦用 OBS 直播；右邊是手機用 4G 直播，畫面下方有即時字幕。右側是同一時間手機自己的畫面：鏡頭預覽、麥克風按鈕和停止按鈕。手機完全不需要密碼或推流金鑰。

## 6. Demo video（約 10 秒，25 字）

> 重點：一句話帶入影片，然後播放 3:39 影片（影片有英文旁白，不用講話）。

**English（上台講這段）**

Now let's watch our demo video. It is about three and a half minutes; slow parts are sped up, and the original sound is kept. [Play the video. It has its own English narration, so do not talk over it.]

**中文對照**

接下來請看我們的 Demo 影片，大約三分半；比較慢的地方有加速，原本的聲音都有保留。〔播放影片。影片本身有英文旁白，播放時不用講話。〕

## 7. More features not shown in the video（約 50 秒，119 字）

> 重點：影片沒拍到的功能：語音留言卡片與停止朗讀、一鍵切換畫面與麥克風、斷線自動重連、直播健康面板，以及點數紀錄、英文介面、禮物開關。

**English（上台講這段）**

Some features did not fit in the video. Top left: when a viewer sends a voice message, a card appears on the stream and the AI voice reads it; the streamer can stop it at any time. Top right: a streamer on a computer can switch with one click between camera only, screen plus camera, and screen only, and mute the mic, without stopping the stream. Bottom left: if the network drops, for example when a phone switches from Wi-Fi to 4G, the stream reconnects by itself. Bottom right: admins can see at a glance whether both streams are healthy. We also have a points history for every viewer, an English interface, and a switch to turn gifts off.

**中文對照**

有些功能影片裡沒放到。左上：觀眾送語音留言時，直播畫面上會出現留言卡片，由 AI 聲音唸出來，主播隨時可以停止。右上：用電腦開播的主播可以一鍵切換「只有鏡頭」、「螢幕加鏡頭」和「只有螢幕」，也能關麥克風，直播都不會中斷。左下：網路斷掉時，例如手機從 Wi-Fi 換到 4G，直播會自己重新連線。右下：管理員一眼就能看出兩路直播是否正常。另外還有每位觀眾的點數紀錄、英文介面，以及關閉禮物的開關。

## 8. Work distribution（約 20 秒，41 字）

> 重點：分工：我做前端與 OBS；少懷做後端與雲端；測試、彩排、簡報、影片一起做。

**English（上台講這段）**

For work distribution: I built the frontend, meaning the website and the chat and gift interface, and I set up OBS. Shao-Huai built the backend and the cloud server. We did the testing, the rehearsals, the slides and the video together.

**中文對照**

分工方面：我負責前端，也就是網站以及聊天和禮物介面，還有 OBS 設定。少懷負責後端和雲端伺服器。測試、彩排、簡報和影片是我們一起完成的。

## 9. What we learned（約 30 秒，60 字）

> 重點：學到什麼（對應課堂，簡單講）：雲端主機要自己管費用、資料庫確保點數正確、聊天和影像傳送方式不同、常存檔並保護金鑰。

**English（上台講這段）**

What we learned: from the Azure lecture, a cloud server is ours to manage, including the cost, so ours turns off every night. From the database lecture, how to keep points correct. From the socket and streaming lectures, why chat and live video travel differently. And from the AI agent lecture, to save our work often and keep secrets safe.

**中文對照**

我們學到的東西：Azure 那堂課，雲端主機要自己管理，包括費用，所以我們的主機每天晚上會自動關機。資料庫那堂課，學到怎麼讓點數保持正確。Socket 和串流那兩堂課，了解聊天和直播影像為什麼用不同的方式傳送。AI 代理那堂課，要常常存檔，並保護好金鑰。

## 10. Problems encountered（約 35 秒，77 字）

> 重點：遇到的問題（白話）：換網路連不上、兩位主播回音、手機鏡頭需要安全連線、畫面卡頓、金鑰誤傳 GitHub，以及各自的解法。

**English（上台講這段）**

These are the main problems we hit. OBS could not connect when a streamer's internet address changed, so we now check it and allow the new address. Two streamers with speakers caused echo, which echo cancellation fixed. Phones only open the camera on a secure website, so we added a certificate. The video stuttered until we used the graphics card. And once we uploaded secret keys to GitHub by mistake, so we removed them and changed them.

**中文對照**

這些是我們遇到的主要問題。主播的網路位址一換，OBS 就連不上，所以現在會先確認，再允許新的位址。兩位主播都開喇叭會有回音，用回音消除解決。手機只有在安全的網站上才能開鏡頭，所以我們加了憑證。畫面會卡頓，改用顯示卡後就好了。還有一次不小心把金鑰傳上 GitHub，我們把它刪掉並換了新的。

## 11. Thank you（約 20 秒，51 字）

> 重點：總結與下一步（錄影回放、更低延遲），謝謝並開放提問。

**English（上台講這段）**

To sum up, we built a working live streaming website where both computers and phones can go live, with chat, gifts and AI voice messages, all running on Azure. Next, we would like to add recording and even lower delay. Thank you for listening. We are happy to take your questions.

**中文對照**

總結來說，我們做出一個可以實際運作的直播網站，電腦和手機都能開播，有聊天、禮物和 AI 語音留言，全部跑在 Azure 上。接下來我們想加上錄影功能，並讓延遲更低。謝謝大家聆聽，歡迎提問。
