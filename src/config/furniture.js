// Einrichtungsgegenstände. Maße in Rasterzellen (CELL px im Innenraum).
//   kind 'floor' – steht auf dem Boden, belegt eine Bodenbreite (Kessel, Regal, Tisch, Sessel)
//   kind 'wall'  – hängt an der Wand, frei in der Höhe (Tafel, Hängeregal)
//   kind 'small' – kleines Ding, steht auf dem Boden ODER auf einer Ablage (surfaces) eines Möbels
// surfaces: Ablagen, y = Höhe in Zellen über der Unterkante, x0..x1 = Bereich in Zellen
// draw(g, W, H, v): zeichnet in ein W×H-Rechteck, Ursprung oben links → Textur (BootScene)
// sprite: gemaltes Bild aus public/assets/sprites (tools/import-sprites.py) statt Zeichnung;
//   Zustände nutzen '<sprite>_<zustand>.png', falls vorhanden (spriteStates kann das umbenennen).
//   Das Bild wird unten bündig in das Rasterfeld eingepasst (spriteAlign 'top': oben bündig, z. B. Wandbrett;
//   spriteSize: feste Größe in px, z. B. um ein Möbel etwas breiter zu ziehen).
// states: weitere Zeichnungen für Zustände (Buch offen, Vorrat fast leer …)
// Zusatzrollen für die Feen:
//   ingredient: Farbe der Zutat, piece: Textur des Stücks, das die Fee mitnimmt, portions: Vorrat
//   glass: kann mit Zaubertrank gefüllt werden; liquid(g, color, alpha) zeichnet die Füllung
//   soft: weicher Sitzplatz (Lieblingsort zum Lesen), board: Schreibfläche der Tafel

import { fillStar } from '../systems/draw.js';

export const CELL = 80;
export const STICKER_PAD = 10;

const GLASS = 0x7fb0d0; // Glaskante: kräftig genug für helle Wände
const TUB_EMPTY = 0xf1e6d6; // Innenfarbe der leeren Badewanne (übermalt das gemalte Wasser)

function glassStyle(g) {
  g.fillStyle(0xffffff, 0.55);
  g.lineStyle(4, GLASS, 1);
}

// ---- Zutaten (n = verbleibende Portionen 1..3) ----

function drawHerbs(g, n) {
  const sprigs = { 1: [40], 2: [32, 48], 3: [27, 40, 53] }[n];
  for (const x of sprigs) {
    g.lineStyle(3, 0x3f8a4c, 1);
    g.lineBetween(x, 50, x + (x - 40) * 0.3, 12);
    g.fillStyle(0x6fdc8c, 1);
    g.fillEllipse(x - 6, 36, 13, 8);
    g.fillEllipse(x + 6, 26, 13, 8);
    g.fillEllipse(x - 5, 17, 11, 7);
  }
  g.fillStyle(0xd9824f, 1);
  g.fillPoints([{ x: 20, y: 52 }, { x: 60, y: 52 }, { x: 55, y: 78 }, { x: 25, y: 78 }], true);
  g.fillStyle(0xc06b3c, 1);
  g.fillRoundedRect(16, 46, 48, 10, 3);
}

function drawLeaves(g, n) {
  const leaves = [
    [26, 40, 0xffb347], [44, 36, 0xff8c5a], [56, 42, 0xffd166],
    [34, 30, 0xff8c5a], [50, 28, 0xffb347], [40, 22, 0xffd166],
  ].slice(0, n * 2);
  for (const [x, y, c] of leaves) {
    g.fillStyle(c, 1);
    g.fillEllipse(x, y, 20, 12);
  }
  g.fillStyle(0xc4935a, 1);
  g.fillRoundedRect(8, 46, 64, 30, 9);
  g.lineStyle(2, 0xa0743f, 1);
  for (let x = 18; x < 70; x += 12) g.lineBetween(x, 48, x, 74);
  g.lineBetween(10, 60, 70, 60);
}

function drawMoonwater(g, n) {
  glassStyle(g);
  g.fillRoundedRect(16, 16, 48, 62, 12);
  const h = (50 * n) / 3;
  g.fillStyle(0x5fd3ff, 0.95);
  g.fillRoundedRect(20, 74 - h, 40, h, 9);
  g.lineStyle(3, GLASS, 1);
  g.strokeRoundedRect(16, 16, 48, 62, 12);
  g.fillStyle(0x9b7bff, 1);
  g.fillRoundedRect(20, 6, 40, 13, 4);
  g.fillStyle(0xfff3a8, 1);
  fillStar(g, 40, 76 - h / 2, 7, 3, 5);
}


// ---- Pflanzen ----

// Blatt als Vieleck: von (x, y) aus in Richtung ang (Bogenmaß), Länge len, Breite w
function leaf(g, x, y, len, w, ang, color) {
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    const r = Math.sin(t * Math.PI) * w * 0.5;
    pts.push({ x: x + Math.cos(ang) * len * t - Math.sin(ang) * r, y: y + Math.sin(ang) * len * t + Math.cos(ang) * r });
  }
  for (let i = 7; i >= 1; i--) {
    const t = i / 8;
    const r = Math.sin(t * Math.PI) * w * 0.5;
    pts.push({ x: x + Math.cos(ang) * len * t + Math.sin(ang) * r, y: y + Math.sin(ang) * len * t - Math.cos(ang) * r });
  }
  g.fillStyle(color, 1);
  g.fillPoints(pts, true);
  g.lineStyle(2, 0x3f8a4c, 0.6);
  g.lineBetween(x, y, x + Math.cos(ang) * len * 0.85, y + Math.sin(ang) * len * 0.85);
}

function terracotta(g, x0, x1, top, bottom) {
  const inset = (x1 - x0) * 0.1;
  g.fillStyle(0xd9824f, 1);
  g.fillPoints([{ x: x0 + 4, y: top }, { x: x1 - 4, y: top }, { x: x1 - inset, y: bottom }, { x: x0 + inset, y: bottom }], true);
  g.fillStyle(0xc06b3c, 1);
  g.fillRoundedRect(x0, top - 8, x1 - x0, 14, 4);
}

// ---- Schrank ----

function drawWardrobe(g, open) {
  g.fillStyle(0x7d5236, 1);
  g.fillRect(16, 306, 16, 14);
  g.fillRect(128, 306, 16, 14);
  g.fillStyle(0x9c6a43, 1);
  g.fillRoundedRect(4, 18, 152, 292, 10);
  g.fillStyle(0xb07a50, 1);
  g.fillRoundedRect(0, 4, 160, 24, 8);
  if (!open) {
    g.fillStyle(0xc98b5a, 1);
    g.fillRoundedRect(14, 36, 64, 262, 8);
    g.fillRoundedRect(82, 36, 64, 262, 8);
    g.fillStyle(0xffd166, 1);
    fillStar(g, 46, 84, 12, 5, 5);
    fillStar(g, 114, 84, 12, 5, 5);
    g.fillCircle(70, 172, 6);
    g.fillCircle(90, 172, 6);
    return;
  }
  // offen: Kleider auf der Stange, daneben der weiße Schlafanzug
  g.fillStyle(0x5b3a26, 1);
  g.fillRect(16, 36, 128, 262);
  g.lineStyle(4, 0xd9b98a, 1);
  g.lineBetween(20, 60, 140, 60);
  const dresses = [[38, 0xff7ab8], [64, 0x9b7bff], [90, 0x5fd3ff]];
  for (const [x, c] of dresses) {
    g.lineStyle(3, 0xd9b98a, 1);
    g.lineBetween(x, 60, x, 70);
    g.fillStyle(c, 1);
    g.fillTriangle(x, 70, x - 16, 150, x + 16, 150);
  }
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(106, 70, 30, 80, 8);
  g.fillStyle(0xb9d8ff, 1);
  for (const [x, y] of [[114, 86], [128, 104], [116, 124], [128, 140]]) g.fillCircle(x, y, 3);
  g.fillStyle(0x7d5236, 1);
  g.fillRect(16, 200, 128, 8);
  // Türen weit auf (schmal am Rand)
  g.fillStyle(0xc98b5a, 1);
  g.fillPoints([{ x: 0, y: 30 }, { x: 14, y: 36 }, { x: 14, y: 298 }, { x: 0, y: 306 }], true);
  g.fillPoints([{ x: 160, y: 30 }, { x: 146, y: 36 }, { x: 146, y: 298 }, { x: 160, y: 306 }], true);
}

// ---- Nachtlicht (Pilzlampe) ----

function drawNightlight(g, on) {
  if (on) {
    g.fillStyle(0xfff3a8, 0.35);
    g.fillCircle(40, 40, 36);
  }
  g.fillStyle(0xfff4fb, 1);
  g.fillRoundedRect(31, 46, 18, 32, 6);
  g.fillStyle(on ? 0xffe08a : 0xff9ec7, 1);
  g.slice(40, 50, 32, Math.PI, 0, false);
  g.fillPath();
  g.fillStyle(0xffffff, on ? 1 : 0.85);
  for (const [x, y, r] of [[28, 36, 5], [44, 28, 4], [54, 40, 4], [36, 44, 3]]) g.fillCircle(x, y, r);
}


// ---- Bibliothek ----

function drawScrolls(g, open) {
  const paper = 0xf3e2b8;
  const edge = 0xd9bf86;
  if (open) {
    // aufgerollt: Blatt zwischen zwei Rollen
    g.fillStyle(paper, 1);
    g.fillRect(14, 34, 52, 38);
    g.lineStyle(2, 0xb08a5a, 0.8);
    for (let i = 0; i < 4; i++) g.lineBetween(20, 42 + i * 8, 58 - (i % 2) * 8, 42 + i * 8);
    g.fillStyle(edge, 1);
    g.fillRoundedRect(4, 30, 14, 46, 6);
    g.fillRoundedRect(62, 30, 14, 46, 6);
    g.fillStyle(0xe0566f, 1);
    g.fillCircle(40, 76, 4);
    return;
  }
  // zwei zusammengerollte Schriftrollen, gestapelt
  for (const [y, tie] of [[56, 0xe0566f], [34, 0x5fd3ff]]) {
    g.fillStyle(paper, 1);
    g.fillRoundedRect(8, y, 64, 22, 10);
    g.fillStyle(edge, 1);
    g.fillEllipse(10, y + 11, 10, 22);
    g.fillEllipse(70, y + 11, 10, 22);
    g.fillStyle(tie, 1);
    g.fillRect(36, y, 8, 22);
  }
}

