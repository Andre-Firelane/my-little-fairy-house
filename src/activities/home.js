import { textureKey } from '../config/furniture.js';
import { squish } from '../systems/juice.js';
import { rand } from '../systems/motion.js';

// Kleine Dinge, die es in jedem Raum geben kann.

// Licht: Deckenlampe oder Kerze an- bzw. ausmachen (Kerze: mit dem Zauberstab anzünden, auspusten)
export const light = {
  id: 'light',
  icon: textureKey('kerze', 0, 'on'),
  uses: (def) => !!def.toggle,

  async run(c, lamp) {
    const { f, sparkles } = c;
    const def = lamp.def;
    const on = lamp.item.state === 'on';
    c.think(textureKey(def.id, 0, on ? null : 'on'), 1.3);
    await c.wait(0.8);
    const p = () => lamp.artToLocal(def.lamp.x, def.lamp.y);
    // neben die Flamme bzw. unter den Lampenschirm
    await c.fly(p().x + 44, p().y + (def.ceiling ? 50 : -10));
    c.ensure(c.alive(lamp));
    f.pose.face = -1;
    f.pose.tilt = 0.2;
    await c.wait(0.5);
    c.ensure(c.alive(lamp));
    c.setState(lamp, on ? null : 'on');
    if (on) sparkles.twinkle(p().x, p().y - 10, 3); // ausgepustet: ein Wölkchen Glitzer
    else sparkles.burst(p().x, p().y, 10);
    await c.wait(0.6);
  },
};

// Blumen gießen: Wassertropfen fallen in die Vase, die Blumen federn auf und glitzern
export const water = {
  id: 'water',
  icon: textureKey('vase'),
  uses: (def) => !!def.flowers,

  async run(c, vase) {
    const { f, sparkles, scene } = c;
    c.think(this.icon, 1.3);
    await c.wait(0.8);
    const top = () => c.top(vase);
    await c.fly(top().x + 30, top().y - 40);
    c.ensure(c.alive(vase));
    f.pose.face = -1;
    f.pose.tilt = 0.35;
    for (let i = 0; i < 8; i++) {
      // Tropfen aus dem Zauberstab
      const drop = scene.make.image({ x: f.x - 20, y: f.y + 6, key: 'drop' }, false).setTint(0x8fd3ff).setScale(0.6);
      c.view.items.add(drop);
      c.temp.push(drop);
      scene.tweens.add({
        targets: drop,
        x: top().x + rand(-10, 10),
        y: top().y + 14,
        alpha: 0.4,
        duration: 380,
        ease: 'Quad.In',
        onComplete: () => {
          c.temp = c.temp.filter((o) => o !== drop);
          drop.destroy();
        },
      });
      await c.wait(0.22);
      c.ensure(c.alive(vase));
    }
    f.pose.tilt = 0;
    squish(scene, vase, { amount: -0.12, duration: 220 });
    sparkles.burst(top().x, top().y + 10, 14);
    await c.wait(0.6);
  },
};

// Ausruhen auf dem Teppich: hinsetzen, Flügel anlegen, ein wenig schaukeln
export const relax = {
  id: 'relax',
  icon: textureKey('teppich'),
  uses: (def) => !!def.rug,

  async run(c, rug) {
    const { f, sparkles } = c;
    c.think(this.icon, 1.3);
    await c.wait(0.8);
    const spot = { x: rug.x + rand(-70, 70), y: rug.y - 34 };
    await c.fly(spot.x, spot.y - 60);
    c.ensure(c.alive(rug));
    await c.fly(spot.x, spot.y, 90);
    f.pose.fold = 1;
    f.pose.bob = 0.12;
    f.pose.face = Math.random() < 0.5 ? 1 : -1;
    for (let i = 0; i < 10; i++) {
      await c.wait(0.8);
      c.ensure(c.alive(rug));
      f.pose.tilt = i % 2 ? 0.08 : -0.04;
      if (i % 3 === 2) sparkles.twinkle(f.x, f.y - 30, 2);
    }
    f.resetPose();
    await c.fly(f.pos.x, f.pos.y - 60, 120);
  },
};
