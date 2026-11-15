// Alle festen Maße und Positionen an einer Stelle. Spielfläche ist immer 1920 hoch (Scale.FIT skaliert aufs Display).
// Hochformat (Tablet): 1080 breit. Querformat (PC): so breit wie das Fenster (höchstens 2:1) –
// der Baum bekommt dann links und rechts Himmel und Wiese, die Bedienleisten bleiben mittig UI_W breit.

import { sway, halfWidth, TRUNK_X, TREEHOUSE, OX, OY } from './treeShape.js';

export const UI_W = 1080; // Breite der Bedienung (Leisten, Knöpfe); im Querformat mittig
export const GAME_H = 1920;
export let GAME_W = UI_W; // aktuelle Breite der Spielfläche (ändert sich mit dem Fenster, siehe setGameWidth)

// passende Spielbreite für das Fenster: Hochformat = UI_W, Querformat = Seitenverhältnis des Fensters
export function fitWidth() {
  if (matchMedia('(pointer: coarse)').matches) return UI_W; // Tablet/Handy: immer Hochformat
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  if (aspect <= 1) return UI_W;
  return Math.round(Math.min(Math.max(GAME_H * aspect, UI_W), GAME_H * 2));
}

// Linker Rand der mittigen Bedienung auf dem Bildschirm
export const uiLeft = () => (GAME_W - UI_W) / 2;

// Kartenleiste unten (UIScene)
export const BAR_H = 330;
export const BAR_TOP = GAME_H - BAR_H;

// Welt der TreeScene: großer Baum, in alle Richtungen wischbar, mit zwei Fingern zoombar
// Baum (2400 × 5000) plus Platz für die große Krone oben und zu den Seiten
export const WORLD_W = 2400 + 2 * OX;
export const WORLD_H = 5000 + OY;
// Zoomgrenzen: ganz herausgezoomt ist der Stamm etwa bildschirmbreit (die Krone darf seitlich hinausragen,
// man wischt dann hin und her) – nicht weiter, damit man die Feen noch gut sieht; nah heran geht es bis
// MAX_ZOOM (im Querformat etwas weniger, der Bildschirm ist dort breiter).
const TREE_MIN_ZOOM = 0.38;
export let MIN_ZOOM = Math.max(UI_W / WORLD_W, TREE_MIN_ZOOM);
export let MAX_ZOOM = 2.2;
export const START_ZOOM = 0.8;

export function setGameWidth(w) {
  GAME_W = w;
  const landscape = w > UI_W;
  MIN_ZOOM = Math.max(UI_W / WORLD_W, TREE_MIN_ZOOM);
  MAX_ZOOM = landscape ? 1.7 : 2.2;
}

// Räume im Baum: Innenraum (Raum-Koordinaten, 80 px je Rasterfeld) wird so verkleinert
export const TREE_SCALE = 0.5;

// Vorschaubilder der Raumtypen (Karten in der Leiste)
export const ROOM_W = 300;
export const ROOM_H = 250;

// Großansicht eines Raums (Einrichten): Mitte des Raums auf dem Bildschirm, Oberkante der Gegenstands-Leiste
export const EDIT_ROOM_Y = 830;
export const TRAY_TOP = 1560;
export const SWATCH_Y = 1490; // Reihe der Wandfarben über der Gegenstands-Leiste

// Wandfarben zum Auswählen (pastellig)
export const WALL_COLORS = [
  0xf7c6d9, // Rosa
  0xfbd5bd, // Pfirsich
  0xfaf0bf, // Zitrone
  0xd5e6c3, // Salbei
  0xbfe8d4, // Mint
  0xc6e2f7, // Himmelblau
  0xd9c8f2, // Lavendel
  0xf3ead9, // Creme
];

// Die Höhlen im Stamm (Weltkoordinaten, Mittelpunkt). Jede hat eigene Größe (Rasterfelder) und Form
// (siehe systems/roomGeometry.js): rect = Kammer, arch = Rundbogen, dome = Kuppel, gable = Giebeldach.
// x gilt für den geraden Stamm – die Höhlen wandern mit seinem Schwung mit (config/treeShape.js).
// Höhle 1 ist kein Raum im Stamm, sondern das Baumhaus oben in den Ästen.
const RAW_SLOTS = [
  // je Etage zwei große Räume, unten zwischen den Wurzeln ein breiter (Größe in Rasterfeldern, Form siehe roomGeometry)
  // Etage 1 (rechts daneben: großes rundes Fenster)
  { id: 0, x: 894, y: 1404, cols: 12, rows: 6, shape: 'dome' },
  // Baumhaus in den Ästen
  { id: 1, x: TREEHOUSE.x, y: TREEHOUSE.y, cols: TREEHOUSE.cols, rows: TREEHOUSE.rows, shape: 'gable', treehouse: true },
  // Etage 2
  { id: 2, x: 874, y: 1942, cols: 14, rows: 6, shape: 'gable' },
  { id: 3, x: 1589, y: 2004, cols: 13, rows: 6, shape: 'rect' },
  // Etage 3
  { id: 4, x: 873, y: 2571, cols: 15, rows: 7, shape: 'arch' },
  { id: 5, x: 1566, y: 2512, cols: 11, rows: 7, shape: 'dome' },
  // Etage 4
  { id: 6, x: 886, y: 3141, cols: 17, rows: 6, shape: 'rect' },
  { id: 7, x: 1606, y: 3080, cols: 11, rows: 6, shape: 'gable' },
  // Etage 5
  { id: 8, x: 854, y: 3685, cols: 13, rows: 7, shape: 'gable' },
  { id: 9, x: 1564, y: 3780, cols: 14, rows: 7, shape: 'arch' },
  // Etage 6
  { id: 10, x: 1200, y: 4229, cols: 18, rows: 6, shape: 'rect' },
  // Balkone außen am Stamm (Garten, Sternwarte): x ergibt sich aus der Stammkante, side = links/rechts
  { id: 11, y: 2060, cols: 8, rows: 4, shape: 'rect', balcony: true, side: -1 },
  { id: 12, y: 3560, cols: 8, rows: 4, shape: 'rect', balcony: true, side: 1 },
  { id: 13, y: 2620, cols: 8, rows: 4, shape: 'rect', balcony: true, side: 1 },
  { id: 14, y: 3260, cols: 8, rows: 4, shape: 'rect', balcony: true, side: -1 },
];

// Balkon: halbe Breite in der Welt (Raster + Rand, etwa wie roomGeometry), etwas in den Stamm geschoben
const balconyX = (s) => TRUNK_X + sway(s.y) + s.side * (halfWidth(s.y) + ((s.cols * 80 + 204) * TREE_SCALE) / 2 - 40);

export const SLOTS = RAW_SLOTS.map((s) => {
  const x = s.balcony ? balconyX(s) : s.x + (s.treehouse ? 0 : sway(s.y));
  return { ...s, x: Math.round(x) + OX, y: s.y + OY };
});

export const DEPTH = {
  sky: -10,
  back: 0,
  tree: 10,
  slot: 20,
  room: 21,
  trail: 29,
  fairy: 30,
  fx: 40,
};

export const COLORS = {
  bark: 0x8a5a3b,
  barkLight: 0x9e6b47,
  barkDark: 0x6b4128,
  barkRim: 0xa8774f,
  hole: 0x3a2416,
  holeShadow: 0x2a190f,
  glow: 0xfff2a6,
  glitter: [0xfff3a8, 0xffc8f0, 0xb9f2ff, 0xffffff, 0xd8b8ff],
};

export const FONT = '"Trebuchet MS", "Segoe UI", sans-serif';
