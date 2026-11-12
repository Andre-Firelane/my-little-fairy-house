import { textureKey } from '../config/furniture.js';
import { squish } from '../systems/juice.js';
import { pick, rand } from '../systems/motion.js';

// Musikzimmer: Instrumente spielen, tanzen, Disco.

// Spielen: Harfe/Klavier im Sitzen; Laute, Flöte, Trompete nimmt die Fee in die Hand, spielt (gern auf der
// Tanzfläche) und stellt sie danach zurück. Bunte Noten steigen auf.
export const play = {
  id: 'play',
  icon: textureKey('piano'),
  uses: (def) => !!def.instrument,

  async run(c, inst) {
    const { f, sparkles, scene } = c;
    const def = inst.def;
    const I = def.instrument;
    c.think(textureKey(def.id), 1.5);
    await c.wait(1);

    if (I.mode === 'sit') {
      const seat = () => inst.artToLocal(I.at.x, I.at.y);
      await c.fly(seat().x, seat().y - 50);
      c.ensure(c.alive(inst));
      await c.fly(seat().x, seat().y, 100);
      c.ensure(c.alive(inst));
      f.pose.face = I.face ?? 1;
      f.pose.bob = 0.25;
      f.pose.tilt = 0.12;
      f.pose.fold = 0.4;
      for (let i = 0; i < 16; i++) {
        await c.wait(0.45);
        c.ensure(c.alive(inst));
        const n = inst.artToLocal(I.notes.x, I.notes.y);
        sparkles.notes(n.x + rand(-40, 40), n.y, I.color, 1);
        if (i % 4 === 0) squish(scene, inst, { amount: 0.03, duration: 140 });
        f.pose.tilt = i % 2 ? 0.2 : 0.06; // im Takt wippen
      }
      return;
    }

    // in die Hand nehmen
    const t = c.top(inst);
    await c.fly(t.x, t.y - 30);
    c.ensure(c.alive(inst));
    const home = { gx: inst.item.gx, gy: inst.item.gy, parent: inst.item.parent };
    c.pickUp(inst);
    f.carry(inst, I.dy);

    // Bühne: über der Tanzfläche, sonst irgendwo im Raum
    const stage = pick(c.stickers('tanzflaeche'));
    const a = c.life.getWanderArea();
    const to = stage ? { x: stage.x + rand(-100, 100), y: stage.y - 120 } : { x: rand(a.x1, a.x2), y: rand(a.y1, a.y2) };
    await c.fly(to.x, to.y);
    f.pose.bob = 0.6;
    f.pose.face = 1;
    for (let i = 0; i < 16; i++) {
      await c.wait(0.45);
      sparkles.notes(f.x + 30 * f.facing + rand(-10, 10), f.y, I.color, 1);
      if (i % 4 === 3) f.pose.face = -f.pose.face; // beim Spielen hin- und herdrehen
    }
    f.resetPose();

    // zurückstellen (an den alten Platz, wenn der noch frei ist)
    const spot = c.isFree(def, home) ? home : c.placeNear(def, null);
    if (!spot) return c.dissolveCarried();
    const p = c.spotPos(spot, def);
    await c.fly(p.x, p.y - inst.H - 20);
    c.putDown(spot);
  },
};

// Tanzen auf der Tanzfläche: die Felder leuchten, die Fee hüpft und dreht sich
export const dance = {
  id: 'dance',
  icon: textureKey('tanzflaeche'),
  uses: (def) => !!def.dancefloor,

  async run(c, floor) {
    const { f, sparkles } = c;
    c.think(textureKey('tanzflaeche', 0, 'on'), 1.4);
    await c.wait(0.9);
    await c.fly(floor.x, floor.y - 110);
    c.ensure(c.alive(floor));
    c.setState(floor, 'on');
    c.onAbort(() => floor.item && c.setState(floor, null));
    f.pose.bob = 1.6;
    for (let i = 0; i < 12; i++) {
      c.ensure(c.alive(floor));
      await c.fly(floor.x + rand(-120, 120), floor.y - rand(70, 130), 420);
      f.pose.face = i % 2 ? 1 : -1;
      f.pose.roll = i % 3 === 2 ? 0.35 * f.pose.face : 0;
      sparkles.twinkle(f.x, f.y + 30, 2);
      await c.wait(0.25);
    }
    f.resetPose();
    sparkles.burst(f.x, f.y, 12);
    if (c.alive(floor)) c.setState(floor, null);
  },
};

// Disco: Kugel anschalten → bunte Lichter im Raum, darunter tanzen → wieder ausschalten
export const disco = {
  id: 'disco',
  icon: textureKey('discokugel', 0, 'on'),
  uses: (def) => !!def.disco,

  async run(c, ball) {
    const { f, sparkles } = c;
    c.think(this.icon, 1.4);
    await c.wait(0.9);
    const at = () => ball.artToLocal(ball.def.disco.x, ball.def.disco.y);
    await c.fly(at().x + 40, at().y + 10);
    c.ensure(c.alive(ball));
    c.setState(ball, 'on');
    c.onAbort(() => ball.item && c.setState(ball, null));
    sparkles.burst(at().x, at().y, 24);

    // unter der Kugel kreisen und tanzen
    const below = { x: at().x, y: Math.min(at().y + 170, c.geo.floorY - 90) };
    await c.fly(below.x, below.y);
    f.pose.orbit = 46;
    f.pose.orbitSpeed = 3.5;
    f.pose.bob = 0.8;
    for (let i = 0; i < 20; i++) {
      await c.wait(0.6);
      c.ensure(c.alive(ball));
      if (i % 2) sparkles.twinkle(at().x + rand(-30, 30), at().y + rand(-20, 30), 2);
      f.pose.roll = i % 4 === 3 ? 0.4 : 0;
    }
    f.resetPose();

    // ausschalten
    await c.fly(at().x + 40, at().y + 10);
    if (c.alive(ball)) c.setState(ball, null);
    sparkles.twinkle(at().x, at().y, 4);
  },
};
