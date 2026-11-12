import Phaser from 'phaser';
import { GAME_W, GAME_H, UI_W, TRAY_TOP, SWATCH_Y, WALL_COLORS, uiLeft } from '../config/layout.js';
import { roomById, ROOMS } from '../config/rooms.js';
import { furnitureById, textureKey, CELL, STICKER_PAD } from '../config/furniture.js';
import { newUid } from '../state/house.js';
import { findSpot, findFreeSpot, childrenOf } from '../systems/roomGrid.js';
import { popIn, squish, wobble } from '../systems/juice.js';
import { clamp } from '../systems/motion.js';
import { barImage, cardImage, iconButton } from '../ui/panels.js';
import { iconImage } from '../ui/icons.js';
import { roomArtImage } from '../objects/Room.js';
import { bakedImage } from '../systems/bake.js';

const CARD_W = 180;
const CARD_H = 240;
const CARD_STEP = 200;
const DRAG_START = 14;
const HOLD_ABOVE = 50; // gezogenes Item schwebt etwas über dem Finger (Bildschirm-Pixel)
const FAIRY_GRAB = 57; // so nah (Raum-Koordinaten) muss der Finger an einer Fee sein

// Motiv eines neuen Gegenstands (Bilder, Teppiche …): zufällig
const pickVariant = (def) => (def.variants > 1 ? { v: Math.floor(Math.random() * def.variants) } : {});

// Einrichten eines Raums – Überlagerung über der Baum-Szene, die in den Raum hineingezoomt hat.
// Raum, Gegenstände und Feen gehören dem Baum (Room / RoomView / RoomLife); hier nur Bedienung:
// Gegenstände aus der Leiste in den Raum ziehen (oder antippen), sie rasten im Raster ein.
// Im Raum verschieben, zurück in die Leiste ziehen = wegräumen. Feen hochheben und auf etwas setzen.
// Bedienung ist UI_W breit und steht im Querformat mittig (Kamera verschoben: Szene = Bildschirm − uiLeft());
// nur Zurück/Löschen sitzen in den Bildschirmecken.
export default class RoomEditScene extends Phaser.Scene {
  constructor() {
    super('RoomEdit');
  }

