import Phaser from 'phaser';
import {
  GAME_W, GAME_H, BAR_TOP, BAR_H, WORLD_W, WORLD_H, MIN_ZOOM, MAX_ZOOM, START_ZOOM,
  SLOTS, DEPTH, COLORS, TREE_SCALE, EDIT_ROOM_Y, SWATCH_Y, UI_W,
} from '../config/layout.js';
import { roomById } from '../config/rooms.js';
import Slot from '../objects/Slot.js';
import Room from '../objects/Room.js';
import Sparkles from '../systems/particles.js';
import Placement, { fits } from '../systems/placement.js';
import { popIn, wobble } from '../systems/juice.js';
import { makeRng, clamp, lerpColor } from '../systems/motion.js';
import DayNight from '../systems/dayNight.js';
import { paintTiles } from '../systems/bake.js';
import { groundPlan, paintPlants, GROUND_LOOKS } from '../systems/flora.js';
import TREE_PARTS from '../config/tree.json';
import { BG_RES } from '../config/quality.js';
import { createRoom, house, snapshot } from '../state/house.js';
import { CELL, furnitureById } from '../config/furniture.js';
import { BALCONY, balconyFit, railSpots } from '../config/balcony.js';
import {
  TRUNK_X, TRUNK_TOP, GROUND_Y, sway, halfWidth, trunkOutline, BRANCHES, ROOTS, CROWN, WINDOWS, DOOR, bez, OX, OY,
} from '../config/treeShape.js';
import Residents from '../life/Residents.js';
import Fairy from '../objects/Fairy.js';
import Ghost from '../objects/Ghost.js';
import { FAIRY_PALETTES, GHOST_PALETTES } from '../config/fairies.js';
import { dust } from '../state/dust.js';
import { saveHandlers, setupAutosave } from '../state/save.js';
import { eventById } from '../events/index.js';

const DETAIL_ZOOM = 1.1;
const SIDE_MEADOW = 3200; // so breit reicht die Wiese im Querformat links und rechts über den Baum hinaus // ab dieser Vergrößerung zeigen Räume im Baum Glitzer & Co.

// Hauptszene: der große Zauberbaum mit seinen Höhlen und Räumen (Himmel und ferner Wald: BackScene).
// In jedem Raum leben Feen (Room.life) – man sieht sie schon im Baum werkeln.
// Kamera: wischen in alle Richtungen (mit Schwung), zwei Finger bzw. Mausrad zum Zoomen.
// Zwei Modi: 'tree' und 'room' (in einen Raum hineingezoomt zum Einrichten; Bedienung: RoomEdit-Szene darüber).
export default class TreeScene extends Phaser.Scene {
  constructor() {
    super('Tree');
  }

  // data.load: der Spielstand liegt schon im Haus (state/save.js → loadSave), seine Räume werden hier aufgebaut
  create(data = {}) {
    this.drawTree();
    // Tag und Nacht: nachts legt sich ein dunkelblauer Schleier über Baum und leere Höhlen
    // (die Räume dunkeln sich selbst ab, siehe life/RoomLife.js – so leuchten ihre Lampen)
    this.clock = new DayNight(data.load ? house.clockT : 0);
    this.nightVeil = this.add
      .rectangle(-6000, -4000, WORLD_W + 12000, WORLD_H + 8000, 0x1d1846, 1)
      .setOrigin(0)
      .setAlpha(0)
      .setDepth(DEPTH.slot + 0.5);

    Fairy.prebake(this, FAIRY_PALETTES);
    Ghost.prebake(this, GHOST_PALETTES);
    this.sparkles = new Sparkles(this);
    this.slots = SLOTS.map((d) => new Slot(this, d));
    this.placement = new Placement(this);
    this.registry.set('placement', this.placement);

    this.rooms = [];
    this.residents = new Residents(this); // alle Feen des Hauses (Einzug, Zimmerwechsel)
    this.mode = 'tree';
    this.activeRoom = null;
    this.happening = null; // laufendes Event (z. B. Geisterstunde)

    // gespeicherte Räume wieder in ihre Höhlen setzen; die Feen ziehen dann von selbst wieder ein (Residents)
    if (data.load) {
      for (const state of house.rooms.values()) {
        const slot = this.slots.find((s) => s.id === state.slotId);
        const def = roomById(state.type);
        if (!slot || !def || slot.room) {
          house.rooms.delete(state.slotId);
          continue;
        }
        if (slot.balcony) hangOnPegs(state.items, slot.geo);
        const room = this.makeRoom(slot, def, state, slot.x, slot.y);
        slot.room = room;
        if (slot.balcony) slot.setVisible(false); // Balkon ist durchsichtig: Platz-Umriss nicht durchscheinen lassen
        room.glowOn();
        this.rooms.push(room);
      }
    }

    // Speichern: so legt das Spiel seinen Stand ab (state/save.js)
    saveHandlers.snapshot = () => snapshot(this.clock.t);
    setupAutosave();
    this.events.once('shutdown', () => {
      if (saveHandlers.snapshot) saveHandlers.snapshot = null;
    });
    this.placement.on('selection', (id) => this.slots.forEach((s) => s.setPulse(!!id && fits(s, id))));

    // Kamera: eigener Zustand (Mitte + Zoom), wird in apply() auf die Phaser-Kamera übertragen
    this.camView = { x: WORLD_W / 2, y: 700, zoom: MIN_ZOOM };
    this.vel = { x: 0, y: 0 };
    this.applyView();
    this.setupInput();

    // Kamerafahrt von der Krone hinunter zu den ersten Höhlen
    this.flyTo({ x: WORLD_W / 2, y: 1950 + OY, zoom: START_ZOOM }, 2600, 500);

    this.scene.launch('Back');
    this.scene.launch('UI');
    this.scene.launch('Hud');

    // zum Testen: ?event=geister startet die Geisterstunde gleich (kostenlos),
    // ?event=lichter startet das Lichterfest
    const testEvent = { geister: 'ghost', lichter: 'lights' }[new URLSearchParams(location.search).get('event')];
    if (testEvent) this.time.delayedCall(3500, () => this.startHappening(testEvent));

    // Fenster geändert (Hoch-/Querformat): Wiese an den Seiten ergänzen, Kamera neu begrenzen
    this.paintSideMeadows();
    const onResize = () => {
      this.paintSideMeadows();
      if (this.mode === 'tree') this.applyView();
      else if (this.activeRoom && !this.transitioning) {
        this.camView = this.roomView(this.slots.find((s) => s.room === this.activeRoom));
        this.applyView();
      }
    };
    this.scale.on('resize', onResize);
    this.events.once('shutdown', () => this.scale.off('resize', onResize));
  }

