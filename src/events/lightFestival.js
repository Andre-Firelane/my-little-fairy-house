import { DEPTH, WORLD_W } from '../config/layout.js';
import { OX, OY, TRUNK_X, sway, halfWidth } from '../config/treeShape.js';
import { rand } from '../systems/motion.js';
import { track, smoothPath } from './paths.js';

// Event „Lichterfest“: es wird Abend (warmes Dämmerlicht, die Feen bleiben wach, siehe systems/dayNight.js).
//  1. Schmücken: alle Feen fliegen aus ihren Zimmern und hängen Lichterketten in den Baum – hinter jeder Fee
//     gehen die Lämpchen nacheinander an.
//  2. Laternenumzug: die Feen tauschen den Zauberstab gegen eine Laterne und fliegen hintereinander um den Baum:
//     außen hinauf, über die Krone, im Zickzack zwischen den Zimmern hinunter und unten über die Wiese.
//  3. Heimweg: die Feen fliegen in ihre Zimmer und nehmen wieder den Zauberstab; der Abend geht in die Nacht über.
//     Die Lichterketten leuchten die ganze Nacht und gehen am Morgen aus.
// Gehört der Baum-Szene (TreeScene.happening); wird nicht gespeichert.

const START_AFTER = 2.5; // Sekunden: erst kommt das Abendlicht, dann fliegen die Feen heraus
const HANG_SPEED = 240; // so schnell zieht eine Fee die Kette entlang (Weltpixel je Sekunde)
const DECORATE_MAX = 32; // spätestens dann ist alles geschmückt (der Rest geht von selbst an)
const LINEUP_MAX = 9; // so lange warten die Feen höchstens, bis alle zum Umzug bereitstehen
const PARADE_TIME = 60; // Sekunden Laternenumzug
const PARADE_SPEED = 230;
const SPACING = 150; // Abstand der Feen im Umzug
const HOME_MAX = 14; // spätestens dann wird es Nacht, auch wenn noch eine Fee unterwegs ist
const BULB_GAP = 44; // Abstand der Lämpchen
const LIGHTS = [0xffd166, 0xff8fc0, 0x8fdcff, 0xb6f58a, 0xd3a6ff, 0xffa86b];

// Lichterketten in Baum-Koordinaten (config/treeShape.js): Aufhängepunkte, dazwischen hängt die Kette durch (sag)
function trunkWrap(y, tilt) {
  const c = TRUNK_X + sway(y);
  const w = halfWidth(y) - 50;
  return { pts: [[c - w, y - tilt], [c, y], [c + w, y + tilt]], sag: 45 };
}
const GARLANDS = [
  // Krone: drei Bögen-Reihen übereinander
  { pts: [[480, -330], [880, -430], [1280, -450], [1680, -420], [2020, -260]], sag: 90 },
  { pts: [[-180, 220], [250, 70], [720, 70], [1200, 20], [1680, 60], [2150, 110], [2580, 240]], sag: 110 },
  { pts: [[-440, 760], [-60, 620], [330, 680]], sag: 90 },
  { pts: [[2230, 600], [2570, 640], [2880, 780]], sag: 90 },
  // zwischen den Hauptästen
  { pts: [[480, 860], [1180, 800]], sag: 150 },
  { pts: [[1260, 800], [1880, 860]], sag: 150 },
  // um den Stamm, zwischen den Zimmer-Reihen
  trunkWrap(1690, 25),
  trunkWrap(2250, -25),
  trunkWrap(2840, 25),
  trunkWrap(3410, -25),
  trunkWrap(3995, 25),
];

// Weg des Laternenumzugs (Baum-Koordinaten, geschlossen): links außen hinauf, über die Krone,
// im Zickzack zwischen den Zimmern hinunter, unten über die Wiese zurück
const PARADE = [
  [-80, 4300], [-130, 3400], [-90, 2500], [-200, 1700], [-380, 900], [-330, 250], [150, -380], [700, -760],
  [1200, -830], [1720, -800], [2280, -430], [2780, 200], [2830, 900], [2420, 1450],
  [2150, 1760], [1200, 1770], [250, 1760], [210, 2050],
  [250, 2330], [1200, 2340], [2150, 2330], [2190, 2620],
  [2150, 2920], [1200, 2930], [250, 2920], [210, 3200],
  [250, 3490], [1200, 3500], [2150, 3490], [2400, 3950],
  [2150, 4620], [1200, 4760], [300, 4640],
];

const W = ([x, y]) => ({ x: x + OX, y: y + OY });
const smoothLoop = (points) => smoothPath(points.map(W));

// durchhängende Kette zwischen den Aufhängepunkten, fein abgetastet
function swagPoints(g) {
  const out = [];
  const anchors = g.pts.map(W);
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i];
    const b = anchors[i + 1];
    for (let k = i ? 1 : 0; k <= 24; k++) {
      const u = k / 24;
      out.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u + g.sag * 4 * u * (1 - u) });
    }
  }
  return out;
}

