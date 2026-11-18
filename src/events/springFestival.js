import Phaser from 'phaser';
import { DEPTH, GAME_W, GAME_H, WORLD_W } from '../config/layout.js';
import { OX, OY, crownLayout } from '../config/treeShape.js';
import TREE_PARTS from '../config/tree.json';
import { grow } from '../activities/garden.js';
import { bake } from '../systems/bake.js';
import { makeRng, rand, pick } from '../systems/motion.js';
import { track, smoothPath, ring } from './paths.js';

// Event „Frühlingsfest“ (am Tag):
//  1. Wind und Blüten: ein warmer Wind weht Blütenblätter durchs Bild, die Krone blüht nach und nach rosa auf.
//  2. Tanz in der Luft: alle Feen fliegen aus ihren Zimmern und tanzen in zwei Kreisen um Krone und Stamm.
//  3. Blumenkränze: die Feen treffen sich in einem Kreis vor der Krone, eine nach der anderen flicht sich aus
//     herbeifliegenden Blüten einen Kranz und setzt ihn auf. Gleichzeitig wachsen im Balkon-Garten alle Pflanzen
//     eine Stufe.
//  4. Heimweg: die Feen fliegen mit ihren Kränzen in die Zimmer, der Blütenregen hört auf. Die Blüten bleiben noch
//     eine Weile in der Krone und fallen dann sacht ab; dann nehmen die Feen die Kränze ab.
// Gehört der Baum-Szene (TreeScene.happening); wird nicht gespeichert.

const BLOOM_TIME = 9; // so lange blüht die Krone auf, bevor die Feen herauskommen
const READY_MAX = 8; // so lange warten die Tänzerinnen höchstens, bis alle an ihrem Platz sind
const DANCE_TIME = 32;
const DANCE_SPEED = 210;
const WEAVE_GAP = 0.9; // Sekunden zwischen den Feen beim Kranzflechten
const HOME_MAX = 14;
const LINGER = 45; // so lange bleibt die Krone nach dem Heimflug in Blüte
const FALL_TIME = 6;
const MAX_BLOSSOMS = 240;

const PINKS = [0xffc2dc, 0xffffff, 0xff9ec7];

// Baum-Koordinaten → Welt
const W = (x, y) => ({ x: x + OX, y: y + OY });

// Blütenbüschel (3 Farbvarianten): drei, vier Blüten mit gelber Mitte, ein paar Knospen
function bakeArt(scene) {
  PINKS.forEach((petal, v) => {
    bake(scene, `spring-blossom-${v}`, 70, 60, (g) => {
      const rng = makeRng(5 + v);
      const flowers = [[22, 26, 11], [44, 22, 12], [34, 40, 10], [52, 40, 8]];
      for (const [x, y, r] of flowers) {
        for (let i = 0; i < 5; i++) {
          const a = -Math.PI / 2 + (i / 5) * Math.PI * 2 + rng();
          g.fillStyle(petal, 1);
          g.fillCircle(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.55);
        }
        g.fillStyle(v === 1 ? 0xffd6e7 : 0xffffff, 1);
        g.fillCircle(x, y, r * 0.38);
        g.fillStyle(0xffd166, 1);
        g.fillCircle(x, y, r * 0.2);
      }
      g.fillStyle(0xff7ab8, 1);
      g.fillEllipse(12, 42, 7, 9);
      g.fillEllipse(60, 14, 6, 8);
    });
  });
  // einzelnes Blütenblatt (Wind, fallende Blüten)
  bake(scene, 'spring-petal', 26, 18, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(13, 9, 22, 13);
    g.fillStyle(0xffffff, 0.6);
    g.fillEllipse(10, 7, 9, 4);
  }, 0, 0, 1.5);
}

export default class SpringFestival {
  constructor(scene) {
    this.scene = scene;
    this.id = 'spring';
    this.t = 0;
    this.phase = 'bloom';
    this.phaseT = 0;
    this.done = false;
    this.crew = [];
    scene.clock.paused = true; // am Tag: die Uhr steht, solange gefeiert wird
    bakeArt(scene);

    this.layer = scene.add.container(0, 0).setDepth(DEPTH.slot - 0.5); // über der Krone, unter den Zimmern
    this.makeBlossoms();
    this.makeWind();

    if (scene.mode === 'tree') scene.flyTo({ x: WORLD_W / 2, y: 1750, zoom: 0.45 }, 1800);
  }

  get residents() {
    return this.scene.residents;
  }

  // ---------- Krone und Wind ----------

