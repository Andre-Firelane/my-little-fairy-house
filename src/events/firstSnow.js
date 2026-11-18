import Phaser from 'phaser';
import { DEPTH, GAME_W, GAME_H, WORLD_W, TREE_SCALE } from '../config/layout.js';
import { OX, OY, GROUND_Y, TRUNK_X, sway, halfWidth, crownLayout } from '../config/treeShape.js';
import TREE_PARTS from '../config/tree.json';
import { cocoa } from '../activities/cocoa.js';
import { bake } from '../systems/bake.js';
import { popIn } from '../systems/juice.js';
import { makeRng, rand } from '../systems/motion.js';

// Event „Erster Schnee“ (am Tag):
//  1. Es schneit: der Himmel wird kühl, Flocken fallen, auf Krone, Wiese und Balkondächern bleibt Schnee liegen.
//  2. Die Feen fliegen heraus. Auf jedem Balkon-Zimmer bauen bis zu zwei Feen eine kleine Schneefee
//     (Kugel, Körper mit Eisflügeln, Kopf mit Stern) – ohne Balkon-Zimmer unten auf der Wiese.
//     Die anderen schweben paarweise am Stamm und werfen sich glitzernde Schneebälle zu.
//  3. Heißer Kakao: alle fliegen heim; wo ein Kamin oder Ofen steht, geht er an und es gibt Kakao (activities/cocoa.js).
//  4. Tauwetter: es hört auf zu schneien, der Himmel wird wieder warm, Schnee und Schneefeen schmelzen.
// Gehört der Baum-Szene (TreeScene.happening); wird nicht gespeichert. Die Uhr steht währenddessen (clock.paused).

const SNOW_GROW = 18; // so lange dauert es, bis der Schnee ganz liegt
const GATHER_AT = 6; // dann kommen die Feen heraus
const PLAY_TIME = 30; // Schneefeen bauen und Schneebälle werfen
const BUILD_STEP = 2.6; // Sekunden je Bauabschnitt der Schneefee
const THROW_EVERY = 1.5;
const HOME_MAX = 14;
const COZY = 18; // nach dem Heimflug: so lange wird Kakao getrunken, dann taut es
const MELT = 6;

const MEADOW_Y = GROUND_Y - 10 + OY; // Oberkante der Wiese (wie BackScene)
// Höhen (Baum-Koordinaten) für die Schneeball-Paare, abwechselnd links/rechts am Stamm – neben den Balkonen vorbei
const PAIR_SPOTS = [[-1, 2650], [1, 2080], [-1, 3850], [1, 3120], [-1, 1620], [1, 1620], [1, 4050], [-1, 4250]];

const W = (x, y) => ({ x: x + OX, y: y + OY });

