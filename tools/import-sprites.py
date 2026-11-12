"""Gezeichnete Sprites (Lieferungen scenario-assets1, scenario-assets2, …) ins Spiel übernehmen.

    python tools/import-sprites.py <Ordner Lieferung 1> [<Ordner Lieferung 2> …] [Baumkrone.webp] [Baumrinde.webp] [Rasen.webp]

Jede Lieferung hat unten ihre eigene Zuordnung "Datei → Gegenstand" (die Dateinamen wiederholen sich).

- entfernt den halbtransparenten Schleier/Schein um die Motive (weiche Kanten bleiben)
- schneidet auf das Motiv zu und verkleinert auf höchstens 512 px (Rahmen: 1024)
- setzt inkonsistente Teile zusammen (Kräutertopf-Stufen auf einen Topf, aufgeschlagenes Buch auf den Stapel)
- vermisst die Zimmerrahmen (Innenform, Schnittkanten zum Dehnen) → src/config/frames.json

Ausgabe: public/assets/sprites/*.png, public/assets/frames/*.png, src/config/frames.json, src/config/sprites.json
"""
import json
import os
import sys
from collections import deque

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

SRC = None  # aktueller Quellordner (siehe Ablauf unten)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_SPRITES = os.path.join(ROOT, 'public', 'assets', 'sprites')
OUT_FRAMES = os.path.join(ROOT, 'public', 'assets', 'frames')
os.makedirs(OUT_SPRITES, exist_ok=True)
os.makedirs(OUT_FRAMES, exist_ok=True)

# Lieferung 1: Quelldatei → Name im Spiel
SPRITES = {
    'Wald_neu.png': 'buecher',
    'Wald_neu-2.png': 'kessel',
    'Wald_neu-3.png': 'kleiderschrank',
    'Wald_neu-14.png': 'kleiderschrank@open',
    'Wald_neu-6.png': 'bett',
    'Wald_neu-7.png': 'obstschale',
    'Wald_neu-9.png': 'blaetter',
    'Wald_neu-8.png': 'blaetter@a1',
    'Wald_neu-11.png': 'haengepflanze',
    'Wald_neu-12.png': 'haengeregal',
    'Wald_neu-13.png': 'haengesessel',
    'Wald_neu-17.png': 'nachtlicht',
    'Wald_neu-18.png': 'regal',
    'Wald_neu-19.png': 'sessel',
    'Wald_neu-20.png': 'stehpflanze',
    'Wald_neu-21.png': 'tisch',
    'Wald_neu-26.png': 'tafel',
    'Wald_neu-27.png': 'baum',
}
FRAMES = {'Wald_neu-23.png': 'rect', 'Wald_neu-22.png': 'arch', 'Wald_neu-24.png': 'dome', 'Wald_neu-25.png': 'gable'}


def load(name):
    return Image.open(os.path.join(SRC, name)).convert('RGBA')


def clean(im, keep=100, grow=7):
    """Schleier entfernen: nur, was nah an kräftig deckenden Pixeln liegt, bleibt (mit Originalkante)."""
    a = im.split()[3]
    core = a.point(lambda v: 255 if v > keep else 0)
    near = core.filter(ImageFilter.MaxFilter(grow))
    out = im.copy()
    out.putalpha(Image.composite(a, Image.new('L', a.size, 0), near))
    return out


def crop(im, pad=4):
    bb = im.split()[3].point(lambda v: 255 if v > 8 else 0).getbbox()
    x0, y0, x1, y1 = bb
    return im.crop((max(0, x0 - pad), max(0, y0 - pad), min(im.width, x1 + pad), min(im.height, y1 + pad)))


def limit(im, size=512):
    s = min(1.0, size / max(im.size))
    return im if s == 1 else im.resize((round(im.width * s), round(im.height * s)), Image.LANCZOS)


def save(im, name, folder=OUT_SPRITES):
    im.save(os.path.join(folder, name.replace('@', '_') + '.png'))



