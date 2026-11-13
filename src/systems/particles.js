import { COLORS, DEPTH } from '../config/layout.js';

// Wiederverwendbares Glitzer-System. Texturen 'sparkle' und 'star' erzeugt die BootScene.
// parent: Container, in dem die Effekte leben (z. B. ein Raum – dann in Raum-Koordinaten und mitskaliert).
// Detailstufe: setDetail(false) schaltet alle Effekte ab (Baum-Übersicht, dort sieht man sie ohnehin nicht).
// { mist: true }: weiche, hellblaue Nebelwölkchen statt Glitzer (Geister) – gleiche Aufrufe, anderes Aussehen.
const MIST = [0xe6eeff, 0xd8e4ff, 0xf2f0ff];

export default class Sparkles {
  constructor(scene, parent = null, { mist = false } = {}) {
    this.scene = scene;
    this.parent = parent;
    this.detail = true;
    this.trails = [];
    this.mist = mist;
    if (mist) return this.makeMist();

    this.glitter = this.emitter('sparkle', {
      speed: { min: 120, max: 420 },
      lifespan: { min: 600, max: 1200 },
      scale: { start: 1, end: 0 },
      gravityY: -80,
      tint: COLORS.glitter,
    });
    this.stars = this.emitter('star', {
      speed: { min: 60, max: 260 },
      lifespan: { min: 900, max: 1500 },
      scale: { start: 1.3, end: 0.2 },
      rotate: { start: 0, end: 200 },
      gravityY: -40,
      tint: [0xfff3a8, 0xffffff, 0xffc8f0],
    });
    this.twinkles = this.emitter('star', {
      speed: { min: 5, max: 40 },
      lifespan: { min: 600, max: 1000 },
      scale: { start: 0.7, end: 0 },
      gravityY: -30,
      tint: COLORS.glitter,
    });
  }

  // Nebel: langsam aufsteigende, blasse Wölkchen (nicht additiv, damit sie auf heller Wand sichtbar bleiben)
  makeMist() {
    const soft = { blendMode: 'NORMAL', tint: MIST, gravityY: -30 };
    this.glitter = this.emitter('sparkle', {
      ...soft,
      speed: { min: 30, max: 120 },
      lifespan: { min: 900, max: 1500 },
      scale: { start: 1.4, end: 2.4 },
      alpha: { start: 0.55, end: 0 },
    });
    this.stars = this.emitter('sparkle', {
      ...soft,
      speed: { min: 10, max: 60 },
      lifespan: { min: 1000, max: 1600 },
      scale: { start: 1, end: 2 },
      alpha: { start: 0.45, end: 0 },
    });
    this.twinkles = this.emitter('sparkle', {
      ...soft,
      speed: { min: 5, max: 30 },
      lifespan: { min: 800, max: 1300 },
      scale: { start: 0.9, end: 1.8 },
      alpha: { start: 0.5, end: 0 },
    });
  }

  emitter(texture, config, depth = DEPTH.fx) {
    const e = this.scene.add
      .particles(0, 0, texture, {
        emitting: false,
        angle: { min: 0, max: 360 },
        alpha: { start: 1, end: 0 },
        blendMode: 'ADD',
        ...config,
      })
      .setDepth(depth);
    this.parent?.add(e);
    return e;
  }

  setDetail(on) {
    this.detail = on;
    for (const t of this.trails) {
      if (on) t.start();
      else t.stop();
    }
  }

  // farbige Blasen (Kessel): nicht additiv, damit sie auf heller Wand sichtbar bleiben
  bubbles(x, y, color, count = 2) {
    if (!this.detail) return;
    this.bubbleEmitter ??= this.emitter('sparkle', {
      speed: { min: 20, max: 60 },
      angle: { min: 250, max: 290 },
      lifespan: { min: 700, max: 1100 },
      scale: { start: 1.1, end: 0.4 },
      alpha: { start: 0.95, end: 0 },
      gravityY: -90,
      blendMode: 'NORMAL',
    });
    this.bubbleEmitter.setParticleTint(color);
    this.bubbleEmitter.explode(count, x, y);
  }

  // schlafende Fee: ein "Z" steigt auf und verblasst
  zzz(x, y) {
    if (!this.detail) return;
    this.zEmitter ??= this.emitter('zletter', {
      speed: { min: 28, max: 46 },
      angle: { min: 250, max: 285 },
      lifespan: 2000,
      scale: { start: 0.45, end: 1.1 },
      alpha: { start: 1, end: 0 },
      rotate: { min: -15, max: 15 },
      blendMode: 'NORMAL',
    });
    this.zEmitter.explode(1, x, y);
  }

  // Musik: bunte Noten steigen schaukelnd auf
  notes(x, y, color, count = 1) {
    if (!this.detail) return;
    this.noteEmitter ??= this.emitter('note', {
      speed: { min: 40, max: 75 },
      angle: { min: 245, max: 295 },
      lifespan: { min: 1400, max: 1900 },
      scale: { start: 0.9, end: 1.25 },
      alpha: { start: 1, end: 0 },
      rotate: { min: -20, max: 20 },
      gravityY: -15,
      blendMode: 'NORMAL',
    });
    this.noteEmitter.setParticleTint(color);
    this.noteEmitter.explode(count, x, y);
  }

  // großer Ausstoß (z. B. beim Einrasten eines Raums)
  burst(x, y, count = 30) {
    if (!this.detail) return;
    this.glitter.explode(count, x, y);
    this.stars.explode(Math.ceil(count / 3), x, y);
  }

  // ein paar kleine Funkel-Sterne
  twinkle(x, y, count = 2) {
    if (!this.detail) return;
    this.twinkles.explode(count, x, y);
  }

  // Glitzerspur, die einem Objekt folgt. Rückgabe: Emitter (setFrequency/stop/start)
  trail(target) {
    const look = this.mist
      ? { blendMode: 'NORMAL', speed: { min: 2, max: 14 }, lifespan: { min: 700, max: 1100 }, scale: { start: 0.9, end: 1.6 }, alpha: { start: 0.4, end: 0 }, gravityY: -20, tint: MIST }
      : {};
    const t = this.emitter(
      'sparkle',
      {
        emitting: this.detail,
        frequency: 100,
        quantity: 1,
        speed: { min: 5, max: 30 },
        lifespan: { min: 500, max: 900 },
        scale: { start: 0.55, end: 0 },
        alpha: { start: 0.9, end: 0 },
        gravityY: 25,
        tint: COLORS.glitter,
        ...look,
      },
      DEPTH.trail,
    ).startFollow(target);
    this.trails.push(t);
    return t;
  }
}