function bakeArt(scene) {
  // Schneeflocke (weich) und Schneeball
  bake(scene, 'snow-flake', 18, 18, (g) => {
    g.fillStyle(0xffffff, 0.5);
    g.fillCircle(9, 9, 8);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(9, 9, 5);
  });
  bake(scene, 'snow-ball', 34, 34, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(17, 17, 14);
    g.fillStyle(0xdbe8f7, 1);
    g.fillCircle(20, 21, 9);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(15, 14, 9);
    g.lineStyle(2, 0xa9c4e4, 1);
    g.strokeCircle(17, 17, 14);
  }, 0, 0, 1.5);
  // Schneehaube für Kronenstücke und Balkondach (Ursprung Mitte unten)
  for (let v = 0; v < 3; v++) {
    bake(scene, `snow-cap-${v}`, 220, 80, (g) => {
      const rng = makeRng(13 + v);
      g.fillStyle(0xc9daef, 1);
      g.fillEllipse(110, 62, 196, 30);
      g.fillStyle(0xffffff, 1);
      g.fillEllipse(110, 56, 200, 34);
      for (let i = 0; i < 6; i++) g.fillCircle(30 + i * 32 + rng() * 10, 46 - rng() * 14, 18 + rng() * 10);
      // Tropfen-Zapfen unten
      g.fillStyle(0xffffff, 1);
      for (let i = 0; i < 5; i++) {
        const x = 30 + i * 40 + rng() * 14;
        g.fillTriangle(x - 7, 66, x + 7, 66, x, 76 - rng() * 6);
      }
    });
  }
  // Schneedecke auf der Wiese (ein Stück, nebeneinander gelegt)
  bake(scene, 'snow-drift', 420, 90, (g) => {
    g.fillStyle(0xd4e2f3, 1);
    g.fillEllipse(210, 60, 430, 52);
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(210, 50, 430, 50);
    g.fillEllipse(120, 38, 200, 40);
    g.fillEllipse(300, 40, 220, 38);
  });
  // Schneefee in drei Teilen (Ursprung jeweils Mitte unten), Größe in Raum-Pixeln
  bake(scene, 'snowfairy-base', 110, 90, (g) => {
    g.fillStyle(0xd4e2f3, 1);
    g.fillEllipse(55, 78, 104, 20);
    g.fillStyle(0xffffff, 1);
    g.fillCircle(55, 46, 42);
    g.fillStyle(0xe6eef9, 1);
    g.fillCircle(66, 56, 26);
    g.lineStyle(2.5, 0xa9c4e4, 1);
    g.strokeCircle(55, 46, 42);
  });
  bake(scene, 'snowfairy-body', 150, 76, (g) => {
    // Eisflügel
    for (const s of [-1, 1]) {
      g.fillStyle(0xbfe6ff, 0.85);
      g.fillEllipse(75 + s * 46, 26, 46, 40);
      g.fillEllipse(75 + s * 40, 52, 30, 24);
      g.lineStyle(2, 0x8fc8f0, 1);
      g.strokeEllipse(75 + s * 46, 26, 46, 40);
    }
    g.fillStyle(0xffffff, 1);
    g.fillCircle(75, 42, 32);
    g.lineStyle(2.5, 0xa9c4e4, 1);
    g.strokeCircle(75, 42, 32);
    // Knöpfe aus Beeren
    g.fillStyle(0xe0566f, 1);
    g.fillCircle(75, 30, 4);
    g.fillCircle(75, 46, 4);
    // Schal
    g.fillStyle(0xff9ec7, 1);
    g.fillRoundedRect(48, 6, 54, 12, 6);
    g.fillRoundedRect(84, 10, 12, 30, 5);
  });
  bake(scene, 'snowfairy-head', 80, 92, (g) => {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(40, 64, 26);
    g.lineStyle(2.5, 0xa9c4e4, 1);
    g.strokeCircle(40, 64, 26);
    g.fillStyle(0x3b2a4a, 1);
    g.fillCircle(31, 60, 3.5);
    g.fillCircle(49, 60, 3.5);
    g.fillStyle(0xff8a2a, 1);
    g.fillTriangle(38, 66, 42, 66, 40, 76);
    g.fillStyle(0xff9ec7, 0.7);
    g.fillCircle(26, 70, 4.5);
    g.fillCircle(54, 70, 4.5);
    // Stern auf dem Kopf
    g.fillStyle(0xffd166, 1);
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 ? 7 : 16;
      pts.push({ x: 40 + Math.cos(a) * r, y: 22 + Math.sin(a) * r });
    }
    g.fillPoints(pts, true);
    g.lineStyle(2, 0xe0a83a, 1);
    g.strokePoints(pts, true);
  });
}

// Teile der Schneefee: [Bild, Höhe des Teils (Raum-Pixel), Höhe seiner Unterkante über dem Boden]
const PARTS = [['snowfairy-base', 90, 0], ['snowfairy-body', 76, 70], ['snowfairy-head', 92, 128]];

export default class FirstSnow {
  constructor(scene) {
    this.scene = scene;
    this.id = 'snow';
    this.t = 0;
    this.phase = 'snowing';
    this.phaseT = 0;
    this.done = false;
    this.crew = [];
    this.snowmen = []; // { parent, x, y, k, parts: [] }  (Raum-Ansicht oder Welt)
    scene.clock.paused = true;
    scene.clock.setChill(true);
    bakeArt(scene);

    this.layer = scene.add.container(0, 0).setDepth(DEPTH.slot - 0.5); // Schnee auf Krone und Wiese
    this.top = scene.add.container(0, 0).setDepth(DEPTH.room + 0.5); // Schnee auf den Balkondächern
    this.makeSnowCover();
    this.makeSnowfall();

    if (scene.mode === 'tree') scene.flyTo({ x: WORLD_W / 2, y: 2600, zoom: 0.4 }, 1800);
  }

