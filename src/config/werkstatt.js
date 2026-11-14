// Werkstatt und Turnraum (Raumtypen 'werkstatt' und 'turnraum', siehe config/rooms.js). Gezeichnet, bis es
// gemalte Bilder gibt (dann sprite: '<name>' ergänzen, die Zeichnung bleibt als Ersatz).
// Rollen für die Feen (activities/werkstatt.js, activities/turnraum.js):
//   workbench: hier wird gebastelt (Art-Punkt über der Platte)   tools: Werkzeug zum Holen (Hammer)
//   apronRack: Garderobe mit Arbeitsschürzen (vor der Arbeit anziehen)   saw: Sägebock mit großer Säge
//   medball: Medizinball (stemmen)   rings: Turnringe (Art-Punkt der Ringe)   mat: Turnmatte (Purzelbäume)
//   vault: Turnkasten (drüberspringen)   climb: Kletterwand (holds = Griffe von unten nach oben, Art-Punkte)

import { fillStar } from '../systems/draw.js';

const INK = 0x4a2a18;
const WOOD = 0xc98b5a;
const WOOD_L = 0xe0a872;
const WOOD_D = 0x9c6a43;
const METAL = 0xb9c4d0;
const METAL_D = 0x7d8a99;

function outline(g, w = 4) {
  g.lineStyle(w, INK, 1);
}

// kleine Werkzeuge (auch einzeln als Bild, das die Fee trägt: siehe toolTextures)
function hammer(g, x, y, s = 1, angle = 0) {
  const c = Math.cos(angle);
  const sn = Math.sin(angle);
  const P = (px, py) => ({ x: x + (px * c - py * sn) * s, y: y + (px * sn + py * c) * s });
  g.fillStyle(WOOD_L, 1);
  g.fillPoints([P(-3, 0), P(3, 0), P(3, 30), P(-3, 30)], true);
  g.fillStyle(METAL_D, 1);
  g.fillPoints([P(-12, -6), P(12, -6), P(12, 4), P(-12, 4)], true);
  g.fillStyle(METAL, 1);
  g.fillPoints([P(-11, -5), P(11, -5), P(11, -1), P(-11, -1)], true);
}

function wrench(g, x, y, s = 1) {
  g.fillStyle(METAL_D, 1);
  g.fillRoundedRect(x - 3 * s, y, 6 * s, 28 * s, 3 * s);
  g.fillCircle(x, y, 8 * s);
  g.fillStyle(0xfff4e0, 1);
  g.fillRect(x - 3 * s, y - 9 * s, 6 * s, 8 * s);
}

function screwdriver(g, x, y, color) {
  g.fillStyle(color, 1);
  g.fillRoundedRect(x - 5, y, 10, 16, 4);
  g.fillStyle(METAL, 1);
  g.fillRect(x - 1.5, y + 16, 3, 16);
}

function handsaw(g, x, y, s = 1) {
  g.fillStyle(METAL, 1);
  g.fillPoints([{ x: x, y: y }, { x: x + 10 * s, y: y }, { x: x + 4 * s, y: y + 40 * s }, { x: x - 2 * s, y: y + 40 * s }], true);
  g.lineStyle(1.5, METAL_D, 1);
  for (let i = 0; i < 6; i++) g.lineBetween(x - 2 * s + i * 0.4 * s, y + 6 * s + i * 6 * s, x - 5 * s, y + 8 * s + i * 6 * s);
  g.fillStyle(0xe0566f, 1);
  g.fillRoundedRect(x - 2 * s, y - 14 * s, 14 * s, 16 * s, 5 * s);
  g.fillStyle(0xfff4e0, 1);
  g.fillCircle(x + 5 * s, y - 6 * s, 3 * s);
}

// Holzstamm von der Seite (Ende rund mit Jahresringen)
function log(g, x0, x1, cy, r) {
  g.fillStyle(0x9c6a43, 1);
  g.fillRect(x0, cy - r, x1 - x0, r * 2);
  g.fillCircle(x0, cy, r);
  g.lineStyle(2, 0x7a4e2e, 1);
  g.lineBetween(x0 + 10, cy - r * 0.4, x1 - 30, cy - r * 0.3);
  g.lineBetween(x0 + 30, cy + r * 0.35, x1 - 10, cy + r * 0.4);
  ringEnd(g, x1, cy, r);
}

