import Phaser from 'phaser';
import { COLORS } from '../config/layout.js';
import { CELL, furnitureById } from '../config/furniture.js';
import { supports } from '../systems/roomGrid.js';
import { frameTexture } from '../systems/frames.js';
import Sticker from './Sticker.js';
import { bake, bakedImage } from '../systems/bake.js';
import { lerpColor } from '../systems/motion.js';
import { BALCONY, balconyFit } from '../config/balcony.js';
import { ROOM_RES } from '../config/quality.js';

// Innenraum eines Raums in voller Größe (Raum-Koordinaten, eine Zelle = 80 px, Mitte = 0,0).
// Maße und Form kommen aus geo (systems/roomGeometry.js) – jede Höhle im Baum hat ihre eigene.
// Der Baum zeigt denselben Container verkleinert (TREE_SCALE), beim Einrichten zoomt die Kamera hinein.
export default class RoomView extends Phaser.GameObjects.Container {
  constructor(scene, x, y, state, typeDef, geo) {
    super(scene, x, y);
    this.state = state;
    this.typeDef = typeDef;
    this.geo = geo;
    this.stickers = new Map();

    // Wand/Boden und Rahmen sind gebacken (je Raumtyp und Form), Raster und Zielrahmen nur beim Ziehen sichtbar
    const W = geo.W + 20;
    const H = geo.H + 20;
    this.open = !!typeDef.open; // Balkon: keine Wand, kein Rahmen (siehe drawOpen)
    if (this.open && scene.textures.exists('spr-balkon')) {
      // gemalter Balkon-Rahmen, so gestreckt, dass seine Innenfläche den Raum umschließt (config/balcony.js)
      const f = balconyFit(geo);
      this.shell = scene.add.image(f.x, f.y, 'spr-balkon').setOrigin(0).setDisplaySize(BALCONY.w * f.sx, BALCONY.h * f.sy);
    } else {
      this.shell = bakedImage(scene, this.shellKey(), W, H, (g) => (this.open ? this.drawOpen(g) : this.drawShell(g)), { res: ROOM_RES });
    }
    // gemalter Zimmerrahmen, passend zusammengesetzt (systems/frames.js); der Balkon hat keinen
    this.rim = this.open
      ? scene.add.image(0, 0, '__DEFAULT').setVisible(false)
      : scene.add.image(0, 0, frameTexture(scene, geo, ROOM_RES)).setScale(1 / ROOM_RES);
    this.gridGfx = scene.add.graphics().setVisible(false);
    this.items = scene.add.container(0, 0);
    // Nacht: der Raum wird dunkler, solange eine Fee schläft; Lampen leuchten darüber (siehe RoomLife)
    // (der Balkon ist draußen: dort legt sich kein Kasten über den Himmel)
    this.night = bakedImage(scene, `night-${geo.key}${this.open ? '-open' : ''}`, W, H, (g) => {
      if (this.open) return;
      g.fillStyle(0x1d1846, 1);
      g.fillPoints(geo.outline, true);
    }, { res: 0.25 }).setAlpha(0);
    this.lights = scene.add.container(0, 0);
    this.lifeLayer = scene.add.container(0, 0); // Feen, Glitzer, Gedankenblasen (siehe life/RoomLife.js)
    this.marker = scene.add.graphics().setVisible(false);
    this.add([this.shell, this.items, this.night, this.lights, this.rim, this.lifeLayer, this.gridGfx, this.marker]);

    this.rebuild();
  }

  // Wandfarbe: vom Kind gewählt (state.wall) oder die des Raumtyps
  wallColor() {
    return this.state.wall ?? this.typeDef.interior.wall;
  }

  shellKey() {
    return `shell-${this.typeDef.id}-${this.geo.key}-${this.wallColor()}`;
  }

  // Wand neu einfärben (Wand und Boden werden dafür neu gebacken)
  setWall(color) {
    this.state.wall = color;
    const key = bake(this.scene, this.shellKey(), this.geo.W + 20, this.geo.H + 20, (g) => this.drawShell(g),
      (this.geo.W + 20) / 2, (this.geo.H + 20) / 2, ROOM_RES);
    this.shell.setTexture(key);
  }

