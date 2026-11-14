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

  // ---- Menü und Feenstaub ----

  // weiterspielen: dicker Play-Pfeil
  play(g) {
    g.fillStyle(0x5fc98a, 1);
    g.fillPoints([{ x: -26, y: -40 }, { x: 40, y: 0 }, { x: -26, y: 40 }], true);
    g.fillCircle(-22, -34, 8);
    g.fillCircle(-22, 34, 8);
    g.fillCircle(34, 0, 8);
  },

  // neues Spiel: großer Stern mit kleinem Funkeln
  new(g) {
    g.fillStyle(0xffc94d, 1);
    fillStar(g, -4, 4, 42, 18, 5);
    g.fillStyle(0xff9ec7, 1);
    fillStar(g, 34, -32, 12, 5, 4);
  },

  // Test-Spiel: Reagenzglas mit Blasen
  test(g) {
    g.fillStyle(0x8a8070, 1);
    g.fillRoundedRect(-18, -46, 36, 10, 5);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(-14, -40, 28, 80, { tl: 2, tr: 2, bl: 14, br: 14 });
    g.fillStyle(0x7fd8a8, 1);
    g.fillRoundedRect(-14, 2, 28, 38, { tl: 0, tr: 0, bl: 14, br: 14 });
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(-4, 14, 4);
    g.fillCircle(5, 26, 3);
    g.lineStyle(4, 0x8a8070, 1);
    g.strokeRoundedRect(-14, -40, 28, 80, { tl: 2, tr: 2, bl: 14, br: 14 });
  },

  // Menü: drei dicke Striche
  menu(g) {
    g.fillStyle(INK, 1);
    for (const y of [-26, 0, 26]) g.fillRoundedRect(-36, y - 8, 72, 16, 8);
  },

  // speichern: Truhe mit Herz
  save(g) {
    g.fillStyle(0xc98b5a, 1);
    g.fillRoundedRect(-42, -30, 84, 30, { tl: 18, tr: 18, bl: 0, br: 0 });
    g.fillStyle(0xa86d40, 1);
    g.fillRect(-42, 0, 84, 36);
    g.fillStyle(0xffd166, 1);
    g.fillRect(-42, -4, 84, 8);
    g.fillRoundedRect(-9, -8, 18, 20, 4);
    g.fillStyle(0xff7ab8, 1);
    g.fillCircle(-7, 20, 7);
    g.fillCircle(7, 20, 7);
    g.fillTriangle(-14, 22, 14, 22, 0, 36);
  },

  // zum Hauptmenü: Häuschen
  home(g) {
    g.fillStyle(0xe0566f, 1);
    g.fillTriangle(-48, -2, 0, -44, 48, -2);
    g.fillStyle(0xfff4fb, 1);
    g.fillRect(-34, -4, 68, 46);
    g.fillStyle(0xc98b5a, 1);
    g.fillRoundedRect(-10, 12, 20, 30, { tl: 10, tr: 10, bl: 0, br: 0 });
    g.lineStyle(4, INK, 1);
    g.strokeRect(-34, -4, 68, 46);
  },

  // geklappt: grüner Haken
  check(g) {
    g.fillStyle(0x5fc98a, 1);
    rotRect(g, -16, 10, 40, 18, Math.PI / 4);
    rotRect(g, 12, -2, 70, 18, -Math.PI / 3.2);
  },

  // Geisterstunde: kleiner Geist vor dem Mond
  ghost(g) {
    g.fillStyle(0xffd166, 1);
    g.fillPoints(crescent({ x: 22, y: -22, r: 24 }, { x: 34, y: -32, r: 20 }), true);
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const a = Math.PI + (i / 16) * Math.PI;
      pts.push({ x: -6 + Math.cos(a) * 30, y: -2 + Math.sin(a) * 32 });
    }
    for (let i = 0; i <= 18; i++) {
      const x = 24 - (i / 18) * 60;
      pts.push({ x, y: 40 + Math.sin((i / 18) * Math.PI * 3) * 6 });
    }
    g.fillStyle(0xffffff, 1);
    g.fillPoints(pts, true);
    g.lineStyle(4, 0xb8c4e8, 1);
    g.strokePoints(pts, true);
    g.fillStyle(0x3b2a4a, 1);
    g.fillEllipse(-16, -6, 10, 14);
    g.fillEllipse(4, -6, 10, 14);
    g.fillStyle(0xff8fa8, 0.6);
    g.fillCircle(-24, 8, 5);
    g.fillCircle(12, 8, 5);
    g.fillStyle(0x6a4a7a, 1);
    g.fillEllipse(-6, 12, 8, 10);
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

  // Garten: Blumentopf mit Pflänzchen und Blüte
  garten(g) {
    g.fillStyle(0x3f8a3c, 1);
    g.fillRect(-3, -30, 6, 34);
    g.fillStyle(0x6fbf5a, 1);
    g.fillEllipse(-18, -8, 30, 14);
    g.fillEllipse(18, -16, 30, 14);
    g.fillStyle(0xff7ab8, 1);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      g.fillCircle(Math.cos(a) * 11, -36 + Math.sin(a) * 11, 8);
    }
    g.fillStyle(0xffd166, 1);
    g.fillCircle(0, -36, 6);
    g.fillStyle(0xd9774a, 1);
    g.fillPoints([{ x: -30, y: 6 }, { x: 30, y: 6 }, { x: 22, y: 46 }, { x: -22, y: 46 }], true);
    g.fillStyle(0xe8946a, 1);
    g.fillRoundedRect(-34, 0, 68, 12, 5);
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

  // Werkstatt: Hammer und Schraubenschlüssel über Kreuz
  werkstatt(g) {
    g.fillStyle(0x7d8a99, 1);
    rotRect(g, 4, 4, 12, 78, -Math.PI / 4);
    g.fillCircle(-22, -22, 16);
    g.fillStyle(0xfff4fb, 1);
    rotRect(g, -26, -26, 12, 18, -Math.PI / 4);
    g.fillStyle(0xe0a872, 1);
    rotRect(g, -2, 4, 12, 76, Math.PI / 4);
    g.fillStyle(0x9c6a43, 1);
    rotRect(g, 18, -16, 46, 20, -Math.PI / 4);
    g.fillStyle(0xb9c4d0, 1);
    rotRect(g, 22, -20, 40, 8, -Math.PI / 4);
  },

  // Turnraum: zwei Turnringe an Seilen
  turnraum(g) {
    g.fillStyle(0x7d8a99, 1);
    g.fillRoundedRect(-36, -48, 72, 8, 4);
    g.lineStyle(5, 0xe0c497, 1);
    g.lineBetween(-20, -42, -20, 6);
    g.lineBetween(20, -42, 20, 6);
    g.lineStyle(9, 0xd9894a, 1);
    g.strokeCircle(-20, 24, 17);
    g.strokeCircle(20, 24, 17);
    g.fillStyle(0xffd166, 1);
    fillStar(g, 0, -20, 9, 4, 5);
  },

  // Malatelier: Farbpalette mit bunten Klecksen und Pinsel
  atelier(g) {
    g.fillStyle(0xe0a872, 1);
    g.fillEllipse(-4, 6, 92, 72);
    g.fillStyle(0xfff4fb, 1);
    g.fillCircle(18, 24, 10); // Daumenloch
    const blobs = [[-30, -6, 0xff5f8f], [-12, -22, 0xffd23f], [12, -20, 0x5fb8ff], [-28, 20, 0x6fdc8c], [26, -2, 0x9b7bff]];
    for (const [x, y, c] of blobs) {
      g.fillStyle(c, 1);
      g.fillCircle(x, y, 9);
    }
    g.fillStyle(0x9c6a43, 1);
    rotRect(g, 26, -30, 8, 52, Math.PI / 4);
    g.fillStyle(0xb9c4d0, 1);
    rotRect(g, 8, -12, 10, 12, Math.PI / 4);
    g.fillStyle(0xff5f8f, 1);
    g.fillCircle(2, -6, 6);
  },

  // ---- Feen anpassen (ui/fairyLookMenu.js) ----

  // Frisur: Kopf mit Bob und Pony
  hair(g) {
    g.fillStyle(0x8d5524, 1);
    g.fillCircle(0, -6, 40);
    g.fillRoundedRect(-40, -6, 80, 40, 16);
    g.fillStyle(0xffe0c7, 1);
    g.fillCircle(0, 8, 25);
    g.fillStyle(0x8d5524, 1);
    g.fillEllipse(-4, -14, 58, 22);
    g.fillStyle(0xb8773c, 1);
    g.fillEllipse(-16, -30, 18, 8);
    g.fillStyle(0x3b2a4a, 1);
    g.fillCircle(-9, 10, 3.5);
    g.fillCircle(9, 10, 3.5);
    g.fillStyle(0xff8fa8, 0.6);
    g.fillCircle(-15, 19, 5);
    g.fillCircle(15, 19, 5);
  },

  // Kleid: Oberteil mit Puffärmeln, weiter Rock
  dress(g) {
    g.fillStyle(0xff7ab8, 1);
    g.fillCircle(-22, -26, 11);
    g.fillCircle(22, -26, 11);
    g.fillRoundedRect(-18, -38, 36, 36, 8);
    g.fillPoints([{ x: -16, y: -6 }, { x: 16, y: -6 }, { x: 40, y: 40 }, { x: -40, y: 40 }], true);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(0, -38, 18, 8);
    g.fillStyle(0xffd166, 1);
    g.fillRoundedRect(-19, -8, 38, 7, 3);
    g.fillStyle(0xffffff, 0.8);
    for (const [x, y] of [[-18, 24], [0, 14], [18, 26], [-6, 32]]) g.fillCircle(x, y, 3);
  },

  // Hautfarbe: drei Farbtupfer
  skin(g) {
    const tones = [0xffd3b9, 0xc98c5e, 0x6e4228];
    tones.forEach((c, i) => {
      const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
      const x = Math.cos(a) * 20;
      const y = Math.sin(a) * 20;
      g.fillStyle(0x5a3a7a, 0.2);
      g.fillCircle(x, y + 4, 24);
      g.fillStyle(c, 1);
      g.fillCircle(x, y, 24);
      g.lineStyle(4, 0xffffff, 1);
      g.strokeCircle(x, y, 24);
    });
  },

  // Flügel: zwei Flügelpaare
  wings(g) {
    for (const s of [-1, 1]) {
      g.fillStyle(0xbfe9ff, 1);
      g.fillEllipse(s * 22, -14, 44, 34);
      g.fillEllipse(s * 16, 18, 28, 24);
      g.lineStyle(4, 0x7fb8e8, 1);
      g.strokeEllipse(s * 22, -14, 44, 34);
      g.strokeEllipse(s * 16, 18, 28, 24);
    }
    g.fillStyle(0xffd166, 1);
    g.fillEllipse(0, 0, 10, 40);
  },

  // Gesicht: rundes Gesicht mit großen Augen und Lächeln
  face(g) {
    g.fillStyle(0xffe0c7, 1);
    g.fillCircle(0, 0, 42);
    g.lineStyle(4, 0xc98a6a, 1);
    g.strokeCircle(0, 0, 42);
    g.fillStyle(0x5a3a2a, 1);
    g.fillEllipse(-15, -4, 16, 20);
    g.fillEllipse(15, -4, 16, 20);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-12, -8, 4);
    g.fillCircle(18, -8, 4);
    g.fillStyle(0xff8fa8, 0.6);
    g.fillCircle(-26, 12, 7);
    g.fillCircle(26, 12, 7);
    g.lineStyle(4, 0x8a4a3a, 1);
    g.beginPath();
    g.arc(0, 12, 10, 0.3, Math.PI - 0.3);
    g.strokePath();
  },

  // Zauberstab mit Stern
  wand(g) {
    g.lineStyle(9, 0xc98a4a, 1);
    g.lineBetween(-30, 38, 10, -6);
    g.fillStyle(0xfff3a8, 0.5);
    g.fillCircle(16, -14, 34);
    g.fillStyle(0xffd166, 1);
    fillStar(g, 16, -14, 28, 12, 5);
    g.fillStyle(0xffffff, 0.9);
    g.fillCircle(10, -20, 4);
  },

  // Teesalon: Teetasse mit Dampf
  teesalon(g) {
    g.lineStyle(5, 0xc9b8e8, 1);
    for (const x of [-12, 8]) {
      g.beginPath();
      g.moveTo(x, -16);
      g.lineTo(x + 6, -28);
      g.lineTo(x, -40);
      g.lineTo(x + 6, -50);
      g.strokePath();
    }
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(0, 36, 96, 18);
    g.lineStyle(8, 0xff9ec7, 1);
    g.strokeCircle(34, 6, 11);
    g.fillStyle(0xff9ec7, 1);
    g.fillPoints([{ x: -34, y: -10 }, { x: 34, y: -10 }, { x: 24, y: 30 }, { x: -24, y: 30 }], true);
    g.fillStyle(0xb86a32, 1);
    g.fillEllipse(0, -10, 66, 12);
    g.fillStyle(0xffd166, 1);
    g.fillRect(-32, -4, 64, 4);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-6, 12, 5);
  },
};

export function iconImage(scene, name, size = 60) {
  const draw = ICONS[name] || ICONS.cross;
  return bakedImage(scene, `icon-${name}`, 120, 120, (g) => draw(g)).setScale(size / 100);
}
