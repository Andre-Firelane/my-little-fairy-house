import { textureKey } from '../config/furniture.js';
import { TOOL_ART } from '../config/werkstatt.js';
import { bake } from '../systems/bake.js';
import { popIn, squish } from '../systems/juice.js';
import { pick, rand } from '../systems/motion.js';

// Werkstatt: Basteln an der Werkbank, Sägen am Sägebock. Vorher zieht die Fee an der Garderobe eine
// Arbeitsschürze an (wenn es eine gibt) und hängt sie danach wieder zurück.

const FAIRY_RES = 2;

// Bild aus config/werkstatt.js (TOOL_ART) einmal backen und als Hilfsobjekt in den Raum legen
export function toolImage(c, key, x, y) {
  const a = TOOL_ART[key];
  const spr = a.sprite && c.scene.textures.exists(`spr-${a.sprite.key}`) && a.sprite;
  let img;
  if (spr) {
    // gemaltes Werkzeug (z. B. die Bügelsäge vom Sägebock)
    img = c.scene.make.image({ x, y, key: `spr-${spr.key}` }, false).setOrigin(spr.ox, spr.oy);
    img.setScale(spr.width / img.width);
  } else {
    bake(c.scene, key, a.w, a.h, a.draw, a.ox, a.oy, FAIRY_RES);
    img = c.scene.make.image({ x, y, key }, false).setOrigin(a.ox / a.w, a.oy / a.h).setScale(1 / FAIRY_RES);
  }
  c.view.items.add(img);
  c.temp.push(img);
  return img;
}

function removeTemp(c, obj) {
  c.temp = c.temp.filter((o) => o !== obj);
  obj.destroy();
}

// Holzspäne / Sägemehl rieseln zu Boden
export function chips(c, x, y, n = 4, color = 0xe0a872) {
  const floor = c.geo.floorY - 4;
  for (let i = 0; i < n; i++) {
    const chip = c.scene.add.rectangle(x + rand(-8, 8), y, rand(4, 7), rand(3, 5), color).setAngle(rand(0, 90));
    c.view.items.add(chip);
    c.temp.push(chip);
    c.scene.tweens.add({
      targets: chip,
      x: chip.x + rand(-40, 40),
      y: floor,
      angle: chip.angle + rand(90, 270),
      alpha: 0.3,
      duration: rand(500, 800),
      ease: 'Quad.In',
      onComplete: () => removeTemp(c, chip),
    });
  }
}

// Schürze an der Garderobe an- oder ausziehen (ohne Garderobe: ohne Schürze arbeiten)
async function apron(c, on) {
  const { f } = c;
  const rack = pick(c.stickers('schuerzengarderobe'));
  if (!rack) {
    if (!on) f.setOutfit('dress');
    return;
  }
  const at = () => rack.artToLocal(rack.def.apronRack.x + 30, rack.def.apronRack.y);
  await c.fly(at().x, at().y);
  if (!c.alive(rack)) return f.setOutfit(on ? 'apron' : 'dress');
  f.pose.face = -1;
  squish(c.scene, rack, { amount: 0.1 });
  await c.wait(0.4);
  c.sparkles.burst(f.x, f.y, 12);
  f.setOutfit(on ? 'apron' : 'dress');
  f.pose.face = 0;
  await c.wait(0.4);
}

const CRAFTS = ['craft-star', 'craft-boat', 'craft-house'];

