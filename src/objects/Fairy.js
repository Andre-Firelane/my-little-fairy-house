import Phaser from 'phaser';
import { DEPTH } from '../config/layout.js';
import { fillStar } from '../systems/draw.js';
import { bake, bakedImage } from '../systems/bake.js';
import { clamp, damp, rand, hover, wingFlap, cubicBezier, makeCurve, easeInOutSine } from '../systems/motion.js';

const FAIRY_RES = 2; // Feen-Texturen in doppelter Auflösung (sie sind klein, kostet kaum Speicher)

// Fee aus Vektorteilen. Bewegung komplett per Mathe:
//  - Basisposition folgt Bezier-Bahnen (wander / fly)
//  - darüber Sinus-Schweben, Flügel per scaleX-Sinus, Neigung nach Geschwindigkeit
// Zustände: 'wander' (zufällige Ziele), 'fly' (zu einem Punkt), 'visit' (schwebt dort glitzernd),
//           'script' (eine Tätigkeit steuert sie), 'held' (das Kind hält sie mit dem Finger)
// Eine Fee wohnt in einem Raum: home liefert den Bereich zum Herumfliegen (getWanderArea),
// parent ist der Container, in dem sie lebt (alle Koordinaten sind dann Raum-Koordinaten).
export default class Fairy extends Phaser.GameObjects.Container {
  constructor(scene, x, y, palette, sparkles, scale = 1.5, home = scene, parent = null) {
    super(scene, x, y);
    this.home = home;
    this.palette = palette;
    this.sparkles = sparkles;
    this.pos = { x, y };
    this.t = 0;
    this.phase = Math.random() * 10;
    this.facing = 1;
    this.vx = 0;
    this.path = null;
    this.state = 'wander';
    this.pause = rand(0, 1);
    this.visitTime = 0;
    this.twinkleTimer = 0;
    this.onVisitDone = null;
    this.carrying = null;
    this.resetPose();

    this.visual = scene.add.container(0, 0);
    const glow = scene.add.image(0, 0, 'sparkle').setScale(3.4).setTint(palette.glow).setAlpha(0.5).setBlendMode('ADD');
    // Körper und Flügel sind gebacken (doppelte Auflösung, damit sie vergrößert scharf bleiben)
    this.wingL = this.makeWing(-1);
    this.wingR = this.makeWing(1);
    this.outfit = 'dress';
    this.body = bakedImage(scene, this.bodyKey('dress'), 50, 76, (g) => this.drawBody(g, 'dress'), { ox: 18, oy: 42, res: FAIRY_RES });
    this.visual.add([glow, this.wingL, this.wingR, this.body]);
    this.add(this.visual);
    this.setScale(scale).setDepth(DEPTH.fairy);
    this.speed = scale / 1.5; // kleinere Feen fliegen langsamer (Pixel pro Sekunde)
    if (parent) parent.add(this);
    else scene.add.existing(this);

    this.trail = sparkles.trail(this);
    this.trail.setFrequency(110);
  }

  // Flügel mit Ursprung an der Schulter, damit scaleX um die Schulter "klappt"
  makeWing(side) {
    const key = `fairy-wing-${this.palette.name}-${side}`;
    const img = bakedImage(this.scene, key, 52, 52, (g) => {
      g.fillStyle(this.palette.wing, 0.75);
      g.fillEllipse(side * 24, -14, 46, 32);
      g.fillEllipse(side * 16, 8, 28, 20);
      g.lineStyle(2.5, 0xffffff, 0.9);
      g.strokeEllipse(side * 24, -14, 46, 32);
      g.strokeEllipse(side * 16, 8, 28, 20);
    }, { ox: side < 0 ? 50 : 2, oy: 32, res: FAIRY_RES });
    img.y = -2;
    return img;
  }

  bodyKey(outfit) {
    return `fairy-body-${this.palette.name}-${outfit}`;
  }

  // Kleidung wechseln: 'dress' (eigenes Kleid) oder 'pj' (weißer Schlafanzug mit Zipfelmütze)
  setOutfit(outfit) {
    if (outfit === this.outfit) return;
    this.outfit = outfit;
    const key = bake(this.scene, this.bodyKey(outfit), 50, 76, (g) => this.drawBody(g, outfit), 18, 42, FAIRY_RES);
    this.body.setTexture(key);
  }

