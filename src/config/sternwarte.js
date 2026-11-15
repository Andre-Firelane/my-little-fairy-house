// Sternwarte auf dem Balkon (Raumtyp 'sternwarte', siehe config/rooms.js). Globus und Außenregal sind gemalt
// (art-source/sternwarte → tools/import-sprites.py), das Teleskop ist gezeichnet, bis es ein Bild gibt;
// die Zeichnungen bleiben als Ersatz.
// Rollen für die Feen (activities/sternwarte.js):
//   telescope: Fernrohr auf Dreibein; eye = Okular (hier schaut die Fee hinein), lens = vordere Öffnung (Art-Punkte)
//   globe: Globus zum Drehen (state r1 = weitergedreht: Kugel gespiegelt)
// Der Schreibtisch ist der aus der Bibliothek (config/furniture.js), das Außenregal hängt an den Balkonhaken (rail).

import { fillStar } from '../systems/draw.js';

const INK = 0x4a2a18;
const WOOD = 0xb07a4a;
const WOOD_D = 0x8a5a33;
const BRASS = 0xe0b04a;
const BRASS_L = 0xffd98a;
const BRASS_D = 0xb8862a;
const NAVY = 0x3d3a8c;
const NAVY_L = 0x5f5fc0;

function outline(g, w = 4) {
  g.lineStyle(w, INK, 1);
}

// gedrehtes Rechteck (Mitte cx/cy, Länge l, Dicke d, Winkel a)
function bar(g, cx, cy, l, d, a) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const P = (x, y) => ({ x: cx + x * c - y * s, y: cy + x * s + y * c });
  return [P(-l / 2, -d / 2), P(l / 2, -d / 2), P(l / 2, d / 2), P(-l / 2, d / 2)];
}

// Fernrohr: Rohr schräg nach oben rechts, Okular unten links, auf einem Holz-Dreibein
const TEL = { angle: -0.62, cx: 86, cy: 92 };

function drawTelescope(g, W, H) {
  const top = { x: 82, y: 132 }; // Kopf des Dreibeins
  // Dreibein
  outline(g, 3);
  for (const [fx, w] of [[18, 9], [W - 22, 9], [92, 8]]) {
    g.fillStyle(fx === 92 ? WOOD_D : WOOD, 1);
    const pts = [{ x: top.x - 4, y: top.y }, { x: top.x + 4, y: top.y }, { x: fx + w / 2, y: H - 4 }, { x: fx - w / 2, y: H - 4 }];
    g.fillPoints(pts, true);
    g.strokePoints(pts, true);
    g.fillStyle(BRASS_D, 1);
    g.fillRoundedRect(fx - 7, H - 8, 14, 8, 3);
  }
  // Ablage zwischen den Beinen (Sternkarte)
  g.fillStyle(WOOD_D, 1);
  g.fillRoundedRect(34, H - 66, W - 64, 8, 3);
  g.fillStyle(0xfff4e0, 1);
  g.fillRoundedRect(52, H - 80, 46, 14, 4);
  g.fillStyle(NAVY, 1);
  g.fillCircle(66, H - 73, 2);
  g.fillCircle(80, H - 75, 2);
  g.fillCircle(90, H - 71, 2);
  // Gelenk
  g.fillStyle(BRASS, 1);
  g.fillCircle(top.x, top.y, 12);
  outline(g, 3);
  g.strokeCircle(top.x, top.y, 12);
  g.fillStyle(BRASS_D, 1);
  g.fillRect(top.x - 3, TEL.cy + 10, 6, top.y - TEL.cy - 14);
  // Rohr
  const a = TEL.angle;
  const tube = bar(g, TEL.cx, TEL.cy, 136, 28, a);
  g.fillStyle(NAVY, 1);
  g.fillPoints(tube, true);
  outline(g, 3.5);
  g.strokePoints(tube, true);
  // Glanzstreifen und Sternchen auf dem Rohr
  const along = (t, off = 0) => ({ x: TEL.cx + Math.cos(a) * t - Math.sin(a) * off, y: TEL.cy + Math.sin(a) * t + Math.cos(a) * off });
  const shine = along(0, -7);
  g.fillStyle(NAVY_L, 1);
  g.fillPoints(bar(g, shine.x, shine.y, 120, 5, a), true);
  g.fillStyle(0xfff3a8, 1);
  for (const t of [-30, 4, 34]) {
    const p = along(t, 4);
    fillStar(g, p.x, p.y, 5, 2, 5);
  }
  // Messingringe
  for (const t of [-44, 20]) {
    const p = along(t);
    const r = bar(g, p.x, p.y, 8, 32, a);
    g.fillStyle(BRASS, 1);
    g.fillPoints(r, true);
    outline(g, 2);
    g.strokePoints(r, true);
  }
  // Objektiv vorn (breiter) mit Glas
  const front = along(70);
  const hood = bar(g, front.x, front.y, 16, 38, a);
  g.fillStyle(BRASS, 1);
  g.fillPoints(hood, true);
  outline(g, 3);
  g.strokePoints(hood, true);
  const glass = along(79);
  g.fillStyle(0xb9f2ff, 1);
  g.fillEllipse(glass.x, glass.y, 10, 30);
  g.fillStyle(0xffffff, 0.8);
  g.fillCircle(glass.x - 1, glass.y - 6, 3);
  // Okular hinten
  const back = along(-74);
  const eye = bar(g, back.x, back.y, 16, 14, a);
  g.fillStyle(BRASS_L, 1);
  g.fillPoints(eye, true);
  outline(g, 2.5);
  g.strokePoints(eye, true);
}

