// Teesalon (Raumtyp 'teesalon', siehe config/rooms.js). Gezeichnet, bis es gemalte Bilder gibt.
// Rollen für die Feen (activities/teesalon.js):
//   teatable: Pilz-Teetisch; top = Höhe der Tischplatte (Art-y), seats = Plätze rundherum (Art-Punkte)
//   teapot: Teekanne (wird zum Einschenken getragen)   cupSet: Teetassen (gehören dazu, Wunsch zählt auch)
//   Kamin: toggle + lamp wie Kerze/Deckenlampe (activities/home.js zündet ihn an)
//   Sofa: soft (Lesen, Schlafen), Etagere: food (Naschen), Grammophon: instrument (Spielen)

import { fillStar } from '../systems/draw.js';

const INK = 0x4a2a18;
const WOOD = 0xc98b5a;
const WOOD_D = 0x9c6a43;
const GOLD = 0xffd166;
const TEA = 0xb86a32;

function outline(g, w = 4) {
  g.lineStyle(w, INK, 1);
}

// Teetasse auf Untertasse, Unterkante Mitte bei (x, y)
export function teacup(g, x, y, color = 0xff9ec7, full = true) {
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(x, y - 3, 38, 8);
  g.lineStyle(3.5, color, 1);
  g.strokeCircle(x + 13, y - 15, 5);
  g.fillStyle(color, 1);
  g.fillPoints([{ x: x - 13, y: y - 24 }, { x: x + 13, y: y - 24 }, { x: x + 9, y: y - 6 }, { x: x - 9, y: y - 6 }], true);
  g.fillStyle(full ? TEA : 0xffffff, 1);
  g.fillEllipse(x, y - 24, 24, 6);
  g.fillStyle(GOLD, 1);
  g.fillRect(x - 12, y - 21, 24, 2);
  outline(g, 1.5);
  g.strokeEllipse(x, y - 24, 26, 7);
}

function drawTeaTable(g, W, H) {
  // Stiel des Pilzes
  g.fillStyle(0xfff1dc, 1);
  g.fillPoints([{ x: W / 2 - 22, y: 56 }, { x: W / 2 + 22, y: 56 }, { x: W / 2 + 34, y: H - 4 }, { x: W / 2 - 34, y: H - 4 }], true);
  g.fillStyle(0xf0dcc0, 1);
  g.fillEllipse(W / 2, H - 6, 92, 14);
  outline(g, 3);
  g.strokePoints([{ x: W / 2 - 22, y: 56 }, { x: W / 2 + 22, y: 56 }, { x: W / 2 + 34, y: H - 4 }, { x: W / 2 - 34, y: H - 4 }], true);
  // Hut: oben flach (Tischplatte), rot mit weißen Punkten
  g.fillStyle(0xe0566f, 1);
  g.fillEllipse(W / 2, 46, W - 8, 52);
  g.fillRoundedRect(8, 26, W - 16, 26, 12);
  g.fillStyle(0xf07a8e, 1);
  g.fillRoundedRect(14, 26, W - 28, 8, 4);
  g.fillStyle(0xffffff, 1);
  for (const [x, y, r] of [[40, 48, 7], [86, 58, 9], [140, 50, 6], [186, 58, 8], [214, 44, 5]]) g.fillCircle(x, y, r);
  outline(g, 3.5);
  g.strokeEllipse(W / 2, 46, W - 8, 52);
  // Spitzendeckchen
  g.fillStyle(0xfff8fb, 0.95);
  g.fillEllipse(W / 2, 28, 120, 10);
}

function drawTeapot(g, W, H) {
  const cx = 38;
  const by = H - 6;
  // Tülle und Henkel
  g.fillStyle(0x8fd3c0, 1);
  g.fillPoints([{ x: cx + 16, y: by - 26 }, { x: cx + 36, y: by - 46 }, { x: cx + 40, y: by - 42 }, { x: cx + 22, y: by - 14 }], true);
  g.lineStyle(6, 0x8fd3c0, 1);
  g.strokeCircle(cx - 24, by - 26, 10);
  // Bauch
  g.fillStyle(0xb4f0de, 1);
  g.fillEllipse(cx, by - 22, 50, 40);
  g.fillStyle(0xffffff, 0.45);
  g.fillEllipse(cx - 10, by - 30, 12, 16);
  g.fillStyle(0xff9ec7, 1);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    g.fillCircle(cx + 6 + Math.cos(a) * 5, by - 18 + Math.sin(a) * 5, 3.5);
  }
  // Deckel mit Knauf
  g.fillStyle(0x8fd3c0, 1);
  g.fillEllipse(cx, by - 42, 30, 10);
  g.fillStyle(GOLD, 1);
  g.fillCircle(cx, by - 50, 5);
  outline(g, 2.5);
  g.strokeEllipse(cx, by - 22, 50, 40);
}

