import { textureKey, STICKER_PAD } from '../config/furniture.js';
import { bake } from '../systems/bake.js';
import { pick, rand } from '../systems/motion.js';

const WATER = 0x8fd3ff;

// Baden: Wasser einlassen (Hahn auf, die Wanne füllt sich) → (Shampoo aus dem Pflegeschrank holen und
// hineingießen, Schaum wächst) → (Quietscheente hineinplumpsen lassen) → hineinsetzen und baden, Blasen steigen
// → aussteigen, (Ente zurückstellen) → Stöpsel ziehen, das Wasser läuft ab.
// Alles in Klammern nur, wenn es den Gegenstand im Raum gibt.
// Beim Baden sitzt die Fee IN der Wanne: der vordere Teil der Wanne (ab bath.rimY) und ein Schaumkranz
// werden dafür über die Fee gelegt.
export default {
  id: 'bath',
  icon: textureKey('badewanne'),
  uses: (def) => !!def.bath,
  available: (s) => s.item.liquid == null, // schon voll: badet gerade jemand

  async run(c, tub) {
    const { f, scene, sparkles } = c;
    const B = tub.def.bath;
    const at = (x, y) => tub.artToLocal(x, y);
    const water = (alpha, foam) => tub.setLiquid(WATER, alpha, foam);
    const surface = () => at(rand(40, 280), B.rimY);

    c.think(this.icon, 1.6);
    await c.wait(1);
    // abgebrochen: Wanne ist wieder leer
    c.onAbort(() => {
      tub.item.liquid = null;
      tub.item.foam = 0;
      tub.setLook(tub.item);
    });

    // Wasser einlassen: Hahn auf, Strahl, die Wanne füllt sich
    const tap = at(B.faucet.x, B.faucet.y);
    await c.fly(tap.x - 20, tap.y - 60);
    c.ensure(c.alive(tub));
    sparkles.twinkle(tap.x, tap.y, 4);
    const stream = scene.add.rectangle(tap.x, tap.y, 9, B.rimY - B.faucet.y, WATER, 0.85).setOrigin(0.5, 0);
    c.view.items.add(stream);
    c.temp.push(stream);
    tub.item.liquid = WATER;
    tub.item.foam = 0;
    const fill = 14;
    for (let i = 1; i <= fill; i++) {
      water(i / fill, 0);
      if (i % 2) sparkles.bubbles(tap.x, at(0, B.rimY).y, WATER, 2);
      await c.wait(0.2);
      c.ensure(c.alive(tub));
    }
    stream.destroy();
    c.temp = c.temp.filter((o) => o !== stream);

    // Shampoo hineingießen: Schaum wächst
    let foam = 0;
    const cabinet = pick(c.director.free((s) => !!s.def.shampoo));
    if (cabinet) {
      c.reserve(cabinet.item.uid);
      const sp = cabinet.artToLocal(cabinet.def.shampoo.x, cabinet.def.shampoo.y);
      await c.fly(sp.x, sp.y - 20);
      c.ensure(c.alive(tub));
      const bottle = this.carryPiece(c, 'shampoo', 26);
      await c.wait(0.3);
      const mid = at(160, B.rimY);
      await c.fly(mid.x, mid.y - 90);
      c.ensure(c.alive(tub));
      f.pose.tilt = 0.3;
      const steps = 12;
      for (let i = 1; i <= steps; i++) {
        foam = i / steps;
        water(1, foam);
        const p = surface();
        sparkles.bubbles(p.x, p.y - 10, i % 3 ? 0xffffff : 0xffc8e2, 2);
        await c.wait(0.18);
        c.ensure(c.alive(tub));
      }
      f.pose.tilt = 0;
      // Shampoo zurückstellen
      if (c.alive(cabinet)) await c.fly(sp.x, sp.y - 20);
      this.dropPiece(c, bottle);
      sparkles.twinkle(f.x, f.y + 20, 3);
    }
    tub.item.foam = foam;

    // Quietscheente hineinplumpsen lassen (schwimmt, solange gebadet wird)
    let duck = pick(c.director.free((s) => !!s.def.duck));
    let duckHome = null;
    if (duck) {
      c.reserve(duck.item.uid);
      const t = c.top(duck);
      await c.fly(t.x, t.y - 30);
      c.ensure(c.alive(tub));
      if (c.alive(duck)) {
        duckHome = { gx: duck.item.gx, gy: duck.item.gy, parent: duck.item.parent };
        c.pickUp(duck);
        const drop = at(B.duck.x, B.rimY);
        await c.fly(drop.x, drop.y - 110);
        c.ensure(c.alive(tub));
        f.dropCarry();
        c.carried = null;
        // abgebrochen, solange sie in der Wanne schwimmt: die Fee "trägt" sie wieder, die Regie stellt sie ab
        c.onAbort(() => {
          if (!duck) return;
          scene.tweens.killTweensOf(duck);
          f.carry(duck, 14 + duck.H * 0.85);
          c.carried = duck;
        });
        duck.setAngle(0);
        scene.tweens.add({
          targets: duck,
          x: drop.x,
          y: drop.y + 22,
          scale: 0.8,
          duration: 380,
          ease: 'Quad.In',
          onComplete: () => {
            sparkles.bubbles(drop.x, drop.y, WATER, 8);
            sparkles.twinkle(drop.x, drop.y - 20, 3);
            scene.tweens.add({ targets: duck, y: drop.y + 18, angle: 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
          },
        });
        await c.wait(0.6);
      } else {
        duck = null;
      }
    }

    // hineinsetzen und baden
    const seat = at(B.seat.x, B.rimY);
    await c.fly(seat.x, seat.y - 120);
    c.ensure(c.alive(tub));
    await c.fly(seat.x, seat.y - 8, 90);
    c.ensure(c.alive(tub));
    const cover = this.makeCover(c, tub, foam);
    f.pose.face = -1;
    f.pose.fold = 0.7;
    f.pose.bob = 0.15;
    f.trail.setFrequency(4000);
    for (let i = 0; i < 12; i++) {
      await c.wait(0.75);
      c.ensure(c.alive(tub));
      const p = surface();
      sparkles.bubbles(p.x, p.y - 10, 0xffffff, 2);
      if (i % 4 === 1) {
        // planschen
        f.pose.orbit = 8;
        f.pose.orbitSpeed = 9;
        sparkles.bubbles(seat.x + rand(-40, 40), seat.y - 10, WATER, 4);
      } else {
        f.pose.orbit = 0;
      }
      if (i % 3 === 0) f.pose.face = -f.pose.face;
    }

    // aussteigen, frisch und glitzernd
    cover.forEach((o) => o.destroy());
    c.temp = c.temp.filter((o) => !cover.includes(o));
    f.resetPose();
    f.trail.setFrequency(110);
    await c.fly(seat.x, seat.y - 150, 120);
    sparkles.burst(f.x, f.y, 16);
    await c.wait(0.4);

    // Ente zurück an ihren Platz
    if (duck) {
      const d = duck;
      await c.fly(d.x, d.y - d.H - 30);
      scene.tweens.killTweensOf(d);
      d.setAngle(0);
      c.attach(d);
      duck = null; // gehört jetzt wieder der Fee (Abbruch: die Regie stellt sie ab)
      const spot = duckHome && c.isFree(d.def, duckHome) ? duckHome : c.placeNear(d.def, tub);
      if (spot) {
        const p = c.spotPos(spot, d.def);
        await c.fly(p.x, p.y - d.H - 20);
        c.putDown(spot);
      } else {
        c.dissolveCarried();
      }
      await c.wait(0.3);
    }

    // Stöpsel ziehen: Wasser und Schaum laufen ab
    if (c.alive(tub)) {
      const plug = at(B.duck.x + 30, B.rimY);
      await c.fly(plug.x, plug.y - 60);
      c.ensure(c.alive(tub));
      const steps = 10;
      for (let i = steps - 1; i >= 0; i--) {
        water(i / steps, (foam * i) / steps);
        if (i % 2) sparkles.bubbles(plug.x, plug.y, WATER, 2);
        await c.wait(0.16);
      }
    }
    tub.item.liquid = null;
    tub.item.foam = 0;
    tub.setLook(tub.item);
  },

  // kleines Ding (Textur), das die Fee in der Hand hält
  carryPiece(c, key, dy) {
    const piece = c.scene.make.image({ x: c.f.x, y: c.f.y + dy, key }, false);
    c.view.items.add(piece);
    c.temp.push(piece);
    c.f.carry(piece, dy);
    return piece;
  },

  dropPiece(c, piece) {
    c.f.dropCarry();
    piece.destroy();
    c.temp = c.temp.filter((o) => o !== piece);
  },

  // vorderer Teil der Wanne + Schaumkranz über der Fee (sie sitzt darin)
  makeCover(c, tub, foam) {
    const B = tub.def.bath;
    const img = tub.img;
    const front = c.scene.make
      .image({ x: tub.x, y: tub.y, key: img.texture.key }, false)
      .setOrigin(img.originX, img.originY);
    const top = B.rimY + STICKER_PAD;
    front.setCrop(0, top, front.width, front.height - top);
    // Schaumkranz entlang der Öffnung (bei wenig Schaum: nur ein paar Wellen)
    const key = bake(c.scene, 'bath-foam-ring', tub.W, 40, (g) => {
      for (let x = 30, i = 0; x <= tub.W - 30; x += 21, i++) {
        g.fillStyle(i % 4 === 0 ? 0xffe3f1 : 0xffffff, 0.97);
        g.fillCircle(x, 22 + (i % 2) * 4, 10 + (i % 3) * 2);
      }
    });
    const ring = c.scene.make.image({ key }, false).setOrigin(0.5, 0.5);
    const p = tub.artToLocal(tub.W / 2, B.rimY - 2);
    ring.setPosition(p.x, p.y).setScale(1, 0.4 + foam * 0.6).setAlpha(foam > 0 ? 1 : 0.6);
    if (!foam) ring.setTint(WATER);
    const parts = [front, ring];
    parts.forEach((o) => c.life.layer.add(o));
    c.temp.push(...parts);
    return parts;
  },
};