function drawReadingLamp(g, on) {
  g.fillStyle(0x6b4128, 1);
  g.fillEllipse(30, 74, 40, 12);
  g.lineStyle(5, 0x9c6a43, 1);
  g.lineBetween(30, 72, 24, 40);
  g.lineBetween(24, 40, 46, 22);
  if (on) {
    g.fillStyle(0xfff3a8, 0.45);
    g.fillTriangle(48, 34, 30, 80, 76, 80);
  }
  g.fillStyle(on ? 0xffe08a : 0x5fd39a, 1);
  g.fillPoints([{ x: 36, y: 14 }, { x: 60, y: 10 }, { x: 70, y: 34 }, { x: 40, y: 38 }], true);
  g.fillStyle(on ? 0xffffff : 0xd8ffe8, 1);
  g.fillCircle(55, 34, 5);
}


// ---- Küche ----

function drawOven(g, on) {
  g.fillStyle(0x2a2440, 1);
  g.fillRect(14, 224, 22, 16);
  g.fillRect(204, 224, 22, 16);
  g.fillStyle(0x4a4060, 1);
  g.fillRoundedRect(6, 14, 228, 214, 16);
  g.fillStyle(0x3b3355, 1);
  g.fillRoundedRect(0, 0, 240, 20, 6);
  // Knöpfe
  g.fillStyle(0xffd166, 1);
  for (const x of [60, 100, 140, 180]) g.fillCircle(x, 50, 9);
  // Tür mit Sichtfenster
  g.fillStyle(0x2a2440, 1);
  g.fillRoundedRect(36, 80, 168, 124, 12);
  g.fillStyle(on ? 0xff9a3c : 0x1d1846, 1);
  g.fillRoundedRect(56, 100, 128, 70, 12);
  if (on) {
    g.fillStyle(0xffd166, 1);
    g.fillRoundedRect(70, 124, 100, 34, 10);
    g.fillStyle(0xfff3a8, 1);
    g.fillEllipse(120, 146, 60, 14);
  } else {
    g.fillStyle(0xffffff, 0.15);
    g.fillRect(64, 106, 30, 8);
  }
  g.fillStyle(0xffd166, 1);
  g.fillRoundedRect(76, 184, 88, 10, 5);
}

function drawPantry(g, W, H) {
  g.fillStyle(0x6b4128, 1);
  g.fillRect(10, 10, W - 20, H - 10);
  g.fillStyle(0x9c6a43, 1);
  g.fillRect(0, 0, 16, H);
  g.fillRect(W - 16, 0, 16, H);
  g.fillRoundedRect(-6, 0, W + 12, 18, 6);
  for (const y of [2, 4]) g.fillRect(0, H - y * CELL, W, 14);
  // unten: Mehlsäcke und eine Apfelkiste
  g.fillStyle(0xeee0c0, 1);
  g.fillRoundedRect(22, H - 112, 88, 104, 32);
  g.fillRoundedRect(112, H - 96, 76, 88, 28);
  g.fillStyle(0xc9b38a, 1);
  g.fillRect(52, H - 116, 28, 10);
  g.fillRect(136, H - 100, 26, 10);
  g.fillStyle(0xd9a066, 1);
  g.fillRect(200, H - 70, 104, 62);
  g.lineStyle(3, 0xb07a50, 1);
  g.lineBetween(200, H - 48, 304, H - 48);
  g.lineBetween(200, H - 26, 304, H - 26);
  g.fillStyle(0xe0566f, 1);
  for (const x of [214, 236, 258, 280, 296]) g.fillCircle(x, H - 76, 10);
}

function drawUtensilRail(g) {
  g.fillStyle(0xd9a066, 1);
  g.fillRoundedRect(6, 6, 228, 10, 5);
  g.fillStyle(0xb07a50, 1);
  g.fillCircle(10, 11, 7);
  g.fillCircle(230, 11, 7);
  const hook = (x) => {
    g.lineStyle(3, 0x8a7a6a, 1);
    g.lineBetween(x, 16, x, 24);
  };
  // Kelle
  hook(40);
  g.lineStyle(5, 0xb9c4d0, 1);
  g.lineBetween(40, 24, 40, 60);
  g.fillStyle(0xb9c4d0, 1);
  g.slice(40, 62, 13, 0, Math.PI, false);
  g.fillPath();
  // Kochlöffel
  hook(90);
  g.lineStyle(6, 0xd9a066, 1);
  g.lineBetween(90, 24, 90, 56);
  g.fillStyle(0xd9a066, 1);
  g.fillEllipse(90, 66, 18, 24);
  // Schneebesen
  hook(140);
  g.lineStyle(5, 0x9c6a43, 1);
  g.lineBetween(140, 24, 140, 42);
  g.lineStyle(2, 0xb9c4d0, 1);
  for (const w of [8, 14]) g.strokeEllipse(140, 58, w, 34);
  // Pfannenwender
  hook(190);
  g.lineStyle(6, 0x5fd39a, 1);
  g.lineBetween(190, 24, 190, 50);
  g.fillStyle(0xb9c4d0, 1);
  g.fillRoundedRect(178, 50, 24, 26, 4);
}

function drawBaseCabinet(g, W, H) {
  g.fillStyle(0x7d5236, 1);
  g.fillRect(10, H - 10, W - 20, 10);
  g.fillStyle(0xc98b5a, 1);
  g.fillRect(6, 18, W - 12, H - 28);
  g.fillStyle(0xd9a06a, 1);
  g.fillRoundedRect(16, 32, W / 2 - 22, H - 52, 8);
  g.fillRoundedRect(W / 2 + 6, 32, W / 2 - 22, H - 52, 8);
  g.fillStyle(0xffd166, 1);
  g.fillCircle(W / 2 - 18, 60, 6);
  g.fillCircle(W / 2 + 18, 60, 6);
  // Arbeitsplatte (Oberkante = Ablage)
  g.fillStyle(0xf2e6c9, 1);
  g.fillRoundedRect(0, 0, W, 20, 6);
  g.fillStyle(0xd9c7a0, 1);
  g.fillRect(4, 14, W - 8, 6);
}

function drawWallCabinet(g, W, H) {
  g.fillStyle(0xc98b5a, 1);
  g.fillRoundedRect(0, 0, W, H - 8, 10);
  g.fillStyle(0xd9a06a, 1);
  g.fillRoundedRect(10, 12, W / 2 - 16, H - 34, 8);
  g.fillRoundedRect(W / 2 + 6, 12, W / 2 - 16, H - 34, 8);
  g.fillStyle(0xff9ec7, 1);
  for (const x of [W / 4, (W * 3) / 4]) {
    g.fillCircle(x - 6, 50, 8);
    g.fillCircle(x + 6, 50, 8);
    g.fillTriangle(x - 14, 53, x + 14, 53, x, 70);
  }
  g.fillStyle(0xffd166, 1);
  g.fillCircle(W / 2 - 14, H - 34, 5);
  g.fillCircle(W / 2 + 14, H - 34, 5);
  g.fillStyle(0x9c6a43, 1);
  g.fillRect(0, H - 12, W, 12);
}

function drawSpices(g) {
  g.fillStyle(0x9c6a43, 1);
  g.fillRoundedRect(4, 70, 72, 10, 3);
  const jars = [[10, 38, 0xe0566f, 0xd9a066], [32, 30, 0xffd166, 0xb0503a], [54, 40, 0x5fd39a, 0x6b8a3a]];
  for (const [x, y, cap, fill] of jars) {
    g.fillStyle(0xffffff, 0.7);
    g.fillRoundedRect(x, y, 18, 72 - y, 5);
    g.fillStyle(fill, 1);
    g.fillRoundedRect(x + 2, y + (72 - y) * 0.4, 14, (72 - y) * 0.6 - 2, 4);
    g.fillStyle(cap, 1);
    g.fillRoundedRect(x - 1, y - 6, 20, 9, 3);
  }
}

function drawFruitBowl(g, n) {
  const fruits = [
    () => { g.fillStyle(0xe0566f, 1); g.fillCircle(28, 44, 13); g.fillStyle(0x5fb468, 1); g.fillEllipse(32, 30, 10, 6); },
    () => { g.fillStyle(0xffd166, 1); g.fillEllipse(48, 40, 22, 28); g.fillStyle(0x6b4128, 1); g.fillRect(47, 24, 3, 7); },
    () => { g.fillStyle(0x9b7bff, 1); for (const [x, y] of [[58, 46], [64, 40], [66, 50], [60, 54], [70, 46]]) g.fillCircle(x, y, 6); },
  ];
  fruits.slice(0, n).reverse().forEach((f) => f());
  g.fillStyle(0x8fd3ff, 1);
  g.slice(40, 52, 34, 0, Math.PI, false);
  g.fillPath();
  g.fillStyle(0xb9e6ff, 1);
  g.fillRect(6, 50, 68, 6);
}

function drawBread(g, n) {
  const len = [0, 26, 46, 64][n];
  g.fillStyle(0xd9a066, 1);
  g.fillEllipse(40 - (64 - len) / 2, 58, len, 34);
  g.lineStyle(3, 0xb07a50, 1);
  for (let i = 0; i < n + 1; i++) {
    const x = 40 - (64 - len) / 2 - len / 2 + 12 + i * 14;
    if (x < 40 - (64 - len) / 2 + len / 2 - 8) g.lineBetween(x, 48, x + 8, 62);
  }
  if (n < 3) {
    // angeschnitten: Scheibe daneben
    g.fillStyle(0xf2e6c9, 1);
    g.fillEllipse(66, 62, 16, 26);
    g.lineStyle(3, 0xd9a066, 1);
    g.strokeEllipse(66, 62, 16, 26);
  }
}

