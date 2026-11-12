import Sparkles from '../systems/particles.js';
import { DEPTH, TREE_SCALE, WORLD_W } from '../config/layout.js';
import { nextFairies } from '../state/house.js';
import { FAIRY_SCALE, FAIRIES_PER_ROOM } from './RoomLife.js';
import { rand, pick } from '../systems/motion.js';

const TRAVEL_SPEED = 800; // beim Wechseln zwischen Zimmern fliegen die Feen zügig
const STAY_MIN = 20; // so viele Sekunden bleibt eine Fee mindestens in einem Zimmer

// Die Bewohner des Feenhauses. Feen gehören dem ganzen Haus, nicht einem Zimmer:
//  - je eingerichtetem Zimmer ziehen FAIRIES_PER_ROOM Feen ein (zuerst in dieses Zimmer)
//  - ab und zu fliegt eine Fee, die gerade nichts tut, in ein anderes Zimmer (außen am Stamm entlang)
//  - wird ein Zimmer gelöscht, ziehen seine Feen um; überzählige Feen fliegen davon
// Im Zimmer lebt eine Fee im Raum-Container (RoomLife), unterwegs in einer eigenen Ebene in Weltkoordinaten.
// (Später: Tag/Nacht – von hier aus lassen sich alle Feen gleichzeitig ins Bett schicken.)
export default class Residents {
  constructor(scene) {
    this.scene = scene;
    this.layer = scene.add.container(0, 0).setDepth(DEPTH.fairy + 5);
    this.sparkles = new Sparkles(scene, this.layer);
    this.travelers = new Set();
    this.timer = 4;
  }

  get rooms() {
    return this.scene.rooms;
  }

  count() {
    return this.rooms.reduce((n, r) => n + r.life.fairies.length, 0) + [...this.travelers].filter((f) => !f.leaving).length;
  }

  target() {
    return this.rooms.filter((r) => r.counted).length * FAIRIES_PER_ROOM;
  }

  update(dt) {
    // neu eingerichtete Zimmer: Feen ziehen ein
    for (const room of this.rooms) {
      if (!room.counted && room.life.isFurnished()) {
        room.counted = true;
        nextFairies(FAIRIES_PER_ROOM).forEach((p, i) => room.life.moveIn(p, 600 + i * 1400));
      }
    }
    for (const f of this.travelers) f.update(dt);

    this.timer -= dt;
    if (this.timer <= 0) {
      this.timer = rand(2, 4);
      this.maybeTravel();
    }
  }

  // eine Fee, die schon eine Weile im Zimmer ist und gerade nichts tut, besucht ein anderes Zimmer
  maybeTravel() {
    if (this.rooms.length < 2) return;
    const now = this.scene.time.now / 1000;
    const idle = this.rooms.flatMap((room) =>
      room.life.fairies
        .filter((f) => f.state === 'wander' && !room.life.director.jobs.has(f) && now - (f.arrivedAt ?? 0) > STAY_MIN)
        .map((f) => ({ f, room })),
    );
    if (!idle.length || Math.random() < 0.4) return;
    const { f, room } = pick(idle);
    // lieber in Zimmer mit wenigen Feen
    const others = this.rooms.filter((r) => r !== room && !r.life.dead);
    const weights = others.map((r) => 1 / (1 + r.life.fairies.length));
    let x = Math.random() * weights.reduce((a, b) => a + b, 0);
    const to = others.find((r, i) => (x -= weights[i]) <= 0) || others[0];
    this.travel(f, room, to);
  }

  // Fee aus dem Zimmer in die Reise-Ebene holen (Weltkoordinaten)
  lift(f, room) {
    const w = room.view.toWorld(f.x, f.y);
    room.life.removeFairy(f);
    f.moveInto(this.layer, this, this.sparkles, FAIRY_SCALE * TREE_SCALE, w.x, w.y);
    f.state = 'script';
    this.travelers.add(f);
  }

  // Zimmer → Zimmer: zum Rand fliegen, außen herum, im Zielzimmer landen
  travel(f, from, to) {
    const g = from.view.geo;
    const side = to.x > from.x ? 1 : -1;
    f.goTo({ x: side > 0 ? g.innerRight - 40 : g.innerLeft + 40, y: g.floorY - 200 }, 260).then(() => {
      if (!from.life.fairies.includes(f)) return; // inzwischen hochgehoben o. Ä.
      this.lift(f, from);
      this.flyInto(f, to);
    });
  }

  flyInto(f, to) {
    if (!to || to.life.dead) {
      const alt = this.rooms.filter((r) => !r.life.dead);
      if (!alt.length) return this.leave(f);
      to = pick(alt);
    }
    const g = to.view.geo;
    const side = f.pos.x < to.x ? -1 : 1;
    const entry = to.view.toWorld(side > 0 ? g.innerRight - 40 : g.innerLeft + 40, g.floorY - 200);
    f.goTo(entry, TRAVEL_SPEED).then(() => {
      if (to.life.dead) return this.flyInto(f, null);
      this.travelers.delete(f);
      const l = to.view.toLocal(f.pos.x, f.pos.y);
      to.life.addFairy(f, l.x, l.y);
      const a = to.life.getWanderArea();
      f.goTo({ x: rand(a.x1, a.x2), y: rand(a.y1, a.y2) }, 260).then(() => {
        if (f.state === 'script') f.wander();
      });
    });
  }

  // überzählige Fee fliegt aus dem Baum davon
  leave(f) {
    f.leaving = true;
    const x = f.pos.x < WORLD_W / 2 ? -300 : WORLD_W + 300;
    f.goTo({ x, y: f.pos.y - 400 }, TRAVEL_SPEED).then(() => {
      this.travelers.delete(f);
      f.dropTrail();
      f.destroy();
    });
  }

  // Zimmer wird gelöscht: Feen ziehen um oder (wenn zu viele) fliegen davon
  evacuate(room) {
    for (const f of [...room.life.fairies]) {
      this.lift(f, room);
      if (this.count() > this.target()) this.leave(f);
      else this.flyInto(f, null);
    }
  }
}
