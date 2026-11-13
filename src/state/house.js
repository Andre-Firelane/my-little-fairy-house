// Spielstand des Feenhauses. Ein Raum je Höhle:
// { slotId, type, wall?, items: [{ uid, id, gx, gy, parent, … Zustand (state, amount, liquid …) }] }
// Gespeichert wird er über state/save.js (snapshot / restore unten).

import { FAIRY_PALETTES } from '../config/fairies.js';
import { furnitureById } from '../config/furniture.js';
import { findSpot } from '../systems/roomGrid.js';
import { dust } from './dust.js';

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
  return true;
}

export function restore(data) {
  resetGame();
  let maxUid = 0;
  for (const r of data?.rooms ?? []) {
    if (!r || r.slotId == null || !Array.isArray(r.items)) continue;
    r.items = r.items.filter(settle);
    for (const it of r.items) maxUid = Math.max(maxUid, Number(String(it.uid).slice(1)) || 0);
    house.rooms.set(r.slotId, r);
  }
  nextUid = maxUid + 1;
  house.clockT = Number(data?.clockT) || 0;
  dust.set(data?.dust ?? 0);
}
