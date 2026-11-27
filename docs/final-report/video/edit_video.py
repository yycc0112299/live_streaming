"""Builds the Group 9 demo video from the raw recordings.

- Computer clip on the left, phone clip on the right (or one of them centred).
- English AI narration (Azure neural voice) placed ONLY in quiet gaps of the original audio;
  a line that does not fit is shown as subtitles only. Original sound is never covered.
- Bilingual subtitles (English + Traditional Chinese), scene titles and technical notes
  (shown, never read) are burned in with ASS.
Run: python edit_video.py            -> C:\\g9\\demo-out\\Group9_demo.mp4
"""
import array, json, math, os, subprocess, sys, urllib.request

FF = r'C:\g9\tools\ffmpeg.exe'
WORK = r'C:\g9\tools\edit\work'
OUT = r'C:\g9\demo-out\Group9_demo.mp4'
RAW = r'C:\g9\demo-raw'
SHOTS = r'C:\g9\live_streaming\docs\final-report\img\shots'
KEY = open(r'C:\g9\private-backup\speech-key.txt').read().strip()
VOICE = os.environ.get('NARRATOR', 'en-US-AndrewMultilingualNeural')
W, H, FPS = 1920, 1080, 30
BG = '0x0B1220'
PC_GAIN, PHONE_GAIN = 2.0, 1.0      # +6 dB on the quiet browser recordings
QUIET_DB = -42                      # original audio louder than this = "has sound"

def pc(name): return os.path.join(RAW, f'Group 9 · Cloud Live - Google Chrome 2026-11-27 {name}.mp4')
def ph(name): return os.path.join(RAW, 'phone', f'ScreenRecording_11-27-2026 {name}_1.mp4')

