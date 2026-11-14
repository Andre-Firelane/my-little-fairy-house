import Phaser from 'phaser';
import { GAME_W, UI_W, BAR_H, BAR_TOP, ROOM_W, uiLeft } from '../config/layout.js';
import { ROOMS } from '../config/rooms.js';
import { roomArtImage } from '../objects/Room.js';
import { barImage, cardImage } from '../ui/panels.js';
import { iconImage } from '../ui/icons.js';
import { popIn, squish } from '../systems/juice.js';

// Kartenbreite richtet sich nach der Zahl der Raumtypen; mindestens 150 – passen dann nicht mehr alle
// nebeneinander, lässt sich die Leiste seitwärts wischen (wie die Möbelleiste im Raum)
const CARD_W = Math.max(150, Math.min(300, Math.floor((UI_W - 40) / ROOMS.length) - 18));
const CARD_H = 250;
const DRAG_START = 20; // ab so vielen Pixeln wird aus dem Antippen ein Ziehen

// Feste Kartenleiste unten. Karte antippen = auswählen (dann Höhle antippen),
// Karte ziehen = Raum direkt in eine Höhle legen.
// Die Leiste ist UI_W breit und steht im Querformat mittig: die Kamera dieser Szene ist dafür verschoben,
// Szenen-Koordinaten = Bildschirm − uiLeft().
export default class UIScene extends Phaser.Scene {
  constructor() {
    super('UI');
  }

  create() {
    this.placement = this.registry.get('placement');
    this.tree = this.scene.get('Tree');
    this.press = null;
    this.ghost = null;
    this.hoverSlot = null;

    const bar = barImage(this, 'tree-bar', 20, BAR_TOP + 10, UI_W - 40, BAR_H - 30).setInteractive();
    bar.on('pointerdown', (p) => {
      if (!this.press) this.press = { bg: true, x0: p.x, y0: p.y, drag: false };
    });

    // Karten in einem Streifen (seitwärts wischbar, an den Rändern der Leiste abgeschnitten)
    this.strip = this.add.container(0, 0);
    this.stripMaskGfx = this.make.graphics({}, false);
    this.strip.setMask(this.stripMaskGfx.createGeometryMask());
    const spacing = CARD_W + 18 + Math.max(0, (UI_W - 40 - ROOMS.length * (CARD_W + 18)) / ROOMS.length);
    const fits = ROOMS.length * (CARD_W + 18) <= UI_W - 40;
    const x0 = fits ? UI_W / 2 - spacing * (ROOMS.length - 1) / 2 : 40 + CARD_W / 2;
    this.cards = ROOMS.map((def, i) => this.makeCard(def, x0 + i * spacing, BAR_TOP + BAR_H / 2 - 5));
    this.stripMin = Math.min(0, UI_W - 40 - CARD_W / 2 - (x0 + (ROOMS.length - 1) * spacing));

    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', (p) => this.onUp(p));
    this.input.on('pointerupoutside', (p) => this.onUp(p));
    this.placement.on('selection', (id) => this.cards.forEach((c) => this.setCardSelected(c, c.def.id === id)));

    const layout = () => {
      const left = uiLeft();
      this.cameras.main.setScroll(-left, 0);
      // Maske: im Hochformat bis zum Bildschirmrand, im Querformat bis zum Rand der Leiste
      const m = left > 0 ? 26 : -left - 10;
      this.stripMaskGfx.clear().fillStyle(0xffffff).fillRect(m, BAR_TOP - 60, UI_W - m * 2, BAR_H + 60);
    };
    layout();
    this.scale.on('resize', layout);
    this.events.once('shutdown', () => this.scale.off('resize', layout));
  }

  makeCard(def, x, y) {
    const c = this.add.container(x, y);
    const bg = cardImage(this, CARD_W, CARD_H, 30, def.accent);
    const preview = roomArtImage(this, def).setScale((0.62 * CARD_W) / 300).setY(-24);

    // statt des Namens: Zeichen der Zimmerart
    const icon = iconImage(this, def.id, 64).setY(84);

    c.add([bg, preview, icon]);
    c.setSize(CARD_W, CARD_H).setInteractive();
    c.def = def;
    c.baseY = y;
    c.on('pointerdown', (p) => {
      this.press = { card: c, x0: p.x, y0: p.y, drag: false };
    });
    this.strip.add(c);
    return c;
  }