function ringEnd(g, x, cy, r) {
  g.fillStyle(0xf2cf96, 1);
  g.fillEllipse(x, cy, r * 1.1, r * 2);
  g.lineStyle(2, 0xc98b5a, 1);
  g.strokeEllipse(x, cy, r * 0.7, r * 1.3);
  g.strokeEllipse(x, cy, r * 0.3, r * 0.6);
  outline(g, 3);
  g.strokeEllipse(x, cy, r * 1.1, r * 2);
}

// große Bügelsäge (auch als Bild, das die Fee beim Sägen führt); Griff rechts bei (x, y)
function bowSaw(g, x, y) {
  // Bügel
  g.lineStyle(7, 0xe0566f, 1);
  g.beginPath();
  g.moveTo(x - 6, y);
  g.lineTo(x - 6, y - 30);
  g.lineTo(x - 124, y - 30);
  g.lineTo(x - 124, y);
  g.strokePath();
  // Blatt mit Zähnen
  g.fillStyle(METAL, 1);
  g.fillRect(x - 126, y - 2, 122, 8);
  g.fillStyle(METAL_D, 1);
  for (let i = 0; i < 15; i++) g.fillTriangle(x - 124 + i * 8, y + 6, x - 116 + i * 8, y + 6, x - 120 + i * 8, y + 12);
  // Griff
  g.fillStyle(WOOD_L, 1);
  g.fillRoundedRect(x - 10, y - 8, 22, 18, 7);
  outline(g, 2.5);
  g.strokeRoundedRect(x - 10, y - 8, 22, 18, 7);
}

function drawSawhorse(g, W, H, withSaw) {
  // Sägebock: zwei X-Beine
  for (const cx of [60, W - 60]) {
    g.lineStyle(12, WOOD_D, 1);
    g.lineBetween(cx - 30, H, cx + 26, H - 78);
    g.lineBetween(cx + 30, H, cx - 26, H - 78);
    g.lineStyle(3, INK, 1);
    g.strokeCircle(cx, H - 40, 5);
  }
  // Stamm liegt in den Gabeln
  log(g, 30, W - 30, H - 86, 24);
  // Kreide-Strich, wo gesägt wird
  g.lineStyle(3, 0xffffff, 0.9);
  g.lineBetween(W - 70, H - 108, W - 70, H - 64);
  // Sägemehl am Boden
  g.fillStyle(0xf2cf96, 1);
  g.fillEllipse(W - 70, H - 4, 60, 10);
  if (withSaw) bowSaw(g, W - 30, H - 114);
}

// Arbeitsschürze am Haken (Farbe, x Mitte, y Haken)
function apron(g, x, y, color) {
  g.lineStyle(3, color, 1);
  g.strokeCircle(x, y + 10, 9);
  g.fillStyle(color, 1);
  g.fillRoundedRect(x - 12, y + 14, 24, 16, 4);
  g.fillPoints([{ x: x - 12, y: y + 28 }, { x: x + 12, y: y + 28 }, { x: x + 20, y: y + 74 }, { x: x - 20, y: y + 74 }], true);
  g.fillStyle(0xffffff, 0.35);
  g.fillRoundedRect(x - 12, y + 44, 24, 16, 4); // Tasche
  outline(g, 2.5);
  g.strokeRoundedRect(x - 12, y + 44, 24, 16, 4);
  g.lineStyle(2, METAL_D, 1);
  g.lineBetween(x - 4, y + 40, x - 4, y + 50); // Bleistift in der Tasche
  g.fillStyle(0xffd166, 1);
  g.fillRect(x + 2, y + 38, 4, 10);
}

function medball(g, W, H, v) {
  const cols = [0xc9572f, 0x4f8fd9, 0x5fae4a][v % 3];
  const r = 30;
  const cx = W / 2;
  const cy = H - r - 2;
  g.fillStyle(0x7a4fa0, 0.15);
  g.fillEllipse(cx, H - 3, 56, 10);
  g.fillStyle(cols, 1);
  g.fillCircle(cx, cy, r);
  g.lineStyle(3, 0x000000, 0.25);
  g.beginPath();
  g.arc(cx - r * 1.3, cy, r * 1.1, -0.75, 0.75);
  g.strokePath();
  g.beginPath();
  g.arc(cx + r * 1.3, cy, r * 1.1, Math.PI - 0.75, Math.PI + 0.75);
  g.strokePath();
  g.fillStyle(0xffffff, 0.35);
  g.fillEllipse(cx - 10, cy - 14, 16, 9);
  outline(g, 3.5);
  g.strokeCircle(cx, cy, r);
}

