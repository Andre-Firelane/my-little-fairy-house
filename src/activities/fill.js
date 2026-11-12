import { textureKey } from '../config/furniture.js';
import { rand, pick } from '../systems/motion.js';

const fullKessel = (s) => s.def.id === 'kessel' && s.item.potion > 0;

// Abfüllen: leeres Glas holen → in den vollen Kessel tauchen → es füllt sich mit dem Trank
// → zurückstellen (oder ins Regal). Jede Füllung nimmt eine Portion aus dem Kessel.
export default {
  id: 'fill',
  icon: textureKey('kolben'),
  uses: (def) => !!def.glass,
  available: (s, d) => s.item.liquid == null && d.free(fullKessel).length > 0,

  async run(c, glass) {
    const { f, scene, view } = c;
    const kessels = c.director.free(fullKessel);
    c.ensure(kessels.length);
    const kessel = pick(kessels);
    c.reserve(kessel.item.uid);

    c.think(textureKey(glass.def.id), 1.6);
    await c.wait(1);

    // Glas holen
    let t = c.top(glass);
    await c.fly(t.x, t.y - 40);
    c.ensure(c.alive(glass) && c.alive(kessel));
    const origin = { gx: glass.item.gx, gy: glass.item.gy, parent: glass.item.parent };
    c.pickUp(glass);
    await c.wait(0.3);

    // zum Kessel: so tief, dass das Glas eintaucht
    const lp = () => {
      const p = kessel.liquidPos();
      return c.at(p.x, p.y);
    };
    const hang = (14 + glass.H * 0.85);
    await c.fly(lp().x + rand(-30, 30), lp().y - hang + 6, 200);
    c.ensure(c.alive(kessel) && kessel.item.potion > 0);

    const color = kessel.item.liquid;
    f.pose.bob = 0.3;
    for (let i = 1; i <= 8; i++) {
      glass.setLiquid(color, i / 8);
      c.sparkles.bubbles(lp().x + rand(-30, 30), lp().y, color, 1);
      await c.wait(0.14);
    }
    glass.item.liquid = color;
    glass.setLook(glass.item);
    f.resetPose();
    kessel.item.potion -= 1;
    if (kessel.item.potion <= 0) {
      // Kessel leer: wieder klares Wasser
      kessel.item.liquid = null;
      kessel.setLook(kessel.item);
      c.sparkles.burst(lp().x, lp().y - 20, 14);
    }
    c.sparkles.twinkle(f.x, f.y + 40, 5);
    await c.wait(0.3);

    // zurückstellen, sonst ins Regal
    const def = glass.def;
    let spot = c.isFree(def, origin) ? origin : c.placeNear(def, pick([...c.stickers('regal'), ...c.stickers('haengeregal')]));
    c.ensure(spot);
    let p = c.spotPos(spot, def);
    await c.fly(p.x, p.y - hang - 6);
    if (!c.isFree(def, spot)) {
      spot = c.placeNear(def, null);
      c.ensure(spot);
      p = c.spotPos(spot, def);
      await c.fly(p.x, p.y - hang - 6);
    }
    c.putDown(spot);
    await c.wait(0.4);
  },
};
