"""Hilfsfunktionen für tools/import-fairy-parts.py: Freistellen, Flutfüllung, Masken."""
from collections import deque

import numpy as np


def hsv(im):
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    mx = im.max(axis=2)
    mn = im.min(axis=2)
    d = np.maximum(mx - mn, 1e-3)
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) * 60
    hue = np.where(mx - mn < 1, 0, hue)
    sat = (mx - mn) / np.maximum(mx, 1)
    return hue, sat, mx / 255, mn, 0.299 * r + 0.587 * g + 0.114 * b


def flood(mask, seeds):
    """alle über mask erreichbaren Pixel ab seeds (4er-Nachbarschaft)"""
    H, W = mask.shape
    out = np.zeros_like(mask)
    q = deque()
    for y, x in seeds:
        if mask[y, x] and not out[y, x]:
            out[y, x] = True
            q.append((y, x))
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < H and 0 <= nx < W and mask[ny, nx] and not out[ny, nx]:
                out[ny, nx] = True
                q.append((ny, nx))
    return out


def labels(mask):
    """zusammenhängende Teile: Liste von (Größe, Maske), größte zuerst"""
    seen = np.zeros_like(mask)
    parts = []
    for y, x in zip(*np.nonzero(mask)):
        if seen[y, x]:
            continue
        part = flood(mask & ~seen, [(y, x)])
        seen |= part
        parts.append((int(part.sum()), part))
    parts.sort(key=lambda p: -p[0])
    return parts


def shift(m, dy, dx):
    out = np.zeros_like(m)
    H, W = m.shape
    out[max(dy, 0):H + min(dy, 0), max(dx, 0):W + min(dx, 0)] = m[max(-dy, 0):H + min(-dy, 0), max(-dx, 0):W + min(-dx, 0)]
    return out


def dilate(m, r=1):
    out = m.copy()
    for _ in range(r):
        o = out.copy()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            o |= shift(out, dy, dx)
        out = o
    return out


def erode(m, r=1):
    return ~dilate(~m, r)


def close(m, r=1):
    return erode(dilate(m, r), r)


def fill_holes(m):
    """Löcher in einer Maske schließen (alles, was vom Rand aus nicht erreichbar ist)"""
    H, W = m.shape
    border = [(0, x) for x in range(W)] + [(H - 1, x) for x in range(W)] + [(y, 0) for y in range(H)] + [(y, W - 1) for y in range(H)]
    return ~flood(~m, border)


def cutout(im, outline_lum=62, white=205):
    """Weißen Hintergrund entfernen: gibt (rgb, alpha, inside) zurück.
    white = ab welcher Helligkeit (kleinster Farbkanal) ein Pixel Hintergrund sein darf; hoch für helle Haare"""
    hue, sat, val, mn, lum = hsv(im)
    H, W = mn.shape
    outline = lum < outline_lum
    halo = (hue > 38) & (hue < 70) & (val > 0.9) & (sat > 0.25)
    border = [(0, x) for x in range(W)] + [(H - 1, x) for x in range(W)] + [(y, 0) for y in range(H)] + [(y, W - 1) for y in range(H)]
    outside = flood(~outline & ((mn > white) | halo), border)
    inside = ~outside
    if white > 205:
        # Kante: helle Säume direkt am Hintergrund werden auch durchscheinend
        edge = inside & ~erode(inside, 2) & (mn > 205)
        inside = inside & ~edge
    alpha = np.clip(np.where(inside, 1.0, (255 - mn) / 255), 0, 1)
    a3 = np.maximum(alpha, 1e-3)[..., None]
    rgb = np.clip(np.where(inside[..., None], im, (im - 255 * (1 - a3)) / a3), 0, 255)
    alpha = np.where(alpha < 0.04, 0, alpha)
    return rgb, alpha, inside


def local_std(a, r=4):
    """Standardabweichung im (2r+1)²-Fenster (glatte Haut ↔ Haare mit Strähnen)"""
    def box(x):
        p = np.pad(x, r + 1, mode='edge')
        c = p.cumsum(0).cumsum(1)
        k = 2 * r + 1
        return (c[k:, k:] - c[:-k, k:] - c[k:, :-k] + c[:-k, :-k])[: x.shape[0], : x.shape[1]] / (k * k)
    m = box(a)
    return np.sqrt(np.maximum(box(a * a) - m * m, 0))