function drawRings(g, W, H) {
  // Deckenhalter, zwei Seile, zwei Ringe
  g.fillStyle(METAL_D, 1);
  g.fillRoundedRect(W / 2 - 30, 0, 60, 8, 3);
  for (const x of [W / 2 - 18, W / 2 + 18]) {
    g.lineStyle(4, 0xe0c497, 1);
    g.lineBetween(x, 6, x, H - 46);
    g.fillStyle(0x9c6a43, 1);
    g.fillRoundedRect(x - 4, H - 52, 8, 12, 3);
    g.lineStyle(7, 0xd9894a, 1);
    g.strokeCircle(x, H - 26, 13);
    g.lineStyle(2, INK, 1);
    g.strokeCircle(x, H - 26, 16.5);
  }
}

function drawMat(g, W, H) {
  const top = H - 28;
  g.fillStyle(0x2f6fb5, 1);
  g.fillRoundedRect(4, top + 6, W - 8, 22, 8);
  g.fillStyle(0x4f8fd9, 1);
  g.fillRoundedRect(4, top, W - 8, 20, 8);
  g.lineStyle(2, 0x2f6fb5, 1);
  for (const x of [W / 3, (2 * W) / 3]) g.lineBetween(x, top + 2, x, top + 26);
  g.fillStyle(0xffffff, 0.3);
  g.fillRoundedRect(14, top + 3, W - 28, 5, 3);
  outline(g, 3);
  g.strokeRoundedRect(4, top, W - 8, 28, 8);
}

function drawVaultBox(g, W, H) {
  const top = 20;
  const parts = 4;
  const ph = (H - top - 26) / parts;
  // Stufen werden nach unten etwas breiter
  for (let i = 0; i < parts; i++) {
    const inset = 18 - i * 4;
    const y = top + 26 + i * ph;
    g.fillStyle(i % 2 ? WOOD : WOOD_L, 1);
    g.fillRect(inset, y, W - inset * 2, ph);
    g.lineStyle(2.5, WOOD_D, 1);
    g.strokeRect(inset, y, W - inset * 2, ph);
    if (i === 1) {
      g.fillStyle(0x6b4128, 1);
      g.fillRoundedRect(W / 2 - 24, y + ph / 2 - 6, 48, 12, 6); // Griffloch
    }
  }
  // gepolsterter Deckel
  g.fillStyle(0xfff4e0, 1);
  g.fillRoundedRect(14, top, W - 28, 30, 12);
  g.lineStyle(2, 0xe0c497, 1);
  for (let x = 36; x < W - 30; x += 26) g.strokeCircle(x, top + 15, 2);
  outline(g, 3.5);
  g.strokeRoundedRect(14, top, W - 28, 30, 12);
}

// Griffe der Kletterwand (Art-Koordinaten, von unten nach oben) und ihre Farben
const HOLDS = [
  [48, 290, 0xff7ab8], [108, 262, 0xffd166], [52, 226, 0x5fd3ff], [112, 192, 0x7dffb2],
  [44, 158, 0xff9a3c], [104, 124, 0x9b7bff], [56, 90, 0xff7ab8], [100, 56, 0xffd166],
];

function drawClimbingWall(g, W, H) {
  g.fillStyle(0xe0a872, 1);
  g.fillRoundedRect(8, 20, W - 16, H - 20, 10);
  g.lineStyle(2, WOOD_D, 1);
  for (let y = 80; y < H; y += 60) g.lineBetween(10, y, W - 10, y);
  g.lineBetween(W / 2, 22, W / 2, H);
  outline(g, 4);
  g.strokeRoundedRect(8, 20, W - 16, H - 20, 10);
  for (const [x, y, c] of HOLDS) {
    g.fillStyle(c, 1);
    g.fillEllipse(x, y, 22, 16);
    g.fillStyle(0xffffff, 0.45);
    g.fillCircle(x - 4, y - 3, 3);
    outline(g, 2);
    g.strokeEllipse(x, y, 22, 16);
  }
  // Glocke ganz oben (wird beim Ankommen geläutet)
  g.fillStyle(0xffd166, 1);
  g.fillCircle(W - 34, 10, 12);
  g.fillRect(W - 46, 8, 24, 10);
  g.fillStyle(0xc99a2e, 1);
  g.fillCircle(W - 34, 20, 4);
  g.fillStyle(0xfff3a8, 1);
  fillStar(g, 30, 8, 9, 4, 5);
}

