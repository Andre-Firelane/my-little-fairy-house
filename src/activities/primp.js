import { textureKey } from '../config/furniture.js';

// Hübsch machen am Spiegelschrank: hinfliegen → Schrank auf, Bürste nehmen → Haare bürsten (vor dem Spiegel)
// → Bürste zurück, Schrank zu → vor dem Spiegel hin- und herdrehen, Glitzer.
export default {
  id: 'primp',
  icon: textureKey('spiegelschrank'),
  uses: (def) => !!def.mirror,

  async run(c, cab) {
    const { f, sparkles } = c;
    c.think(this.icon, 1.4);
    await c.wait(0.9);
    const mirror = () => cab.artToLocal(cab.def.mirror.x, cab.def.mirror.y);
    c.onAbort(() => {
      if (cab.item?.state !== 'open') return;
      cab.item.state = null; // Schrank nicht offen stehen lassen
      cab.setLook(cab.item);
    });

    // Schrank auf, Bürste nehmen
    let m = mirror();
    await c.fly(m.x + 40, m.y + 30);
    c.ensure(c.alive(cab));
    c.setState(cab, 'open');
    await c.wait(0.4);
    const brush = c.scene.make.image({ x: f.x, y: f.y, key: 'brush' }, false);
    c.view.items.add(brush);
    c.temp.push(brush);
    f.carry(brush, -30);
    sparkles.twinkle(f.x, f.y - 20, 3);
    await c.wait(0.3);
    c.ensure(c.alive(cab));
    c.setState(cab, null);

    // vor dem Spiegel bürsten
    m = mirror();
    await c.fly(m.x, m.y + 40, 120);
    c.ensure(c.alive(cab));
    f.pose.orbit = 9;
    f.pose.orbitSpeed = 10;
    f.pose.bob = 0.3;
    for (let i = 0; i < 6; i++) {
      await c.wait(0.35);
      if (i % 2) sparkles.twinkle(f.x + 10, f.y - 34, 2);
    }
    f.pose.orbit = 0;

    // Bürste zurück
    m = mirror();
    await c.fly(m.x + 40, m.y + 30);
    c.ensure(c.alive(cab));
    c.setState(cab, 'open');
    await c.wait(0.3);
    f.dropCarry();
    brush.destroy();
    c.temp = c.temp.filter((o) => o !== brush);
    await c.wait(0.2);
    if (c.alive(cab)) c.setState(cab, null);

    // drehen und bewundern
    m = mirror();
    await c.fly(m.x, m.y + 50, 120);
    for (let i = 0; i < 4; i++) {
      f.pose.face = i % 2 ? 1 : -1;
      await c.wait(0.35);
    }
    f.pose.face = 0;
    sparkles.burst(f.x, f.y, 14);
    await c.wait(0.5);
  },
};