  drawBody(g, outfit = 'dress') {
    const p = this.palette;
    const pj = outfit === 'pj';
    g.lineStyle(3, 0xffe0c7, 1);
    g.lineBetween(-5, 22, -5, 31);
    g.lineBetween(5, 22, 5, 31);
    g.fillStyle(pj ? 0xffffff : p.dress, 1);
    g.fillTriangle(0, -8, -16, 24, 16, 24);
    if (pj) {
      g.fillStyle(0xb9d8ff, 1);
      for (const [x, y] of [[-6, 16], [5, 10], [0, 20], [8, 20], [-2, 4]]) g.fillCircle(x, y, 1.8);
    }
    g.fillStyle(0xffe0c7, 1);
    g.fillCircle(0, -17, 12);
    g.fillStyle(p.hair, 1);
    g.slice(0, -19, 13.5, Math.PI, 0, false);
    g.fillPath();
    g.fillCircle(-11, -16, 5);
    g.fillCircle(11, -16, 5);
    g.fillStyle(0x3b2a4a, 1);
    g.fillCircle(-4, -15, 1.9);
    g.fillCircle(4, -15, 1.9);
    g.fillStyle(0xff8fa8, 0.55);
    g.fillCircle(-7, -11, 2.6);
    g.fillCircle(7, -11, 2.6);
    // Zauberstab
    g.lineStyle(2.5, 0xfff3a8, 1);
    g.lineBetween(10, 6, 22, -8);
    g.fillStyle(0xfff3a8, 1);
    fillStar(g, 22, -9, 6, 2.6, 5);
    if (pj) {
      // Zipfelmütze
      g.fillStyle(0xffffff, 1);
      g.fillTriangle(-12, -24, 12, -24, 14, -38);
      g.fillStyle(0xb9d8ff, 1);
      g.fillRoundedRect(-13, -27, 26, 6, 3);
      g.fillStyle(0xfff3a8, 1);
      g.fillCircle(15, -39, 4);
    }
  }

  // ---------- Steuerung ----------

  wander() {
    this.state = 'wander';
    this.trail.setFrequency(110);
    this.pause = rand(0.2, 0.8);
    this.path = null;
  }

  // zu einem Punkt fliegen und dort eine Weile glitzernd schweben
  visit(target, onDone, { duration = 4, spread = 50 } = {}) {
    this.state = 'fly';
    this.onVisitDone = onDone;
    this.trail.setFrequency(22);
    const to = { x: target.x + rand(-spread, spread), y: target.y };
    this.flyTo(to, 340 * this.speed, () => {
      this.state = 'visit';
      this.visitTime = duration;
      this.sparkles.burst(this.x, this.y, 10);
    });
  }

  // ---- für Tätigkeiten (Skripte) ----

  // Haltung: tilt = vorbeugen, fold = Flügel anlegen (0..1), bob = Schwebe-Stärke,
  // orbit = Kreisen in px (z. B. Rühren), face = feste Blickrichtung (-1/1, 0 = frei),
  // roll = ganze Fee drehen (−π/2 = liegt, Kopf nach links – zum Schlafen)
  resetPose() {
    this.pose = { tilt: 0, fold: 0, bob: 1, orbit: 0, orbitSpeed: 3.2, face: 0, roll: 0 };
  }

  // fliegen und warten, bis sie da ist
  goTo(target, speed = 240) {
    this.state = 'script';
    return new Promise((resolve) => this.flyTo(target, speed * this.speed, resolve));
  }

  hold() {
    this.state = 'script';
    this.path = null;
  }

  // in einen anderen Container umziehen (Zimmer ↔ Reise-Ebene); x, y in dessen Koordinaten
  moveInto(parent, home, sparkles, scale, x, y) {
    this.parentContainer?.remove(this);
    parent.add(this);
    this.home = home;
    this.dropTrail();
    this.sparkles = sparkles;
    this.trail = sparkles.trail(this);
    this.trail.setFrequency(110);
    this.setScale(scale);
    this.speed = scale / 1.5;
    this.pos = { x, y };
    this.setPosition(x, y);
    this.path = null;
    this.vx = 0;
    this.carrying = null;
    this.resetPose();
  }

  dropTrail() {
    if (!this.trail) return;
    this.sparkles.trails = this.sparkles.trails.filter((t) => t !== this.trail);
    this.trail.destroy();
    this.trail = null;
  }