function drawCake(g, n) {
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(40, 70, 72, 16);
  // Kuchen von der Seite: Halbkreis, je gegessenem Stück fehlt ein Drittel
  g.fillStyle(0xd9a066, 1);
  g.slice(40, 60, 30, Math.PI, Math.PI + (n / 3) * Math.PI, false);
  g.fillPath();
  g.fillStyle(0xf2c27a, 1);
  g.slice(40, 58, 28, Math.PI, Math.PI + (n / 3) * Math.PI, false);
  g.fillPath();
  g.fillStyle(0xe0566f, 1);
  const cherries = [[24, 46], [40, 38], [56, 46]].slice(0, n);
  for (const [x, y] of cherries) g.fillCircle(x, y, 5);
}

const amountStates = (fn) => ({ a2: (g) => fn(g, 2), a1: (g) => fn(g, 1) });

// ---- Bücher ----

function drawBooks(g, withTop) {
  const books = [
    [6, 58, 68, 22, 0x5fd3ff],
    [12, 36, 60, 22, 0xffd166],
  ];
  if (withTop) books.push([4, 14, 66, 22, 0xff7ab8]);
  for (const [x, y, w, h, c] of books) {
    g.fillStyle(c, 1);
    g.fillRoundedRect(x, y, w, h, 4);
    g.fillStyle(0xffffff, 0.75);
    g.fillRect(x + w - 12, y + 3, 6, h - 6);
  }
}

