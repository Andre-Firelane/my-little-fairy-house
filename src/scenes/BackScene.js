import Phaser from 'phaser';
import { GAME_W, GAME_H, WORLD_W, WORLD_H, UI_W } from '../config/layout.js';
import { GROUND_Y, OY } from '../config/treeShape.js';
import { paintForestLayer } from '../systems/flora.js';
import { bakedImage } from '../systems/bake.js';
import { makeRng, lerpColor } from '../systems/motion.js';
import { BG_RES } from '../config/quality.js';

const MEADOW_Y = GROUND_Y - 10 + OY; // Oberkante der Wiese am Baum (Welt)

// Hintergrund unter dem Baum: Himmel und ferner Wald in drei Ebenen (systems/flora.js). Eigene Szene ohne Zoom, damit der Himmel immer
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

    // ferner Wald in drei Ebenen (hinten hell im Dunst, vorne dunkler und kräftiger), jede mit eigener Parallaxe
    this.layers = FOREST_LAYERS.map((cfg) => ({ cfg, img: this.add.image(0, 0, '__DEFAULT').setOrigin(0.5, 0) }));

    // Glühwürmchen schweben vor dem Wald
    if (!this.textures.exists('firefly')) {
      const t = this.textures.createCanvas('firefly', 48, 48);
      const c = t.getContext();
      const g = c.createRadialGradient(24, 24, 1, 24, 24, 24);
      g.addColorStop(0, 'rgba(255, 252, 220, 1)');
      g.addColorStop(0.25, 'rgba(255, 236, 140, 0.8)');
      g.addColorStop(1, 'rgba(255, 220, 120, 0)');
      c.fillStyle = g;
      c.fillRect(0, 0, 48, 48);
      t.refresh();
    }
    const fr = makeRng(19);
    this.flies = [];
    for (let i = 0; i < 22; i++) {
      const f = this.add.image(0, 0, 'firefly').setBlendMode(Phaser.BlendModes.ADD).setScale(0.35 + fr() * 0.45);
      Object.assign(f, { rx: fr(), ry: fr(), ph: fr() * 10, sp: 0.25 + fr() * 0.4, tw: 1.5 + fr() * 2 });
      this.flies.push(f);
    }

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
    for (const L of this.layers) L.img.setTexture(this.paintForest(FW, L.cfg));
  }

  // eine Waldebene einmal in eine Textur malen
  paintForest(FW, cfg) {
    const key = `backforest-${cfg.name}-${FW}`;
    if (this.textures.exists(key)) return key;
    const res = BG_RES * 0.7;
    const tex = this.textures.createCanvas(key, Math.ceil(FW * res), Math.ceil((cfg.horizon + cfg.below) * res));
    const ctx = tex.getContext();
    ctx.scale(res, res);
    const baum = this.textures.exists('spr-baum') && tint(this.textures.get('spr-baum').getSourceImage(), cfg.haze, cfg.amt + 0.15);
    paintForestLayer(ctx, FW, cfg, { baum });
    tex.refresh();
    return key;
  }

  update() {
    const v = this.tree.camView;
    if (!v) return;
    // Nacht: Himmel und Wald dunkler
    // Abend (Lichterfest): wärmer, Himmel ins Abendrot; Schnee: kühler
    const dark = this.tree.clock?.darkness ?? 0;
    const warm = this.tree.clock?.warm ?? 0;
    const chill = this.tree.clock?.chill ?? 0; // Schneehimmel (Erster Schnee)
    if (dark !== this.dark || warm !== this.warm || chill !== this.chill) {
      this.dark = dark;
      this.warm = warm;
      this.chill = chill;
      this.sky.setTint(lerpColor(lerpColor(lerpColor(0xffffff, 0xc4d2e4, chill), 0x4c4c8c, dark), 0xffa98e, warm * 0.75));
      const t = lerpColor(lerpColor(lerpColor(0xffffff, 0xd4e0ee, chill), 0x5c5c96, dark), 0xb06a8a, warm * 0.6);
      for (const L of this.layers) L.img.setTint(t);
    }
    // 0 = Baumkrone oben, 1 = Wurzeln unten
    const depth = v.y / WORLD_H;
    const s = 0.75 + v.zoom * 0.35;
    // Oberkante der Wiese am Baum auf dem Bildschirm: die vorderen Ebenen hängen daran, die hinteren kaum
    const meadowY = (MEADOW_Y - v.y) * v.zoom + GAME_H / 2;
    const res = BG_RES * 0.7;
    for (const { cfg, img } of this.layers) {
      img.setScale(s / res);
      img.x = GAME_W / 2 - (v.x - WORLD_W / 2) * cfg.par * v.zoom;
      img.y = meadowY * cfg.k + cfg.rest * (1 - cfg.k) - cfg.horizon * s;
    }
    for (const st of this.stars) st.y = st.baseY - depth * 500;
    // Glühwürmchen: schweben langsam, glimmen auf (nachts heller)
    const time = this.time.now / 1000;
    for (const f of this.flies) {
      f.x = f.rx * GAME_W + Math.sin(time * f.sp + f.ph) * 60;
      f.y = 700 + f.ry * 900 + Math.sin(time * f.sp * 1.3 + f.ph * 2) * 40 - depth * 200;
      f.setAlpha((0.35 + dark * 0.5) * (0.5 + 0.5 * Math.sin(time * f.tw + f.ph)) + 0.1);
    }
  }
}

// gemalten Baum in Dunstfarbe tauchen (Struktur bleibt leicht sichtbar)
function tint(img, color, alpha) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = color;
  x.globalAlpha = Math.min(1, alpha);
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

// Waldebenen von hinten nach vorne.
// horizon/below: Lage des Waldbodens in der Textur; hMin/hMax: Baumhöhen; step: Abstand;
// par: seitliche Parallaxe; k: wie stark die Ebene an der Wiese hängt (rest = Bildschirmhöhe sonst)
const FOREST_LAYERS = [
  {
    name: 'far', seed: 3, horizon: 520, below: 760, hMin: 260, hMax: 430, step: 95,
    kinds: [['fir', 40], ['oak', 30], ['poplar', 20], ['painted', 10]],
    haze: '#b9adef', amt: 0.74, ground: '#6f9a6a', mist: 0.55, mistColor: '#d9cdf7',
    par: 0.05, k: 0.2, rest: 900,
  },
  {
    name: 'mid', seed: 5, horizon: 760, below: 620, hMin: 420, hMax: 680, step: 150,
    kinds: [['oak', 28], ['fir', 26], ['birch', 12], ['poplar', 12], ['willow', 10], ['painted', 12]],
    haze: '#8f86d6', amt: 0.52, ground: '#4f8a55', mist: 0.4, mistColor: '#c4b6f0',
    par: 0.1, k: 0.42, rest: 1000,
  },
  {
    name: 'near', seed: 9, horizon: 1080, below: 900, hMin: 640, hMax: 1000, step: 210, lw: 3,
    kinds: [['oak', 30], ['fir', 26], ['birch', 14], ['willow', 12], ['poplar', 18]],
    haze: '#55609e', amt: 0.34, ground: '#3f7a4a', mist: 0.22, mistColor: '#b9acef',
    par: 0.18, k: 0.86, rest: 1100,
  },
];
