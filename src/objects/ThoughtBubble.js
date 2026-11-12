import Phaser from 'phaser';
import { DEPTH } from '../config/layout.js';
import { popIn } from '../systems/juice.js';
import { bakedImage } from '../systems/bake.js';

// Gedankenblase über einer Fee, zeigt den Gegenstand, den sie sich gerade wünscht.
// parent: Container, in dem die Feen wohnen (Blasen in Raum-Koordinaten); enabled = Detailstufe
export default class ThoughtBubbles {
  constructor(scene, parent = null) {
    this.scene = scene;
    this.parent = parent;
    this.enabled = true;
    this.bubbles = new Map(); // fairy → { box, until }
  }

  show(fairy, textureKey, seconds = 1.5) {
    this.hide(fairy, true);
    if (!this.enabled) return;
    const s = this.scene;
    const box = s.add.container(0, 0).setDepth(DEPTH.fx + 1);
    this.parent?.add(box);
    const g = bakedImage(s, 'bubble', 140, 150, (b) => {
      b.fillStyle(0x5a3a7a, 0.15);
      b.fillCircle(3, 5, 54);
      b.fillStyle(0xffffff, 1);
      b.fillCircle(0, 0, 54);
      b.fillCircle(-44, 52, 11);
      b.fillCircle(-60, 72, 6);
      b.lineStyle(4, 0xe2b6ff, 1);
      b.strokeCircle(0, 0, 54);
    }, { ox: 72, oy: 62 });
    const img = s.add.image(0, 0, textureKey);
    img.setScale(Math.min(74 / img.width, 74 / img.height));
    box.add([g, img]);
    popIn(s, box, { from: 0, to: 1, duration: 500 });
    this.bubbles.set(fairy, { box, until: s.time.now + seconds * 1000 });
    this.follow(fairy, box);
  }

  hide(fairy, instant = false) {
    const b = this.bubbles.get(fairy);
    if (!b) return;
    this.bubbles.delete(fairy);
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
