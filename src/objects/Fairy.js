import Phaser from 'phaser';
import { DEPTH } from '../config/layout.js';
import { fillStar } from '../systems/draw.js';
import { bake, bakedImage } from '../systems/bake.js';
import { FAIRY_PARTS, LOOK_LAYERS, FIGURE, lookOf, partGeometry, partKey, fileKey } from '../config/fairyLooks.js';
import { clamp, damp, rand, hover, wingFlap, cubicBezier, makeCurve, easeInOutSine } from '../systems/motion.js';

const FAIRY_RES = 2; // Feen-Texturen in doppelter Auflösung (sie sind klein, kostet kaum Speicher)
const WING_SCALE = 1.25; // gezeichnete Flügel passend zur größeren gemalten Fee
const WING_Y = 4; // Flügelansatz unter dem Schulter-Anker der gemalten Fee

// Bild eines gemalten Teils, Ursprung am Schulter-Anker; side = -1 spiegelt (linker Flügel)
function partImage(scene, part, side = 1, file = part.file) {
  const geo = partGeometry(part);
  const img = scene.add.image(0, 0, fileKey(file)).setOrigin(geo.ox, geo.oy);
  const s = geo.h / img.height;
  return img.setScale(s * side, s);
}

// gezeichneter Flügel in einer Farbe (Ursprung an der Schulter, damit scaleX um die Schulter "klappt")
function drawnWing(scene, color, side, res = FAIRY_RES) {
  const key = res === FAIRY_RES ? `fairy-wing-${color}-${side}` : `fairy-wing-${color}-${side}@${res}`;
  return bakedImage(scene, key, 52, 52, (g) => {
    g.fillStyle(color, 0.75);
    g.fillEllipse(side * 24, -14, 46, 32);
    g.fillEllipse(side * 16, 8, 28, 20);
    g.lineStyle(2.5, 0xffffff, 0.9);
    g.strokeEllipse(side * 24, -14, 46, 32);
    g.strokeEllipse(side * 16, 8, 28, 20);
  }, { ox: side < 0 ? 50 : 2, oy: 32, res });
}

// Flügel der gemalten Fee: gemaltes Flügel-Teil oder gezeichnet in wingColor / Palettenfarbe.
// baseScale = Größe, um die das Flügelschlagen (scaleX) schwingt
// res = Auflösung der gezeichneten Flügel (groß gezeigte Vorschau: höher, sonst pixelig)
export function paintedWing(scene, look, palette, side, res = FAIRY_RES) {
  const part = FAIRY_PARTS.wings[look.wings];
  let img;
  if (part && scene.textures.exists(partKey(part))) {
    img = partImage(scene, part, side);
    img.baseScale = Math.abs(img.scaleY);
    img.flip = side; // linker Flügel = gespiegeltes Bild
  } else {
    img = drawnWing(scene, look.wingColor ?? palette.wing, side, res);
    img.baseScale = WING_SCALE / res;
  }
  img.y = WING_Y;
  return img;
}

// Flügelschlag (flap 0..1 aus wingFlap) auf ein Flügelpaar anwenden
export function flapWings(wingL, wingR, flap) {
  for (const [w, dir] of [[wingL, 1], [wingR, -1]]) {
    const ws = w.baseScale ?? 1 / FAIRY_RES;
    w.scaleX = flap * ws * (w.flip ?? 1);
    w.scaleY = ws;
    w.rotation = dir * (1 - flap) * 0.25;
  }
}

// gemalte Fee in einen Container bauen (auch für die Vorschau im Anpassen-Menü):
// Flügel ganz hinten, dann die Ebenen (Körper, Haut eingefärbt, Kleid, Frisur …), darüber Zubehör der Kleidung.
// Gibt die beiden Flügel zurück (zum Schlagen).
export function buildPaintedFigure(scene, container, look, palette, outfit = 'dress', wingRes = FAIRY_RES) {
  container.removeAll(true);
  const wingL = paintedWing(scene, look, palette, -1, wingRes);
  const wingR = paintedWing(scene, look, palette, 1, wingRes);
  container.add([wingL, wingR]);
  const outfitDress = outfit !== 'dress' ? FAIRY_PARTS.dress[outfit] : null; // gemalter Schlafanzug / Schürze
  const hair = FAIRY_PARTS.hair[look.hair];
  for (const slot of LOOK_LAYERS) {
    let part = FAIRY_PARTS[slot][look[slot]];
    if (slot === 'dress' && outfitDress) part = outfitDress;
    if (slot === 'dress' && outfit === 'pj' && !outfitDress) {
      // Schlafen: weites Nachthemd über (statt) dem Kleid
      container.add(outfitImage(scene, 'pj-gown'));
      continue;
    }
    if (slot === 'hairBack' && hair?.back) part = FAIRY_PARTS.hairBack[hair.back];
    if (!part || !scene.textures.exists(partKey(part))) continue;
    container.add(partImage(scene, part));
    if (slot === 'body' && part.skin && look.skin != null && scene.textures.exists(fileKey(part.skin))) {
      container.add(partImage(scene, part, 1, part.skin).setTint(look.skin));
    }
    // Hand der Grundfigur über dem Zauberstab: die Finger liegen vorn
    const body = FAIRY_PARTS.body[look.body];
    if (slot === 'wand' && body?.hand && scene.textures.exists(fileKey(body.hand))) {
      container.add(partImage(scene, body, 1, body.hand));
    }
  }
  // obenauf: Schlafmütze bzw. Schürze mit Stirnband
  if (outfit === 'pj') container.add(outfitImage(scene, 'pj-cap'));
  else if (outfit !== 'dress' && !outfitDress) container.add(outfitImage(scene, outfit));
  return { wingL, wingR };
}