# ---------------------------------------------------------------- Hilfen für Zusammensetzungen
def pot_split(im):
    """Zeile, an der der Topfrand beginnt: erste Zeile (von unten nach oben gesucht), ab der das Motiv deutlich schmaler wird."""
    a = im.split()[3]
    widths = []
    for y in range(im.height):
        row = [x for x in range(im.width) if a.getpixel((x, y)) > 100]
        widths.append((row[-1] - row[0]) if row else 0)
    # Topfrand = breiteste Zeile in der unteren Hälfte
    lower = range(im.height // 2, im.height)
    return max(lower, key=lambda y: widths[y])


def plant_on_pot(base, other):
    base = crop(clean(base), 0)
    other = crop(clean(other), 0)
    yb = pot_split(base)
    yo = pot_split(other)
    # Pflanzenteil von "other" (bis zum Topfrand) auf die Topfbreite von "base" skalieren
    a = base.split()[3]
    rb = [x for x in range(base.width) if a.getpixel((x, yb)) > 100]
    ao = other.split()[3]
    ro = [x for x in range(other.width) if ao.getpixel((x, yo)) > 100]
    s = (rb[-1] - rb[0]) / max(1, ro[-1] - ro[0])
    plant = other.crop((0, 0, other.width, yo + 6))
    plant = plant.resize((round(plant.width * s), round(plant.height * s)), Image.LANCZOS)
    pot = base.crop((0, yb - 6, base.width, base.height))
    w = max(pot.width, plant.width)
    h = plant.height + pot.height - 12
    out = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    cx_plant = (ro[0] + ro[-1]) / 2 * s
    cx_pot = (rb[0] + rb[-1]) / 2
    off = round(w / 2 - cx_pot)
    out.alpha_composite(plant, (round(off + cx_pot - cx_plant), 0))
    out.alpha_composite(pot, (off, plant.height - 12))
    return out


def interior_mask(im):
    """Innenfläche: von der Mitte aus alle durchsichtigen Pixel (Flutfüllung)."""
    w, h = im.size
    a = im.split()[3].load()
    seen = bytearray(w * h)
    q = deque([(w // 2, h // 2)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x] or a[x, y] > 60:
            continue
        seen[y * w + x] = 1
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    return seen


def profiles(seen, w, h):
    top, bottom = [None] * w, [None] * w
    for x in range(w):
        ys = [y for y in range(h) if seen[y * w + x]]
        if ys:
            top[x], bottom[x] = ys[0], ys[-1]
    return top, bottom


def dilate(seen, w, h, r):
    img = Image.frombytes('L', (w, h), bytes(v * 255 for v in seen)).filter(ImageFilter.MaxFilter(r * 2 + 1))
    return bytearray(1 if v else 0 for v in img.tobytes())



# ================================================================ Lieferung 1: Möbel, Deko, Rahmen, Baum
def delivery_1():
    global frames
    for src, name in SPRITES.items():
        save(limit(crop(clean(load(src)))), name)


    # Kräuter: drei Stufen (3, 2, 1 Pflanze) auf demselben Topf aus Wald_neu-4
    herbs = load('Wald_neu-4.png')
    save(limit(crop(clean(herbs))), 'kraeuter')
    save(limit(crop(plant_on_pot(herbs, load('Wald_neu-16.png')))), 'kraeuter@a2')
    save(limit(crop(plant_on_pot(herbs, load('Wald_neu-15.png')))), 'kraeuter@a1')

    # Bücher aufgeschlagen: aufgeschlagenes Buch (oberer Teil von Wald_neu-10) auf die zwei unteren Bücher des Stapels
    stack = crop(clean(load('Wald_neu.png')), 0)
    openb = crop(clean(load('Wald_neu-10.png')), 0)
    book_h = stack.height / 3
    lower2 = stack.crop((0, round(book_h), stack.width, stack.height))
    top_open = openb.crop((0, 0, openb.width, round(openb.height * 0.52)))
    s = stack.width / openb.width
    top_open = top_open.resize((round(top_open.width * s), round(top_open.height * s)), Image.LANCZOS)
    comp = Image.new('RGBA', (max(lower2.width, top_open.width), lower2.height + top_open.height - 10), (0, 0, 0, 0))
    comp.alpha_composite(lower2, (0, top_open.height - 10))
    comp.alpha_composite(top_open, (0, 0))
    save(limit(crop(comp)), 'buecher@open')

    # Nachtlicht an: wärmer und heller
    lamp = limit(crop(clean(load('Wald_neu-17.png'))))
    on = ImageEnhance.Brightness(lamp).enhance(1.25)
    r, g, b, a = on.split()
    on = Image.merge('RGBA', (r.point(lambda v: min(255, v + 25)), g.point(lambda v: min(255, v + 15)), b, a))
    save(on, 'nachtlicht@on')


    frames = {}
    for src, shape in FRAMES.items():
        im = crop(clean(load(src)), 0)
        w, h = im.size
        seen = interior_mask(im)
        top, bottom = profiles(seen, w, h)
        ftop, fbottom = profiles(dilate(seen, w, h, 8), w, h)
        xs = [x for x in range(w) if top[x] is not None]
        il, ir = xs[0], xs[-1]
        inner_bottom = max(b for b in bottom if b is not None)
        flat = min(t for t in top if t is not None)
        # Schnittkanten zum Dehnen (nur Kammer und Rundbogen; Kuppel und Giebel werden ganz gestreckt)
        a = im.split()[3]
        outer_top = [next((y for y in range(h) if a.getpixel((x, y)) > 100), h) for x in range(w)]
        outer_bot = [next((y for y in range(h - 1, -1, -1) if a.getpixel((x, y)) > 100), 0) for x in range(w)]
        if shape in ('rect', 'arch'):
            corner_l = next(x for x in xs if top[x] <= flat + 3)
            corner_r = next(x for x in reversed(xs) if top[x] <= flat + 3)
            mid = sorted(outer_top[corner_l:corner_r])[len(outer_top[corner_l:corner_r]) // 2]
            gem = [x for x in range(corner_l, corner_r) if outer_top[x] < mid - 6]
            midb = sorted(outer_bot[corner_l:corner_r])[len(outer_bot[corner_l:corner_r]) // 2]
            gem += [x for x in range(corner_l, corner_r) if outer_bot[x] > midb + 6]
            g0, g1 = (min(gem) - 10, max(gem) + 10) if gem else (w // 2 - 20, w // 2 + 20)
            cl, cr = corner_l + 12, corner_r - 12
            cols = [0, cl, g0, g1, cr, w]
            fixed_x = [True, False, True, False, True]
            rt = max(top[cl], top[cr]) + 10
            rb = inner_bottom - 30
            rows = [0, rt, rb, h]
            fixed_y = [True, False, True]
        else:
            cols, fixed_x, rows, fixed_y = [0, w], [False], [0, h], [False]
        # Randdicke (für die Skalierung der festen Teile): seitlich, an der breitesten Stelle der Innenfläche
        side = il
        im.save(os.path.join(OUT_FRAMES, f'{shape}.png'))
        frames[shape] = {
            'w': w, 'h': h,
            'cols': cols, 'fixedX': fixed_x, 'rows': rows, 'fixedY': fixed_y,
            'side': side, 'innerL': il, 'innerR': ir, 'innerBottom': inner_bottom,
            'top': top, 'fillTop': ftop, 'fillBottom': fbottom,
        }
        print(shape, 'size', (w, h), 'inner', (il, ir, flat, inner_bottom), 'cols', cols, 'rows', rows)



# ================================================================ Lieferung 2: Küche
KITCHEN = {
    'Wald_neu-5.png': 'haengeschrank',
    'Wald_neu-7.png': 'ofen',
    'Wald_neu-9.png': 'unterschrank',
    'Wald_neu-10.png': 'vorratsregal',
    'Wald_neu-11.png': 'wandleiste',
}


def delivery_2():
    for src, name in KITCHEN.items():
        save(limit(crop(clean(load(src)))), name)
    # Ofen an: brauner Ofen (-7) mit dem glühenden Sichtfenster des hellen Ofens (-8), damit er nicht die Farbe wechselt
    off = crop(clean(load('Wald_neu-7.png')), 0)
    glow = crop(clean(load('Wald_neu-8.png')), 0)
    box = lambda im, x0, y0, x1, y1: (round(im.width * x0), round(im.height * y0), round(im.width * x1), round(im.height * y1))
    dst = box(off, 0.255, 0.405, 0.765, 0.675)
    win = glow.crop(box(glow, 0.275, 0.405, 0.725, 0.665)).resize((dst[2] - dst[0], dst[3] - dst[1]), Image.LANCZOS)
    mask = Image.new('L', win.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, win.width - 1, win.height - 1), radius=round(win.height * 0.14), fill=255)
    on = off.copy()
    on.paste(win, dst[:2], mask)
    save(limit(crop(on)), 'ofen@on')


# ================================================================ Baum: Kronenstücke und Rinde (einzelne Bilder mit weißem Hintergrund)
OUT_TREE = os.path.join(ROOT, 'public', 'assets', 'tree')


def white_to_alpha(im, tol=228):
    """Weißen Hintergrund vom Rand her freistellen (Flutfüllung), Kante leicht weichzeichnen."""
    im = im.convert('RGBA')
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque([(x, 0) for x in range(w)] + [(x, h - 1) for x in range(w)] + [(0, y) for y in range(h)] + [(w - 1, y) for y in range(h)])
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h or seen[y * w + x]:
            continue
        r, g, b, _ = px[x, y]
        if min(r, g, b) < tol:
            continue
        seen[y * w + x] = 1
        q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
    alpha = Image.frombytes('L', (w, h), bytes(0 if v else 255 for v in seen)).filter(ImageFilter.GaussianBlur(0.8))
    im.putalpha(alpha)
    return im


def components(alpha, min_area):
    """Zusammenhängende Flächen (Pixel mit Deckkraft). Rückgabe: Liste (Rechteck, Nummer), Beschriftungsfeld, Zuordnung.
    Kleine Reste (z. B. abgerissene Kristall-Schnüre) werden dem nächsten großen Stück zugeschlagen."""
    w, h = alpha.size
    a = alpha.load()
    label = [0] * (w * h)
    comps = []  # (Anzahl, Rechteck)
    for sy in range(h):
        for sx in range(w):
            if label[sy * w + sx] or a[sx, sy] < 128:
                continue
            k = len(comps) + 1
            q = deque([(sx, sy)])
            x0 = x1 = sx
            y0 = y1 = sy
            n = 0
            while q:
                x, y = q.popleft()
                if x < 0 or y < 0 or x >= w or y >= h or label[y * w + x] or a[x, y] < 128:
                    continue
                label[y * w + x] = k
                n += 1
                x0, x1, y0, y1 = min(x0, x), max(x1, x), min(y0, y), max(y1, y)
                q.extend(((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)))
            comps.append((n, [x0, y0, x1 + 1, y1 + 1]))
    big = [i for i, (n, _) in enumerate(comps) if n >= min_area]
    owner = {i + 1: i + 1 for i in range(len(comps))}
    for i, (n, b) in enumerate(comps):
        if n >= min_area or not big:
            continue
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        j = min(big, key=lambda k: abs((comps[k][1][0] + comps[k][1][2]) / 2 - cx) + abs((comps[k][1][1] + comps[k][1][3]) / 2 - cy))
        owner[i + 1] = j + 1
        B = comps[j][1]
        comps[j] = (comps[j][0], [min(B[0], b[0]), min(B[1], b[1]), max(B[2], b[2]), max(B[3], b[3])])
    return [(tuple(comps[i][1]), i + 1) for i in big], label, owner


def seamless(tile):
    """Rindenfläche nahtlos machen: 2×2 gespiegelt. Die Maserung läuft senkrecht, gespiegelte Kanten passen
    deshalb lückenlos aneinander – ohne Überblenden, also ohne Unschärfe."""
    n = tile.width
    out = Image.new('RGB', (n * 2, n * 2))
    out.paste(tile, (0, 0))
    out.paste(tile.transpose(Image.FLIP_LEFT_RIGHT), (n, 0))
    out.paste(tile.transpose(Image.FLIP_TOP_BOTTOM), (0, n))
    out.paste(tile.transpose(Image.ROTATE_180), (n, n))
    return out


def tree_crowns(path):
    os.makedirs(OUT_TREE, exist_ok=True)
    im = white_to_alpha(Image.open(path))
    alpha = im.split()[3]
    pieces, label, owner = components(alpha, 20000)
    pieces.sort(key=lambda p: (p[0][1] // 200, p[0][0]))
    w = im.width
    for i, (box, k) in enumerate(pieces, 1):
        # Maske: nur Pixel, die zu diesem Stück gehören (+ Saum für die weiche Kante)
        mine = Image.new('L', im.size, 0)
        mp = mine.load()
        for y in range(box[1], box[3]):
            row = y * w
            for x in range(box[0], box[2]):
                if owner.get(label[row + x]) == k:
                    mp[x, y] = 255
        mine = mine.filter(ImageFilter.MaxFilter(5))
        piece = im.copy()
        piece.putalpha(Image.composite(alpha, Image.new('L', im.size, 0), mine))
        limit(crop(piece.crop(box)), 512).save(os.path.join(OUT_TREE, f'krone-{i}.png'))
    print('Kronenstücke:', len(pieces))
    return len(pieces)


def seamless_x(tile):
    """Nur seitlich nahtlos (für Gras: Halme müssen nach oben zeigen, also nicht nach unten spiegeln)."""
    n = tile.width
    out = Image.new('RGB', (n * 2, tile.height))
    out.paste(tile, (0, 0))
    out.paste(tile.transpose(Image.FLIP_LEFT_RIGHT), (n, 0))
    return out


def tree_bark(path, prefix='rinde', make=None):
    make = make or seamless
    os.makedirs(OUT_TREE, exist_ok=True)
    im = Image.open(path).convert('RGB')
    a = im.convert('L').point(lambda v: 255 if v < 225 else 0)
    boxes = [box for box, _ in components(a, 50000)[0]]
    boxes.sort(key=lambda b: (b[1] // 200, b[0]))
    for i, (x0, y0, x1, y1) in enumerate(boxes, 1):
        s = min(x1 - x0, y1 - y0) - 16  # ein Stück nach innen, damit kein weißer Rand bleibt
        tile = im.crop((x0 + 8, y0 + 8, x0 + 8 + s, y0 + 8 + s)).resize((384, 384), Image.LANCZOS)
        make(tile).save(os.path.join(OUT_TREE, f'{prefix}-{i}.png'))
    print(f'{prefix}:', len(boxes))
    return len(boxes)


TREE_FILES = {
    'Baumkrone.webp': tree_crowns,
    'Baumrinde.webp': tree_bark,
    'Rasen.webp': lambda path: tree_bark(path, 'rasen', seamless_x),  # Wiese: nur seitlich gespiegelt (eine Kachel hoch)
}
tree_counts = {}


# ================================================================ Lieferung 3: Bibliothek
LIBRARY = {
    'Wald_neu.png': 'buecherregal',
    'Wald_neu-2.png': 'leselampe',
    'Wald_neu-5.png': 'schreibtisch',  # (-4 ist die ältere Fassung mit niedrigem Hocker)
}


def delivery_3():
    for src, name in LIBRARY.items():
        save(limit(crop(clean(load(src)))), name)
    # Leselampe an: dieselbe grüne Lampe (die helle -3 hat einen anderen Schirm), Schirm leuchtet warm
    lamp = crop(clean(load('Wald_neu-2.png')), 0)
    w, h = lamp.size
    glow = ImageEnhance.Brightness(lamp).enhance(1.35)
    r, g, b, a = glow.split()
    glow = Image.merge('RGBA', (r.point(lambda v: min(255, v + 45)), g.point(lambda v: min(255, v + 30)), b, a))
    shade = Image.new('L', lamp.size, 0)
    ImageDraw.Draw(shade).rectangle((round(w * 0.45), 0, w, round(h * 0.45)), fill=255)
    shade = shade.filter(ImageFilter.GaussianBlur(12))
    on = Image.composite(glow, lamp, shade)
    save(limit(crop(on)), 'leselampe@on')


# ================================================================ Ablauf
DELIVERIES = {'scenario-assets1': delivery_1, 'scenario-assets2': delivery_2, 'scenario-assets3': delivery_3}
frames = None
for SRC in sys.argv[1:]:
    base = os.path.basename(os.path.normpath(SRC))
    if base in TREE_FILES:
        print('Baum', base)
        tree_counts[base] = TREE_FILES[base](SRC)
        continue
    if base not in DELIVERIES:
        raise SystemExit(f'Unbekannte Lieferung: {base} (bekannt: {list(DELIVERIES)})')
    print('Lieferung', base)
    DELIVERIES[base]()

if frames is not None:
    with open(os.path.join(ROOT, 'src', 'config', 'frames.json'), 'w') as f:
        json.dump(frames, f, separators=(',', ':'))
# Baumteile: Anzahl Kronenstücke und Rinden (das Spiel lädt krone-1…n, rinde-1…n)
if os.path.isdir(OUT_TREE):
    tree = {
        'krone': len([n for n in os.listdir(OUT_TREE) if n.startswith('krone-')]),
        'rinde': len([n for n in os.listdir(OUT_TREE) if n.startswith('rinde-')]),
        'rasen': len([n for n in os.listdir(OUT_TREE) if n.startswith('rasen-')]),
    }
    with open(os.path.join(ROOT, 'src', 'config', 'tree.json'), 'w') as f:
        json.dump(tree, f)
# Liste der vorhandenen Bilder (das Spiel lädt nur diese)
names = sorted(n[:-4] for n in os.listdir(OUT_SPRITES) if n.endswith('.png'))
with open(os.path.join(ROOT, 'src', 'config', 'sprites.json'), 'w') as f:
    json.dump(names, f)
print('fertig')
