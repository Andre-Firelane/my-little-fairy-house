// Spielstand des Feenhauses (noch ohne Speichern). Ein Raum je Höhle:
// { slotId, type, items: [{ uid, id, gx, gy, parent }] }

import { FAIRY_PALETTES } from '../config/fairies.js';
import { furnitureById } from '../config/furniture.js';
import { findSpot } from '../systems/roomGrid.js';

let nextUid = 1;
export const newUid = () => `i${nextUid++}`;

// nächste Feen, die in ein neues Zimmer einziehen (der Reihe nach, danach wieder von vorn)
let nextFairy = 0;
export function nextFairies(n) {
  return Array.from({ length: n }, () => FAIRY_PALETTES[nextFairy++ % FAIRY_PALETTES.length]);
}

export const house = {
  rooms: new Map(),
};

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
