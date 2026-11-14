import { textureKey } from '../config/furniture.js';
import { squish } from '../systems/juice.js';
import { clamp, rand } from '../systems/motion.js';

// Turnraum: Medizinball stemmen, an den Ringen schwingen, Purzelbäume auf der Matte, über den Kasten springen,
// die Kletterwand hinauf bis zur Glocke.

// einmal ganz um sich selbst drehen (Salto / Purzelbaum); dir 1 = vorwärts nach rechts
function flip(c, dir = 1, duration = 700) {
  const { f, scene } = c;
  const pose = f.pose;
  const turn = dir * Math.PI * 2;
  return new Promise((resolve) => {
    scene.tweens.add({
      targets: pose,
      roll: pose.roll + turn,
      duration,
      ease: 'Sine.InOut',
      onComplete: () => {
        // zurück auf 0, ohne dass die Fee sich zurückdreht
        if (f.pose === pose) {
          pose.roll -= turn;
          f.visual.rotation -= turn;
        }
        resolve();
      },
    });
  });
}

// x im Flugbereich des Raums halten
function inRoom(c, x) {
  const a = c.life.getWanderArea();
  return clamp(x, a.x1, a.x2);
}

// Medizinball: hochheben (schwer! langsam), ein paar Mal über den Kopf stemmen, zurückstellen
export const lift = {
  id: 'lift',
  icon: textureKey('medizinball'),
  uses: (def) => !!def.medball,

  async run(c, ball) {
    const { f, scene, sparkles } = c;
    const def = ball.def;
    const t = c.top(ball);
    await c.fly(t.x, t.y - 30);
    c.ensure(c.alive(ball));
    const home = { gx: ball.item.gx, gy: ball.item.gy, parent: ball.item.parent };
    c.pickUp(ball);
    const low = f.carrying.dy;
    f.pose.bob = 0.3;
    // schwer: langsam ein Stück in den Raum
    await c.fly(inRoom(c, f.x + rand(-80, 80)), c.geo.floorY - 170, 70);
    f.pose.face = 0;
    for (let i = 0; i < 4; i++) {
      // hoch über den Kopf …
      await new Promise((r) => scene.tweens.add({ targets: f.carrying, dy: -70, duration: 420, ease: 'Sine.Out', onComplete: r }));
      c.check();
      f.pose.fold = 0.5;
      sparkles.twinkle(f.x, f.y - 80, 2);
      await c.wait(0.25);
      // … und wieder runter
      await new Promise((r) => scene.tweens.add({ targets: f.carrying, dy: low, duration: 360, ease: 'Sine.In', onComplete: r }));
      c.check();
      f.pose.fold = 0;
      await c.wait(0.2);
    }
    sparkles.burst(f.x, f.y - 30, 10);

    // zurückstellen (an den alten Platz, wenn der noch frei ist)
    const spot = c.isFree(def, home) ? home : c.placeNear(def, null);
    if (!spot) return c.dissolveCarried();
    const p = c.spotPos(spot, def);
    await c.fly(p.x, p.y - ball.H - 20, 90);
    c.putDown(spot);
  },
};

// Turnringe: hinfliegen, festhalten (Flügel angelegt), hin- und herschwingen, zwei Überschläge, abspringen
export const rings = {
  id: 'rings',
  icon: textureKey('turnringe'),
  uses: (def) => !!def.rings,

  async run(c, rig) {
    const { f, scene, sparkles } = c;
    const R = () => rig.artToLocal(rig.def.rings.x, rig.def.rings.y);
    await c.fly(R().x + 50, R().y + 40);
    c.ensure(c.alive(rig));
    await c.fly(R().x, R().y + 38, 100);
    c.ensure(c.alive(rig));
    f.pose.fold = 1;
    f.pose.bob = 0.05;
    for (let i = 0; i < 6; i++) {
      const side = i % 2 ? 1 : -1;
      f.pose.tilt = 0.25 * side;
      await c.fly(R().x + side * 26, R().y + 44, 100);
      c.ensure(c.alive(rig));
      squish(scene, rig, { amount: 0.03, duration: 90 });
    }
    f.pose.tilt = 0;
    await c.fly(R().x, R().y + 38, 100);
    for (let i = 0; i < 2; i++) {
      await flip(c, 1, 800);
      c.ensure(c.alive(rig));
      sparkles.twinkle(f.x, f.y, 3);
    }
    // abspringen und landen
    f.pose.fold = 0;
    f.pose.bob = 1;
    await c.fly(inRoom(c, R().x + 80), c.geo.floorY - 90, 200);
    f.pose.bob = 2;
    sparkles.burst(f.x, f.y, 14);
    await c.wait(0.9);
  },
};