  drawShell(g) {
    const it = this.typeDef.interior;
    const geo = this.geo;
    const left = geo.innerLeft - 20;
    const right = geo.innerRight + 20;
    const width = right - left;
    const wall = this.wallColor();
    // Sockel: passender, etwas dunklerer Ton der Wandfarbe
    const wainscot = this.state.wall == null ? it.wainscot : lerpColor(wall, 0x8a5a9a, 0.16);
    g.fillStyle(wall, 1);
    g.fillPoints(geo.outline, true);

    const fy = geo.floorY;
    if (it.pattern === 'tiles') {
      // Fliesenwand (Badezimmer): helle Fugen, je Fliese ein kleiner Glanz; unten drei Reihen im Sockelton
      const T = 56;
      g.fillStyle(wainscot, 1);
      g.fillRect(left, fy - 3 * T, width, 3 * T);
      for (let y = fy - T; y > geo.innerTop - T; y -= T) {
        for (let x = left; x < right; x += T) {
          // unter der Decke (Bogen, Giebel …) nur ganze Fliesen
          const low = y >= fy - 3 * T;
          if (!low && !(geo.inside(x, y, -8) && geo.inside(x + T, y, -8) && geo.inside(x + T / 2, y, -8))) continue;
          g.fillStyle(0xffffff, 0.75);
          g.fillRect(x, y, T, 3);
          g.fillRect(x, y, 3, T);
          g.fillStyle(0xffffff, 0.35);
          g.fillRoundedRect(x + 9, y + 9, 16, 6, 3);
        }
      }
      g.fillStyle(0xffffff, 0.85);
      g.fillRect(left, fy - 3 * T - 4, width, 8); // Abschlussleiste
    } else {
      // Tapetenmuster (nur innerhalb der Wand)
      g.fillStyle(0xffffff, 0.35);
      for (let row = 0, y = geo.innerTop + 50; y < geo.floorY - 130; row++, y += 70) {
        for (let x = left + 60 + (row % 2) * 40; x < right - 40; x += 80) {
          if (geo.inside(x, y, 24)) g.fillCircle(x, y, 6);
        }
      }
      // Sockel
      g.fillStyle(wainscot, 1);
      g.fillRect(left, fy - 110, width, 110);
      g.fillStyle(0xffffff, 0.4);
      g.fillRect(left, fy - 110, width, 8);
    }

    // Boden
    g.fillStyle(it.floor, 1);
    g.fillRect(left, fy, width, geo.innerBottom - fy + 20);
    g.lineStyle(4, it.floorLine, 1);
    g.lineBetween(left, fy, right, fy);
    for (let x = left + 80; x < right - 40; x += 120) g.lineBetween(x, fy, x, geo.innerBottom + 20);
  }

  // Balkon-Garten (Ersatz, falls das gemalte Bild fehlt): Holzdeck mit Streben darunter, Pergola (zwei Pfosten,
  // Balken mit Lichterkette). Kein Geländer.
  // Alles liegt hinter den Gegenständen; dahinter bleibt es durchsichtig (Himmel).
  drawOpen(g) {
    const geo = this.geo;
    const fy = geo.floorY;
    const x0 = -geo.W / 2 + 26;
    const x1 = geo.W / 2 - 26;
    const top = geo.innerTop - 6;
    const ink = 0x4a2a18;
    const wood = 0xb07a4a;
    const dark = 0x8a5a33;
    // Streben unter dem Deck (zum Stamm hin)
    for (const [ax, bx] of [[x0 + 60, -40], [x1 - 60, 40]]) {
      g.lineStyle(26, ink, 1);
      g.lineBetween(ax, fy + 30, bx, fy + 120);
      g.lineStyle(16, dark, 1);
      g.lineBetween(ax, fy + 30, bx, fy + 120);
    }
    // Pfosten und Balken der Pergola
    for (const px of [x0 + 26, x1 - 26]) {
      g.fillStyle(ink, 1);
      g.fillRoundedRect(px - 17, top - 4, 34, fy - top + 8, 8);
      g.fillStyle(wood, 1);
      g.fillRoundedRect(px - 12, top, 24, fy - top, 6);
    }
    g.fillStyle(ink, 1);
    g.fillRoundedRect(x0 - 6, top - 26, x1 - x0 + 12, 40, 12);
    g.fillStyle(wood, 1);
    g.fillRoundedRect(x0, top - 21, x1 - x0, 30, 10);
    g.fillStyle(dark, 1);
    for (let x = x0 + 50; x < x1 - 30; x += 90) g.fillRoundedRect(x, top - 34, 18, 52, 6); // Sparrenköpfe
    // Ranken an den Pfosten
    for (const px of [x0 + 26, x1 - 26]) {
      for (let y = top + 40; y < fy - 40; y += 46) {
        const d = ((y / 46) | 0) % 2 ? 1 : -1;
        g.fillStyle(0x5fae4a, 1);
        g.fillEllipse(px + d * 16, y, 26, 14);
        g.fillStyle(0x3f8a3c, 1);
        g.fillEllipse(px - d * 14, y + 22, 22, 12);
      }
    }
    // Lichterkette am Balken
    const bulbs = [0xfff3a8, 0xffc8f0, 0xb9f2ff];
    g.lineStyle(3, 0x5a3a2a, 1);
    const sag = (x) => top + 22 + Math.sin(((x - x0) / (x1 - x0)) * Math.PI * 3) ** 2 * 26;
    g.beginPath();
    for (let x = x0 + 10; x <= x1 - 10; x += 12) (x === x0 + 10 ? g.moveTo : g.lineTo).call(g, x, sag(x));
    g.strokePath();
    for (let x = x0 + 30, i = 0; x < x1 - 20; x += 46, i++) {
      g.fillStyle(bulbs[i % 3], 1);
      g.fillCircle(x, sag(x) + 9, 8);
    }
    // Deck
    g.fillStyle(ink, 1);
    g.fillRoundedRect(x0 - 8, fy - 6, x1 - x0 + 16, 48, 12);
    g.fillStyle(this.typeDef.interior.floor, 1);
    g.fillRoundedRect(x0 - 2, fy - 2, x1 - x0 + 4, 32, 9);
    g.lineStyle(3, this.typeDef.interior.floorLine, 1);
    for (let x = x0 + 70; x < x1; x += 90) g.lineBetween(x, fy, x, fy + 28);
    g.fillStyle(dark, 1);
    g.fillRoundedRect(x0 - 2, fy + 26, x1 - x0 + 4, 12, 5);
  }

