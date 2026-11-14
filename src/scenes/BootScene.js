import Phaser from 'phaser';
import { starPoints } from '../systems/draw.js';
import { FURNITURE, CELL, STICKER_PAD, textureKey, thumbKey, cardScale } from '../config/furniture.js';
import SPRITE_FILES from '../config/sprites.json';
import TREE_PARTS from '../config/tree.json';
import { loadFairyParts } from '../config/fairyLooks.js';
import { FURN_RES } from '../config/quality.js';
import { GAME_H } from '../config/layout.js';
import { headerImage } from '../ui/header.js';

// Erzeugt die wenigen Texturen per Code (keine Bilddateien nötig) und startet das Spiel.
export default class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  // gemalte Bilder (tools/import-sprites.py): Möbel, Zimmerrahmen, Baum
  preload() {
    // Logo zuerst: erscheint über dem Ladebalken, sobald es da ist (bleibt fürs Hauptmenü geladen)
    this.load.image('logo', 'assets/logo.webp');
    this.load.once('filecomplete-image-logo', () => {
      // wie im Hauptmenü: Logo auf weißem Kopf
      const head = headerImage(this, this.scale.width, 780).setAlpha(0);
      this.tweens.add({ targets: head, alpha: 1, duration: 300 });
      const logo = this.add.image(this.scale.width / 2, 380, 'logo');
      logo.setScale(Math.min(1.3, (Math.min(this.scale.width, 1080) - 40) / logo.width, 720 / logo.height));
      logo.setAlpha(0);
      this.tweens.add({ targets: logo, alpha: 1, duration: 300 });
    });
    this.loadingBar();
    const files = new Set(['baum']);
    for (const def of Object.values(FURNITURE)) {
      if (!def.sprite) continue;
      for (const base of def.spriteVariants || [def.sprite]) {
        files.add(base);
        for (const state of Object.keys(def.states || {})) files.add(def.spriteStates?.[state] ?? `${base}_${state}`);
      }
    }
    // nur vorhandene Bilder laden (fehlende Zustandsbilder: dann gilt das Grundbild)
    if (SPRITE_FILES.includes('balkon')) files.add('balkon'); // Balkon-Rahmen (objects/RoomView.js)
    files.add('baumfenster').add('haustuer'); // gemalt in den Stamm (TreeScene)
    for (const f of files) if (SPRITE_FILES.includes(f)) this.load.image(`spr-${f}`, `assets/sprites/${f}.png`);
    loadFairyParts(this.load); // gemalte Feen-Teile (config/fairyLooks.js)
    for (const shape of ['rect', 'arch', 'dome', 'gable']) this.load.image(`frame-${shape}`, `assets/frames/${shape}.png`);
    // Baum: Kronenstücke und (nahtlose) Rinde
    for (let i = 1; i <= TREE_PARTS.krone; i++) this.load.image(`tree-krone-${i}`, `assets/tree/krone-${i}.png`);
    for (let i = 1; i <= TREE_PARTS.rinde; i++) this.load.image(`tree-rinde-${i}`, `assets/tree/rinde-${i}.png`);
    for (let i = 1; i <= (TREE_PARTS.rasen || 0); i++) this.load.image(`tree-rasen-${i}`, `assets/tree/rasen-${i}.png`);
  }

  // Ladebalken (ohne Schrift): füllt sich rosa, ein Stern wandert mit
  loadingBar() {
    const cx = this.scale.width / 2;
    const cy = GAME_H / 2 + 120;
    const w = 620;
    const h = 44;
    const g = this.add.graphics();
    const star = this.add.graphics();
    const draw = (v) => {
      g.clear();
      g.fillStyle(0xfff4fb, 0.25);
      g.fillRoundedRect(cx - w / 2 - 8, cy - h / 2 - 8, w + 16, h + 16, (h + 16) / 2);
      g.fillStyle(0xff9ec7, 1);
      if (v > 0) g.fillRoundedRect(cx - w / 2, cy - h / 2, Math.max(h, w * v), h, h / 2);
      star.clear().fillStyle(0xfff3a8, 1);
      star.fillPoints(starPoints(cx - w / 2 + Math.max(h, w * v) - h / 2, cy, 34, 15, 5), true);
    };
    draw(0);
    this.load.on('progress', draw);
    this.load.once('complete', () => draw(1));
  }

  // Textur eines Gegenstands (Motiv v, Zustand state) in Auflösung R:
  // R = FURN_RES für den Raum (auf dem Tablet kleiner, siehe config/quality.js), größer für die Karten-Vorschau
  furnTexture(g, def, key, v, state, R) {
    const W = def.w * CELL;
    const H = def.h * CELL;
    if (def.sprite) {
      const base = def.spriteVariants?.[v] ?? def.sprite;
      const file = state ? (def.spriteStates?.[state] ?? `${base}_${state}`) : base;
      this.spriteTexture(def, key, this.textures.exists(`spr-${file}`) ? file : base, R);
      return;
    }
    g.clear();
    if (R !== 1) g.scaleCanvas(R, R);
    g.translateCanvas(STICKER_PAD, STICKER_PAD);
    if (state) def.states[state](g, W, H, v);
    else def.draw(g, W, H, v);
    g.generateTexture(key, Math.ceil((W + STICKER_PAD * 2) * R), Math.ceil((H + STICKER_PAD * 2) * R));
  }

  // Möbel-Textur aus einem gemalten Bild: unten (bzw. oben) bündig ins Rasterfeld eingepasst
  spriteTexture(def, key, file, R = FURN_RES) {
    const W = def.w * CELL;
    const H = def.h * CELL;
    const P = STICKER_PAD;
    const img = this.textures.get(`spr-${file}`).getSourceImage();
    const s = Math.min(W / img.width, H / img.height);
    const dw = def.spriteSize?.w ?? img.width * s;
    const dh = def.spriteSize?.h ?? img.height * s;
    const tex = this.textures.createCanvas(key, Math.ceil((W + P * 2) * R), Math.ceil((H + P * 2) * R));
    const ctx = tex.getContext();
    ctx.imageSmoothingQuality = 'high';
    ctx.setTransform(R, 0, 0, R, 0, 0);
    ctx.drawImage(img, P + (W - dw) / 2, def.spriteAlign === 'top' ? P : P + H - dh, dw, dh);
    tex.refresh();
    if (!def.topMeasured) this.measureTop(def, img, (W - dw) / 2, def.spriteAlign === 'top' ? 0 : H - dh, dw, dh);
  }

  // Oberste Ablage („oben drauf“) genau auf die gemalte Oberkante setzen: das Bild füllt sein Rasterfeld nicht immer
  // ganz aus, sonst schweben Dinge darauf in der Luft. Gemessen wird die oberste deckende Zeile über der Ablage
  // (Median über ihre Breite). Ablagen weiter unten (Regalbretter, Sitzflächen) bleiben, wie sie eingetragen sind.
  measureTop(def, img, ox, oy, dw, dh) {
    def.topMeasured = true;
    const top = (def.surfaces || []).reduce((a, b) => (!a || b.y > a.y ? b : a), null);
    if (!top || top.y < def.h * 0.75) return;
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0);
    const { data } = x.getImageData(0, 0, img.width, img.height);
    const px0 = Math.max(0, Math.floor(((top.x0 * CELL - ox) * img.width) / dw));
    const px1 = Math.min(img.width, Math.ceil(((top.x1 * CELL - ox) * img.width) / dw));
    const tops = [];
    for (let px = px0; px < px1; px += 2) {
      for (let py = 0; py < img.height; py++) {
        if (data[(py * img.width + px) * 4 + 3] > 128) {
          tops.push(py);
          break;
        }
      }
    }
    if (!tops.length) return;
    tops.sort((a, b) => a - b);
    const ty = tops[Math.floor(tops.length / 2)];
    top.y = Math.round(((def.h * CELL - (oy + (ty * dh) / img.height)) / CELL) * 100) / 100;
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
      for (let v = 0; v < (def.variants || 1); v++) {
        for (const state of [null, ...Object.keys(def.states || {})]) {
          this.furnTexture(g, def, textureKey(def.id, v, state), v, state, FURN_RES);
        }
      }
      // Vorschau für die Karte in der Leiste: gleich in Kartengröße, damit sie scharf bleibt (auch auf dem Tablet)
      this.furnTexture(g, def, thumbKey(def.id), def.cardVariant ?? 0, def.cardState ?? null, cardScale(def)); // Pflanzen: ausgewachsen zeigen
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

    // die großen gemalten Vorlagen werden nicht mehr gebraucht (Möbel sind jetzt eigene, passende Texturen):
    // freigeben spart viel Grafikspeicher. Den Baum braucht noch der ferne Wald (BackScene).
    for (const key of this.textures.getTextureKeys()) {
      if (key.startsWith('spr-') && key !== 'spr-baum' && key !== 'spr-balkon') this.textures.remove(key);
    }

    this.scene.start('Menu');
  }
}