export const FURNITURE = {
  // ======== Möbel ========
  kessel: {
    id: 'kessel',
    name: 'Kessel',
    sprite: 'kessel',
    kind: 'floor',
    w: 3,
    h: 3,
    liquidCenter: { x: 120, y: 40 },
    liquid(g, color, alpha = 1) {
      g.fillStyle(color, alpha);
      g.fillEllipse(120, 40, 190, 18);
      g.fillStyle(0xffffff, 0.35 * alpha);
      g.fillEllipse(84, 37, 66, 6);
    },
    draw(g) {
      g.fillStyle(0xff9a3c, 1);
      g.fillTriangle(66, 240, 92, 168, 118, 240);
      g.fillTriangle(104, 240, 130, 158, 156, 240);
      g.fillTriangle(142, 240, 166, 176, 190, 240);
      g.fillStyle(0xffd166, 1);
      g.fillTriangle(88, 240, 106, 200, 124, 240);
      g.fillTriangle(124, 240, 142, 196, 160, 240);
      g.fillStyle(0x2a2440, 1);
      g.fillRoundedRect(46, 186, 18, 50, 6);
      g.fillRoundedRect(176, 186, 18, 50, 6);
      g.fillStyle(0x3b3355, 1);
      g.fillEllipse(120, 138, 222, 150);
      g.fillStyle(0x51497a, 1);
      g.fillEllipse(84, 122, 70, 50);
      g.fillStyle(0x56507a, 1);
      g.fillEllipse(120, 72, 234, 46);
      g.fillStyle(0x2a2440, 1);
      g.fillEllipse(120, 72, 200, 26);
    },
  },

  regal: {
    id: 'regal',
    name: 'Regal',
    sprite: 'regal',
    spriteSize: { w: 320, h: 356 }, // etwas in die Breite gezogen: in jedes Fach passen drei Dinge
    kind: 'floor',
    w: 4,
    h: 5,
    surfaces: [
      { y: 1.11, x0: 0.5, x1: 3.5 },
      { y: 2.68, x0: 0.5, x1: 3.5 },
      { y: 4.36, x0: 0.5, x1: 3.5 },
    ],
    draw(g, W, H) {
      g.fillStyle(0x6b4128, 1);
      g.fillRect(10, 10, W - 20, H - 10);
      g.fillStyle(0x9c6a43, 1);
      g.fillRect(0, 0, 18, H);
      g.fillRect(W - 18, 0, 18, H);
      g.fillRoundedRect(-6, 0, W + 12, 18, 6);
      for (const y of [1, 3]) g.fillRect(0, H - y * CELL, W, 14);
      g.fillStyle(0xb07a50, 1);
      g.fillRoundedRect(20, H - 66, W - 40, 58, 8);
      g.fillStyle(0xffd166, 1);
      g.fillCircle(W / 2, H - 37, 8);
    },
  },

  tisch: {
    id: 'tisch',
    name: 'Tisch',
    sprite: 'tisch',
    kind: 'floor',
    w: 3,
    h: 2,
    surfaces: [{ y: 2, x0: 0, x1: 3 }],
    draw(g, W, H) {
      g.fillStyle(0x9c6a43, 1);
      g.fillRect(26, 20, 20, H - 20);
      g.fillRect(W - 46, 20, 20, H - 20);
      g.fillRect(26, 108, W - 52, 10);
      g.fillStyle(0xc98b5a, 1);
      g.fillRoundedRect(0, 0, W, 24, 8);
      g.fillStyle(0xa8774f, 1);
      g.fillRect(6, 18, W - 12, 6);
      g.fillStyle(0xff9ec7, 1);
      g.fillTriangle(70, 22, 170, 22, 120, 66);
      g.fillStyle(0xffffff, 0.8);
      g.fillCircle(120, 40, 5);
    },
  },

  bett: {
    id: 'bett',
    name: 'Bett',
    sprite: 'bett',
    pillow: { x: 90, y: 60 }, // hier liegt der Kopf der schlafenden Fee
    kind: 'floor',
    w: 4,
    h: 2,
    soft: true,
    surfaces: [{ y: 1.1, x0: 0, x1: 4 }], // Matratze (Lesen, Schlafen)
    draw(g) {
      // Kopfteil links, Fußteil rechts
      g.fillStyle(0x9c6a43, 1);
      g.fillRoundedRect(0, 4, 30, 156, 12);
      g.fillRoundedRect(290, 50, 30, 110, 12);
      g.fillStyle(0xb07a50, 1);
      g.fillRect(20, 110, 280, 30);
      g.fillStyle(0x9c6a43, 1);
      g.fillRect(24, 140, 14, 20);
      g.fillRect(282, 140, 14, 20);
      // Matratze, Decke, Kissen (Oberkante der Matratze = Ablage bei 80)
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(26, 80, 268, 34, 12);
      g.fillStyle(0x8fa8ff, 1);
      g.fillRoundedRect(110, 78, 184, 40, 16);
      g.fillStyle(0xb4c4ff, 1);
      g.fillRoundedRect(110, 78, 184, 12, { tl: 16, tr: 16, bl: 0, br: 0 });
      g.fillStyle(0xffffff, 1);
      for (const [x, y] of [[140, 100], [190, 104], [240, 98], [270, 106]]) g.fillCircle(x, y, 4);
      g.fillStyle(0xfff4fb, 1);
      g.fillRoundedRect(34, 58, 70, 30, 14);
      g.fillStyle(0xfff3a8, 1);
      fillStar(g, 15, 34, 9, 4, 5);
    },
  },

  kleiderschrank: {
    id: 'kleiderschrank',
    name: 'Kleiderschrank',
    sprite: 'kleiderschrank',
    kind: 'floor',
    w: 2,
    h: 4,
    draw: (g) => drawWardrobe(g, false),
    states: { open: (g) => drawWardrobe(g, true) },
  },

  stehpflanze: {
    id: 'stehpflanze',
    name: 'Pflanze',
    sprite: 'stehpflanze',
    kind: 'floor',
    w: 2,
    h: 3,
    draw(g) {
      const greens = [0x3f8a4c, 0x4f9f5a, 0x5fb468, 0x76c77a];
      const leaves = [
        [-2.0, 70, 34], [-1.1, 92, 40], [-2.6, 64, 30], [-0.5, 72, 34], [-1.6, 96, 42], [-2.9, 50, 26], [-0.2, 50, 26],
      ];
      leaves.forEach(([a, len, w], i) => leaf(g, 80, 168, len, w, a, greens[i % greens.length]));
      terracotta(g, 40, 120, 170, 238);
    },
  },

  schreibtisch: {
    id: 'schreibtisch',
    name: 'Schreibtisch',
    sprite: 'schreibtisch',
    kind: 'floor',
    w: 3,
    h: 2,
    surfaces: [{ y: 1.8, x0: 1, x1: 3 }], // Tischplatte rechts vom Hocker
    desk: { x: 38, y: -10 }, // hier sitzt die Fee (auf dem Hocker, gleich hoch wie die Tischplatte)
    draw(g) {
      // hoher Schreibhocker: Sitzfläche auf Höhe der Tischplatte, mit Fußstütze
      g.fillStyle(0x9c6a43, 1);
      g.fillPoints([{ x: 22, y: 16 }, { x: 30, y: 16 }, { x: 22, y: 160 }, { x: 12, y: 160 }], true);
      g.fillPoints([{ x: 50, y: 16 }, { x: 58, y: 16 }, { x: 68, y: 160 }, { x: 58, y: 160 }], true);
      g.fillRect(16, 104, 48, 8);
      g.fillStyle(0xff9ec7, 1);
      g.fillRoundedRect(8, 0, 64, 18, 8);
      // schmaler Tisch
      g.fillStyle(0x9c6a43, 1);
      g.fillRect(92, 18, 14, 142);
      g.fillRect(216, 18, 14, 142);
      g.fillRect(92, 108, 138, 8);
      g.fillStyle(0xc98b5a, 1);
      g.fillRoundedRect(82, 0, 158, 20, 6);
      g.fillStyle(0xa8774f, 1);
      g.fillRect(86, 14, 150, 6);
    },
  },

  buecherregal: {
    id: 'buecherregal',
    name: 'Bücherwand',
    sprite: 'buecherregal',
    kind: 'floor',
    w: 4,
    h: 5,
    // zwei Spalten mit je fünf Fächern (je ein Gegenstand, mittig) + oben drauf
    surfaces: [
      ...[0.25, 0.94, 1.7, 2.49, 3.24].flatMap((y) => [{ y, x0: 0.6, x1: 1.6 }, { y, x0: 2.4, x1: 3.4 }]),
      { y: 4.24, x0: 0.5, x1: 3.5 },
    ],
    draw(g, W, H) {
      g.fillStyle(0x6b4128, 1);
      g.fillRect(10, 10, W - 20, H - 10);
      g.fillStyle(0x8a5a3b, 1);
      g.fillRect(0, 0, 16, H);
      g.fillRect(W - 16, 0, 16, H);
      g.fillRect(W / 2 - 5, 16, 10, H - 16);
      g.fillRoundedRect(-6, 0, W + 12, 16, 6);
      for (let k = 1; k <= 4; k++) g.fillRect(0, H - k * CELL, W, 12);
      g.fillRect(0, H - 10, W, 10);
      g.fillStyle(0xffd166, 1);
      fillStar(g, W / 2, 7, 6, 3, 5);
    },
  },

  ofen: {
    id: 'ofen',
    name: 'Ofen',
    sprite: 'ofen',
    kind: 'floor',
    w: 3,
    h: 3,
    surfaces: [{ y: 2.8, x0: 0, x1: 3 }], // Herdplatte
    lamp: { x: 120, y: 136, color: 0xffa94d }, // Sichtfenster glüht beim Backen (Zustand 'on')
    draw: (g) => drawOven(g, false),
    states: { on: (g) => drawOven(g, true) },
  },

  vorratsregal: {
    id: 'vorratsregal',
    name: 'Vorratsregal',
    sprite: 'vorratsregal',
    kind: 'floor',
    w: 4,
    h: 5,
    surfaces: [1.97, 3.39, 4.56].map((y) => ({ y, x0: 0.5, x1: 3.5 })), // zwei Bretter + oben drauf (unten: Säcke)
    draw: drawPantry,
  },

  unterschrank: {
    id: 'unterschrank',
    name: 'Unterschrank',
    sprite: 'unterschrank',
    kind: 'floor',
    w: 3,
    h: 2,
    surfaces: [{ y: 1.76, x0: 0, x1: 3 }], // Arbeitsplatte
    draw: drawBaseCabinet,
  },

  sessel: {
    id: 'sessel',
    name: 'Sessel',
    sprite: 'sessel',
    kind: 'floor',
    w: 2,
    h: 2,
    soft: true,
    surfaces: [{ y: 0.78, x0: 0, x1: 2 }], // Sitzfläche
    draw(g) {
      g.fillStyle(0x9c6a43, 1);
      g.fillRect(16, 146, 12, 14);
      g.fillRect(132, 146, 12, 14);
      g.fillStyle(0xe0566f, 1);
      g.fillRoundedRect(16, 6, 128, 92, 32);
      g.fillStyle(0xc9445c, 1);
      g.fillCircle(56, 44, 5);
      g.fillCircle(104, 44, 5);
      g.fillStyle(0xf07a8f, 1);
      g.fillRoundedRect(10, 78, 140, 28, 12);
      g.fillStyle(0xc9445c, 1);
      g.fillRoundedRect(8, 100, 144, 48, 14);
      g.fillRoundedRect(0, 54, 30, 94, 14);
      g.fillRoundedRect(130, 54, 30, 94, 14);
    },
  },

  // ======== Wand ========
  wandleiste: {
    id: 'wandleiste',
    name: 'Kochleiste',
    sprite: 'wandleiste',
    spriteAlign: 'top',
    kind: 'wall',
    w: 3,
    h: 2,
    draw: drawUtensilRail,
  },

  haengeschrank: {
    id: 'haengeschrank',
    name: 'Hängeschrank',
    sprite: 'haengeschrank',
    kind: 'wall',
    w: 2,
    h: 2,
    surfaces: [{ y: 1.84, x0: 0, x1: 2 }], // oben drauf
    draw: drawWallCabinet,
  },

  haengesessel: {
    id: 'haengesessel',
    name: 'Hängesessel',
    sprite: 'haengesessel',
    kind: 'wall',
    w: 2,
    h: 3,
    soft: true,
    surfaces: [{ y: 0.81, x0: 0, x1: 2 }], // Sitzkissen
    draw(g) {
      g.lineStyle(4, 0xb08a5a, 1);
      g.lineBetween(80, 2, 34, 78);
      g.lineBetween(80, 2, 126, 78);
      g.fillStyle(0xb08a5a, 1);
      g.fillCircle(80, 6, 7);
      g.fillStyle(0xd9b98a, 1);
      g.fillEllipse(80, 152, 152, 168);
      g.fillStyle(0xa77e4f, 1);
      g.fillEllipse(80, 144, 120, 132);
      g.lineStyle(2, 0xc4a06e, 1);
      for (const r of [60, 68, 76]) g.strokeEllipse(80, 152, r * 2, r * 2.2);
      g.fillStyle(0xffc8f0, 1);
      g.fillRoundedRect(46, 104, 68, 58, 22);
      g.fillStyle(0xff9ec7, 1);
      g.fillRoundedRect(28, 160, 104, 34, 14); // Oberkante = Sitzfläche (Zeile 1)
    },
  },

  haengepflanze: {
    id: 'haengepflanze',
    name: 'Hängepflanze',
    sprite: 'haengepflanze',
    kind: 'wall',
    w: 1,
    h: 2,
    draw(g) {
      g.lineStyle(2, 0xb08a5a, 1);
      g.lineBetween(40, 0, 20, 48);
      g.lineBetween(40, 0, 60, 48);
      // Ranken
      const vines = [[24, 150, -1], [40, 158, 1], [56, 140, -1]];
      for (const [x, end, side] of vines) {
        g.lineStyle(3, 0x3f8a4c, 1);
        const pts = [];
        for (let y = 60; y <= end; y += 10) pts.push({ x: x + Math.sin(y * 0.08) * 5 * side, y });
        g.strokePoints(pts, false);
        pts.forEach((p, i) => {
          if (i % 2) leaf(g, p.x, p.y, 13, 9, i % 4 === 1 ? 0.5 : 2.6, i % 3 ? 0x5fb468 : 0x76c77a);
        });
      }
      terracotta(g, 16, 64, 50, 80);
      leaf(g, 34, 50, 16, 10, -2.2, 0x5fb468);
      leaf(g, 46, 50, 16, 10, -0.9, 0x76c77a);
    },
  },

  haengeregal: {
    id: 'haengeregal',
    name: 'Wandbrett',
    sprite: 'haengeregal',
    spriteAlign: 'top',
    kind: 'wall',
    w: 3,
    h: 1,
    surfaces: [{ y: 0.93, x0: 0, x1: 3 }],
    draw(g) {
      g.fillStyle(0x6b4128, 1);
      g.fillTriangle(26, 14, 52, 14, 26, 60);
      g.fillTriangle(214, 14, 188, 14, 214, 60);
      g.fillStyle(0x9c6a43, 1);
      g.fillRoundedRect(0, 0, 240, 16, 5);
      g.fillStyle(0xb07a50, 1);
      g.fillRect(2, 10, 236, 6);
      g.fillStyle(0x5fb468, 1);
      for (const [x, y] of [[100, 22], [108, 32], [104, 44], [140, 22], [146, 34]]) g.fillCircle(x, y, 6);
    },
  },

  tafel: {
    id: 'tafel',
    name: 'Tafel',
    sprite: 'tafel',
    chalk: 0x6b4128, // Pergament: dunkle Schrift
    kind: 'wall',
    w: 3,
    h: 2,
    board: { x: 32, y: 24, w: 196, h: 112 },
    draw(g) {
      g.fillStyle(0x9c6a43, 1);
      g.fillRoundedRect(0, 0, 240, 150, 12);
      g.fillStyle(0x2f5d50, 1);
      g.fillRoundedRect(14, 12, 212, 126, 6);
      g.fillStyle(0xb07a50, 1);
      g.fillRect(30, 142, 180, 12);
      g.fillStyle(0xffffff, 1);
      g.fillRoundedRect(150, 134, 26, 9, 3);
      g.fillStyle(0xff9ec7, 1);
      g.fillRoundedRect(180, 134, 20, 9, 3);
    },
  },

  // ======== Zutaten ========
  kraeuter: {
    id: 'kraeuter',
    name: 'Kräuter',
    sprite: 'kraeuter',
    kind: 'small',
    w: 1,
    h: 1,
    ingredient: 0x6fdc8c,
    piece: 'leaf',
    glyph: 'sprig',
    portions: 3,
    draw: (g) => drawHerbs(g, 3),
    states: amountStates(drawHerbs),
  },

  blaetter: {
    id: 'blaetter',
    name: 'Blätter',
    sprite: 'blaetter',
    kind: 'small',
    w: 1,
    h: 1,
    ingredient: 0xffa94d,
    piece: 'leaf',
    glyph: 'leaf',
    portions: 3,
    draw: (g) => drawLeaves(g, 3),
    states: amountStates(drawLeaves),
  },

  mondwasser: {
    id: 'mondwasser',
    name: 'Mondwasser',
    kind: 'small',
    w: 1,
    h: 1,
    ingredient: 0x5fd3ff,
    piece: 'drop',
    glyph: 'drop',
    portions: 3,
    draw: (g) => drawMoonwater(g, 3),
    states: amountStates(drawMoonwater),
  },

  // ======== Gläser ========
  kolben: {
    id: 'kolben',
    name: 'Kolben',
    kind: 'small',
    w: 1,
    h: 1,
    glass: true,
    liquidCenter: { x: 40, y: 56 },
    liquid(g, color, alpha = 1) {
      g.fillStyle(color, alpha);
      g.fillCircle(40, 56, 20);
      g.fillStyle(0xffffff, 0.5 * alpha);
      g.fillCircle(32, 50, 4);
    },
    draw(g) {
      glassStyle(g);
      g.fillCircle(40, 54, 24);
      g.fillRect(33, 12, 14, 22);
      g.strokeCircle(40, 54, 24);
      g.lineBetween(33, 12, 33, 32);
      g.lineBetween(47, 12, 47, 32);
      g.fillStyle(GLASS, 1);
      g.fillRoundedRect(29, 8, 22, 7, 3);
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(30, 46, 4);
    },
  },

  phiole: {
    id: 'phiole',
    name: 'Phiole',
    kind: 'small',
    w: 1,
    h: 1,
    glass: true,
    liquidCenter: { x: 40, y: 52 },
    liquid(g, color, alpha = 1) {
      g.fillStyle(color, alpha);
      g.fillRoundedRect(31, 32, 18, 41, 8);
      g.fillStyle(0xffffff, 0.5 * alpha);
      g.fillRect(34, 38, 3, 20);
    },
    draw(g) {
      glassStyle(g);
      g.fillRoundedRect(28, 12, 24, 64, 11);
      g.strokeRoundedRect(28, 12, 24, 64, 11);
      g.fillStyle(0xc98b5a, 1);
      g.fillRoundedRect(27, 4, 26, 13, 4);
    },
  },

  becher: {
    id: 'becher',
    name: 'Kelch',
    kind: 'small',
    w: 1,
    h: 1,
    glass: true,
    liquidCenter: { x: 40, y: 34 },
    liquid(g, color, alpha = 1) {
      g.fillStyle(color, alpha);
      g.fillPoints([{ x: 19, y: 22 }, { x: 61, y: 22 }, { x: 54, y: 44 }, { x: 26, y: 44 }], true);
      g.fillStyle(0xffffff, 0.5 * alpha);
      g.fillRect(25, 26, 10, 3);
    },
    draw(g) {
      const bowl = [{ x: 14, y: 12 }, { x: 66, y: 12 }, { x: 56, y: 48 }, { x: 24, y: 48 }];
      glassStyle(g);
      g.fillPoints(bowl, true);
      g.strokePoints(bowl, true);
      g.fillStyle(GLASS, 1);
      g.fillRect(37, 48, 6, 20);
      g.fillEllipse(40, 72, 38, 10);
    },
  },

  // ======== Sonstiges ========
  gewuerze: {
    id: 'gewuerze',
    name: 'Gewürze',
    kind: 'small',
    w: 1,
    h: 1,
    draw: drawSpices,
  },

  // Essen (food): wird beim Naschen weniger (portions), ist es aufgegessen, verschwindet es
  obstschale: {
    id: 'obstschale',
    name: 'Obstschale',
    sprite: 'obstschale',
    kind: 'small',
    w: 1,
    h: 1,
    food: true,
    portions: 3,
    piece: 'apple', // Kochen: die Fee nimmt einen Apfel mit zum Ofen
    draw: (g) => drawFruitBowl(g, 3),
    states: amountStates(drawFruitBowl),
  },

  brot: {
    id: 'brot',
    name: 'Brot',
    kind: 'small',
    w: 1,
    h: 1,
    food: true,
    portions: 3,
    draw: (g) => drawBread(g, 3),
    states: amountStates(drawBread),
  },

  kuchen: {
    id: 'kuchen',
    name: 'Kuchen',
    kind: 'small',
    w: 1,
    h: 1,
    food: true,
    portions: 3,
    draw: (g) => drawCake(g, 3),
    states: amountStates(drawCake),
  },

  leselampe: {
    id: 'leselampe',
    name: 'Leselampe',
    sprite: 'leselampe',
    kind: 'small',
    w: 1,
    h: 1,
    lamp: { x: 55, y: 32, color: 0xfff0b0 }, // leuchtet im Zustand 'on' (beim Lesen)
    draw: (g) => drawReadingLamp(g, false),
    states: { on: (g) => drawReadingLamp(g, true) },
  },

  schriftrolle: {
    id: 'schriftrolle',
    name: 'Schriftrollen',
    kind: 'small',
    w: 1,
    h: 1,
    readable: true,
    draw: (g) => drawScrolls(g, false),
    states: { open: (g) => drawScrolls(g, true) },
  },

  nachtlicht: {
    id: 'nachtlicht',
    name: 'Nachtlicht',
    sprite: 'nachtlicht',
    kind: 'small',
    w: 1,
    h: 1,
    lamp: { x: 40, y: 26, color: 0xffd9a0 }, // leuchtet im Zustand 'on'
    draw: (g) => drawNightlight(g, false),
    states: { on: (g) => drawNightlight(g, true) },
  },

  buecher: {
    id: 'buecher',
    name: 'Bücher',
    sprite: 'buecher',
    kind: 'small',
    w: 1,
    h: 1,
    readable: true,
    pages: true, // beim Lesen blättern Seiten um
    draw(g) {
      drawBooks(g, true);
    },
    states: {
      // oberstes Buch liegt aufgeschlagen
      open(g) {
        drawBooks(g, false);
        g.fillStyle(0xff7ab8, 1);
        g.fillRoundedRect(0, 26, 80, 12, 4);
        g.fillStyle(0xffffff, 1);
        g.fillPoints([{ x: 4, y: 30 }, { x: 40, y: 34 }, { x: 40, y: 14 }, { x: 6, y: 8 }], true);
        g.fillPoints([{ x: 76, y: 30 }, { x: 40, y: 34 }, { x: 40, y: 14 }, { x: 74, y: 8 }], true);
        g.lineStyle(2, 0xc9b8e8, 1);
        for (let i = 0; i < 3; i++) {
          g.lineBetween(12, 15 + i * 6, 34, 18 + i * 6);
          g.lineBetween(46, 18 + i * 6, 68, 15 + i * 6);
        }
        g.lineStyle(2, 0xd9a5c0, 1);
        g.lineBetween(40, 14, 40, 34);
      },
    },
  },

  // ======== Badezimmer ========
  // Badewanne: Wasser und Schaum sind eine Überlagerung (liquid), die Fee sitzt beim Baden in der Wanne
  // (activities/bath.js: der vordere Teil der Wanne wird dafür über die Fee gelegt, ab bath.rimY)
  badewanne: {
    id: 'badewanne',
    name: 'Badewanne',
    sprite: 'badewanne',
    kind: 'floor',
    w: 4,
    h: 3,
    liquidCenter: { x: 160, y: 107 },
    // leer: das gemalte Wasser wird mit der Innenfarbe der Wanne übermalt (emptyLiquid)
    emptyLiquid: TUB_EMPTY,
    bath: { rimY: 109, faucet: { x: 59, y: 67 }, seat: { x: 155, y: 109 }, duck: { x: 229, y: 109 } },
    liquid(g, color, alpha = 1, foam = 0) {
      g.fillStyle(TUB_EMPTY, 1);
      g.fillEllipse(160, 108, 280, 29);
      g.fillStyle(0xe4d6c2, 1);
      g.fillEllipse(160, 101, 261, 13);
      if (color === TUB_EMPTY) return;
      g.fillStyle(color, alpha * 0.92);
      g.fillEllipse(160, 108, 280, 29);
      g.fillStyle(0xffffff, 0.45 * alpha);
      g.fillEllipse(112, 104, 93, 7);
      if (foam > 0) drawFoam(g, foam, 107, 32, 256);
    },
    draw: drawBathtub,
  },

  spiegelschrank: {
    id: 'spiegelschrank',
    name: 'Spiegelschrank',
    sprite: 'spiegelschrank',
    kind: 'wall',
    w: 2,
    h: 2,
    mirror: { x: 90, y: 84 }, // Mitte des Spiegels (davor macht sich die Fee hübsch)
    draw: (g) => drawMirrorCabinet(g, false),
    states: { open: (g) => drawMirrorCabinet(g, true) },
  },

  pflegeschrank: {
    id: 'pflegeschrank',
    name: 'Pflegeschrank',
    sprite: 'pflegeschrank',
    kind: 'floor',
    w: 2,
    h: 3,
    surfaces: [{ y: 2.65, x0: 0, x1: 2 }], // oben drauf
    shampoo: { x: 44, y: 128 }, // hier steht das Shampoo (die Fee nimmt es fürs Bad)
    draw: drawCareCabinet,
  },

  quietscheente: {
    id: 'quietscheente',
    name: 'Quietscheente',
    kind: 'small',
    w: 1,
    h: 1,
    duck: true,
    draw: drawDuck,
  },

  // ======== Musikzimmer ========
  // instrument: mode 'sit' = die Fee spielt daneben/davor sitzend (at, face), 'hold' = sie nimmt es in die Hand
  //   (dy = wie tief es unter ihr hängt); notes = wo die Noten aufsteigen (Art-Koordinaten), color = Farbe der Noten
  harfe: {
    id: 'harfe',
    name: 'Harfe',
    sprite: 'harfe',
    kind: 'floor',
    w: 2,
    h: 3,
    instrument: { mode: 'sit', at: { x: 168, y: 150 }, face: -1, notes: { x: 80, y: 60 }, color: 0xffd166 },
    draw: drawHarp,
  },

  piano: {
    id: 'piano',
    name: 'Klavier',
    sprite: 'piano',
    kind: 'floor',
    w: 3,
    h: 2,
    surfaces: [{ y: 1.9, x0: 0, x1: 3 }], // oben drauf
    instrument: { mode: 'sit', at: { x: 120, y: 108 }, face: 1, notes: { x: 120, y: 24 }, color: 0xff7ab8 },
    draw: drawPiano,
  },

  laute: {
    id: 'laute',
    name: 'Laute',
    sprite: 'laute',
    kind: 'small',
    w: 1,
    h: 1,
    instrument: { mode: 'hold', dy: 50, notes: { x: 40, y: 20 }, color: 0x9b7bff },
    draw: drawLute,
  },

  floete: {
    id: 'floete',
    name: 'Flöte',
    kind: 'small',
    w: 1,
    h: 1,
    instrument: { mode: 'hold', dy: 40, notes: { x: 70, y: 20 }, color: 0x5fd3ff },
    draw: drawFlute,
  },

  trompete: {
    id: 'trompete',
    name: 'Trompete',
    kind: 'small',
    w: 1,
    h: 1,
    instrument: { mode: 'hold', dy: 44, notes: { x: 74, y: 30 }, color: 0xffb347 },
    draw: drawTrumpet,
  },

  // Tanzfläche: flach auf dem Boden, leuchtet bunt, wenn getanzt wird (Zustand 'on')
  tanzflaeche: {
    id: 'tanzflaeche',
    name: 'Tanzfläche',
    kind: 'floor',
    w: 4,
    h: 1,
    dancefloor: true,
    draw: (g) => drawDancefloor(g, false),
    states: { on: (g) => drawDancefloor(g, true) },
  },

  // Discokugel: angeschaltet (Zustand 'on') tanzen bunte Lichtflecken durch den Raum (life/RoomLife.js)
  discokugel: {
    id: 'discokugel',
    name: 'Discokugel',
    kind: 'wall',
    w: 1,
    h: 1,
    disco: { x: 40, y: 48 },
    draw: (g) => drawDiscoBall(g, false),
    states: { on: (g) => drawDiscoBall(g, true) },
  },

  // ======== Für jeden Raum ========
  // variants: mehrere Motive (beim Hinstellen zufällig, Antippen wechselt)
  bild: {
    id: 'bild',
    name: 'Bild',
    sprite: 'bild',
    spriteVariants: ['bild', 'bild_v1', 'bild_v2', 'bild_v3'], // je Motiv ein gemaltes Bild
    cardVariant: 1, // in der Leiste: das Blumenbild (aufgehängt wird ein zufälliges Motiv)
    kind: 'wall',
    w: 2,
    h: 2,
    variants: 4,
    draw: (g, W, H, v) => drawPicture(g, v),
  },

  fenster: {
    id: 'fenster',
    name: 'Fenster',
    sprite: 'fenster',
    kind: 'wall',
    w: 2,
    h: 2,
    skyWindow: true, // zeigt draußen Tag oder Nacht (life/RoomLife.js folgt der Uhr)
    draw: (g) => drawWindow(g, false),
    states: { night: (g) => drawWindow(g, true) },
  },

  // Teppich: liegt flach auf dem Boden, eigene Ebene ('rug') – Möbel dürfen darauf stehen
  teppich: {
    id: 'teppich',
    name: 'Teppich',
    kind: 'rug',
    w: 3,
    h: 1,
    variants: 3,
    rug: true,
    draw: (g, W, H, v) => drawRug(g, v),
  },

  // Deckenlampe: hängt immer an der Decke (ceiling), toggle = Feen und Kind schalten sie an und aus
  deckenlampe: {
    id: 'deckenlampe',
    name: 'Deckenlampe',
    sprite: 'deckenlampe',
    kind: 'wall',
    w: 1,
    h: 1,
    ceiling: true,
    toggle: true,
    lamp: { x: 40, y: 72, color: 0xffe9a8, size: 5, alpha: 0.4 },
    draw: (g) => drawCeilingLamp(g, false),
    states: { on: (g) => drawCeilingLamp(g, true) },
  },

  kerze: {
    id: 'kerze',
    name: 'Kerze',
    kind: 'small',
    w: 1,
    h: 1,
    toggle: true,
    candle: true,
    lamp: { x: 40, y: 24, color: 0xffb347, size: 3.5, flicker: true },
    draw: (g) => drawCandle(g, false),
    states: { on: (g) => drawCandle(g, true) },
  },

  vase: {
    id: 'vase',
    name: 'Vase',
    sprite: 'vase',
    kind: 'small',
    w: 1,
    h: 1,
    flowers: true, // Feen gießen die Blumen
    draw: drawVase,
  },
};