  // Blüten auf die vorderen Kronenstücke, nacheinander aufgehend
  makeBlossoms() {
    const rng = makeRng(77);
    const front = crownLayout(TREE_PARTS.krone).filter((p) => !p.back);
    const spots = [];
    for (const pc of front) {
      const r = 200 * pc.s;
      for (let k = 0; k < 3; k++) spots.push(W(pc.x + (rng() - 0.5) * r * 1.3, pc.y + (rng() - 0.6) * r));
    }
    // gleichmäßig ausdünnen, wenn es zu viele sind
    const step = Math.max(1, spots.length / MAX_BLOSSOMS);
    const chosen = [];
    for (let i = 0; i < spots.length && chosen.length < MAX_BLOSSOMS; i += step) chosen.push(spots[Math.floor(i)]);
    chosen.sort(() => rng() - 0.5);
    this.blossoms = chosen.map((p, i) => {
      const img = this.scene.add.image(p.x, p.y, `spring-blossom-${i % 3}`).setScale(0).setAngle(rand(-25, 25));
      img.full = rand(1.9, 2.6);
      this.layer.add(img);
      this.scene.time.delayedCall(300 + (i / chosen.length) * (BLOOM_TIME - 1.5) * 1000, () => {
        if (!img.active) return;
        this.scene.tweens.add({ targets: img, scale: img.full, duration: 500, ease: 'Back.Out' });
        if (i % 6 === 0) this.scene.sparkles.twinkle(p.x, p.y, 2);
      });
      return img;
    });
  }

  // Blütenblätter im Wind: fliegen schräg von links oben nach rechts unten durch den sichtbaren Ausschnitt
  makeWind() {
    this.windZone = new Phaser.Geom.Rectangle(0, 0, 10, 10);
    const zoom = () => this.scene.camView?.zoom ?? 0.5;
    this.wind = this.scene.add
      .particles(0, 0, 'spring-petal', {
        frequency: 45,
        lifespan: 7000,
        speedX: { min: 70, max: 180 },
        speedY: { min: 40, max: 110 },
        rotate: { start: 0, end: 540 },
        scaleX: { onEmit: () => rand(0.8, 1.2) / zoom() * 0.45 },
        scaleY: { onEmit: () => rand(0.5, 1) / zoom() * 0.45 },
        alpha: { start: 0.95, end: 0.2 },
        tint: PINKS,
        emitZone: { type: 'random', source: this.windZone },
      })
      .setDepth(DEPTH.room - 0.5); // nicht vor den Innenräumen
    this.followView();
  }

  // Wind-Bereich: links oben vom sichtbaren Ausschnitt bis in seine Mitte (die Blätter wehen hinein)
  followView() {
    const v = this.scene.camView;
    if (!v) return;
    const w = GAME_W / v.zoom;
    const h = GAME_H / v.zoom;
    this.windZone.setTo(v.x - w * 0.75, v.y - h * 0.75, w * 1.1, h * 1.1);
  }

  // ---------- Ablauf ----------

  update(dt) {
    if (this.done) return;
    this.t += dt;
    this.phaseT += dt;
    this.followView();
    // Blüten wiegen sich im Wind
    for (const [i, b] of this.blossoms.entries()) if (b.active) b.rotation = Math.sin(this.t * 1.4 + i) * 0.12;
    const ph = this.phase;
    if (ph === 'bloom' && this.phaseT >= BLOOM_TIME) this.gather();
    else if (ph === 'lineup') this.lineup();
    else if (ph === 'dance') this.dance(dt);
    else if (ph === 'weave') this.weave();
    else if (ph === 'home') this.goingHome();
    else if (ph === 'linger' && this.phaseT >= LINGER) this.fall();
  }

  setPhase(p) {
    this.phase = p;
    this.phaseT = 0;
  }

  // ---------- Tanz ----------

  // alle Feen fliegen heraus und stellen sich auf zwei Kreisen auf (um die Krone, um den oberen Stamm)
  gather() {
    this.setPhase('lineup');
    this.rings = [
      track(smoothPath(ring(W(1220, 180).x, W(1220, 180).y, 1050, 420, 12)), true),
      track(smoothPath(ring(W(1200, 1420).x, W(1200, 1420).y, 900, 150, 12)), true),
    ];
    for (const room of this.scene.rooms) {
      if (room.life.dead) continue;
      for (const f of [...room.life.fairies]) {
        if (f.state === 'held') continue;
        this.crew.push({ f, home: room });
        this.residents.lift(f, room);
      }
    }
    // abwechselnd auf die Kreise, auf jedem gleichmäßig verteilt
    const per = [[], []];
    this.crew.forEach((c, i) => per[i % 2].push(c));
    per.forEach((list, r) => {
      list.forEach((c, k) => {
        c.ring = this.rings[r];
        c.dir = r ? -1 : 1; // die Kreise drehen gegeneinander
        c.s = (k / list.length) * c.ring.length;
        c.ready = false;
        c.f.goTo(c.ring.at(c.s), 700).then(() => {
          c.ready = true;
        });
      });
    });
    if (!this.crew.length) this.startHome();
  }