export const WORKSHOP_FURNITURE = {
  // ======== Werkstatt ========
  werkbank: {
    id: 'werkbank',
    name: 'Werkbank',
    kind: 'floor',
    w: 3,
    h: 2,
    surfaces: [{ y: 1.25, x0: 0, x1: 3 }], // Arbeitsplatte
    workbench: { x: 120, y: 54 },
    draw(g, W, H) {
      const top = H - 100;
      // Beine und untere Ablage mit Brettern
      g.fillStyle(WOOD_D, 1);
      for (const x of [16, W - 34]) g.fillRect(x, top + 16, 18, H - top - 16);
      g.fillStyle(WOOD, 1);
      g.fillRect(16, H - 30, W - 32, 10);
      for (const [x, c] of [[40, 0xe0a872], [56, 0xd9a066], [72, 0xf2cf96]]) {
        g.fillStyle(c, 1);
        g.fillRect(x, H - 64, 14, 34);
      }
      // Platte
      g.fillStyle(WOOD_L, 1);
      g.fillRoundedRect(4, top, W - 8, 20, 5);
      g.lineStyle(2, WOOD_D, 1);
      g.lineBetween(30, top + 10, 90, top + 10);
      g.lineBetween(130, top + 8, W - 30, top + 8);
      outline(g, 3.5);
      g.strokeRoundedRect(4, top, W - 8, 20, 5);
      // Schraubstock rechts
      g.fillStyle(METAL_D, 1);
      g.fillRect(W - 40, top - 22, 28, 24);
      g.fillStyle(METAL, 1);
      g.fillRect(W - 38, top - 20, 10, 20);
      g.lineStyle(4, METAL_D, 1);
      g.lineBetween(W - 12, top - 10, W + 2, top - 10);
      g.fillStyle(METAL_D, 1);
      g.fillCircle(W + 4, top - 10, 4);
    },
  },

  werkzeugkasten: {
    id: 'werkzeugkasten',
    name: 'Werkzeuge',
    kind: 'small',
    w: 1,
    h: 1,
    tools: true,
    draw(g, W, H) {
      // herausschauendes Werkzeug
      hammer(g, 26, H - 50, 0.8, -0.3);
      screwdriver(g, 50, H - 62, 0x5fb8ff);
      // Kasten mit Griff
      g.lineStyle(5, METAL_D, 1);
      g.strokeRoundedRect(26, H - 54, 28, 16, 6);
      g.fillStyle(0xe0566f, 1);
      g.fillRoundedRect(6, H - 40, W - 12, 38, 6);
      g.fillStyle(0xc9445c, 1);
      g.fillRect(6, H - 28, W - 12, 4);
      g.fillStyle(METAL, 1);
      g.fillRoundedRect(W / 2 - 6, H - 30, 12, 8, 2);
      outline(g, 3);
      g.strokeRoundedRect(6, H - 40, W - 12, 38, 6);
    },
  },

  werkzeugleiste: {
    id: 'werkzeugleiste',
    name: 'Werkzeugleiste',
    kind: 'wall',
    w: 2,
    h: 1,
    tools: true,
    draw(g, W, H) {
      // Lochbrett mit Haken
      g.fillStyle(0xf2cf96, 1);
      g.fillRoundedRect(4, 8, W - 8, H - 16, 8);
      g.fillStyle(0xc98b5a, 1);
      for (let x = 18; x < W - 10; x += 16) for (let y = 18; y < H - 12; y += 16) g.fillCircle(x, y, 2);
      outline(g, 3.5);
      g.strokeRoundedRect(4, 8, W - 8, H - 16, 8);
      hammer(g, 30, 22, 0.9, 0);
      handsaw(g, 64, 24, 0.9);
      wrench(g, 100, 22, 0.9);
      screwdriver(g, 124, 14, 0xffd166);
      screwdriver(g, 140, 18, 0x7dffb2);
    },
  },

  saege: {
    id: 'saege',
    name: 'Große Säge',
    kind: 'floor',
    w: 3,
    h: 2,
    // grip: Griff der Säge (Art-Punkt, dort fasst die Fee an), cut: Sägestelle am Stamm
    saw: { grip: { x: 210, y: 46 }, cut: { x: 170, y: 74 } },
    draw: (g, W, H) => drawSawhorse(g, W, H, true),
    states: { use: (g, W, H) => drawSawhorse(g, W, H, false) }, // die Fee hat die Säge in der Hand
  },

  schuerzengarderobe: {
    id: 'schuerzengarderobe',
    name: 'Garderobe',
    kind: 'floor',
    w: 1,
    h: 3,
    apronRack: { x: 40, y: 120 },
    draw(g, W, H) {
      // Ständer mit Fuß und Hakenkranz
      g.fillStyle(WOOD_D, 1);
      g.fillRoundedRect(W / 2 - 5, 30, 10, H - 40, 4);
      g.fillEllipse(W / 2, H - 6, 64, 14);
      g.fillStyle(WOOD, 1);
      g.fillCircle(W / 2, 28, 9);
      g.lineStyle(5, WOOD_D, 1);
      g.lineBetween(W / 2, 50, W / 2 - 26, 40);
      g.lineBetween(W / 2, 50, W / 2 + 26, 40);
      apron(g, W / 2 - 18, 38, 0x4f8fd9);
      apron(g, W / 2 + 18, 38, 0x5fae4a);
      apron(g, W / 2, 46, 0xd9894a);
    },
  },

  // ======== Turnraum ========
  medizinball: {
    id: 'medizinball',
    name: 'Medizinball',
    kind: 'small',
    w: 1,
    h: 1,
    variants: 3,
    medball: true,
    draw: medball,
  },

  turnringe: {
    id: 'turnringe',
    name: 'Turnringe',
    kind: 'wall',
    w: 1,
    h: 2,
    ceiling: true,
    rings: { x: 40, y: 134 },
    draw: drawRings,
  },

  turnmatte: {
    id: 'turnmatte',
    name: 'Turnmatte',
    kind: 'rug', // liegt flach am Boden; Kasten und Bälle dürfen darauf stehen
    w: 3,
    h: 1,
    mat: true,
    draw: drawMat,
  },

  turnkasten: {
    id: 'turnkasten',
    name: 'Turnkasten',
    kind: 'floor',
    w: 2,
    h: 2,
    surfaces: [{ y: 1.75, x0: 0, x1: 2 }], // oben drauf
    vault: true,
    draw: drawVaultBox,
  },

  kletterwand: {
    id: 'kletterwand',
    name: 'Kletterwand',
    kind: 'floor',
    w: 2,
    h: 4,
    climb: { holds: HOLDS.map(([x, y]) => ({ x, y })), bell: { x: 126, y: 12 } },
    draw: drawClimbingWall,
  },
};