  // liegt der Bildschirmpunkt auf der (mittigen) Kartenleiste?
  overBar(p) {
    return p.y >= BAR_TOP && Math.abs(p.x - GAME_W / 2) <= UI_W / 2;
  }

  update(time, delta) {
    const dt = Math.min(delta, 50) / 1000;
    if (this.mode === 'tree' && !this.drag && !this.viewTween && Math.hypot(this.vel.x, this.vel.y) > 5) {
      this.panBy(this.vel.x * dt, this.vel.y * dt);
      const k = Math.exp(-4 * dt);
      this.vel.x *= k;
      this.vel.y *= k;
    }

    // Tag und Nacht
    this.clock.update(dt);
    const dark = this.clock.darkness;
    this.nightVeil.setAlpha(dark * 0.45).setVisible(dark > 0.001);
    const warm = this.clock.warm;
    if (warm !== this.veilWarm) {
      this.veilWarm = warm;
      this.nightVeil.setFillStyle(lerpColor(0x1d1846, 0x6a2a5a, warm), 1); // Abend: Schleier in Abendrot
    }
    const rimTint = lerpColor(0xffffff, 0x8f88c8, dark);
    for (const room of this.rooms) room.view.rim.setTint(rimTint);

    // Leben in allen Räumen; Räume außerhalb des Bildes werden nicht gezeichnet und seltener bewegt
    const view = this.cameras.main.worldView;
    const zoom = this.camView.zoom;
    for (const room of this.rooms) {
      const onScreen =
        room.x + room.w > view.x && room.x - room.w < view.right && room.y + room.h > view.y && room.y - room.h < view.bottom;
      room.setVisible(onScreen);
      const detail = room === this.activeRoom || (this.mode === 'tree' && onScreen && zoom >= DETAIL_ZOOM);
      if (detail !== room.life.detail) room.life.setDetail(detail);
      room.life.update(dt, onScreen);
    }
    this.residents.update(dt);

    if (this.happening) {
      this.happening.update(dt);
      if (this.happening.done) {
        this.happening = null;
        this.events.emit('happening', null);
      }
    }
  }

  // ---------- Feenstaub und Events ----------

  // eine Fee hat etwas fertig gemacht: Staub ins Glas (fliegt sichtbar von der Fee dorthin, siehe HudScene)
  giveDust(amount, wx, wy) {
    const added = dust.add(amount);
    if (added <= 0) return;
    const v = this.camView;
    this.events.emit('dust', added, (wx - v.x) * v.zoom + GAME_W / 2, (wy - v.y) * v.zoom + GAME_H / 2);
  }

  // Event starten (bezahlt hat die HudScene schon); false, wenn gerade keins möglich ist
  startHappening(id) {
    const ev = eventById(id);
    if (this.happening || this.clock.night || !ev) return false;
    this.happening = new ev.Happening(this);
    this.events.emit('happening', id);
    return true;
  }

  canStartHappening() {
    return !this.happening && !this.clock.night;
  }

  // ---------- Kamera ----------

  // Mitte so begrenzen, dass man nicht aus der Welt herausschaut (unten Platz für die Leiste)
  clampView(v) {
    const z = clamp(v.zoom, MIN_ZOOM, this.mode === 'room' ? 6 : MAX_ZOOM);
    const hw = GAME_W / 2 / z;
    const hh = GAME_H / 2 / z;
    const x = WORLD_W > hw * 2 ? clamp(v.x, hw, WORLD_W - hw) : WORLD_W / 2;
    const y = clamp(v.y, hh, Math.max(hh, WORLD_H - hh + BAR_H / z));
    return { x, y, zoom: z };
  }

  applyView() {
    const cam = this.cameras.main;
    const v = this.mode === 'tree' ? (this.camView = this.clampView(this.camView)) : this.camView;
    cam.setZoom(v.zoom);
    cam.centerOn(v.x, v.y);
  }

  // Bildschirmpunkt → Weltpunkt (aus dem eigenen Kamerazustand, auch mitten im Frame korrekt)
  toWorld(sx, sy, v = this.camView) {
    return { x: v.x + (sx - GAME_W / 2) / v.zoom, y: v.y + (sy - GAME_H / 2) / v.zoom };
  }

  panBy(dx, dy) {
    this.camView.x += dx;
    this.camView.y += dy;
    this.applyView();
  }

  // um einen Bildschirmpunkt herum zoomen (der Weltpunkt darunter bleibt stehen)
  zoomAt(sx, sy, zoom, anchor = this.toWorld(sx, sy)) {
    const z = clamp(zoom, MIN_ZOOM, MAX_ZOOM);
    this.camView = { x: anchor.x - (sx - GAME_W / 2) / z, y: anchor.y - (sy - GAME_H / 2) / z, zoom: z };
    this.applyView();
  }

  // weiche Kamerafahrt zu Mitte + Zoom
  flyTo(target, duration = 550, delay = 0, onDone) {
    this.viewTween?.stop();
    const from = { ...this.camView };
    const to = this.mode === 'tree' ? this.clampView(target) : target;
    const t = { p: 0 };
    this.viewTween = this.tweens.add({
      targets: t,
      p: 1,
      duration,
      delay,
      ease: 'Sine.InOut',
      onUpdate: () => {
        // Zoom logarithmisch überblenden, damit es gleichmäßig wirkt
        const zoom = Math.exp(Math.log(from.zoom) + (Math.log(to.zoom) - Math.log(from.zoom)) * t.p);
        this.camView = { x: from.x + (to.x - from.x) * t.p, y: from.y + (to.y - from.y) * t.p, zoom };
        this.applyView();
      },
      onComplete: () => {
        this.viewTween = null;
        onDone?.();
      },
    });
  }

