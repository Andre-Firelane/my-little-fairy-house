// Spielstand des Feenhauses. Ein Raum je Höhle:
// { slotId, type, wall?, items: [{ uid, id, gx, gy, parent, … Zustand (state, amount, liquid …) }] }
// Gespeichert wird er über state/save.js (snapshot / restore unten).

import { FAIRY_PALETTES } from '../config/fairies.js';
import { furnitureById } from '../config/furniture.js';
import { findSpot } from '../systems/roomGrid.js';
import { dust } from './dust.js';
import { looks, resetLooks } from './looks.js';

let nextUid = 1;
export const newUid = () => `i${nextUid++}`;

// nächste Feen, die in ein neues Zimmer einziehen (der Reihe nach, danach wieder von vorn)
let nextFairy = 0;
export function nextFairies(n) {
  return Array.from({ length: n }, () => FAIRY_PALETTES[nextFairy++ % FAIRY_PALETTES.length]);
}

export const house = {
  rooms: new Map(),
  clockT: 0, // Tageszeit beim Laden
};

// alles auf Anfang (neues Spiel, Test-Spiel)
export function resetGame() {
  house.rooms = new Map();
  house.clockT = 0;
  nextUid = 1;
  nextFairy = 0;
  dust.set(0);
  resetLooks();
}

// Startausstattung wird ins Raster der Höhle gesetzt (passt so in jede Größe und Form)
export function createRoom(slotId, typeDef, geo) {
  const room = { slotId, type: typeDef.id, items: [] };
  // p.or = Ersatz, falls der Gegenstand nicht in die Höhle passt (z. B. zu hoch für eine kleine Kammer)
  for (const p of typeDef.preset || []) {
    for (const id of [p.id, p.or].filter(Boolean)) {
      const def = furnitureById(id);
      const spot = findSpot(geo, def, p.gx + def.w / 2, p.gy + def.h / 2, room.items);
      if (!spot) continue;
      room.items.push({ uid: newUid(), id, ...spot });
      break;
    }
  }
  house.rooms.set(slotId, room);
  return room;
}

// ---------- Speichern / Laden ----------

// reines JSON des Hauses (clockT kommt von der Uhr der Baum-Szene)
export function snapshot(clockT) {
  return {
    rooms: [...house.rooms.values()],
    dust: dust.amount,
    clockT,
    looks, // Aussehen der Feen (Fee antippen)
  };
}

// Zustände, die nur während einer laufenden Tätigkeit gelten (die Tätigkeit läuft nach dem Laden nicht weiter):
// offene Schränke und Bücher, backender Ofen, Tanzfläche und Discokugel, volle Badewanne.
// Dauerhaft bleiben: Lampen an/aus, voller Kessel, gefüllte Gläser, Portionen, die Tafel.
function settle(item) {
  const def = furnitureById(item.id);
  if (!def) return false;
  if (item.state === 'open') item.state = null;
  if (def.id === 'ofen' || def.dancefloor || def.disco) item.state = null;
  if (def.bath) {
    item.liquid = null;
    item.foam = 0;
  }
  if (def.skyWindow) item.state = null; // stellt sich nach der Tageszeit selbst ein
  if (def.saw) item.state = null; // Säge liegt wieder auf dem Bock
  if (def.wheel) item.state = null; // Töpferscheibe steht wieder still
  return true;
}

// Dinge auf Möbeln genau auf die Ablage setzen (die Höhe der obersten Ablage wird beim Start aus dem Bild gemessen,
// siehe BootScene.measureTop – ältere Spielstände hatten sie noch etwas höher)
function onSurfaces(items) {
  for (const it of items) {
    if (it.parent == null) continue;
    const p = items.find((o) => o.uid === it.parent);
    const surfaces = p && furnitureById(p.id)?.surfaces;
    if (!surfaces?.length) continue;
    const best = surfaces.reduce((a, s) => (Math.abs(p.gy + s.y - it.gy) < Math.abs(p.gy + a.y - it.gy) ? s : a));
    it.gy = p.gy + best.y;
    // seitlich ins Raster der Ablage einrasten (z. B. Hochbeet: früher 0,15 versetzt, jetzt drei ganze Plätze)
    const def = furnitureById(it.id);
    const x0 = p.gx + best.x0;
    const slots = Math.max(0, Math.floor(best.x1 - best.x0 - (def?.w ?? 1)));
    it.gx = x0 + Math.max(0, Math.min(slots, Math.round(it.gx - x0)));
  }
}

export function restore(data) {
  resetGame();
  let maxUid = 0;
  for (const r of data?.rooms ?? []) {
    if (!r || r.slotId == null || !Array.isArray(r.items)) continue;
    r.items = r.items.filter(settle);
    onSurfaces(r.items);
    for (const it of r.items) maxUid = Math.max(maxUid, Number(String(it.uid).slice(1)) || 0);
    house.rooms.set(r.slotId, r);
  }
  nextUid = maxUid + 1;
  house.clockT = Number(data?.clockT) || 0;
  dust.set(data?.dust ?? 0);
  resetLooks(data?.looks);
}
