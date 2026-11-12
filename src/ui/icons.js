import { bakedImage } from '../systems/bake.js';
import { fillStar } from '../systems/draw.js';

// Bildzeichen statt Schrift (Kinder müssen nichts lesen): Knöpfe und Zimmerarten.
// Jedes Zeichen wird in einem 100×100-Feld um 0,0 gezeichnet und einmal gebacken.
// iconImage(scene, name, size) → Bild, size = Breite/Höhe in Pixeln.

const INK = 0x5a3a7a;

// Rechteck um seine Mitte gedreht (für Kreuz, Griffe …)
function rotRect(g, cx, cy, w, h, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const pts = [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
  g.fillPoints(pts.map(([x, y]) => ({ x: cx + x * c - y * s, y: cy + x * s + y * c })), true);
}

// Punkte eines Kreisbogens
function arcPts(cx, cy, r, a0, a1, n = 24) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
  });
}

// Sichel = Kreis a ohne Kreis b: äußerer Bogen von a (außerhalb b), zurück über den Bogen von b (innerhalb a)
function crescent(a, b) {
  const dist = (p, c) => Math.hypot(p.x - c.x, p.y - c.y);
  const toB = Math.atan2(b.y - a.y, b.x - a.x);
  const outer = arcPts(a.x, a.y, a.r, toB, toB + Math.PI * 2, 96).filter((p) => dist(p, b) > b.r);
  const inner = arcPts(b.x, b.y, b.r, toB, toB + Math.PI * 2, 96).filter((p) => dist(p, a) < a.r);
  const last = outer[outer.length - 1];
  if (dist(inner[0], last) > dist(inner[inner.length - 1], last)) inner.reverse();
  return outer.concat(inner);
}

