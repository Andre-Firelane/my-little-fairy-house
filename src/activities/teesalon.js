import { textureKey } from '../config/furniture.js';
import { TEA_ART } from '../config/teesalon.js';
import { bake } from '../systems/bake.js';
import { popIn, squish } from '../systems/juice.js';
import { clamp, rand } from '../systems/motion.js';

// Teesalon: Teestunde – das Erste, was Feen GEMEINSAM machen.
// Die Gastgeberin holt die Teekanne, stellt Tassen auf den Pilztisch und schenkt ein. Freie Feen im Zimmer
// kommen dazu (bis zu drei Gäste), jede nimmt sich eine Tasse und trinkt mit. Am Ende glitzert es über dem Tisch.

const FAIRY_RES = 2;
const CUPS = ['tea-cup', 'tea-cup-2', 'tea-cup-3', 'tea-cup-4'];
const SIPS = 8;

function cupImage(c, key, x, y) {
  const a = TEA_ART[key];
  bake(c.scene, key, a.w, a.h, a.draw, a.ox, a.oy, FAIRY_RES);
  const img = c.scene.make.image({ x, y, key }, false).setOrigin(a.ox / a.w, a.oy / a.h).setScale(1 / FAIRY_RES);
  c.view.items.add(img);
  return img;
}

// Platz am Tisch (Raum-Koordinaten), nicht außerhalb des Zimmers
function seatPos(c, table, seat) {
  const p = table.artToLocal(seat.x, seat.y);
  const g = c.geo;
  return { x: clamp(p.x, g.innerLeft + 50, g.innerRight - 50), y: p.y };
}

// gemeinsamer Teil von Gastgeberin und Gästen: hinsetzen, Tasse nehmen, schlückchenweise trinken, zurückstellen
async function sipTea(c, table, seat, cup) {
  const { f, sparkles, scene } = c;
  const ok = () => c.alive(table) && cup.active;
  const s = () => seatPos(c, table, seat);
  await c.fly(s().x, s().y - 40);
  c.ensure(ok());
  await c.fly(s().x, s().y, 100);
  c.ensure(ok());
  f.pose.fold = 0.8;
  f.pose.bob = 0.2;
  f.pose.face = s().x < table.x ? 1 : -1;
  const home = { x: cup.x, y: cup.y };
  c.onAbort(() => cup.active && cup.setPosition(home.x, home.y).setAngle(0)); // Tasse nicht in der Luft lassen

  // Tasse in die Hand
  await new Promise((r) => scene.tweens.add({ targets: cup, x: f.x + 26 * f.pose.face, y: f.y + 34, duration: 400, ease: 'Sine.Out', onComplete: r }));
  c.ensure(ok());
  f.carry(cup, 34);
  for (let i = 0; i < SIPS; i++) {
    await c.wait(0.7);
    c.ensure(ok());
    f.pose.tilt = i % 2 ? 0.3 : 0.05; // Schlückchen
    if (i % 2 === 0) sparkles.bubbles(cup.x, cup.y - 24, 0xffffff, 2); // Dampf
  }
  f.pose.tilt = 0;
  f.dropCarry();
  cup.setAngle(0);
  await new Promise((r) => scene.tweens.add({ targets: cup, x: home.x, y: home.y, duration: 400, ease: 'Sine.Out', onComplete: r }));
  sparkles.twinkle(f.x, f.y - 30, 4);
  f.resetPose();
}

// Gast: wird gleich zu Beginn eingeladen (nie selbst ausgesucht, siehe uses), setzt sich an den Tisch und
// wartet, bis die Gastgeberin ihre Tasse eingeschenkt hat
const teaGuest = {
  id: 'teaGuest',
  icon: textureKey('teetisch'),
  uses: () => false,
  async run(c, { table, seat, party, i }) {
    const { f } = c;
    await c.wait(rand(0.1, 0.5));
    const s = () => seatPos(c, table, seat);
    await c.fly(s().x, s().y - 40);
    c.ensure(c.alive(table) && !party.over);
    await c.fly(s().x, s().y, 100);
    f.pose.fold = 0.8;
    f.pose.bob = 0.2;
    f.pose.face = s().x < table.x ? 1 : -1;
    for (let k = 0; !party.cups[i]; k++) {
      c.ensure(k < 80 && c.alive(table) && !party.over);
      await c.wait(0.25);
    }
    await sipTea(c, table, seat, party.cups[i]);
    await c.wait(0.4);
  },
};