  get residents() {
    return this.scene.residents;
  }

  // ---------- Schnee ----------

  // Hauben auf den vorderen Kronenstücken, Decke auf der Wiese, Hauben auf den Balkondächern – alles erst unsichtbar,
  // dann wächst der Schnee (in update)
  makeSnowCover() {
    const rng = makeRng(31);
    this.cover = [];
    const add = (layer, x, y, w, k, flat = 0.8) => {
      const img = this.scene.add.image(x, y, `snow-cap-${this.cover.length % 3}`).setOrigin(0.5, 0.85);
      img.full = { sx: w / 220, sy: (w / 220) * flat };
      img.k = k; // wann diese Haube zu wachsen beginnt (0 … 1)
      img.setScale(img.full.sx, 0).setAlpha(0);
      layer.add(img);
      this.cover.push(img);
    };
    for (const pc of crownLayout(TREE_PARTS.krone).filter((p) => !p.back)) {
      const p = W(pc.x + (rng() - 0.5) * 40, pc.y - 150 * pc.s);
      add(this.layer, p.x, p.y, 300 * pc.s, rng() * 0.6);
    }
    // Balkondächer der eingerichteten Balkone
    for (const room of this.scene.rooms) {
      if (room.life.dead || !room.def.open) continue;
      const geo = room.view.geo;
      const p = room.view.toWorld(0, geo.innerTop - 26);
      add(this.top, p.x, p.y, geo.W * TREE_SCALE * 0.95, 0.3 + rng() * 0.3, 0.3);
    }
    // Wiese: Schneewehen nebeneinander
    for (let x = -2200; x < WORLD_W + 2200; x += 360) {
      const img = this.scene.add.image(x, MEADOW_Y + 26 + rng() * 10, 'snow-drift').setOrigin(0.5, 0.6).setAlpha(0);
      img.full = { sx: 1, sy: 1 };
      img.k = 0.2 + rng() * 0.5;
      img.setScale(1, 0);
      this.layer.add(img);
      this.cover.push(img);
    }
  }

  growCover() {
    const u = Math.min(1, this.t / SNOW_GROW);
    for (const img of this.cover) {
      const v = Phaser.Math.Clamp((u - img.k) / (1 - img.k * 0.9), 0, 1);
      img.setAlpha(Math.min(1, v * 2.5));
      img.setScale(img.full.sx, img.full.sy * (0.35 + 0.65 * v));
    }
  }

  // fallende Flocken im sichtbaren Ausschnitt
  makeSnowfall() {
    this.snowZone = new Phaser.Geom.Rectangle(0, 0, 10, 10);
    const zoom = () => this.scene.camView?.zoom ?? 0.5;
    this.snow = this.scene.add
      .particles(0, 0, 'snow-flake', {
        frequency: 30,
        lifespan: 9000,
        speedY: { min: 70, max: 140 },
        speedX: { min: -25, max: 35 },
        scale: { onEmit: () => rand(0.6, 1.3) / zoom() * 0.55 },
        alpha: { start: 0.95, end: 0.5 },
        emitZone: { type: 'random', source: this.snowZone },
      })
      .setDepth(DEPTH.room - 0.5); // vor Baum und Balkonen, aber nicht vor den Innenräumen (dort schneit es nicht)
    this.followView();
  }

  followView() {
    const v = this.scene.camView;
    if (!v) return;
    const w = GAME_W / v.zoom;
    const h = GAME_H / v.zoom;
    this.snowZone.setTo(v.x - w * 0.65, v.y - h * 0.85, w * 1.3, h * 0.9);
  }

  // ---------- Ablauf ----------

  update(dt) {
    if (this.done) return;
    this.t += dt;
    this.phaseT += dt;
    this.followView();
    if (this.phase !== 'melting') this.growCover();
    const ph = this.phase;
    if (ph === 'snowing' && this.phaseT >= GATHER_AT) this.gather();
    else if (ph === 'play') this.play(dt);
    else if (ph === 'home') this.goingHome();
    else if (ph === 'cozy' && this.phaseT >= COZY) this.melt();
  }

  setPhase(p) {
    this.phase = p;
    this.phaseT = 0;
  }