const TEL_EYE = { x: TEL.cx + Math.cos(TEL.angle) * -84, y: TEL.cy + Math.sin(TEL.angle) * -84 };
const TEL_LENS = { x: TEL.cx + Math.cos(TEL.angle) * 84, y: TEL.cy + Math.sin(TEL.angle) * 84 };

// Globus: Kugel im Messingbogen auf Holzfuß; turn = wie weit gedreht (0, 1, 2) – Kontinente wandern
function drawGlobe(g, W, H, turn = 0) {
  const cx = W / 2;
  const cy = H - 44;
  const r = 24;
  // Fuß
  g.fillStyle(WOOD, 1);
  g.fillEllipse(cx, H - 6, 44, 12);
  g.fillStyle(WOOD_D, 1);
  g.fillRect(cx - 4, H - 18, 8, 12);
  outline(g, 2.5);
  g.strokeEllipse(cx, H - 6, 44, 12);
  // Meer
  g.fillStyle(0x5fb8ff, 1);
  g.fillCircle(cx, cy, r);
  // Kontinente (wandern beim Drehen von links nach rechts, verschwinden am Rand)
  g.fillStyle(0x6fbf5a, 1);
  const lands = [[-0.9, -8, 9, 7], [-0.2, 6, 11, 8], [0.5, -10, 8, 6], [1.2, 4, 10, 9], [1.9, -4, 7, 10]];
  for (const [phase, dy, rw, rh] of lands) {
    const p = ((phase + turn * 0.45 + 1.4) % 2.8) - 1.4; // −1.4 … 1.4
    const x = Math.sin(p) * (r - 6);
    const vis = Math.cos(p);
    if (vis < 0.15) continue;
    const yy = Math.max(-r + rh, Math.min(r - rh, dy));
    g.fillEllipse(cx + x, cy + yy, rw * 2 * vis, rh * 2);
  }
  // Pole und Glanz
  g.fillStyle(0xffffff, 0.9);
  g.fillEllipse(cx, cy - r + 4, 14, 5);
  g.fillStyle(0xffffff, 0.35);
  g.fillEllipse(cx - 9, cy - 9, 10, 14);
  outline(g, 3);
  g.strokeCircle(cx, cy, r);
  // Messingbogen
  g.lineStyle(4, BRASS_D, 1);
  g.beginPath();
  g.arc(cx, cy, r + 6, Math.PI * 0.62, Math.PI * 2.38, false);
  g.strokePath();
  g.lineStyle(2, BRASS_L, 1);
  g.beginPath();
  g.arc(cx, cy, r + 6, Math.PI * 0.75, Math.PI * 1.25, false);
  g.strokePath();
  g.fillStyle(BRASS, 1);
  g.fillCircle(cx, cy - r - 6, 4);
  g.fillRect(cx - 2, cy + r + 4, 4, H - 18 - (cy + r + 4));
}