  create({ slotId }) {
    this.tree = this.scene.get('Tree');
    const slot = this.tree.slots.find((s) => s.id === slotId);
    this.room = slot.room;
    this.life = this.room.life;
    this.view = this.room.view;
    this.typeDef = roomById(this.room.state.type);
    this.press = null;
    this.busy = false;

    this.ui = this.add.container(0, 0).setAlpha(0);
    this.makeTray();
    this.makeSwatches();
    this.makeHeader();
    this.tweens.add({ targets: this.ui, alpha: 1, duration: 350, delay: 200 });

    this.layout();
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));

    this.input.on('pointerdown', (p) => this.onDown(p));
    this.input.on('pointermove', (p) => this.onMove(p));
    this.input.on('pointerup', (p) => this.onUp(p));
    this.input.on('pointerupoutside', (p) => this.onUp(p));
  }

  layout() {
    const left = uiLeft();
    this.cameras.main.setScroll(-left, 0);
    this.backBtn.x = 100 - left;
    this.delBtn.x = GAME_W - 100 - left;
    // Maske: im Hochformat bis zum Bildschirmrand (wie bisher), im Querformat bis zum Rand der Leiste
    const m = left > 0 ? 26 : -left - 10;
    this.stripMaskGfx.clear().fillStyle(0xffffff).fillRect(m, TRAY_TOP, UI_W - m * 2, GAME_H - TRAY_TOP);
  }

  // liegt der Bildschirmpunkt auf der (mittigen) Gegenstands-Leiste?
  overTray(p) {
    return p.y > TRAY_TOP && Math.abs(p.x - GAME_W / 2) <= UI_W / 2;
  }

  get state() {
    return this.life.state;
  }

  // Bildschirmpunkt → Raum-Koordinaten (über die Kamera des Baums)
  local(x, y) {
    const w = this.tree.toWorld(x, y);
    return this.view.toLocal(w.x, w.y);
  }

  // ---------- Aufbau ----------

  // Kopfzeile ohne Schrift: Zurück-Pfeil, Zeichen der Zimmerart (rundes Schild), Mülleimer
  makeHeader() {
    const title = this.add.container(UI_W / 2, 140, [
      cardImage(this, 120, 120, 60, this.typeDef.accent),
      iconImage(this, this.typeDef.id, 80),
    ]);
    const back = iconButton(this, 100, 140, 150, 100, 'back', () => this.close());
    const del = iconButton(this, UI_W - 100, 140, 150, 100, 'trash', () => this.askDelete(), { stroke: 0xff9ec7 });
    this.ui.add([title, back, del]);
    Object.assign(this, { title, backBtn: back, delBtn: del });
  }

  // Sicherheitsabfrage, bevor ein Raum gelöscht wird
  askDelete() {
    if (this.blocked() || this.modal) return;
    this.press = null;
    const m = this.add.container(0, 0);
    // dunkler Schleier fängt alle Berührungen ab
    const veil = this.add.rectangle(-uiLeft(), 0, GAME_W, GAME_H, 0x2b2150, 0.6).setOrigin(0).setInteractive();
    const panel = cardImage(this, 820, 560, 44, 0xff9ec7).setPosition(UI_W / 2, 860);
    const art = roomArtImage(this, this.typeDef).setPosition(UI_W / 2, 790).setScale(1.25);
    const bin = iconImage(this, 'trash', 110).setPosition(UI_W / 2 + 180, 870);
    const no = iconButton(this, UI_W / 2 - 190, 1040, 300, 110, 'cross', () => this.closeModal());
    const yes = iconButton(this, UI_W / 2 + 190, 1040, 300, 110, 'trash', () => this.deleteRoom(), { fill: 0xffe0ea, stroke: 0xd94f74 });
    m.add([veil, panel, art, bin, no, yes]);
    m.setAlpha(0);
    this.tweens.add({ targets: m, alpha: 1, duration: 180 });
    popIn(this, panel, { from: 0.8, to: 1, duration: 500 });
    this.modal = m;
  }

  closeModal() {
    const m = this.modal;
    this.modal = null;
    this.tweens.add({ targets: m, alpha: 0, duration: 160, onComplete: () => m.destroy() });
  }

  deleteRoom() {
    if (this.busy) return;
    this.closeModal();
    this.busy = true;
    this.tree.deleteRoom(this.room);
    this.tweens.add({ targets: this.ui, alpha: 0, duration: 250, onComplete: () => this.scene.stop() });
  }

  // Wandfarben: Reihe runder Farbtupfer über der Gegenstands-Leiste
  makeSwatches() {
    const n = WALL_COLORS.length;
    const step = 112;
    this.ui.add(barImage(this, 'swatch-bar', UI_W / 2 - (n * step) / 2 - 10, SWATCH_Y - 52, n * step + 20, 104, 0.92));
    this.swatches = WALL_COLORS.map((color, i) => {
      const x = UI_W / 2 - ((n - 1) * step) / 2 + i * step;
      const sw = bakedImage(this, `swatch-${color}`, 96, 96, (g) => {
        g.fillStyle(0x5a3a7a, 0.18);
        g.fillCircle(0, 4, 38);
        g.fillStyle(color, 1);
        g.fillCircle(0, 0, 38);
        g.lineStyle(6, 0xffffff, 1);
        g.strokeCircle(0, 0, 38);
      }).setPosition(x, SWATCH_Y);
      sw.color = color;
      sw.setInteractive({ useHandCursor: true });
      sw.on('pointerup', () => this.pickWall(color));
      this.ui.add(sw);
      return sw;
    });
    this.swatchRing = bakedImage(this, 'swatch-ring', 110, 110, (g) => {
      g.lineStyle(7, 0x9b7bff, 1);
      g.strokeCircle(0, 0, 47);
    });
    this.ui.add(this.swatchRing);
    this.markSwatch();
  }

  markSwatch() {
    const current = this.view.wallColor();
    const sw = this.swatches.find((s) => s.color === current);
    this.swatchRing.setVisible(!!sw);
    if (sw) this.swatchRing.setPosition(sw.x, sw.y);
  }

  pickWall(color) {
    if (this.blocked() || this.modal || this.press) return;
    this.view.setWall(color);
    this.markSwatch();
    const sw = this.swatches.find((s) => s.color === color);
    squish(this, sw, { amount: 0.15 });
    const g = this.view.geo;
    for (let i = 0; i < 4; i++) this.life.sparkles.burst((i - 1.5) * g.innerW * 0.25, g.floorY - 300, 8);
  }

  // Leiste mit allen Gegenständen des Raumtyps, seitlich wischbar
  makeTray() {
    this.ui.add(barImage(this, 'edit-tray', 20, TRAY_TOP + 10, UI_W - 40, GAME_H - TRAY_TOP - 30, 0.96));
    // Gegenstände, die es nur in diesem Raumtyp gibt, stehen vorne; allgemeine (Pflanzen, Regal …) danach
    const shared = (id) => ROOMS.filter((r) => r.catalog?.includes(id)).length > 1;
    const ids = [...this.typeDef.catalog].sort((a, b) => shared(a) - shared(b));
    const y = TRAY_TOP + (GAME_H - TRAY_TOP) / 2 - 5;
    this.strip = this.add.container(0, 0);
    this.ui.add(this.strip);
    // im Querformat würden die Karten neben der Leiste weiterlaufen: dort abschneiden
    this.stripMaskGfx = this.make.graphics({}, false);
    this.strip.setMask(this.stripMaskGfx.createGeometryMask());
    this.cards = ids.map((id, i) => this.makeCard(furnitureById(id), 140 + i * CARD_STEP, y));
    this.stripMin = Math.min(0, UI_W - 60 - (140 + (ids.length - 1) * CARD_STEP + CARD_W / 2));
  }

  makeCard(def, x, y) {
    const c = this.add.container(x, y);
    const tw = def.w * CELL + STICKER_PAD * 2;
    const th = def.h * CELL + STICKER_PAD * 2;
    const s = Math.min(150 / tw, 190 / th, 1.5);
    const img = this.add.image(0, 0, textureKey(def.id, def.cardVariant ?? 0)).setScale(s);
    c.add([cardImage(this, CARD_W, CARD_H, 26, this.typeDef.accent), img]);
    c.setSize(CARD_W, CARD_H).setInteractive();
    c.def = def;
    c.on('pointerdown', (p) => {
      if (!this.blocked() && !this.press && !this.modal) this.press = { source: 'tray', def, card: c, x0: p.x, y0: p.y, drag: false };
    });
    this.strip.add(c);
    return c;
  }

  blocked() {
    return this.busy || this.tree.transitioning;
  }

  // ---------- Eingabe ----------

  onDown(p) {
    if (this.press || this.blocked() || this.modal) return;
    if (this.overTray(p)) {
      this.press = { source: 'traybg', x0: p.x, y0: p.y, drag: false };
      return;
    }
    if (p.y > SWATCH_Y - 60) return; // Farbleiste: Antippen machen die Farbtupfer selbst
    const l = this.local(p.x, p.y);
    // Feen liegen über den Möbeln, also zuerst prüfen
    const fairy = this.life.fairies.find((f) => Phaser.Math.Distance.Between(l.x, l.y, f.x, f.y) < FAIRY_GRAB);
    if (fairy) {
      this.press = { source: 'fairy', fairy, x0: p.x, y0: p.y, drag: false };
      return;
    }
    const s = this.view.hitTest(l.x, l.y);
    if (s) this.press = { source: 'room', def: s.def, sticker: s, item: s.item, x0: p.x, y0: p.y, drag: false };
  }

  onMove(p) {
    const press = this.press;
    if (!press) return;
    const dx = p.x - press.x0;
    const dy = p.y - press.y0;
    if (!press.drag && !press.scroll && Math.hypot(dx, dy) > DRAG_START) {
      // in der Leiste: seitwärts = blättern, nach oben = Gegenstand herausziehen
      const inTray = press.source === 'tray' || press.source === 'traybg';
      if (inTray && (press.source === 'traybg' || Math.abs(dx) > Math.abs(dy))) {
        press.scroll = true;
        press.sx0 = this.strip.x;
      } else if (press.source !== 'traybg') {
        this.startDrag();
      }
    }
    if (press.scroll) this.strip.x = clamp(press.sx0 + dx, this.stripMin, 0);
    else if (press.drag) this.dragTo(p);
  }

  startDrag() {
    const press = this.press;
    const T = this.tree;
    press.drag = true;

    if (press.source === 'fairy') {
      // Fee hochheben: sie hört auf mit dem, was sie gerade tut
      this.life.director.abort(press.fairy);
      this.life.director.bubbles.hide(press.fairy, true);
      press.fairy.state = 'held';
      press.fairy.path = null;
      return;
    }

    if (press.source === 'tray') {
      press.sticker = this.view.createSticker(press.def, { v: press.def.cardVariant ?? 0 }); // wie auf der Karte
      popIn(T, press.sticker, { from: 0.4, to: 1.08, duration: 450 });
      squish(this, press.card);
      press.ignore = new Set();
      press.children = [];
    } else {
      // Möbel nehmen ihre Sachen (Gläser auf dem Regal) mit
      const kids = childrenOf(this.state.items, press.item.uid);
      press.children = kids.map((k) => {
        const s = this.view.stickers.get(k.uid);
        return { item: k, sticker: s, dx: s.x - press.sticker.x, dy: s.y - press.sticker.y };
      });
      press.ignore = new Set([press.item.uid, ...kids.map((k) => k.uid)]);
      this.life.draggingUids = press.ignore;
      this.life.director.interruptFor(press.ignore);
      T.tweens.killTweensOf(press.sticker);
      T.tweens.add({ targets: press.sticker, scale: 1.08, duration: 150, ease: 'Back.Out' });
    }
    this.view.items.bringToTop(press.sticker);
    press.children.forEach((c) => this.view.items.bringToTop(c.sticker));
    this.view.showGrid(press.def, press.ignore);
  }

  dragTo(p) {
    const press = this.press;
    if (press.source === 'fairy') return this.dragFairy(press, p);
    const def = press.def;
    const s = press.sticker;
    // Item-Mitte schwebt über dem Finger; Sticker-Ursprung ist die Unterkante
    const l = this.local(p.x, p.y - HOLD_ABOVE);
    s.setPosition(l.x, l.y + s.H / 2);
    press.children.forEach((c) => c.sticker.setPosition(s.x + c.dx, s.y + c.dy));

    press.overTray = this.overTray(p);
    s.setAlpha(press.overTray ? 0.55 : 1);
    press.children.forEach((c) => c.sticker.setAlpha(s.alpha));

    const { cx, cy } = this.view.toCell(l.x, l.y);
    press.spot = press.overTray ? null : findSpot(this.view.geo, def, cx, cy, this.state.items, press.ignore);
    this.view.showMarker(press.spot, def);
  }

  // Fee hängt am Finger; Gegenstände, mit denen sie etwas machen kann, leuchten auf
  dragFairy(press, p) {
    const l = this.local(p.x, p.y);
    press.fairy.pos = { x: l.x, y: l.y - 20 };
    const s = this.view.hitTest(l.x, l.y);
    const d = this.life.director;
    press.target = s && !d.reserved.has(s.item.uid) && d.activityFor(s) ? s : null;
    this.view.showMarker(press.target?.item ?? null, press.target?.def);
  }

  releaseFairy(press) {
    const f = press.fairy;
    const d = this.life.director;
    if (!press.drag) {
      squish(this.tree, f, { amount: 0.15 });
      this.life.sparkles.twinkle(f.x, f.y - 20, 3);
      d.tap(f);
      return;
    }
    const t = press.target;
    if (t && d.start(f, d.activityFor(t), t)) this.life.sparkles.twinkle(f.x, f.y, 6);
    else f.wander();
  }

  onUp() {
    const press = this.press;
    if (!press) return;
    this.press = null;
    this.life.draggingUids = new Set();
    this.view.showGrid(null);
    this.view.showMarker(null);
    if (press.scroll || press.source === 'traybg') return;
    if (press.source === 'fairy') return this.releaseFairy(press);

    if (!press.drag) {
      if (press.source === 'tray') this.autoPlace(press.def, press.card);
      else this.tapItem(press.sticker);
      return;
    }

    if (press.overTray) return this.discard(press);
    if (!press.spot) return this.cancel(press);

    const spot = press.spot;
    let item = press.item;
    if (press.source === 'tray') {
      item = { uid: newUid(), id: press.def.id, ...spot, ...pickVariant(press.def) };
      this.state.items.push(item);
      press.sticker.item = item;
      press.sticker.setLook(item); // zufälliges Motiv beim Aufhängen
      this.view.stickers.set(item.uid, press.sticker);
    } else {
      const dgx = spot.gx - item.gx;
      const dgy = spot.gy - item.gy;
      Object.assign(item, spot);
      for (const c of press.children) {
        c.item.gx += dgx;
        c.item.gy += dgy;
      }
    }
    this.snap(press.sticker, item);
    press.children.forEach((c) => this.snap(c.sticker, c.item, false));
    this.view.sortItems();
  }

  // Gegenstand im Raum antippen: Lampen/Kerzen an und aus, Bilder & Co. wechseln das Motiv, sonst nur federn
  tapItem(s) {
    const item = s.item;
    const busy = this.life.director.reserved.has(item.uid); // eine Fee benutzt es gerade
    if (s.def.toggle && !busy) {
      item.state = item.state === 'on' ? null : 'on';
      s.setLook(item);
    } else if (s.def.variants > 1) {
      item.v = ((item.v || 0) + 1) % s.def.variants;
      s.setLook(item);
    }
    squish(this.tree, s, { amount: 0.12 });
    this.life.sparkles.twinkle(s.x, s.y - s.H / 2, 4);
  }

  // ---------- Aktionen (Tweens laufen in der Baum-Szene, der die Objekte gehören) ----------

  // ins Raster gleiten, federn, glitzern
  snap(sticker, item, celebrate = true) {
    const T = this.tree;
    const p = this.view.cellPos(item.gx, item.gy, sticker.def);
    T.tweens.killTweensOf(sticker);
    T.tweens.add({
      targets: sticker,
      x: p.x,
      y: p.y,
      duration: 140,
      ease: 'Cubic.Out',
      onComplete: () => {
        if (!celebrate) return;
        popIn(T, sticker, { from: 0.8, to: 1, duration: 800 });
        this.celebrate(sticker);
      },
    });
  }

  autoPlace(def, card) {
    const spot = findFreeSpot(this.view.geo, def, this.state.items);
    if (!spot) {
      wobble(this, card, { angle: 4 });
      return;
    }
    squish(this, card);
    const item = { uid: newUid(), id: def.id, ...spot, ...pickVariant(def) };
    this.state.items.push(item);
    const s = this.view.addSticker(item);
    this.view.sortItems();
    popIn(this.tree, s, { from: 0, to: 1, duration: 900 });
    this.celebrate(s);
  }

  celebrate(sticker) {
    this.life.sparkles.burst(sticker.x, sticker.y - sticker.H / 2, 18 + sticker.def.w * sticker.def.h * 2);
    // eine Fee schaut sich das Neue an
    const fairy = this.life.fairies.find((f) => f.state === 'wander');
    fairy?.visit({ x: sticker.x, y: sticker.y - sticker.H - 40 }, () => {}, { duration: 2.5, spread: 20 });
  }

  // zurück in die Leiste = wegräumen (mit allem, was darauf steht)
  discard(press) {
    const T = this.tree;
    const all = [press.sticker, ...press.children.map((c) => c.sticker)];
    if (press.item) {
      const gone = new Set([press.item.uid, ...press.children.map((c) => c.item.uid)]);
      this.state.items = this.state.items.filter((i) => !gone.has(i.uid));
      gone.forEach((uid) => this.view.removeSticker(uid));
    }
    for (const s of all) {
      this.life.sparkles.twinkle(s.x, s.y - s.H / 2, 6);
      T.tweens.killTweensOf(s);
      T.tweens.add({ targets: s, scale: 0, alpha: 0, duration: 260, ease: 'Back.In', onComplete: () => s.destroy() });
    }
  }

  // kein Platz frei: zurück an die alte Stelle (bzw. aus der Leiste: verschwinden)
  cancel(press) {
    const T = this.tree;
    if (press.source === 'tray') {
      const s = press.sticker;
      T.tweens.add({ targets: s, scale: 0, alpha: 0, duration: 260, ease: 'Back.In', onComplete: () => s.destroy() });
      return;
    }
    press.sticker.setAlpha(1);
    this.snap(press.sticker, press.item, false);
    T.tweens.add({ targets: press.sticker, scale: 1, duration: 150 });
    press.children.forEach((c) => {
      c.sticker.setAlpha(1);
      this.snap(c.sticker, c.item, false);
    });
    this.view.sortItems();
  }

  // zurück in den Baum – die Feen machen einfach weiter
  close() {
    if (this.blocked()) return;
    this.busy = true;
    this.tree.closeRoom();
    this.tweens.add({ targets: this.ui, alpha: 0, duration: 250, onComplete: () => this.scene.stop() });
  }
}
