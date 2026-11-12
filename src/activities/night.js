import { CELL } from '../config/furniture.js';
import { pick } from '../systems/motion.js';
import sleep from './sleep.js';

// Nachtruhe: Schlafanzug an (am Kleiderschrank, wenn es einen gibt) → zum Schlafplatz → hinlegen und schlafen,
// bis es Morgen wird → nacheinander aufwachen, strecken, wieder anziehen.
// Den Schlafplatz verteilt das Haus (life/Residents.js → claimBed): Bett, sonst Sitzplatz, sonst Teppich, sonst Boden.
// spot = { tier, pose: 'bed' | 'seat' | 'lie', sticker?, side?, x? }
export default {
  id: 'night',
  icon: 'icon-bedroom',

  async run(c, spot) {
    const { f, life, scene, sparkles } = c;
    const clock = scene.clock;
    const valid = () => !spot.sticker || c.alive(spot.sticker);
    if (scene.textures.exists(this.icon)) c.think(this.icon, 1.2);
    await c.wait(0.4 + Math.random() * 1.4); // nicht alle auf einmal
    c.onAbort(() => f.setOutfit('dress')); // aufgeweckt: gleich wieder angezogen

    // Schlafanzug
    const wardrobe = pick(c.stickers('kleiderschrank').filter((w) => !c.director.reserved.has(w.item.uid)));
    if (wardrobe) await sleep.change(c, wardrobe, 'pj');
    else {
      sparkles.burst(f.x, f.y, 10);
      f.setOutfit('pj');
    }

    // hinlegen
    c.ensure(valid());
    let p = this.place(c, spot);
    await c.fly(p.x + 30 * p.face, p.y - 80);
    c.ensure(valid());
    p = this.place(c, spot);
    await c.fly(p.x, p.y, 90);
    c.ensure(valid());
    f.pose.face = p.face;
    f.pose.roll = p.roll;
    f.pose.fold = 1;
    f.pose.bob = 0.08;
    f.trail.setFrequency(4000);
    life.setSleeping(+1);
    let asleep = true;
    c.onAbort(() => asleep && life.setSleeping(-1));

    for (let i = 0; clock.night; i++) {
      await c.wait(0.75);
      c.ensure(valid());
      if (i % 2 === 0) sparkles.zzz(f.x + 10, f.y - 30);
    }

    // Morgen: nacheinander aufwachen und strecken
    await c.wait(Math.random() * 2.5);
    asleep = false;
    life.setSleeping(-1);
    f.resetPose();
    f.trail.setFrequency(110);
    await c.fly(f.pos.x + 20, f.pos.y - 70, 80);
    sparkles.twinkle(f.x, f.y, 4);
    await c.wait(0.4);
    const back = pick(c.stickers('kleiderschrank').filter((w) => !c.director.reserved.has(w.item.uid)));
    if (back) await sleep.change(c, back, 'dress');
    else f.setOutfit('dress');
  },

  // Liegeplatz in Raum-Koordinaten: x, y (Mitte der Fee), roll (−π/2 = liegt), face
  place(c, spot) {
    const s = spot.sticker;
    if (spot.pose === 'bed') {
      const pillow = s.artToLocal(s.def.pillow.x, s.def.pillow.y);
      return { x: pillow.x, y: pillow.y, roll: -Math.PI / 2, face: 1 };
    }
    if (spot.pose === 'seat') {
      const seat = s.def.surfaces?.[0]?.y ?? 0.8;
      return { x: s.x, y: s.y - seat * CELL - 26, roll: -0.35, face: 1 };
    }
    if (s) return { x: s.x + spot.side * 60, y: s.y - 18, roll: -Math.PI / 2 * spot.side, face: spot.side }; // Teppich
    return { x: spot.x, y: c.geo.floorY - 18, roll: -Math.PI / 2, face: 1 }; // Boden
  },
};