  rebuild() {
    this.items.removeAll(true);
    this.stickers.clear();
    for (const item of this.state.items) this.addSticker(item);
    this.sortItems();
  }

  // Mitte der Unterkante eines Items in Raum-Koordinaten
  cellPos(gx, gy, def) {
    return { x: this.geo.gridX0 + (gx + def.w / 2) * CELL, y: this.geo.floorY - gy * CELL };
  }

  // Welt-Koordinaten ↔ Raum-Koordinaten (der Raum steckt skaliert im Raum-Container im Baum)
  toLocal(wx, wy) {
    const p = this.getWorldTransformMatrix().applyInverse(wx, wy);
    return { x: p.x, y: p.y };
  }

  toWorld(lx, ly) {
    const p = this.getWorldTransformMatrix().transformPoint(lx, ly);
    return { x: p.x, y: p.y };
  }

  // Raum-Koordinaten → Zellen (Gleitkomma)
  toCell(lx, ly) {
    return { cx: (lx - this.geo.gridX0) / CELL, cy: (this.geo.floorY - ly) / CELL };
  }

  createSticker(def, look) {
    const s = new Sticker(this.scene, def, look);
    this.items.add(s);
    return s;
  }

  addSticker(item) {
    const def = furnitureById(item.id);
    const s = this.createSticker(def, item);
    const p = this.cellPos(item.gx, item.gy, def);
    s.setPosition(p.x, p.y);
    s.item = item;
    this.stickers.set(item.uid, s);
    return s;
  }

  removeSticker(uid) {
    const s = this.stickers.get(uid);
    this.stickers.delete(uid);
    return s;
  }

  // Wandsachen hinten, dann Möbel, dann Kleinkram, Getragenes und Hilfsobjekte ganz vorn
  sortItems() {
    const order = { wall: 0, rug: 500, floor: 1000, small: 2000 };
    const layer = (s) => (!s.def || s.carried ? 3000 : order[s.def.kind]);
    this.items.list.forEach((s, i) => (s.depthKey = layer(s) + i));
    this.items.sort('depthKey');
  }

  hitTest(lx, ly) {
    const list = this.items.list;
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].item && !list[i].carried && list[i].containsLocal(lx, ly)) return list[i];
    }
    return null;
  }

  // Raster beim Ziehen einblenden; bei kleinen Dingen zusätzlich die Ablagen hervorheben
  showGrid(def, ignore = new Set()) {
    const g = this.gridGfx.clear().setVisible(!!def);
    if (!def) return;
    const { gridX0, floorY, cols, ceil } = this.geo;
    for (let c = 0; c <= cols; c++) {
      // Punkt nur, wo er unter der Decke liegt (Dachschräge, Kuppel)
      const top = Math.min(ceil[c - 1] ?? 0, ceil[c] ?? 0) || Math.max(ceil[c - 1] ?? 0, ceil[c] ?? 0);
      for (let r = 0; r <= top; r++) {
        const x = gridX0 + c * CELL;
        const y = floorY - r * CELL;
        g.fillStyle(0x5a3a7a, 0.35);
        g.fillCircle(x, y, 7);
        g.fillStyle(0xffffff, 0.9);
        g.fillCircle(x, y, 4);
      }
    }
    if (def.kind === 'small') {
      g.lineStyle(8, COLORS.glow, 0.9);
      for (const s of supports(this.geo, this.state.items.filter((i) => !ignore.has(i.uid)))) {
        g.lineBetween(gridX0 + s.x0 * CELL + 6, floorY - s.y * CELL, gridX0 + s.x1 * CELL - 6, floorY - s.y * CELL);
      }
    }
  }

  // leuchtender Zielrahmen, wo das Item einrasten wird
  showMarker(spot, def) {
    const g = this.marker.clear().setVisible(!!spot);
    if (!spot) return;
    const x = this.geo.gridX0 + spot.gx * CELL;
    const y = this.geo.floorY - (spot.gy + def.h) * CELL;
    g.fillStyle(COLORS.glow, 0.22);
    g.fillRoundedRect(x + 4, y + 4, def.w * CELL - 8, def.h * CELL - 8, 14);
    g.lineStyle(6, COLORS.glow, 1);
    g.strokeRoundedRect(x + 4, y + 4, def.w * CELL - 8, def.h * CELL - 8, 14);
  }
}
