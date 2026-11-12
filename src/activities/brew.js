import { textureKey } from '../config/furniture.js';
import { newUid } from '../state/house.js';
import { rand, pick, lerpColor } from '../systems/motion.js';

const isIngredient = (s) => !!s.def.ingredient;

// Zaubertrank brauen: 1–2 Zutaten holen (Kräuter, Blätter, Mondwasser …) → in den Kessel →
// rühren, bis die Farbe der Mischung entsteht. Ohne Zutaten kein Trank.
// Danach ist der Kessel voll (3 Portionen) – Abfüllen in Gläser übernimmt 'fill'.
export default {
  id: 'brew',
  icon: textureKey('kessel'),
  uses: (def) => def.id === 'kessel',
  available: (s, d) => !(s.item.potion > 0) && d.free(isIngredient).length > 0,

  async run(c, kessel) {
    const { f, scene } = c;

    // Zutaten aussuchen: möglichst zwei verschiedene
    const all = c.director.free(isIngredient);
    c.ensure(all.length);
    const first = pick(all);
    const other = all.filter((s) => s.def.id !== first.def.id);
    const second = other.length ? pick(other) : null;
    const chosen = [first, second].filter(Boolean);
    chosen.forEach((s) => c.reserve(s.item.uid));

    c.think(first.img.texture.key, 1.6);
    await c.wait(1);

    const liquid = () => {
      const p = kessel.liquidPos();
      return c.at(p.x, p.y);
    };

    const colors = [];
    const ids = [];
    for (const ing of chosen) {
      if (!c.alive(ing)) continue;
      const t = c.top(ing);
      await c.fly(t.x, t.y - 30);
      if (!c.alive(ing)) continue;
      colors.push(ing.def.ingredient);
      ids.push(ing.def.id);
      const piece = c.takePortion(ing);
      await c.wait(0.3);
      c.ensure(c.alive(kessel));
      await c.fly(liquid().x, liquid().y - 90);
      c.ensure(c.alive(kessel));
      c.dropPiece(piece, kessel.liquidPos());
      await c.wait(0.35);
      c.sparkles.bubbles(liquid().x, liquid().y, colors[colors.length - 1], 8);
    }
    c.ensure(colors.length);

    // rühren: Fee kreist über dem Kessel, das Wasser nimmt die Farbe der Mischung an
    const from = kessel.item.liquid ?? kessel.def.emptyLiquid ?? 0x3b3355;
    const result = colors.length === 2 ? lerpColor(colors[0], colors[1], 0.5) : colors[0];
    f.pose.orbit = 46;
    f.pose.bob = 0.4;
    f.trail.setFrequency(45);
    const steps = 18;
    for (let i = 1; i <= steps; i++) {
      const col = lerpColor(from, result, i / steps);
      kessel.item.liquid = col;
      kessel.setLiquid(col);
      c.sparkles.bubbles(liquid().x + rand(-70, 70), liquid().y, col, 2);
      await c.wait(0.22);
      c.ensure(c.alive(kessel));
    }
    f.resetPose();
    kessel.item.liquid = result;
    kessel.item.potion = 3;
    c.life.state.lastRecipe = { key: newUid(), ings: ids, color: result }; // für die Tafel
    c.sparkles.burst(liquid().x, liquid().y - 30, 26);
    await c.wait(0.6);
  },
};
