import { textureKey } from '../config/furniture.js';
import { nextStage } from '../config/garden.js';
import { squish } from '../systems/juice.js';
import { rand, pick } from '../systems/motion.js';

const isCan = (s) => s.def.id === 'giesskanne';
const stageOf = (s) => s.item.state ?? null;

// Pflanze eine Stufe wachsen lassen (auch von RoomLife, wenn sie von selbst wächst)
export function grow(scene, sticker, sparkles) {
  const next = nextStage(stageOf(sticker));
  if (next === stageOf(sticker)) return false;
  sticker.item.state = next;
  sticker.item.growT = 0;
  sticker.setLook(sticker.item);
  squish(scene, sticker, { amount: -0.14, duration: 220 });
  const top = sticker.y - sticker.H * 0.6;
  sparkles?.burst(sticker.x, top, 10);
  return true;
}

// Gießen: Gießkanne holen → zur Pflanze → es regnet aus der Tülle → die Pflanze wächst eine Stufe.
// Ohne Gießkanne im Garten wird nicht gegossen (sie wachsen dann nur langsam von selbst).
export const tend = {
  id: 'tend',
  icon: textureKey('giesskanne'),
  uses: (def) => !!def.plant,
  // die Wunschblase zeigt die Gießkanne: auf die Kanne ziehen zählt auch (dann gießt sie eine durstige Pflanze)
  wishAlso: (def) => def.id === 'giesskanne',
  available: (s, d) => stageOf(s) !== 'g3' && d.free(isCan).length > 0,

  async run(c, plant) {
    const { f, scene } = c;
    const cans = c.director.free(isCan);
    c.ensure(cans.length);
    const can = pick(cans);
    c.reserve(can.item.uid);

    // Gießkanne holen (die Fee nimmt eine Zauber-Kopie mit, die echte bleibt stehen)
    let t = c.top(can);
    await c.fly(t.x, t.y - 30);
    c.ensure(c.alive(can));
    squish(scene, can, { amount: 0.15 });
    const mini = scene.make.image({ x: f.x, y: f.y, key: textureKey('giesskanne') }, false).setScale(0.55);
    c.view.items.add(mini);
    c.temp.push(mini);
    f.carry(mini, 26);
    await c.wait(0.3);

    // zur Pflanze und gießen
    t = c.top(plant);
    await c.fly(t.x + 46, t.y - 50);
    c.ensure(c.alive(plant));
    f.pose.face = -1;
    f.pose.tilt = 0.3;
    mini.setAngle(-30);
    for (let i = 0; i < 9; i++) {
      const drop = scene.make.image({ x: f.x - 26, y: f.y + 20, key: 'drop' }, false).setTint(0x8fd3ff).setScale(0.5);
      c.view.items.add(drop);
      c.temp.push(drop);
      scene.tweens.add({
        targets: drop,
        x: t.x + rand(-14, 14),
        y: t.y + 10,
        alpha: 0.4,
        duration: 360,
        ease: 'Quad.In',
        onComplete: () => {
          c.temp = c.temp.filter((o) => o !== drop);
          drop.destroy();
        },
      });
      await c.wait(0.2);
      c.ensure(c.alive(plant));
    }
    f.pose.tilt = 0;
    grow(scene, plant, c.sparkles);
    await c.wait(0.5);
    f.dropCarry();
    c.temp = c.temp.filter((o) => o !== mini);
    mini.destroy();
  },
};

// Ernten: an der reifen Pflanze ziehen → die Ernte springt heraus und schwebt glitzernd davon → die Pflanze
// fängt als Keimling wieder an
export const harvest = {
  id: 'harvest',
  icon: textureKey('tomate', 0, 'g3'),
  uses: (def) => !!def.plant && def.crop != null,
  available: (s) => stageOf(s) === 'g3',

  async run(c, plant) {
    const { f, scene, sparkles } = c;
    const t = c.top(plant);
    await c.fly(t.x + 20, t.y - 30);
    c.ensure(c.alive(plant));
    f.pose.tilt = 0.4;
    for (let i = 0; i < 3; i++) {
      squish(scene, plant, { amount: 0.12 });
      await c.wait(0.3);
      c.ensure(c.alive(plant));
    }
    f.pose.tilt = 0;
    const crop = scene.add.ellipse(t.x, t.y + 6, 26, 30, plant.def.crop).setStrokeStyle(3, 0x4a2a18);
    c.view.items.add(crop);
    c.temp.push(crop);
    plant.item.state = 'g1';
    plant.item.growT = 0;
    plant.setLook(plant.item);
    sparkles.burst(t.x, t.y, 14);
    await new Promise((r) => scene.tweens.add({ targets: crop, y: t.y - 140, scale: 0.4, alpha: 0, duration: 900, ease: 'Sine.Out', onComplete: r }));
    c.temp = c.temp.filter((o) => o !== crop);
    crop.destroy();
    await c.wait(0.3);
  },
};