# Phone clocks: file names are start times; phone t = pc t - offset
SEGMENTS = [
  dict(id='00-intro', card=('Group 9 · Cloud-Based Live Streaming', '第九組 · 雲端直播平台 Demo'), dur=4.5,
       lines=[(0.6, "Group 9's cloud live-streaming platform. Here is the demo.", '第九組的雲端直播平台，以下是功能示範。')]),
  dict(id='01-overview', title=('Site overview', '網站總覽'), pc=(pc('15-29-27'), 0.5, 12.0),
       note='Azure VM (Ubuntu 24.04 ARM64, Japan East) · Apache + Let\'s Encrypt HTTPS · OBS → RTMPS :1936 → MediaMTX → LL-HLS (~2–3 s)',
       lines=[(0.4, 'The site runs on an Azure virtual machine, fully over HTTPS.', '網站架在 Azure 虛擬機上，全程 HTTPS 加密。'),
              (5.5, 'Two slots let two broadcasters stream side by side.', '兩個直播格，讓兩位主播同台直播。')]),
  dict(id='02a-share', title=('Join with a link or QR code', '用連結或 QR Code 加入'), pc=(pc('15-36-20'), 3.0, 17.0),
       note='QR code generated in the browser · no app to install',
       lines=[(0.4, 'Viewers join with a link or by scanning this QR code. No app is needed.', '觀眾用連結或掃 QR Code 就能進來，不用安裝 App。')]),
  dict(id='02b-scan', title=('Join with a link or QR code', '用連結或 QR Code 加入'), pc=(pc('15-36-20'), 26.0, 32.0),
       note='Guest account created automatically · 1,000 demo points (no cash value)',
       lines=[(0.3, 'Each visitor gets a guest account with demo points.', '每位訪客自動取得帳號和示範點數。')]),
  dict(id='03a-nick', title=('Live chat', '即時聊天'), pc=(pc('15-37-22'), 5.0, 12.5), ph=(ph('15-37-22'), 0.0),
       note='Phone on 4G (right) · computer view (left)',
       lines=[(0.3, 'On the phone, the viewer picks a nickname.', '手機上的觀眾先改暱稱。')]),
  dict(id='03b-chat', title=('Live chat', '即時聊天'), pc=(pc('15-37-22'), 18.0, 34.0), ph=(ph('15-37-22'), 0.0),
       note='Socket.IO over WebSocket (TCP, in order) · 5-second slow mode · 500-char limit · banned-word filter',
       lines=[(0.5, 'The message reaches the computer instantly over WebSocket.', '訊息透過 WebSocket，馬上出現在電腦上。'),
              (9.0, 'Likes float up live.', '按讚也會即時飄出愛心。')]),
  dict(id='04-gifts', title=('3D gifts with sound', '3D 禮物與音效'), pc=(pc('15-38-33'), 3.5, 45.0), ph=(ph('15-38-35'), 2.0),
       note='Three.js (WebGL) models, lazy-loaded · Web Audio sounds ~14 dB below speech · repeated gifts merge into ×N',
       lines=[(0.2, 'Six gift tiers, each a real-time 3D animation with its own sound.', '六種禮物，各有即時 3D 動畫和音效。'),
              (31.0, 'Repeated gifts merge into one combo.', '連續送同一種禮物，會合併成連擊。')]),
  dict(id='05-board', title=('Top supporters', '本場應援榜'), pc=(pc('15-40-17'), 8.0, 25.0), ph=(ph('15-40-17'), 0.0),
       note='SQLite ledger · unique request IDs (no double charge) · only nicknames and points are public',
       lines=[(0.4, 'The leaderboard and each viewer\'s own rank update after every gift.', '應援榜和每個人的名次，送禮後立刻更新。')]),
  dict(id='06a-voice', title=('AI voice messages', 'AI 語音留言'), ph=(ph('15-41-52'), 3.0, 31.0),
       note='Azure AI Speech neural voices (free F0) · MP3 made once on the server · key stays on the VM',
       lines=[(0.3, 'For 25 points, a voice message is read aloud. The viewer picks one of nine neural voices.', '花 25 點送語音留言，觀眾可從九種神經語音中挑一種朗讀。')]),
  dict(id='06b-voice', title=('AI voice messages', 'AI 語音留言'), ph=(ph('15-41-52'), 54.0, 72.0),
       note='Voices include Taiwanese Mandarin, cheerful, live-commerce and sports-commentary styles',
       lines=[(0.2, 'Same message, different voices.', '同一句話，換不同的聲音。')]),
  dict(id='07a-join', title=('Phone joins the stream (teacher requirement)', '手機加入直播（老師指定功能）'), pc=(pc('15-43-31'), 36.0, 49.0), ph=(ph('15-43-34'), 3.0),
       note='Browser only · HTTPS camera access · slot released after 3 idle minutes',
       lines=[(0.3, 'The teacher\'s requirement: a phone joins the live stream from its browser, over 4G.', '老師要求的功能：手機用瀏覽器、透過 4G 加入直播。'),
              (7.5, 'An idle slot is released after three minutes.', '占了位置卻沒開播，3 分鐘後會自動讓位。')]),
  dict(id='07b-live', title=('Phone live + live captions', '手機直播與即時字幕'), pc=(pc('15-43-31'), 74.0, 108.0), ph=(ph('15-43-34'), 3.0),
       note='WebRTC WHIP (H.264 + Opus, UDP 8189) · server adds the publish key · captions: Web Speech API → Socket.IO',
       lines=[(0.3, 'The phone camera goes out over WebRTC. The server adds the stream key, so the phone never sees it.', '手機鏡頭用 WebRTC 推流，推流金鑰由伺服器加上，手機上看不到。'),
              (24.0, 'Live captions turn the broadcaster\'s speech into text for every viewer.', '即時字幕把主播說的話變成文字，給所有觀眾看。')]),
  dict(id='08-admin', title=('Admin tools', '管理員工具'), pc=(pc('15-47-27'), 0.0, 22.0),
       note='Audit log for every action · pinned notice · reports · mutes · session statistics',
       lines=[(0.4, 'Admins manage the pinned notice, reports and mutes, and see session statistics.', '管理員可以管理置頂公告、檢舉和禁言，並查看本場統計。')]),
  dict(id='09-more', title=('More features (see the next slides)', '更多功能（詳見後面投影片）'), dur=16.0,
       images=['voice-overlay.png', 'layout-both-viewer.png', 'reconnecting.png', 'admin-health.png', 'ledger.png'],
       note='Stop reading · one-click layouts · auto-reconnect · stream health panel · points ledger',
       lines=[(0.4, 'More features are on the next slides: one-click layouts, auto-reconnect, the health panel and the points ledger.', '更多功能在後面的投影片：一鍵切換畫面、斷線自動重連、直播健康面板和應援帳本。')]),
  dict(id='10-outro', card=('Thank you', '謝謝觀看 · Group 9'), dur=4.0,
       lines=[(0.5, 'Thank you for watching.', '謝謝觀看。')]),
]

