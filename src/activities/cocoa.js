import { textureKey } from '../config/furniture.js';
import { bake } from '../systems/bake.js';
import { popIn } from '../systems/juice.js';
import { clamp, rand } from '../systems/motion.js';

// Heißer Kakao (Event „Erster Schnee“, siehe events/firstSnow.js): die Fee wärmt sich am Kamin oder Ofen,
// der dafür angeht, und trinkt einen dampfenden Becher Kakao. Nur vom Event gestartet (uses: nie von selbst).

const FAIRY_RES = 2;
const SIPS = 9;
const MUGS = [0xff9ec7, 0x8fd3ff, 0xffd166, 0xc9a6ff];

// Becher mit Kakao und Sahnehäubchen, Ursprung = Unterkante Mitte
function drawMug(g, color) {
  g.lineStyle(4, color, 1);
  g.strokeCircle(15, -16, 7);
  g.fillStyle(color, 1);
  g.fillRoundedRect(-14, -30, 28, 30, 6);
  g.fillStyle(0xffffff, 0.35);
  g.fillRoundedRect(-10, -26, 6, 20, 3);
  g.fillStyle(0x8a4f2a, 1);
  g.fillEllipse(0, -30, 26, 7);
  g.fillStyle(0xfffaf0, 1);
  g.fillCircle(-5, -33, 6);
  g.fillCircle(4, -34, 7);
  g.fillCircle(0, -39, 5);
  g.fillStyle(0xe0566f, 1);
  g.fillCircle(1, -44, 2.5);
  g.lineStyle(1.5, 0x4a2a18, 1);
  g.strokeRoundedRect(-14, -30, 28, 30, 6);
}

function mugImage(c, i) {
  const key = `cocoa-mug-${i}`;
  bake(c.scene, key, 52, 54, (g) => drawMug(g, MUGS[i]), 22, 50, FAIRY_RES);
  return c.scene.make.image({ x: 0, y: 0, key }, false).setOrigin(22 / 52, 50 / 54);
}

export const cocoa = {
  id: 'cocoa',
  icon: textureKey('kamin'),
  uses: () => false,

  // stove = Kamin oder Ofen im Zimmer, i = welche Fee (Becherfarbe, Platz links/rechts)
  async run(c, { stove, i = 0 }) {
    const { f, scene, sparkles } = c;
    await c.wait(rand(0.1, 0.8));
    c.ensure(c.alive(stove));
    // Ofen bzw. Kamin anmachen
    if (stove.item.state !== 'on') {
      const t = c.top(stove);
      await c.fly(t.x, t.y - 30);
      c.ensure(c.alive(stove));
      c.setState(stove, 'on');
      sparkles.burst(t.x, t.y + 40, 8);
    }
    // neben dem Feuer warm werden
    const side = i % 2 ? 1 : -1;
    const g = c.geo;
    const spot = () => ({
      x: clamp(stove.x + side * (stove.W / 2 + 30 + Math.floor(i / 2) * 60), g.innerLeft + 90, g.innerRight - 90),
      y: stove.y - 110,
    });
    await c.fly(spot().x, spot().y);
    c.ensure(c.alive(stove));
    f.pose.face = -side;
    f.pose.bob = 0.3;

    // dampfender Becher erscheint vor der Fee in ihrer Hand (gehört zur Fee, damit er vor dem Kleid bleibt)
    const mug = mugImage(c, i % MUGS.length);
    const hand = { x: 14 * f.pose.face, y: 34 };
    mug.setPosition(hand.x, hand.y).setScale(0.32);
    f.add(mug);
    c.temp.push(mug);
    popIn(scene, mug, { from: 0, to: 0.32, duration: 400 });
    sparkles.twinkle(f.x, f.y, 3);
    for (let k = 0; k < SIPS; k++) {
      await c.wait(0.7);
      c.ensure(c.alive(stove));
      const sip = k % 2 === 1;
      f.pose.tilt = sip ? 0.3 : 0.05; // Schlückchen: Becher zum Mund
      mug.setPosition(hand.x * (sip ? 0.7 : 1), hand.y - (sip ? 9 : 0));
      if (!sip) sparkles.bubbles(f.x + hand.x * 1.5, f.y - 4, 0xffffff, 2); // Dampf
    }
    f.pose.tilt = 0;
    mug.setPosition(hand.x, hand.y);
    c.temp = c.temp.filter((o) => o !== mug);
    await new Promise((r) => scene.tweens.add({ targets: mug, scale: 0, alpha: 0, duration: 350, ease: 'Back.In', onComplete: r }));
    mug.destroy();
    sparkles.twinkle(f.x, f.y - 30, 4);
    f.pose.bob = 2; // schön warm
    await c.wait(0.6);
    // der Ofen ist nur zum Backen an; der Kamin brennt weiter
    const others = [...c.director.jobs.values()].some((j) => j.activity === cocoa && j.f !== f);
    if (stove.def.id === 'ofen' && c.alive(stove) && !others) c.setState(stove, null);
  },
};