export const furnitureById = (id) => FURNITURE[id];
export const textureKey = (id, v = 0, state = null) => `furn-${id}${v ? `-${v}` : ''}${state ? `@${state}` : ''}`;

// welcher Zustand (Textur) gehört zu einem Item?
export function lookState(def, item = {}) {
  if (item.state) return item.state;
  if (def.portions && item.amount != null && item.amount < def.portions) return `a${item.amount}`;
  return null;
}

// ---- Badezimmer ----

// Schaumberg über der Wanne (amount 0..1 = wie viel Schaum), y = Höhe der Wasserfläche, x0..x0+w = Breite
export function drawFoam(g, amount, y, x0 = 40, w = 240) {
  const n = Math.round(6 + amount * 16);
  for (let i = 0; i < n; i++) {
    // feste Pseudo-Zufallswerte, damit der Schaum beim Wachsen nicht springt
    const x = x0 + ((i * 97) % w);
    const r = (8 + ((i * 37) % 9)) * (0.5 + amount * 0.5);
    const dy = ((i * 53) % 14) * amount;
    g.fillStyle(i % 4 === 0 ? 0xffe3f1 : 0xffffff, 0.95);
    g.fillCircle(x, y - 4 - dy, r);
  }
}

function drawBathtub(g) {
  const edge = 0x8fb0d4;
  // Füße mit Krallen (gold)
  g.fillStyle(0xe0b04a, 1);
  for (const x of [48, 272]) {
    g.fillEllipse(x, 148, 30, 20);
    g.fillRoundedRect(x - 8, 124, 16, 24, 6);
  }
  // Wannenkörper
  g.fillStyle(0xfdfbff, 1);
  g.fillRoundedRect(14, 44, 292, 100, { tl: 10, tr: 10, bl: 60, br: 60 });
  g.lineStyle(5, edge, 1);
  g.strokeRoundedRect(14, 44, 292, 100, { tl: 10, tr: 10, bl: 60, br: 60 });
  // Verzierung: Tupfen-Band
  g.fillStyle(0xffc8e2, 1);
  for (let x = 70; x <= 250; x += 45) g.fillCircle(x, 92, 7);
  g.fillStyle(0xe8f2ff, 1);
  g.fillRoundedRect(36, 110, 248, 9, 4);
  // Öffnung oben (innen hellblau) mit Rand
  g.fillStyle(0xd6e6f5, 1);
  g.fillEllipse(160, 46, 286, 30);
  g.lineStyle(6, 0xffffff, 1);
  g.strokeEllipse(160, 46, 290, 32);
  g.lineStyle(3, edge, 1);
  g.strokeEllipse(160, 46, 298, 38);
  // Wasserhahn links (gold)
  g.fillStyle(0xe0b04a, 1);
  g.fillRoundedRect(22, 6, 12, 40, 5);
  g.fillRoundedRect(22, 6, 36, 11, 5);
  g.fillRoundedRect(50, 12, 9, 10, 3);
  g.fillStyle(0xffd166, 1);
  fillStar(g, 28, 5, 9, 4, 5);
}