export const tea = {
  id: 'tea',
  icon: textureKey('teetisch'),
  uses: (def) => !!def.teatable,
  wishAlso: (def) => !!def.teapot || !!def.cupSet,

  async run(c, table) {
    const { f, scene, sparkles, director } = c;
    const T = table.def.teatable;
    const party = { cups: [], over: false };
    const all = []; // alle Tassen (beim Abbruch weg); party.cups[i] gibt es erst, wenn eingeschenkt ist
    c.onAbort(() => {
      party.over = true;
      all.forEach((cup) => cup.destroy());
    });

    // Gäste gleich einladen: freie Feen im Zimmer (ohne Wunsch, nicht beschäftigt) setzen sich an den Tisch
    const started = [];
    for (const g of c.life.fairies) {
      if (started.length >= T.seats.length - 1) break;
      if (g === f || g.state !== 'wander' || director.jobs.has(g) || g.need) continue;
      const i = started.length + 1;
      if (director.startJob(g, teaGuest, { table, seat: T.seats[i], party, i })) {
        started.push(director.jobs.get(g));
        sparkles.twinkle(g.x, g.y - 20, 3);
      }
    }

    // Teekanne holen (ohne Kanne: der Zauberstab schenkt ein)
    const pot = director.free((s) => s.def.teapot)[0];
    let home = null;
    if (pot) {
      c.reserve(pot.item.uid);
      const t = c.top(pot);
      await c.fly(t.x, t.y - 30);
      c.ensure(c.alive(pot));
      home = { gx: pot.item.gx, gy: pot.item.gy, parent: pot.item.parent };
      c.pickUp(pot);
    }

    // Tassen auf den Tisch und einschenken
    const n = started.length + 1;
    for (let i = 0; i < n; i++) {
      c.ensure(c.alive(table));
      const p = table.artToLocal(T.cups[i], T.top);
      await c.fly(p.x + 40, p.y - 90, 200);
      c.ensure(c.alive(table));
      const cup = cupImage(c, CUPS[i], p.x, p.y);
      all.push(cup);
      popIn(scene, cup, { from: 0, to: cup.scale, duration: 450 });
      f.pose.face = -1;
      f.pose.tilt = 0.45;
      for (let k = 0; k < 4; k++) {
        const drop = scene.make.image({ x: f.x - 34, y: f.y + 30, key: 'drop' }, false).setTint(0xb86a32).setScale(0.5);
        c.view.items.add(drop);
        c.temp.push(drop);
        scene.tweens.add({
          targets: drop,
          x: p.x,
          y: p.y - 22,
          duration: 260,
          ease: 'Quad.In',
          onComplete: () => {
            c.temp = c.temp.filter((o) => o !== drop);
            drop.destroy();
          },
        });
        await c.wait(0.16);
      }
      f.pose.tilt = 0;
      sparkles.bubbles(p.x, p.y - 26, 0xffffff, 3);
      party.cups[i] = cup; // jetzt darf der Gast zugreifen
    }
    f.pose.face = 0;

    // Kanne auf den Tisch stellen (sonst zurück an ihren Platz)
    if (pot && c.carried === pot) {
      const def = pot.def;
      let spot = c.placeNear(def, table) || (c.isFree(def, home) ? home : null);
      if (spot) {
        const p = c.spotPos(spot, def);
        await c.fly(p.x, p.y - pot.H - 20);
        if (!c.isFree(def, spot)) spot = c.freeSpot(def);
      }
      if (spot) c.putDown(spot);
      else c.dissolveCarried();
    }

    // selbst mittrinken
    await sipTea(c, table, T.seats[0], party.cups[0]);

    // warten, bis alle ausgetrunken haben (höchstens ein paar Sekunden)
    for (let i = 0; i < 20 && started.some((j) => director.jobs.get(j.f) === j); i++) await c.wait(0.3);

    // gemeinsamer Abschluss: Glitzer über dem Tisch, die Tassen verschwinden
    const mid = table.artToLocal(table.W / 2, T.top - 40);
    party.over = true;
    sparkles.burst(mid.x, mid.y, 24);
    if (c.alive(table)) squish(scene, table, { amount: 0.04 });
    for (const cup of all) {
      scene.tweens.add({ targets: cup, scale: 0, alpha: 0, duration: 350, ease: 'Back.In', onComplete: () => cup.destroy() });
    }
    f.pose.bob = 2;
    await c.wait(0.9);
  },
};

export { teaGuest };