// Bilder, die die Feen bei der Arbeit tragen oder herstellen (activities/werkstatt.js backt sie bei Bedarf)
export const TOOL_ART = {
  // Ursprung am Griffende (die Fee hält ihn dort, der Kopf zeigt nach oben)
  'tool-hammer': { w: 60, h: 70, ox: 30, oy: 62, draw: (g) => hammer(g, 0, -48, 1.6, 0) },
  // Griff im Ursprung, die Säge ragt nach links
  'tool-bowsaw': { w: 150, h: 60, ox: 140, oy: 40, draw: (g) => bowSaw(g, 0, 0) },
  'craft-slice': { w: 60, h: 60, ox: 30, oy: 30, draw: (g) => ringEnd(g, 0, 0, 22) },
  'craft-star': {
    w: 60, h: 60, ox: 30, oy: 30,
    draw(g) {
      g.fillStyle(WOOD_L, 1);
      fillStar(g, 0, 0, 26, 12, 5);
      g.fillStyle(0xff7ab8, 1);
      g.fillCircle(0, 0, 5);
    },
  },
  'craft-boat': {
    w: 70, h: 64, ox: 35, oy: 40,
    draw(g) {
      g.fillStyle(WOOD, 1);
      g.fillPoints([{ x: -30, y: 4 }, { x: 30, y: 4 }, { x: 20, y: 20 }, { x: -20, y: 20 }], true);
      g.fillStyle(WOOD_D, 1);
      g.fillRect(-2, -34, 4, 38);
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(2, -32, 2, 0, 24, 0);
      g.fillStyle(0xff7ab8, 1);
      g.fillTriangle(-2, -26, -2, -4, -18, -4);
    },
  },
  'craft-house': {
    w: 64, h: 70, ox: 32, oy: 40,
    draw(g) {
      g.fillStyle(WOOD_L, 1);
      g.fillRect(-18, -10, 36, 34);
      g.fillStyle(0xe0566f, 1);
      g.fillTriangle(-26, -8, 26, -8, 0, -34);
      g.fillStyle(0x6b4128, 1);
      g.fillCircle(0, 4, 7);
      g.fillRect(-2, 14, 4, 12);
    },
  },
};
