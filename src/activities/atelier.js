import { furnitureById, textureKey } from '../config/furniture.js';
import { ATELIER_ART, PAINT_COLORS } from '../config/atelier.js';
import { newUid } from '../state/house.js';
import { bake } from '../systems/bake.js';
import { popIn, squish } from '../systems/juice.js';
import { pick, rand } from '../systems/motion.js';

// Malatelier: an der Staffelei malen (das fertige Bild kommt an die Wand) und an der Töpferscheibe
// eine Vase drehen (sie wird im Raum abgestellt). Ist der Raum schon voll mit Bildern bzw. Vasen,
// schwebt das neue Werk glitzernd davon – so füllt sich das Zimmer nicht endlos.

const FAIRY_RES = 2;
const MAX_PICTURES = 4;
const MAX_VASES = 3;

function artImage(c, key, x, y) {
  const a = ATELIER_ART[key];
  bake(c.scene, key, a.w, a.h, a.draw, a.ox, a.oy, FAIRY_RES);
  const img = c.scene.make.image({ x, y, key }, false).setOrigin(a.ox / a.w, a.oy / a.h).setScale(1 / FAIRY_RES);
  c.view.items.add(img);
  c.temp.push(img);
  return img;
}

function removeTemp(c, obj) {
  c.temp = c.temp.filter((o) => o !== obj);
  obj.destroy();
}

const tween = (scene, cfg) => new Promise((r) => scene.tweens.add({ ...cfg, onComplete: r }));

// neues Werk (Bild, Vase) im Raum unterbringen: die Fee trägt es hin und stellt es ab.
// Kein Platz oder schon genug davon: es schwebt glitzernd nach oben davon.
async function keepOrRelease(c, sticker, item, near, max) {
  const def = sticker.def;
  const spot = c.stickers(def.id).length < max ? c.placeNear(def, near) : null;
  if (!spot) {
    c.sparkles.burst(sticker.x, sticker.y - sticker.H / 2, 14);
    await tween(c.scene, { targets: sticker, y: sticker.y - 200, alpha: 0, duration: 1100, ease: 'Sine.In' });
    removeTemp(c, sticker);
    return;
  }
  c.temp = c.temp.filter((o) => o !== sticker);
  c.carryNew(sticker, item);
  let to = spot;
  let p = c.spotPos(to, def);
  await c.fly(p.x, p.y - sticker.H - 20);
  if (!c.isFree(def, to)) {
    to = c.freeSpot(def);
    if (!to) return c.dissolveCarried();
    p = c.spotPos(to, def);
    await c.fly(p.x, p.y - sticker.H - 20);
  }
  c.putDown(to);
  c.sparkles.twinkle(p.x, p.y - sticker.H / 2, 6);
  await c.wait(0.4);
}

// Malen: Pinsel aus dem Becher holen → in die Farbtöpfe tauchen → bunte Tupfer auf die Leinwand →
// das fertige Bild löst sich glitzernd von der Staffelei und kommt an die Wand → Pinsel zurück
export const paint = {
  id: 'paint',
  icon: textureKey('staffelei'),
  uses: (def) => !!def.easel,
  wishAlso: (def) => !!def.paints || !!def.brushes,

  async run(c, easel) {
    const { f, scene, sparkles } = c;
    const E = easel.def.easel;

    // Pinsel holen (ohne Becher: der Zauberstab malt auch)
    const cup = pick(c.director.free((s) => s.def.brushes));
    let tool = null;
    if (cup) {
      c.reserve(cup.item.uid);
      const t = c.top(cup);
      await c.fly(t.x + 20, t.y - 20);
      c.ensure(c.alive(cup));
      squish(scene, cup, { amount: 0.12 });
      tool = artImage(c, 'tool-brush', f.x, f.y);
      f.carry(tool, 14);
      f.carrying.angle = 0;
      sparkles.twinkle(f.x, f.y, 3);
      await c.wait(0.3);
    }

    const pots = pick(c.director.free((s) => s.def.paints));
    if (pots) c.reserve(pots.item.uid);
    const colors = pots ? pots.def.paints.colors : PAINT_COLORS;
    const dabs = [];
    const order = [...colors].sort(() => Math.random() - 0.5).slice(0, 2); // zwei Farben

    for (const color of order) {
      // Farbe aufnehmen
      if (pots && c.alive(pots)) {
        const d = () => pots.artToLocal(pots.def.paints.dip.x, pots.def.paints.dip.y);
        await c.fly(d().x + 50, d().y - 20, 320);
        if (c.alive(pots)) {
          f.pose.tilt = 0.35;
          squish(scene, pots, { amount: 0.1 });
          sparkles.bubbles(d().x, d().y, color, 5);
          await c.wait(0.4);
          f.pose.tilt = 0;
        }
      }
      // Tupfer auf die Leinwand
      for (let i = 0; i < 4; i++) {
        c.ensure(c.alive(easel));
        const at = easel.artToLocal(rand(E.x0, E.x1), rand(E.y0, E.y1));
        await c.fly(at.x + 64, at.y - 2, i ? 160 : 320);
        c.ensure(c.alive(easel));
        f.pose.face = -1;
        f.pose.tilt = 0.2;
        const dab = artImage(c, 'paint-dab', at.x, at.y).setTint(color).setAngle(rand(-40, 40));
        const s = dab.scale * rand(0.7, 1.2);
        dabs.push(dab);
        popIn(scene, dab, { from: 0, to: s, duration: 350 });
        if (i === 3) sparkles.twinkle(at.x, at.y, 2);
        await c.wait(0.25);
        f.pose.tilt = 0;
      }
    }
    f.pose.face = 0;

    // fertig: die Tupfer verschwimmen, ein Bild löst sich von der Leinwand
    c.ensure(c.alive(easel));
    const mid = easel.artToLocal((E.x0 + E.x1) / 2, E.y1 + 10);
    sparkles.burst(mid.x, mid.y - 40, 20);
    for (const d of dabs) scene.tweens.add({ targets: d, alpha: 0, duration: 500, onComplete: () => removeTemp(c, d) });
    const def = furnitureById('bild');
    const item = { uid: newUid(), id: 'bild', v: Math.floor(Math.random() * (def.variants || 1)), gx: 0, gy: 0, parent: null };
    const pic = c.view.createSticker(def, item);
    pic.setPosition(mid.x, mid.y);
    c.temp.push(pic);
    popIn(scene, pic, { from: 0, to: 0.85, duration: 600 });
    f.pose.bob = 2;
    await c.wait(1);
    f.pose.bob = 1;
    await keepOrRelease(c, pic, item, easel, MAX_PICTURES);

    // Pinsel zurück
    if (tool) {
      if (c.alive(cup)) {
        const t = c.top(cup);
        await c.fly(t.x + 20, t.y - 20);
        if (c.alive(cup)) squish(scene, cup, { amount: 0.12 });
      }
      f.dropCarry();
      removeTemp(c, tool);
    }
  },
};

