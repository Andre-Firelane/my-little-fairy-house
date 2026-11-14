"""Feen-Baukasten aus den Teile-Blättern (grüner Hintergrund) bauen.

    python tools/import-fairy-kit.py [--preview <Datei.png>]

Quellen: art-source/baukasten/
- Feen Base.webp        – 9 Grundfiguren (Gesicht + Hautfarbe; T-Shirt und Shorts werden zu Haut übermalt)
- Feen Frisuren.webp    – 10 Frisuren
- Feen Kleider.webp     – 10 Kleider (der lila Rock bleibt weg: er ist kein ganzes Kleid)
- Feen Zauberstäbe.webp – 12 Zauberstäbe (werden schräg in die Hand gesetzt)
- Feen Flügel.webp      – 13 Flügel (rechter Flügel wird ausgeschnitten, der linke im Spiel gespiegelt)

Alle Teile außer den Flügeln liegen in einem gemeinsamen Rahmen (FRAME, Ursprung = Schultermitte der Fee),
also im Spiel ohne weitere Angaben passend übereinander. Wo ein Teil im Rahmen sitzt (Maßstab, Versatz),
steht unten in FIT – einmal ermittelt durch Formvergleich mit der früheren, von Hand ausgerichteten Fee.

Ausgabe: public/assets/fairies/*.png und src/config/fairyParts.json
"""
import json
import math
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from sheetlib import close, dilate, erode, fill_holes, flood, hsv, labels  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, 'art-source', 'baukasten')
OUT = os.path.join(ROOT, 'public', 'assets', 'fairies')
OUT_JSON = os.path.join(ROOT, 'src', 'config', 'fairyParts.json')

# Rahmen (Pixel der Ausgabebilder) und Spiel-Einheiten: Fee 78 Einheiten hoch, Ursprung an der Schultermitte
OW, OH = 235, 315
UNIT = 87.77 / OH  # Spiel-Einheiten je Rahmen-Pixel
ANCHOR = (118.8, 142.2)  # Schultermitte im Rahmen
HEAD = (0, -34.46, 40.29)  # Kopf relativ zum Ursprung (Einheiten): x, Scheitel, Breite – für Zipfelmütze/Stirnband

# Platz im Rahmen: (Maßstab, x, y der linken oberen Ecke des Teils) – Reihenfolge wie auf den Blättern
FIT = {
    'body': [(0.808, 48.4, 41), (0.808, 49.0, 41), (0.808, 48.4, 41), (0.805, 50.2, 41), (0.808, 49.3, 41),
             (0.805, 49.9, 41), (0.824, 48.8, 41), (0.824, 48.7, 41), (0.824, 49.2, 41)],
    'hair': [(0.808, 44.5, 17.2), (0.828, 45.3, 17.8), (0.824, 42.9, 15.5), (0.779, 57.7, 28.1), (0.837, 67.6, 21.9),
             (0.825, 44.9, 27.7), (0.834, 66.1, 35.0), (0.834, 49.5, 30.5), (0.80, 62.0, 22.0), (0.83, 72.0, 8.0)],
    'dress': [(0.825, 62.6, 137.6), (0.773, 61.3, 142.7), (0.747, 62.8, 139.2), (0.784, 59.4, 139.2), (0.779, 53.3, 142.7),
              (0.797, 66.0, 135.6), (0.745, 61.4, 134.8), (0.803, 55.9, 131.2), (0.78, 32.0, 138.0)],
}
DRESS_SKIP = 'skirt'  # der lila Rock

# Flügel: Ausschnitt im Blatt (x0, y0, x1, y1) und Art: 'pair' (Paar, Mitte = Körper), 'right' / 'left' (nur eine Seite)
WINGS = [
    ((15, 30, 220, 245), 'pair'),  # rosa Schmetterling
    ((222, 35, 418, 245), 'pair'),  # blauer Schmetterling
    ((420, 35, 592, 205), 'right'),  # Libelle
    ((594, 25, 750, 230), 'right'),  # Blätter
    ((15, 275, 285, 475), 'pair'),  # Engel
    ((285, 275, 505, 480), 'pair'),  # Kristall
    ((505, 290, 750, 475), 'pair'),  # Herbstlaub
    ((20, 520, 300, 725), 'pair'),  # Feuer
    ((312, 525, 503, 725), 'pair'),  # Pastell-Schnörkel
    ((455, 520, 752, 715), 'pair'),  # Sternennacht
    ((20, 770, 300, 1005), 'pair'),  # Pastell-Schmetterling
    ((283, 775, 432, 980), 'right'),  # bunter Schmetterling (eine Seite)
    ((445, 745, 755, 990), 'pair'),  # Blütenblätter
]
WING_SCALE = 1.1  # Flügel-Blatt → Rahmen-Pixel (etwas größer als die Figur im Blatt: feenhafter)

