import Phaser from 'phaser';
import { GAME_W, GAME_H, COLORS } from '../config/layout.js';
import { GLASS } from '../config/dust.js';
import { EVENTS } from '../events/index.js';
import { dust } from '../state/dust.js';
import { save, saveNow } from '../state/save.js';
import { cardImage, iconButton, labelButton } from '../ui/panels.js';
import { iconImage } from '../ui/icons.js';
import { bakedImage } from '../systems/bake.js';
import { popIn, squish, wobble } from '../systems/juice.js';
import { rand } from '../systems/motion.js';

// Feste Anzeige über dem Baum (läuft in beiden Modi, liegt über allen Szenen), ganz ohne Schrift:
//  - Feenstaub-Glas oben rechts: Glitzer fliegt von der Fee hinein. Ist es voll, kommt nichts mehr dazu, es leuchtet.
//  - Glas antippen (im Baum) öffnet das Event-Fenster wie der Hauptcomputer im Zoo: je Event eine Kachel.
//    Ist das Glas voll, kann man ein Event aussuchen – es leert das Glas ganz. Volles Glas wackelt einladend.
//  - Menü-Knopf oben links (nur im Baum): weiterspielen, speichern, zum Hauptmenü – solange ist das Spiel angehalten
// Koordinaten = Bildschirm (Spielfläche), ohne Verschiebung.

const JAR_W = 92;
const JAR_H = 118;
const JAR_Y_TREE = 250; // unter dem Vollbild-Knopf
const JAR_Y_ROOM = 140; // im Raum: in der Kopfzeile, links neben dem Mülleimer
const MENU_BTN = { x: 90, y: 100 };

export default class HudScene extends Phaser.Scene {
  constructor() {
    super('Hud');
  }

  create() {
    this.tree = this.scene.get('Tree');
    this.mode = 'tree';
    this.pending = 0; // Staub, der gerade noch zum Glas fliegt
    this.shown = dust.amount;
    this.menu = null;

    this.makeJar();
    this.events_ = null; // offenes Event-Fenster
    this.menuBtn = iconButton(this, MENU_BTN.x, MENU_BTN.y, 120, 110, 'menu', () => this.openMenu());

    // Nachrichten aus dem Baum und vom Vorrat
    const onDust = (amount, sx, sy) => this.fly(amount, sx, sy);
    const onMode = (mode) => this.setMode(mode);
    const onChange = () => this.syncShown();
    this.tree.events.on('dust', onDust);
    this.tree.events.on('mode', onMode);
    dust.on('change', onChange);
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => {
      this.tree.events.off('dust', onDust);
      this.tree.events.off('mode', onMode);
      dust.off('change', onChange);
      this.scale.off('resize', this.layout, this);
    });

    // zum Testen: ?staub=voll füllt das Glas
    if (new URLSearchParams(location.search).get('staub') === 'voll') dust.set(GLASS);
    // Cheat zum Testen (wie im Zoo): Taste L füllt das Glas sofort
    this.input.keyboard?.on('keydown-L', () => {
      if (dust.full) return;
      dust.set(GLASS);
      this.pending = 0;
      this.shown = GLASS;
      this.drawJar();
      this.bump(this.jar, 1);
      this.burst(this.jarPoint().x, this.jarPoint().y, 24);
    });

