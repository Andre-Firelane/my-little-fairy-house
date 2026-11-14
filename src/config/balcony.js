// Gemalter Balkon-Rahmen (tools/import-sprites.py, Lieferung 5 → public/assets/sprites/balkon.png):
// Pergola mit Lichterkette, Pfosten mit je zwei Haken außen, Deck und Streben; innen durchsichtig.
// balcony.json: Bildgröße und Innenfläche (x0, y0, x1, y1) in Bild-Pixeln.
// Der Rahmen wird so gestreckt, dass seine Innenfläche genau den Raum des Balkons umschließt (balconyFit).

import BAL from './balcony.json';

const CELL = 80; // (wie config/furniture.js – hier nicht importiert, sonst Kreis-Import über garden.js)

export const BALCONY = BAL;

// Haken außen an den Pfosten (Bild-Pixel: Spitze des Hakens); side −1 links, 1 rechts
const PEGS = [
  { x: 6, y: 194, side: -1 },
  { x: 6, y: 334, side: -1 },
  { x: BAL.w - 7, y: 204, side: 1 },
  { x: BAL.w - 7, y: 338, side: 1 },
];

// Bild-Pixel → Raum-Koordinaten: { x, y } = linke obere Ecke des Bildes, sx/sy = Streckung
export function balconyFit(geo) {
  const [ix0, iy0, ix1, iy1] = BAL.inner;
  const left = geo.gridX0 - 24;
  const right = geo.gridX0 + geo.cols * CELL + 24;
  const top = geo.innerTop + 6;
  const bottom = geo.floorY;
  const sx = (right - left) / (ix1 - ix0);
  const sy = (bottom - top) / (iy1 - iy0);
  return { x: left - ix0 * sx, y: top - iy0 * sy, sx, sy };
}

// Plätze für Blumenkästen (Rasterzellen, wie Items: gx/gy = linke Unterkante): an den gemalten Haken,
// der Kasten hängt mit seinem oberen Viertel am Haken und ragt nach außen
export function railSpots(geo, w, h) {
  const f = balconyFit(geo);
  return PEGS.map((p) => {
    const px = f.x + p.x * f.sx;
    const py = f.y + p.y * f.sy;
    const cx = px + p.side * (w * CELL * 0.5 - 14);
    const gx = (cx - geo.gridX0) / CELL - w / 2;
    const top = (geo.floorY - py) / CELL + h * 0.25;
    return { gx: Math.round(gx * 100) / 100, gy: Math.round((top - h) * 100) / 100 };
  });
}
