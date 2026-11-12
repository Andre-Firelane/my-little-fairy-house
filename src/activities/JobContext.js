import { findSpot, findFreeSpot, isSpotFree } from '../systems/roomGrid.js';
import { popIn, squish } from '../systems/juice.js';
import { furnitureById } from '../config/furniture.js';

// Abbruch durch Regie (Kind greift ein, Raum wird verlassen) – wird still verschluckt
export const ABORT = Symbol('abort');
// Tätigkeit geht nicht weiter (z. B. Gegenstand weg) – Regie räumt auf
export class Cancel extends Error {}

const ONE_CELL = { w: 1, h: 1, kind: 'small' };

// Werkzeugkasten für eine laufende Tätigkeit einer Fee.
// Tätigkeiten sind async-Skripte: await c.fly(...), await c.wait(...), c.pickUp(...), c.putDown(...)
// Alles in Raum-Koordinaten: Feen, Sticker und Glitzer leben im selben Raum-Container.
export default class JobContext {
  constructor(director, fairy, token) {
    this.director = director;
    this.life = director.life;
    this.scene = director.scene; // für Zeit, Tweens und neue Bilder
    this.view = director.life.view;
    this.geo = director.life.view?.geo; // Maße und Form des Raums
    this.sparkles = director.life.sparkles;
    this.f = fairy;
    this.token = token;
    this.held = []; // reservierte Item-uids
    this.temp = []; // Hilfsobjekte (Zutat, Buchseite) – beim Abbruch weg
    this.onAbortFns = [];
    this.carried = null; // Sticker, den die Fee gerade trägt
  }

  get items() {
    return this.life.state.items;
  }

  check() {
    if (this.token.aborted) throw ABORT;
  }

  ensure(ok) {
    this.check();
    if (!ok) throw new Cancel();
  }

  async wait(seconds) {
    await new Promise((r) => this.scene.time.delayedCall(seconds * 1000, r));
    this.check();
  }

  async fly(x, y, speed = 240) {
    await this.f.goTo({ x, y }, speed);
    this.check();
  }

  reserve(uid) {
    this.director.reserved.add(uid);
    this.held.push(uid);
  }

  release() {
    for (const uid of this.held) this.director.reserved.delete(uid);
    this.held = [];
  }

  onAbort(fn) {
    this.onAbortFns.push(fn);
  }

  think(textureKey, seconds) {
    this.director.bubbles.show(this.f, textureKey, seconds);
  }

  // ---- Raum abfragen ----

  alive(sticker) {
    return !!sticker?.item && !sticker.carried && this.items.includes(sticker.item);
  }

  stickers(id) {
    return [...this.view.stickers.values()].filter((s) => s.def.id === id && this.alive(s));
  }

  // Punkt für die Fee (Feen leben in Raum-Koordinaten, daher unverändert)
  at(lx, ly) {
    return { x: lx, y: ly };
  }

  top(sticker) {
    return this.at(sticker.x, sticker.y - sticker.H);
  }

  // Mitte der Unterkante eines Rasterplatzes in Szenen-Koordinaten
  spotPos(spot, def) {
    const p = this.view.cellPos(spot.gx, spot.gy, def);
    return this.at(p.x, p.y);
  }

  // freier Platz, möglichst nahe an einem Möbel (dessen Oberkante), sonst irgendwo
  placeNear(def, near) {
    if (near?.item) {
      const s = findSpot(this.geo, def, near.item.gx + near.def.w / 2, near.item.gy + near.def.h, this.items);
      if (s) return s;
    }
    return findFreeSpot(this.geo, def, this.items);
  }

  // Raster-Abkürzungen für die Tätigkeiten (immer im Raster dieses Raums)
  isFree(def, spot, ignore) {
    return isSpotFree(this.geo, def, spot, this.items, ignore);
  }

  freeSpot(def) {
    return findFreeSpot(this.geo, def, this.items);
  }

  // Schreibtisch: Buch auf die Tischplatte (möglichst nah am Hocker), Fee sitzt auf dem Hocker
  findDesk(bookDef) {
    for (const desk of this.director.free((s) => s.def.desk)) {
      const top = desk.def.surfaces[0];
      for (let gx = desk.item.gx + top.x0; gx < desk.item.gx + top.x1; gx++) {
        const spot = { gx, gy: desk.item.gy + top.y, parent: desk.item.uid };
        if (!isSpotFree(this.geo, bookDef, spot, this.items)) continue;
        return { desk, bookSpot: spot, sit: desk.artToLocal(desk.def.desk.x, desk.def.desk.y) };
      }
    }
    return null;
  }

  // weicher Platz (Sessel …) mit zwei freien Sitz-Zellen: eine fürs Buch, eine für die Fee
  findSeat(bookDef) {
    for (const sofa of this.director.free((s) => s.def.soft)) {
      const seatY = sofa.item.gy + sofa.def.surfaces[0].y;
      const cells = [];
      for (let gx = sofa.item.gx; gx < sofa.item.gx + sofa.def.w; gx++) {
        if (isSpotFree(this.geo, ONE_CELL, { gx, gy: seatY }, this.items)) cells.push(gx);
      }
      if (cells.length < 2) continue;
      const bookAt = cells[Math.random() < 0.5 ? 0 : cells.length - 1];
      const sitAt = cells.find((x) => x !== bookAt);
      return {
        sofa,
        bookSpot: { gx: bookAt, gy: seatY, parent: sofa.item.uid },
        sit: this.spotPos({ gx: sitAt, gy: seatY }, ONE_CELL),
        side: Math.sign(sitAt - bookAt),
      };
    }
    return null;
  }

