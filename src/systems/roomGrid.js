// Raster-Logik für die Raum-Einrichtung (rein rechnerisch, ohne Phaser).
// Koordinaten in Zellen: gx von links (0..geo.cols), gy von der Bodenlinie nach oben.
// Ein Item liegt mit seiner Unterkante auf gy: { uid, id, gx, gy, parent } (parent = uid des Möbels, auf dem es steht).
// geo = Maße und Form des Raums (systems/roomGeometry.js): geo.ceil[c] = nutzbare Zeilen in Spalte c.

import { furnitureById } from '../config/furniture.js';

const rectOf = (gx, gy, def) => ({ x0: gx, x1: gx + def.w, y0: gy, y1: gy + def.h });
const overlap = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
// Ebenen blockieren sich nur untereinander: Wandsachen, Möbel, Kleinkram
// (eine Flasche darf vor dem Kessel stehen, ein Regal vor der Tafel)
const layerOf = (def) => def.kind;

// passt das Rechteck unter die Decke (Dachschräge, Kuppel …)?
function fitsCeiling(geo, gx, gy, def) {
  // auch für halbe Felder (z. B. Regalfächer, die mittig sitzen): alle berührten Spalten prüfen
  for (let c = Math.floor(gx); c < Math.ceil(gx + def.w); c++) if (gy + def.h > (geo.ceil[c] ?? 0)) return false;
  return true;
}

// alle Flächen, auf denen kleine Dinge stehen können: Boden + Ablagen der Möbel
export function supports(geo, items) {
  const list = [{ y: 0, x0: 0, x1: geo.cols, parent: null }];
  for (const it of items) {
    for (const s of furnitureById(it.id).surfaces || []) {
      list.push({ y: it.gy + s.y, x0: it.gx + s.x0, x1: it.gx + s.x1, parent: it.uid });
    }
  }
  return list;
}

export const childrenOf = (items, uid) => items.filter((i) => i.parent === uid);

// Nächster freier Platz zu (cx, cy) = gewünschte Mitte des Items in Zellen. null = kein Platz frei.
export function findSpot(geo, def, cx, cy, items, ignore = new Set()) {
  const others = items.filter((i) => !ignore.has(i.uid));
  const layer = layerOf(def);
  const blocked = (r) =>
    others.some((o) => {
      const od = furnitureById(o.id);
      return layerOf(od) === layer && overlap(r, rectOf(o.gx, o.gy, od));
    });

  let best = null;
  let bestScore = Infinity;
  const consider = (gx, gy, parent, extra = 0) => {
    if (gx < 0 || gx + def.w > geo.cols || !fitsCeiling(geo, gx, gy, def)) return;
    const r = rectOf(gx, gy, def);
    if (blocked(r)) return;
    const dx = gx + def.w / 2 - cx;
    const dy = gy + def.h / 2 - cy;
    const flat = def.kind === 'floor' || def.kind === 'rug';
    const score = dx * dx + (flat ? 0 : def.kind === 'small' ? 2 * dy * dy : dy * dy) + extra;
    if (score < bestScore) {
      bestScore = score;
      best = { gx, gy, parent };
    }
  };

  if (def.kind === 'floor' || def.kind === 'rug') {
    for (let gx = 0; gx <= geo.cols - def.w; gx++) consider(gx, 0, null);
  } else if (def.ceiling) {
    // hängt an der Decke: oben anstoßen (unter Dachschräge/Kuppel entsprechend tiefer)
    for (let gx = 0; gx <= geo.cols - def.w; gx++) {
      let top = Infinity;
      for (let c = gx; c < gx + def.w; c++) top = Math.min(top, geo.ceil[c] ?? 0);
      if (top - def.h >= 1) consider(gx, top - def.h, null);
    }
  } else if (def.kind === 'wall') {
    // frei an der Wand, aber nicht ganz unten am Boden; lieber dort, wo kein Möbel davor steht
    const front = others.map((o) => rectOf(o.gx, o.gy, furnitureById(o.id)));
    for (let gx = 0; gx <= geo.cols - def.w; gx++) {
      for (let gy = 1; gy <= geo.rows - def.h; gy++) {
        const hidden = front.filter((f) => overlap(rectOf(gx, gy, def), f)).length;
        consider(gx, gy, null, hidden * 30);
      }
    }
  } else {
    for (const s of supports(geo, others)) {
      for (let gx = s.x0; gx <= s.x1 - def.w; gx++) consider(gx, s.y, s.parent);
    }
  }
  return best;
}

// Ist genau dieser Platz (noch) frei?
export function isSpotFree(geo, def, spot, items, ignore) {
  const s = findSpot(geo, def, spot.gx + def.w / 2, spot.gy + def.h / 2, items, ignore);
  return !!s && s.gx === spot.gx && s.gy === spot.gy;
}

// Platz für "antippen statt ziehen": möglichst mittig, kleine Dinge bevorzugt auf Ablagen
export function findFreeSpot(geo, def, items) {
  const cy = { small: geo.rows, wall: geo.rows - 2, floor: 0, rug: 0 }[def.kind];
  return findSpot(geo, def, geo.cols / 2, cy, items);
}