function drawCupSet(g, W, H) {
  // zwei Tassen gestapelt, eine daneben
  teacup(g, 26, H - 4, 0xff9ec7, false);
  teacup(g, 26, H - 26, 0x9b7bff, false);
  teacup(g, 56, H - 4, 0x6fd3b0, false);
}

function drawPetalSofa(g, W, H) {
  // Rückenlehne aus drei Blütenblättern
  const petals = [[54, 0xff9ec7], [W - 54, 0xff9ec7], [W / 2, 0xffb8d6]];
  for (const [x, c] of petals) {
    g.fillStyle(c, 1);
    g.fillEllipse(x, 62, 108, 110);
    outline(g, 3);
    g.strokeEllipse(x, 62, 108, 110);
  }
  // Sitzkissen (Oberkante = Ablage bei 0,7 Zellen über dem Boden → Art-y 104)
  g.fillStyle(0xffd6e7, 1);
  g.fillRoundedRect(10, 98, W - 20, 34, 16);
  g.fillStyle(0xfff0f6, 1);
  g.fillRoundedRect(20, 100, W - 40, 8, 4);
  outline(g, 3);
  g.strokeRoundedRect(10, 98, W - 20, 34, 16);
  // Blattfüße
  g.fillStyle(0x6fbf5a, 1);
  g.fillEllipse(34, H - 12, 40, 20);
  g.fillEllipse(W - 34, H - 12, 40, 20);
  g.fillStyle(GOLD, 1);
  fillStar(g, W / 2, 40, 10, 4, 5);
}

function drawFireplace(g, W, H, lit) {
  const top = 20;
  // Steinumrandung
  g.fillStyle(0xe8d8c8, 1);
  g.fillRoundedRect(6, top + 10, W - 12, H - top - 10, 8);
  g.fillStyle(0xd4bfa8, 1);
  for (const [x, y] of [[18, 60], [W - 34, 80], [20, 130], [W - 30, 170], [24, 200], [W - 40, 214]]) g.fillRoundedRect(x, y, 16, 10, 4);
  // Sims (Ablage)
  g.fillStyle(WOOD, 1);
  g.fillRoundedRect(0, top, W, 18, 6);
  outline(g, 3);
  g.strokeRoundedRect(0, top, W, 18, 6);
  g.strokeRoundedRect(6, top + 10, W - 12, H - top - 10, 8);
  // Feuerloch
  g.fillStyle(0x3b2a3a, 1);
  g.fillRoundedRect(30, 96, W - 60, H - 104, { tl: 40, tr: 40, bl: 4, br: 4 });
  // Holzscheite
  g.fillStyle(WOOD_D, 1);
  g.fillRoundedRect(40, H - 26, W - 80, 14, 6);
  g.fillStyle(0x7a4e2e, 1);
  g.fillRoundedRect(50, H - 36, W - 100, 12, 6);
  if (lit) {
    g.fillStyle(0xff7a3c, 1);
    g.fillTriangle(48, H - 30, 68, H - 104, 88, H - 30);
    g.fillTriangle(72, H - 30, 90, H - 120, 110, H - 30);
    g.fillStyle(GOLD, 1);
    g.fillTriangle(60, H - 30, 74, H - 76, 88, H - 30);
    g.fillTriangle(80, H - 30, 92, H - 90, 104, H - 30);
    g.fillStyle(0xfff3a8, 1);
    g.fillTriangle(76, H - 30, 84, H - 60, 94, H - 30);
  }
}