function outfitImage(scene, name) {
  const o = Fairy.outfitBox();
  return scene.add.image(0, 0, Fairy.bakeOutfit(scene, name)).setOrigin(o.ox / o.w, o.oy / o.h).setScale(1 / FAIRY_RES);
}

// weites Nachthemd (zartes Lila mit Monden und Sternchen), groß genug für jedes Kleid; Ursprung = Schultermitte
function drawNightgown(g) {
  const LINE = 0x6a4a6a;
  // (Kinn liegt etwa bei y 0, Hände bei x ±17 / y 14 – oben schmal, damit die Arme frei bleiben)
  const body = [
    { x: -7, y: 1.5 }, { x: 7, y: 1.5 }, { x: 12, y: 6 }, { x: 11.5, y: 14 }, { x: 17, y: 22 }, { x: 23, y: 31 }, { x: 28, y: 41 },
    { x: 14, y: 43 }, { x: 0, y: 41.5 }, { x: -14, y: 43 }, { x: -28, y: 41 }, { x: -23, y: 31 }, { x: -17, y: 22 }, { x: -11.5, y: 14 }, { x: -12, y: 6 },
  ];
  g.fillStyle(0xf3ebff, 1);
  g.fillPoints(body, true);
  // Falten
  g.lineStyle(1.2, 0xd6c6f0, 1);
  for (const x of [-12, -4, 5, 13]) g.lineBetween(x * 0.5, 16, x * 1.3, 41);
  // Monde und Sternchen
  g.fillStyle(0xb9d0ff, 1);
  for (const [x, y] of [[-14, 32], [6, 24], [16, 36], [-4, 37], [-6, 17], [5, 11]]) fillStar(g, x, y, 2.2, 1, 5);
  g.fillStyle(0xffe08a, 1);
  for (const [x, y] of [[-17, 38], [2, 30], [-2, 20], [18, 30]]) {
    g.fillCircle(x, y, 2);
    g.fillStyle(0xf3ebff, 1);
    g.fillCircle(x + 0.9, y - 0.6, 1.7);
    g.fillStyle(0xffe08a, 1);
  }
  g.lineStyle(1.6, LINE, 1);
  g.strokePoints(body, true);
  // Puffärmel
  for (const s of [-1, 1]) {
    g.fillStyle(0xf3ebff, 1);
    g.fillEllipse(s * 12, 7, 10, 9);
    g.lineStyle(1.6, LINE, 1);
    g.strokeEllipse(s * 12, 7, 10, 9);
    g.lineStyle(1.2, 0xd6c6f0, 1);
    g.lineBetween(s * 9, 10.5, s * 15.5, 10);
  }
  // Rüschenkragen mit Schleife
  g.fillStyle(0xffffff, 1);
  g.fillEllipse(0, 2.5, 16, 4.5);
  g.lineStyle(1.3, LINE, 1);
  g.strokeEllipse(0, 2.5, 16, 4.5);
  g.fillStyle(0xff9ec7, 1);
  g.fillTriangle(0, 5.5, -3.5, 3.8, -3.5, 7.2);
  g.fillTriangle(0, 5.5, 3.5, 3.8, 3.5, 7.2);
  g.fillCircle(0, 5.5, 1.3);
}

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
    // Schein hinter der Fee: normaler Mischmodus (ADD würde je Fee zwei Wechsel im Zeichnen kosten – auf dem Tablet
    // bei vielen Feen spürbar); in der Baum-Übersicht ausgeblendet (siehe update)
    this.painted = this.usesPaintedLook();
    const glow = scene.add.image(0, this.painted ? 6 : 0, 'sparkle').setScale(this.painted ? 4.2 : 3.4).setTint(palette.glow).setAlpha(0.42);
    this.glow = glow;
    this.outfit = 'dress';
    if (this.painted) {
      // gemalte Fee aus Ebenen (config/fairyLooks.js): Flügel hinten, darüber Körper, Kleid, Frisur, …
      this.look = lookOf(palette);
      this.figure = scene.add.container(0, 0);
      this.visual.add([glow, this.figure]);
      this.buildFigure();
    } else {
      // Körper und Flügel sind gebacken (doppelte Auflösung, damit sie vergrößert scharf bleiben)
      this.wingL = this.makeWing(-1);
      this.wingR = this.makeWing(1);
      const B = this.bodyBox();
      this.body = bakedImage(scene, this.bodyKey('dress'), B.w, B.h, (g) => this.drawBody(g, 'dress'), { ox: B.ox, oy: B.oy, res: FAIRY_RES });
      this.visual.add([glow, this.wingL, this.wingR, this.body]);
    }
    this.add(this.visual);
    this.setScale(scale).setDepth(DEPTH.fairy);
    this.speed = scale / 1.5; // kleinere Feen fliegen langsamer (Pixel pro Sekunde)
    if (parent) parent.add(this);
    else scene.add.existing(this);

    this.trail = sparkles.trail(this);
    this.trail.setFrequency(110);
  }

  // alle Feen-Texturen (Flügel, Kleid, Schlafanzug) vorab backen, damit später nichts mehr ruckelt
  static prebake(scene, palettes) {
    for (const palette of palettes) {
      const f = { scene, palette, bodyKey: Fairy.prototype.bodyKey, drawBody: Fairy.prototype.drawBody };
      const painted = Fairy.prototype.usesPaintedLook.call(f);
      if (painted) {
        for (const side of [-1, 1]) paintedWing(scene, lookOf(palette), palette, side).destroy();
        continue;
      }
      for (const side of [-1, 1]) Fairy.prototype.makeWing.call(f, side).destroy();
      for (const outfit of ['dress', 'pj', 'apron']) {
        bake(scene, f.bodyKey(outfit), 50, 76, (g) => f.drawBody(g, outfit), 18, 42, FAIRY_RES);
      }
    }
    for (const outfit of ['pj-gown', 'pj-cap', 'apron']) Fairy.bakeOutfit(scene, outfit);
  }

  // ---------- gemalte Fee (Ebenen) ----------

  // gemalt, sobald das Körperbild geladen ist (Geister und fehlende Bilder: gezeichnete Fee)
  usesPaintedLook() {
    const part = FAIRY_PARTS.body[lookOf(this.palette).body];
    return !!part && this.scene.textures.exists(partKey(part));
  }

  // Aussehen ändern (Anpassen-Menü), z. B. setLook({ hair: 'zopf', skin: 0x8d5524 })
  setLook(changes) {
    if (!this.painted) return;
    this.look = { ...this.look, ...changes };
    this.buildFigure();
  }

  buildFigure() {
    const { wingL, wingR } = buildPaintedFigure(this.scene, this.figure, this.look, this.palette, this.outfit);
    this.wingL = wingL;
    this.wingR = wingR;
    this.body = this.figure; // für Code, der den Körper anspricht
  }

  // Zubehör, solange es dafür keine gemalten Teile gibt: Zipfelmütze (Schlafanzug) und Arbeitsschürze mit Stirnband
  static outfitBox() {
    return { w: 64, h: 112, ox: 32, oy: 62 };
  }

  static bakeOutfit(scene, outfit) {
    const B = Fairy.outfitBox();
    const [hx, top, hw] = FIGURE.head;
    return bake(scene, `fairy-outfit-${outfit}`, B.w, B.h, (g) => {
      if (outfit === 'pj-gown') drawNightgown(g);
      else if (outfit === 'pj-cap') {
        const y = top + 8; // Mütze sitzt etwas in den Haaren
        g.fillStyle(0xffffff, 1);
        g.fillTriangle(hx - hw * 0.4, y, hx + hw * 0.4, y, hx + hw * 0.5, y - 18);
        g.lineStyle(1.5, 0x9db8e0, 1);
        g.strokeTriangle(hx - hw * 0.4, y, hx + hw * 0.4, y, hx + hw * 0.5, y - 18);
        g.fillStyle(0xb9d8ff, 1);
        for (const [x, yy] of [[-6, -4], [3, -8], [9, -3]]) g.fillCircle(hx + x, y + yy, 1.6);
        g.fillRoundedRect(hx - hw * 0.46, y - 3, hw * 0.92, 6, 3);
        g.fillStyle(0xfff3a8, 1);
        g.fillCircle(hx + hw * 0.5, y - 19, 4);
      } else if (outfit === 'apron') {
        // Arbeitsschürze (Jeansblau) mit Latz, Tasche und Bleistift
        const pts = [{ x: -5, y: 2 }, { x: 5, y: 2 }, { x: 6, y: 9 }, { x: 12, y: 27 }, { x: -12, y: 27 }, { x: -6, y: 9 }];
        g.fillStyle(0x4f7fc0, 1);
        g.fillPoints(pts, true);
        g.lineStyle(1.5, 0x2c4a78, 1);
        g.strokePoints(pts, true);
        g.fillStyle(0x3b65a0, 1);
        g.fillRoundedRect(-6, 14, 12, 7, 2);
        g.fillStyle(0xffd166, 1);
        g.fillRect(3, 10, 2.5, 7);
        // Stirnband
        g.fillStyle(0xff7a7a, 1);
        g.fillRoundedRect(hx - hw * 0.36, top + 9, hw * 0.72, 4, 2);
      }
    }, B.ox, B.oy, FAIRY_RES);
  }

  // Flügel mit Ursprung an der Schulter, damit scaleX um die Schulter "klappt"
  // (gezeichnete Fee; Geister haben hier ihre Ärmchen)
  makeWing(side) {
    const img = drawnWing(this.scene, this.palette.wing, side);
    img.y = -2;
    return img;
  }

  // Größe der gebackenen Körper-Textur und wo darin der Zeichnungs-Ursprung liegt (Geister: eigene Maße)
  bodyBox() {
    return { w: 50, h: 76, ox: 18, oy: 42 };
  }

  bodyKey(outfit) {
    return `fairy-body-${this.palette.name}-${outfit}`;
  }

  // Kleidung wechseln: 'dress' (eigenes Kleid), 'pj' (weißer Schlafanzug mit Zipfelmütze) oder
  // 'apron' (Kleid mit Arbeitsschürze und Stirnband, Werkstatt)
  setOutfit(outfit) {
    if (outfit === this.outfit) return;
    this.outfit = outfit;
    if (this.painted) return this.buildFigure();
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
    if (outfit === 'apron') {
      // Arbeitsschürze (Jeansblau) mit Latz, Tasche und Bleistift
      g.fillStyle(0x4f7fc0, 1);
      g.fillPoints([{ x: -5, y: -4 }, { x: 5, y: -4 }, { x: 11, y: 24 }, { x: -11, y: 24 }], true);
      g.fillStyle(0x3b65a0, 1);
      g.fillRoundedRect(-6, 10, 12, 7, 2);
      g.fillStyle(0xffd166, 1);
      g.fillRect(3, 6, 2.5, 7);
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
  // (carrying.angle setzen hält es in einem festen Winkel, z. B. Hammer schwingen; sonst schaukelt es)
  carry(obj, dy) {
    this.carrying = { obj, dy, angle: null };
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
    const showGlow = this.home?.detail ?? true;
    if (this.glow.visible !== showGlow) this.glow.setVisible(showGlow);
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
    flapWings(this.wingL, this.wingR, flap);

    // Richtung und Neigung
    if (pose.face) this.facing = pose.face;
    else if (pose.orbit > 0) this.facing = Math.sin(ot) > 0 ? -1 : 1;
    else if (Math.abs(this.vx) > 30) this.facing = Math.sign(this.vx);
    this.visual.scaleX = damp(this.visual.scaleX, this.facing, 10, dt);
    const lean = clamp(this.vx * 0.0009, -0.3, 0.3) + pose.tilt * this.facing + pose.roll;
    this.visual.rotation = damp(this.visual.rotation, lean, 6, dt);

    // Glitzerspur an der Spitze des Zauberstabs (nicht am Ursprung – der liegt am Kinn)
    if (this.painted && this.trail?.followOffset) {
      const [tx, ty] = FIGURE.wandTip;
      const r = this.visual.rotation;
      const lx = tx * this.visual.scaleX;
      const s = this.scaleX;
      this.trail.followOffset.set((lx * Math.cos(r) - ty * Math.sin(r)) * s, (lx * Math.sin(r) + ty * Math.cos(r)) * s);
    }

    // Getragenes Ding hängt unter der Fee und schaukelt leicht
    const c = this.carrying;
    if (c) {
      c.obj.setPosition(this.x, this.y + c.dy);
      c.obj.angle = c.angle ?? Math.sin(this.t * 3) * 5;
    }
  }
}