function drawMirrorCabinet(g, open) {
  // Holzrahmen
  g.fillStyle(0xb07a50, 1);
  g.fillRoundedRect(6, 4, 148, 140, 14);
  g.fillStyle(0x9c6a43, 1);
  g.fillRoundedRect(0, 136, 160, 16, 6); // Ablage unten
  if (!open) {
    g.fillStyle(0xd8f0ff, 1);
    g.fillRoundedRect(18, 16, 124, 116, 10);
    g.fillStyle(0xffffff, 0.75);
    g.fillPoints([{ x: 34, y: 112 }, { x: 96, y: 24 }, { x: 116, y: 24 }, { x: 54, y: 112 }], true);
    g.fillPoints([{ x: 70, y: 120 }, { x: 128, y: 40 }, { x: 136, y: 40 }, { x: 80, y: 120 }], true);
    g.lineStyle(4, 0xe0b04a, 1);
    g.strokeRoundedRect(18, 16, 124, 116, 10);
    g.fillStyle(0xffd166, 1);
    fillStar(g, 80, 10, 8, 3.5, 5);
    return;
  }
  // offen: Fächer mit Döschen, die Spiegeltür steht schräg nach links
  g.fillStyle(0x6b4128, 1);
  g.fillRoundedRect(18, 16, 124, 116, 8);
  g.fillStyle(0x9c6a43, 1);
  g.fillRect(18, 70, 124, 6);
  const jars = [[50, 0xff9ec7], [80, 0x8fd3ff], [112, 0xfff3a8]];
  for (const [x, c] of jars) {
    g.fillStyle(c, 1);
    g.fillRoundedRect(x - 10, 44, 20, 26, 5);
    g.fillRoundedRect(x - 12, 102, 24, 30, 6);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(x - 8, 38, 16, 8, 3);
    g.fillRoundedRect(x - 10, 96, 20, 8, 3);
  }
  g.fillStyle(0xd8f0ff, 1);
  g.fillPoints([{ x: 18, y: 16 }, { x: 0, y: 6 }, { x: 0, y: 142 }, { x: 18, y: 132 }], true);
  g.lineStyle(3, 0xe0b04a, 1);
  g.strokePoints([{ x: 18, y: 16 }, { x: 0, y: 6 }, { x: 0, y: 142 }, { x: 18, y: 132 }], true);
}

function drawCareCabinet(g) {
  g.fillStyle(0x7d5236, 1);
  g.fillRect(14, 226, 14, 14);
  g.fillRect(132, 226, 14, 14);
  g.fillStyle(0x9c6a43, 1);
  g.fillRoundedRect(4, 14, 152, 214, 10);
  g.fillStyle(0xb07a50, 1);
  g.fillRoundedRect(0, 4, 160, 18, 8);
  // zwei offene Fächer
  g.fillStyle(0x5b3a26, 1);
  g.fillRect(16, 30, 128, 58);
  g.fillRect(16, 98, 128, 52);
  // oben: gerollte Handtücher
  const towels = [[42, 0xff9ec7], [80, 0xbfe8d4], [118, 0x8fd3ff]];
  for (const [x, c] of towels) {
    g.fillStyle(c, 1);
    g.fillRoundedRect(x - 17, 52, 34, 36, 12);
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(x, 70, 8);
  }
  // unten: Shampoo (rosa, mit Pumpe), Seife, Cremedose
  g.fillStyle(0xff7ab8, 1);
  g.fillRoundedRect(32, 114, 26, 36, 8);
  g.fillStyle(0xffffff, 1);
  g.fillRect(41, 104, 8, 10);
  g.fillRect(41, 102, 16, 5);
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(45, 130, 6);
  g.fillStyle(0xc6a8ff, 1);
  g.fillRoundedRect(68, 132, 30, 18, 8);
  g.fillStyle(0xfff3a8, 1);
  g.fillRoundedRect(106, 124, 28, 26, 6);
  g.fillStyle(0xffd166, 1);
  g.fillRoundedRect(104, 118, 32, 8, 3);
  // Bretter und Tür unten
  g.fillStyle(0xb07a50, 1);
  g.fillRect(16, 88, 128, 8);
  g.fillRect(16, 150, 128, 8);
  g.fillStyle(0xc98b5a, 1);
  g.fillRoundedRect(16, 162, 62, 58, 6);
  g.fillRoundedRect(82, 162, 62, 58, 6);
  g.fillStyle(0xffd166, 1);
  g.fillCircle(70, 190, 5);
  g.fillCircle(90, 190, 5);
}

