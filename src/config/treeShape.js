// Form des Zauberbaums (Weltkoordinaten, siehe TreeScene.drawTree): geschwungener Stamm mit Wurzeln,
// oben fünf Hauptäste mit Zweigen, die Krone als Blätterbüschel an den Astenden.
// Die Höhlen im Stamm wandern mit der Schwingung des Stamms mit (config/layout.js → SLOTS).
// Alle Maße hier sind Baum-Koordinaten; in der Welt liegt der Baum um (OX, OY) verschoben – über und neben dem Stamm
// ist so Platz für die große Krone (die Welt ist entsprechend größer, siehe layout.js).
import { makeRng } from '../systems/motion.js';

export const OX = 500;
export const OY = 1400;

export const TRUNK_X = 1200; // Mitte des Stamms (ohne Schwung)
export const GROUND_Y = 4700; // hier steht der Baum in der Wiese
export const TRUNK_TOP = 1180; // oben teilt sich der Stamm in die Äste

// seitlicher Schwung des Stamms: oben leicht nach rechts, unten zurück
export const sway = (y) => 55 * Math.sin((y - 900) / 1050) - 20 * Math.sin((y - 900) / 430);

// halbe Stammbreite: leicht taillierte Kanten, unten zu den Wurzeln weit ausgestellt
export function halfWidth(y) {
  let w = 765 + 26 * Math.sin(y / 520 + 1.3) + 12 * Math.sin(y / 190);
  if (y > 4150) w += 380 * ((y - 4150) / (GROUND_Y - 4150)) ** 2.4;
  if (y < TRUNK_TOP + 260) w += 90 * ((TRUNK_TOP + 260 - y) / 260) ** 2; // oben zu den Ästen hin breiter
  return w;
}

// kleine Unebenheiten der Rinde (links und rechts verschieden)
const knobble = (y, side) => 14 * Math.sin(y / 70 + side * 2.1) + 7 * Math.sin(y / 27 + side) + 18 * Math.sin(y / 310 + side * 1.3);

// Oberkante des Stamms: steigt in jeden Ast hinein, dazwischen runde Astgabeln
const FORKS = [760, 1230, 1670];
const topEdge = (x) => TRUNK_TOP + 120 - 320 * Math.max(...FORKS.map((f) => Math.exp(-(((x - f) / 210) ** 2))));

// Umriss des Stamms als Punkte (im Uhrzeigersinn): Seiten ab den Schultern, oben runde Schultern und Astgabeln
const SHOULDER = TRUNK_TOP + 240; // hier beginnen die geraden Seiten, darüber rundet sich der Stamm zu den Ästen
export function trunkOutline() {
  const left = [];
  const right = [];
  for (let y = SHOULDER; y <= GROUND_Y + 60; y += 20) {
    const c = TRUNK_X + sway(y);
    const w = halfWidth(Math.min(y, GROUND_Y));
    left.push({ x: c - w + knobble(y, -1), y });
    right.push({ x: c + w + knobble(y, 1), y });
  }
  const x0 = left[0].x;
  const x1 = right[0].x;
  const inL = FORKS[0];
  const inR = FORKS[FORKS.length - 1];
  const drop = SHOULDER - (TRUNK_TOP + 40);
  const top = [];
  for (let x = x1 - 10; x > x0 + 10; x -= 15) {
    // außerhalb der äußeren Äste: runde Schulter hinunter zur Seite
    const t = x > inR ? (x - inR) / (x1 - inR) : x < inL ? (inL - x) / (inL - x0) : 0;
    const y = Math.min(TRUNK_TOP + 40, topEdge(x)) + drop * (1 - Math.sqrt(Math.max(0, 1 - t * t)));
    top.push({ x, y });
  }
  return [...left, ...right.reverse(), ...top];
}

// Äste: kubische Bézier-Kurven (p0 → p3) mit Dicke w0 → w1. Zweige (kids) hängen an einer Stelle t des Astes.
// Aufbau wie bei einem echten Baum: der Stamm teilt sich in drei mächtige Hauptäste, die sich weiter oben
// in dünnere Äste gabeln; daran sitzen Zweige.
export const BRANCHES = [
  // Hauptäste
  { p: [[760, 1480], [600, 1180], [450, 920], [300, 700]], w0: 620, w1: 250 },
  { p: [[1230, 1380], [1250, 1020], [1180, 620], [1150, 300]], w0: 580, w1: 240 },
  { p: [[1670, 1480], [1840, 1180], [1950, 920], [2060, 700]], w0: 620, w1: 250 },
  // links: Gabelung
  { p: [[300, 720], [120, 620], [-80, 620], [-280, 660]], w0: 240, w1: 60, kids: [{ t: 0.5, to: [[-60, 560], [-140, 440], [-160, 330]], w: 60 }] },
  { p: [[330, 720], [260, 420], [380, 120], [380, -160]], w0: 230, w1: 55, kids: [{ t: 0.45, to: [[280, 330], [120, 260], [20, 140]], w: 65 }, { t: 0.7, to: [[420, 80], [600, -20], [700, -180]], w: 55 }] },
  // Mitte: Gabelung
  { p: [[1150, 320], [1040, 80], [900, -130], [800, -380]], w0: 230, w1: 55, kids: [{ t: 0.5, to: [[900, -40], [700, -60], [560, -140]], w: 55 }] },
  { p: [[1160, 320], [1300, 60], [1440, -180], [1500, -460]], w0: 230, w1: 55, kids: [{ t: 0.55, to: [[1400, -150], [1560, -200], [1700, -320]], w: 55 }] },
  // rechts: Gabelung
  { p: [[2060, 720], [2240, 610], [2450, 600], [2700, 640]], w0: 240, w1: 60, kids: [{ t: 0.5, to: [[2460, 560], [2540, 430], [2560, 320]], w: 60 }] },
  { p: [[2040, 720], [2080, 420], [1980, 130], [1960, -170]], w0: 230, w1: 55, kids: [{ t: 0.6, to: [[2010, 60], [2150, -40], [2260, -120]], w: 55 }] },
  // kleine Seitenäste aus dem Stamm (mit eigenem Blätterbüschel), damit er nicht wie ein Klotz wirkt
  { p: [[560, 2660], [420, 2600], [330, 2500], [250, 2380]], w0: 110, w1: 30, kids: [{ t: 0.6, to: [[300, 2560], [230, 2570], [180, 2600]], w: 30 }] },
  { p: [[1870, 3330], [2000, 3260], [2090, 3170], [2170, 3060]], w0: 110, w1: 30, kids: [{ t: 0.55, to: [[2080, 3240], [2160, 3250], [2210, 3280]], w: 30 }] },
];