export default class LightFestival {
  constructor(scene) {
    this.scene = scene;
    this.id = 'lights';
    this.t = 0;
    this.phase = 'evening';
    this.done = false;
    scene.clock.startEvening();

    // Ebenen: über dem Nachtschleier (die Lämpchen leuchten), unter den Zimmern (die Ketten laufen hinter ihnen)
    this.wires = scene.add.container(0, 0).setDepth(DEPTH.slot + 0.55);
    this.glows = scene.add.container(0, 0).setDepth(DEPTH.slot + 0.6);
    this.cores = scene.add.container(0, 0).setDepth(DEPTH.slot + 0.65);
    this.makeGarlands();
    this.parade = track(smoothLoop(PARADE), true);
    this.crew = [];

    // Blick auf den Baum, damit man das Schmücken sieht
    if (scene.mode === 'tree') scene.flyTo({ x: WORLD_W / 2, y: 1200 + OY, zoom: 0.5 }, 1800);
  }

  makeGarlands() {
    let c = 0;
    this.garlands = GARLANDS.map((g) => {
      const line = swagPoints(g);
      const tr = track(line);
      const bulbs = [];
      for (let s = 10; s < tr.length; s += BULB_GAP) bulbs.push({ s, ...tr.at(s), color: LIGHTS[c++ % LIGHTS.length], on: false });
      return { track: tr, bulbs, lit: 0, busy: false };
    });
    this.bulbs = this.garlands.flatMap((g) => g.bulbs);
  }

  // ein Lämpchen geht an (mit Draht zum vorigen)
  light(g, i) {
    const b = g.bulbs[i];
    if (b.on) return;
    b.on = true;
    b.phase = Math.random() * 10;
    b.speed = rand(1.6, 3.2);
    const prev = g.bulbs[i - 1];
    if (prev) {
      const len = Math.hypot(b.x - prev.x, b.y - prev.y);
      this.wires.add(
        this.scene.add.image((b.x + prev.x) / 2, (b.y + prev.y) / 2 - 5, '__WHITE').setTint(0x3a2c3c).setAlpha(0.85)
          .setDisplaySize(len, 3).setRotation(Math.atan2(b.y - prev.y, b.x - prev.x)),
      );
    }
    b.glow = this.scene.add.image(b.x, b.y + 4, 'sparkle').setTint(b.color).setBlendMode('ADD').setScale(0.2).setAlpha(0.9);
    b.core = this.scene.add.image(b.x, b.y + 4, 'sparkle').setTint(b.color).setScale(0.2);
    b.cap = this.scene.add.image(b.x, b.y - 3, '__WHITE').setTint(0x3a2c3c).setDisplaySize(6, 6);
    this.glows.add(b.glow);
    this.cores.add([b.cap, b.core]);
    this.scene.tweens.add({ targets: b.glow, scale: 1.7, duration: 380, ease: 'Back.Out' });
    this.scene.tweens.add({ targets: b.core, scale: 0.42, duration: 300, ease: 'Back.Out' });
  }

  get residents() {
    return this.scene.residents;
  }

  update(dt) {
    if (this.done) return;
    this.t += dt;
    const ph = this.phase;
    if (ph === 'evening' && this.t >= START_AFTER) this.gather();
    else if (ph === 'decorate') this.decorate(dt);
    else if (ph === 'lineup') this.lineup(dt);
    else if (ph === 'parade') this.march(dt);
    else if (ph === 'home') this.goingHome(dt);
    else if (ph === 'night') this.night(dt);
    this.twinkle();
  }

  // Lämpchen funkeln, jedes in seinem eigenen Takt
  twinkle() {
    const t = this.t;
    const fade = this.fade ?? 1;
    for (const b of this.bulbs) {
      if (!b.glow) continue;
      const k = 0.62 + 0.38 * Math.sin(t * b.speed + b.phase);
      b.glow.alpha = k * fade;
      b.core.alpha = (0.75 + 0.25 * k) * fade;
      b.cap.alpha = fade;
    }
  }

  // ---------- 1. Schmücken ----------

  // alle Feen fliegen aus ihren Zimmern (wer gerade gehalten wird, bleibt)
  gather() {
    this.phase = 'decorate';
    this.phaseT = 0;
    const res = this.residents;
    let k = 0;
    for (const room of this.scene.rooms) {
      if (room.life.dead) continue;
      for (const f of [...room.life.fairies]) {
        if (f.state === 'held') continue;
        this.crew.push({ f, home: room, job: null, wait: (k++ % 12) * 0.35 });
        res.lift(f, room);
      }
    }
  }