  // ---- Tragen ----

  // Gegenstand aus dem Raum nehmen und an die Fee hängen
  pickUp(sticker) {
    const item = sticker.item;
    this.life.state.items = this.items.filter((i) => i !== item);
    this.attach(sticker);
    this.sparkles.twinkle(this.f.x, this.f.y + 30, 3);
  }

  // neu entstandenen Gegenstand (noch nicht im Raum) an die Fee hängen
  carryNew(sticker, item) {
    sticker.item = item;
    this.view.stickers.set(item.uid, sticker);
    this.attach(sticker);
  }

  attach(sticker) {
    sticker.carried = true;
    this.scene.tweens.killTweensOf(sticker);
    sticker.setScale(0.85).setAlpha(1);
    this.view.items.bringToTop(sticker);
    this.f.carry(sticker, 14 + sticker.H * 0.85);
    this.carried = sticker;
  }

  // getragenen Gegenstand an einem Rasterplatz abstellen
  putDown(spot) {
    const s = this.carried;
    if (!s) return;
    this.carried = null;
    this.f.dropCarry();
    Object.assign(s.item, { gx: spot.gx, gy: spot.gy, parent: spot.parent ?? null });
    this.life.state.items.push(s.item);
    s.carried = false;
    const p = this.view.cellPos(spot.gx, spot.gy, s.def);
    this.scene.tweens.add({
      targets: s,
      x: p.x,
      y: p.y,
      duration: 200,
      ease: 'Cubic.Out',
      onComplete: () => popIn(this.scene, s, { from: 0.85, to: 1, duration: 600 }),
    });
    this.view.sortItems();
  }

  // ein Stück von einer Zutat nehmen (Vorrat sinkt; ist er leer, verschwindet die Zutat)
  takePortion(ing) {
    const item = ing.item;
    item.amount = (item.amount ?? ing.def.portions) - 1;
    const piece = this.scene.make.image({ x: 0, y: 0, key: ing.def.piece }, false);
    if (ing.def.ingredient) piece.setTint(ing.def.ingredient);
    this.view.items.add(piece);
    this.temp.push(piece);
    popIn(this.scene, piece, { from: 0, to: 1.4, duration: 400 });
    this.f.carry(piece, 30);
    const at = this.at(ing.x, ing.y - ing.H / 2);
    if (item.amount <= 0) {
      this.life.state.items = this.items.filter((i) => i !== item);
      this.view.removeSticker(item.uid);
      this.sparkles.burst(at.x, at.y, 12);
      this.scene.tweens.add({ targets: ing, scale: 0, alpha: 0, duration: 300, ease: 'Back.In', onComplete: () => ing.destroy() });
    } else {
      ing.setLook(item);
      squish(this.scene, ing, { amount: 0.12 });
      this.sparkles.twinkle(at.x, at.y, 3);
    }
    return piece;
  }

  // ein Stück aufessen: Vorrat sinkt, ist nichts mehr da, verschwindet das Essen
  consume(food) {
    const item = food.item;
    item.amount = (item.amount ?? food.def.portions) - 1;
    const at = this.at(food.x, food.y - food.H / 2);
    if (item.amount <= 0) {
      this.life.state.items = this.items.filter((i) => i !== item);
      this.view.removeSticker(item.uid);
      this.sparkles.burst(at.x, at.y, 10);
      this.scene.tweens.add({ targets: food, scale: 0, alpha: 0, duration: 300, ease: 'Back.In', onComplete: () => food.destroy() });
    } else {
      food.setLook(item);
      squish(this.scene, food, { amount: 0.12 });
    }
  }

  // Stück fällt in den Kessel
  dropPiece(piece, to) {
    this.f.dropCarry();
    this.scene.tweens.add({
      targets: piece,
      x: to.x,
      y: to.y,
      scale: 0.4,
      duration: 350,
      ease: 'Quad.In',
      onComplete: () => {
        this.temp = this.temp.filter((o) => o !== piece);
        piece.destroy();
      },
    });
  }

  // getragenes Ding löst sich in Glitzer auf (nur für Dinge, die die Fee selbst erschaffen hat)
  dissolveCarried() {
    const s = this.carried;
    if (!s) return;
    this.carried = null;
    this.f.dropCarry();
    this.view.stickers.delete(s.item.uid);
    const at = this.at(s.x, s.y - s.H / 2);
    this.sparkles.burst(at.x, at.y, 16);
    s.destroy();
  }

  setState(sticker, state) {
    sticker.item.state = state;
    sticker.setLook(sticker.item);
    squish(this.scene, sticker, { amount: 0.12 });
  }

  // ---- Aufräumen bei Abbruch ----

  cleanup() {
    this.onAbortFns.forEach((fn) => fn());
    this.onAbortFns = [];
    if (this.carried) {
      // Gegenstand nicht verlieren: möglichst dort abstellen, wo die Fee gerade ist
      const s = this.carried;
      const { cx, cy } = this.view.toCell(s.x, s.y - s.H / 2);
      const def = furnitureById(s.item.id);
      const spot = findSpot(this.geo, def, cx, cy, this.items) || findFreeSpot(this.geo, def, this.items);
      if (spot) this.putDown(spot);
      else this.dissolveCarried();
    }
    this.f.dropCarry();
    this.temp.forEach((o) => o.destroy());
    this.temp = [];
    this.release();
  }
}
