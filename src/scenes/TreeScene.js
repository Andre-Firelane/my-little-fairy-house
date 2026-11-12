import Phaser from 'phaser';
import {
  GAME_W, GAME_H, BAR_TOP, BAR_H, WORLD_W, WORLD_H, MIN_ZOOM, MAX_ZOOM, START_ZOOM,
  SLOTS, DEPTH, COLORS, EDIT_ROOM_Y, SWATCH_Y, UI_W,
} from '../config/layout.js';
import { roomById } from '../config/rooms.js';
import Slot from '../objects/Slot.js';
import Room from '../objects/Room.js';
import Sparkles from '../systems/particles.js';
import Placement from '../systems/placement.js';
import { popIn, wobble } from '../systems/juice.js';
import { makeRng, clamp } from '../systems/motion.js';
import { paintTiles } from '../systems/bake.js';
import TREE_PARTS from '../config/tree.json';
import { BG_RES } from '../config/quality.js';
import { createRoom, house } from '../state/house.js';
import Residents from '../life/Residents.js';

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

  create() {
    this.drawTree();

    this.sparkles = new Sparkles(this);
    this.slots = SLOTS.map((d) => new Slot(this, d));
    this.placement = new Placement(this);
    this.registry.set('placement', this.placement);

    this.rooms = [];
    this.residents = new Residents(this); // alle Feen des Hauses (Einzug, Zimmerwechsel)
    this.mode = 'tree';
    this.activeRoom = null;
    this.placement.on('selection', (id) => this.slots.forEach((s) => s.setPulse(!!id)));

    // Kamera: eigener Zustand (Mitte + Zoom), wird in apply() auf die Phaser-Kamera übertragen
    this.camView = { x: WORLD_W / 2, y: 700, zoom: MIN_ZOOM };
    this.vel = { x: 0, y: 0 };
    this.applyView();
    this.setupInput();

    // Kamerafahrt von der Krone hinunter zu den ersten Höhlen
    this.flyTo({ x: WORLD_W / 2, y: 1950, zoom: START_ZOOM }, 2600, 500);

    this.scene.launch('Back');
    this.scene.launch('UI');

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
    if (!id) {
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

    const room = new Room(this, def, fromX, fromY, createRoom(slot.id, def, slot.geo), slot.geo).setScale(0.75);
    room.on('pointerup', () => {
      if (this.mode !== 'tree' || !this.drag || this.drag.moved || this.pinch || this.transitioning || slot.room !== room) return;
      this.openRoom(slot);
    });

    // Snap: zum Slot gleiten, dann elastisch aufploppen + Glitzer
    this.tweens.add({
      targets: room,
      x: slot.x,
      y: slot.y,
      duration: 260,
      ease: 'Cubic.Out',
      onComplete: () => {
        slot.room = room;
        popIn(this, room, { from: 0.7, to: 1, duration: 950 });
        this.sparkles.burst(slot.x, slot.y, 44);
        room.glowOn();
        // Feen ziehen erst ein, wenn das Zimmer eingerichtet ist (siehe RoomLife)
        this.rooms.push(room);
      },
    });
  }

  // ---------- Raum betreten / verlassen ----------

  // in den Raum hineinzoomen (so groß, wie zwischen Kopfzeile und Leiste Platz ist);
  // die Bedienung übernimmt die RoomEdit-Szene darüber
  // Kamera für die Großansicht eines Raums: so groß, wie zwischen Kopfzeile und Leiste Platz ist,
  // Raum-Mitte auf dem Bildschirm bei EDIT_ROOM_Y (unten ist die Leiste)
  roomView(slot) {
    const room = slot.room;
    const zoom = Math.min((GAME_W - 24) / room.w, (SWATCH_Y - 60 - 230) / room.h);
    return { x: slot.x, y: slot.y + (GAME_H / 2 - EDIT_ROOM_Y) / zoom, zoom };
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
  }

  // wieder herauszoomen in den Baum, dorthin, wo man vorher war
  closeRoom() {
    const room = this.activeRoom;
    this.transitioning = true;
    this.activeRoom = null;
    room?.light.setVisible(true);
    this.halos.forEach((h) => h.setVisible(true));
    this.scene.wake('UI');
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
    if (slot) slot.room = null;
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
    const y0 = 4600;
    const paint = (x0) => (ctx) => {
      const { grass, grassFront } = this.grassPatterns(ctx);
      meadow(ctx, grass, 4690, 22, x0, x0 + SIDE_MEADOW);
      meadow(ctx, grassFront, 4735, 14, x0, x0 + SIDE_MEADOW);
      const rng = makeRng(x0 < 0 ? 31 : 37);
      for (let i = 0; i < 80; i++) {
        ctx.fillStyle = ['#ffffff', '#ffd166', '#ff9ec7'][i % 3];
        ctx.beginPath();
        ctx.arc(x0 + rng() * SIDE_MEADOW, 4770 + rng() * 210, 6 + rng() * 5, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    const opts = { res: BG_RES, depth: DEPTH.tree, y0 };
    this.sideMeadows = [
      ...paintTiles(this, 'meadow-left', SIDE_MEADOW, WORLD_H - y0, paint(-SIDE_MEADOW), { ...opts, x0: -SIDE_MEADOW }),
      ...paintTiles(this, 'meadow-right', SIDE_MEADOW, WORLD_H - y0, paint(WORLD_W), { ...opts, x0: WORLD_W }),
    ];
  }

  drawTree() {
    const bark = this.textures.get('tree-rinde-1').getSourceImage();
    const crowns = TREE_PARTS_KEYS.map((k) => this.textures.get(k).getSourceImage());
    const shaded = crowns.map((img) => darken(img, 'rgba(25, 45, 40, 0.28)'));
    const pieces = crownLayout(crowns.length);
    paintTiles(this, 'tree', WORLD_W, WORLD_H, (ctx) => {
      const rng = makeRng(11);
      const barkFill = ctx.createPattern(bark, 'repeat');
      barkFill.setTransform(new DOMMatrix().scale(0.8));
      const { grass, grassFront } = this.grassPatterns(ctx);
      const outline = '#4a2a18';

      // Wiese hinter dem Baum (gemalter Rasen, leicht hügelige Oberkante)
      meadow(ctx, grass, 4690, 22);

      // Äste (stecken in der Krone): dunkle Kante, darüber Rinde
      const branch = (x0, y0, x1, y1, wdt) => {
        ctx.lineCap = 'round';
        ctx.strokeStyle = outline;
        ctx.lineWidth = wdt + 14;
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        ctx.strokeStyle = barkFill;
        ctx.lineWidth = wdt;
        ctx.stroke();
      };
      branch(900, 1200, 420, 650, 120);
      branch(1500, 1200, 1980, 620, 120);
      branch(1200, 1150, 1200, 420, 130);
      branch(640, 860, 300, 760, 80);
      branch(1760, 840, 2120, 780, 80);

      // Stamm mit Wurzeln: weiche Kontur, Rinde, seitlich abgedunkelt (wirkt rund)
      ctx.beginPath();
      TRUNK.forEach((p, i) => {
        const n = TRUNK[(i + 1) % TRUNK.length];
        const mx = (p.x + n.x) / 2;
        const my = (p.y + n.y) / 2;
        if (i === 0) ctx.moveTo(mx, my);
        else ctx.quadraticCurveTo(p.x, p.y, mx, my);
      });
      const p0 = TRUNK[0];
      const n0 = TRUNK[1];
      ctx.quadraticCurveTo(p0.x, p0.y, (p0.x + n0.x) / 2, (p0.y + n0.y) / 2);
      ctx.closePath();
      ctx.lineWidth = 16;
      ctx.strokeStyle = outline;
      ctx.stroke();
      ctx.fillStyle = barkFill;
      ctx.fill();
      const shade = ctx.createLinearGradient(420, 0, 1990, 0);
      shade.addColorStop(0, 'rgba(40, 20, 10, 0.5)');
      shade.addColorStop(0.18, 'rgba(40, 20, 10, 0)');
      shade.addColorStop(0.8, 'rgba(40, 20, 10, 0)');
      shade.addColorStop(1, 'rgba(40, 20, 10, 0.55)');
      ctx.fillStyle = shade;
      ctx.fill();

      // Grassaum vor den Wurzeln: der Baum steht im Gras, nicht darauf
      meadow(ctx, grassFront, 4735, 14);
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle = ['#ffffff', '#ffd166', '#ff9ec7'][i % 3];
        ctx.beginPath();
        ctx.arc(rng() * WORLD_W, 4770 + rng() * 210, 6 + rng() * 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Krone: hinten dunkler, vorne hell
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
    }, { res: BG_RES, depth: DEPTH.tree });
    this.halos = []; // Lichter hängen jetzt gemalt an der Krone
  }
}

// gemalte Kronenstücke (tools/import-sprites.py → public/assets/tree)
const TREE_PARTS_KEYS = Array.from({ length: TREE_PARTS.krone }, (_, i) => `tree-krone-${i + 1}`);

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

// Stammumriss (Weltkoordinaten), wird weich gerundet gezeichnet
const TRUNK = [
  { x: 560, y: 760 }, { x: 1840, y: 760 }, { x: 1930, y: 1150 }, { x: 1950, y: 2000 }, { x: 1960, y: 3000 }, { x: 1970, y: 4150 },
  { x: 2070, y: 4480 }, { x: 2350, y: 4720 }, { x: 1750, y: 4690 }, { x: 1200, y: 4740 }, { x: 680, y: 4690 },
  { x: 50, y: 4720 }, { x: 330, y: 4480 }, { x: 430, y: 4150 }, { x: 440, y: 3000 }, { x: 450, y: 2000 }, { x: 470, y: 1150 },
];

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

// Anordnung der Kronenstücke: große Wolken in drei Schichten. Die unterste Reihe hängt tief über die Oberkante
// des Stamms (und seine Schultern), damit der Stamm nahtlos in der Krone verschwindet – liegt aber hinter den Zimmern.
function crownLayout(n) {
  const rng = makeRng(23);
  const out = [];
  const inside = (x, y) => ((x - 1200) / 1150) ** 2 + ((y - 640) / 640) ** 2 < 1;
  const pick = () => Math.floor(rng() * n);
  const layer = (stepX, stepY, back, scale, y0, y1, ellipse = true) => {
    for (let y = y0, row = 0; y <= y1; y += stepY, row++) {
      for (let x = 120 + (row % 2) * (stepX / 2); x < 2320; x += stepX) {
        const px = x + (rng() - 0.5) * stepX * 0.35;
        const py = y + (rng() - 0.5) * stepY * 0.35;
        if (ellipse && !inside(px, py)) continue;
        out.push({ x: px, y: py, i: pick(), s: scale * (0.9 + rng() * 0.25), flip: rng() < 0.5, back });
      }
    }
  };
  layer(640, 400, true, 2.5, 160, 1100); // hinten: sehr groß, dunkler
  layer(600, 380, false, 2.1, 260, 1000); // Mitte
  layer(430, 120, false, 1.8, 1020, 1140, false); // unten: Saum über der Stammoberkante
  return out;
}