    this.layout();
    this.drawJar();
  }

  // ---------- Glas ----------

  makeJar() {
    this.jarBox = this.add.container(0, 0);
    this.jar = this.add.container(0, 0);
    this.jarFill = this.add.graphics();
    // hinten: Schatten und milchiges Glas; vorne: Rand, Hals und Korken (damit die Füllung kräftig leuchtet)
    const back = bakedImage(this, 'hud-jar-back', JAR_W + 40, JAR_H + 50, (g) => {
      g.fillStyle(0x3b2a6b, 0.25);
      g.fillRoundedRect(-JAR_W / 2 + 3, -JAR_H / 2 + 6, JAR_W, JAR_H, 26);
      g.fillStyle(0xffffff, 0.45);
      g.fillRoundedRect(-JAR_W / 2, -JAR_H / 2, JAR_W, JAR_H, 26);
    }, { ox: JAR_W / 2 + 20, oy: JAR_H / 2 + 30 });
    const glass = bakedImage(this, 'hud-jar-front', JAR_W + 40, JAR_H + 50, (g) => {
      g.lineStyle(6, 0xe2b6ff, 1);
      g.strokeRoundedRect(-JAR_W / 2, -JAR_H / 2, JAR_W, JAR_H, 26);
      g.fillStyle(0xc98b5a, 1);
      g.fillRoundedRect(-24, -JAR_H / 2 - 22, 48, 26, 8);
      g.fillStyle(0xa86d40, 1);
      g.fillRect(-24, -JAR_H / 2 - 4, 48, 6);
    }, { ox: JAR_W / 2 + 20, oy: JAR_H / 2 + 30 });
    const shine = bakedImage(this, 'hud-jar-shine', JAR_W, JAR_H, (g) => {
      g.fillStyle(0xffffff, 0.55);
      g.fillRoundedRect(-JAR_W / 2 + 12, -JAR_H / 2 + 16, 12, JAR_H - 40, 6);
    });
    this.glow = this.add.image(0, 0, 'sparkle').setScale(5).setTint(0xfff3a8).setAlpha(0).setBlendMode('ADD');
    this.jar.add([this.glow, back, this.jarFill, glass, shine]);
    this.jarBox.add(this.jar);
    // Glas antippen: Event-Fenster
    const hit = this.add.rectangle(0, -10, JAR_W + 60, JAR_H + 80, 0, 0).setInteractive();
    hit.on('pointerup', () => this.openEvents());
    this.jarBox.addAt(hit, 0);
  }

  // Füllstand (glitzernd rosa-gold von unten)
  drawJar() {
    const v = Math.max(0, Math.min(this.shown, GLASS));
    const part = v / GLASS;
    const g = this.jarFill.clear();
    const inner = JAR_H - 16;
    const h = inner * part;
    if (h > 1) {
      const top = JAR_H / 2 - 8 - h;
      const r = { tl: Math.min(10, h / 2), tr: Math.min(10, h / 2), bl: 20, br: 20 };
      g.fillStyle(0xff7cc8, 1);
      g.fillRoundedRect(-JAR_W / 2 + 6, top, JAR_W - 12, h, r);
      g.fillStyle(0xffb8e6, 1); // hellere Oberfläche
      g.fillRoundedRect(-JAR_W / 2 + 6, top, JAR_W - 12, Math.min(12, h), { tl: r.tl, tr: r.tr, bl: 0, br: 0 });
      g.fillStyle(0xfff3a8, 0.9);
      for (let i = 0; i < 9; i++) {
        const x = -JAR_W / 2 + 16 + ((i * 37) % (JAR_W - 30));
        const y = top + 6 + ((i * 53) % Math.max(1, h - 10));
        if (y < JAR_H / 2 - 10) g.fillCircle(x, y, 2.5);
      }
    }
    // voll: das Glas schimmert
    const maxed = v >= GLASS;
    if (maxed !== this.maxed) {
      this.maxed = maxed;
      this.tweens.killTweensOf(this.glow);
      if (maxed) this.tweens.add({ targets: this.glow, alpha: { from: 0.15, to: 0.45 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      else this.glow.setAlpha(0);
    }
  }

  // Vorrat hat sich geändert (ausgegeben, neues Spiel …): Anzeige folgt sofort, nur fliegender Staub fehlt noch
  syncShown() {
    const target = Math.max(0, dust.amount - this.pending);
    if (target < this.shown || this.pending === 0) {
      this.shown = target;
      this.drawJar();
    }
  }

  // Staub fliegt von (sx, sy) ins Glas
  fly(amount, sx, sy) {
    const n = Phaser.Math.Clamp(Math.round(amount), 2, 6);
    const share = amount / n;
    this.pending += amount;
    const to = this.jarPoint();
    for (let i = 0; i < n; i++) {
      const p = this.add.image(sx, sy, 'sparkle').setTint(Phaser.Utils.Array.GetRandom(COLORS.glitter)).setBlendMode('ADD').setScale(0.9);
      const c = { x: (sx + to.x) / 2 + rand(-160, 160), y: Math.min(sy, to.y) - rand(80, 260) };
      const t = { u: 0 };
      this.tweens.add({
        targets: t,
        u: 1,
        delay: i * 90,
        duration: rand(700, 1000),
        ease: 'Sine.In',
        onUpdate: () => {
          const u = t.u;
          const dest = this.jarPoint();
          p.setPosition((1 - u) * (1 - u) * sx + 2 * (1 - u) * u * c.x + u * u * dest.x, (1 - u) * (1 - u) * sy + 2 * (1 - u) * u * c.y + u * u * dest.y);
          p.setScale(0.9 - u * 0.4);
        },
        onComplete: () => {
          p.destroy();
          this.pending = Math.max(0, this.pending - share);
          this.arrive(share);
        },
      });
    }
  }

  arrive(share) {
    const wasFull = this.shown >= GLASS;
    this.shown = Math.min(dust.amount, this.shown + share);
    if (this.pending < 0.01) this.shown = dust.amount;
    this.drawJar();
    this.bump(this.jar, 1);
    // gerade voll geworden: Glitzerregen
    if (!wasFull && this.shown >= GLASS) this.burst(this.jarPoint().x, this.jarPoint().y, 24);
  }

  // kurzer Hüpfer (ohne dass sich Wiederholungen aufschaukeln)
  bump(target, base) {
    this.tweens.killTweensOf(target);
    target.setScale(base * 1.12, base * 0.9);
    this.tweens.add({ targets: target, scaleX: base, scaleY: base, duration: 260, ease: 'Back.Out' });
  }

  burst(x, y, count) {
    for (let i = 0; i < count; i++) {
      const p = this.add.image(x, y, 'star').setTint(Phaser.Utils.Array.GetRandom(COLORS.glitter)).setBlendMode('ADD').setScale(0.9);
      const a = rand(0, Math.PI * 2);
      const d = rand(60, 160);
      this.tweens.add({ targets: p, x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, alpha: 0, scale: 0.2, duration: rand(500, 900), ease: 'Cubic.Out', onComplete: () => p.destroy() });
    }
  }

  // Mitte des Glases auf dem Bildschirm
  jarPoint() {
    const s = this.jarBox.scale;
    return { x: this.jarBox.x + this.jar.x * s, y: this.jarBox.y + this.jar.y * s };
  }

  // ---------- Event-Fenster ----------


  openEvents() {
    if (this.events_ || this.menu || this.mode !== 'tree' || this.tree.transitioning || this.busy) return;
    this.bump(this.jar, 1);
    const cx = GAME_W / 2;
    const cy = GAME_H / 2 - 80;
    const m = this.add.container(0, 0);
    const veil = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x2b2150, 0.6).setOrigin(0).setInteractive();
    veil.on('pointerup', () => this.closeEvents());
    const rows = Math.ceil(EVENTS.length / 2);
    const W = EVENTS.length > 1 ? 900 : 560;
    const H = 210 + rows * 390;
    const panel = cardImage(this, W, H, 48, 0xe2b6ff).setPosition(cx, cy).setInteractive();
    const close = iconButton(this, cx + W / 2 - 80, cy - H / 2 + 76, 110, 100, 'cross', () => this.closeEvents());
    // oben das Glas: voll = man darf sich ein Event aussuchen
    const jar = this.add.container(cx, cy - H / 2 + 90, [miniJar(this, false, 2), miniJar(this, true, 2).setVisible(dust.full)]);
    m.add([veil, panel, close, jar]);
    this.bigJar = jar;
    // Kacheln: zwei je Reihe
    this.eventTiles = EVENTS.map((ev, i) => {
      const row = Math.floor(i / 2);
      const inRow = Math.min(2, EVENTS.length - row * 2); // letzte Reihe mit nur einer Kachel: mittig
      const tile = this.makeTile(ev, cx + ((i % 2) - (inRow - 1) / 2) * 400, cy - H / 2 + 320 + row * 390);
      m.add(tile);
      return tile;
    });
    m.setAlpha(0);
    this.tweens.add({ targets: m, alpha: 1, duration: 180 });
    popIn(this, panel, { from: 0.85, to: 1, duration: 500 });
    this.events_ = m;
    this.refreshTiles();
  }

  makeTile(ev, x, y) {
    const c = this.add.container(x, y);
    // alle Events kosten ein volles Glas – die Kachel zeigt nur das Event selbst
    const bg = cardImage(this, 340, 340, 36, 0xb9c8ff);
    const glow = this.add.image(0, 0, 'sparkle').setScale(8).setTint(0xb9d8ff).setAlpha(0.35).setBlendMode('ADD');
    const icon = iconImage(this, ev.icon, 230);
    c.add([bg, glow, icon]);
    c.setSize(340, 340).setInteractive();
    c.on('pointerup', () => this.pickEvent(ev, c));
    Object.assign(c, { ev, glow, icon });
    return c;
  }

  // Kacheln gedimmt, solange es nicht geht (Glas nicht voll, Nacht, ein Event läuft)
  refreshTiles() {
    if (!this.events_) return;
    const free = this.tree.canStartHappening?.();
    for (const t of this.eventTiles) {
      const running = this.tree.happening?.id === t.ev.id;
      const ok = free && dust.full;
      t.setAlpha(running || ok ? 1 : 0.55);
      t.glow.setVisible(ok || running);
      if (ok && !t.wiggle) t.wiggle = this.tweens.add({ targets: t.icon, angle: { from: -4, to: 4 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
  }

  closeEvents() {
    const m = this.events_;
    if (!m) return;
    this.events_ = null;
    for (const t of this.eventTiles ?? []) this.tweens.killTweensOf(t.icon);
    this.eventTiles = [];
    this.tweens.add({ targets: m, alpha: 0, duration: 160, onComplete: () => m.destroy() });
  }

  // Event antippen (nur mit vollem Glas): der ganze Feenstaub strömt aus dem Glas in die Kachel, dann beginnt es
  pickEvent(ev, tile) {
    if (this.busy) return;
    if (!this.tree.canStartHappening() || !dust.full) return wobble(this, tile, { angle: 5 });
    this.busy = true;
    dust.empty();
    this.bigJar.list[1].setVisible(false);
    squish(this, tile, { amount: 0.08 });
    const from = { x: this.bigJar.x, y: this.bigJar.y };
    const n = 14;
    for (let i = 0; i < n; i++) {
      const p = this.add.image(from.x, from.y, 'sparkle').setTint(Phaser.Utils.Array.GetRandom(COLORS.glitter)).setBlendMode('ADD');
      this.events_.add(p);
      this.tweens.add({
        targets: p,
        x: tile.x + rand(-60, 60),
        y: tile.y + rand(-60, 60),
        scale: { from: 1.2, to: 0.4 },
        delay: i * 45,
        duration: 480,
        ease: 'Sine.In',
        onComplete: () => {
          p.destroy();
          if (i % 4 === 0) this.bump(tile, 1);
          if (i < n - 1) return;
          this.burst(tile.x, tile.y, 26);
          this.time.delayedCall(350, () => {
            this.closeEvents();
            this.tree.startHappening(ev.id);
            this.busy = false;
          });
        },
      });
    }
  }

  // ---------- Spielmenü ----------

  openMenu() {
    if (this.menu || this.events_ || this.mode !== 'tree' || this.tree.transitioning) return;
    this.scene.pause('Tree');
    if (this.scene.isActive('UI')) this.scene.pause('UI');
    const cx = GAME_W / 2;
    const cy = GAME_H / 2 - 60;
    const m = this.add.container(0, 0);
    const veil = this.add.rectangle(0, 0, GAME_W, GAME_H, 0x2b2150, 0.6).setOrigin(0).setInteractive();
    veil.on('pointerup', () => this.closeMenu()); // neben die Tafel tippen schließt
    const panel = cardImage(this, 760, 760, 44, 0xe2b6ff).setPosition(cx, cy).setInteractive();
    const resume = labelButton(this, cx, cy - 230, 640, 170, 'play', 'Weiterspielen', null, () => this.closeMenu());
    const saveBtn = labelButton(this, cx, cy, 640, 170, 'save', 'Speichern', savedLine(), () => this.saveFromMenu(saveBtn));
    if (save.testMode) saveBtn.setAlpha(0.5);
    const home = labelButton(this, cx, cy + 230, 640, 170, 'home', 'Zum Hauptmenü', null, () => this.toTitle());
    m.add([veil, panel, resume, saveBtn, home]);
    m.setAlpha(0);
    this.tweens.add({ targets: m, alpha: 1, duration: 180 });
    popIn(this, panel, { from: 0.85, to: 1, duration: 500 });
    this.menu = m;
  }

  closeMenu() {
    const m = this.menu;
    if (!m) return;
    this.menu = null;
    this.tweens.add({ targets: m, alpha: 0, duration: 160, onComplete: () => m.destroy() });
    this.scene.resume('Tree');
    if (this.scene.isPaused('UI')) this.scene.resume('UI');
  }

  saveFromMenu(btn) {
    if (save.testMode) return wobble(this, btn);
    if (!saveNow()) {
      btn.setSub('Speichern hat nicht geklappt');
      return wobble(this, btn);
    }
    // geklappt: grüner Haken springt auf den Knopf, darunter die Uhrzeit
    btn.setSub(savedLine());
    const ok = iconImage(this, 'check', 90).setPosition(btn.x + 260, btn.y - 40);
    this.menu?.add(ok);
    popIn(this, ok, { from: 0, to: ok.scale, duration: 600 });
    this.burst(btn.x + 260, btn.y - 40, 10);
    this.time.delayedCall(1400, () => ok.active && this.tweens.add({ targets: ok, alpha: 0, duration: 300, onComplete: () => ok.destroy() }));
  }

  // zum Hauptmenü: erst speichern (außer im Test-Spiel), dann alle Spielszenen beenden
  toTitle() {
    saveNow();
    for (const key of ['RoomEdit', 'UI', 'Back', 'Tree']) if (this.scene.isActive(key) || this.scene.isPaused(key) || this.scene.isSleeping(key)) this.scene.stop(key);
    this.scene.start('Menu');
  }

  // ---------- Modus und Anordnung ----------

  setMode(mode) {
    this.mode = mode;
    if (mode !== 'tree') this.closeEvents();
    this.layout();
  }

  layout() {
    const room = this.mode === 'room';
    this.jarBox.setPosition(room ? GAME_W - 270 : GAME_W - 100, room ? JAR_Y_ROOM : JAR_Y_TREE).setScale(room ? 0.75 : 1);
    this.menuBtn.setVisible(!room);
  }

  update(time) {
    this.refreshTiles();
    // Glas voll: es wackelt ab und zu einladend (nur im Baum, wenn gerade ein Event geht)
    const invite = this.mode === 'tree' && !this.events_ && !this.menu && this.tree.canStartHappening?.() && dust.full;
    this.jar.angle = invite ? Math.sin(time / 140) * 6 * Math.max(0, Math.sin(time / 900)) ** 8 : 0;
  }
}

// zweite Zeile am Speichern-Knopf (wie im Zoo)
function savedLine() {
  if (save.testMode) return 'Test-Spiel – wird nicht gespeichert';
  if (!save.lastSaved) return 'noch nicht gespeichert';
  const t = new Date(save.lastSaved).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  return `zuletzt gespeichert: ${t} Uhr`;
}

// kleines Glas (im Event-Fenster): leer oder gefüllt
function miniJar(scene, full, scale = 1) {
  const key = full ? 'hud-mini-full' : 'hud-mini-empty';
  return bakedImage(scene, key, 44, 54, (g) => {
    if (full) {
      g.fillStyle(0xffc8f0, 1);
      g.fillRoundedRect(-14, -12, 28, 30, 10);
      g.fillStyle(0xfff3a8, 1);
      g.fillCircle(-5, -2, 2.5);
      g.fillCircle(5, 8, 2.5);
    }
    g.fillStyle(0xc98b5a, full ? 1 : 0.5);
    g.fillRoundedRect(-9, -25, 18, 9, 3);
    g.lineStyle(4, full ? 0xe2b6ff : 0xc9b8e8, full ? 1 : 0.8);
    g.strokeRoundedRect(-16, -16, 32, 38, 12);
  }).setScale(scale);
}