  decorate(dt) {
    this.phaseT += dt;
    for (const c of this.crew) {
      if (c.job || c.flying) continue;
      if (c.wait > 0) {
        c.wait -= dt;
        continue;
      }
      // nächste noch dunkle Kette, die niemand macht (am liebsten die nächstgelegene)
      const free = this.garlands.filter((g) => !g.busy && g.lit < g.bulbs.length);
      if (!free.length) {
        if (!c.resting) this.rest(c);
        continue;
      }
      const dist = (g) => Math.hypot(g.bulbs[0].x - c.f.pos.x, g.bulbs[0].y - c.f.pos.y);
      const g = free.sort((a, b) => dist(a) - dist(b))[0];
      g.busy = true;
      c.flying = true;
      c.resting = false;
      const start = g.track.at(0);
      c.f.goTo({ x: start.x, y: start.y - 28 }, 800).then(() => {
        c.flying = false;
        c.job = { g, s: 0 };
        c.f.hold();
      });
    }
    // Ketten entlangziehen, die Lämpchen gehen hinter der Fee an
    for (const c of this.crew) {
      const j = c.job;
      if (!j) continue;
      j.s += HANG_SPEED * dt;
      const p = j.g.track.at(j.s);
      c.f.pos = { x: p.x, y: p.y - 28 };
      const bulbs = j.g.bulbs;
      while (j.g.lit < bulbs.length && bulbs[j.g.lit].s <= j.s) {
        this.light(j.g, j.g.lit);
        if (j.g.lit % 3 === 0) this.scene.sparkles.twinkle(p.x, p.y, 2);
        j.g.lit++;
      }
      if (j.s >= j.g.track.length) {
        c.job = null;
        this.scene.sparkles.burst(p.x, p.y - 20, 10);
      }
    }
    const allLit = this.garlands.every((g) => g.lit >= g.bulbs.length);
    if (allLit || this.phaseT > DECORATE_MAX) {
      if (!allLit) this.lightRest();
      if (this.crew.some((c) => c.job)) return; // wer noch zieht, macht fertig
      this.startLineup();
    }
  }

  // eine Fee ohne Kette schwebt glitzernd am Baum und schaut zu
  rest(c) {
    c.resting = true;
    const p = this.parade.at(rand(0, this.parade.length));
    c.flying = true;
    c.f.goTo({ x: p.x, y: p.y }, 500).then(() => {
      c.flying = false;
    });
  }

  // Zeit um (oder keine Feen): die übrigen Ketten gehen von selbst nacheinander an
  lightRest() {
    for (const c of this.crew) {
      if (c.job) c.job.g.busy = 'forced';
    }
    let delay = 0;
    for (const g of this.garlands) {
      if (g.busy === 'forced' && this.crew.some((c) => c.job?.g === g)) continue;
      while (g.lit < g.bulbs.length) {
        const i = g.lit++;
        this.scene.time.delayedCall(delay, () => this.light(g, i));
        delay += 25;
      }
    }
  }

  // ---------- 2. Laternenumzug ----------

  startLineup() {
    this.phase = 'lineup';
    this.phaseT = 0;
    const n = this.crew.length;
    this.crew.forEach((c, i) => {
      c.s = (n - 1 - i) * SPACING;
      c.ready = false;
      const p = this.parade.at(c.s);
      c.f.goTo(p, 800).then(() => this.swap(c, 'lantern'));
    });
    if (!n) this.startHome();
  }

  // Zauberstab ↔ Laterne, mit Glitzer
  swap(c, held) {
    if (!c.f.active) return;
    c.ready = true;
    c.f.setHeld(held);
    this.scene.sparkles.burst(c.f.x, c.f.y, 8);
  }

  lineup(dt) {
    this.phaseT += dt;
    if (this.crew.every((c) => c.ready || !c.f.active) || this.phaseT > LINEUP_MAX) {
      for (const c of this.crew) {
        if (!c.ready) this.swap(c, 'lantern');
        c.f.hold();
      }
      this.phase = 'parade';
      this.phaseT = 0;
    }
  }

  march(dt) {
    this.phaseT += dt;
    for (const c of this.crew) {
      if (!c.f.active) continue;
      c.s += PARADE_SPEED * dt;
      c.f.pos = this.parade.at(c.s);
    }
    if (this.phaseT > PARADE_TIME) this.startHome();
  }

  // ---------- 3. Heimweg, Nacht ----------

  startHome() {
    this.phase = 'home';
    this.phaseT = 0;
    for (const c of this.crew) {
      if (!c.f.active) {
        c.home = null;
        continue;
      }
      c.away = true;
      this.residents.flyInto(c.f, c.home, () => {
        c.away = false;
        this.swap(c, 'wand');
        return false; // danach wie gewohnt im Zimmer herumfliegen
      });
    }
  }

  goingHome(dt) {
    this.phaseT += dt;
    if (this.crew.every((c) => !c.away || !c.f.active) || this.phaseT > HOME_MAX) {
      // wer unterwegs noch die Laterne hat, legt sie ab
      for (const c of this.crew) if (c.f.active && c.f.held !== 'wand') c.f.setHeld('wand');
      this.scene.clock.endEvening();
      this.phase = 'night';
    }
  }

  // die Lichterketten leuchten die ganze Nacht, am Morgen gehen sie aus
  night(dt) {
    const clock = this.scene.clock;
    if (clock.night) this.sawNight = true;
    if (!this.sawNight || clock.night) return;
    this.fade = (this.fade ?? 1) - dt / 3;
    if (this.fade <= 0) this.end();
  }

  end() {
    this.done = true;
    this.wires.destroy();
    this.glows.destroy();
    this.cores.destroy();
  }
}