// Basteln: Schürze an → Hammer aus dem Werkzeug holen → an der Werkbank hämmern, Späne fliegen →
// ein kleines Holzding (Stern, Boot, Vogelhaus) ist fertig und schwebt glitzernd davon → Hammer zurück, Schürze aus
export const craft = {
  id: 'craft',
  icon: textureKey('werkbank'),
  uses: (def) => !!def.workbench,
  // Wunschblase zeigt die Werkbank; auf Werkzeug oder Garderobe ziehen zählt auch
  wishAlso: (def) => !!def.tools || !!def.apronRack,

  async run(c, bench) {
    const { f, scene, sparkles } = c;
    const swing = (a) => {
      if (f.carrying) f.carrying.angle = a;
    };
    c.onAbort(() => f.setOutfit('dress'));
    await apron(c, true);

    // Hammer holen (ohne Werkzeug im Raum: der Zauberstab tut's auch)
    const box = pick(c.director.free((s) => s.def.tools));
    let tool = null;
    if (box) {
      c.reserve(box.item.uid);
      const t = c.top(box);
      await c.fly(t.x, t.y + box.H * 0.4);
      c.ensure(c.alive(box));
      squish(scene, box, { amount: 0.12 });
      tool = toolImage(c, 'tool-hammer', f.x, f.y);
      f.carry(tool, 12);
      sparkles.twinkle(f.x, f.y, 3);
      await c.wait(0.3);
    }

    // an der Werkbank hämmern
    const work = () => bench.artToLocal(bench.def.workbench.x, bench.def.workbench.y);
    await c.fly(work().x + 40, work().y - 30);
    c.ensure(c.alive(bench));
    f.pose.face = -1;
    f.pose.tilt = 0.25;
    for (let i = 0; i < 10; i++) {
      swing(-55);
      await c.wait(0.18);
      swing(25);
      c.ensure(c.alive(bench));
      squish(scene, bench, { amount: 0.025, duration: 80 });
      chips(c, work().x, work().y + 10, 2);
      if (i % 3 === 2) sparkles.twinkle(work().x, work().y, 2);
      await c.wait(0.22);
    }
    f.pose.tilt = 0;
    swing(null);

    // fertig: das Gebastelte zeigt sich auf der Werkbank und schwebt davon
    const w = work();
    const made = toolImage(c, pick(CRAFTS), w.x, w.y + 2);
    popIn(scene, made, { from: 0, to: made.scale, duration: 500 });
    sparkles.burst(w.x, w.y, 16);
    f.pose.face = 0;
    f.pose.bob = 2;
    await c.wait(1.2);
    f.pose.bob = 1;
    await new Promise((r) => scene.tweens.add({ targets: made, y: w.y - 160, alpha: 0, duration: 1000, ease: 'Sine.In', onComplete: r }));
    removeTemp(c, made);

    // Hammer zurück
    if (tool) {
      if (c.alive(box)) {
        const t = c.top(box);
        await c.fly(t.x, t.y + box.H * 0.4);
        if (c.alive(box)) squish(scene, box, { amount: 0.12 });
      }
      f.dropCarry();
      removeTemp(c, tool);
    }
    await apron(c, false);
  },
};

// Sägen: Schürze an → große Säge nehmen → vor und zurück sägen, Sägemehl rieselt →
// eine Holzscheibe fällt ab und rollt davon → Säge zurücklegen, Schürze aus
export const saw = {
  id: 'saw',
  icon: textureKey('saege'),
  uses: (def) => !!def.saw,
  wishAlso: (def) => !!def.apronRack,

  async run(c, horse) {
    const { f, scene, sparkles } = c;
    const S = horse.def.saw;
    c.onAbort(() => {
      f.setOutfit('dress');
      if (horse.item?.state === 'use') c.setState(horse, null); // Säge wieder auf den Bock
    });
    await apron(c, true);

    // Säge nehmen
    const grip = () => horse.artToLocal(S.grip.x, S.grip.y);
    await c.fly(grip().x + 10, grip().y - 30);
    c.ensure(c.alive(horse));
    c.setState(horse, 'use');
    const blade = toolImage(c, 'tool-bowsaw', f.x, f.y);
    f.carry(blade, 26);
    f.carrying.angle = 0; // liegt waagerecht auf dem Stamm
    sparkles.twinkle(f.x, f.y, 3);

    // sägen: Griff vor und zurück, die Säge liegt dabei auf dem Stamm
    const cut = () => horse.artToLocal(S.cut.x, S.cut.y);
    const base = () => ({ x: cut().x + 70, y: cut().y - 50 });
    await c.fly(base().x, base().y, 160);
    c.ensure(c.alive(horse));
    f.pose.face = -1;
    f.pose.tilt = 0.3;
    for (let i = 0; i < 12; i++) {
      await c.fly(base().x - 34, base().y + 4, 220);
      c.ensure(c.alive(horse));
      chips(c, cut().x, cut().y, 3, 0xf2cf96);
      squish(scene, horse, { amount: 0.02, duration: 70 });
      await c.fly(base().x + 8, base().y, 220);
      c.ensure(c.alive(horse));
    }
    f.pose.tilt = 0;

    // Scheibe fällt ab und rollt weg
    const end = horse.artToLocal(horse.W - 30, S.cut.y + 12);
    const slice = toolImage(c, 'craft-slice', end.x, end.y);
    sparkles.burst(end.x, end.y, 14);
    const floor = c.geo.floorY - 12;
    await new Promise((r) => scene.tweens.add({ targets: slice, y: floor, duration: 380, ease: 'Bounce.Out', onComplete: r }));
    await new Promise((r) => scene.tweens.add({ targets: slice, x: slice.x + 120, angle: 360, alpha: 0, duration: 900, ease: 'Sine.Out', onComplete: r }));
    removeTemp(c, slice);

    // Säge zurück auf den Bock
    await c.fly(grip().x + 10, grip().y - 30);
    f.dropCarry();
    removeTemp(c, blade);
    if (c.alive(horse)) c.setState(horse, null);
    f.pose.face = 0;
    await apron(c, false);
  },
};