  // alle Feen heraus: Baumeisterinnen zu den Balkonen, die anderen paarweise zum Schneeballwerfen
  gather() {
    this.setPhase('play');
    for (const room of this.scene.rooms) {
      if (room.life.dead) continue;
      for (const f of [...room.life.fairies]) {
        if (f.state === 'held') continue;
        this.crew.push({ f, home: room });
        this.residents.lift(f, room);
      }
    }
    if (!this.crew.length) return this.startHome();

    // Schneefeen: je Balkon-Zimmer eine (bis zu zwei Feen bauen), ohne Balkon unten auf der Wiese
    const balconies = this.scene.rooms.filter((r) => !r.life.dead && r.def.open);
    const sites = balconies.length ? balconies.map((r) => this.balconySite(r)) : [this.meadowSite()];
    const free = [...this.crew];
    for (const site of sites) {
      for (let k = 0; k < 2 && free.length; k++) {
        const c = free.shift();
        c.site = site;
        c.side = k ? 1 : -1;
        site.builders.push(c);
      }
    }
    // die anderen paarweise; eine übrige baut mit
    const pairs = [];
    while (free.length >= 2) pairs.push([free.shift(), free.shift()]);
    if (free.length) {
      const c = free.shift();
      c.site = sites[0];
      c.side = 0;
      sites[0].builders.push(c);
    }
    pairs.forEach((pair, i) => this.setupPair(pair, PAIR_SPOTS[i % PAIR_SPOTS.length], i));
    for (const site of sites) {
      site.builders.forEach((c) => c.f.goTo(this.builderPos(c), 700).then(() => c.f.active && c.f.hold()));
      site.next = 1.5;
    }
    this.sites = sites;
  }

  // Bauplatz auf dem Balkon: Mitte des Bodens (in der Raum-Ansicht, damit die Schneefee mitskaliert)
  balconySite(room) {
    const geo = room.view.geo;
    return { room, parent: room.view.items, x: geo.gridX0 + geo.cols * 40 + 60, y: geo.floorY, k: 1, builders: [], step: 0, parts: [] };
  }

  meadowSite() {
    const x = TRUNK_X + sway(GROUND_Y) + halfWidth(GROUND_Y) * 0.55 + OX;
    return { room: null, parent: this.layer, x, y: MEADOW_Y + 12, k: TREE_SCALE, builders: [], step: 0, parts: [] };
  }

  // Bauplatz → Welt
  siteWorld(site, lx, ly) {
    return site.room ? site.room.view.toWorld(lx, ly) : { x: lx, y: ly };
  }

  builderPos(c) {
    const s = c.site;
    const p = this.siteWorld(s, s.x + c.side * 90, s.y - 150);
    return { x: p.x, y: p.y - (c.side === 0 ? 50 : 0) };
  }

  // ein Bauabschnitt: die Feen klopfen den Schnee fest, das nächste Teil erscheint mit einem Puff
  buildStep(site) {
    if (site.room?.life.dead) return;
    const [key, , above] = PARTS[site.step];
    const img = this.scene.add.image(site.x, site.y - above * site.k, key).setOrigin(0.5, 1).setScale(site.k);
    site.parent.add(img);
    site.parts.push(img);
    popIn(this.scene, img, { from: 0, to: site.k, duration: 450 });
    const p = this.siteWorld(site, site.x, site.y - (above + 30) * site.k);
    this.scene.sparkles.burst(p.x, p.y, 10);
    for (const c of site.builders) {
      if (!c.f.active) continue;
      c.f.pose.tilt = 0.4;
      this.scene.time.delayedCall(350, () => c.f.active && (c.f.pose.tilt = 0));
    }
    site.step++;
    if (site.step === PARTS.length) this.snowmen.push(site);
  }

  // Schneeball-Paar: zwei Feen nebeneinander am Stamm, werfen sich abwechselnd den Ball zu
  setupPair([a, b], [side, y], i) {
    const edge = TRUNK_X + sway(y) + side * (halfWidth(y) + 130);
    const pa = W(edge, y);
    const pb = W(edge + side * 340, y + 40);
    a.spot = pa;
    b.spot = pb;
    a.f.goTo(pa, 700).then(() => a.f.active && a.f.hold());
    b.f.goTo(pb, 700).then(() => b.f.active && b.f.hold());
    (this.pairs ??= []).push({ a, b, next: 2 + i * 0.4, turn: 0 });
  }