function drawDuck(g) {
  g.fillStyle(0xffd23f, 1);
  g.fillEllipse(38, 60, 54, 32); // Körper
  g.fillTriangle(10, 50, 22, 46, 20, 64); // Schwänzchen
  g.fillCircle(52, 34, 15); // Kopf
  g.fillStyle(0xffb21f, 1);
  g.fillEllipse(34, 58, 24, 12); // Flügel
  g.fillStyle(0xff8a3c, 1);
  g.fillEllipse(68, 38, 16, 8); // Schnabel
  g.fillStyle(0x3b2a4a, 1);
  g.fillCircle(55, 30, 3);
  g.fillStyle(0xffffff, 1);
  g.fillCircle(56, 29, 1.2);
}

// ---- Musikzimmer ----

function drawHarp(g) {
  const gold = 0xe0b04a;
  const dark = 0xb8862e;
  // Sockel
  g.fillStyle(dark, 1);
  g.fillRoundedRect(14, 214, 116, 22, 8);
  // Resonanzkörper (schräg von unten rechts nach oben)
  g.fillStyle(0xc98b5a, 1);
  g.fillPoints([{ x: 96, y: 216 }, { x: 130, y: 216 }, { x: 132, y: 40 }, { x: 116, y: 38 }], true);
  g.fillStyle(0xb07a50, 1);
  g.fillPoints([{ x: 104, y: 210 }, { x: 116, y: 210 }, { x: 124, y: 48 }, { x: 118, y: 48 }], true);
  // Säule links
  g.fillStyle(gold, 1);
  g.fillRoundedRect(22, 30, 16, 190, 7);
  g.fillCircle(30, 26, 12);
  // Hals oben (geschwungen)
  g.lineStyle(14, gold, 1);
  g.beginPath();
  g.moveTo(30, 30);
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    g.lineTo(30 + t * 98, 30 + Math.sin(t * Math.PI) * -14 + t * 10);
  }
  g.strokePath();
  g.fillStyle(0xffd166, 1);
  fillStar(g, 30, 24, 9, 4, 5);
  // Saiten
  g.lineStyle(2, 0xfff3d6, 1);
  for (let i = 0; i < 7; i++) {
    const x = 44 + i * 11;
    const t = (x - 30) / 98;
    const top = 32 + Math.sin(t * Math.PI) * -14 + t * 10 + 6;
    const bottom = 216 - ((x - 40) / 80) * 30;
    g.lineBetween(x, top, x + 6 + i * 1.5, bottom);
  }
}

function drawPiano(g) {
  // Beine und Pedale
  g.fillStyle(0x7d4a5e, 1);
  g.fillRect(18, 120, 14, 40);
  g.fillRect(208, 120, 14, 40);
  g.fillStyle(0xe0b04a, 1);
  g.fillRoundedRect(106, 148, 10, 8, 3);
  g.fillRoundedRect(124, 148, 10, 8, 3);
  // Korpus (rosa)
  g.fillStyle(0xe58fb4, 1);
  g.fillRoundedRect(6, 6, 228, 112, 12);
  g.fillStyle(0xf2a9c9, 1);
  g.fillRoundedRect(0, 0, 240, 16, 8);
  // Notenblatt
  g.fillStyle(0xfffaf0, 1);
  g.fillRect(84, 22, 72, 44);
  g.lineStyle(2, 0xc9b8e8, 1);
  for (let i = 0; i < 4; i++) g.lineBetween(90, 30 + i * 9, 150, 30 + i * 9);
  g.fillStyle(0x5a3a7a, 1);
  g.fillCircle(100, 39, 3);
  g.fillCircle(120, 48, 3);
  g.fillCircle(138, 30, 3);
  // Tasten
  g.fillStyle(0xc9739a, 1);
  g.fillRect(10, 74, 220, 10);
  g.fillStyle(0xffffff, 1);
  g.fillRect(14, 84, 212, 30);
  g.lineStyle(2, 0xd9c8e0, 1);
  for (let x = 14 + 15; x < 226; x += 15) g.lineBetween(x, 84, x, 114);
  g.fillStyle(0x3b2a4a, 1);
  for (let i = 0, x = 24; x < 220; i++, x += 15) if (i % 7 !== 2 && i % 7 !== 6) g.fillRect(x, 84, 9, 18);
  // Sternchen-Verzierung
  g.fillStyle(0xffd166, 1);
  fillStar(g, 40, 40, 10, 4.5, 5);
  fillStar(g, 200, 40, 10, 4.5, 5);
}

function drawLute(g) {
  // Hals mit Wirbelkasten (schräg nach rechts oben)
  g.fillStyle(0x8a5a3b, 1);
  g.fillPoints([{ x: 42, y: 44 }, { x: 70, y: 12 }, { x: 76, y: 18 }, { x: 48, y: 50 }], true);
  g.fillStyle(0x6b4128, 1);
  g.fillPoints([{ x: 68, y: 10 }, { x: 76, y: 2 }, { x: 80, y: 8 }, { x: 76, y: 18 }], true);
  // Bauch (birnenförmig)
  g.fillStyle(0xd9a066, 1);
  g.fillEllipse(30, 58, 46, 38);
  g.fillEllipse(40, 48, 28, 24);
  g.fillStyle(0x6b4128, 1);
  g.fillCircle(32, 54, 7);
  g.fillStyle(0xb07a50, 1);
  g.fillRoundedRect(14, 64, 20, 5, 2);
  // Saiten
  g.lineStyle(1.5, 0xfff3d6, 1);
  g.lineBetween(22, 66, 72, 14);
  g.lineBetween(26, 67, 74, 16);
}

function drawFlute(g) {
  // Flöte schräg, mit Grifflöchern
  g.fillStyle(0x8fd3ff, 1);
  g.fillPoints([{ x: 8, y: 70 }, { x: 66, y: 12 }, { x: 74, y: 20 }, { x: 16, y: 78 }], true);
  g.fillStyle(0xbfe9ff, 1);
  g.fillPoints([{ x: 10, y: 70 }, { x: 66, y: 14 }, { x: 68, y: 16 }, { x: 12, y: 72 }], true);
  g.fillStyle(0xe0b04a, 1);
  g.fillCircle(70, 16, 6);
  g.fillStyle(0x3b5a7a, 1);
  for (let i = 0; i < 5; i++) g.fillCircle(24 + i * 9, 62 - i * 9, 2.6);
}

function drawTrumpet(g) {
  const gold = 0xf2c14e;
  // Rohr-Schleife
  g.lineStyle(6, gold, 1);
  g.strokeRoundedRect(20, 40, 36, 18, 9);
  // Mundstück → Trichter
  g.fillStyle(gold, 1);
  g.fillRoundedRect(4, 34, 52, 8, 4);
  g.fillPoints([{ x: 52, y: 32 }, { x: 76, y: 20 }, { x: 76, y: 56 }, { x: 52, y: 44 }], true);
  g.fillStyle(0xffe08a, 1);
  g.fillEllipse(76, 38, 8, 36);
  // Ventile
  g.fillStyle(0xd9a53a, 1);
  for (const x of [28, 36, 44]) g.fillRoundedRect(x - 2, 24, 5, 12, 2);
  g.fillStyle(0xfff3a8, 1);
  for (const x of [28, 36, 44]) g.fillCircle(x + 0.5, 23, 3);
}

function drawDancefloor(g, on) {
  const off = [0xf7c6d9, 0xc6e2f7, 0xfaf0bf, 0xd5e6c3, 0xd9c8f2];
  const lit = [0xff5fa8, 0x3fc8ff, 0xffd23f, 0x5fe08a, 0xa77bff];
  // Rand
  g.fillStyle(0x8a5a9a, 1);
  g.fillRoundedRect(0, 52, 320, 28, 8);
  // zwei Reihen Felder (vorne etwas größer)
  for (let row = 0; row < 2; row++) {
    const y = 54 + row * 12;
    const h = row ? 12 : 11;
    const n = 8;
    const inset = row ? 6 : 12;
    const w = (320 - inset * 2) / n;
    for (let i = 0; i < n; i++) {
      const k = (i + row * 2) % 5;
      g.fillStyle((on ? lit : off)[k], 1);
      g.fillRect(inset + i * w + 1, y, w - 2, h - 1);
    }
  }
  if (on) {
    g.fillStyle(0xffffff, 0.8);
    for (let i = 0; i < 6; i++) g.fillCircle(30 + i * 52, 58 + (i % 2) * 10, 2.5);
  }
}

function drawDiscoBall(g, on) {
  // Kette von oben
  g.lineStyle(3, 0x9a9ab0, 1);
  g.lineBetween(40, 0, 40, 22);
  // Kugel mit Facetten
  g.fillStyle(on ? 0xffffff : 0xd9dbe8, 1);
  g.fillCircle(40, 48, 26);
  const colors = on ? [0xff7ab8, 0x5fd3ff, 0xfff3a8, 0x7dffb2, 0xb39bff] : [0xbfc3d6, 0xeef0f8, 0xa9adc4];
  let k = 0;
  for (let y = 28; y <= 68; y += 8) {
    const half = Math.sqrt(Math.max(0, 26 * 26 - (y + 4 - 48) ** 2));
    for (let x = 40 - half + 2; x < 40 + half - 6; x += 8) {
      g.fillStyle(colors[k++ % colors.length], 1);
      g.fillRect(x, y, 6, 6);
    }
  }
  g.lineStyle(2, 0x8a8ea8, 1);
  g.strokeCircle(40, 48, 26);
  if (on) {
    g.fillStyle(0xffffff, 1);
    fillStar(g, 30, 36, 8, 2.5, 4);
  }
}

// ---- für jeden Raum ----

