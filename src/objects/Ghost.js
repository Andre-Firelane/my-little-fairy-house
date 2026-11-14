import Fairy from './Fairy.js';
import { bake, bakedImage } from '../systems/bake.js';

const RES = 2;

// Kleiner Geist der Geisterstunde: bewegt sich und arbeitet wie eine Fee (gleiche Tätigkeiten, gleiche Regie),
// aber ohne Glitzer (sein Glitzer-System ist Nebel, siehe RoomLife.mist) und ohne Feenstaub (ActivityDirector).
// Statt Flügeln winken zwei Ärmchen; Kleidung wechselt er nicht.
export default class Ghost extends Fairy {
  constructor(scene, x, y, palette, mist, scale, home, parent) {
    super(scene, x, y, palette, mist, scale, home, parent);
    this.isGhost = true;
    this.visual.setAlpha(0.92);
  }

  static prebake(scene, palettes) {
    for (const palette of palettes) {
      const g = { scene, palette };
      const B = Ghost.prototype.bodyBox();
      bake(scene, Ghost.prototype.bodyKey.call(g), B.w, B.h, (gr) => Ghost.prototype.drawBody.call(g, gr), B.ox, B.oy, RES);
      for (const side of [-1, 1]) Ghost.prototype.makeWing.call(g, side).destroy();
    }
  }

  bodyBox() {
    return { w: 56, h: 80, ox: 28, oy: 44 };
  }

  bodyKey() {
    return `ghost-body-${this.palette.name}`;
  }

  setOutfit() {}

  usesPaintedLook() {
    return false; // Geister bleiben gezeichnet
  }

  // Ärmchen (Ursprung an der Schulter, damit das Flügelschlagen zum Winken wird)
  makeWing(side) {
    const p = this.palette;
    const img = bakedImage(this.scene, `ghost-arm-${p.name}-${side}`, 30, 24, (g) => {
      g.fillStyle(p.sheet, 1);
      g.fillEllipse(side * 12, 0, 22, 13);
      g.lineStyle(2, 0xb8c4e8, 0.8);
      g.strokeEllipse(side * 12, 0, 22, 13);
    }, { ox: side < 0 ? 28 : 2, oy: 12, res: RES });
    img.y = 2;
    return img;
  }

  // Bettlaken-Geist: runde Kuppel, gewellter Saum, große Augen, Wangenröte, kleiner „o“-Mund
  drawBody(g) {
    const p = this.palette;
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI + (i / 20) * Math.PI;
      pts.push({ x: Math.cos(a) * 20, y: -12 + Math.sin(a) * 22 });
    }
    // Saum: drei weiche Zipfel
    for (let i = 0; i <= 24; i++) {
      const x = 20 - (i / 24) * 40;
      pts.push({ x, y: 26 + Math.sin((i / 24) * Math.PI * 3) * 5 });
    }
    g.fillStyle(0x8a94c8, 0.25);
    g.fillPoints(pts.map((q) => ({ x: q.x + 2, y: q.y + 3 })), true);
    g.fillStyle(p.sheet, 1);
    g.fillPoints(pts, true);
    g.lineStyle(2.5, 0xb8c4e8, 0.9);
    g.strokePoints(pts, true);
    g.fillStyle(0x3b2a4a, 1);
    g.fillEllipse(-7, -14, 7, 10);
    g.fillEllipse(7, -14, 7, 10);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(-6, -16, 1.6);
    g.fillCircle(8, -16, 1.6);
    g.fillStyle(0xff8fa8, 0.5);
    g.fillCircle(-12, -6, 3);
    g.fillCircle(12, -6, 3);
    g.fillStyle(0x6a4a7a, 1);
    g.fillEllipse(0, -3, 5, 6);
  }
}