  throwBall(pair) {
    const [from, to] = pair.turn % 2 ? [pair.b, pair.a] : [pair.a, pair.b];
    pair.turn++;
    if (!from.f.active || !to.f.active) return;
    const scene = this.scene;
    const s = { x: from.f.x, y: from.f.y - 10 };
    const e = { x: to.f.x, y: to.f.y - 10 };
    from.f.pose.tilt = -0.4;
    scene.time.delayedCall(300, () => from.f.active && (from.f.pose.tilt = 0));
    const ball = scene.add.image(s.x, s.y, 'snow-ball').setScale(0.9).setDepth(DEPTH.fx);
    const arc = { u: 0 };
    scene.tweens.add({
      targets: arc,
      u: 1,
      duration: 750,
      ease: 'Sine.InOut',
      onUpdate: () => {
        const u = arc.u;
        ball.setPosition(s.x + (e.x - s.x) * u, s.y + (e.y - s.y) * u - Math.sin(u * Math.PI) * 140);
        ball.rotation = u * 6;
        if (Math.random() < 0.3) scene.sparkles.twinkle(ball.x, ball.y, 1);
      },
      onComplete: () => {
        ball.destroy();
        scene.sparkles.burst(e.x, e.y - 10, 8);
        if (to.f.active) {
          to.f.pose.bob = 2;
          scene.time.delayedCall(500, () => to.f.active && (to.f.pose.bob = 0.5));
        }
      },
    });
  }

  play(dt) {
    for (const site of this.sites ?? []) {
      if (site.step >= PARTS.length) continue;
      site.next -= dt;
      if (site.next <= 0) {
        site.next = BUILD_STEP;
        this.buildStep(site);
      }
    }
    for (const pair of this.pairs ?? []) {
      pair.next -= dt;
      if (pair.next <= 0) {
        pair.next = THROW_EVERY;
        this.throwBall(pair);
      }
    }
    if (this.phaseT > PLAY_TIME) {
      for (const site of this.sites ?? []) while (site.step < PARTS.length) this.buildStep(site);
      this.startHome();
    }
  }

  // ---------- Heißer Kakao ----------

  startHome() {
    this.setPhase('home');
    const cups = new Map(); // Zimmer → wie viele Feen dort schon Kakao trinken
    for (const c of this.crew) {
      if (!c.f.active) continue;
      c.away = true;
      c.f.resetPose();
      this.residents.flyInto(c.f, c.home, (room) => {
        c.away = false;
        const stove = [...room.view.stickers.values()].find((s) => s.def.id === 'kamin' || s.def.id === 'ofen');
        if (!stove) return false;
        const i = cups.get(room) ?? 0;
        cups.set(room, i + 1);
        return room.life.director.startJob(c.f, cocoa, { stove, i });
      });
    }
  }

  goingHome() {
    if (this.crew.every((c) => !c.away || !c.f.active) || this.phaseT > HOME_MAX) this.setPhase('cozy');
  }

  // ---------- Tauwetter ----------

  melt() {
    this.setPhase('melting');
    const scene = this.scene;
    this.snow.stop();
    scene.clock.setChill(false);
    for (const img of this.cover) {
      scene.tweens.add({ targets: img, alpha: 0, scaleY: img.scaleY * 0.3, delay: rand(0, 2500), duration: 2200, ease: 'Sine.In' });
    }
    for (const site of this.snowmen) {
      site.parts.forEach((img, i) => {
        if (!img.active) return;
        scene.tweens.add({ targets: img, scaleY: 0, alpha: 0, delay: 1500 + (PARTS.length - i) * 400, duration: 1800, ease: 'Sine.In' });
      });
      const p = this.siteWorld(site, site.x, site.y - 60);
      scene.time.delayedCall(1800, () => scene.sparkles.twinkle(p.x, p.y, 4));
    }
    scene.time.delayedCall(MELT * 1000, () => this.end());
  }

  end() {
    if (this.done) return;
    this.done = true;
    const scene = this.scene;
    scene.clock.paused = false;
    scene.clock.setChill(false);
    for (const site of this.sites ?? []) for (const img of site.parts) img.destroy();
    this.layer.destroy();
    this.top.destroy();
    this.snow.destroy();
  }
}
