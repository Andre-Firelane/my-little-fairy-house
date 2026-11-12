// Maße und Form eines Raums – abgeleitet aus dem gemalten Zimmerrahmen (public/assets/frames, vermessen
// von tools/import-sprites.py → config/frames.json). Jede Höhle im Baum hat eigene Größe und Form:
//   'rect'  – Kammer (gerundete Ecken)      'arch'  – Rundbogen (oben etwas schmaler)
//   'dome'  – Kuppel (in der Mitte hoch)    'gable' – Giebeldach
// Kammer und Rundbogen werden in Stücken gedehnt (Ecken, Knäufe, Edelsteine bleiben unverzerrt),
// Kuppel und Giebel als Ganzes gestreckt. Die Innenform (Wand, Decke, Raster) folgt genau dem Rahmen.
// ceil[c] = nutzbare Zeilen in Spalte c (unter Dachschräge weniger). Alles in Raum-Koordinaten (Mitte = 0,0).

import { CELL } from '../config/furniture.js';
import FRAMES from '../config/frames.json';

const PAD = 40; // Abstand Raster ↔ Wand links/rechts
const FLOOR_H = 64; // sichtbarer Boden unter der Bodenlinie
const FRAME_SIDE = 62; // Dicke der festen Rahmenteile (Seitenbalken) in Raum-Koordinaten

const cache = new Map();

// Stückweise Abbildung Quellbild ↔ Ziel (feste Stücke behalten ihre Größe × k, die anderen teilen sich den Rest)
function sliceMap(cuts, fixed, size, k) {
  const segs = cuts.slice(1).map((c, i) => c - cuts[i]);
  const fixedLen = segs.reduce((s, l, i) => s + (fixed[i] ? l * k : 0), 0);
  const stretchSrc = segs.reduce((s, l, i) => s + (fixed[i] ? 0 : l), 0);
  const sf = stretchSrc > 0 ? Math.max(0.05, size - fixedLen) / stretchSrc : 0;
  const dst = [0];
  segs.forEach((l, i) => dst.push(dst[i] + l * (fixed[i] ? k : sf)));
  const map = (v, from, to) => {
    for (let i = 0; i < from.length - 1; i++) {
      if (v <= from[i + 1] || i === from.length - 2) {
        const t = (v - from[i]) / (from[i + 1] - from[i] || 1);
        return to[i] + t * (to[i + 1] - to[i]);
      }
    }
    return to[to.length - 1];
  };
  return { src: cuts, dst, toDst: (v) => map(v, cuts, dst), toSrc: (v) => map(v, dst, cuts) };
}

export function roomGeometry({ cols, rows, shape = 'arch' }) {
  const key = `${shape}-${cols}x${rows}`;
  if (cache.has(key)) return cache.get(key);
  const fr = FRAMES[shape];
  const k = FRAME_SIDE / fr.side;
  const gridW = cols * CELL;
  const profile = (arr, xSrc) => {
    const i = Math.max(0, Math.min(fr.w - 1, Math.round(xSrc)));
    return arr[i] ?? fr.innerBottom;
  };

  // Rahmengröße so wählen, dass Raster (Breite) und Zeilen (Höhe, auch an den Rändern) hineinpassen
  let W = gridW + PAD * 2 + FRAME_SIDE * 2;
  let H = rows * CELL + FLOOR_H + FRAME_SIDE * 3;
  let mx, my, floorY, innerL, innerR;
  const topDst = (xDst) => my.toDst(profile(fr.top, mx.toSrc(xDst)));
  for (let iter = 0; iter < 12; iter++) {
    mx = sliceMap(fr.cols, fr.fixedX, W, k);
    my = sliceMap(fr.rows, fr.fixedY, H, k);
    innerL = mx.toDst(fr.innerL);
    innerR = mx.toDst(fr.innerR);
    W += gridW + PAD * 2 - (innerR - innerL);
    floorY = my.toDst(fr.innerBottom) - FLOOR_H;
    const cx = (innerL + innerR) / 2;
    let head = Infinity;
    for (let x = cx - gridW / 2 + 6; x <= cx + gridW / 2 - 6; x += CELL / 4) head = Math.min(head, floorY - topDst(x));
    H += rows * CELL + 8 - head;
  }
  mx = sliceMap(fr.cols, fr.fixedX, W, k);
  my = sliceMap(fr.rows, fr.fixedY, H, k);
  innerL = mx.toDst(fr.innerL);
  innerR = mx.toDst(fr.innerR);
  floorY = my.toDst(fr.innerBottom) - FLOOR_H;

  // in Raum-Koordinaten (Mitte des Rahmens = 0,0)
  const ox = W / 2;
  const oy = H / 2;
  const topAt = (x) => topDst(x + ox) - oy;
  const innerBottom = my.toDst(fr.innerBottom) - oy;
  const cxLocal = (innerL + innerR) / 2 - ox;
  const gridX0 = cxLocal - gridW / 2;
  const floorLocal = floorY - oy;

  const ceil = [];
  for (let c = 0; c < cols; c++) {
    const xs = gridX0 + c * CELL;
    const lowest = Math.max(topAt(xs + 6), topAt(xs + CELL / 2), topAt(xs + CELL - 6));
    ceil.push(Math.max(1, Math.floor((floorLocal - lowest - 6) / CELL)));
  }

  // Wandfläche: etwas größer als die Öffnung, damit sie unter dem Rahmen verschwindet
  const outline = [];
  const xs = [];
  for (let x = 0; x < fr.w; x += 6) if (fr.fillTop[x] != null) xs.push(x);
  for (const x of xs) outline.push({ x: mx.toDst(x) - ox, y: my.toDst(fr.fillTop[x]) - oy });
  for (const x of [...xs].reverse()) outline.push({ x: mx.toDst(x) - ox, y: my.toDst(fr.fillBottom[x]) - oy });

  const tops = xs.map((x) => my.toDst(fr.top[x] ?? fr.innerBottom) - oy);
  const geo = {
    key,
    shape,
    cols,
    rows: Math.max(...ceil), // höchste Stelle (für Wandsachen und Raster-Anzeige)
    baseRows: rows,
    W,
    H,
    innerW: innerR - innerL,
    innerLeft: innerL - ox,
    innerRight: innerR - ox,
    innerTop: Math.min(...tops),
    innerBottom,
    floorY: floorLocal,
    floorH: FLOOR_H,
    gridX0,
    ceil,
    outline,
    topAt,
    // Schnittkanten für das Zeichnen des Rahmens (Quelle → Ziel)
    slices: { cols: fr.cols, rows: fr.rows, dstX: mx.dst, dstY: my.dst },
    // liegt (x, y) mit Abstand m innerhalb der Wand?
    inside: (x, y, m = 0) => x > innerL - ox + m && x < innerR - ox - m && y > topAt(x) + m && y < innerBottom - m,
  };
  cache.set(key, geo);
  return geo;
}