// Etagere mit Törtchen: n = übrige Portionen (1..3), von oben nach unten aufgegessen
function drawEtagere(g, n) {
  g.fillStyle(GOLD, 1);
  g.fillRect(38, 6, 4, 70);
  g.fillCircle(40, 6, 5);
  const tiers = [[24, 34], [48, 46], [72, 58]]; // y, Tellerbreite
  tiers.forEach(([y, w], i) => {
    const full = i >= 3 - n;
    if (full) {
      const cols = [0xff9ec7, 0xb4f0de, 0xffd166];
      for (let k = -1; k <= 1; k += 2) {
        const x = 40 + k * w * 0.22;
        g.fillStyle(0xf2cf96, 1);
        g.fillRoundedRect(x - 7, y - 10, 14, 9, 3);
        g.fillStyle(cols[i], 1);
        g.fillEllipse(x, y - 11, 16, 8);
        g.fillStyle(0xe0566f, 1);
        g.fillCircle(x, y - 16, 2.5);
      }
    }
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(40, y, w, 7);
    g.lineStyle(1.5, 0xd8b0c8, 1);
    g.strokeEllipse(40, y, w, 7);
  });
}

// Grammophon: Holzkasten mit Goldrand auf Füßchen, Schallplatte, goldener Tonarm und großer Blütentrichter
// (Trichteröffnung oben rechts – dort steigen die Noten auf, siehe instrument.notes)
function drawGramophone(g, W, H) {
  const B = H - 8; // Unterkante des Kastens
  // Füßchen
  g.fillStyle(GOLD, 1);
  for (const x of [12, 50]) g.fillCircle(x, B + 3, 4);
  // Kasten
  g.fillStyle(WOOD, 1);
  g.fillRoundedRect(4, B - 22, 54, 22, 5);
  g.fillStyle(WOOD_D, 1);
  g.fillRoundedRect(4, B - 8, 54, 8, { tl: 0, tr: 0, bl: 5, br: 5 });
  outline(g, 2.5);
  g.strokeRoundedRect(4, B - 22, 54, 22, 5);
  // Goldleiste mit Herzchen vorn
  g.fillStyle(GOLD, 1);
  g.fillRect(8, B - 13, 46, 2.5);
  g.fillStyle(0xff9ec7, 1);
  g.fillCircle(29, B - 12, 3.2);
  g.fillCircle(33, B - 12, 3.2);
  g.fillTriangle(26, B - 11, 36, B - 11, 31, B - 6);
  // Schallplatte mit rosa Etikett
  g.fillStyle(0x2f2433, 1);
  g.fillEllipse(28, B - 23, 44, 9);
  g.lineStyle(1, 0x5a4a60, 1);
  g.strokeEllipse(28, B - 23, 32, 6);
  g.fillStyle(0xff9ec7, 1);
  g.fillEllipse(28, B - 23, 11, 3.5);
  // Kurbel links
  g.lineStyle(3, GOLD, 1);
  g.lineBetween(4, B - 12, -2, B - 12);
  g.lineBetween(-2, B - 12, -2, B - 4);
  g.fillStyle(0xff9ec7, 1);
  g.fillCircle(-2, B - 3, 2.5);
  // Tonarm: aus dem Kasten hinten rechts nach oben, dann in den Trichter
  g.lineStyle(5, 0xb8862a, 1);
  g.lineBetween(50, B - 20, 50, B - 36);
  g.lineStyle(3, GOLD, 1);
  g.lineBetween(50, B - 20, 50, B - 36);
  g.lineStyle(2.5, GOLD, 1);
  g.lineBetween(50, B - 26, 36, B - 25); // Nadelarm zur Platte
  // Trichter: Hals schräg nach oben rechts, weit aufgehende Blüte
  const cx = 64;
  const cy = 14;
  g.fillStyle(0xffb8d6, 1);
  g.fillPoints([{ x: 46, y: B - 36 }, { x: 54, y: B - 40 }, { x: cx + 10, y: cy + 9 }, { x: cx - 8, y: cy - 7 }], true);
  outline(g, 2);
  g.strokePoints([{ x: 46, y: B - 36 }, { x: 54, y: B - 40 }, { x: cx + 10, y: cy + 9 }, { x: cx - 8, y: cy - 7 }], true);
  // Blütenblätter rund um die Öffnung
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = cx + Math.cos(a) * 11;
    const py = cy + Math.sin(a) * 9;
    g.fillStyle(i % 2 ? 0xff9ec7 : 0xffb8d6, 1);
    g.fillCircle(px, py, 8);
    outline(g, 1.5);
    g.strokeCircle(px, py, 8);
  }
  g.fillStyle(0xffe0ec, 1);
  g.fillEllipse(cx, cy, 18, 14);
  g.fillStyle(0xc9608a, 1);
  g.fillEllipse(cx + 1, cy + 1, 9, 7);
  g.fillStyle(GOLD, 1);
  g.fillCircle(cx + 1, cy + 1, 2);
  // Glanz
  g.fillStyle(0xffffff, 0.7);
  g.fillEllipse(cx - 6, cy - 5, 5, 2.5);
}

