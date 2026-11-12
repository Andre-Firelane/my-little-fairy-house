import { furnitureById, textureKey } from '../config/furniture.js';
import { newUid } from '../state/house.js';
import { popIn, squish } from '../systems/juice.js';
import { rand, pick } from '../systems/motion.js';

const hasFruit = (s) => s.def.id === 'obstschale' && (s.item.amount ?? s.def.portions) > 0;

// Kochen: Apfel aus der Obstschale holen → (würzen) → in den Ofen → der Ofen glüht und dampft
// → ein Kuchen kommt heraus → auf die Arbeitsplatte (Unterschrank) oder den Tisch stellen.
// Ohne Obst kein Kuchen.
export const cook = {
  id: 'cook',
  icon: textureKey('ofen'),
  uses: (def) => def.id === 'ofen',
  available: (s, d) => s.item.state !== 'on' && d.free(hasFruit).length > 0,

  async run(c, oven) {
    const { f } = c;
    const bowls = c.director.free(hasFruit);
    c.ensure(bowls.length);
    const bowl = pick(bowls);
    c.reserve(bowl.item.uid);
    c.think(this.icon, 1.6);
    await c.wait(1);

    // Apfel holen
    let t = c.top(bowl);
    await c.fly(t.x, t.y - 30);
    c.ensure(c.alive(bowl));
    const apple = c.takePortion(bowl);
    await c.wait(0.3);

    // würzen, wenn es Gewürze gibt
    const spice = pick(c.stickers('gewuerze'));
    if (spice) {
      t = c.top(spice);
      await c.fly(t.x + 30, t.y - 30);
      if (c.alive(spice)) {
        squish(c.scene, spice, { amount: 0.15 });
        c.sparkles.bubbles(t.x, t.y + 10, 0xd9a066, 6);
        await c.wait(0.5);
      }
    }

    // in den Ofen
    c.ensure(c.alive(oven));
    const door = oven.artToLocal(120, 140);
    await c.fly(door.x, door.y - 40);
    c.ensure(c.alive(oven));
    c.dropPiece(apple, door);
    await c.wait(0.4);
    c.setState(oven, 'on');
    c.onAbort(() => oven.item && c.setState(oven, null));
    f.pose.bob = 0.4;

    // backen: Dampf steigt auf
    const top = oven.artToLocal(120, 0);
    for (let i = 0; i < 10; i++) {
      await c.wait(0.5);
      c.ensure(c.alive(oven));
      c.sparkles.bubbles(top.x + rand(-60, 60), top.y, 0xffffff, 2);
    }
    c.setState(oven, null);
    f.resetPose();
    c.sparkles.burst(door.x, door.y, 16);

    // Kuchen kommt heraus
    const def = furnitureById('kuchen');
    const item = { uid: newUid(), id: 'kuchen', gx: 0, gy: 0, parent: null };
    const cake = c.view.createSticker(def, item);
    cake.setPosition(door.x, door.y + 30);
    c.temp.push(cake);
    popIn(c.scene, cake, { from: 0, to: 0.85, duration: 600 });
    c.scene.tweens.add({ targets: cake, y: door.y - 30, duration: 600, ease: 'Sine.Out' });
    await c.wait(0.7);
    c.temp = c.temp.filter((o) => o !== cake);
    c.carryNew(cake, item);

    // auf die Arbeitsplatte oder den Tisch
    let spot = c.placeNear(def, pick([...c.stickers('unterschrank'), ...c.stickers('tisch')]));
    if (!spot) return c.dissolveCarried();
    let p = c.spotPos(spot, def);
    await c.fly(p.x, p.y - 80);
    if (!c.isFree(def, spot)) {
      spot = c.freeSpot(def);
      if (!spot) return c.dissolveCarried();
      p = c.spotPos(spot, def);
      await c.fly(p.x, p.y - 80);
    }
    c.putDown(spot);
    c.sparkles.twinkle(p.x, p.y - 40, 6);
    await c.wait(0.5);
  },
};

// Essen: zu Kuchen, Brot oder Obst fliegen, ein paar Bissen nehmen (Krümel) → es wird weniger
export const eat = {
  id: 'eat',
  icon: textureKey('kuchen'),
  uses: (def) => !!def.food,
  available: (s) => (s.item.amount ?? s.def.portions) > 0,

  async run(c, food) {
    const { f } = c;
    c.think(food.img.texture.key, 1.4);
    await c.wait(0.8);
    const t = c.top(food);
    const side = f.x < t.x ? -1 : 1;
    await c.fly(t.x + side * 40, t.y + 10, 160);
    c.ensure(c.alive(food));
    f.pose.face = -side;
    f.pose.bob = 0.3;
    for (let i = 0; i < 6; i++) {
      f.pose.tilt = i % 2 ? 0.25 : 0.05; // Bissen: kurz vorbeugen
      await c.wait(0.45);
      c.ensure(c.alive(food));
      if (i % 2) c.sparkles.bubbles(t.x, t.y + 20, 0xe8c08a, 2);
    }
    c.consume(food);
    f.resetPose();
    c.sparkles.twinkle(f.x, f.y - 20, 4);
    await c.wait(0.4);
  },
};
