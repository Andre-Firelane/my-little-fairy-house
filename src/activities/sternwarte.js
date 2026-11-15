import { textureKey } from '../config/furniture.js';
import { squish } from '../systems/juice.js';
import { rand } from '../systems/motion.js';

// Sternwarte (Raumtyp 'sternwarte'): Sterne gucken am Teleskop und den Globus drehen.

// Sterne gucken: die Fee fliegt ans Okular und schaut hinein. Vorn aus dem Fernrohr funkeln Sterne in den
// Himmel, zum Schluss saust eine Sternschnuppe darüber.
export const stargaze = {
  id: 'stargaze',
  icon: textureKey('teleskop'),
  uses: (def) => !!def.telescope,

  async run(c, tel) {
    const { f, scene, sparkles } = c;
    const T = tel.def.telescope;
    const eye = () => tel.artToLocal(T.eye.x, T.eye.y);
    const lens = () => tel.artToLocal(T.lens.x, T.lens.y);
    await c.fly(eye().x - 34, eye().y - 30);
    c.ensure(c.alive(tel));
    await c.fly(eye().x - 26, eye().y + 6, 100);
    c.ensure(c.alive(tel));
    f.pose.face = 1;
    f.pose.tilt = -0.25; // beugt sich zum Okular
    f.pose.bob = 0.3;

    // durchs Rohr schauen: vorn funkelt es, Sterne steigen in den Himmel
    for (let i = 0; i < 7; i++) {
      await c.wait(0.55);
      c.ensure(c.alive(tel));
      const p = lens();
      sparkles.twinkle(p.x + rand(10, 90), p.y - rand(20, 140), 2);
      if (i % 2 === 0) sparkles.twinkle(p.x + 6, p.y - 4, 1);
    }

    // Sternschnuppe quer über den Himmel
    const p = lens();
    const star = scene.add.star(p.x - 120, p.y - 150, 5, 7, 16, 0xfff3a8).setStrokeStyle(2, 0xffd166);
    c.view.items.add(star);
    c.temp.push(star);
    await new Promise((r) => scene.tweens.add({
      targets: star,
      x: p.x + 140,
      y: p.y - 60,
      angle: 260,
      duration: 900,
      ease: 'Sine.InOut',
      onUpdate: () => sparkles.twinkle(star.x, star.y, 1),
      onComplete: r,
    }));
    c.temp = c.temp.filter((o) => o !== star);
    sparkles.burst(star.x, star.y, 12);
    star.destroy();

    f.pose.tilt = 0;
    f.pose.bob = 2; // freut sich
    squish(scene, tel, { amount: 0.05 });
    await c.wait(0.7);
    f.resetPose();
  },
};

// Globus drehen: die Fee schubst den Globus ein paarmal an, er dreht sich, dann glitzert es
export const spin = {
  id: 'spin',
  icon: textureKey('globus'),
  uses: (def) => !!def.globe,

  async run(c, globe) {
    const { f, sparkles } = c;
    const t = c.top(globe);
    await c.fly(t.x + 44, t.y - 10);
    c.ensure(c.alive(globe));
    f.pose.face = -1;
    c.onAbort(() => c.alive(globe) && globe.item.state && c.setState(globe, null));
    const turns = ['r1', null];
    for (let i = 0; i < 12; i++) {
      if (i % 4 === 0) f.pose.tilt = 0.35; // anschubsen
      await c.wait(i < 6 ? 0.18 : 0.12 + (i - 6) * 0.05); // erst schnell, dann langsamer
      c.ensure(c.alive(globe));
      f.pose.tilt = 0;
      c.setState(globe, turns[i % 2]);
    }
    sparkles.burst(t.x, t.y - 20, 10);
    f.pose.bob = 2;
    await c.wait(0.6);
    f.resetPose();
  },
};
