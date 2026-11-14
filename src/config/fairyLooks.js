// Feen-Baukasten: Aussehen der Feen aus gemalten Teilen – im Spiel wählbar: Fee antippen (ui/fairyLookMenu.js).
//
// Die Teile kommen aus tools/import-fairy-kit.py (Quellen: art-source/baukasten/*.webp):
// 9 Grundfiguren (Gesicht und Hautfarbe), Frisuren, Kleider, Zauberstäbe und Flügel.
// Alle Teile außer den Flügeln haben denselben Rahmen (fairyParts.json → frame) und liegen ohne weitere
// Angaben passend übereinander. Flügel: Bild des RECHTEN Flügels mit eigenen Maßen (h, ox/oy = Ansatz
// an der Schulter); der linke wird gespiegelt.
//
// Jede Fee trägt einen "look" (siehe DEFAULT_LOOK): je Ebene die ID eines Teils aus FAIRY_PARTS.
// Weitere Teile: Bild nach public/assets/fairies/ und hier eintragen (eigene Maße mit h, ox, oy möglich).
import PARTS from './fairyParts.json';
import { savedLook } from '../state/looks.js';

// Ebenen von hinten nach vorn (Flügel liegen immer ganz hinten; die Hand der Grundfigur liegt über dem Zauberstab)
export const LOOK_LAYERS = ['hairBack', 'body', 'face', 'dress', 'wand', 'hair', 'accessory'];

const numbered = (kind) => Object.fromEntries(PARTS[kind].map((n) => [String(n), { file: `${kind}-${n}` }]));

export const FAIRY_PARTS = {
  body: Object.fromEntries(PARTS.body.map((n) => [String(n), { file: `body-${n}`, hand: `hand-${n}` }])),
  hairBack: {}, // lange Haare, die hinter dem Körper hängen
  face: {}, // (die Gesichter gehören zu den Grundfiguren)
  dress: numbered('dress'), // 'pj' / 'apron' würden als Schlafanzug / Schürze genutzt
  wand: Object.fromEntries(PARTS.wand.map((w) => [String(w.id), { file: `wand-${w.id}`, h: w.h, ox: w.ox, oy: w.oy }])), // eigener, größerer Rahmen
  hair: numbered('hair'), // eine Frisur kann mit back: '<id>' ihr hairBack-Teil mitbringen
  accessory: {}, // Krönchen, Haarreif, …
  wings: Object.fromEntries(PARTS.wings.map((w) => [String(w.id), { file: `wing-${w.id}`, h: w.h, ox: w.ox, oy: w.oy }])),
};

export const DEFAULT_LOOK = {
  body: '1', hairBack: null, face: null, dress: '1', wand: '1', hair: '1', accessory: null, wings: '1', skin: null, wingColor: null,
};

// die n-te Fee: Grundfigur, Frisur, Kleid, Zauberstab und Flügel der Reihe nach (jede Fee sieht anders aus)
export function templateLook(n) {
  const pick = (kind) => String(((n - 1) % Object.keys(FAIRY_PARTS[kind]).length) + 1);
  return { body: pick('body'), hair: pick('hair'), dress: pick('dress'), wand: pick('wand'), wings: pick('wings') };
}

// Maße eines Teils (fehlende Angaben = gemeinsamer Rahmen)
export function partGeometry(part) {
  const F = PARTS.frame;
  return { h: part.h ?? F.h, ox: part.ox ?? F.ox, oy: part.oy ?? F.oy };
}

// Ausschnitt jedes Teil-Bildes ohne leeren Rand (Vorschau im Menü)
export const PART_BOXES = PARTS.boxes;

export const fileKey = (file) => `fairy-part-${file}`;
export const partKey = (part) => fileKey(part.file);

// Look einer Fee: Grundlage, darüber die Palette (look: { … }), darüber, was im Spiel gewählt wurde
export function lookOf(palette) {
  return { ...DEFAULT_LOOK, ...palette.look, ...savedLook(palette.name) };
}

// Körper-Maße für Zubehör, das die Fee selbst zeichnet (Zipfelmütze, Schürze): relativ zum Schulter-Anker
export const FIGURE = { head: PARTS.head, wandTip: PARTS.wandTip };

// alle Teil-Bilder laden (BootScene)
export function loadFairyParts(load) {
  for (const parts of Object.values(FAIRY_PARTS)) {
    for (const part of Object.values(parts)) {
      load.image(partKey(part), `assets/fairies/${part.file}.png`);
      for (const extra of [part.skin, part.hand]) if (extra) load.image(fileKey(extra), `assets/fairies/${extra}.png`);
    }
  }
}
