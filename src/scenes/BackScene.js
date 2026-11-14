import Phaser from 'phaser';
import { GAME_W, GAME_H, WORLD_W, WORLD_H, UI_W } from '../config/layout.js';
import { bakedImage } from '../systems/bake.js';
import { makeRng, lerpColor } from '../systems/motion.js';
import { BG_RES } from '../config/quality.js';

// Hintergrund unter dem Baum: Himmel und ferner Wald. Eigene Szene ohne Zoom, damit der Himmel immer
// den Bildschirm füllt; der Wald verschiebt sich sanft mit der Baum-Kamera (Parallax) und wächst beim Hineinzoomen.
export default class BackScene extends Phaser.Scene {
  constructor() {
    super('Back');
  }

  create() {
    this.tree = this.scene.get('Tree');
    // Himmel: senkrechter Verlauf, wird auf die volle Breite gestreckt (Querformat)
    this.sky = bakedImage(this, 'sky', UI_W, GAME_H, (g) => {
      g.fillGradientStyle(0x5d4bb8, 0x5d4bb8, 0xffc2dc, 0xffc2dc, 1);
      g.fillRect(0, 0, UI_W, GAME_H);
    }, { ox: 0, oy: 0, res: BG_RES });

    // funkelnde Sterne
    const rng = makeRng(7);
    this.stars = [];
    for (let i = 0; i < 26; i++) {
      const s = this.add.image(0, 40 + rng() * 800, 'star').setScale(0.4 + rng() * 0.5).setAlpha(0.3);
      s.baseY = s.y;
      s.rx = rng(); // Anteil der Bildschirmbreite
      this.stars.push(s);
      this.tweens.add({ targets: s, alpha: 0.95, duration: 900 + rng() * 1400, delay: rng() * 2000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }

    // ferner Wald (Silhouetten, darunter Boden bis weit nach unten)
    this.forest = this.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 0);
    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
  }

  // an die Breite der Spielfläche anpassen (Hoch-/Querformat)
  layout() {
    this.sky.setDisplaySize(GAME_W, GAME_H);
    for (const s of this.stars) s.x = s.rx * GAME_W;
    // Wald so breit, dass er ganz herausgezoomt (kleinster Maßstab ~0.9) den Bildschirm füllt
    const FW = GAME_W > UI_W ? 4800 : 2000;
    this.forestW = FW;
    this.forest.setTexture(this.paintForest(FW, 2400, BG_RES * 0.7));
  }

  // ferner Wald: der gemalte Baum mehrfach, in Dämmerfarben eingefärbt (hinten heller, vorne dunkler)
  paintForest(FW, FH, res) {
    const key = `backforest-painted-${FW}`;
    if (this.textures.exists(key)) return key;
    const img = this.textures.get('spr-baum').getSourceImage();
    const tex = this.textures.createCanvas(key, Math.ceil(FW * res), Math.ceil(FH * res));
    const ctx = tex.getContext();
    ctx.scale(res, res);
    // einfärben: Baum in eine Hilfsfläche zeichnen und mit der Dämmerfarbe übermalen (Struktur bleibt leicht sichtbar)
    const tint = (color, alpha) => {
      const c = document.createElement('canvas');
      c.width = img.width;
      c.height = img.height;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      x.globalCompositeOperation = 'source-atop';
      x.fillStyle = color;
      x.globalAlpha = alpha;
      x.fillRect(0, 0, c.width, c.height);
      return c;
    };
    const r = makeRng(3);
    const rows = [
      { img: tint('#9d8fe0', 0.82), h: 520, top: 120, step: 150 },
      { img: tint('#7f70cf', 0.86), h: 680, top: 260, step: 190 },
    ];
    for (const row of rows) {
      const w = (row.h * img.width) / img.height;
      for (let x = -60; x < FW + 60; x += row.step + r() * 60) {
        const h = row.h * (0.85 + r() * 0.3);
        ctx.drawImage(row.img, x - w / 2, row.top + r() * 120, (h * img.width) / img.height, h);
      }
    }
    ctx.fillStyle = '#5b4fae';
    ctx.fillRect(0, 900, FW, FH - 900);
    ctx.beginPath();
    ctx.ellipse(FW / 2, 900, FW * 0.7, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    tex.refresh();
    return key;
  }

  update() {
    const v = this.tree.camView;
    if (!v) return;
    // Nacht: Himmel und Wald dunkler
    // Abend (Lichterfest): wärmer, Himmel ins Abendrot
    const dark = this.tree.clock?.darkness ?? 0;
    const warm = this.tree.clock?.warm ?? 0;
    if (dark !== this.dark || warm !== this.warm) {
      this.dark = dark;
      this.warm = warm;
      this.sky.setTint(lerpColor(lerpColor(0xffffff, 0x4c4c8c, dark), 0xffa98e, warm * 0.75));
      this.forest.setTint(lerpColor(lerpColor(0xffffff, 0x5c5c96, dark), 0xb06a8a, warm * 0.6));
    }
    // 0 = Baumkrone oben, 1 = Wurzeln unten
    const depth = v.y / WORLD_H;
    const s = 0.75 + v.zoom * 0.35;
    this.forest.setScale(s / (BG_RES * 0.7));
    this.forest.x = GAME_W / 2 - (v.x - WORLD_W / 2) * 0.12 * v.zoom;
    this.forest.y = 900 - depth * 700 * s;
    for (const st of this.stars) st.y = st.baseY - depth * 500;
  }
}
