// Malatelier (Raumtyp 'atelier', siehe config/rooms.js). Gezeichnet, bis es gemalte Bilder gibt
// (dann sprite: '<name>' ergänzen, die Zeichnung bleibt als Ersatz).
// Rollen für die Feen (activities/atelier.js):
//   easel: Staffelei, canvas = Malfläche (Art-Rechteck) – hier entsteht ein Bild, das danach an die Wand kommt
//   paints: Farbtöpfe (colors = die Farben zum Eintauchen)   brushes: Pinselbecher (Pinsel holen)
//   wheel: Töpferscheibe (Art-Punkt der Scheibe) – hier entsteht eine Vase

import { fillStar } from '../systems/draw.js';

const INK = 0x4a2a18;
const WOOD = 0xc98b5a;
const WOOD_L = 0xe0a872;
const WOOD_D = 0x9c6a43;
const METAL = 0xb9c4d0;
const CLAY = 0xd9824f;
const CLAY_D = 0xb8653a;

export const PAINT_COLORS = [0xff5f8f, 0x5fb8ff, 0xffd23f, 0x6fdc8c, 0x9b7bff];

function outline(g, w = 4) {
  g.lineStyle(w, INK, 1);
}

// Pinsel waagerecht, Spitze links, Griffende im Ursprung (0, 0)
function brush(g, x, y, s = 1, tip = 0xff5f8f) {
  g.fillStyle(WOOD_L, 1);
  g.fillRoundedRect(x - 34 * s, y - 3 * s, 34 * s, 6 * s, 3 * s);
  g.fillStyle(METAL, 1);
  g.fillRect(x - 44 * s, y - 4 * s, 11 * s, 8 * s);
  g.fillStyle(tip, 1);
  g.fillTriangle(x - 44 * s, y - 5 * s, x - 44 * s, y + 5 * s, x - 58 * s, y);
}

function drawEasel(g, W, H) {
  // Beine: zwei vorne, eines hinten
  g.lineStyle(10, WOOD_D, 1);
  g.lineBetween(W / 2, 14, W / 2, H - 4);
  g.lineStyle(12, WOOD, 1);
  g.lineBetween(W / 2, 8, 24, H);
  g.lineBetween(W / 2, 8, W - 24, H);
  // Leiste, auf der die Leinwand steht
  g.fillStyle(WOOD, 1);
  g.fillRoundedRect(14, 150, W - 28, 12, 4);
  outline(g, 3);
  g.strokeRoundedRect(14, 150, W - 28, 12, 4);
  // Leinwand mit zarter Vorzeichnung
  g.fillStyle(0xfffdf6, 1);
  g.fillRect(22, 40, W - 44, 110);
  g.lineStyle(2, 0xd8cbb8, 1);
  g.strokeCircle(W / 2 - 14, 80, 16);
  g.lineBetween(36, 132, W - 36, 126);
  g.lineStyle(5, WOOD_L, 1);
  g.strokeRect(22, 40, W - 44, 110);
  outline(g, 3);
  g.strokeRect(19, 37, W - 38, 116);
  // ein Farbklecks unten am Bein
  g.fillStyle(0xff5f8f, 1);
  g.fillCircle(36, H - 30, 5);
  g.fillStyle(0x5fb8ff, 1);
  g.fillCircle(W - 34, H - 50, 4);
}

function drawPaintPots(g, W, H) {
  const pots = [[20, 0xff5f8f], [40, 0x5fb8ff], [60, 0xffd23f]];
  for (const [x, c] of pots) {
    const top = H - 34 - (x === 40 ? 6 : 0);
    g.fillStyle(0xf4f1ea, 1);
    g.fillRoundedRect(x - 13, top, 26, H - top - 4, 5);
    g.fillStyle(c, 1);
    g.fillEllipse(x, top + 2, 26, 9);
    g.fillRoundedRect(x - 4, top + 2, 7, 12, 3); // heruntergelaufene Farbe
    outline(g, 2.5);
    g.strokeRoundedRect(x - 13, top, 26, H - top - 4, 5);
  }
}

