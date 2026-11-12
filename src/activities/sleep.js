import { textureKey } from '../config/furniture.js';
import { pick } from '../systems/motion.js';

// Schlafen: (Schlafanzug aus dem Kleiderschrank anziehen) → (Nachtlicht anmachen) → ins Bett legen,
// Zs steigen auf, der Raum wird dunkel → aufwachen, strecken → (Licht aus, wenn sonst niemand schläft)
// → (im Schrank wieder umziehen). Alles in Klammern nur, wenn es den Gegenstand im Raum gibt.
export default {
  id: 'sleep',
  icon: textureKey('bett'),
  uses: (def) => def.id === 'bett',

  async run(c, bed) {
    const { f, life } = c;
    c.think(this.icon, 1.6);
    await c.wait(1);
    c.onAbort(() => f.setOutfit('dress')); // hochgehoben: gleich wieder angezogen

    // Schlafanzug anziehen
    const wardrobe = pick(c.stickers('kleiderschrank'));
    if (wardrobe) await this.change(c, wardrobe, 'pj');
    else f.setOutfit('pj');

    // Nachtlicht anmachen
    const lamp = c.director.free((s) => s.def.id === 'nachtlicht' && s.item.state !== 'on')[0];
    if (lamp) {
      c.reserve(lamp.item.uid);
      const t = c.top(lamp);
      await c.fly(t.x + 30, t.y - 30);
      c.ensure(c.alive(lamp));
      c.setState(lamp, 'on');
      c.sparkles.twinkle(t.x, t.y + 20, 5);
      await c.wait(0.5);
    }

    // ins Bett: Kopf aufs Kissen, quer hinlegen
    c.ensure(c.alive(bed));
    const pillow = bed.artToLocal(bed.def.pillow?.x ?? 90, bed.def.pillow?.y ?? 64);
    await c.fly(pillow.x + 40, pillow.y - 70);
    c.ensure(c.alive(bed));
    await c.fly(pillow.x, pillow.y, 90);
    f.pose.face = 1;
    f.pose.roll = -Math.PI / 2;
    f.pose.fold = 1;
    f.pose.bob = 0.08;
    f.trail.setFrequency(4000);
    life.setSleeping(+1);
    let asleep = true;
    c.onAbort(() => asleep && life.setSleeping(-1));

    for (let i = 0; i < 16; i++) {
      await c.wait(0.75);
      c.ensure(c.alive(bed));
      if (i % 2 === 0) c.sparkles.zzz(f.x + 10, f.y - 34);
    }

    // aufwachen und strecken
    asleep = false;
    life.setSleeping(-1);
    f.resetPose();
    f.trail.setFrequency(110);
    await c.fly(f.pos.x + 20, f.pos.y - 60, 80);
    c.sparkles.twinkle(f.x, f.y, 4);
    await c.wait(0.4);

    // Licht wieder aus, wenn niemand mehr schläft
    if (lamp && c.alive(lamp) && life.sleepers === 0) {
      const t = c.top(lamp);
      await c.fly(t.x + 30, t.y - 30);
      if (c.alive(lamp)) c.setState(lamp, null);
      await c.wait(0.3);
    }

    // wieder umziehen
    const back = pick(c.stickers('kleiderschrank'));
    if (back) await this.change(c, back, 'dress');
    else f.setOutfit('dress');
  },

  // vor dem Schrank: Türen auf, Glitzer-Puff, neue Kleidung, Türen zu
  async change(c, wardrobe, outfit) {
    const { f } = c;
    const front = wardrobe.artToLocal(80, 130);
    await c.fly(front.x, front.y);
    if (!c.alive(wardrobe)) return f.setOutfit(outfit);
    c.setState(wardrobe, 'open');
    await c.wait(0.5);
    c.sparkles.burst(f.x, f.y, 14);
    f.setOutfit(outfit);
    await c.wait(0.6);
    if (c.alive(wardrobe)) c.setState(wardrobe, null);
    await c.wait(0.3);
  },
};
