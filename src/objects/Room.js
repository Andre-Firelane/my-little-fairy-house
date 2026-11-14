import Phaser from 'phaser';
import { ROOM_W, ROOM_H, DEPTH, TREE_SCALE } from '../config/layout.js';
import { CELL, STICKER_PAD, textureKey, furnitureById } from '../config/furniture.js';
import RoomLife from '../life/RoomLife.js';
import RoomView from './RoomView.js';
import { FURN_RES } from '../config/quality.js';
import { BALCONY } from '../config/balcony.js';

// Vorschaubild eines Raumtyps (Karten in der Leiste, Ghost beim Ziehen): gemalter Zimmerrahmen,
// Wand in der Farbe des Typs, davor typische Möbel als gemalte Sprites (def.preview, siehe config/rooms.js).
// Einträge: id = Möbel auf dem Boden (von links nach rechts), { id, above: i } = Wandsache über dem i-ten Bodenmöbel,
// { id, on: i } = kleines Ding oben auf dem i-ten Bodenmöbel.
export function roomArtImage(scene, def) {
  const key = `roomcard-${def.id}`;
  const W = ROOM_W + 20;
  const H = ROOM_H + 20;
  if (!scene.textures.exists(key)) {
    const tex = scene.textures.createCanvas(key, W, H);
    const ctx = tex.getContext();
    ctx.imageSmoothingQuality = 'high';
    const frame = scene.textures.get('frame-rect').getSourceImage();
    // Innenfläche des Rahmens (Kammer), etwas größer, damit sie unter dem Rahmen verschwindet
    const ix0 = W * 0.06;
    const ix1 = W * 0.94;
    const iy0 = H * 0.17;
    const iy1 = H * 0.9;
    const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
    const it = def.interior;
    const floorY = iy1 - H * 0.08;
    if (def.open) {
      // Balkon-Garten: Himmel statt Wand, Pergola und Holzdeck
      const sky = ctx.createLinearGradient(0, 0, 0, H);
      sky.addColorStop(0, '#9fd8ff');
      sky.addColorStop(1, '#e8f6ff');
      ctx.fillStyle = sky;
      ctx.beginPath();
      ctx.roundRect(8, 8, W - 16, H - 16, 26);
      ctx.fill();
      if (scene.textures.exists('spr-balkon')) {
        // gemalter Rahmen: Innenkante unten = Boden der Vorschau
        const img = scene.textures.get('spr-balkon').getSourceImage();
        const k = (W * 0.94) / BALCONY.w;
        ctx.drawImage(img, (W - BALCONY.w * k) / 2, floorY - BALCONY.inner[3] * k, BALCONY.w * k, BALCONY.h * k);
      } else {
      ctx.fillStyle = '#b07a4a';
      ctx.strokeStyle = '#4a2a18';
      ctx.lineWidth = 4;
      for (const px of [W * 0.12, W * 0.88]) {
        ctx.beginPath();
        ctx.roundRect(px - 8, H * 0.18, 16, floorY - H * 0.18, 5);
        ctx.fill();
        ctx.stroke();
      }
      ctx.beginPath();
      ctx.roundRect(W * 0.06, H * 0.13, W * 0.88, 16, 7);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = hex(it.floor);
      ctx.strokeStyle = '#4a2a18';
      ctx.beginPath();
      ctx.roundRect(W * 0.04, floorY, W * 0.92, 18, 7);
      ctx.fill();
      ctx.stroke();
      }
    } else {
    ctx.fillStyle = hex(it.wall);
    ctx.fillRect(ix0, iy0, ix1 - ix0, iy1 - iy0);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let y = iy0 + 14, r = 0; y < iy1 - 60; y += 22, r++) {
      for (let x = ix0 + 10 + (r % 2) * 12; x < ix1 - 6; x += 24) {
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.fillStyle = hex(it.wainscot);
    ctx.fillRect(ix0, floorY - 34, ix1 - ix0, 34);
    ctx.fillStyle = hex(it.floor);
    ctx.fillRect(ix0, floorY, ix1 - ix0, iy1 - floorY);
    }

    // Möbel: alle auf einen gemeinsamen Maßstab (ein Rasterfeld = cell px)
    const entries = (def.preview || []).map((e) => (typeof e === 'string' ? { id: e } : e));
    const floor = entries.filter((e) => e.above == null && e.on == null);
    const cell = 36;
    const gap = 6;
    const size = (id) => {
      const img = scene.textures.get(textureKey(id, 0, furnitureById(id)?.cardState ?? null)).getSourceImage();
      const s = cell / CELL;
      return { img, w: (img.width * s) / FURN_RES, h: (img.height * s) / FURN_RES, pad: STICKER_PAD * s };
    };
    const total = floor.reduce((n, e) => n + size(e.id).w - size(e.id).pad * 2, 0) + gap * (floor.length - 1);
    let x = W / 2 - total / 2;
    const placed = floor.map((e) => {
      const m = size(e.id);
      const left = x - m.pad;
      ctx.drawImage(m.img, left, floorY - m.h + m.pad, m.w, m.h);
      x += m.w - m.pad * 2 + gap;
      return { left: left + m.pad, w: m.w - m.pad * 2, top: floorY - m.h + m.pad * 2, def: furnitureById(e.id) };
    });
    for (const e of entries.filter((q) => q.above != null || q.on != null)) {
      const m = size(e.id);
      const base = placed[e.above ?? e.on];
      if (!base) continue;
      const cx = base.left + base.w / 2;
      const y = e.on != null ? base.top + m.pad + 2 : base.top - cell * 0.5;
      ctx.drawImage(m.img, cx - m.w / 2, y - m.h + m.pad, m.w, m.h);
    }
    // Rahmen obendrauf (der Balkon hat keinen)
    if (!def.open) ctx.drawImage(frame, 0, 0, W, H);
    tex.refresh();
  }
  return scene.add.image(0, 0, key);
}

// Raum im Baum: echter Innenraum (RoomView) in der Größe und Form seiner Höhle, verkleinert.
// Jeder Raum hat sein eigenes Leben (Feen, Tätigkeiten) – sichtbar schon im Baum.
export default class Room extends Phaser.GameObjects.Container {
  constructor(scene, def, x, y, state, geo) {
    super(scene, x, y);
    this.def = def;
    this.state = state;
    this.geo = geo;
    this.editable = !!def.catalog;
    this.w = geo.W * TREE_SCALE; // Größe in der Welt
    this.h = geo.H * TREE_SCALE;

    // warmes Licht im Raum (später: Lampen an/aus, Tag/Nacht)
    this.light = scene.add
      .image(0, -this.h * 0.05, 'sparkle')
      .setScale((this.w / 32) * 0.85, (this.h / 32) * 0.75)
      .setTint(0xffe9a8)
      .setAlpha(0); // (normaler Mischmodus: spart beim Zeichnen je Raum zwei Wechsel)

    this.view = new RoomView(scene, 0, 0, state, def, geo).setScale(TREE_SCALE);
    this.add([this.view, this.light]);
    this.life = new RoomLife(scene, { layer: this.view.lifeLayer, view: this.view, state });

    this.setSize(this.w, this.h).setInteractive().setDepth(DEPTH.room);
    scene.add.existing(this);
  }

  glowOn() {
    this.scene.tweens.add({ targets: this.light, alpha: 0.04, duration: 600, ease: 'Sine.Out' });
    this.scene.tweens.add({
      targets: this.light,
      alpha: { from: 0.04, to: 0.08 },
      duration: 1800,
      delay: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.InOut',
    });
  }
}