// Außenregal: zwei Bretter an Ketten am Balkonhaken, mit Sternengläsern, Laterne und Pflänzchen
function drawOutdoorShelf(g, W, H) {
  const b1 = H * 0.5; // oberes Brett
  const b2 = H - 12; // unteres Brett
  // Ketten zum Haken
  g.lineStyle(3, 0x5a3a2a, 1);
  g.lineBetween(8, b1, W / 2, 6);
  g.lineBetween(W - 8, b1, W / 2, 6);
  g.lineBetween(8, b1, 8, b2);
  g.lineBetween(W - 8, b1, W - 8, b2);
  g.strokeCircle(W / 2, 6, 5);
  // oben: Laterne und Sternenglas
  g.fillStyle(0x3b3355, 1);
  g.fillRoundedRect(14, b1 - 36, 26, 34, 5);
  g.fillStyle(0xfff3a8, 1);
  g.fillRoundedRect(18, b1 - 30, 18, 24, 4);
  g.fillStyle(0xffd166, 1);
  g.fillEllipse(27, b1 - 16, 8, 12);
  g.fillStyle(0x3b3355, 1);
  g.fillTriangle(12, b1 - 36, 42, b1 - 36, 27, b1 - 48);
  g.fillStyle(0xd9f2ff, 0.85);
  g.fillRoundedRect(W - 40, b1 - 32, 26, 30, 6);
  g.fillStyle(WOOD_D, 1);
  g.fillRect(W - 38, b1 - 38, 22, 7);
  g.fillStyle(0xffd166, 1);
  for (const [x, y] of [[W - 31, b1 - 22], [W - 22, b1 - 12], [W - 25, b1 - 25]]) fillStar(g, x, y, 5, 2, 5);
  // unten: Pflänzchen im Topf und kleiner Mondstein
  g.fillStyle(0x3f8a3c, 1);
  g.fillEllipse(26, b2 - 30, 22, 12);
  g.fillEllipse(36, b2 - 36, 18, 10);
  g.fillStyle(0x6fbf5a, 1);
  g.fillEllipse(22, b2 - 36, 16, 9);
  g.fillStyle(0xd9774a, 1);
  g.fillPoints([{ x: 16, y: b2 - 24 }, { x: 40, y: b2 - 24 }, { x: 36, y: b2 }, { x: 20, y: b2 }], true);
  g.fillStyle(0xd9c8f2, 1);
  g.fillEllipse(W - 28, b2 - 10, 26, 18);
  g.fillStyle(0xffffff, 0.7);
  g.fillEllipse(W - 32, b2 - 14, 8, 5);
  // Bretter
  for (const y of [b1, b2]) {
    g.fillStyle(WOOD, 1);
    g.fillRoundedRect(2, y, W - 4, 11, 4);
    outline(g, 2.5);
    g.strokeRoundedRect(2, y, W - 4, 11, 4);
  }
}

export const STARGAZING_FURNITURE = {
  teleskop: {
    id: 'teleskop',
    name: 'Teleskop',
    kind: 'floor',
    w: 2,
    h: 3,
    telescope: { eye: TEL_EYE, lens: TEL_LENS },
    draw: drawTelescope,
  },

  globus: {
    id: 'globus',
    name: 'Globus',
    kind: 'small',
    w: 1,
    h: 1,
    sprite: 'globus', // gedreht: globus_r1
    globe: true,
    draw: (g, W, H) => drawGlobe(g, W, H, 0),
    states: { r1: (g, W, H) => drawGlobe(g, W, H, 1) },
  },

  aussenregal: {
    id: 'aussenregal',
    name: 'Außenregal',
    sprite: 'aussenregal',
    spriteAlign: 'top',
    kind: 'wall',
    rail: true,
    railHang: 0.04, // hängt mit dem Ring ganz oben am Haken
    w: 1,
    h: 1.6,
    draw: drawOutdoorShelf,
  },
};