// Turnmatte: an ein Ende, Flügel anlegen, drei Purzelbäume bis zum anderen Ende, aufstehen, jubeln
export const tumble = {
  id: 'tumble',
  icon: textureKey('turnmatte'),
  uses: (def) => !!def.mat,

  async run(c, mat) {
    const { f, scene, sparkles } = c;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const span = mat.W / 2 - 40;
    const y = () => mat.y - 34;
    await c.fly(mat.x - dir * span, y() - 60);
    c.ensure(c.alive(mat));
    await c.fly(mat.x - dir * span, y(), 100);
    c.ensure(c.alive(mat));
    f.pose.face = dir;
    f.pose.fold = 1;
    f.pose.bob = 0.05;
    await c.wait(0.4);
    for (let i = 1; i <= 3; i++) {
      const x = mat.x - dir * span + (dir * (2 * span) * i) / 3;
      await Promise.all([c.fly(x, y(), 160), flip(c, dir, 650)]);
      c.ensure(c.alive(mat));
      squish(scene, mat, { amount: 0.06, duration: 90 });
      sparkles.twinkle(f.x, f.y + 20, 2);
    }
    // aufstehen und jubeln
    f.pose.fold = 0;
    f.pose.bob = 2;
    sparkles.burst(f.x, f.y - 20, 12);
    await c.wait(1);
  },
};

// Turnkasten: Anlauf, mit den Händen aufsetzen, mit Salto drüber, landen (gern auf der Matte), jubeln
export const vault = {
  id: 'vault',
  icon: textureKey('turnkasten'),
  uses: (def) => !!def.vault,

  async run(c, box) {
    const { f, scene, sparkles } = c;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const ground = () => box.y - 40;
    const start = inRoom(c, box.x - dir * (box.W / 2 + 140));
    await c.fly(start, ground() - 50);
    c.ensure(c.alive(box));
    await c.fly(start, ground(), 100);
    f.pose.face = dir;
    f.pose.fold = 0.7;
    await c.wait(0.5);
    c.ensure(c.alive(box));
    // Anlauf
    f.pose.tilt = 0.3;
    await c.fly(box.x - dir * (box.W / 2 + 20), ground(), 320);
    c.ensure(c.alive(box));
    // Hände auf den Kasten
    await c.fly(box.x, box.y - box.H - 46, 320);
    c.ensure(c.alive(box));
    squish(scene, box, { amount: 0.08, duration: 90 });
    sparkles.twinkle(box.x, box.y - box.H, 3);
    // Salto hinüber
    f.pose.tilt = 0;
    const land = inRoom(c, box.x + dir * (box.W / 2 + 120));
    await Promise.all([c.fly(land, ground(), 300), flip(c, dir, 650)]);
    c.check();
    f.pose.fold = 0;
    f.pose.bob = 2;
    sparkles.burst(f.x, f.y - 20, 14);
    await c.wait(1);
  },
};

// Kletterwand: unten anfangen, Flügel anlegen, Griff für Griff nach oben, oben die Glocke läuten,
// dann mit offenen Flügeln hinuntergleiten
export const climb = {
  id: 'climb',
  icon: textureKey('kletterwand'),
  uses: (def) => !!def.climb,

  async run(c, wall) {
    const { f, scene, sparkles } = c;
    const C = wall.def.climb;
    const hold = (i) => wall.artToLocal(C.holds[i].x, C.holds[i].y);
    await c.fly(hold(0).x, hold(0).y + 30);
    c.ensure(c.alive(wall));
    f.pose.fold = 1;
    f.pose.bob = 0.05;
    f.pose.face = 0;
    f.trail?.setFrequency(4000);
    c.onAbort(() => f.trail?.setFrequency(110));
    for (let i = 0; i < C.holds.length; i++) {
      f.pose.tilt = i % 2 ? 0.2 : -0.2;
      await c.fly(hold(i).x, hold(i).y + 26, 60);
      c.ensure(c.alive(wall));
      await c.wait(0.15);
    }
    // oben: Glocke läuten
    f.pose.tilt = 0;
    const bell = () => wall.artToLocal(C.bell.x, C.bell.y);
    await c.fly(bell().x - 26, bell().y + 26, 80);
    c.ensure(c.alive(wall));
    for (let i = 0; i < 3; i++) {
      squish(scene, wall, { amount: 0.02, duration: 80 });
      sparkles.notes(bell().x, bell().y - 10, 0xffd166, 1);
      await c.wait(0.3);
    }
    sparkles.burst(bell().x, bell().y, 16);
    // hinuntergleiten
    f.pose.fold = 0;
    f.pose.bob = 1;
    f.trail?.setFrequency(110);
    await c.fly(inRoom(c, wall.x + wall.W / 2 + 70), c.geo.floorY - 100, 140);
    f.pose.bob = 2;
    await c.wait(0.7);
  },
};