  // obj lebt im selben Container wie die Fee und hängt dy unter ihr
  carry(obj, dy) {
    this.carrying = { obj, dy };
  }

  dropCarry() {
    const c = this.carrying;
    this.carrying = null;
    c?.obj.setAngle(0);
    return c?.obj;
  }

  flyTo(target, speed, onArrive) {
    const curve = makeCurve(this.pos, target);
    this.path = { ...curve, elapsed: 0, dur: Math.max(0.6, curve.length / speed), onArrive };
  }

  nextWanderTarget() {
    const a = this.home.getWanderArea();
    return { x: rand(a.x1, a.x2), y: rand(a.y1, a.y2) };
  }

  // ---------- Render-Loop ----------

  update(dt) {
    this.t += dt;
    const prevX = this.pos.x;

    if (this.path) {
      const p = this.path;
      p.elapsed += dt;
      const u = Math.min(1, p.elapsed / p.dur);
      this.pos = cubicBezier(p.p0, p.p1, p.p2, p.p3, easeInOutSine(u));
      if (u >= 1) {
        this.path = null;
        p.onArrive?.();
      }
    } else if (this.state === 'wander') {
      this.pause -= dt;
      if (this.pause <= 0) {
        this.flyTo(this.nextWanderTarget(), rand(140, 200) * this.speed, () => (this.pause = rand(0.4, 1.6)));
      }
    } else if (this.state === 'visit') {
      this.visitTime -= dt;
      this.twinkleTimer -= dt;
      if (this.twinkleTimer <= 0) {
        this.twinkleTimer = 0.3;
        this.sparkles.twinkle(this.x, this.y + 10, 2);
      }
      if (this.visitTime <= 0) {
        const done = this.onVisitDone;
        this.onVisitDone = null;
        this.wander();
        done?.();
      }
    }

    // Geschwindigkeit für Blickrichtung und Neigung
    this.vx = damp(this.vx, (this.pos.x - prevX) / Math.max(dt, 1e-3), 8, dt);

    // Schweben (beim Besuch zusätzlich eine kleine Acht), Haltung dämpft bzw. ergänzt es
    const pose = this.pose;
    const visiting = this.state === 'visit';
    const k = (this.scaleX / 1.5) * pose.bob; // Schwebe-Ausschlag passend zur Größe
    const ot = this.t * pose.orbitSpeed;
    const hx = (Math.sin(this.t * 1.1 + this.phase) * 6 + (visiting ? Math.sin(this.t * 1.6) * 28 : 0)) * k + Math.cos(ot) * pose.orbit;
    const hy = (hover(this.t, 12, 0.5, this.phase) + (visiting ? Math.sin(this.t * 3.2) * 10 : 0)) * k + Math.sin(ot) * pose.orbit * 0.35;
    this.setPosition(this.pos.x + hx, this.pos.y + hy);

    // Flügel (angelegt = schmal und langsam)
    const rate = this.state === 'fly' || this.state === 'held' ? 22 : 15 * (1 - 0.6 * pose.fold);
    const flap = wingFlap(this.t, rate, this.phase) * (1 - pose.fold) + 0.3 * pose.fold;
    this.wingL.scaleX = flap / FAIRY_RES;
    this.wingR.scaleX = flap / FAIRY_RES;
    this.wingL.rotation = (1 - flap) * 0.25;
    this.wingR.rotation = -(1 - flap) * 0.25;

    // Richtung und Neigung
    if (pose.face) this.facing = pose.face;
    else if (pose.orbit > 0) this.facing = Math.sin(ot) > 0 ? -1 : 1;
    else if (Math.abs(this.vx) > 30) this.facing = Math.sign(this.vx);
    this.visual.scaleX = damp(this.visual.scaleX, this.facing, 10, dt);
    const lean = clamp(this.vx * 0.0009, -0.3, 0.3) + pose.tilt * this.facing + pose.roll;
    this.visual.rotation = damp(this.visual.rotation, lean, 6, dt);

    // Getragenes Ding hängt unter der Fee und schaukelt leicht
    const c = this.carrying;
    if (c) {
      c.obj.setPosition(this.x, this.y + c.dy);
      c.obj.angle = Math.sin(this.t * 3) * 5;
    }
  }
}
