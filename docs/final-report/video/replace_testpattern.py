"""Replace the blue/red WHIP test pictures in the deck screenshots with real footage.

- Broadcaster previews and the viewer's "screen + camera" slot: our own site as the
  shared screen, with the real PC webcam frame in the corner.
- The voice-message screenshot: the real phone stream (portrait) as seen by viewers;
  the half-transparent message card on top is re-blended over the new picture.

Usage: python replace_testpattern.py <shots dir> <work dir with f74.png>
Originals are kept as *.orig.png the first time.
"""
import os
import shutil
import sys

from PIL import Image, ImageDraw, ImageFilter

SHOTS, WORK = sys.argv[1], sys.argv[2]
IMG = os.path.dirname(SHOTS)


def is_blue(p):
    r, g, b = p[:3]
    return b > 180 and r < 70 and 50 < g < 110


def test_bbox(im, ymax=None):
    """Bounding box of the solid blue 'SCREEN' test picture (the red camera sits inside it)."""
    px = im.load()
    w, h = im.size
    h = ymax or h
    xs, ys = [], []
    for y in range(0, h):
        for x in range(0, w):
            if is_blue(px[x, y]):
                xs.append(x)
                ys.append(y)
    return min(xs), min(ys), max(xs) + 1, max(ys) + 1


def screen_cam(w, h):
    """Our site as the shared screen + PC webcam picture-in-picture."""
    site = Image.open(os.path.join(SHOTS, 'site-zh.orig.png' if os.path.exists(os.path.join(SHOTS, 'site-zh.orig.png')) else os.path.join(SHOTS, 'site-zh.png'))).convert('RGB')
    sw = site.width
    screen = site.crop((0, 0, sw, round(sw * h / w))).resize((w, h), Image.LANCZOS)
    cam = Image.open(os.path.join(IMG, 'dual-live-real.jpg')).convert('RGB').crop((190, 296, 677, 574))
    pw = round(w * 0.265)
    ph = round(pw * 9 / 16)
    cam = cam.resize((pw, ph), Image.LANCZOS)
    m = max(4, round(w * 0.018))
    x, y = w - pw - m, h - ph - m
    d = ImageDraw.Draw(screen)
    d.rectangle((x - 1, y - 1, x + pw, y + ph), outline=(230, 230, 230))
    screen.paste(cam, (x, y))
    return screen


def rounded_mask(w, h, r):
    m = Image.new('L', (w, h), 0)
    ImageDraw.Draw(m).rounded_rectangle((0, 0, w - 1, h - 1), r, fill=255)
    return m


def backup(name):
    src = os.path.join(SHOTS, name)
    orig = src[:-4] + '.orig.png'
    if not os.path.exists(orig):
        shutil.copy(src, orig)
    return Image.open(orig).convert('RGB'), src


# 1) broadcaster previews (rounded corners) and the viewer slot
for name, radius in [('layout-panel.png', 10), ('mic-muted.png', 10), ('reconnecting.png', 10), ('layout-both-viewer.png', 0)]:
    im, out = backup(name)
    x0, y0, x1, y1 = test_bbox(im)
    w, h = x1 - x0, y1 - y0
    pic = screen_cam(w, h)
    mask = rounded_mask(w, h, radius) if radius else None
    im.paste(pic, (x0, y0), mask)
    im.save(out)
    print(name, (x0, y0, x1, y1))

# 2) voice-message screenshot: real phone stream under a translucent card
im, out = backup('voice-overlay.png')
px = im.load()
W, H = im.size
# slot rect = blue area; card top = first row where column 600 stops being pure blue
x0, y0, x1, _ = test_bbox(im, ymax=290)
blue = px[600, y0 + 20]
card_top = next(y for y in range(y0 + 20, H) if abs(px[600, y][2] - blue[2]) > 25)
y1 = next(y for y in range(card_top, H) if px[600, y][2] - px[600, y][0] < 40) # end of blue under the card
w, h = x1 - x0, y1 - y0

frame = Image.open(os.path.join(WORK, 'f74.png')).convert('RGB')
video = frame.crop((158, 10, 390, 418))
# hide the mouse pointer on the sweater by copying the sweater just to its right
video.paste(video.crop((72, 280, 88, 306)), (54, 280))
bg = frame.getpixel((40, 200))
H2 = 412
canvas = Image.new('RGB', (round(H2 * w / h), H2), bg)
canvas.paste(video, ((canvas.width - video.width) // 2, 0))
new = canvas.resize((w, h), Image.LANCZOS)

# card blend: C = aK + (1-a)B. Solve per channel from the card over the blue picture
# and the card over the dark gap between the two slots (just left of the slot).
c_blue = px[560, card_top + 44]
gx = x0 - 4
dark, c_dark = px[gx, card_top - 6], px[gx, card_top + 44]
t = [(c_blue[i] - c_dark[i]) / (blue[i] - dark[i]) for i in range(3)]  # (1-a)
t = [min(max(v, 0.05), 0.95) for v in t]
aK = [c_dark[i] - t[i] * dark[i] for i in range(3)]
print('card transmit', [round(v, 2) for v in t], 'aK', [round(v) for v in aK], 'card_top', card_top, 'y1', y1)

# the opaque "stop reading" pill button keeps its original pixels
BTN = (806, 368, 893, 398)
btn = Image.new('L', (W, H), 0)
ImageDraw.Draw(btn).rounded_rectangle(BTN, 15, fill=255)
bpx = btn.load()

npx = new.load()
for y in range(y0, y1):
    for x in range(x0, x1):
        n = npx[x - x0, y - y0]
        if y < card_top:
            px[x, y] = n
            continue
        if bpx[x, y]:
            continue
        # undo the old background, blend the new one under the card
        px[x, y] = tuple(max(0, min(255, round(aK[i] + t[i] * n[i]))) for i in range(3))
im.save(out)
print('voice-overlay.png', (x0, y0, x1, y1))