  setCardSelected(card, on) {
    this.tweens.killTweensOf(card);
    if (on) {
      this.tweens.add({ targets: card, y: card.baseY - 26, scale: 1.06, duration: 220, ease: 'Back.Out' });
      this.tweens.add({ targets: card, angle: { from: -3, to: 3 }, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    } else {
      this.tweens.add({ targets: card, y: card.baseY, scale: 1, angle: 0, duration: 200, ease: 'Sine.Out' });
    }
  }

  // ---------- Drag ----------

  onMove(p) {
    const press = this.press;
    if (!press) return;
    const dx = p.x - press.x0;
    if (!press.drag && !press.scroll && Phaser.Math.Distance.Between(p.x, p.y, press.x0, press.y0) > DRAG_START) {
      // seitwärts = blättern (wenn nicht alle Karten passen), nach oben = Raum herausziehen
      if (press.bg || (this.stripMin < 0 && Math.abs(dx) > Math.abs(p.y - press.y0))) {
        press.scroll = true;
        press.sx0 = this.strip.x;
      } else {
        this.startDrag(p);
      }
    }
    if (press.scroll) this.strip.x = Phaser.Math.Clamp(press.sx0 + dx, this.stripMin, 0);
    else if (press.drag) this.moveGhost(p.x, p.y);
  }

  startDrag(p) {
    this.press.drag = true;
    this.placement.dragging = true;
    this.placement.clear();
    const g = roomArtImage(this, this.press.card.def);
    this.ghost = this.add.container(p.x - uiLeft(), p.y, [g]).setAlpha(0.92);
    this.ghostScale = this.ghostTarget(null);
    popIn(this, this.ghost, { from: this.ghostScale * 0.6, to: this.ghostScale, duration: 500 });
    squish(this, this.press.card);
  }

  // so groß, wie der Raum im Baum gerade erscheinen würde (über einer Höhle: genau deren Größe)
  ghostTarget(slot) {
    const zoom = this.tree.camView.zoom;
    return ((slot ? slot.w : 380) * zoom) / ROOM_W;
  }

  // Ghost sitzt etwas über dem Finger, damit man sieht, wohin er fällt (x, y = Bildschirm)
  moveGhost(x, y) {
    this.ghost.setPosition(x - uiLeft(), y - 60);
    const wp = this.tree.toWorld(x, y - 60);
    this.ghostWorld = wp;
    const slot = this.placement.freeSlotAt(wp.x, wp.y, this.press.card.def.id);
    if (slot !== this.hoverSlot) {
      this.hoverSlot?.setHover(false);
      slot?.setHover(true);
      this.hoverSlot = slot;
      this.ghostScale = this.ghostTarget(slot);
      this.tweens.add({ targets: this.ghost, scale: this.ghostScale, duration: 180, ease: 'Sine.Out' });
    }
  }

  onUp() {
    const press = this.press;
    if (!press) return;
    this.press = null;
    if (press.scroll || press.bg) return;
    if (!press.drag) {
      squish(this, press.card);
      this.placement.select(press.card.def.id, { x: press.card.x + this.strip.x + uiLeft(), y: press.card.baseY });
      return;
    }

    this.placement.dragging = false;
    const slot = this.hoverSlot;
    this.hoverSlot?.setHover(false);
    this.hoverSlot = null;
    const ghost = this.ghost;
    this.ghost = null;

    if (slot && !slot.room) {
      ghost.destroy();
      this.placement.place(press.card.def.id, slot, this.ghostWorld.x, this.ghostWorld.y);
    } else {
      // zurück in die Karte schrumpfen
      this.tweens.killTweensOf(ghost);
      this.tweens.add({
        targets: ghost,
        x: press.card.x + this.strip.x,
        y: press.card.baseY,
        scale: 0.2,
        alpha: 0,
        duration: 320,
        ease: 'Back.In',
        onComplete: () => ghost.destroy(),
      });
    }
  }

  update(time, delta) {
    // beim Ziehen am Bildschirmrand automatisch in diese Richtung wischen
    if (!this.press?.drag) return;
    const dt = Math.min(delta, 50) / 1000;
    const p = this.input.activePointer;
    const edge = (v, lo, hi, band) => (v < lo + band ? -(1 - (v - lo) / band) : v > hi - band && v < hi ? (v - (hi - band)) / band : 0);
    const sx = edge(p.x, 0, GAME_W, 140);
    const sy = edge(p.y, 0, BAR_TOP, 220);
    if (sx || sy) {
      const z = this.tree.camView.zoom;
      this.tree.panBy((sx * 800 * dt) / z, (sy * 800 * dt) / z);
      this.moveGhost(p.x, p.y);
    }
  }
}