function drawBrushCup(g, W, H) {
  // Pinsel schauen heraus
  const tips = [[28, -0.35, 0x9b7bff], [40, 0, 0x6fdc8c], [52, 0.35, 0xff5f8f]];
  for (const [x, a, c] of tips) {
    const tx = x + Math.sin(a) * 38;
    const ty = H - 30 - Math.cos(a) * 38;
    g.lineStyle(5, WOOD_L, 1);
    g.lineBetween(x, H - 30, tx, ty);
    g.fillStyle(c, 1);
    g.fillCircle(tx, ty, 5);
  }
  // Becher
  g.fillStyle(0x8fd3ff, 1);
  g.fillPoints([{ x: 20, y: H - 40 }, { x: 60, y: H - 40 }, { x: 56, y: H - 4 }, { x: 24, y: H - 4 }], true);
  g.fillStyle(0xffffff, 0.5);
  g.fillRect(28, H - 34, 5, 24);
  g.fillStyle(0xffd23f, 1);
  fillStar(g, 46, H - 22, 7, 3, 5);
  outline(g, 2.5);
  g.strokePoints([{ x: 20, y: H - 40 }, { x: 60, y: H - 40 }, { x: 56, y: H - 4 }, { x: 24, y: H - 4 }], true);
}

function drawWheel(g, W, H, spinning) {
  // Holzkasten mit Fußrad
  g.fillStyle(WOOD, 1);
  g.fillRoundedRect(28, 104, W - 56, H - 108, 8);
  g.fillStyle(WOOD_L, 1);
  g.fillRect(36, 116, W - 72, 8);
  outline(g, 3);
  g.strokeRoundedRect(28, 104, W - 56, H - 108, 8);
  g.fillStyle(WOOD_D, 1);
  g.fillEllipse(W / 2, H - 8, 70, 12);
  // Achse und Scheibe
  g.fillStyle(METAL, 1);
  g.fillRect(W / 2 - 5, 94, 10, 14);
  g.fillStyle(0x9aa6b4, 1);
  g.fillEllipse(W / 2, 98, 124, 24);
  g.fillStyle(0xc9d3dd, 1);
  g.fillEllipse(W / 2, 94, 120, 20);
  outline(g, 2.5);
  g.strokeEllipse(W / 2, 94, 120, 20);
  if (spinning) {
    g.lineStyle(3, 0xffffff, 0.9);
    g.beginPath();
    g.arc(W / 2, 94, 52, 0.2, 1.3);
    g.strokePath();
    g.beginPath();
    g.arc(W / 2, 94, 52, Math.PI + 0.2, Math.PI + 1.3);
    g.strokePath();
  }
  // Tonspritzer am Kasten
  g.fillStyle(CLAY, 1);
  g.fillCircle(46, 136, 4);
  g.fillCircle(W - 50, 146, 3);
}

function drawClothesline(g, W, H) {
  // Leine mit drei Kinderbildern an Klammern
  g.lineStyle(3, WOOD_D, 1);
  g.beginPath();
  g.moveTo(6, 12);
  g.lineTo(W / 2, 20);
  g.lineTo(W - 6, 12);
  g.strokePath();
  g.fillStyle(WOOD_D, 1);
  g.fillCircle(6, 12, 5);
  g.fillCircle(W - 6, 12, 5);
  const sheets = [
    [44, 0xfff6c8, (x, y) => {
      g.fillStyle(0xffd23f, 1);
      g.fillCircle(x, y, 10);
      g.lineStyle(3, 0xffb347, 1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.lineBetween(x + Math.cos(a) * 13, y + Math.sin(a) * 13, x + Math.cos(a) * 19, y + Math.sin(a) * 19);
      }
    }],
    [120, 0xe8f6ff, (x, y) => {
      g.lineStyle(3, 0x5fae4a, 1);
      g.lineBetween(x, y + 20, x, y - 2);
      g.fillStyle(0xff7ab8, 1);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        g.fillCircle(x + Math.cos(a) * 8, y - 6 + Math.sin(a) * 8, 6);
      }
      g.fillStyle(0xffd23f, 1);
      g.fillCircle(x, y - 6, 5);
    }],
    [196, 0xfff0f6, (x, y) => {
      g.fillStyle(0xff5f8f, 1);
      g.fillCircle(x - 7, y - 4, 8);
      g.fillCircle(x + 7, y - 4, 8);
      g.fillTriangle(x - 15, y - 1, x + 15, y - 1, x, y + 16);
    }],
  ];
  for (const [x, paper, motif] of sheets) {
    const y = 16 + (1 - Math.abs(x - W / 2) / (W / 2)) * 6;
    g.fillStyle(paper, 1);
    g.fillRect(x - 26, y, 52, 56);
    outline(g, 2);
    g.strokeRect(x - 26, y, 52, 56);
    motif(x, y + 28);
    g.fillStyle(0xe0566f, 1);
    g.fillRoundedRect(x - 4, y - 8, 8, 16, 3); // Klammer
  }
}

