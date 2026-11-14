import { DEPTH } from '../config/layout.js';
import { popIn } from '../systems/juice.js';
import { bakedImage } from '../systems/bake.js';

// Bedürfnis-Blase über einer Fee (rosa, pulsierend): zeigt, was sie sich gerade wünscht (Bild der Tätigkeit).
// Sie bleibt, bis man den Wunsch erfüllt oder er nach einer Weile verblasst (siehe ActivityDirector).
// parent: Container, in dem die Feen wohnen (Blasen in Raum-Koordinaten); enabled = Detailstufe
export default class ThoughtBubbles {
  constructor(scene, parent = null) {
    this.scene = scene;
    this.parent = parent;
    this.enabled = true;
    this.bubbles = new Map(); // fairy → { box, until }
  }

  has(fairy) {
    return this.bubbles.has(fairy);
  }

  show(fairy, textureKey, seconds = 1.5) {
    this.hide(fairy, true);
    if (!this.enabled) return;
    const s = this.scene;
    const box = s.add.container(0, 0).setDepth(DEPTH.fx + 1);
    this.parent?.add(box);
    const inner = s.add.container(0, 0, [needBubble(s), needIcon(s, textureKey, 74)]);
    box.add(inner);
    popIn(s, box, { from: 0, to: 1, duration: 500 });
    // sanftes Pulsieren, damit man den Wunsch bemerkt
    s.tweens.add({ targets: inner, scale: { from: 1, to: 1.1 }, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.bubbles.set(fairy, { box, inner, until: s.time.now + seconds * 1000 });
    this.follow(fairy, box);
  }

  // kurz wackeln (Fee mit Wunsch wurde angetippt)
  nudge(fairy) {
    const b = this.bubbles.get(fairy);
    if (!b) return;
    this.scene.tweens.add({ targets: b.box, angle: { from: -12, to: 12 }, duration: 80, yoyo: true, repeat: 2, onComplete: () => b.box.setAngle(0) });
  }

  hide(fairy, instant = false) {
    const b = this.bubbles.get(fairy);
    if (!b) return;
    this.bubbles.delete(fairy);
    this.scene.tweens.killTweensOf(b.inner);
    if (instant) return b.box.destroy();
    this.scene.tweens.add({ targets: b.box, scale: 0, alpha: 0, duration: 220, ease: 'Back.In', onComplete: () => b.box.destroy() });
  }

  hideAll() {
    for (const f of [...this.bubbles.keys()]) this.hide(f, true);
  }

  follow(fairy, box) {
    box.setPosition(fairy.x + 60, fairy.y - 110);
  }

  update() {
    const now = this.scene.time.now;
    for (const [fairy, b] of this.bubbles) {
      this.follow(fairy, b.box);
      if (now > b.until) this.hide(fairy);
    }
  }
}

// Blase eines Wunsches: weiß mit dickem rosa Rand und kleinem Herz (auch für die Baumansicht, siehe HudScene)
export function needBubble(scene) {
  return bakedImage(scene, 'bubble-need', 150, 160, (b) => {
    b.fillStyle(0x5a3a7a, 0.18);
    b.fillCircle(3, 6, 56);
    b.fillStyle(0xffffff, 1);
    b.fillCircle(0, 0, 56);
    b.fillCircle(-46, 54, 12);
    b.fillCircle(-62, 74, 7);
    b.lineStyle(7, 0xff7ab8, 1);
    b.strokeCircle(0, 0, 56);
    // Herz oben rechts
    b.fillStyle(0xff5fa8, 1);
    b.fillCircle(38, -46, 9);
    b.fillCircle(52, -46, 9);
    b.fillTriangle(30, -42, 60, -42, 45, -24);
  }, { ox: 75, oy: 66 });
}

export function needIcon(scene, textureKey, size) {
  const img = scene.add.image(0, 0, textureKey);
  return img.setScale(Math.min(size / img.width, size / img.height));
}