  setupInput() {
    this.drag = null; // ein Finger: wischen
    this.pinch = null; // zwei Finger: zoomen
    const inTree = () => this.mode === 'tree' && !this.transitioning && !this.placement.dragging;
    const fingers = () => [this.input.pointer1, this.input.pointer2].filter((p) => p.isDown);

    this.input.on('pointerdown', (p) => {
      if (!inTree()) return;
      const down = fingers();
      if (down.length >= 2) {
        // zweiter Finger: Zoomen beginnt
        const [a, b] = down;
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        this.pinch = { d0: Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y), z0: this.camView.zoom, anchor: this.toWorld(mid.x, mid.y) };
        if (this.drag) this.drag.moved = true; // kein Antippen mehr
        return;
      }
      if (this.overBar(p)) return;
      this.viewTween?.stop();
      this.viewTween = null;
      this.drag = { x0: p.x, y0: p.y, lastX: p.x, lastY: p.y, lastT: this.time.now, moved: false };
      this.vel = { x: 0, y: 0 };
    });

    this.input.on('pointermove', (p) => {
      if (this.pinch) {
        const down = fingers();
        if (down.length < 2) return;
        const [a, b] = down;
        const d = Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y);
        this.zoomAt((a.x + b.x) / 2, (a.y + b.y) / 2, this.pinch.z0 * (d / this.pinch.d0), this.pinch.anchor);
        return;
      }
      const drag = this.drag;
      if (!drag) return;
      if (!p.isDown) return (this.drag = null); // Finger wurde über der Kartenleiste losgelassen
      if (Math.hypot(p.x - drag.x0, p.y - drag.y0) > 14) drag.moved = true;
      if (!drag.moved) return;
      const z = this.camView.zoom;
      const now = this.time.now;
      const dt = Math.max(1, now - drag.lastT) / 1000;
      const dx = -(p.x - drag.lastX) / z;
      const dy = -(p.y - drag.lastY) / z;
      this.vel.x = Phaser.Math.Linear(this.vel.x, dx / dt, 0.5);
      this.vel.y = Phaser.Math.Linear(this.vel.y, dy / dt, 0.5);
      drag.lastX = p.x;
      drag.lastY = p.y;
      drag.lastT = now;
      this.panBy(dx, dy);
    });

    const end = () => {
      if (this.pinch) {
        if (fingers().length < 2) this.pinch = null;
        this.vel = { x: 0, y: 0 };
      }
      if (this.drag && (!this.drag.moved || this.time.now - this.drag.lastT > 90)) this.vel = { x: 0, y: 0 };
      this.drag = null;
    };
    // Antippen (ohne Wischen) → Höhle in der Nähe suchen; großzügig, damit kleine Finger treffen
    this.input.on('pointerup', (p) => {
      if (this.drag && !this.drag.moved && !this.pinch && !this.overBar(p) && inTree()) {
        const wp = this.toWorld(p.x, p.y);
        const slot = this.slots.find((s) => !s.room && s.contains(wp.x, wp.y, 20));
        if (slot) this.onSlotTap(slot);
      }
      end();
    });
    this.input.on('pointerupoutside', end);

    // am PC: Mausrad zoomt um den Mauszeiger
    this.input.on('wheel', (p, over, dx, dy) => {
      if (!inTree()) return;
      this.viewTween?.stop();
      this.viewTween = null;
      this.zoomAt(p.x, p.y, this.camView.zoom * Math.exp(-dy * 0.0015));
    });
  }

  // ---------- Platzieren ----------

  onSlotTap(slot) {
    if (slot.room || this.placement.dragging) return;
    const id = this.placement.selected;
    if (!id || !fits(slot, id)) {
      wobble(this, slot, { angle: 2.5 });
      return;
    }
    const from = this.placement.originWorld();
    this.placement.place(id, slot, from.x, from.y);
  }

  placeRoom(id, slot, fromX, fromY) {
    const def = roomById(id);
    slot.room = true; // sofort belegt, damit nichts doppelt landet
    slot.setPulse(false);
    slot.setHover(false);

    const room = this.makeRoom(slot, def, createRoom(slot.id, def, slot.geo), fromX, fromY).setScale(0.75);

    // Snap: zum Slot gleiten, dann elastisch aufploppen + Glitzer
    this.tweens.add({
      targets: room,
      x: slot.x,
      y: slot.y,
      duration: 260,
      ease: 'Cubic.Out',
      onComplete: () => {
        slot.room = room;
        if (slot.balcony) slot.setVisible(false); // Balkon ist durchsichtig: Platz-Umriss nicht durchscheinen lassen
        popIn(this, room, { from: 0.7, to: 1, duration: 950 });
        this.sparkles.burst(slot.x, slot.y, 44);
        room.glowOn();
        // Feen ziehen erst ein, wenn das Zimmer eingerichtet ist (siehe RoomLife)
        this.rooms.push(room);
      },
    });
  }

  // Raum für eine Höhle bauen (neu gelegt oder aus dem Spielstand); antippen = hineinzoomen
  makeRoom(slot, def, state, x, y) {
    const room = new Room(this, def, x, y, state, slot.geo);
    room.on('pointerup', () => {
      if (this.mode !== 'tree' || !this.drag || this.drag.moved || this.pinch || this.transitioning || slot.room !== room) return;
      this.openRoom(slot);
    });
    return room;
  }

  // ---------- Raum betreten / verlassen ----------

  // in den Raum hineinzoomen (so groß, wie zwischen Kopfzeile und Leiste Platz ist);
  // die Bedienung übernimmt die RoomEdit-Szene darüber
  // Kamera für die Großansicht eines Raums: so groß, wie zwischen Kopfzeile und Leiste Platz ist,
  // Raum-Mitte auf dem Bildschirm bei EDIT_ROOM_Y (unten ist die Leiste)
  roomView(slot) {
    const room = slot.room;
    // Balkon: die Blumenkästen hängen außen an den Pfosten – die sollen mit ins Bild
    const w = slot.balcony ? Math.max(room.w, (BALCONY.w * balconyFit(slot.geo).sx + 2 * CELL) * TREE_SCALE) : room.w;
    // der ganze Raum passt aufs Bild (zwischen Kopfzeile und Leiste)
    const zoom = Math.min((GAME_W - 24) / w, (SWATCH_Y - 60 - 230) / room.h);
    const y = slot.y + (GAME_H / 2 - EDIT_ROOM_Y) / zoom;
    // wie weit man den Raum schieben darf (halbe Überbreite in Welt-Pixeln)
    this.roomPan = { x0: slot.x, y0: y, rx: Math.max(0, (w - (GAME_W - 24) / zoom) / 2) };
    return { x: slot.x, y, zoom };
  }

  // Raumansicht mit dem Finger verschieben (Bildschirm-Pixel), nur so weit, wie der Raum über den Rand ragt
  panRoom(dx, dy) {
    const p = this.roomPan;
    if (!p || this.transitioning || this.mode !== 'room') return;
    const v = this.camView;
    v.x = clamp(v.x - dx / v.zoom, p.x0 - p.rx, p.x0 + p.rx);
    v.y = p.y0;
    this.applyView();
  }

  openRoom(slot) {
    const room = slot.room;
    this.mode = 'room';
    this.transitioning = true;
    this.vel = { x: 0, y: 0 };
    this.prevView = { ...this.camView };
    this.placement.clear();
    this.activeRoom = room;
    // Schein von Raumlicht und Laternen wirkt nur von weitem – ganz nah wären es milchige Flecken
    room.light.setVisible(false);
    this.halos.forEach((h) => h.setVisible(false));
    this.scene.sleep('UI');
    // Raum-Mitte soll auf dem Bildschirm bei EDIT_ROOM_Y liegen (unten ist die Leiste)
    this.flyTo(this.roomView(slot), 600, 0, () => (this.transitioning = false));
    this.scene.launch('RoomEdit', { slotId: slot.id });
    this.scene.bringToTop('Hud'); // das Feenstaub-Glas bleibt sichtbar
    this.events.emit('mode', 'room');
  }

  // wieder herauszoomen in den Baum, dorthin, wo man vorher war
  closeRoom() {
    const room = this.activeRoom;
    this.transitioning = true;
    this.activeRoom = null;
    room?.light.setVisible(true);
    this.halos.forEach((h) => h.setVisible(true));
    this.scene.wake('UI');
    this.events.emit('mode', 'tree');
    this.flyTo(this.prevView, 600, 0, () => {
      this.mode = 'tree';
      this.transitioning = false;
    });
  }

  // Raum entfernen (nach Sicherheitsabfrage im Editor): herauszoomen, Raum verschwindet, Höhle ist wieder frei
  deleteRoom(room) {
    const slot = this.slots.find((s) => s.room === room);
    this.closeRoom();
    this.rooms = this.rooms.filter((r) => r !== room); // zuerst raus, damit die Feen richtig gezählt werden
    this.residents.evacuate(room); // Feen ziehen in andere Zimmer um (oder fliegen davon)
    room.life.dispose(); // Tätigkeiten beenden
    if (slot) {
      slot.room = null;
      slot.setVisible(true);
    }
    house.rooms.delete(slot?.id);
    room.disableInteractive();
    this.time.delayedCall(450, () => {
      this.sparkles.burst(room.x, room.y, 40);
      this.tweens.add({ targets: room, scale: 0, alpha: 0, duration: 500, ease: 'Back.In', onComplete: () => room.destroy() });
    });
  }

  // ---------- Baum ----------
  // Einmal gemalt (in Kacheln, siehe systems/bake.js): Stamm und Äste mit der gemalten Rinde gefüllt,
  // die Krone aus den gemalten Blätterwolken zusammengesetzt (verschieden groß, gespiegelt, hinten dunkler).

  // gemalter Rasen als Füllmuster (hinten und vorne)
  grassPatterns(ctx) {
    const img = (i) => this.textures.exists(`tree-rasen-${i}`) && this.textures.get(`tree-rasen-${i}`).getSourceImage();
    return {
      grass: img(1) && ctx.createPattern(img(1), 'repeat'),
      grassFront: (img(4) || img(1)) && ctx.createPattern(img(4) || img(1), 'repeat'),
    };
  }

  // Querformat: die Wiese geht links und rechts des Baums weiter (nur gemalt, wenn man sie sehen kann)
  paintSideMeadows() {
    if (this.sideMeadows || GAME_W <= UI_W) return;
    const y0 = GROUND_Y + OY - 1500; // Platz für die Bäume am Waldrand
    const plan = floraPlan();
    const paint = (x0) => (ctx) => {
      const { grass, grassFront } = this.grassPatterns(ctx);
      meadow(ctx, grass, 4690 + OY, 22, x0, x0 + SIDE_MEADOW);
      paintPlants(ctx, plan.back, GROUND_LOOKS);
      meadow(ctx, grassFront, 4735 + OY, 14, x0, x0 + SIDE_MEADOW);
      const rng = makeRng(x0 < 0 ? 31 : 37);
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = ['#ffffff', '#ffd166', '#ff9ec7'][i % 3];
        ctx.beginPath();
        ctx.arc(x0 + rng() * SIDE_MEADOW, 4770 + OY + rng() * 210, 6 + rng() * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      paintPlants(ctx, plan.front, GROUND_LOOKS);
    };
    const opts = { res: BG_RES, depth: DEPTH.tree, y0 };
    this.sideMeadows = [
      ...paintTiles(this, 'meadow-left', SIDE_MEADOW, WORLD_H - y0, paint(-SIDE_MEADOW), { ...opts, x0: -SIDE_MEADOW }),
      ...paintTiles(this, 'meadow-right', SIDE_MEADOW, WORLD_H - y0, paint(WORLD_W), { ...opts, x0: WORLD_W }),
      // unter dem Weltrand: neben der Kartenleiste sieht man noch ein Stück Wiese (gröber gemalt, liegt ja am Rand)
      ...paintTiles(this, 'meadow-below', WORLD_W + 2 * SIDE_MEADOW, Math.ceil(BAR_H / MIN_ZOOM), (ctx) => {
        const { grassFront } = this.grassPatterns(ctx);
        if (grassFront) grassFront.setTransform(new DOMMatrix().translate(0, 4735 + OY - 14 * 1.6));
        ctx.fillStyle = grassFront || '#6cc46a';
        ctx.fillRect(-SIDE_MEADOW, WORLD_H - 2, WORLD_W + 2 * SIDE_MEADOW, BAR_H / MIN_ZOOM + 4);
        const rng = makeRng(41);
        for (let i = 0; i < 300; i++) {
          ctx.fillStyle = ['#ffffff', '#ffd166', '#ff9ec7', '#c9a6ff'][i % 4];
          ctx.beginPath();
          ctx.arc(-SIDE_MEADOW + rng() * (WORLD_W + 2 * SIDE_MEADOW), WORLD_H + rng() * 800, 6 + rng() * 5, 0, Math.PI * 2);
          ctx.fill();
        }
      }, { res: BG_RES * 0.5, depth: DEPTH.tree, x0: -SIDE_MEADOW, y0: WORLD_H, tile: 2000 }),
    ];
  }

  drawTree() {
    const bark = this.textures.get('tree-rinde-1').getSourceImage();
    const crowns = TREE_PARTS_KEYS.map((k) => this.textures.get(k).getSourceImage());
    const shaded = crowns.map((img) => darken(img, 'rgba(25, 45, 40, 0.3)'));
    // gemalte Baumfenster und Haustür (Lieferung 6); ohne Bild zeichnet der Code sie
    const sprite = (name) => this.textures.exists(`spr-${name}`) && this.textures.get(`spr-${name}`).getSourceImage();
    const windowImg = sprite('baumfenster');
    const doorImg = sprite('haustuer');
    const pieces = crownLayout(crowns.length);
    const house = SLOTS.find((s) => s.treehouse);
    const plan = floraPlan();
    paintTiles(this, 'tree', WORLD_W, WORLD_H, (ctx) => {
      const rng = makeRng(11);
      const barkFill = ctx.createPattern(bark, 'repeat');
      barkFill.setTransform(new DOMMatrix().scale(0.8));
      const { grass, grassFront } = this.grassPatterns(ctx);
      const outline = '#4a2a18';

      // Wiese hinter dem Baum (gemalter Rasen, leicht hügelige Oberkante), darauf Waldrand und Dickicht
      meadow(ctx, grass, 4690 + OY, 22);
      paintPlants(ctx, plan.back, GROUND_LOOKS);
      // ab hier in Baum-Koordinaten (config/treeShape.js)
      ctx.save();
      ctx.translate(OX, OY);

      // Holz: Äste mit Zweigen, Wurzeln und Stamm – erst alle dunklen Kanten, dann die Rinde darüber,
      // so wachsen die Teile ohne Naht ineinander
      const shapes = [];
      for (const b of BRANCHES) {
        shapes.push(taper(b.p, b.w0, b.w1));
        for (const k of b.kids || []) {
          const s = bez(b.p, k.t);
          shapes.push(taper([[s.x, s.y], ...k.to], k.w, k.w * 0.3));
        }
      }
      for (const r of ROOTS) shapes.push(taper(r.p, r.w0, r.w1));
      const trunk = trunkOutline();
      shapes.push(trunk);
      ctx.lineJoin = 'round';
      for (const s of shapes) {
        path(ctx, s);
        ctx.lineWidth = 16;
        ctx.strokeStyle = outline;
        ctx.stroke();
      }
      for (const s of shapes) {
        path(ctx, s);
        ctx.fillStyle = barkFill;
        ctx.fill();
      }

      // Stamm: rund schattiert, unten wärmer und dunkler, Maserung folgt dem Schwung
      ctx.save();
      path(ctx, trunk);
      ctx.clip();
      const side = ctx.createLinearGradient(TRUNK_X - 820, 0, TRUNK_X + 820, 0);
      side.addColorStop(0, 'rgba(40, 20, 10, 0.55)');
      side.addColorStop(0.2, 'rgba(40, 20, 10, 0)');
      side.addColorStop(0.42, 'rgba(255, 220, 170, 0.12)');
      side.addColorStop(0.8, 'rgba(40, 20, 10, 0)');
      side.addColorStop(1, 'rgba(40, 20, 10, 0.6)');
      ctx.fillStyle = side;
      ctx.fillRect(-OX, -OY, WORLD_W, WORLD_H);
      const warm = ctx.createLinearGradient(0, 3200, 0, GROUND_Y);
      warm.addColorStop(0, 'rgba(120, 50, 20, 0)');
      warm.addColorStop(1, 'rgba(110, 45, 15, 0.28)');
      ctx.fillStyle = warm;
      ctx.fillRect(-OX, 3200, WORLD_W, GROUND_Y - 3100);
      ctx.lineWidth = 7;
      ctx.strokeStyle = 'rgba(55, 28, 12, 0.22)';
      for (let k = 0; k < 15; k++) {
        const x0 = TRUNK_X - 720 + k * 103;
        ctx.beginPath();
        for (let y = TRUNK_TOP; y <= GROUND_Y; y += 30) {
          const x = x0 + sway(y) + 16 * Math.sin(y / 150 + k * 1.7);
          if (y === TRUNK_TOP) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
      ctx.restore();

      // Moos auf den Wurzeln, Efeu an den Stammkanten
      for (const r of ROOTS) moss(ctx, r, makeRng(r.p[0][0]));
      ivy(ctx, -1, 4620, 3250, makeRng(21));
      ivy(ctx, 1, 4640, 3850, makeRng(22));

      // runde Fenster zwischen den Räumen, Tür am Stammfuß
      for (const w of WINDOWS) {
        const x = w.x + sway(w.y);
        if (!windowImg) roundWindow(ctx, x, w.y, w.r);
        else {
          // so breit wie der alte Rahmen; das runde Glas sitzt etwa bei 42 % der Bildhöhe
          const dw = (w.r + 20) * 2.15;
          const dh = (dw * windowImg.height) / windowImg.width;
          ctx.drawImage(windowImg, x - dw / 2, w.y - dh * 0.42, dw, dh);
        }
      }
      const dx = DOOR.x + sway(DOOR.y - 200);
      if (!doorImg) door(ctx, dx, DOOR.y, DOOR.w, DOOR.h);
      else {
        // Tür mit Laterne und Pilzen, unten auf den Stufen der alten Tür
        const dw = DOOR.w * 3.1;
        const dh = (dw * doorImg.height) / doorImg.width;
        ctx.drawImage(doorImg, dx - dw / 2, DOOR.y + 22 - dh, dw, dh);
      }

      // Krone: Blätterbüschel an den Astenden (hinten dunkler, vorne hell)
      for (const pc of pieces) {
        const img = (pc.back ? shaded : crowns)[pc.i];
        const w = img.width * pc.s;
        const h = img.height * pc.s;
        ctx.save();
        ctx.translate(pc.x, pc.y);
        if (pc.flip) ctx.scale(-1, 1);
        ctx.drawImage(img, -w / 2, -h / 2, w, h);
        ctx.restore();
      }

      // Baumhaus: Plattform mit Streben auf dem Ast, Strickleiter
      if (house) platform(ctx, { ...house, x: house.x - OX, y: house.y - OY });
      ctx.restore();

      // Grassaum vor den Wurzeln: der Baum steht im Gras, nicht darauf
      meadow(ctx, grassFront, 4735 + OY, 14);
      for (let i = 0; i < 90; i++) {
        ctx.fillStyle = ['#ffffff', '#ffd166', '#ff9ec7', '#c9a6ff'][i % 4];
        ctx.beginPath();
        ctx.arc(rng() * WORLD_W, 4770 + OY + rng() * 210, 6 + rng() * 5, 0, Math.PI * 2);
        ctx.fill();
      }
      // Gräser, Blumen, Pilze und Steine vorne in der Wiese
      paintPlants(ctx, plan.front, GROUND_LOOKS);
    }, { res: BG_RES, depth: DEPTH.tree });
    this.halos = []; // Lichter hängen jetzt gemalt an der Krone
  }
}

// Blumenkästen aus älteren Spielständen (andere Plätze) an freie Haken des Balkons hängen, sonst entfernen
function hangOnPegs(items, geo) {
  for (const it of [...items]) {
    const def = furnitureById(it.id);
    if (!def?.rail) continue;
    const spots = railSpots(geo, def.w, def.h);
    if (spots.some((s) => s.gx === it.gx && s.gy === it.gy)) continue;
    const free = spots.find((s) => !items.some((o) => o !== it && o.gx === s.gx && o.gy === s.gy));
    if (free) Object.assign(it, { gx: free.gx, gy: free.gy, parent: null });
    else items.splice(items.indexOf(it), 1);
  }
}

// gemalte Kronenstücke (tools/import-sprites.py → public/assets/tree)
const TREE_PARTS_KEYS = Array.from({ length: TREE_PARTS.krone }, (_, i) => `tree-krone-${i + 1}`);

// Pflanzen am Boden (systems/flora.js): einmal geplant, für die ganze Breite samt Wiesen links und rechts –
// so passen Baum-Kacheln und Seitenwiesen nahtlos aneinander
let floraCache;
function floraPlan() {
  floraCache ||= groundPlan({
    x0: -SIDE_MEADOW,
    x1: WORLD_W + SIDE_MEADOW,
    gy: GROUND_Y - 10 + OY,
    trunk: [TRUNK_X + OX - 1100, TRUNK_X + OX + 1100],
    door: [DOOR.x + OX - 240, DOOR.x + OX + 240],
  });
  return floraCache;
}

// Wiesenstreifen bis zum unteren Weltrand: gemalter Rasen (ohne Bild: einfaches Grün), gewellte Oberkante mit dunkler Linie
// (x0..x1 = Ausschnitt in Weltkoordinaten; die Welle ist überall gleich, damit Stücke nahtlos aneinanderpassen)
function meadow(ctx, pattern, top, wave, x0 = 0, x1 = WORLD_W) {
  const edge = (x) => top + Math.sin(x * 0.0042) * wave + Math.sin(x * 0.011 + 1.3) * wave * 0.5;
  ctx.beginPath();
  ctx.moveTo(x0, WORLD_H);
  for (let x = x0; x <= x1; x += 20) ctx.lineTo(x, edge(x));
  ctx.lineTo(x1, WORLD_H);
  ctx.closePath();
  if (pattern) pattern.setTransform(new DOMMatrix().translate(0, top - wave * 1.6));
  ctx.fillStyle = pattern || '#6cc46a';
  ctx.fill();
  ctx.beginPath();
  for (let x = x0; x <= x1; x += 20) (x > x0 ? ctx.lineTo : ctx.moveTo).call(ctx, x, edge(x));
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#3f6b2e';
  ctx.stroke();
}

function path(ctx, pts) {
  ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
  ctx.closePath();
}

// Ast als sich verjüngende Form entlang einer Bézier-Kurve (mit runder Spitze)
function taper(p, w0, w1, n = 28) {
  const left = [];
  const right = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = bez(p, Math.max(0, t - 0.01));
    const b = bez(p, Math.min(1, t + 0.01));
    const c = bez(p, t);
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len;
    const ny = (b.x - a.x) / len;
    const w = (w0 + (w1 - w0) * t ** 0.8) / 2;
    left.push({ x: c.x + nx * w, y: c.y + ny * w });
    right.push({ x: c.x - nx * w, y: c.y - ny * w });
  }
  // runde Spitze
  const tip = bez(p, 1);
  const pre = bez(p, 0.97);
  const d = Math.hypot(tip.x - pre.x, tip.y - pre.y) || 1;
  const capPt = { x: tip.x + ((tip.x - pre.x) / d) * w1 * 0.45, y: tip.y + ((tip.y - pre.y) / d) * w1 * 0.45 };
  return [...left, capPt, ...right.reverse()];
}

// Moospolster auf der Oberseite einer Wurzel
function moss(ctx, root, rng) {
  for (let i = 0; i < 16; i++) {
    const t = 0.05 + (i / 16) * 0.8;
    const c = bez(root.p, t);
    const w = (root.w0 + (root.w1 - root.w0) * t ** 0.8) / 2;
    const r = 14 + rng() * 16;
    ctx.fillStyle = ['#5d9a3e', '#6fae48', '#4f8a36'][i % 3];
    ctx.beginPath();
    ctx.arc(c.x + (rng() - 0.5) * 20, c.y - w * 0.75, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Efeuranke an der Stammkante (side −1 links, 1 rechts), von y0 nach oben bis y1
function ivy(ctx, side, y0, y1, rng) {
  const xAt = (y) => TRUNK_X + sway(y) + side * (halfWidth(y) - 40) + 22 * Math.sin(y / 95);
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#3e6b2c';
  ctx.beginPath();
  for (let y = y0; y >= y1; y -= 20) (y === y0 ? ctx.moveTo : ctx.lineTo).call(ctx, xAt(y), y);
  ctx.stroke();
  for (let y = y0 - 30, i = 0; y > y1; y -= 55 + rng() * 25, i++) {
    const x = xAt(y);
    const dir = i % 2 ? 1 : -1;
    leaf(ctx, x + dir * 22, y, 24 + rng() * 10, dir * 0.7, ['#4f9a48', '#6fbf5a', '#3f8a3c'][i % 3]);
  }
}

function leaf(ctx, x, y, s, rot, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -s);
  ctx.quadraticCurveTo(s, -s * 0.2, 0, s * 0.8);
  ctx.quadraticCurveTo(-s, -s * 0.2, 0, -s);
  ctx.fill();
  ctx.strokeStyle = 'rgba(30, 60, 20, 0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -s * 0.7);
  ctx.lineTo(0, s * 0.6);
  ctx.stroke();
  ctx.restore();
}

// rundes Fenster mit Holzrahmen, warmem Licht, Vorhängen und Blumenkasten
export function roundWindow(ctx, x, y, r) {
  ctx.fillStyle = 'rgba(30, 15, 5, 0.35)';
  ctx.beginPath();
  ctx.arc(x + 4, y + 8, r + 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5a3420';
  ctx.beginPath();
  ctx.arc(x, y, r + 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b8814f';
  ctx.beginPath();
  ctx.arc(x, y, r + 13, 0, Math.PI * 2);
  ctx.fill();
  const glass = ctx.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r);
  glass.addColorStop(0, '#fff3c4');
  glass.addColorStop(0.6, '#ffd27a');
  glass.addColorStop(1, '#f0a14a');
  ctx.fillStyle = glass;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  // Vorhänge
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#ff9ec7';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * r, y - r);
    ctx.quadraticCurveTo(x + s * r * 0.35, y - r * 0.1, x + s * r * 0.75, y + r);
    ctx.lineTo(x + s * r, y + r);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = '#5a3420';
  ctx.lineWidth = Math.max(5, r * 0.11);
  ctx.beginPath();
  ctx.moveTo(x - r, y);
  ctx.lineTo(x + r, y);
  ctx.moveTo(x, y - r);
  ctx.lineTo(x, y + r);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.beginPath();
  ctx.ellipse(x - r * 0.45, y - r * 0.5, r * 0.18, r * 0.1, -0.7, 0, Math.PI * 2);
  ctx.fill();
  // Blumenkasten
  const bw = r * 1.5;
  for (const [cx, col] of [[-0.5, '#ff7ab8'], [-0.15, '#ffd166'], [0.2, '#ffffff'], [0.5, '#c9a6ff']]) {
    ctx.fillStyle = '#4f9a48';
    ctx.beginPath();
    ctx.arc(x + cx * bw, y + r + 16, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(x + cx * bw, y + r + 8, 8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#8a5a3b';
  ctx.beginPath();
  ctx.roundRect(x - bw * 0.7, y + r + 18, bw * 1.4, 22, 6);
  ctx.fill();
  ctx.strokeStyle = '#4a2a18';
  ctx.lineWidth = 4;
  ctx.stroke();
}

// kleine runde Haustür am Stammfuß mit Steinbogen, Stufen, Laterne und Pilzen; (x, bottom) = Mitte unten
export function door(ctx, x, bottom, w, h) {
  const top = bottom - h;
  const arch = (pad) => {
    ctx.beginPath();
    ctx.moveTo(x - w / 2 - pad, bottom);
    ctx.lineTo(x - w / 2 - pad, top + w / 2);
    ctx.arc(x, top + w / 2, w / 2 + pad, Math.PI, 0);
    ctx.lineTo(x + w / 2 + pad, bottom);
    ctx.closePath();
  };
  // Steinbogen
  arch(30);
  ctx.fillStyle = '#4a2a18';
  ctx.fill();
  arch(24);
  ctx.fillStyle = '#a69c8e';
  ctx.fill();
  ctx.strokeStyle = 'rgba(70, 60, 50, 0.6)';
  ctx.lineWidth = 3;
  for (let a = Math.PI; a <= Math.PI * 2 + 0.01; a += Math.PI / 7) {
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (w / 2), top + w / 2 + Math.sin(a) * (w / 2));
    ctx.lineTo(x + Math.cos(a) * (w / 2 + 24), top + w / 2 + Math.sin(a) * (w / 2 + 24));
    ctx.stroke();
  }
  // Tür aus Brettern
  arch(0);
  ctx.fillStyle = '#c98b5a';
  ctx.fill();
  ctx.save();
  arch(0);
  ctx.clip();
  ctx.strokeStyle = '#a86d40';
  ctx.lineWidth = 5;
  for (let bx = x - w / 2 + w / 4; bx < x + w / 2; bx += w / 4) {
    ctx.beginPath();
    ctx.moveTo(bx, top);
    ctx.lineTo(bx, bottom);
    ctx.stroke();
  }
  ctx.fillStyle = '#8a5a3b';
  ctx.fillRect(x - w / 2, bottom - h * 0.32, w, 12);
  ctx.fillRect(x - w / 2, top + h * 0.42, w, 12);
  ctx.restore();
  // rundes Guckfenster und Knauf
  ctx.fillStyle = '#5a3420';
  ctx.beginPath();
  ctx.arc(x, top + w * 0.42, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffe08a';
  ctx.beginPath();
  ctx.arc(x, top + w * 0.42, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#5a3420';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x - 19, top + w * 0.42);
  ctx.lineTo(x + 19, top + w * 0.42);
  ctx.moveTo(x, top + w * 0.42 - 19);
  ctx.lineTo(x, top + w * 0.42 + 19);
  ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(x + w * 0.3, bottom - h * 0.45, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#8a5a1a';
  ctx.lineWidth = 3;
  ctx.stroke();
  // Stufen
  ctx.fillStyle = '#9a9184';
  ctx.strokeStyle = '#4a3a2a';
  ctx.lineWidth = 4;
  for (const [sw, sy] of [[w + 70, 0], [w + 30, -18]]) {
    ctx.beginPath();
    ctx.roundRect(x - sw / 2, bottom + sy - 6, sw, 24, 10);
    ctx.fill();
    ctx.stroke();
  }
  // Laterne links an einem Haken
  const lx = x - w / 2 - 70;
  const ly = top + 70;
  ctx.strokeStyle = '#3b2a1a';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(lx + 40, ly - 30);
  ctx.lineTo(lx, ly - 30);
  ctx.lineTo(lx, ly - 12);
  ctx.stroke();
  const glow = ctx.createRadialGradient(lx, ly + 20, 4, lx, ly + 20, 90);
  glow.addColorStop(0, 'rgba(255, 220, 120, 0.55)');
  glow.addColorStop(1, 'rgba(255, 220, 120, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(lx, ly + 20, 90, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3b2a1a';
  ctx.beginPath();
  ctx.roundRect(lx - 22, ly - 12, 44, 62, 10);
  ctx.fill();
  ctx.fillStyle = '#ffd96b';
  ctx.beginPath();
  ctx.roundRect(lx - 14, ly - 2, 28, 42, 8);
  ctx.fill();
  // Pilze rechts
  for (const [mx, ms] of [[x + w / 2 + 60, 1], [x + w / 2 + 120, 0.7], [x - w / 2 - 130, 0.8]]) mushroom(ctx, mx, bottom + 6, ms);
}

function mushroom(ctx, x, y, s) {
  ctx.fillStyle = '#fff4e0';
  ctx.strokeStyle = '#4a2a18';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.roundRect(x - 13 * s, y - 50 * s, 26 * s, 50 * s, 10 * s);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e0566f';
  ctx.beginPath();
  ctx.ellipse(x, y - 50 * s, 46 * s, 34 * s, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  for (const [dx, dy, r] of [[-20, -62, 7], [6, -72, 8], [24, -58, 6]]) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Holzplattform unter dem Baumhaus: Bretter, schräge Streben hinunter zum Ast, Strickleiter
function platform(ctx, slot) {
  const hh = (slot.rows * CELL * TREE_SCALE) / 2;
  const hw = (slot.cols * CELL * TREE_SCALE) / 2;
  const y = slot.y + hh + 22;
  const x0 = slot.x - hw - 50;
  const x1 = slot.x + hw + 50;
  // Streben
  ctx.lineCap = 'round';
  for (const [ax, bx, by] of [[x0 + 50, slot.x - 20, y + 170], [x1 - 50, slot.x + 30, y + 160]]) {
    ctx.strokeStyle = '#4a2a18';
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.moveTo(ax, y + 10);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.strokeStyle = '#9e6b47';
    ctx.lineWidth = 16;
    ctx.stroke();
  }
  // Bretter
  ctx.fillStyle = '#4a2a18';
  ctx.beginPath();
  ctx.roundRect(x0 - 6, y - 6, x1 - x0 + 12, 42, 12);
  ctx.fill();
  ctx.fillStyle = '#c98b5a';
  ctx.beginPath();
  ctx.roundRect(x0, y, x1 - x0, 30, 9);
  ctx.fill();
  ctx.strokeStyle = '#a86d40';
  ctx.lineWidth = 4;
  for (let px = x0 + 60; px < x1; px += 60) {
    ctx.beginPath();
    ctx.moveTo(px, y + 3);
    ctx.lineTo(px, y + 27);
    ctx.stroke();
  }
  // Strickleiter vom linken Rand
  const lx = x0 + 34;
  ctx.strokeStyle = '#d8b98a';
  ctx.lineWidth = 6;
  for (const dx of [-22, 22]) {
    ctx.beginPath();
    ctx.moveTo(lx + dx, y + 30);
    ctx.quadraticCurveTo(lx + dx - 10, y + 200, lx + dx + 6, y + 380);
    ctx.stroke();
  }
  ctx.strokeStyle = '#a8774f';
  ctx.lineWidth = 9;
  for (let k = 1; k <= 6; k++) {
    const ry = y + 30 + k * 55;
    ctx.beginPath();
    ctx.moveTo(lx - 24 - k, ry);
    ctx.lineTo(lx + 24 - k, ry);
    ctx.stroke();
  }
}

// Kronenstück abgedunkelt (für die hintere Schicht): Bild in eine Hilfsfläche, darüber die Farbe nur auf dem Bild
function darken(img, color) {
  const c = document.createElement('canvas');
  c.width = img.width;
  c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'source-atop';
  x.fillStyle = color;
  x.fillRect(0, 0, c.width, c.height);
  return c;
}

// Kronenstücke in den Blätterbüscheln (CROWN): hinten große dunkle, vorne kleinere helle Stücke
function crownLayout(n) {
  const rng = makeRng(23);
  const out = [];
  const pick = () => Math.floor(rng() * n);
  for (const c of CROWN) {
    const area = c.rx * c.ry;
    const k = Math.min(1, c.rx / 220); // kleine Büschel: kleinere Stücke
    for (const [back, scale, density] of [[true, 1.55 * k, 1 / 52000 / k / k], [false, 1.2 * k, 1 / 40000 / k / k]]) {
      const count = Math.max(2, Math.round(area * density));
      for (let i = 0; i < count; i++) {
        const a = rng() * Math.PI * 2;
        const d = Math.sqrt(rng()) * (back ? 0.75 : 0.6);
        out.push({
          x: c.x + Math.cos(a) * c.rx * d,
          y: c.y + Math.sin(a) * c.ry * d + (back ? -20 : 15),
          i: pick(),
          s: scale * (0.85 + rng() * 0.3),
          flip: rng() < 0.5,
          back,
        });
      }
    }
  }
  // erst alle hinteren, dann die vorderen
  return out.sort((a, b) => (a.back === b.back ? 0 : a.back ? -1 : 1));
}