export const ATELIER_FURNITURE = {
  staffelei: {
    id: 'staffelei',
    name: 'Staffelei',
    sprite: 'staffelei', // gemalt (Lieferung 6); draw ist der Ersatz ohne Bild
    kind: 'floor',
    w: 2,
    h: 3,
    // Malfläche in Art-Koordinaten (dorthin kommen die Farbtupfer) – die weiße Leinwand im Bild
    easel: { x0: 32, x1: 128, y0: 56, y1: 130 },
    draw: drawEasel,
  },

  farbtoepfe: {
    id: 'farbtoepfe',
    name: 'Farbtöpfe',
    kind: 'small',
    w: 1,
    h: 1,
    paints: { colors: PAINT_COLORS, dip: { x: 40, y: 40 } },
    draw: drawPaintPots,
  },

  pinselbecher: {
    id: 'pinselbecher',
    name: 'Pinselbecher',
    kind: 'small',
    w: 1,
    h: 1,
    brushes: { x: 40, y: 20 },
    draw: drawBrushCup,
  },

  toepferscheibe: {
    id: 'toepferscheibe',
    name: 'Töpferscheibe',
    kind: 'floor',
    w: 2,
    h: 2,
    wheel: { x: 80, y: 92 }, // Mitte der Scheibe (dort wächst der Ton)
    draw: (g, W, H) => drawWheel(g, W, H, false),
    states: { on: (g, W, H) => drawWheel(g, W, H, true) },
  },

  trockenleine: {
    id: 'trockenleine',
    name: 'Bilderleine',
    kind: 'wall',
    w: 3,
    h: 1,
    draw: drawClothesline,
  },
};

// Bilder, die die Feen beim Malen und Töpfern benutzen (activities/atelier.js backt sie bei Bedarf)
// ox/oy = Ursprung (dort hält die Fee bzw. dort sitzt es)
export const ATELIER_ART = {
  'tool-brush': { w: 70, h: 20, ox: 64, oy: 10, draw: (g) => brush(g, 0, 0, 1, 0xfff4e0) },
  // Farbtupfer (weiß, wird eingefärbt)
  'paint-dab': {
    w: 40, h: 30, ox: 20, oy: 15,
    draw(g) {
      g.fillStyle(0xffffff, 1);
      g.fillEllipse(0, 0, 30, 18);
      g.fillCircle(-12, 4, 6);
      g.fillCircle(13, -3, 5);
    },
  },
  // Ton auf der Scheibe: Ursprung unten Mitte
  'clay-lump': {
    w: 70, h: 80, ox: 35, oy: 76,
    draw(g) {
      g.fillStyle(CLAY, 1);
      g.fillEllipse(0, -26, 44, 50);
      g.fillRoundedRect(-16, -58, 32, 20, 8);
      g.fillStyle(CLAY_D, 1);
      g.fillEllipse(0, -60, 30, 8);
      g.fillStyle(0xffffff, 0.3);
      g.fillEllipse(-10, -30, 8, 22);
      g.lineStyle(2, CLAY_D, 1);
      g.strokeEllipse(0, -18, 40, 8);
    },
  },
};