const ICONS = {
  // zurück: dicker Pfeil nach links
  back(g) {
    g.fillStyle(INK, 1);
    g.fillPoints([{ x: -38, y: 0 }, { x: -6, y: -30 }, { x: -6, y: 30 }], true);
    g.fillCircle(-35, 0, 6);
    g.fillRoundedRect(-14, -11, 52, 22, 11);
  },

  // Mülleimer (Raum löschen)
  trash(g, color = 0xd94f74) {
    g.fillStyle(color, 1);
    g.fillRoundedRect(-10, -42, 20, 12, 5); // Griff
    g.fillRoundedRect(-34, -34, 68, 12, 6); // Deckel
    g.fillPoints([{ x: -28, y: -18 }, { x: 28, y: -18 }, { x: 22, y: 40 }, { x: -22, y: 40 }], true);
    g.fillStyle(0xffffff, 0.75);
    for (const x of [-12, 0, 12]) g.fillRoundedRect(x - 3, -8, 6, 38, 3);
  },

  // nein / abbrechen: Kreuz
  cross(g) {
    g.fillStyle(INK, 1);
    rotRect(g, 0, 0, 84, 20, Math.PI / 4);
    rotRect(g, 0, 0, 84, 20, -Math.PI / 4);
    g.fillCircle(-29.7, -29.7, 10);
    g.fillCircle(29.7, 29.7, 10);
    g.fillCircle(-29.7, 29.7, 10);
    g.fillCircle(29.7, -29.7, 10);
  },

  // ---- Zimmerarten ----

  // Schlafzimmer: Mondsichel mit Sternen
  bedroom(g) {
    g.fillStyle(0xffc94d, 1);
    g.fillPoints(crescent({ x: -4, y: 4, r: 40 }, { x: 14, y: -12, r: 33 }), true);
    g.fillStyle(0xffe08a, 1);
    fillStar(g, 26, 22, 13, 5.5, 5);
    fillStar(g, 34, -26, 9, 4, 5);
  },

  // Zauberküche: Kessel mit grünem Trank und Blasen
  kitchen(g) {
    g.fillStyle(0xff9a3c, 1);
    g.fillTriangle(-20, 46, -10, 24, 0, 46);
    g.fillTriangle(0, 46, 10, 22, 20, 46);
    g.fillStyle(0x3b3355, 1);
    g.fillEllipse(0, 14, 84, 62);
    g.fillStyle(0x56507a, 1);
    g.fillEllipse(0, -14, 90, 20);
    g.fillStyle(0x6fdc8c, 1);
    g.fillEllipse(0, -14, 72, 12);
    g.fillCircle(-12, -26, 7);
    g.fillCircle(6, -36, 5);
    g.fillCircle(14, -24, 4);
    g.fillStyle(0x51497a, 1);
    g.fillEllipse(-16, 8, 22, 16);
  },

  // Küche: Muffin mit Kirsche
  kueche(g) {
    g.fillStyle(0xe0566f, 1);
    g.fillCircle(0, -36, 9);
    g.fillStyle(0xfff4fb, 1);
    g.fillCircle(-20, -10, 18);
    g.fillCircle(20, -10, 18);
    g.fillCircle(0, -20, 20);
    g.fillEllipse(0, 0, 76, 26);
    g.fillStyle(0xff9ec7, 1);
    g.fillCircle(-12, -14, 3);
    g.fillCircle(10, -22, 3);
    g.fillCircle(16, -6, 3);
    g.fillStyle(0xd9a066, 1);
    g.fillPoints([{ x: -34, y: 8 }, { x: 34, y: 8 }, { x: 24, y: 44 }, { x: -24, y: 44 }], true);
    g.fillStyle(0xc4874f, 1);
    for (const x of [-16, 0, 16]) g.fillRect(x - 3, 10, 6, 32);
  },

  // Bibliothek: aufgeschlagenes Buch
  library(g) {
    g.fillStyle(0x9b7bff, 1);
    g.fillPoints([{ x: -46, y: -26 }, { x: 0, y: -18 }, { x: 46, y: -26 }, { x: 46, y: 34 }, { x: 0, y: 40 }, { x: -46, y: 34 }], true);
    g.fillStyle(0xffffff, 1);
    g.fillPoints([{ x: -40, y: -32 }, { x: -2, y: -24 }, { x: -2, y: 32 }, { x: -40, y: 26 }], true);
    g.fillPoints([{ x: 40, y: -32 }, { x: 2, y: -24 }, { x: 2, y: 32 }, { x: 40, y: 26 }], true);
    g.fillStyle(0xc9b8e8, 1);
    for (let i = 0; i < 4; i++) {
      g.fillRect(-34, -18 + i * 11, 26, 4);
      g.fillRect(8, -18 + i * 11, 26, 4);
    }
  },

  // Musikzimmer: zwei verbundene Achtelnoten
  musik(g) {
    g.fillStyle(0xff5fb8, 1);
    g.fillEllipse(-24, 30, 30, 22);
    g.fillEllipse(24, 22, 30, 22);
    g.fillRect(-15, -30, 8, 60);
    g.fillRect(33, -38, 8, 60);
    g.fillPoints([{ x: -15, y: -30 }, { x: 41, y: -38 }, { x: 41, y: -24 }, { x: -15, y: -16 }], true);
    g.fillStyle(0xffd166, 1);
    fillStar(g, -40, -30, 9, 4, 5);
  },

  // Badezimmer: Badewanne mit Schaum
  bad(g) {
    g.fillStyle(0xe0b04a, 1);
    g.fillRoundedRect(-36, -38, 9, 34, 4);
    g.fillRoundedRect(-36, -38, 22, 9, 4);
    g.fillCircle(-30, 40, 7);
    g.fillCircle(30, 40, 7);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-16, -10, 12);
    g.fillCircle(4, -16, 15);
    g.fillCircle(24, -10, 11);
    g.fillStyle(0xffc8e2, 1);
    g.fillCircle(-2, -26, 5);
    g.fillCircle(30, -24, 4);
    g.fillStyle(0x5fb8ff, 1);
    g.fillRoundedRect(-46, -4, 92, 42, { tl: 6, tr: 6, bl: 22, br: 22 });
    g.fillStyle(0x8fd3ff, 1);
    g.fillRoundedRect(-50, -8, 100, 10, 5);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(-22, 16, 4);
    g.fillCircle(0, 16, 4);
    g.fillCircle(22, 16, 4);
  },
};

export function iconImage(scene, name, size = 60) {
  const draw = ICONS[name] || ICONS.cross;
  return bakedImage(scene, `icon-${name}`, 120, 120, (g) => draw(g)).setScale(size / 100);
}