// Töpfern: an die Scheibe → sie dreht sich, ein Tonklumpen wächst unter den Händen der Fee zu einer
// Vase hoch → Glitzer, eine Vase mit Blumen steht fertig da und kommt in den Raum
export const pottery = {
  id: 'pottery',
  icon: textureKey('toepferscheibe'),
  uses: (def) => !!def.wheel,
  available: (s) => s.item.state !== 'on',

  async run(c, wheel) {
    const { f, scene, sparkles } = c;
    const W = wheel.def.wheel;
    const plate = () => wheel.artToLocal(W.x, W.y);
    c.onAbort(() => wheel.item && c.setState(wheel, null));

    await c.fly(plate().x + 70, plate().y - 50);
    c.ensure(c.alive(wheel));
    c.setState(wheel, 'on');
    const clay = artImage(c, 'clay-lump', plate().x, plate().y + 2);
    const full = clay.scaleX;
    clay.setScale(full * 0.9, full * 0.25);
    sparkles.twinkle(plate().x, plate().y, 3);
    await c.wait(0.3);

    // drehen: der Ton wächst, die Fee formt ihn mit den Händen (wackelt leicht hin und her)
    f.pose.face = -1;
    f.pose.tilt = 0.3;
    for (let i = 0; i < 12; i++) {
      c.ensure(c.alive(wheel));
      const u = (i + 1) / 12;
      scene.tweens.add({ targets: clay, scaleX: full * (0.9 - 0.1 * u), scaleY: full * (0.25 + 0.75 * u), duration: 380, ease: 'Sine.Out' });
      await c.fly(plate().x + 52 + (i % 2) * 10, plate().y - 30 - u * 30, 120);
      if (i % 3 === 0) sparkles.bubbles(plate().x + rand(-20, 20), plate().y - 10, 0xd9824f, 2);
      if (i % 4 === 3) squish(scene, wheel, { amount: 0.03, duration: 120 });
      await c.wait(0.12);
    }
    f.pose.tilt = 0;
    c.ensure(c.alive(wheel));
    c.setState(wheel, null);

    // fertig: aus dem Ton wird eine Vase mit Blumen
    const at = plate();
    sparkles.burst(at.x, at.y - 30, 18);
    removeTemp(c, clay);
    const def = furnitureById('vase');
    const item = { uid: newUid(), id: 'vase', gx: 0, gy: 0, parent: null };
    const vase = c.view.createSticker(def, item);
    vase.setPosition(at.x, at.y + 4);
    c.temp.push(vase);
    popIn(scene, vase, { from: 0, to: 0.85, duration: 600 });
    f.pose.face = 0;
    f.pose.bob = 2;
    await c.wait(1);
    f.pose.bob = 1;
    await keepOrRelease(c, vase, item, wheel, MAX_VASES);
  },
};
