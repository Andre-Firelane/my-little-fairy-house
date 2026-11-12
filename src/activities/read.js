import { textureKey } from '../config/furniture.js';
import { pick } from '../systems/motion.js';

const LAMP_REACH = 420; // so nah (Raum-Koordinaten) muss eine Leselampe am Leseplatz stehen

// Lesen (Bücher oder Schriftrollen): holen → Leseplatz suchen:
//   weich (Sessel, Hängesessel, Bett) oder Schreibtisch (auf dem Hocker sitzen) – sonst Tisch, sonst irgendwo
// → aufschlagen bzw. aufrollen, (Leselampe in der Nähe anknipsen), sitzen und lesen
// → zuklappen, Lampe aus → meistens zurückstellen, manchmal liegen lassen (dann kann das Kind aufräumen).
export default {
  id: 'read',
  icon: textureKey('buecher'),
  uses: (def) => !!def.readable,

  async run(c, book) {
    const { f } = c;
    const def = book.def;
    c.think(textureKey(def.id), 1.6);
    await c.wait(1);

    // holen
    let t = c.top(book);
    await c.fly(t.x, t.y - 40);
    c.ensure(c.alive(book));
    const origin = { gx: book.item.gx, gy: book.item.gy, parent: book.item.parent };
    c.pickUp(book);
    await c.wait(0.3);

    // Leseplatz: gemütlich oder Schreibtisch (zufällig, wenn es beides gibt)
    const places = [c.findSeat(def), c.findDesk(def)].filter(Boolean);
    const place = pick(places);
    let spot;
    if (place) {
      c.reserve((place.sofa ?? place.desk).item.uid);
      spot = place.bookSpot;
    } else {
      spot = c.placeNear(def, pick(c.stickers('tisch')));
    }
    c.ensure(spot);
    let p = c.spotPos(spot, def);
    await c.fly(p.x, p.y - 70);
    if (!c.isFree(def, spot)) {
      spot = c.freeSpot(def);
      c.ensure(spot);
      p = c.spotPos(spot, def);
      await c.fly(p.x, p.y - 70);
    }
    c.putDown(spot);
    await c.wait(0.4);

    // aufschlagen / aufrollen
    c.setState(book, 'open');
    c.onAbort(() => book.item && c.setState(book, null));

    // Leselampe in der Nähe anknipsen
    const lamp = c.director
      .free((s) => s.def.id === 'leselampe' && s.item.state !== 'on')
      .filter((s) => Math.hypot(s.x - p.x, s.y - p.y) < LAMP_REACH)
      .sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (lamp) {
      c.reserve(lamp.item.uid);
      const lt = c.top(lamp);
      await c.fly(lt.x + 20, lt.y - 20, 160);
      if (c.alive(lamp)) {
        c.setState(lamp, 'on');
        c.sparkles.twinkle(lt.x + 20, lt.y + 20, 4);
        c.onAbort(() => lamp.item && c.setState(lamp, null));
      }
      await c.wait(0.3);
    }

    // hinsetzen
    const usesPlace = place && spot === place.bookSpot;
    if (usesPlace && place.desk) {
      // am Schreibtisch: auf dem Hocker, zum Tisch gedreht, vorgebeugt
      await c.fly(place.sit.x, place.sit.y, 120);
      f.pose.face = 1;
      f.pose.tilt = 0.18;
      f.pose.fold = 0.8;
      f.pose.bob = 0.1;
    } else if (usesPlace) {
      // gemütlich: zurückgelehnt neben dem Buch
      await c.fly(place.sit.x, place.sit.y - 22, 120);
      f.pose.face = -place.side;
      f.pose.tilt = -0.12;
      f.pose.fold = 0.85;
      f.pose.bob = 0.12;
    } else {
      // sonst: daneben schwebend, vorgebeugt
      const side = f.x < p.x ? -1 : 1;
      await c.fly(p.x + side * 48, p.y - 24, 120);
      f.pose.face = -side;
      f.pose.tilt = 0.14;
      f.pose.fold = 0.75;
      f.pose.bob = 0.25;
    }

    const rounds = usesPlace ? 14 : 10;
    for (let i = 0; i < rounds; i++) {
      await c.wait(0.7);
      c.ensure(c.alive(book));
      const top = c.at(book.x, book.y - 60);
      c.sparkles.twinkle(top.x, top.y, 2);
      if (def.pages && i % 3 === 1) this.turnPage(c, book);
    }

    c.setState(book, null);
    if (lamp && c.alive(lamp) && lamp.item.state === 'on') c.setState(lamp, null);
    f.resetPose();
    await c.wait(0.5);

    // zurückstellen (manchmal bleibt es liegen – dann kann das Kind aufräumen)
    const ignore = new Set([book.item.uid]);
    if (Math.random() < 0.65 && c.isFree(def, origin, ignore)) {
      t = c.top(book);
      await c.fly(t.x, t.y - 40);
      c.ensure(c.alive(book));
      c.pickUp(book);
      let back = c.isFree(def, origin) ? origin : c.freeSpot(def);
      c.ensure(back);
      p = c.spotPos(back, def);
      await c.fly(p.x, p.y - 70);
      if (!c.isFree(def, back)) back = c.freeSpot(def);
      c.ensure(back);
      c.putDown(back);
      await c.wait(0.4);
    }
  },

  // Seite blättert über den Buchrücken um
  turnPage(c, book) {
    const page = c.scene.make.image({ x: book.x, y: book.y - 50, key: 'page' }, false).setOrigin(0, 1);
    c.view.items.add(page);
    c.temp.push(page);
    c.scene.tweens.add({
      targets: page,
      scaleX: -1,
      duration: 450,
      ease: 'Sine.InOut',
      onComplete: () => {
        c.temp = c.temp.filter((o) => o !== page);
        page.destroy();
      },
    });
  },
};