export const TEASALON_FURNITURE = {
  teetisch: {
    id: 'teetisch',
    name: 'Teetisch',
    sprite: 'teetisch', // Pilztisch (Lieferung 6)
    kind: 'floor',
    w: 3,
    h: 2,
    surfaces: [{ y: 1.65, x0: 0, x1: 3 }], // Tischplatte (Hut; Höhe wird am Bild nachgemessen)
    // top: Höhe der Platte (Art-y), cups: wohin die Tassen kommen (Art-x), seats: Plätze rundherum (Art-Punkte)
    teatable: {
      top: 20,
      cups: [50, 190, 95, 145],
      seats: [{ x: -14, y: 10 }, { x: 254, y: 10 }, { x: 70, y: -64 }, { x: 170, y: -64 }],
    },
    draw: drawTeaTable,
  },

  teekanne: {
    id: 'teekanne',
    name: 'Teekanne',
    kind: 'small',
    w: 1,
    h: 1,
    teapot: { spout: { x: 78, y: 32 } },
    draw: drawTeapot,
  },

  teetassen: {
    id: 'teetassen',
    name: 'Teetassen',
    kind: 'small',
    w: 1,
    h: 1,
    cupSet: true,
    draw: drawCupSet,
  },

  bluetensofa: {
    id: 'bluetensofa',
    name: 'Blütensofa',
    sprite: 'bluetensofa', // gemalt (Lieferung 6)
    kind: 'floor',
    w: 3,
    h: 2,
    soft: true,
    surfaces: [{ y: 1.1, x0: 0.3, x1: 2.7 }], // Sitzkissen (Lesen, Schlafen)
    draw: drawPetalSofa,
  },

  kamin: {
    id: 'kamin',
    name: 'Kamin',
    sprite: 'kamin', // gemalt (Lieferung 6), angezündet: kamin_on
    kind: 'floor',
    w: 2,
    h: 3,
    surfaces: [{ y: 2.75, x0: 0, x1: 2 }], // Kaminsims (Höhe wird am Bild nachgemessen)
    toggle: true,
    lamp: { x: 79, y: 172, color: 0xffa040, size: 5, alpha: 0.5, flicker: true },
    draw: (g, W, H) => drawFireplace(g, W, H, false),
    states: { on: (g, W, H) => drawFireplace(g, W, H, true) },
  },

  etagere: {
    id: 'etagere',
    name: 'Etagere',
    kind: 'small',
    w: 1,
    h: 1,
    food: true,
    portions: 3,
    draw: (g) => drawEtagere(g, 3),
    states: { a1: (g) => drawEtagere(g, 1), a2: (g) => drawEtagere(g, 2) },
  },

  grammophon: {
    id: 'grammophon',
    name: 'Grammophon',
    kind: 'small',
    w: 1,
    h: 1,
    instrument: { mode: 'sit', at: { x: 110, y: 40 }, face: -1, notes: { x: 70, y: 0 }, color: 0xff9ec7 },
    draw: drawGramophone,
  },
};

// Bilder für die Teestunde (activities/teesalon.js backt sie bei Bedarf); Ursprung = Unterkante Mitte
export const TEA_ART = {
  'tea-cup': { w: 56, h: 40, ox: 28, oy: 36, draw: (g) => teacup(g, 0, 0, 0xff9ec7, true) },
  'tea-cup-2': { w: 56, h: 40, ox: 28, oy: 36, draw: (g) => teacup(g, 0, 0, 0x9b7bff, true) },
  'tea-cup-3': { w: 56, h: 40, ox: 28, oy: 36, draw: (g) => teacup(g, 0, 0, 0x6fd3b0, true) },
  'tea-cup-4': { w: 56, h: 40, ox: 28, oy: 36, draw: (g) => teacup(g, 0, 0, 0xffb347, true) },
};