  lineup() {
    if (this.crew.every((c) => c.ready || !c.f.active) || this.phaseT > READY_MAX) {
      for (const c of this.crew) if (c.f.active) c.f.hold();
      this.setPhase('dance');
    }
  }

  dance(dt) {
    for (const [i, c] of this.crew.entries()) {
      if (!c.f.active) continue;
      c.s += DANCE_SPEED * c.dir * dt;
      const p = c.ring.at(c.s);
      c.f.pos = { x: p.x, y: p.y + Math.sin(this.t * 3 + i * 1.3) * 26 };
      if (Math.random() < dt * 0.8) this.scene.sparkles.twinkle(p.x, p.y, 2);
    }
    if (this.phaseT > DANCE_TIME) this.startWeave();
  }

  // ---------- Blumenkränze ----------

  startWeave() {
    this.setPhase('weave');
    const n = this.crew.length;
    const mid = W(1220, 420);
    const rx = Math.min(760, 110 + n * 70);
    this.crew.forEach((c, i) => {
      if (!c.f.active) return;
      const a = Math.PI + (i / Math.max(1, n)) * Math.PI * 2;
      c.spot = { x: mid.x + Math.cos(a) * rx, y: mid.y + Math.sin(a) * 140 };
      c.f.goTo(c.spot, 600).then(() => c.f.active && c.f.hold());
      c.weaveAt = 2.5 + i * WEAVE_GAP;
    });
    this.bloomGardens();
  }

  weave() {
    for (const c of this.crew) {
      if (c.woven || this.phaseT < c.weaveAt) continue;
      c.woven = true;
      if (c.f.active) this.weaveFor(c.f);
    }
    if (this.crew.every((c) => c.woven) && this.phaseT > (this.crew.at(-1)?.weaveAt ?? 0) + 2.5) this.startHome();
  }

  // Blüten fliegen aus der Krone zur Fee, dann sitzt der Kranz auf dem Kopf
  weaveFor(f) {
    const scene = this.scene;
    const open = this.blossoms.filter((b) => b.active && b.scale > 0.5);
    for (let k = 0; k < 5; k++) {
      const from = open.length ? pick(open) : { x: f.x, y: f.y - 300 };
      const p = scene.add.image(from.x, from.y, 'spring-petal').setTint(pick(PINKS)).setScale(1.6).setDepth(DEPTH.fx);
      scene.tweens.add({
        targets: p,
        x: f.x + rand(-10, 10),
        y: f.y - 30,
        angle: rand(200, 500),
        scale: 0.6,
        duration: 650 + k * 90,
        ease: 'Sine.InOut',
        onComplete: () => p.destroy(),
      });
    }
    scene.time.delayedCall(1150, () => {
      if (!f.active) return;
      f.setWreath(true);
      scene.sparkles.burst(f.x, f.y - 30, 12);
    });
  }

  // Balkon-Gärten: alle Pflanzen wachsen eine Stufe (reife bleiben reif)
  bloomGardens() {
    let delay = 0;
    for (const room of this.scene.rooms) {
      if (room.life.dead || !room.def.open) continue;
      for (const s of room.view.stickers.values()) {
        if (!s.def.plant || s.item.state === 'g3') continue;
        this.scene.time.delayedCall((delay += 180), () => s.active && grow(this.scene, s, room.life.sparkles));
      }
    }
  }

  // ---------- Heimweg, Ausklang ----------

  startHome() {
    this.setPhase('home');
    this.wind.stop();
    for (const c of this.crew) {
      if (!c.f.active) continue;
      c.away = true;
      this.residents.flyInto(c.f, c.home, () => {
        c.away = false;
        return false;
      });
    }
  }

  goingHome() {
    if (this.crew.every((c) => !c.away || !c.f.active) || this.phaseT > HOME_MAX) this.setPhase('linger');
  }

  // die Blüten fallen nach und nach ab, dann ist das Fest vorbei
  fall() {
    this.setPhase('falling');
    const scene = this.scene;
    this.blossoms.forEach((b) => {
      if (!b.active) return;
      scene.tweens.add({
        targets: b,
        y: b.y + rand(80, 220),
        x: b.x + rand(20, 120),
        alpha: 0,
        scale: b.scale * 0.6,
        delay: rand(0, (FALL_TIME - 2) * 1000),
        duration: 1800,
        ease: 'Sine.In',
      });
    });
    scene.time.delayedCall(FALL_TIME * 1000, () => this.end());
  }

  end() {
    if (this.done) return;
    this.done = true;
    this.scene.clock.paused = false;
    for (const c of this.crew) if (c.f.active) c.f.setWreath(false);
    this.layer.destroy();
    this.wind.destroy();
  }
}