def run(args, **kw):
    r = subprocess.run(args, capture_output=True, **kw)
    if r.returncode: sys.exit('ffmpeg failed: ' + r.stderr.decode('utf8', 'replace')[-1500:])
    return r

def pcm(path, start, dur, rate=8000):
    raw = subprocess.run([FF, '-v', 'error', '-ss', str(start), '-t', str(dur), '-i', path, '-vn', '-ac', '1', '-ar', str(rate), '-f', 's16le', '-'], capture_output=True).stdout
    a = array.array('h'); a.frombytes(raw[: len(raw) // 2 * 2]); return a

def loud_mask(path, start, dur, gain, step=0.1):
    a = pcm(path, start, dur); n = int(8000 * step); mask = []
    for i in range(0, max(1, int(dur / step))):
        chunk = a[i * n:(i + 1) * n]
        if not chunk: mask.append(False); continue
        rms = math.sqrt(sum(x * x for x in chunk) / len(chunk)) / 32768 * gain
        mask.append(20 * math.log10(rms + 1e-9) > QUIET_DB)
    return mask

def tts(text, out):
    if os.path.exists(out): return
    ssml = f'<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><voice name="{VOICE}"><prosody rate="-3%">{text}</prosody></voice></speak>'
    for attempt in range(3):
        try:
            req = urllib.request.Request('https://japaneast.tts.speech.microsoft.com/cognitiveservices/v1', data=ssml.encode(), method='POST', headers={
                'Ocp-Apim-Subscription-Key': KEY, 'Content-Type': 'application/ssml+xml', 'X-Microsoft-OutputFormat': 'audio-48khz-192kbitrate-mono-mp3', 'User-Agent': 'group9-edit'})
            data = urllib.request.urlopen(req, timeout=60).read()
            open(out, 'wb').write(data); return
        except Exception as e:
            err = e
    sys.exit(f'TTS failed: {err}')

def duration(path):
    a = pcm(path, 0, 120, 8000); return len(a) / 8000

def ass_time(t):
    t = max(0, t); h = int(t // 3600); m = int(t % 3600 // 60); s = t % 60
    return f'{h}:{m:02d}:{s:05.2f}'

ASS_HEAD = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {W}
PlayResY: {H}
WrapStyle: 0

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Title,Microsoft JhengHei,46,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,7,40,40,26,1
Style: Note,Microsoft JhengHei,25,&H00B4D52F,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,1,42,42,232,1
Style: SubEN,Segoe UI,40,&H00FFFFFF,&H00FFFFFF,&H00000000,&HA0000000,0,0,0,0,100,100,0,0,3,10,0,2,120,120,96,1
Style: SubZH,Microsoft JhengHei,34,&H00F5EDE8,&H00FFFFFF,&H00000000,&HA0000000,0,0,0,0,100,100,0,0,3,10,0,2,120,120,34,1
Style: CardBig,Microsoft JhengHei,76,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,0,0,5,80,80,0,1
Style: CardSub,Microsoft JhengHei,40,&H00B4D52F,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,5,80,80,0,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

def build_segment(seg):
    sid = seg['id']; os.makedirs(WORK, exist_ok=True)
    if 'pc' in seg: src, start, end = seg['pc']; dur = end - start
    elif 'ph' in seg: src, start, end = seg['ph']; dur = end - start
    else: src, dur = None, seg['dur']
    audio_src = None
    if 'pc' in seg: audio_src = (seg['pc'][0], seg['pc'][1], PC_GAIN)
    elif 'ph' in seg: audio_src = (seg['ph'][0], seg['ph'][1], PHONE_GAIN)
    mask = loud_mask(*audio_src[:2], dur, audio_src[2]) if audio_src else [False] * int(dur / 0.1 + 1)
    loud_secs = sum(mask) * 0.1

    # Narration placement: only in quiet windows, never past the end, never overlapping.
    placed, events, cursor = [], [], 0.0
    # A line may run up to MAX_HOLD s past the clip: the last frame is held, with no original sound.
    MAX_HOLD = 4.0
    clip_dur = dur
    mask = mask + [False] * int(MAX_HOLD / 0.1 + 2)
    for i, (want, en, zh) in enumerate(seg.get('lines', [])):
        mp3 = os.path.join(WORK, f'{sid}-{i}.mp3'); tts(en, mp3); d = duration(mp3)
        s, spot = max(want, cursor), None
        while s + d <= clip_dur + MAX_HOLD - 0.3:
            a, b = int(s / 0.1), int(min(len(mask), (s + d + 0.25) / 0.1))
            if not any(mask[a:b]): spot = s; break
            s += 0.1
        if spot is not None:
            placed.append((spot, mp3)); events.append((spot, spot + d + 0.3, en, zh)); cursor = spot + d + 0.35
        else:  # subtitle only, the original sound keeps playing
            st = max(want, cursor); en_t = min(clip_dur, st + max(2.8, len(en) / 14))
            events.append((st, en_t, en, zh)); cursor = en_t + 0.1
            print(f'  {sid}: line {i} shown as subtitle only (no quiet gap)')
    dur = max(clip_dur, max((e[1] for e in events), default=0) + 0.4)
    hold = dur - clip_dur

    ass = [ASS_HEAD]
    if 'card' in seg:
        big, sub = seg['card']
        ass.append(f'Dialogue: 0,{ass_time(0)},{ass_time(dur)},CardBig,,0,0,0,,{{\\pos(960,470)}}{big}')
        ass.append(f'Dialogue: 0,{ass_time(0)},{ass_time(dur)},CardSub,,0,0,0,,{{\\pos(960,570)}}{sub}')
    if 'title' in seg:
        en, zh = seg['title']
        ass.append(f'Dialogue: 0,{ass_time(0)},{ass_time(dur)},Title,,0,0,0,,{en}  {{\\fs30\\b0\\c&HC2AEA3&}}{zh}')
    if 'note' in seg:
        ass.append(f'Dialogue: 0,{ass_time(0.3)},{ass_time(dur)},Note,,0,0,0,,ⓘ {seg["note"]}')
    for st, et, en, zh in events:
        ass.append(f'Dialogue: 1,{ass_time(st)},{ass_time(et)},SubEN,,0,0,0,,{en}')
        ass.append(f'Dialogue: 1,{ass_time(st)},{ass_time(et)},SubZH,,0,0,0,,{zh}')
    open(os.path.join(WORK, f'{sid}.ass'), 'w', encoding='utf-8').write('\n'.join(ass) + '\n')

    # Video graph
    args = [FF, '-y', '-v', 'error', '-f', 'lavfi', '-i', f'color=c={BG}:s={W}x{H}:r={FPS}:d={dur}']
    filters, last, n = [], '[0:v]', 1
    VID_TOP, VID_H = 96, 690
    if 'pc' in seg:
        args += ['-ss', str(seg['pc'][1]), '-t', str(clip_dur), '-i', seg['pc'][0]]; pci = n; n += 1
    if 'ph' in seg:
        p_src = seg['ph'][0]; p_start = seg['ph'][1] if 'pc' not in seg else seg['pc'][1] - seg['ph'][1]
        args += ['-ss', str(max(0, p_start)), '-t', str(clip_dur), '-i', p_src]; phi = n; n += 1
    if 'pc' in seg and 'ph' in seg:
        filters.append(f'[{pci}:v]crop=1920:980:0:40,fps={FPS},scale=1300:-2,setsar=1,tpad=stop_mode=clone:stop_duration={hold:.2f}[pcv]')
        filters.append(f'[{phi}:v]fps={FPS},scale=-2:{VID_H},setsar=1,tpad=stop_mode=clone:stop_duration={hold:.2f}[phv]')
        filters.append(f'{last}[pcv]overlay=30:{VID_TOP}:shortest=0[v1]'); filters.append(f'[v1][phv]overlay=1360:{VID_TOP}[v2]'); last = '[v2]'
    elif 'pc' in seg:
        filters.append(f'[{pci}:v]crop=1920:980:0:40,fps={FPS},scale=-2:{VID_H + 20},setsar=1,tpad=stop_mode=clone:stop_duration={hold:.2f}[pcv]')
        filters.append(f'{last}[pcv]overlay=(W-w)/2:{VID_TOP - 6}[v2]'); last = '[v2]'
    elif 'ph' in seg:
        filters.append(f'[{phi}:v]fps={FPS},scale=-2:{VID_H + 20},setsar=1,tpad=stop_mode=clone:stop_duration={hold:.2f}[phv]')
        filters.append(f'{last}[phv]overlay=(W-w)/2:{VID_TOP - 6}[v2]'); last = '[v2]'
    if 'images' in seg:
        each = dur / len(seg['images'])
        for k, img in enumerate(seg['images']):
            args += ['-loop', '1', '-t', str(dur), '-i', os.path.join(SHOTS, img)]; ii = n; n += 1
            filters.append(f'[{ii}:v]scale=1600:{VID_H}:force_original_aspect_ratio=decrease,setsar=1[im{k}]')
            filters.append(f"{last}[im{k}]overlay=(W-w)/2:{VID_TOP}+({VID_H}-h)/2:enable='between(t,{k * each:.2f},{(k + 1) * each:.2f})'[vi{k}]"); last = f'[vi{k}]'
    filters.append(f"{last}ass={sid}.ass:fontsdir=../fonts,format=yuv420p[vout]")

    # Audio graph: original sound (+gain) + narration only in quiet gaps
    a_inputs = []
    if audio_src:
        src_idx = pci if 'pc' in seg else phi
        filters.append(f'[{src_idx}:a]volume={audio_src[2]},aresample=48000,aformat=channel_layouts=stereo[orig]'); a_inputs.append('[orig]')
    else:
        args += ['-f', 'lavfi', '-t', str(dur), '-i', 'anullsrc=r=48000:cl=stereo']; filters.append(f'[{n}:a]anull[orig]'); n += 1; a_inputs.append('[orig]')
    for k, (st, mp3) in enumerate(placed):
        args += ['-i', mp3]; ms = int(st * 1000)
        filters.append(f'[{n}:a]aresample=48000,aformat=channel_layouts=stereo,volume=1.25,adelay={ms}|{ms}[n{k}]'); a_inputs.append(f'[n{k}]'); n += 1
    filters.append(f"{''.join(a_inputs)}amix=inputs={len(a_inputs)}:normalize=0:duration=longest,apad,atrim=0:{dur}[aout]")
    out = os.path.join(WORK, f'{sid}.mp4')
    args += ['-filter_complex', ';'.join(filters), '-map', '[vout]', '-map', '[aout]', '-t', str(dur), '-r', str(FPS),
             '-c:v', 'libx264', '-preset', 'medium', '-crf', '22', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', out]
    run(args, cwd=WORK)
    print(f'{sid}: {dur:.1f}s · original sound {loud_secs:.1f}s · narration {len(placed)}/{len(seg.get("lines", []))} lines voiced')
    return out

if __name__ == '__main__':
    only = sys.argv[1:]
    outs = [build_segment(s) for s in SEGMENTS if not only or s['id'] in only]
    if only: sys.exit(0)
    lst = os.path.join(WORK, 'concat.txt')
    open(lst, 'w', encoding='utf-8').write(''.join(f"file '{o.replace(chr(92), '/')}'\n" for o in outs))
    run([FF, '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-c', 'copy', '-movflags', '+faststart', OUT])
    print('wrote', OUT)