function drawPicture(g, v) {
  // Rahmen mit Aufhänger
  g.lineStyle(3, 0x9a7a5a, 1);
  g.lineBetween(56, 14, 80, 2);
  g.lineBetween(104, 14, 80, 2);
  g.fillStyle(0xe0b04a, 1);
  g.fillCircle(80, 3, 4);
  g.fillStyle(0xb07a50, 1);
  g.fillRoundedRect(4, 12, 152, 144, 10);
  g.fillStyle(0xe0b04a, 1);
  g.fillRoundedRect(10, 18, 140, 132, 7);
  const x0 = 18;
  const y0 = 26;
  const w = 124;
  const h = 116;
  if (v === 0) {
    // Nacht über den Hügeln
    g.fillStyle(0x3d3a8c, 1);
    g.fillRect(x0, y0, w, h);
    g.fillStyle(0xfff3a8, 1);
    g.fillCircle(112, 52, 14);
    g.fillStyle(0x3d3a8c, 1);
    g.fillCircle(118, 47, 12);
    g.fillStyle(0xffffff, 1);
    fillStar(g, 44, 46, 6, 2.5, 5);
    fillStar(g, 80, 38, 4, 1.8, 5);
    fillStar(g, 64, 66, 3, 1.4, 5);
    // Hügel als Halbkreise auf der Unterkante (bleiben im Bild)
    g.fillStyle(0x5fb468, 1);
    g.slice(54, 142, 46, Math.PI, 0, false);
    g.fillPath();
    g.fillStyle(0x4a9a58, 1);
    g.slice(118, 142, 38, Math.PI, 0, false);
    g.fillPath();
  } else if (v === 1) {
    // große Blume
    g.fillStyle(0xfff0f6, 1);
    g.fillRect(x0, y0, w, h);
    g.lineStyle(5, 0x5fb468, 1);
    g.lineBetween(80, 84, 80, 140);
    g.fillStyle(0x6fdc8c, 1);
    g.fillEllipse(96, 118, 30, 14);
    g.fillStyle(0xff7ab8, 1);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.fillCircle(80 + Math.cos(a) * 20, 70 + Math.sin(a) * 20, 14);
    }
    g.fillStyle(0xffd166, 1);
    g.fillCircle(80, 70, 12);
  } else if (v === 2) {
    // Pilzhaus
    g.fillStyle(0xc6e8ff, 1);
    g.fillRect(x0, y0, w, h);
    g.fillStyle(0x7dcf7a, 1);
    g.fillRect(x0, 120, w, 22);
    g.fillStyle(0xfff4e0, 1);
    g.fillRoundedRect(62, 80, 36, 46, 8);
    g.fillStyle(0xb07a50, 1);
    g.fillRoundedRect(73, 100, 14, 26, { tl: 7, tr: 7, bl: 0, br: 0 });
    g.fillStyle(0xe0566f, 1);
    g.slice(80, 84, 44, Math.PI, 0, false);
    g.fillPath();
    g.fillStyle(0xffffff, 1);
    g.fillCircle(62, 70, 6);
    g.fillCircle(84, 58, 7);
    g.fillCircle(102, 72, 5);
  } else {
    // Regenbogen mit Wolken
    g.fillStyle(0xe8f6ff, 1);
    g.fillRect(x0, y0, w, h);
    const bows = [0xff6f8f, 0xffb347, 0xffe066, 0x7dd97a, 0x6fb8ff, 0xa77bff];
    bows.forEach((c, i) => {
      g.lineStyle(7, c, 1);
      g.beginPath();
      g.arc(80, 128, 52 - i * 7, Math.PI, 0, false);
      g.strokePath();
    });
    g.fillStyle(0xffffff, 1);
    for (const [x, y] of [[34, 126], [44, 120], [54, 128], [108, 126], [118, 120], [128, 128]]) g.fillCircle(x, y, 11);
  }
}

function drawWindow(g, night) {
  const wood = 0xb07a50;
  // Rahmen (Rundbogen)
  g.fillStyle(wood, 1);
  g.fillRoundedRect(8, 4, 144, 142, { tl: 72, tr: 72, bl: 8, br: 8 });
  // Himmel: oben kräftiger, unten heller
  g.fillStyle(night ? 0x3d3a8c : 0x8fd0ff, 1);
  g.fillRoundedRect(20, 16, 120, 122, { tl: 60, tr: 60, bl: 4, br: 4 });
  g.fillStyle(night ? 0x5a4fb0 : 0xc4e8ff, 1);
  g.fillRect(20, 92, 120, 46);
  if (night) {
    // Mond und Sterne
    g.fillStyle(0xfff3a8, 1);
    g.fillCircle(104, 56, 16);
    g.fillStyle(0x3d3a8c, 1);
    g.fillCircle(111, 50, 14);
    g.fillStyle(0xffffff, 1);
    fillStar(g, 46, 50, 6, 2.5, 5);
    fillStar(g, 62, 90, 4, 1.8, 5);
    fillStar(g, 118, 106, 5, 2, 5);
    fillStar(g, 40, 112, 3, 1.4, 5);
  } else {
    // Sonne und Wolken
    g.fillStyle(0xffe066, 1);
    g.fillCircle(104, 52, 15);
    g.fillStyle(0xfff3a8, 1);
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      g.fillCircle(104 + Math.cos(a) * 23, 52 + Math.sin(a) * 23, 3.5);
    }
    g.fillStyle(0xffffff, 1);
    for (const [x, y, r] of [[38, 66, 9], [50, 60, 12], [62, 67, 9], [96, 110, 8], [107, 105, 10], [118, 111, 8]]) g.fillCircle(x, y, r);
    g.fillRect(38, 66, 24, 9);
    g.fillRect(96, 110, 22, 9);
  }
  // Blätter vor dem Fenster
  g.fillStyle(0x4a9a58, 1);
  g.fillEllipse(30, 132, 30, 14);
  g.fillEllipse(130, 128, 26, 12);
  // Sprossen
  g.fillStyle(wood, 1);
  g.fillRect(77, 16, 6, 122);
  g.fillRect(20, 84, 120, 6);
  // Glanz
  g.fillStyle(0xffffff, 0.18);
  g.fillPoints([{ x: 30, y: 74 }, { x: 58, y: 30 }, { x: 66, y: 34 }, { x: 38, y: 80 }], true);
  // Fensterbank
  g.fillStyle(0x9c6a43, 1);
  g.fillRoundedRect(0, 140, 160, 16, 6);
}

function drawRug(g, v) {
  const sets = [
    [0xff9ec7, 0xffc8e2, 0xffffff],
    [0x7fd6b0, 0xfff4e0, 0x7fd6b0],
    [0xb39bff, 0xd9c8f2, 0xffd166],
  ][v || 0];
  // flach auf dem Boden: liegt um die Bodenlinie (H = 80), reicht etwas in den Rand der Textur
  g.fillStyle(0x000000, 0.08);
  g.fillEllipse(120, 82, 236, 24);
  g.fillStyle(sets[0], 1);
  g.fillEllipse(120, 78, 232, 24);
  g.fillStyle(sets[1], 1);
  g.fillEllipse(120, 78, 180, 16);
  g.fillStyle(sets[2], 1);
  if (v === 2) {
    for (const x of [70, 120, 170]) g.fillCircle(x, 78, 4);
  } else {
    g.fillEllipse(120, 78, 110, 8);
  }
}

function drawCeilingLamp(g, on) {
  g.lineStyle(3, 0x6b4128, 1);
  g.lineBetween(40, 0, 40, 30);
  g.fillStyle(0x8a5a3b, 1);
  g.fillRoundedRect(30, 0, 20, 6, 3);
  if (on) {
    g.fillStyle(0xfff3a8, 0.35);
    g.fillCircle(40, 60, 22);
  }
  // Glühbirne unter dem Schirm
  g.fillStyle(on ? 0xfff3a8 : 0xe8e0d0, 1);
  g.fillCircle(40, 58, 9);
  // Schirm (Glocke)
  g.fillStyle(0xff9ec7, 1);
  g.fillPoints([{ x: 16, y: 56 }, { x: 64, y: 56 }, { x: 52, y: 30 }, { x: 28, y: 30 }], true);
  g.fillStyle(0xff7ab8, 1);
  g.fillRoundedRect(14, 52, 52, 7, 3);
  g.fillStyle(0xffffff, 0.6);
  g.fillCircle(30, 42, 3);
  g.fillCircle(40, 38, 3);
  g.fillCircle(50, 42, 3);
}

function drawCandle(g, on) {
  // Teller
  g.fillStyle(0xe0b04a, 1);
  g.fillEllipse(40, 74, 54, 12);
  g.fillRoundedRect(58, 66, 14, 6, 3);
  // Kerze
  g.fillStyle(0xfff4e0, 1);
  g.fillRoundedRect(31, 34, 18, 40, 4);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(33, 34, 5, 16, 2);
  g.fillCircle(46, 40, 3);
  g.lineStyle(2, 0x3b2a4a, 1);
  g.lineBetween(40, 34, 40, 27);
  if (on) {
    g.fillStyle(0xff9a3c, 1);
    g.fillEllipse(40, 20, 13, 22);
    g.fillStyle(0xffe066, 1);
    g.fillEllipse(40, 24, 7, 12);
  }
}

function drawVase(g) {
  // Blumen
  g.lineStyle(3, 0x4a9a58, 1);
  g.lineBetween(40, 46, 26, 16);
  g.lineBetween(40, 46, 40, 10);
  g.lineBetween(40, 46, 56, 18);
  g.fillStyle(0x6fdc8c, 1);
  g.fillEllipse(30, 34, 14, 7);
  g.fillEllipse(52, 32, 14, 7);
  const tulip = (x, y, c) => {
    g.fillStyle(c, 1);
    g.fillEllipse(x, y + 2, 16, 16);
    g.fillTriangle(x - 8, y + 2, x - 4, y - 9, x, y);
    g.fillTriangle(x, y, x + 4, y - 9, x + 8, y + 2);
  };
  tulip(26, 14, 0xff7ab8);
  tulip(40, 8, 0xffd166);
  tulip(56, 16, 0xb39bff);
  // Vase
  g.fillStyle(0x8fd3ff, 1);
  g.fillEllipse(40, 62, 36, 32);
  g.fillRoundedRect(31, 40, 18, 16, 4);
  g.fillStyle(0x6fb8ee, 1);
  g.fillRoundedRect(29, 38, 22, 6, 3);
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(32, 60, 3);
  g.fillCircle(44, 66, 3);
  g.fillCircle(38, 72, 2);
}
