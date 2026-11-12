import Phaser from 'phaser';
import { COLORS, DEPTH, TREE_SCALE } from '../config/layout.js';
import { bakedImage } from '../systems/bake.js';
import { roomGeometry } from '../systems/roomGeometry.js';
import { frameTexture } from '../systems/frames.js';
import { ROOM_RES } from '../config/quality.js';

const RES = 1.5; // gebacken für die stärkste Vergrößerung im Baum

// Leere Höhle im Stamm, mit eigener Größe und Form (def.cols/rows/shape → systems/roomGeometry.js),
// umrahmt vom gemalten Zimmerrahmen. Leuchtet, wenn ein Raum ausgewählt ist (Pulse) oder darüber gezogen wird (Hover).
export default class Slot extends Phaser.GameObjects.Container {
  constructor(scene, def) {
    super(scene, def.x, def.y);
    this.id = def.id;
    this.geo = roomGeometry(def);
    this.room = null;
    this.hovered = false;
    this.pulseTween = null;
    const geo = this.geo;
    const S = TREE_SCALE;
    this.w = geo.W * S; // Größe in der Welt
    this.h = geo.H * S;

    const frameKey = frameTexture(scene, geo, ROOM_RES);
    // Leuchtrand: der Rahmen in Leuchtfarbe, etwas größer, hinter allem
    this.glow = scene.add.image(0, 0, frameKey).setScale((S / ROOM_RES) * 1.06).setTintFill(COLORS.glow).setAlpha(0);
    const hole = bakedImage(scene, `slot-hole-${geo.key}`, this.w + 10, this.h + 10, (g) => {
      g.fillStyle(COLORS.hole, 1);
      g.fillPoints(geo.outline.map((p) => ({ x: p.x * S, y: p.y * S })), true);
      g.fillStyle(COLORS.holeShadow, 1);
      g.fillEllipse(((geo.innerLeft + geo.innerRight) / 2) * S, (geo.floorY + 20) * S, geo.innerW * S * 0.8, 50 * S);
    }, { res: RES });
    const frame = scene.add.image(0, 0, frameKey).setScale(S / ROOM_RES);

    this.add([this.glow, hole, frame]);
    this.setSize(this.w, this.h).setInteractive().setDepth(DEPTH.slot);
    scene.add.existing(this);
  }

  // großzügige Trefferfläche, damit kleine Finger leicht treffen
  contains(wx, wy, pad = 40) {
    return Math.abs(wx - this.x) < this.w / 2 + pad && Math.abs(wy - this.y) < this.h / 2 + pad;
  }

  setPulse(on) {
    this.pulseTween?.stop();
    this.pulseTween = null;
    if (on && !this.room) {
      this.glow.setAlpha(0.3);
      this.pulseTween = this.scene.tweens.add({
        targets: this.glow,
        alpha: 0.95,
        duration: 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    } else if (!this.hovered) {
      this.glow.setAlpha(0);
    }
  }

  setHover(on) {
    if (on === this.hovered) return;
    this.hovered = on;
    this.scene.tweens.add({ targets: this, scale: on ? 1.05 : 1, duration: 160, ease: 'Back.Out' });
    if (on) this.glow.setAlpha(1);
    else if (!this.pulseTween) this.glow.setAlpha(0);
  }
}
