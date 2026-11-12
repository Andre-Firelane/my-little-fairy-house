import Phaser from 'phaser';
import { starPoints } from '../systems/draw.js';
import { FURNITURE, CELL, STICKER_PAD, textureKey } from '../config/furniture.js';
import SPRITE_FILES from '../config/sprites.json';
import TREE_PARTS from '../config/tree.json';

// Erzeugt die wenigen Texturen per Code (keine Bilddateien nötig) und startet das Spiel.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  // gemalte Bilder (tools/import-sprites.py): Möbel, Zimmerrahmen, Baum
  preload() {
    const files = new Set(['baum']);
    for (const def of Object.values(FURNITURE)) {
      if (!def.sprite) continue;
      files.add(def.sprite);
      for (const state of Object.keys(def.states || {})) files.add(def.spriteStates?.[state] ?? `${def.sprite}_${state}`);
    }
    // nur vorhandene Bilder laden (fehlende Zustandsbilder: dann gilt das Grundbild)
    for (const f of files) if (SPRITE_FILES.includes(f)) this.load.image(`spr-${f}`, `assets/sprites/${f}.png`);
    for (const shape of ['rect', 'arch', 'dome', 'gable']) this.load.image(`frame-${shape}`, `assets/frames/${shape}.png`);
    // Baum: Kronenstücke und (nahtlose) Rinde
    for (let i = 1; i <= TREE_PARTS.krone; i++) this.load.image(`tree-krone-${i}`, `assets/tree/krone-${i}.png`);
    for (let i = 1; i <= TREE_PARTS.rinde; i++) this.load.image(`tree-rinde-${i}`, `assets/tree/rinde-${i}.png`);
    for (let i = 1; i <= (TREE_PARTS.rasen || 0); i++) this.load.image(`tree-rasen-${i}`, `assets/tree/rasen-${i}.png`);
  }

  // Möbel-Textur aus einem gemalten Bild: unten (bzw. oben) bündig ins Rasterfeld eingepasst
  spriteTexture(def, key, file) {
    const W = def.w * CELL;
    const H = def.h * CELL;
    const P = STICKER_PAD;
    const img = this.textures.get(`spr-${file}`).getSourceImage();
    const s = Math.min(W / img.width, H / img.height);
    const dw = def.spriteSize?.w ?? img.width * s;
    const dh = def.spriteSize?.h ?? img.height * s;
    const tex = this.textures.createCanvas(key, W + P * 2, H + P * 2);
    const ctx = tex.getContext();
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, P + (W - dw) / 2, def.spriteAlign === 'top' ? P : P + H - dh, dw, dh);
    tex.refresh();
  }

  create() {
    const g = this.make.graphics({}, false);

    // weicher Glitzerpunkt (helle Mitte, ausfransender Rand)
    for (let r = 16; r >= 1; r--) {
      g.fillStyle(0xffffff, 0.08);
      g.fillCircle(16, 16, r);
    }
    g.fillStyle(0xffffff, 1);
    g.fillCircle(16, 16, 3);
    g.generateTexture('sparkle', 32, 32);
    g.clear();

    // 4-zackiger Funkelstern
    g.fillStyle(0xffffff, 1);
    g.fillPoints(starPoints(16, 16, 15, 4, 4), true);
    g.generateTexture('star', 32, 32);

    // Einrichtungsgegenstände: Zeichnung → Textur (mit Rand für den Sticker-Umriss)
    // je Farbvariante und Zustand eine eigene Textur
    for (const def of Object.values(FURNITURE)) {
      const W = def.w * CELL;
      const H = def.h * CELL;
      for (let v = 0; v < (def.variants || 1); v++) {
        for (const state of [null, ...Object.keys(def.states || {})]) {
          if (def.sprite) {
            const file = state ? (def.spriteStates?.[state] ?? `${def.sprite}_${state}`) : def.sprite;
            this.spriteTexture(def, textureKey(def.id, v, state), this.textures.exists(`spr-${file}`) ? file : def.sprite);
            continue;
          }
          g.clear();
          g.translateCanvas(STICKER_PAD, STICKER_PAD);
          if (state) def.states[state](g, W, H, v);
          else def.draw(g, W, H, v);
          g.generateTexture(textureKey(def.id, v, state), W + STICKER_PAD * 2, H + STICKER_PAD * 2);
        }
      }
    }

    // Zutaten-Stückchen, die eine Fee trägt (werden eingefärbt)
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillPoints([{ x: 2, y: 22 }, { x: 6, y: 10 }, { x: 16, y: 3 }, { x: 24, y: 2 }, { x: 21, y: 12 }, { x: 12, y: 20 }], true);
    g.generateTexture('leaf', 26, 24);
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillPoints([{ x: 11, y: 1 }, { x: 5, y: 12 }, { x: 4, y: 18 }, { x: 8, y: 24 }, { x: 14, y: 24 }, { x: 18, y: 18 }, { x: 17, y: 12 }], true);
    g.generateTexture('drop', 22, 26);

    // Apfel (Kochen: die Fee trägt ihn zum Ofen)
    g.clear();
    g.fillStyle(0xe0566f, 1);
    g.fillCircle(12, 15, 10);
    g.fillStyle(0x5fb468, 1);
    g.fillEllipse(17, 4, 9, 5);
    g.lineStyle(2, 0x6b4128, 1);
    g.lineBetween(12, 5, 12, 9);
    g.generateTexture('apple', 26, 26);

    // "Z" für schlafende Feen (mit Canvas gezeichnet, weißer Rand)
    const zc = document.createElement('canvas');
    zc.width = 56;
    zc.height = 60;
    const ctx = zc.getContext('2d');
    ctx.font = 'bold 50px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 7;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    ctx.strokeText('Z', 28, 32);
    ctx.fillStyle = '#7a5ad6';
    ctx.fillText('Z', 28, 32);
    this.textures.addCanvas('zletter', zc);

    // umblätternde Buchseite
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(0, 0, 26, 22, 3);
    g.lineStyle(2, 0xc9b8e8, 1);
    for (let i = 0; i < 3; i++) g.lineBetween(4, 6 + i * 5, 22, 6 + i * 5);
    g.generateTexture('page', 26, 22);

    // Shampooflasche (Baden) und Haarbürste (Spiegelschrank)
    g.clear();
    g.fillStyle(0xff7ab8, 1);
    g.fillRoundedRect(3, 12, 20, 26, 6);
    g.fillStyle(0xffffff, 1);
    g.fillRect(10, 4, 6, 8);
    g.fillRect(10, 2, 13, 4);
    g.fillStyle(0xffffff, 0.8);
    g.fillCircle(13, 25, 4);
    g.generateTexture('shampoo', 26, 40);
    g.clear();
    g.fillStyle(0xc98b5a, 1);
    g.fillRoundedRect(0, 7, 16, 6, 3);
    g.fillStyle(0xff9ec7, 1);
    g.fillRoundedRect(14, 1, 20, 18, 7);
    g.fillStyle(0xffffff, 1);
    for (let i = 0; i < 4; i++) g.fillCircle(19 + i * 4, 6, 1.4);
    for (let i = 0; i < 4; i++) g.fillCircle(19 + i * 4, 13, 1.4);
    g.generateTexture('brush', 36, 20);

    // Musiknote (wird eingefärbt)
    g.clear();
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(10, 30, 18, 13);
    g.fillRect(16, 4, 4, 27);
    g.fillPoints([{ x: 16, y: 2 }, { x: 28, y: 10 }, { x: 28, y: 18 }, { x: 20, y: 12 }], true);
    g.generateTexture('note', 30, 38);
    g.destroy();

    this.scene.start('Tree');
  }
}