# Gesicht (Rahmen-Zeilen von den Brauen bis zum Kinn, Abstand zum Kopfrand): Haare dort hinter dem Gesicht
FACE_ROWS = (98, 141)
FACE_INSET = 9

# Zauberstab in der Hand: Länge (Rahmen-Pixel), Neigung (Grad, Spitze nach außen), Griff (Anteil von oben)
WAND_LEN = 148
WAND_TILT = 32
WAND_GRIP = 0.7
WAND_PAD = 90  # Zauberstäbe ragen über den gemeinsamen Rahmen hinaus: eigener, größerer Rahmen


def key(path, glow=7):
    """Grünen Hintergrund entfernen: (rgba float, Maske je Teil)"""
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    corners = np.concatenate([im[:8, :8].reshape(-1, 3), im[-8:, -8:].reshape(-1, 3), im[:8, -8:].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    d = np.sqrt(((im - bg) ** 2).sum(2))
    H, W = d.shape
    border = [(0, x) for x in range(W)] + [(H - 1, x) for x in range(W)] + [(y, 0) for y in range(H)] + [(y, W - 1) for y in range(H)]
    outside = flood(d < 70, border) | (d < 60)  # auch eingeschlossenes Grün (zwischen Haarsträhnen)
    alpha = np.where(outside, 0.0, 1.0)
    # Kante: Mischpixel aus Motiv und Grün durchscheinend machen und entfärben
    edge = ~outside & dilate(outside, 3) & (d < 170)
    a = np.clip((d - 40) / 130, 0.05, 1)
    alpha = np.where(edge, a, alpha)
    a3 = np.maximum(alpha, 0.05)[..., None]
    rgb = np.where(edge[..., None], np.clip((im - bg * (1 - a3)) / a3, 0, 255), im)
    # Rest-Grün an der Kante dämpfen
    g_lim = np.maximum(rgb[..., 0], rgb[..., 2]) + 25
    rgb[..., 1] = np.where(edge, np.minimum(rgb[..., 1], g_lim), rgb[..., 1])
    # Schein und Säume nahe am Hintergrund (auch an Löchern): grellgrüne Beimischung entfernen,
    # dunkleres Grün (Blätter, grüne Haut) bleibt
    band = ~outside & dilate(outside, glow)
    mx_rb = np.maximum(rgb[..., 0], rgb[..., 2])
    spill = band & (rgb[..., 1] > (185 if glow < 10 else 150)) & (rgb[..., 1] > mx_rb + (35 if glow < 10 else 22))
    alpha = np.where(spill, np.minimum(alpha, np.clip((rgb[..., 1] - mx_rb) * -1 / 120 + 1, 0.15, 1)), alpha)
    rgb[..., 1] = np.where(spill, mx_rb + 12, rgb[..., 1])
    # sehr dünne grüne Säume ganz außen: nicht grüner als Rot/Blau
    rim = ~outside & dilate(outside, 1)
    rgb[..., 1] = np.where(rim, np.minimum(rgb[..., 1], np.maximum(rgb[..., 0], rgb[..., 2]) + 5), rgb[..., 1])
    return np.dstack([rgb, alpha * 255]), ~outside


def items(path):
    rgba, fg = key(path)
    res = []
    for n, p in labels(fg):
        if n < 1500:
            continue
        ys, xs = np.nonzero(p)
        res.append({'box': (int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1), 'mask': p, 'c': (xs.mean(), ys.mean())})
    # Lesereihenfolge; der Türkis-Dutt unten rechts (unter dem lila Zopf) zählt als letztes Teil
    res.sort(key=lambda r: (3 if r['box'][1] > 860 and r['box'][3] > 1000 else int(r['c'][1] // 341), r['c'][0]))
    return rgba, res


def crop_item(rgba, item, pad=6):
    """Teil ausschneiden (nur seine Pixel + kleine Glitzer in der Nähe)"""
    x0, y0, x1, y1 = item['box']
    x0, y0 = max(0, x0 - pad), max(0, y0 - pad)
    x1, y1 = min(rgba.shape[1], x1 + pad), min(rgba.shape[0], y1 + pad)
    c = rgba[y0:y1, x0:x1].copy()
    keep = dilate(item['mask'][y0:y1, x0:x1], 2)
    c[..., 3] *= keep
    return c, (x0, y0)


def to_img(arr):
    return Image.fromarray(np.clip(arr, 0, 255).round().astype(np.uint8), 'RGBA')


def place(arr, origin, box, fit):
    """Ausschnitt in den Rahmen setzen: fit = (Maßstab, x, y) der Teil-Ecke box[0:2]"""
    s, fx, fy = fit
    img = to_img(arr)
    w, h = img.size
    big = img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)
    ox = round(fx - (box[0] - origin[0]) * s)
    oy = round(fy - (box[1] - origin[1]) * s)
    frame = Image.new('RGBA', (OW, OH), (0, 0, 0, 0))
    frame.paste(big, (ox, oy), big)
    return frame


def undress(arr):
    """Grundfigur: T-Shirt und Shorts hautfarben übermalen, außen einen Umriss ziehen"""
    rgb, a = arr[..., :3], arr[..., 3] / 255
    hue, sat, val, mn, lum = hsv(rgb)
    solid = a > 0.6
    H, W = a.shape
    ys, xs = np.nonzero(solid)
    top, bot = ys.min(), ys.max()
    h = bot - top
    cx = int(np.median(xs[ys < top + h * 0.25]))
    outline = (lum < 75) & (sat < 0.65)
    # Haut: Unterschenkel
    legs = solid & ~outline & (np.arange(H)[:, None] > top + h * 0.84) & (np.arange(H)[:, None] < top + h * 0.93)
    skin_rgb = np.median(rgb[legs], axis=0)

    # Kleidungs-Zone (Hals bis Hosensaum) wird ganz Haut
    yy = np.arange(H)[:, None]
    zone = (yy > top + h * 0.40) & (yy < top + h * 0.845)
    paint = solid & zone  # (auch rosa Shirt auf rosa Haut) – die Zone liegt ohnehin unter dem Kleid
    out = arr.copy()
    out[paint, :3] = skin_rgb
    # Umriss neu: wo die übermalte Fläche an den Rand grenzt
    rim = paint & dilate(~solid, 2)
    out[rim, :3] = (70, 40, 38)
    out[rim, 3] = 255
    return out


def hand_center(body_frame):
    """Hand der Fee (vom Betrachter links): äußerster Punkt im Armbereich"""
    a = np.asarray(body_frame)[..., 3] > 128
    ys, xs = np.nonzero(a)
    top, bot = ys.min(), ys.max()
    band = (ys > top + (bot - top) * 0.45) & (ys < top + (bot - top) * 0.7)
    i = np.argmin(np.where(band, xs, 10 ** 6))
    return xs[i] + 7, ys[i] + 1


def wand_into_hand(arr, hand):
    """Zauberstab: Hauptachse bestimmen, auf WAND_LEN skalieren, schräg (Spitze nach außen) mit Griff in die Hand"""
    a = arr[..., 3] > 128
    ys, xs = np.nonzero(a)
    pts = np.stack([xs, ys], 1).astype(float)
    mean = pts.mean(0)
    _, _, vt = np.linalg.svd(pts - mean, full_matrices=False)
    u = vt[0]
    if u[1] > 0:
        u = -u  # Richtung nach oben (Spitze)
    proj = (pts - mean) @ u
    p_top, p_bot = proj.max(), proj.min()
    length = p_top - p_bot
    grip = mean + u * (p_top - WAND_GRIP * length)
    s = WAND_LEN / length
    tilt = math.radians(WAND_TILT)
    t = np.array([-math.sin(tilt), -math.cos(tilt)])
    theta = math.atan2(t[1], t[0]) - math.atan2(u[1], u[0])
    c, sn = math.cos(-theta), math.sin(-theta)
    # Ausgabe → Quelle: q = grip + R(-θ)·(p − hand)/s
    A = np.array([[c, -sn], [sn, c]]) / s
    off = np.array(grip) - A @ np.array(hand, float)
    img = to_img(arr)
    return img.transform((OW + 2 * WAND_PAD, OH + 2 * WAND_PAD), Image.AFFINE, (A[0, 0], A[0, 1], off[0], A[1, 0], A[1, 1], off[1]), resample=Image.BICUBIC)


def wing_right(rgba, box, kind, exclude_dark=False):
    """rechter Flügel aus einem Ausschnitt: (Bild, Wurzel-y relativ)"""
    x0, y0, x1, y1 = box
    c = rgba[y0:y1, x0:x1].copy()
    a = c[..., 3] > 128
    # nur der Flügel selbst (große Teile) und Glitzer daneben, keine Stückchen der Nachbarn am Rand
    keep = np.zeros_like(a)
    parts = labels(a)
    for n, part in parts:
        ys_, xs_ = np.nonzero(part)
        at_edge = xs_.min() == 0 or xs_.max() == a.shape[1] - 1
        if n >= parts[0][0] * 0.25 or (n < 150 and not at_edge):
            keep |= part
    c[..., 3] *= dilate(keep, 3)
    a = c[..., 3] > 128
    if exclude_dark:  # Nachbar-Flügel (Sternennacht) ragt in den Ausschnitt
        hue, sat, val, mn, lum = hsv(c[..., :3])
        dark = (val < 0.55) & (hue > 200) & (hue < 280)
        big = np.zeros_like(a)
        for n, part in labels(a & ~dilate(dark, 2)):
            if n > 300:
                big |= part
        c[..., 3] *= dilate(big, 2) & ~dark
        a = c[..., 3] > 128
    if kind == 'left':
        c = c[:, ::-1]
        a = a[:, ::-1]
        kind = 'right'
    if kind == 'pair':
        w = a.shape[1]
        cols = a.sum(0).astype(float)
        mid = slice(int(w * 0.35), int(w * 0.65))
        root = int(np.argmin(cols[mid])) + int(w * 0.35)
        c = c[:, root:]
        a = a[:, root:]
    # Wurzel-y: Schwerpunkt der Spalten nahe der Wurzel
    cols = a[:, : max(4, a.shape[1] // 8)]
    ry = np.nonzero(cols)[0].mean() if cols.any() else a.shape[0] / 2
    ys, xs = np.nonzero(a)
    c = c[ys.min(): ys.max() + 1, : xs.max() + 1]
    return to_img(c), (ry - ys.min()) / c.shape[0]


def save(img, name):
    img.save(os.path.join(OUT, name + '.png'), optimize=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    for f in os.listdir(OUT):
        if f.endswith('.png'):
            os.remove(os.path.join(OUT, f))
    meta = {'frame': {'w': round(OW * UNIT, 2), 'h': round(OH * UNIT, 2), 'ox': round(ANCHOR[0] / OW, 4), 'oy': round(ANCHOR[1] / OH, 4)},
            'head': HEAD, 'body': [], 'hair': [], 'dress': [], 'wand': [], 'wings': []}

    # Grundfiguren
    rgba, res = items(os.path.join(SRC, 'Feen Base.webp'))
    hand = None
    for i, (it, fit) in enumerate(zip(res, FIT['body']), start=1):
        arr, origin = crop_item(rgba, it)
        frame = place(undress(arr), origin, it['box'], fit)
        save(frame, f'body-{i}')
        if hand is None:
            hand = hand_center(frame)
        # Hand über dem Zauberstab (Finger liegen vorn)
        fa = np.asarray(frame).copy()
        yy, xx = np.mgrid[0:OH, 0:OW]
        fa[..., 3] = fa[..., 3] * (((xx - hand[0]) ** 2 + (yy - hand[1]) ** 2) <= 8.5 ** 2)
        save(Image.fromarray(fa), f'hand-{i}')
        meta['body'].append(i)

    # Gesichtsfeld unterhalb der Brauen (aus Grundfigur 1): dort liegen Haare hinter dem Gesicht
    ba = np.asarray(Image.open(os.path.join(OUT, 'body-1.png')))[..., 3] > 128
    facecut = np.zeros((OH, OW), bool)
    for y in range(FACE_ROWS[0], FACE_ROWS[1]):
        cols = np.nonzero(ba[y])[0]
        if len(cols):
            facecut[y, cols.min() + FACE_INSET: cols.max() - FACE_INSET + 1] = True

    for kind, fname in (('hair', 'Feen Frisuren.webp'), ('dress', 'Feen Kleider.webp')):
        rgba, res = items(os.path.join(SRC, fname))
        if kind == 'dress':
            res = [r for r in res if not (r['box'][1] > 640 and r['box'][3] < 790)]  # lila Rock
        for i, (it, fit) in enumerate(zip(res, FIT[kind]), start=1):
            arr, origin = crop_item(rgba, it)
            img = place(arr, origin, it['box'], fit)
            if kind == 'hair':
                a = np.asarray(img).copy()
                a[facecut, 3] = 0
                img = Image.fromarray(a)
            save(img, f'{kind}-{i}')
            meta[kind].append(i)

    rgba, res = items(os.path.join(SRC, 'Feen Zauberstäbe.webp'))
    for i, it in enumerate(res, start=1):
        arr, origin = crop_item(rgba, it, pad=14)
        # Glitzer um den Stab gehören dazu
        x0, y0, x1, y1 = it['box']
        arr = rgba[max(0, y0 - 14):y1 + 14, max(0, x0 - 14):x1 + 14].copy()
        save(wand_into_hand(arr, (hand[0] + WAND_PAD, hand[1] + WAND_PAD)), f'wand-{i}')
        meta['wand'].append({'id': i, 'h': round((OH + 2 * WAND_PAD) * UNIT, 2),
                             'ox': round((ANCHOR[0] + WAND_PAD) / (OW + 2 * WAND_PAD), 4),
                             'oy': round((ANCHOR[1] + WAND_PAD) / (OH + 2 * WAND_PAD), 4)})

    rgba, _ = key(os.path.join(SRC, 'Feen Flügel.webp'), glow=18)  # leuchtende Flügel: breiter Schein
    for i, (box, kind) in enumerate(WINGS, start=1):
        img, oy = wing_right(rgba, box, kind, exclude_dark=(i == 9))
        save(img, f'wing-{i}')
        meta['wings'].append({'id': i, 'h': round(img.height * WING_SCALE * UNIT, 2), 'ox': 0.03, 'oy': round(oy, 3)})

    meta['hand'] = [float(hand[0]), float(hand[1])]
    # Spitze des Zauberstabs relativ zum Ursprung (Spiel-Einheiten): dort hängt die Glitzerspur
    reach = WAND_LEN * WAND_GRIP
    tip = (hand[0] - math.sin(math.radians(WAND_TILT)) * reach, hand[1] - math.cos(math.radians(WAND_TILT)) * reach)
    meta['wandTip'] = [round((tip[0] - ANCHOR[0]) * UNIT, 2), round((tip[1] - ANCHOR[1]) * UNIT, 2)]
    # Ausschnitt jedes Bildes (für die Vorschau im Menü: nur das Teil, ohne leeren Rand)
    meta['boxes'] = {}
    for f in sorted(os.listdir(OUT)):
        if f.endswith('.png'):
            bb = Image.open(os.path.join(OUT, f)).getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox()
            if bb:
                meta['boxes'][f[:-4]] = list(bb)
    with open(OUT_JSON, 'w', encoding='utf-8') as f:
        json.dump(meta, f, indent=1)
    print({k: (len(v) if isinstance(v, list) else v) for k, v in meta.items()})

    if '--preview' in sys.argv:
        path = sys.argv[sys.argv.index('--preview') + 1]
        tiles = []
        for n in range(1, 10):
            im = Image.open(os.path.join(OUT, f'body-{n}.png')).copy()
            big = Image.new('RGBA', (OW + 2 * WAND_PAD, OH + 2 * WAND_PAD), (0, 0, 0, 0))
            big.alpha_composite(im, (WAND_PAD, WAND_PAD))
            for k in (f'dress-{n}', f'wand-{n}', f'hand-{n}', f'hair-{n}'):
                part = Image.open(os.path.join(OUT, k + '.png'))
                big.alpha_composite(part, (0, 0) if k.startswith('wand') else (WAND_PAD, WAND_PAD))
            tiles.append(big)
        tw = OW + WAND_PAD
        sheet = Image.new('RGBA', (tw * 9 + WAND_PAD, OH + WAND_PAD), (250, 240, 225, 255))
        for i, t in enumerate(tiles):
            sheet.alpha_composite(t, (i * tw, 0), (0, 0, t.width, OH + WAND_PAD))
        sheet.save(path)


if __name__ == '__main__':
    main()