// Blätterbüschel der Krone (Mitte, Halbachsen): eine große, breite Kuppel über dem Stamm.
// Unten bleiben Lücken, dort sieht man die Äste aus dem Stamm wachsen.
export const CROWN = [
  { x: -200, y: 650, rx: 380, ry: 300 },
  { x: 150, y: 330, rx: 430, ry: 330 },
  { x: 520, y: -60, rx: 460, ry: 330 },
  { x: 980, y: -420, rx: 480, ry: 330 },
  { x: 1480, y: -440, rx: 480, ry: 330 },
  { x: 1980, y: -140, rx: 460, ry: 330 },
  { x: 2330, y: 300, rx: 430, ry: 330 },
  { x: 2640, y: 650, rx: 380, ry: 300 },
  { x: 650, y: 480, rx: 330, ry: 240 },
  { x: 1220, y: 80, rx: 460, ry: 300 },
  { x: 1850, y: 420, rx: 330, ry: 230 },
  { x: -80, y: 1000, rx: 250, ry: 160 },
  { x: 2500, y: 1000, rx: 250, ry: 160 },
  // Büschel an den Seitenästen
  { x: 240, y: 2370, rx: 110, ry: 80 },
  { x: 2170, y: 3050, rx: 110, ry: 80 },
];

// Lage der gemalten Kronenstücke (Baum-Koordinaten): n = Anzahl Bilder; back = hintere (dunklere) Reihe.
// Auch für Events, die etwas auf die Krone legen (Blüten, Schnee).
// Kronenstücke in den Blätterbüscheln (CROWN): hinten große dunkle, vorne kleinere helle Stücke
export function crownLayout(n) {
  const rng = makeRng(23);
  const out = [];
  const pick = () => Math.floor(rng() * n);
  for (const c of CROWN) {
    const area = c.rx * c.ry;
    const k = Math.min(1, c.rx / 220); // kleine Büschel: kleinere Stücke
    for (const [back, scale, density] of [[true, 1.55 * k, 1 / 52000 / k / k], [false, 1.2 * k, 1 / 40000 / k / k]]) {
      const count = Math.max(2, Math.round(area * density));
      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * (back ? 0.75 : 0.6);
        out.push({
          x: c.x + Math.cos(a) * c.rx * d,
          y: c.y + Math.sin(a) * c.ry * d + (back ? -20 : 15),
          i: pick(),
          s: scale * (0.85 + rng() * 0.3),
          flip: rng() < 0.5,
          back,
        });
      }
    }
  }
  // erst alle hinteren, dann die vorderen
  return out.sort((a, b) => (a.back === b.back ? 0 : a.back ? -1 : 1));
}

// Wurzeln: wie Äste, aber vom Stammfuß schräg in die Wiese
export const ROOTS = [
  { p: [[700, 4520], [520, 4640], [330, 4700], [120, 4740]], w0: 200, w1: 40 },
  { p: [[900, 4600], [820, 4700], [720, 4740], [600, 4770]], w0: 150, w1: 40 },
  { p: [[1650, 4560], [1820, 4660], [2000, 4710], [2250, 4740]], w0: 200, w1: 40 },
  { p: [[1480, 4620], [1560, 4710], [1680, 4750], [1790, 4775]], w0: 150, w1: 40 },
];

// Baumhaus auf dem rechten oberen Ast (dort wohnt Höhle 1, siehe layout.js): Plattform darunter
export const TREEHOUSE = { x: 1920, y: 320, cols: 9, rows: 5 };

// runde Fenster zwischen den Räumen (y ohne Schwung; x wird mit dem Stamm verschoben)
export const WINDOWS = [
  { x: 1570, y: 1420, r: 72 },
  { x: 1250, y: 1675, r: 44 },
  { x: 1250, y: 2235, r: 40 },
  { x: 1250, y: 2830, r: 42 },
  { x: 1250, y: 3400, r: 44 },
  { x: 640, y: 4005, r: 40 },
  { x: 1800, y: 4060, r: 38 },
];

// Haustür am Stammfuß, zwischen den Wurzeln
export const DOOR = { x: 1200, y: GROUND_Y + 20, w: 170, h: 250 };

// Punkt auf einer kubischen Bézier-Kurve und Richtung
export function bez(p, t) {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return {
    x: a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0],
    y: a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1],
  };
}
